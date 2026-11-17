import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import type { ModeDefinition, PointId } from './modeSchema';
import { freeModePosition } from './modeSchema';
import type { RoomDefinition } from './roomSchema';

export type PointOwner = 'neutral' | 'player' | 'enemy';
export interface ConquestPoint {
  id: PointId;
  position: Vec3;
  radiusM: number;
  owner: PointOwner;
  progress: number;
  contested: boolean;
}
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Czysta symulacja; host dostarcza tylko żywych uczestników. */
export class Conquest {
  readonly points: ConquestPoint[];
  tickets: number;
  alive = 0;
  outcome: 'victory' | 'death' | null = null;
  private spawnS = 0;
  constructor(
    readonly definition: ModeDefinition,
    private readonly bus: EventBus,
  ) {
    this.points = definition.points.map((p) => ({
      ...p,
      position: { ...p.position },
      owner: 'neutral',
      progress: 0,
      contested: false,
    }));
    this.tickets = definition.enemyTickets;
  }
  killed(): void {
    if (!this.outcome) this.tickets = Math.max(0, this.tickets - 1);
  }
  setTickets(n: number): boolean {
    if (!Number.isFinite(n) || n < 0 || this.outcome) return false;
    this.tickets = n;
    return true;
  }
  capture(id: string): boolean {
    const point = this.points.find((p) => p.id === id);
    if (!point || this.outcome) return false;
    point.progress = 1;
    this.own(point, 'player');
    return true;
  }
  private own(point: ConquestPoint, owner: PointOwner): void {
    if (point.owner === owner) return;
    point.owner = owner;
    const owners = { A: 'neutral', B: 'neutral', C: 'neutral' } as Record<
      'A' | 'B' | 'C',
      PointOwner
    >;
    for (const p of this.points) owners[p.id] = p.owner;
    this.bus.emit('conquest_captured', { id: point.id, owner, owners });
  }
  step(dt: number, player: Vec3, enemies: readonly Vec3[], dead = false): void {
    if (this.outcome) return;
    this.alive = enemies.length;
    if (dead) {
      this.outcome = 'death';
      return;
    }
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    this.spawnS = Math.max(0, this.spawnS - dt);
    for (const point of this.points) {
      const inside = (p: Vec3) =>
        distance(p, point.position) <= point.radiusM &&
        Math.abs(p.y - point.position.y) <= tuning.modes.conquest.zoneHeightM;
      const friendly = inside(player),
        hostile = enemies.some(inside);
      point.contested = friendly && hostile;
      if (friendly === hostile) continue;
      const before = point.progress;
      point.progress = Math.max(
        -1,
        Math.min(1, before + (friendly ? dt : -dt) / this.definition.captureS),
      );
      if (
        (before < 0 && point.progress >= 0) ||
        (before > 0 && point.progress <= 0)
      )
        this.own(point, 'neutral');
      if (point.progress >= 1 - 1e-9) {
        point.progress = 1;
        this.own(point, 'player');
      }
      if (point.progress <= -1 + 1e-9) {
        point.progress = -1;
        this.own(point, 'enemy');
      }
    }
    const held = this.points.filter((p) => p.owner === 'player').length;
    const rate =
      held === 3
        ? this.definition.bleed.holdThreePerS
        : held === 2
          ? this.definition.bleed.holdTwoPerS
          : 0;
    this.tickets = Math.max(0, this.tickets - rate * dt);
    if (this.tickets === 0 && this.alive === 0) this.outcome = 'victory';
  }
  moveGoal(position: Vec3, player: Vec3): Vec3 | undefined {
    if (distance(position, player) <= tuning.modes.conquest.detectRangeM)
      return undefined;
    const candidates = this.points.filter((p) => p.owner !== 'enemy');
    candidates.sort(
      (a, b) => distance(a.position, position) - distance(b.position, position),
    );
    // Wszystkie punkty wroga: strażnik zostaje na stanowisku.
    return { ...(candidates[0]?.position ?? position) };
  }
  spawnPosition(
    room: RoomDefinition,
    player: Vec3,
    enemies: readonly Vec3[],
    rng: Rng,
  ): Vec3 | null {
    if (
      this.outcome ||
      this.tickets <= 0 ||
      enemies.length >= this.definition.maxAlive ||
      this.spawnS > 0
    )
      return null;
    const cfg = tuning.modes.conquest;
    const safe = (p: Vec3) =>
      freeModePosition(room, p, cfg.spawnClearanceM) &&
      distance(p, player) >= cfg.minSpawnDistanceM &&
      enemies.every((e) => distance(e, p) >= cfg.spawnClearanceM * 2);
    const owned = this.points
      .filter((p) => p.owner === 'enemy')
      .map((p) => p.position)
      .filter(safe);
    const floors = room.blocks.filter(
      (b) => Math.abs(b.position.y + b.size.y / 2 - room.playerSpawn.y) < 1e-6,
    );
    const edges = floors
      .flatMap((b) =>
        [-1, 1].flatMap((x) =>
          [-1, 1].map((z) => ({
            x: b.position.x + x * (b.size.x / 2 - cfg.edgeInsetM),
            y: room.playerSpawn.y,
            z: b.position.z + z * (b.size.z / 2 - cfg.edgeInsetM),
          })),
        ),
      )
      .filter(safe);
    const candidates = owned.length ? owned : edges;
    return candidates.length ? { ...rng.pick(candidates) } : null;
  }
  spawned(): void {
    this.spawnS = this.definition.spawnIntervalS;
    this.alive++;
  }
  snapshot(): { points: ConquestPoint[]; tickets: number; alive: number } {
    return {
      points: structuredClone(this.points),
      tickets: this.tickets,
      alive: this.alive,
    };
  }
}
