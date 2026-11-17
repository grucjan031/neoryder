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
  /** Postęp celowania 0–1 (liniowy; `aim` zwraca wygładzony). */
  private aimT = 0;
  private aimingNow = false;
  /** Po przełączeniu broni albo przerwaniu celowania PPM trzeba puścić i wcisnąć ponownie. */
  private aimLatch = false;

  constructor(
    private readonly bus: EventBus,
    private readonly owner: EntityId,
    private readonly tuning: Tuning,
    start: HeldKind,
  ) {
    this.current = this.target = start;
    this.offWeapon = bus.on('weapon_switched', ({ owner, weapon }) => {
      if (owner !== this.owner) return;
      this.weapon = weapon;
      // Przełączenie broni kończy celowanie (FOV wraca płynnie).
      if (this.aimingNow) this.aimLatch = true;
      this.aimingNow = false;
    });
  }

  get held(): HeldKind {
    return this.current;
  }

  /** Celowanie (ADS) 0–1, wygładzone; 0 bez broni palnej w ręce. */
  get aim(): number {
    const t = this.aimT;
    return t * t * (3 - 2 * t);
  }

  /** Gracz trzyma celowanie w tym kroku (przyciski, broń w ręce, `canAim`). */
  get aiming(): boolean {
    return this.aimingNow;
  }

  /** Natychmiastowy koniec celowania (śmierć, reset); ponowne wymaga puszczenia PPM. */
  cancelAim(): void {
    this.aimT = 0;
    this.aimLatch = this.aimingNow || this.aimLatch;
    this.aimingNow = false;
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
    this.aimT = 0;
    this.aimingNow = false;
    this.aimLatch = false;
  }

  private stepAim(dt: number, wants: boolean, inScale = 1): void {
    if (!wants && this.aimingNow) this.aimLatch = true;
    this.aimingNow = wants;
    if (!(dt > 0)) return;
    const a = this.tuning.player.aim;
    const rate = 1 / Math.max(1e-3, wants ? a.inS * inScale : a.outS);
    this.aimT = Math.min(1, Math.max(0, this.aimT + (wants ? dt : -dt) * rate));
  }

  private emit(): void {
    this.bus.emit('held_item_changed', {
      owner: this.owner,
      held: this.current,
      weapon: this.current === 'gun' ? this.weapon : null,
    });
  }

  /**
   * PPM zależnie od przedmiotu w ręce: z ostrzem `block` (jak dotąd), z bronią palną (bez zmiany
   * w toku) celowanie — nie wymusza już ostrza. `bladeThrow` nadal wyciąga ostrze. `canAim`
   * (domyślnie true) wyłącza celowanie np. przy przegrzaniu, dashu albo poza walką.
   */
  step(
    dt: number,
    input: InputSnapshot,
    ctx: { bladeBusy: boolean; canAim?: boolean; aimInScale?: number },
  ): { bladeInput: InputSnapshot; triggerHeld: boolean } {
    const gunReady = this.current === 'gun' && !this.swapping;
    const aimHeld = input.held.has('aim') || input.held.has('block');
    if (!aimHeld) this.aimLatch = false;
    const needsBlade =
      (!gunReady && (input.held.has('block') || input.pressed.has('block'))) ||
      input.held.has('bladeThrow') ||
      input.pressed.has('bladeThrow');
    if (needsBlade && (this.current === 'gun' || this.swapping)) {
      this.forceBlade();
      this.stepAim(dt, false);
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
    this.stepAim(
      dt,
      gunReady &&
        !swapStep &&
        this.current === 'gun' &&
        aimHeld &&
        !this.aimLatch &&
        (ctx.canAim ?? true),
      ctx.aimInScale,
    );
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
