import type { EntityId, EventBus } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import type { DamageSystem } from '../damage';
import type { ProjectileSystem } from '../weapons/projectiles';
import type { PlayerEnergy } from './energy';
import type { PowerDefinition } from './powerSchema';
import type { PushTarget } from './push';
import type { GrabPhysics } from '../../physics/grabPhysics';

export interface PowerInput {
  pressed: boolean;
  held: boolean;
  released: boolean;
}

export interface Power {
  readonly def: PowerDefinition;
  readonly cooldownRemaining: number;
  readonly active: boolean;
  step(dt: number, input: PowerInput, worldDt?: number): void;
  reset(): void;
}

export interface PowerDeps {
  owner: EntityId;
  bus: EventBus;
  tuning: Tuning;
  damage: DamageSystem;
  energy: PlayerEnergy;
  aim(): { origin: Vec3; dir: Vec3 };
  targets(): readonly PushTarget[];
  castWall(origin: Vec3, dir: Vec3, maxDistance: number): number | null;
  projectiles?: ProjectileSystem;
  grab?: GrabPhysics;
}

export type PowerFactory = (def: PowerDefinition, deps: PowerDeps) => Power;

/** Wspólny koszt, odnowienie i bufor wciśnięcia podczas hitstopu. */
export abstract class PowerBase<
  Definition extends PowerDefinition = PowerDefinition,
> implements Power {
  private cooldownS = 0;
  private queued = false;

  constructor(
    readonly def: Definition,
    protected readonly deps: PowerDeps,
  ) {}

  get cooldownRemaining(): number {
    return this.cooldownS;
  }

  get active(): boolean {
    return false;
  }

  step(dt: number, input: PowerInput): void {
    if (input.pressed) this.queued = true;
    if (!(dt > 0)) return;
    this.cooldownS = Math.max(0, this.cooldownS - dt);
    this.stepEffect(dt, input);
    if (this.queued) {
      this.queued = false;
      this.use();
    }
  }

  reset(): void {
    this.cooldownS = 0;
    this.queued = false;
    this.resetEffect();
  }

  /** Liczba trafień lub null przy odmowie; zachowuje API Pchnięcia z F1. */
  use(): number | null {
    const { owner, bus, energy } = this.deps;
    if (this.cooldownS > 0) {
      bus.emit('power_denied', {
        power: this.def.id,
        user: owner,
        reason: 'cooldown',
      });
      return null;
    }
    if (!this.canActivate()) return null;
    if (!energy.spend(this.def.cost)) {
      bus.emit('power_denied', {
        power: this.def.id,
        user: owner,
        reason: 'no_energy',
      });
      return null;
    }
    if (this.cooldownOnActivation) this.startCooldown();
    bus.emit('power_used', { power: this.def.id, user: owner });
    return this.activate();
  }

  protected canActivate(): boolean {
    return true;
  }

  protected get cooldownOnActivation(): boolean {
    return true;
  }

  protected get activationQueued(): boolean {
    return this.queued;
  }

  protected startCooldown(): void {
    this.cooldownS = this.def.cooldownS;
    this.deps.bus.emit('power_cooldown', {
      power: this.def.id,
      user: this.deps.owner,
      cooldownS: this.def.cooldownS,
    });
  }

  protected abstract activate(): number;
  protected abstract stepEffect(dt: number, input: PowerInput): void;
  protected abstract resetEffect(): void;
}
