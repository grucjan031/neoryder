import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';

export type PayloadParams = Tuning['prototypes']['payload'];

export interface PayloadStop {
  id: string;
  name: string;
  /** Odległość od początku trasy (m), na której skład staje. */
  atM: number;
  holdS: number;
  /** Klucz fali przekazany do haka `reinforce`. */
  wave: string;
  /** Skład rusza dopiero po wyczyszczeniu fali (poza upływem `holdS`). */
  clearRequired: boolean;
}

export interface PayloadHooks {
  reinforce(wave: string, stopId: string): void;
}

export interface PayloadInput {
  /** Stopy gracza. */
  player: Vec3;
  /** Pozycje żywych wrogów. */
  hostiles: readonly Vec3[];
  /** Wrogowie fal jeszcze niewprowadzeni do gry (kolejka, przerwa przed falą). */
  pending?: number;
}

export type PayloadStatus =
  | 'waitingPlayer'
  | 'moving'
  | 'contested'
  | 'holding'
  | 'arrived'
  | 'destroyed';

export interface PayloadSnapshot {
  status: PayloadStatus;
  position: Vec3;
  yaw: number;
  distanceM: number;
  lengthM: number;
  progress: number;
  hp: number;
  maxHp: number;
  stopIndex: number;
  stopName: string | null;
  holdRemainingS: number;
}

const horizontal = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Wagon na trasie z postojami (S4-03). Czysta logika: jedzie z `speedMps`, gdy gracz
 * jest w `pushRadiusM`, a w `contestRadiusM` nie ma żywych wrogów. Na postojach staje,
 * woła hak `reinforce` i rusza po `holdS` (i po wyczyszczeniu fali, gdy `clearRequired`).
 * Sukces na końcu trasy, porażka przy HP 0.
 */
export class RailPayload {
  readonly lengthM: number;
  private readonly cumulative: number[] = [0];
  private _status: PayloadStatus = 'waitingPlayer';
  private _hp: number;
  private distance = 0;
  private stopIndex = 0;
  private hold: { stop: PayloadStop; remainingS: number } | null = null;

  constructor(
    private readonly route: readonly Vec3[],
    private readonly stops: readonly PayloadStop[],
    private readonly params: PayloadParams,
    private readonly hooks: PayloadHooks,
  ) {
    if (route.length < 2) throw new Error('Trasa wagonu wymaga 2 punktów.');
    for (let i = 1; i < route.length; i++)
      this.cumulative.push(
        this.cumulative[i - 1]! +
          Math.hypot(
            route[i]!.x - route[i - 1]!.x,
            route[i]!.y - route[i - 1]!.y,
            route[i]!.z - route[i - 1]!.z,
          ),
      );
    this.lengthM = this.cumulative[route.length - 1]!;
    if (!(this.lengthM > 0)) throw new Error('Trasa wagonu ma zerową długość.');
    let previous = 0;
    for (const stop of stops) {
      if (!(stop.atM > previous) || !(stop.atM < this.lengthM))
        throw new Error(
          `Postój ${stop.id}: odległość musi rosnąć i mieścić się w trasie.`,
        );
      previous = stop.atM;
    }
    this._hp = params.maxHealth;
  }

  get status(): PayloadStatus {
    return this._status;
  }
  get hp(): number {
    return this._hp;
  }
  get distanceM(): number {
    return this.distance;
  }
  get finished(): boolean {
    return this._status === 'arrived' || this._status === 'destroyed';
  }
  get nextStop(): PayloadStop | undefined {
    return this.stops[this.stopIndex];
  }

  setHp(value: number): void {
    if (this.finished || !Number.isFinite(value)) return;
    this._hp = Math.min(this.params.maxHealth, Math.max(0, value));
    if (this._hp <= 0) this._status = 'destroyed';
  }

  /** Pozycja i kierunek jazdy (yaw jak u wrogów: atan2(dx, dz)) na dystansie `d` trasy. */
  poseAt(d: number): { position: Vec3; yaw: number } {
    const clamped = Math.min(this.lengthM, Math.max(0, d));
    let i = 1;
    while (i < this.route.length - 1 && this.cumulative[i]! < clamped) i++;
    const a = this.route[i - 1]!;
    const b = this.route[i]!;
    const span = this.cumulative[i]! - this.cumulative[i - 1]!;
    const t = span > 0 ? (clamped - this.cumulative[i - 1]!) / span : 0;
    return {
      position: {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      },
      yaw: Math.atan2(b.x - a.x, b.z - a.z),
    };
  }

  get position(): Vec3 {
    return this.poseAt(this.distance).position;
  }

  /** Debug: przeskakuje do następnego postoju (albo końca) i uruchamia jego logikę. */
  skip(): boolean {
    if (this.finished) return false;
    if (this.hold) {
      this.hold = null;
      this.stopIndex++;
    }
    this.distance = this.nextStop?.atM ?? this.lengthM;
    this.arrive();
    return true;
  }

  step(dt: number, input: PayloadInput): void {
    if (this.finished || !(dt > 0)) return;
    if (this._hp <= 0) {
      this._status = 'destroyed';
      return;
    }
    const pending = input.pending ?? 0;
    if (this.hold) {
      this.hold.remainingS = Math.max(0, this.hold.remainingS - dt);
      const cleared = input.hostiles.length === 0 && pending === 0;
      if (
        this.hold.remainingS > 0 ||
        (this.hold.stop.clearRequired && !cleared)
      )
        return;
      this.hold = null;
      this.stopIndex++;
    }
    const at = this.position;
    if (horizontal(input.player, at) > this.params.pushRadiusM) {
      this._status = 'waitingPlayer';
      return;
    }
    if (
      input.hostiles.some(
        (h) => horizontal(h, at) <= this.params.contestRadiusM,
      )
    ) {
      this._status = 'contested';
      return;
    }
    this._status = 'moving';
    const limit = this.nextStop?.atM ?? this.lengthM;
    this.distance = Math.min(limit, this.distance + this.params.speedMps * dt);
    if (this.distance >= limit) this.arrive();
  }

  snapshot(): PayloadSnapshot {
    const pose = this.poseAt(this.distance);
    return {
      status: this._status,
      position: pose.position,
      yaw: pose.yaw,
      distanceM: this.distance,
      lengthM: this.lengthM,
      progress: this.distance / this.lengthM,
      hp: this._hp,
      maxHp: this.params.maxHealth,
      stopIndex: this.stopIndex,
      stopName: this.hold?.stop.name ?? this.nextStop?.name ?? null,
      holdRemainingS: this.hold?.remainingS ?? 0,
    };
  }

  private arrive(): void {
    const stop = this.nextStop;
    if (!stop) {
      this.distance = this.lengthM;
      this._status = 'arrived';
      return;
    }
    this.distance = stop.atM;
    this.hold = { stop, remainingS: stop.holdS };
    this._status = 'holding';
    this.hooks.reinforce(stop.wave, stop.id);
  }
}
