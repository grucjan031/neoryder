import { z } from 'zod';
import bindingsData from '../../data/inputBindings.json';
import inputText from '../../data/ui/input.pl.json';
import type { EventBus, InputDevice } from '../events';
import { tuning } from '../tuning';
import { GamepadInput } from './gamepad';
import type { GamepadBinding, GamepadMotion, GamepadSettings } from './gamepad';

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
  /** Celowanie (ADS): PPM z bronią palną w ręce (mapuje `HeldItem`), opcjonalnie klawisz. */
  'aim',
  'swap',
  'inspect',
  'coolWeapon',
  'power',
  'power2',
  'weapon1',
  'weapon2',
  'weapon3',
  'bladeThrow',
  'map',
  /** Menu ulepszeń w runie (Tab): lista implantów, synergii, mocy i modułów w pauzie. */
  'inventory',
  /** Komenda drużyny: sojusznicy idą za graczem albo trzymają pozycję (przełącznik). */
  'squadCommand',
  'pause',
]);
/** Pojedyncze zdarzenie ruchu myszy większe niż to (px) to artefakt przeglądarki, nie gest. */
const MAX_MOUSE_DELTA = 400;

export type Action = z.infer<typeof actionSchema>;
export type BindingOverrides = Partial<Record<Action, string>>;
export type GamepadBindingOverrides = Partial<Record<Action, number | null>>;
export const isGamepadButton = (index: unknown): index is number =>
  typeof index === 'number' &&
  Number.isInteger(index) &&
  index >= 0 &&
  index <= 16;
const gamepadBindingSchema = z.object({
  press: actionSchema.optional(),
  hold: actionSchema.optional(),
});
export const isBindingCode = (code: string): boolean =>
  code === '' ||
  /^(Key[A-Z]|Digit[0-9]|Numpad\w+|F([1-9]|1[0-9]|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|CapsLock|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash)$/.test(
    code,
  );
const bindings = z
  .object({
    keyboard: z.record(z.string(), actionSchema),
    mouse: z.record(z.string(), actionSchema),
    gamepad: z.record(
      z
        .string()
        .refine((key) => /^\d+$/.test(key) && isGamepadButton(Number(key))),
      gamepadBindingSchema,
    ),
  })
  .parse(bindingsData);

export const mouseBindings = bindings.mouse;

const holdActions = new Set(
  Object.values(bindings.gamepad).flatMap(({ hold }) => (hold ? [hold] : [])),
);
const tapActions = new Set(
  Object.values(bindings.gamepad).flatMap(({ press, hold }) =>
    press && hold ? [press] : [],
  ),
);

export function resolveGamepadBindings(
  overrides: GamepadBindingOverrides = {},
): Record<number, GamepadBinding> {
  const result: Record<number, GamepadBinding> = {};
  for (const [index, binding] of Object.entries(bindings.gamepad))
    result[Number(index)] = { ...binding };
  for (const [name, index] of Object.entries(overrides)) {
    const parsed = actionSchema.safeParse(name);
    if (!parsed.success || (index !== null && !isGamepadButton(index)))
      continue;
    const action = parsed.data;
    const slot = holdActions.has(action) ? 'hold' : 'press';
    for (const binding of Object.values(result))
      if (binding[slot] === action) delete binding[slot];
    if (index === null) continue;
    const binding = (result[index] ??= {});
    if (slot === 'hold' && binding.press && !tapActions.has(binding.press))
      delete binding.press;
    if (slot === 'press' && !tapActions.has(action)) delete binding.hold;
    binding[slot] = action;
  }
  return result;
}

export function assignGamepadBinding(
  overrides: GamepadBindingOverrides,
  action: Action,
  button: number,
): GamepadBindingOverrides {
  if (!isGamepadButton(button)) return { ...overrides };
  const next = { ...overrides };
  delete next[action];
  next[action] = button;
  const resolved = resolveGamepadBindings(next);
  for (const name of Object.keys(next) as Action[]) {
    const entry = Object.entries(resolved).find(
      ([, { press, hold }]) => press === name || hold === name,
    );
    next[name] = entry ? Number(entry[0]) : null;
  }
  return next;
}

export const defaultGamepadSettings = (): GamepadSettings => ({
  sensitivityX: 1,
  sensitivityY: 1,
  invertY: false,
  aimAssist: true,
  vibration: true,
  vibrationStrength: 1,
  bindings: {},
});

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
  gamepad?: GamepadMotion;
}

