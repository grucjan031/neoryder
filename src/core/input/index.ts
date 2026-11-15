import { z } from 'zod';
import bindingsData from '../../data/inputBindings.json';

export const actionSchema = z.enum([
  'moveForward',
  'moveBack',
  'moveLeft',
  'moveRight',
  'jump',
  'sprint',
  'dash',
  'crouch',
  'attack',
  'block',
  'swap',
  'power',
  'power2',
  'weapon1',
  'weapon2',
  'weapon3',
  'bladeThrow',
]);
/** Pojedyncze zdarzenie ruchu myszy większe niż to (px) to artefakt przeglądarki, nie gest. */
const MAX_MOUSE_DELTA = 400;

export type Action = z.infer<typeof actionSchema>;
export type BindingOverrides = Partial<Record<Action, string>>;
export const isBindingCode = (code: string): boolean =>
  code === '' ||
  /^(Key[A-Z]|Digit[0-9]|Numpad\w+|F([1-9]|1[0-9]|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|CapsLock|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/.test(
    code,
  );
const bindings = z
  .object({
    keyboard: z.record(z.string(), actionSchema),
    mouse: z.record(z.string(), actionSchema),
  })
  .parse(bindingsData);

/** Puste nadpisanie oznacza akcję bez klawisza; przyciski myszy pozostają niezależne. */
export function resolveBindings(
  overrides: BindingOverrides = {},
): Record<string, Action> {
  const keyboard = { ...bindings.keyboard };
  const displaced = new Set<Action>();
  for (const [name, code] of Object.entries(overrides)) {
    const parsed = actionSchema.safeParse(name);
    if (!parsed.success || !isBindingCode(code)) continue;
    const action = parsed.data;
    for (const [key, owner] of Object.entries(keyboard))
      if (owner === action) delete keyboard[key];
    if (!code) continue;
    const previous = keyboard[code];
    if (previous && previous !== action) displaced.add(previous);
    keyboard[code] = action;
  }
  for (const action of displaced) {
    if (Object.values(keyboard).includes(action)) continue;
    for (const [code, owner] of Object.entries(bindings.keyboard))
      if (owner === action && !keyboard[code]) keyboard[code] = action;
  }
  return keyboard;
}

export function assignBinding(
  overrides: BindingOverrides,
  action: Action,
  code: string,
): BindingOverrides {
  if (!isBindingCode(code) || !code) return { ...overrides };
  const next = { ...overrides };
  delete next[action];
  next[action] = code;
  const resolved = resolveBindings(next);
  // Utrwalenie rozstrzygnięcia zapobiega powrotowi wypartego nadpisania po kolejnej zmianie.
  for (const name of Object.keys(next) as Action[])
    next[name] =
      Object.keys(resolved).find((key) => resolved[key] === name) ?? '';
  return next;
}

export interface InputSnapshot {
  held: ReadonlySet<Action>;
  pressed: ReadonlySet<Action>;
  released: ReadonlySet<Action>;
  lookDelta: { x: number; y: number };
}

export class Input {
  private readonly held = new Set<Action>();
  private readonly pressed = new Set<Action>();
  private readonly released = new Set<Action>();
  private readonly down = new Map<string, Action>();
  private lookDelta = { x: 0, y: 0 };
  private skipNextMove = false;
  private readonly focusListeners = new Set<() => void>();
  private readonly listeners = new AbortController();
  private wasLocked = false;
  private readonly document: Document;

  constructor(
    private readonly target: HTMLElement,
    private readonly getBindings: () => BindingOverrides = () => ({}),
  ) {
    this.document = target.ownerDocument;
    const win = this.document.defaultView;
    if (!win) throw new Error('Brak okna dla wejścia.');
    const options = { signal: this.listeners.signal };
    const isEditing = (element: EventTarget | null): boolean =>
      !this.pointerLocked ||
      [element, this.document.activeElement].some(
        (node) =>
          node instanceof HTMLElement &&
          (node.isContentEditable ||
            node.closest(
              'input, textarea, select, button, [role="button"], a[href]',
            ) !== null),
      );
    win.addEventListener(
      'keydown',
      (event) => {
        if (isEditing(event.target)) return;
        if (event.defaultPrevented) return;
        const action = resolveBindings(this.getBindings())[event.code];
        if (action) {
          event.preventDefault();
          this.press(event.code, action);
        }
      },
      options,
    );
    win.addEventListener('keyup', (event) => this.release(event.code), options);
    target.addEventListener(
      'mousedown',
      (event) => {
        if (event.button === 1) event.preventDefault();
        const action = bindings.mouse[String(event.button)];
        if (action) this.press(`mouse:${event.button}`, action);
      },
      options,
    );
    target.addEventListener(
      'auxclick',
      (event) => {
        if (event.button === 1) event.preventDefault();
      },
      options,
    );
    win.addEventListener(
      'mouseup',
      (event) => this.release(`mouse:${event.button}`),
      options,
    );
    target.addEventListener(
      'contextmenu',
      (event) => event.preventDefault(),
      options,
    );
    win.addEventListener(
      'mousemove',
      (event) => {
        if (!this.pointerLocked) return;
        // Chromium (zwłaszcza Linux) po przechwyceniu kursora przenosi go na środek i wysyła
        // zdarzenie z ogromnym przesunięciem — kamera „skakałaby” przy każdym wejściu w grę.
        if (this.skipNextMove) {
          this.skipNextMove = false;
          return;
        }
        if (
          Math.abs(event.movementX) > MAX_MOUSE_DELTA ||
          Math.abs(event.movementY) > MAX_MOUSE_DELTA
        )
          return;
        this.lookDelta.x += event.movementX;
        this.lookDelta.y += event.movementY;
      },
      options,
    );
    win.addEventListener('blur', () => this.loseFocus(), options);
    this.document.addEventListener(
      'visibilitychange',
      () => {
        if (this.document.hidden) this.loseFocus();
      },
      options,
    );
    this.document.addEventListener(
      'pointerlockchange',
      () => {
        if (this.wasLocked && !this.pointerLocked) this.loseFocus();
        if (!this.wasLocked && this.pointerLocked) this.skipNextMove = true;
        this.wasLocked = this.pointerLocked;
      },
      options,
    );
  }

  private press(code: string, action: Action): void {
    if (this.down.has(code)) return;
    this.down.set(code, action);
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }
  private release(code: string): void {
    const action = this.down.get(code);
    if (!action) return;
    this.down.delete(code);
    if (![...this.down.values()].includes(action)) {
      this.held.delete(action);
      this.released.add(action);
    }
  }
  private loseFocus(): void {
    this.clear();
    for (const cb of [...this.focusListeners]) cb();
  }
  clear(): void {
    for (const action of this.held) this.released.add(action);
    this.held.clear();
    this.pressed.clear();
    this.down.clear();
    this.lookDelta = { x: 0, y: 0 };
  }
  snapshot(): InputSnapshot {
    const result = {
      held: new Set(this.held),
      pressed: new Set(this.pressed),
      released: new Set(this.released),
      lookDelta: { ...this.lookDelta },
    };
    this.pressed.clear();
    this.released.clear();
    this.lookDelta = { x: 0, y: 0 };
    return result;
  }
  requestPointerLock(): void {
    try {
      const pending = this.target.requestPointerLock();
      if (pending)
        void pending.catch(() => {
          /* Przeglądarka może odmówić blokady. */
        });
    } catch {
      /* Blokada jest opcjonalna, np. w osadzonym podglądzie. */
    }
  }
  get pointerLocked(): boolean {
    return this.document.pointerLockElement === this.target;
  }
  onFocusLost(cb: () => void): () => void {
    this.focusListeners.add(cb);
    return () => {
      this.focusListeners.delete(cb);
    };
  }
  dispose(): void {
    this.listeners.abort();
    this.focusListeners.clear();
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.down.clear();
    if (this.pointerLocked) this.document.exitPointerLock();
  }
}
