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
  /** Postęp celowania 0–1 (ADS): rozrzut × `tuning.player.aim.spread` przy pełnym celowaniu. */
  aim?: number;
}

export interface WeaponDeps {
  attackSpeed?(): number;
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
  private beamTickS = 0;
  readonly beam: { active: boolean; from: Vec3; to: Vec3 } | null;

  constructor(
    readonly owner: EntityId,
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    stats: Stats,
    private readonly deps: WeaponDeps,
    readonly definition: WeaponDefinition,
    private readonly team: Team = 'player',
  ) {
    if (definition.fireMode === 'beam' && (!deps.castBeam || !deps.damage))
      throw new Error('Laser wymaga castBeam i damage');
    this.beam =
      definition.fireMode === 'beam'
        ? {
            active: false,
            from: { x: 0, y: 0, z: 0 },
            to: { x: 0, y: 0, z: 0 },
          }
        : null;
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
    this.beamTickS = 0;
    if (this.beam) this.beam.active = false;
  }

  overheat(): void {
    if (this.beam) this.beam.active = false;
    this.heat.set(this.heat.max);
    this.lockS = this.ctx.tuning.weapons.overheatLockS;
    this.emitHeat();
  }

  /** Nieaktywna broń zachowuje ciepło i blokadę, bez emisji do HUD. */
  cool(dt: number): void {
    this.triggerHeld = false;
    this.beamTickS = 0;
    if (this.beam) this.beam.active = false;
    if (dt > 0) this.advanceCooling(dt, false);
  }

  /**
   * Natychmiastowe schłodzenie z zewnątrz (synergia `cool_weapon`, F2-17). Zdejmuje `amount`
   * ciepła; gdy ciepło spada do zera („full”), zdejmuje też blokadę przegrzania.
   */
  vent(amount: number | 'full'): void {
    const left =
      amount === 'full'
        ? 0
        : Math.max(0, this.heat.current - Math.max(0, amount));
    this.heat.set(left);
    if (left === 0) this.lockS = 0;
    this.emitHeat();
  }

  private advanceCooling(dt: number, publish: boolean): void {
    // Zewnętrzne podgrzanie zasobu również uruchamia blokadę.
    if (
      !this.overheated &&
      this.heat.max > 0 &&
      this.heat.current >= this.heat.max
    ) {
      this.lockS = this.ctx.tuning.weapons.overheatLockS;
      if (this.beam) this.beam.active = false;
      if (publish) this.emitHeat();
    }
    const wasOverheated = this.overheated;
    this.heat.step(dt);
    this.lockS = Math.max(0, this.lockS - dt);
    if (this.lockS < Number.EPSILON * 16) this.lockS = 0;
    this.cooldownS = Math.max(0, this.cooldownS - dt);
    if (this.cooldownS < Number.EPSILON * 16) this.cooldownS = 0;
    this.coolingEventS += dt;
    if (
      publish &&
      (wasOverheated !== this.overheated ||
        (this.coolingEventS >= 0.1 && this.lastHeat !== this.heat.current))
    )
      this.emitHeat();
  }

  step(dt: number, input: WeaponInput): void {
    if (!(dt > 0)) return;
    this.advanceCooling(dt, true);
    if (this.definition.fireMode === 'beam') {
      this.stepBeam(dt, input, this.definition);
      return;
    }
    const pressed = input.triggerHeld && !this.triggerHeld;
    this.triggerHeld = input.triggerHeld;
    if (
      !input.triggerHeld ||
      (!this.definition.automatic && !pressed) ||
      this.overheated ||
      this.cooldownS > 0
    )
      return;
    const aim = Math.min(1, Math.max(0, input.aim ?? 0));
    const spreadScale = 1 + (this.ctx.tuning.player.aim.spread - 1) * aim;
    fireProjectile(
      this.definition,
      this.deps.projectiles,
      this.rng,
      {
        owner: this.owner,
        team: this.team,
        origin: input.origin,
        dir: input.dir,
      },
      spreadScale,
    );
    const m = this.ctx.tuning.melee;
    const speed = Math.max(
      m.attackSpeedMin,
      Math.min(m.attackSpeedMax, this.deps.attackSpeed?.() ?? 1),
    );
    this.cooldownS = 1 / this.definition.fireRateHz / speed;
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

  private stepBeam(
    dt: number,
    input: WeaponInput,
    def: Extract<WeaponDefinition, { fireMode: 'beam' }>,
  ): void {
    const beam = this.beam!;
    const wasActive = beam.active;
    beam.active = input.triggerHeld && !this.overheated;
    if (!beam.active) {
      this.beamTickS = 0;
      return;
    }
    if (!wasActive) {
      this.shotCount++;
      this.ctx.bus.emit('weapon_fired', { weapon: def.id, owner: this.owner });
    }
    const hit = this.deps.castBeam!(input.origin, input.dir, def.rangeM);
    Object.assign(beam.from, input.origin);
    Object.assign(beam.to, hit.point);
    this.beamTickS += dt;
    while (this.beamTickS + Number.EPSILON * 16 >= 1 / def.tickHz) {
      this.beamTickS -= 1 / def.tickHz;
      if (hit.target !== null && hit.distance <= def.rangeM)
        this.deps.damage!.deal(hit.target, {
          source: this.owner,
          amount: def.dps / def.tickHz,
          tags: def.tags,
          point: hit.point,
          dir: input.dir,
          ...(def.statuses ? { statuses: def.statuses } : {}),
        });
    }
    this.heat.add(def.heatPerS * dt, { resetDelay: true });
    if (this.heat.current >= this.heat.max)
      this.lockS = this.ctx.tuning.weapons.overheatLockS;
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