interface PadOptions {
  bus: EventBus;
  settings: () => GamepadSettings;
  keyboardActions?: boolean;
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
  private lockHint: HTMLButtonElement | undefined;
  private readonly gamepad: GamepadInput;
  private device: InputDevice = { device: 'keyboardMouse', layout: 'generic' };
  private windowFocused = true;
  private padOverrides?: GamepadBindingOverrides;
  private padBindings: Record<number, GamepadBinding> = {};

  constructor(
    private readonly target: HTMLElement,
    private readonly getBindings: () => BindingOverrides = () => ({}),
    private readonly padOptions?: PadOptions,
  ) {
    this.document = target.ownerDocument;
    const win = this.document.defaultView;
    if (!win) throw new Error('Brak okna dla wejścia.');
    this.gamepad = new GamepadInput(win.navigator);
    const options = { signal: this.listeners.signal };
    const isEditing = (element: EventTarget | null): boolean =>
      this.document.querySelector('dialog:modal') !== null ||
      [element, this.document.activeElement].some(
        (node) =>
          node instanceof HTMLElement &&
          (node.isContentEditable ||
            node.closest(
              'input, textarea, select, button, [role="button"], a[href], [contenteditable], dialog[open], [role="dialog"]:not([hidden]), .run-screen:not([hidden]), .hub-screen:not([hidden]), .sector-map:not([hidden]), .build-select:not([hidden])',
            ) !== null),
      );
    win.addEventListener(
      'keydown',
      (event) => {
        if (!event.repeat && (event.isTrusted || event.code !== 'Escape'))
          this.setDevice('keyboardMouse');
      },
      { ...options, capture: true },
    );
    win.addEventListener(
      'keydown',
      (event) => {
        if (this.padOptions?.keyboardActions === false) return;
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
        this.setDevice('keyboardMouse');
        if (this.padOptions?.keyboardActions === false) return;
        if (event.button === 1) event.preventDefault();
        const action = bindings.mouse[String(event.button)];
        if (action) this.press(`mouse:${event.button}`, action);
      },
      options,
    );
    target.addEventListener(
      'auxclick',
      (event) => {
        if (this.padOptions?.keyboardActions !== false && event.button === 1)
          event.preventDefault();
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
      (event) => {
        if (this.padOptions?.keyboardActions !== false) event.preventDefault();
      },
      options,
    );
    win.addEventListener(
      'mousemove',
      (event) => {
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
        if (
          Math.hypot(event.movementX, event.movementY) >=
          tuning.gamepad.mouseActivityPx
        )
          this.setDevice('keyboardMouse');
        if (!this.pointerLocked || this.device.device === 'gamepad') return;
        this.lookDelta.x += event.movementX;
        this.lookDelta.y += event.movementY;
      },
      options,
    );
    win.addEventListener(
      'blur',
      () => {
        this.windowFocused = false;
        this.loseFocus();
      },
      options,
    );
    win.addEventListener(
      'focus',
      () => {
        this.windowFocused = true;
      },
      options,
    );
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
        if (this.pointerLocked && this.lockHint) {
          this.lockHint.hidden = true;
          if (this.document.activeElement === this.lockHint)
            this.target.focus();
        }
        if (
          this.wasLocked &&
          !this.pointerLocked &&
          this.device.device === 'keyboardMouse'
        )
          this.loseFocus();
        if (!this.wasLocked && this.pointerLocked) this.skipNextMove = true;
        this.wasLocked = this.pointerLocked;
      },
      options,
    );
    this.document.addEventListener(
      'pointerlockerror',
      () => this.showLockHint(),
      options,
    );
  }

  private showLockHint(): void {
    if (
      this.listeners.signal.aborted ||
      this.pointerLocked ||
      this.device.device === 'gamepad'
    )
      return;
    if (!this.lockHint) {
      this.lockHint = this.document.createElement('button');
      this.lockHint.type = 'button';
      this.lockHint.className = 'pointer-lock-hint';
      this.lockHint.textContent = inputText.pointerLockRetry;
      this.lockHint.setAttribute('aria-live', 'polite');
      this.lockHint.addEventListener('click', () => this.requestPointerLock(), {
        signal: this.listeners.signal,
      });
      this.document.body.append(this.lockHint);
    }
    this.lockHint.hidden = false;
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
    this.gamepad.clear();
  }

  get activeDevice(): InputDevice {
    return this.device;
  }

  get padFrame() {
    return this.windowFocused && !this.document.hidden
      ? this.gamepad.frame
      : null;
  }

  get padPauseButton(): number | undefined {
    const pressed = this.padFrame?.pressed;
    if (this.device.device !== 'gamepad' || !pressed) return undefined;
    for (const index of pressed)
      if (this.padBindings[index]?.press === 'pause') return index;
    return undefined;
  }

  update(dt: number, gameplayEnabled: boolean | (() => boolean)): void {
    const options = this.padOptions;
    if (!options || !this.windowFocused || this.document.hidden) return;
    const settings = options.settings();
    if (settings.bindings !== this.padOverrides) {
      this.padOverrides = settings.bindings;
      this.padBindings = resolveGamepadBindings(settings.bindings);
    }
    const old = this.gamepad.frame;
    const frame = this.gamepad.poll(tuning.gamepad, settings);
    const changedPad =
      old?.pad.index !== frame?.pad.index || old?.pad.id !== frame?.pad.id;
    if (frame?.active) {
      if (changedPad && this.device.device === 'gamepad') this.clear();
      this.setDevice('gamepad', frame.layout);
    } else if (this.device.device === 'gamepad' && changedPad) {
      this.setDevice('keyboardMouse');
    }
    if (
      this.device.device === 'gamepad' &&
      frame &&
      (typeof gameplayEnabled === 'function'
        ? gameplayEnabled()
        : gameplayEnabled)
    )
      this.gamepad.apply(
        dt,
        tuning.gamepad,
        settings,
        this.padBindings,
        (code, action) => this.press(code, action),
        (code) => this.release(code),
        this.held,
      );
    else if (this.gamepad.motion) this.clear();
  }

  private setDevice(
    device: InputDevice['device'],
    layout: InputDevice['layout'] = 'generic',
  ): void {
    if (device === this.device.device && layout === this.device.layout) return;
    this.clear();
    this.device = { device, layout };
    if (device === 'gamepad') {
      if (this.lockHint) this.lockHint.hidden = true;
      this.skipNextMove = this.pointerLocked;
      if (this.pointerLocked) this.document.exitPointerLock?.();
    }
    this.padOptions?.bus.emit('input:deviceChanged', this.device);
  }

  snapshot(): InputSnapshot {
    const result: InputSnapshot = {
      held: new Set(this.held),
      pressed: new Set(this.pressed),
      released: new Set(this.released),
      lookDelta: { ...this.lookDelta },
      ...(this.gamepad.motion ? { gamepad: this.gamepad.motion } : {}),
    };
    this.pressed.clear();
    this.released.clear();
    this.lookDelta = { x: 0, y: 0 };
    return result;
  }
  requestPointerLock(): void {
    if (this.device.device === 'gamepad') return;
    try {
      const pending = this.target.requestPointerLock();
      if (pending) void pending.catch(() => this.showLockHint());
    } catch {
      this.showLockHint();
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
    this.lockHint?.remove();
    this.focusListeners.clear();
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.down.clear();
    if (this.pointerLocked) this.document.exitPointerLock();
  }
}
