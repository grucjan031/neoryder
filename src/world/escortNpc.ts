import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';

export type EscortParams = Tuning['prototypes']['escort'];
export type EscortState =
  'waiting' | 'following' | 'holding' | 'evacuated' | 'dead';
export type EscortMotion = 'idle' | 'walk' | 'run';

/** Wycinek `ArenaNavigation`: tylko to, czego potrzebuje więzień. */
export interface EscortNavigation {
  next(from: Vec3, to: Vec3): Vec3;
  path(from: Vec3, to: Vec3): Vec3[];
}

export interface EscortSnapshot {
  state: EscortState;
  position: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  motion: EscortMotion;
  freeProgress: number;
  stuckEvents: number;
}

const horizontal = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Więzień do odbicia (S4-03). Czysta logika kinematyczna, bez fizyki i renderu:
 * `waiting` (klęczy) → `following` (idzie za graczem po nawigacji areny) ⇄ `holding`
 * (gracz poza smyczą) → `evacuated` (sukces) albo `dead` (porażka).
 * Pozycje to stopy; wysokość pochodzi z punktów nawigacji.
 */
export class EscortNpc {
  private _state: EscortState = 'waiting';
  private _hp: number;
  private _yaw = 0;
  private _motion: EscortMotion = 'idle';
  private freeS = 0;
  private stuckS = 0;
  private _stuckEvents = 0;
  private anchor: Vec3;
  private readonly pos: Vec3;

  constructor(
    start: Vec3,
    private readonly evac: Vec3,
    private readonly nav: EscortNavigation,
    private readonly params: EscortParams,
  ) {
    this.pos = { ...start };
    this.anchor = { ...start };
    this._hp = params.maxHealth;
  }

  get state(): EscortState {
    return this._state;
  }
  get position(): Vec3 {
    return this.pos;
  }
  get hp(): number {
    return this._hp;
  }
  get stuckEvents(): number {
    return this._stuckEvents;
  }
  get finished(): boolean {
    return this._state === 'evacuated' || this._state === 'dead';
  }

  /** Uwolnienie bez czekania (debug, host); działa tylko z `waiting`. */
  free(): boolean {
    if (this._state !== 'waiting') return false;
    this._state = 'following';
    this.freeS = 0;
    this.resetStuck();
    return true;
  }

  setHp(value: number): void {
    if (this.finished || !Number.isFinite(value)) return;
    this._hp = Math.min(this.params.maxHealth, Math.max(0, value));
    if (this._hp <= 0) this._state = 'dead';
  }

  /** Przestawia więźnia (debug); nie zmienia stanu. */
  teleport(x: number, z: number, y = this.pos.y): void {
    this.pos.x = x;
    this.pos.y = y;
    this.pos.z = z;
    this.resetStuck();
  }

  /**
   * Jeden krok symulacji. `player` — stopy gracza (odległości, uwolnienie, smycz);
   * `goal` — punkt do podążania w siatce nawigacji (domyślnie gracz).
   */
  step(dt: number, player: Vec3, goal: Vec3 = player): void {
    if (this.finished || !(dt > 0)) return;
    const p = this.params;
    this._motion = 'idle';
    if (this._state === 'waiting') {
      this.freeS =
        horizontal(this.pos, player) <= p.freeRadiusM ? this.freeS + dt : 0;
      if (this.freeS >= p.freeHoldS) this.free();
      return;
    }
    if (horizontal(this.pos, this.evac) <= p.evacRadiusM) {
      this._state = 'evacuated';
      return;
    }
    const d = horizontal(this.pos, player);
    if (this._state === 'following' && d > p.leashM) this._state = 'holding';
    else if (this._state === 'holding' && d <= p.leashResumeM)
      this._state = 'following';
    if (this._state !== 'following' || d <= p.followDistanceM) {
      this.resetStuck();
      return;
    }
    const speed = d > p.catchUpDistanceM ? p.catchUpSpeedMps : p.speedMps;
    this.moveToward(this.nav.next(this.pos, goal), speed * dt);
    this._motion = speed === p.catchUpSpeedMps ? 'run' : 'walk';
    this.trackStuck(dt, goal);
  }

  snapshot(): EscortSnapshot {
    return {
      state: this._state,
      position: { ...this.pos },
      yaw: this._yaw,
      hp: this._hp,
      maxHp: this.params.maxHealth,
      motion: this._motion,
      freeProgress: Math.min(1, this.freeS / this.params.freeHoldS),
      stuckEvents: this._stuckEvents,
    };
  }

  private moveToward(target: Vec3, maxStep: number): void {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const h = Math.hypot(dx, dz);
    if (h <= 1e-6) return;
    const fraction = Math.min(1, maxStep / h);
    this.pos.x += dx * fraction;
    this.pos.z += dz * fraction;
    this.pos.y += (target.y - this.pos.y) * fraction;
    this._yaw = Math.atan2(dx, dz);
  }

  private resetStuck(): void {
    this.stuckS = 0;
    this.anchor = { ...this.pos };
  }

  private trackStuck(dt: number, goal: Vec3): void {
    if (horizontal(this.pos, this.anchor) >= this.params.stuckEpsM) {
      this.resetStuck();
      return;
    }
    this.stuckS += dt;
    if (this.stuckS < this.params.stuckS) return;
    this._stuckEvents++;
    const next = this.nav
      .path(this.pos, goal)
      .find((q) => horizontal(q, this.pos) >= this.params.unstickMinStepM);
    if (next) {
      this.pos.x = next.x;
      this.pos.y = next.y;
      this.pos.z = next.z;
    }
    this.resetStuck();
  }
}
