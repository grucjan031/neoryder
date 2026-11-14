import type { EntityId, EventBus } from '../core/events';
import type { Action, InputSnapshot } from '../core/input';
import type { Tuning } from '../core/tuning';

export type HeldKind = 'blade' | 'gun';

export interface HeldItemView {
  held: HeldKind;
  target: HeldKind;
  swapping: boolean;
  swapT: number;
}

const bladeActions = new Set<Action>(['attack', 'block', 'bladeThrow']);

function withoutBladeActions(input: InputSnapshot): InputSnapshot {
  const filter = (actions: ReadonlySet<Action>): ReadonlySet<Action> =>
    new Set([...actions].filter((action) => !bladeActions.has(action)));
  return {
    ...input,
    held: filter(input.held),
    pressed: filter(input.pressed),
    released: filter(input.released),
  };
}

export class HeldItem {
  private current: HeldKind;
  private target: HeldKind;
  private swapping = false;
  private elapsedS = 0;
  private requested: HeldKind | null = null;
  private bufferS = 0;
  private weapon: string | null = null;
  private readonly offWeapon: () => void;

  constructor(
    private readonly bus: EventBus,
    private readonly owner: EntityId,
    private readonly tuning: Tuning,
    start: HeldKind,
  ) {
    this.current = this.target = start;
    this.offWeapon = bus.on('weapon_switched', ({ owner, weapon }) => {
      if (owner === this.owner) this.weapon = weapon;
    });
  }

  get held(): HeldKind {
    return this.current;
  }

  view(): HeldItemView {
    return {
      held: this.current,
      target: this.target,
      swapping: this.swapping,
      swapT: this.swapping
        ? Math.min(1, this.elapsedS / this.tuning.hands.swapS)
        : 1,
    };
  }

  requestGun(): void {
    this.request('gun');
  }

  requestToggle(): void {
    this.request(this.current === 'blade' ? 'gun' : 'blade');
  }

  private request(target: HeldKind): void {
    if (this.swapping || target === this.current) return;
    this.requested = target;
    this.bufferS = this.tuning.hands.swapBufferS;
  }

  forceBlade(): void {
    const changed = this.current !== 'blade';
    this.clear('blade');
    if (changed) this.emit();
  }

  reset(start: HeldKind): void {
    this.clear(start);
    this.emit();
  }

  private clear(start: HeldKind): void {
    this.current = this.target = start;
    this.swapping = false;
    this.elapsedS = 0;
    this.requested = null;
    this.bufferS = 0;
  }

  private emit(): void {
    this.bus.emit('held_item_changed', {
      owner: this.owner,
      held: this.current,
      weapon: this.current === 'gun' ? this.weapon : null,
    });
  }

  step(
    dt: number,
    input: InputSnapshot,
    ctx: { bladeBusy: boolean },
  ): { bladeInput: InputSnapshot; triggerHeld: boolean } {
    const needsBlade =
      input.held.has('block') ||
      input.pressed.has('block') ||
      input.held.has('bladeThrow') ||
      input.pressed.has('bladeThrow');
    if (needsBlade && (this.current === 'gun' || this.swapping)) {
      this.forceBlade();
      return { bladeInput: input, triggerHeld: false };
    }
    if (input.pressed.has('swap')) this.requestToggle();
    if (dt > 0 && this.requested !== null) {
      if (this.current === 'gun' || (!ctx.bladeBusy && !needsBlade)) {
        this.target = this.requested;
        this.requested = null;
        this.swapping = true;
        this.elapsedS = 0;
      } else {
        this.bufferS = Math.max(0, this.bufferS - dt);
        if (this.bufferS <= Number.EPSILON * 16) this.requested = null;
      }
    }
    const swapStep = this.swapping;
    if (dt > 0 && this.swapping) {
      this.elapsedS += dt;
      if (this.elapsedS + Number.EPSILON * 16 >= this.tuning.hands.swapS) {
        this.current = this.target;
        this.swapping = false;
        this.emit();
      }
    }
    return {
      bladeInput:
        swapStep || this.current === 'gun' ? withoutBladeActions(input) : input,
      triggerHeld:
        !swapStep && this.current === 'gun' && input.held.has('attack'),
    };
  }

  dispose(): void {
    this.offWeapon();
  }
}
