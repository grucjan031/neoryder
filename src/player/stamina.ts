import { z } from 'zod';
import type { EntityId, EventBus } from '../core/events';
import { ResourcePool } from '../core/resource';
import type { Stats } from '../core/stats';
import type { Tuning } from '../core/tuning';
import defaults from '../data/scenes/roomPlayer.json';

export const staminaStatsSchema = z.object({
  maxStamina: z.number().positive().default(defaults.maxStamina),
  staminaRegen: z.number().nonnegative().default(defaults.staminaRegen),
  extraJumps: z.number().int().nonnegative().default(defaults.extraJumps),
});

/** Wytrzymałość ruchu; wyłącznie czas symulacji, bez zapisu między pokojami. */
export class PlayerStamina {
  private readonly pool: ResourcePool;
  private lastCurrent = Number.NaN;
  private lastMax = Number.NaN;
  private firstStep = true;

  constructor(
    private readonly owner: EntityId,
    stats: Stats,
    private readonly bus: EventBus,
    tuning: Tuning,
  ) {
    this.pool = new ResourcePool({
      max: () => stats.get('maxStamina'),
      regenPerS: () => stats.get('staminaRegen'),
      regenDelayS: () => tuning.player.staminaRegenDelayS,
    });
    this.emit();
  }

  get current(): number {
    return this.pool.current;
  }

  get max(): number {
    return this.pool.max;
  }

  spend(amount: number): boolean {
    if (!this.pool.spend(amount)) return false;
    this.emit();
    return true;
  }

  set(amount: number): void {
    this.pool.set(amount);
    this.emit();
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    this.pool.step(dt);
    // Sceny debug mogą tworzyć HUD dopiero po kontrolerze.
    if (
      this.firstStep ||
      this.current !== this.lastCurrent ||
      this.max !== this.lastMax
    )
      this.emit();
    this.firstStep = false;
  }

  private emit(): void {
    this.lastCurrent = this.current;
    this.lastMax = this.max;
    this.bus.emit('stamina_changed', {
      id: this.owner,
      current: this.current,
      max: this.max,
    });
  }
}
