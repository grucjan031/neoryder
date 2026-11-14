import type { GameContext } from '../../core/context';
import type { EntityId, Team } from '../../core/events';
import type { Vec3 } from '../../core/math';
import { ResourcePool } from '../../core/resource';
import type { Rng } from '../../core/rng';
import type { Stats } from '../../core/stats';
import type { ProjectileSystem } from './projectiles';
import { blasterDefinition } from './weaponSchema';
import type { WeaponDefinition } from './weaponSchema';

export interface BlasterInput {
  triggerHeld: boolean;
  origin: Vec3;
  dir: Vec3;
}

export class Blaster {
  readonly heat: ResourcePool;
  private readonly rng: Rng;
  private cooldownS = 0;
  private lockS = 0;
  private coolingEventS = 0;
  private lastHeat = 0;
  private shotCount = 0;

  constructor(
    readonly owner: EntityId,
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    stats: Stats,
    private readonly projectiles: Pick<ProjectileSystem, 'spawn'>,
    readonly definition: WeaponDefinition = blasterDefinition,
    private readonly team: Team = 'player',
  ) {
    this.rng = ctx.rng.fork('blaster');
    this.heat = new ResourcePool({
      start: 0,
      max: () => stats.get('heatCapacity'),
      regenPerS: () => -stats.get('coolingRate'),
      regenDelayS: () => ctx.tuning.weapons.coolDelayS,
    });
  }

  get overheated(): boolean {
    return this.lockS > 0;
  }
  get shots(): number {
    return this.shotCount;
  }

  overheat(): void {
    this.heat.set(this.heat.max);
    this.lockS = this.ctx.tuning.weapons.overheatLockS;
    this.emitHeat();
  }

  step(dt: number, input: BlasterInput): void {
    if (!(dt > 0)) return;
    // Zewnętrzne podgrzanie zasobu również uruchamia blokadę.
    if (
      !this.overheated &&
      this.heat.max > 0 &&
      this.heat.current >= this.heat.max
    )
      this.overheat();
    const wasOverheated = this.overheated;
    this.heat.step(dt);
    this.lockS = Math.max(0, this.lockS - dt);
    if (this.lockS < Number.EPSILON * 16) this.lockS = 0;
    this.cooldownS = Math.max(0, this.cooldownS - dt);
    if (this.cooldownS < Number.EPSILON * 16) this.cooldownS = 0;
    this.coolingEventS += dt;
    if (
      wasOverheated !== this.overheated ||
      (this.coolingEventS >= 0.1 && this.lastHeat !== this.heat.current)
    )
      this.emitHeat();
    if (!input.triggerHeld || this.overheated || this.cooldownS > 0) return;
    this.projectiles.spawn({
      owner: this.owner,
      team: this.team,
      origin: input.origin,
      dir: this.spread(input.dir),
      speed: this.definition.projectileSpeed,
      damage: this.definition.damage,
      tags: this.definition.tags,
      lifetimeS: this.definition.projectileLifetimeS,
    });
    this.cooldownS = 1 / this.definition.fireRateHz;
    this.shotCount++;
    this.heat.add(this.definition.heatPerShot, { resetDelay: true });
    if (this.heat.current >= this.heat.max)
      this.lockS = this.ctx.tuning.weapons.overheatLockS;
    this.ctx.bus.emit('weapon_fired', {
      weapon: this.definition.id,
      owner: this.owner,
    });
    this.emitHeat();
  }

  private emitHeat(): void {
    this.lastHeat = this.heat.current;
    this.coolingEventS = 0;
    this.ctx.bus.emit('heat_changed', {
      id: this.owner,
      current: this.heat.current,
      max: this.heat.max,
      overheated: this.overheated,
    });
  }

  private spread(dir: Vec3): Vec3 {
    const length = Math.hypot(dir.x, dir.y, dir.z);
    if (!(length > 0)) throw new Error('Kierunek strzału musi być niezerowy.');
    const forward = { x: dir.x / length, y: dir.y / length, z: dir.z / length };
    const right =
      Math.abs(forward.y) < 0.999
        ? { x: -forward.z, y: 0, z: forward.x }
        : { x: 1, y: 0, z: 0 };
    const rightLength = Math.hypot(right.x, right.y, right.z);
    right.x /= rightLength;
    right.z /= rightLength;
    const up = {
      x: forward.y * right.z - forward.z * right.y,
      y: forward.z * right.x - forward.x * right.z,
      z: forward.x * right.y - forward.y * right.x,
    };
    const angle = this.rng.float(0, Math.PI * 2);
    const radius =
      Math.sqrt(this.rng.next()) *
      Math.tan((this.definition.spreadDeg * Math.PI) / 180);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const result = {
      x: forward.x + right.x * x + up.x * y,
      y: forward.y + right.y * x + up.y * y,
      z: forward.z + right.z * x + up.z * y,
    };
    const norm = Math.hypot(result.x, result.y, result.z);
    return { x: result.x / norm, y: result.y / norm, z: result.z / norm };
  }
}
