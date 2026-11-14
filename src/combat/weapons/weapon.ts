import type { GameContext } from '../../core/context';
import type { EntityId, Team } from '../../core/events';
import type { Vec3 } from '../../core/math';
import { ResourcePool } from '../../core/resource';
import type { Rng } from '../../core/rng';
import type { Stats } from '../../core/stats';
import type { ProjectileSystem } from './projectiles';
import type { DamageSystem } from '../damage';
import { fireProjectile } from './fireModes/projectile';
import type { WeaponDefinition } from './weaponSchema';

export interface WeaponInput {
  triggerHeld: boolean;
  origin: Vec3;
  dir: Vec3;
}

export interface WeaponDeps {
  projectiles: Pick<ProjectileSystem, 'spawn'>;
  castBeam?(
    origin: Vec3,
    dir: Vec3,
    rangeM: number,
  ): { target: EntityId | null; distance: number; point: Vec3 };
  damage?: DamageSystem;
}

export class Weapon {
  readonly heat: ResourcePool;
  private rng: Rng;
  private cooldownS = 0;
  private lockS = 0;
  private coolingEventS = 0;
  private lastHeat = 0;
  private shotCount = 0;
  private triggerHeld = false;

  constructor(
    readonly owner: EntityId,
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    stats: Stats,
    private readonly deps: WeaponDeps,
    readonly definition: WeaponDefinition,
    private readonly team: Team = 'player',
  ) {
    this.rng = ctx.rng.fork(this.definition.id);
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

  /** Stan początkowy (nowy run): zimny, bez blokady przegrzania i odnowienia strzału. */
  reset(): void {
    this.heat.set(0);
    this.rng = this.ctx.rng.fork(this.definition.id);
    this.lockS = 0;
    this.cooldownS = 0;
    this.coolingEventS = 0;
    this.lastHeat = 0;
    this.triggerHeld = false;
  }

  overheat(): void {
    this.heat.set(this.heat.max);
    this.lockS = this.ctx.tuning.weapons.overheatLockS;
    this.emitHeat();
  }

  step(dt: number, input: WeaponInput): void {
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
    const pressed = input.triggerHeld && !this.triggerHeld;
    this.triggerHeld = input.triggerHeld;
    if (
      !input.triggerHeld ||
      (!this.definition.automatic && !pressed) ||
      this.overheated ||
      this.cooldownS > 0
    )
      return;
    fireProjectile(this.definition, this.deps.projectiles, this.rng, {
      owner: this.owner,
      team: this.team,
      origin: input.origin,
      dir: input.dir,
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
}
