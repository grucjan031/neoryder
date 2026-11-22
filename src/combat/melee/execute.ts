import { z } from 'zod';
import type { EntityId, EventBus } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import executeRewardsData from '../../data/melee/executeRewards.json';
import type { DamageSystem } from '../damage';
import type { StatusQuery } from '../status';

const executeRewards = z
  .object({
    energy: z.number().finite().nonnegative(),
    heal: z.number().finite().nonnegative(),
  })
  .parse(executeRewardsData);

export interface ExecuteEnemy {
  id: EntityId;
  kind: string;
  position: Vec3;
}

export interface ExecuteDeps {
  bus: EventBus;
  damage: DamageSystem;
  tuning: Tuning;
  owner: EntityId;
  statuses: StatusQuery;
  enemies(): readonly ExecuteEnemy[];
  aim(): { origin: Vec3; dir: Vec3 };
  addEnergy(amount: number): void;
  heal(amount: number): void;
  castWall?(origin: Vec3, dir: Vec3, max: number): number | null;
}

export class ExecuteSystem {
  private readonly ready = new Set<EntityId>();
  private readonly nextReady = new Set<EntityId>();
  private readonly readyView: EntityId[] = [];
  private invulnS = 0;
  private disposed = false;

  constructor(private readonly deps: ExecuteDeps) {}

  step(dt: number): void {
    if (this.disposed || !(dt > 0)) return;
    this.invulnS = Math.max(0, this.invulnS - dt);
    const next = this.nextReady;
    next.clear();
    for (const enemy of this.deps.enemies()) {
      if (this.isReady(enemy)) next.add(enemy.id);
    }
    for (const id of this.ready) if (!next.has(id)) this.setReady(id, false);
    for (const id of next) if (!this.ready.has(id)) this.setReady(id, true);
  }

  readyIds(): readonly EntityId[] {
    return this.readyView;
  }

  invulnerable(): boolean {
    return this.invulnS > 0;
  }

  targetId(): EntityId | null {
    return this.findTarget()?.id ?? null;
  }

  tryExecute(): boolean {
    const target = this.findTarget();
    if (!target) return false;
    const { damage, owner, tuning, bus } = this.deps;
    const health = damage.health(target.id);
    if (!health) return false;
    const m = tuning.melee;
    const point = { ...target.position };
    const { origin } = this.deps.aim();
    const dx = point.x - origin.x,
      dy = point.y - origin.y,
      dz = point.z - origin.z;
    const distance = Math.hypot(dx, dy, dz);
    const dir =
      distance > 0
        ? { x: dx / distance, y: dy / distance, z: dz / distance }
        : { ...this.deps.aim().dir };
    // Ochrona obejmuje również synchroniczne skutki zabójstwa (np. eksplozję synergii).
    const previousInvuln = this.invulnS;
    this.invulnS = m.executeInvulnS;
    damage.deal(target.id, {
      // Zapas na redukcje celu (damageTaken < 1) i mnożnik gracza < 1; Health obcina do pozostałego zdrowia.
      amount: health.max * 10,
      source: owner,
      tags: ['#melee', '#execute'],
      point,
      dir,
      knockback: m.executeKnockback,
    });
    if (!health.dead) {
      this.invulnS = previousInvuln;
      return false;
    }
    this.setReady(target.id, false);
    this.deps.addEnergy(executeRewards.energy);
    this.deps.heal(executeRewards.heal);
    bus.emit('execute_performed', {
      attacker: owner,
      target: target.id,
      point,
    });
    bus.emit('hitstop', { ms: m.executeHitstopMs });
    bus.emit('slowmo', {
      timeScale: m.executeSlowmoScale,
      durationS: m.executeSlowmoS,
    });
    bus.emit('camera_shake', {
      intensity: m.executeShake,
      durationS: m.executeSlowmoS,
      dir,
    });
    return true;
  }

  dispose(): void {
    for (const id of this.ready) this.setReady(id, false);
    this.invulnS = 0;
    this.disposed = true;
  }

  private setReady(id: EntityId, ready: boolean): void {
    if (this.ready.has(id) === ready) return;
    if (ready) {
      this.ready.add(id);
      this.readyView.push(id);
    } else {
      this.ready.delete(id);
      const index = this.readyView.indexOf(id);
      for (let i = index; i < this.readyView.length - 1; i++)
        this.readyView[i] = this.readyView[i + 1]!;
      this.readyView.length--;
    }
    this.deps.bus.emit('enemy_executable', { id, ready });
  }

  private isReady(enemy: ExecuteEnemy): boolean {
    const { damage, tuning, statuses } = this.deps;
    const health = damage.health(enemy.id);
    if (
      !health ||
      health.dead ||
      enemy.kind === 'boss' ||
      damage.isInvulnerable(enemy.id)
    )
      return false;
    const fraction =
      enemy.kind === 'executor'
        ? tuning.melee.executeHpFracElite
        : tuning.melee.executeHpFrac;
    return (
      health.current <= fraction * health.max ||
      statuses.has(enemy.id, 'stunned')
    );
  }

  private findTarget(): ExecuteEnemy | null {
    if (this.disposed || this.deps.damage.health(this.deps.owner)?.dead)
      return null;
    const { origin, dir } = this.deps.aim();
    const length = Math.hypot(dir.x, dir.y, dir.z);
    if (!(length > 0)) return null;
    const m = this.deps.tuning.melee;
    let best: ExecuteEnemy | null = null;
    let bestDot = Math.cos((m.executeArcDeg * Math.PI) / 360);
    let bestDistance = Infinity;
    for (const enemy of this.deps.enemies()) {
      if (
        !this.isReady(enemy) ||
        !this.deps.damage.canDamage(this.deps.owner, enemy.id)
      )
        continue;
      const x = enemy.position.x - origin.x,
        y = enemy.position.y - origin.y,
        z = enemy.position.z - origin.z;
      const distance = Math.hypot(x, y, z);
      if (distance > m.executeRangeM) continue;
      const dot =
        distance > 0
          ? (x * dir.x + y * dir.y + z * dir.z) / (distance * length)
          : 1;
      if (dot < bestDot || (dot === bestDot && distance >= bestDistance))
        continue;
      if (
        distance > 0 &&
        this.deps.castWall?.(
          origin,
          { x: x / distance, y: y / distance, z: z / distance },
          distance,
        ) != null
      )
        continue;
      best = enemy;
      bestDot = dot;
      bestDistance = distance;
    }
    return best;
  }
}
