import type { EntityId, EventBus } from '../../core/events';
import { ResourcePool } from '../../core/resource';
import type { Stats } from '../../core/stats';
import type { Tuning } from '../../core/tuning';

/**
 * Energia Rezonansu gracza: ResourcePool zasilany Stats (maxEnergy, energyRegen),
 * regeneracja po tuning.powers.energyRegenDelayS bez użycia. Ładują ją zabójstwa wręcz
 * i udane parowania. Emituje energy_changed (dla HUD) przy zmianach, regenerację co
 * najwyżej co energyEventIntervalS.
 */
export class PlayerEnergy {
  readonly pool: ResourcePool;
  private lastEmitted = Number.NaN;
  private sinceEmitS = 0;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly owner: EntityId,
    stats: Stats,
    private readonly bus: EventBus,
    private readonly tuning: Tuning,
  ) {
    this.pool = new ResourcePool({
      max: () => stats.get('maxEnergy'),
      regenPerS: () => stats.get('energyRegen'),
      regenDelayS: () => tuning.powers.energyRegenDelayS,
    });
    this.off.push(
      bus.on('enemy_killed', ({ killer, tags }) => {
        if (killer === owner && tags.includes('#melee'))
          this.add(tuning.powers.meleeKillEnergy);
      }),
      bus.on('parry_success', () => this.add(tuning.powers.parryEnergy)),
    );
    this.emit();
  }

  get current(): number {
    return this.pool.current;
  }

  get max(): number {
    return this.pool.max;
  }

  /** Zużywa energię (wstrzymuje regenerację). false = za mało, bez zmian. */
  spend(n: number): boolean {
    const ok = this.pool.spend(n);
    if (ok) this.emit();
    return ok;
  }

  /** Ładowanie z akcji (nie wstrzymuje regeneracji). */
  add(n: number): void {
    this.pool.add(n);
    this.emit();
  }

  set(n: number): void {
    this.pool.set(n);
    this.emit();
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    this.pool.step(dt);
    this.sinceEmitS += dt;
    if (
      this.pool.current !== this.lastEmitted &&
      (this.sinceEmitS >= this.tuning.powers.energyEventIntervalS ||
        this.pool.current >= this.pool.max)
    )
      this.emit();
  }

  private emit(): void {
    this.sinceEmitS = 0;
    this.lastEmitted = this.pool.current;
    this.bus.emit('energy_changed', {
      id: this.owner,
      current: this.pool.current,
      max: this.pool.max,
    });
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }
}
