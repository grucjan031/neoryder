import { z } from 'zod';
import type { EntityId, EventBus } from '../../core/events';
import type { InputSnapshot } from '../../core/input';
import type { Vec3 } from '../../core/math';
import { dot, normalize, sub } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import type { DamageSystem } from '../damage';
import pushData from '../../data/powers/push.json';
import type { PlayerEnergy } from './energy';

export const pushSchema = z.object({
  id: z.string().min(1),
  cost: z.number().finite().nonnegative(),
  cooldownS: z.number().finite().nonnegative(),
  /** Pełny kąt stożka w stopniach. */
  coneAngleDeg: z.number().finite().positive().max(180),
  range: z.number().finite().positive(),
  /** Impuls odrzutu (N·s) przekazywany w damage_dealt.knockback. */
  knockback: z.number().finite().nonnegative(),
  damage: z.number().finite().nonnegative(),
  /** Dodatkowe obrażenia, gdy odrzut wbije cel w ścianę. */
  wallSlamDamage: z.number().finite().nonnegative(),
  /** Jak daleko odrzut niesie cel (m) — ściana bliżej oznacza uderzenie. */
  wallSlamRange: z.number().finite().positive(),
  tags: z.array(z.string().startsWith('#')),
});
export type PushDefinition = z.infer<typeof pushSchema>;

export function loadPush(data: unknown): PushDefinition {
  const result = pushSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane mocy: ${result.error.message}`);
  return result.data;
}

export const pushDefinition = loadPush(pushData);

export interface PushTarget {
  id: EntityId;
  /** Środek celu (zwykle tułów). */
  position: Vec3;
}

export interface PushDeps {
  owner: EntityId;
  damage: DamageSystem;
  energy: PlayerEnergy;
  aim(): { origin: Vec3; dir: Vec3 };
  /** Potencjalne cele (wrogowie w scenie). Filtr drużyn robi DamageSystem. */
  targets(): readonly PushTarget[];
  /** Odległość do ściany wzdłuż promienia albo null (tylko geometria świata). */
  castWall(origin: Vec3, dir: Vec3, maxDistance: number): number | null;
}

interface PendingSlam {
  target: EntityId;
  remainingS: number;
  point: Vec3;
  dir: Vec3;
}

/**
 * Pchnięcie Rezonansu: stożek przed graczem. Każdy cel dostaje obrażenia i odrzut
 * (damage_dealt.knockback, reakcję ruchu realizuje wróg). Uderzenie w ścianę jest
 * przewidywane promieniem w chwili pchnięcia: jeśli ściana jest bliżej niż wallSlamRange,
 * po czasie lotu (dystans / prędkość odrzutu) cel dostaje wallSlamDamage z tagiem #wall.
 */
export class ResonancePush {
  private cooldownS = 0;
  /** Wciśnięcie zapamiętane w hitstopie (dt = 0) — wykonane w pierwszym kroku z dt > 0. */
  private queued = false;
  private readonly pending: PendingSlam[] = [];

  constructor(
    private readonly def: PushDefinition,
    private readonly deps: PushDeps,
    private readonly bus: EventBus,
    private readonly tuning: Tuning,
  ) {}

  get cooldownRemaining(): number {
    return this.cooldownS;
  }

  step(dt: number, input: InputSnapshot): void {
    if (input.pressed.has('power')) this.queued = true;
    if (!(dt > 0)) return; // hitstop: moc nie działa bez upływu czasu symulacji
    this.cooldownS = Math.max(0, this.cooldownS - dt);
    this.stepSlams(dt);
    if (this.queued) {
      this.queued = false;
      this.use();
    }
  }

  /** Stan początkowy (nowy run): bez odnowienia, kolejki i oczekujących uderzeń w ścianę. */
  reset(): void {
    this.cooldownS = 0;
    this.queued = false;
    this.pending.length = 0;
  }

  /** Zwraca liczbę trafionych celów albo null przy odmowie. */
  use(): number | null {
    const { owner, energy } = this.deps;
    if (this.cooldownS > 0) {
      this.bus.emit('power_denied', {
        power: this.def.id,
        user: owner,
        reason: 'cooldown',
      });
      return null;
    }
    if (!energy.spend(this.def.cost)) {
      this.bus.emit('power_denied', {
        power: this.def.id,
        user: owner,
        reason: 'no_energy',
      });
      return null;
    }
    this.cooldownS = this.def.cooldownS;
    this.bus.emit('power_used', { power: this.def.id, user: owner });
    this.bus.emit('camera_shake', {
      intensity: this.tuning.powers.pushShake,
      durationS: 0.25,
      dir: null,
    });

    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const cosHalf = Math.cos(((this.def.coneAngleDeg / 2) * Math.PI) / 180);
    let hits = 0;
    for (const target of this.deps.targets()) {
      const to = sub(target.position, origin);
      const distance = Math.hypot(to.x, to.y, to.z);
      if (distance > this.def.range || distance < 1e-6) continue;
      const away = normalize(to);
      if (dot(away, forward) < cosHalf) continue;
      // Odrzut głównie poziomy, lekko w górę — czytelny lot.
      const push = normalize({
        x: away.x,
        y: Math.max(0.15, away.y),
        z: away.z,
      });
      const dealt = this.deps.damage.deal(target.id, {
        amount: this.def.damage,
        source: owner,
        tags: this.def.tags,
        point: target.position,
        dir: push,
        knockback: this.def.knockback,
      });
      if (
        dealt <= 0 &&
        !this.deps.damage.canDamage(owner, target.id, this.def.tags)
      )
        continue;
      hits++;
      const flat = normalize({ x: push.x, y: 0, z: push.z });
      const wall = this.deps.castWall(
        target.position,
        flat,
        this.def.wallSlamRange,
      );
      if (wall !== null && this.def.knockback > 0)
        this.pending.push({
          target: target.id,
          remainingS: wall / this.def.knockback,
          point: {
            x: target.position.x + flat.x * wall,
            y: target.position.y,
            z: target.position.z + flat.z * wall,
          },
          dir: flat,
        });
    }
    if (hits > 0)
      this.bus.emit('hitstop', { ms: this.tuning.powers.pushHitstopMs });
    return hits;
  }

  private stepSlams(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const slam = this.pending[i] as PendingSlam;
      slam.remainingS -= dt;
      if (slam.remainingS > 0) continue;
      this.pending.splice(i, 1);
      this.deps.damage.deal(slam.target, {
        amount: this.def.wallSlamDamage,
        source: this.deps.owner,
        tags: [...this.def.tags, '#wall'],
        point: slam.point,
        dir: slam.dir,
      });
    }
  }
}
