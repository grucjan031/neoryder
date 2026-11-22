import type { InputDevice } from '../events';
import type { Tuning } from '../tuning';
import type { Action, GamepadBindingOverrides } from './index';

export interface Stick {
  x: number;
  y: number;
}

export interface GamepadSettings {
  sensitivityX: number;
  sensitivityY: number;
  invertY: boolean;
  deadzone?: number;
  aimAssist: boolean;
  vibration: boolean;
  vibrationStrength: number;
  bindings: GamepadBindingOverrides;
}

export type GamepadBinding = { press?: Action; hold?: Action };
export type GamepadTuning = Tuning['gamepad'];
export type SampledPad = Pick<
  Gamepad,
  'axes' | 'buttons' | 'id' | 'index' | 'mapping' | 'connected' | 'timestamp'
> &
  Partial<Pick<Gamepad, 'vibrationActuator'>>;

export interface PadFrame {
  pad: SampledPad;
  layout: InputDevice['layout'];
  buttons: ReadonlySet<number>;
  pressed: ReadonlySet<number>;
  move: Stick;
  look: Stick;
  active: boolean;
}

export interface GamepadMotion {
  move: Stick;
  look: Stick;
  aimAssist: boolean;
}

export function gamepadLayout(id: string): InputDevice['layout'] {
  if (/(?:^|[^\da-f])054c(?:$|[^\da-f])|dualshock|dualsense/i.test(id))
    return 'playstation';
  if (/xbox|xinput/i.test(id)) return 'xbox';
  if (/wireless controller/i.test(id)) return 'playstation';
  return 'generic';
}

export function radialStick(
  x: number,
  y: number,
  inner: number,
  outer: number,
  exponent: number,
): Stick {
  const length = Math.hypot(x, y);
  const end = Math.max(0, 1 - outer);
  const start = Math.min(Math.max(0, inner), end);
  if (!Number.isFinite(length) || length <= start) return { x: 0, y: 0 };
  const strength =
    Math.min(1, (length - start) / (end - start)) **
    Math.max(Number.EPSILON, exponent);
  return { x: (x / length) * strength, y: (y / length) * strength };
}

export class GamepadInput {
  frame: PadFrame | null = null;
  private readonly previous = new Map<number, PadFrame>();
  private readonly pending = new Map<
    number,
    { binding: GamepadBinding; time: number; long: boolean }
  >();
  private fullLookS = 0;
  motion: GamepadMotion | undefined;

  constructor(private readonly navigator: Pick<Navigator, 'getGamepads'>) {}

  poll(t: GamepadTuning, settings: GamepadSettings): PadFrame | null {
    let first: PadFrame | null = null;
    let current: PadFrame | null = null;
    let used: PadFrame | null = null;
    const seen = new Set<number>();
    let pads: readonly (Gamepad | null)[];
    try {
      pads = this.navigator.getGamepads?.() ?? [];
    } catch {
      pads = [];
    }
    for (const pad of pads) {
      if (!pad?.connected || pad.mapping !== 'standard') continue;
      const prior = this.previous.get(pad.index);
      const old = prior?.pad.id === pad.id ? prior : undefined;
      const buttons = new Set<number>();
      const pressed = new Set<number>();
      pad.buttons.forEach((button, index) => {
        if (!button.pressed) return;
        buttons.add(index);
        if (!old?.buttons.has(index)) pressed.add(index);
      });
      const [lx = 0, ly = 0, rx = 0, ry = 0] = pad.axes;
      const deadzone = settings.deadzone ?? t.innerDeadzone;
      const move = radialStick(
        lx,
        ly,
        deadzone,
        t.outerDeadzone,
        t.moveExponent,
      );
      const look = radialStick(
        rx,
        ry,
        deadzone,
        t.outerDeadzone,
        t.lookExponent,
      );
      const active =
        pressed.size > 0 ||
        stickUsed(move, old?.move, t.axisActivityDelta) ||
        stickUsed(look, old?.look, t.axisActivityDelta);
      const sample = {
        pad,
        layout: gamepadLayout(pad.id),
        buttons,
        pressed,
        move,
        look,
        active,
      };
      seen.add(pad.index);
      this.previous.set(pad.index, sample);
      first ??= sample;
      if (pad.index === this.frame?.pad.index && pad.id === this.frame.pad.id)
        current = sample;
      if (active && (!used || current === sample)) used = sample;
    }
    for (const index of this.previous.keys())
      if (!seen.has(index)) this.previous.delete(index);
    this.frame = used ?? current ?? first;
    return this.frame;
  }

  apply(
    dt: number,
    t: GamepadTuning,
    settings: GamepadSettings,
    bindings: Readonly<Record<number, GamepadBinding>>,
    press: (code: string, action: Action) => void,
    release: (code: string) => void,
    held: ReadonlySet<Action>,
  ): void {
    const frame = this.frame;
    if (!frame) return;
    const toggleSprint = () => {
      if (held.has('sprint')) release('pad:sprint');
      else press('pad:sprint', 'sprint');
    };
    for (const [button, pending] of this.pending) {
      const code = `pad:${button}`;
      pending.time += dt;
      if (pending.binding.hold && !pending.long && pending.time >= t.holdS) {
        pending.long = true;
        press(code, pending.binding.hold);
      }
      if (frame.buttons.has(button)) continue;
      if (pending.binding.hold && !pending.long && pending.binding.press)
        press(code, pending.binding.press);
      release(code);
      this.pending.delete(button);
    }
    for (const button of frame.pressed) {
      const binding = bindings[button];
      if (!binding) continue;
      if (binding.press === 'pause' && !binding.hold) continue;
      if (!binding.hold && binding.press === 'sprint') {
        toggleSprint();
        continue;
      }
      this.pending.set(button, { binding, time: 0, long: false });
      if (!binding.hold && binding.press) press(`pad:${button}`, binding.press);
    }
    const { move, look } = frame;
    this.fullLookS =
      Math.hypot(look.x, look.y) >= t.lookFullThreshold
        ? this.fullLookS + dt
        : 0;
    const boost =
      1 +
      (t.lookAcceleration - 1) *
        Math.min(
          1,
          this.fullLookS / Math.max(Number.EPSILON, t.lookAccelerationS),
        );
    this.motion = {
      move,
      look: {
        x: look.x * t.lookSpeedX * settings.sensitivityX * boost,
        y:
          look.y *
          t.lookSpeedY *
          settings.sensitivityY *
          boost *
          (settings.invertY ? -1 : 1),
      },
      aimAssist: settings.aimAssist,
    };
  }

  clear(): void {
    this.motion = undefined;
    this.pending.clear();
    this.fullLookS = 0;
  }
}

function stickUsed(
  stick: Stick,
  previous: Stick | undefined,
  delta: number,
): boolean {
  if (!stick.x && !stick.y) return false;
  return (
    !previous ||
    (!previous.x && !previous.y) ||
    Math.hypot(stick.x - previous.x, stick.y - previous.y) >= delta
  );
}
