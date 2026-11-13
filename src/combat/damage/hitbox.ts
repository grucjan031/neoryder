import type { EntityId, Team } from '../../core/events';
import type { DamageSystem } from './damageSystem';
import type { DamageInfo } from './types';

export interface HitboxSpec {
  owner: EntityId;
  team: Team;
  damage: number;
  tags: readonly string[];
  /** Czas aktywności w sekundach (np. aktywne klatki ciosu). */
  lifetimeS: number;
  /** Ile razy można trafić ten sam cel (domyślnie 1: jeden cios = jedno trafienie). */
  hitsPerTarget?: number;
}

export type StrikeExtra = Pick<DamageInfo, 'point' | 'dir' | 'knockback'> & {
  /** Mnożnik z hurtboxa (np. głowa). */
  multiplier?: number;
};

/**
 * Aktywny obszar zadający obrażenia (cios ostrzem, fala mocy). Geometrię i zapytanie fizyki
 * dostarcza wołający (queryHurtboxes); Hitbox pilnuje czasu życia i powtórnych trafień.
 */
export class Hitbox {
  private ageS = 0;
  private readonly hits = new Map<EntityId, number>();

  constructor(readonly spec: HitboxSpec) {}

  get expired(): boolean {
    return this.ageS >= this.spec.lifetimeS;
  }

  step(dt: number): void {
    if (dt > 0) this.ageS += dt;
  }

  /** Trafia cel, jeśli wolno (czas życia, limit trafień, drużyny przez DamageSystem). */
  strike(
    target: EntityId,
    damage: DamageSystem,
    extra: StrikeExtra = {},
  ): number {
    if (this.expired) return 0;
    const count = this.hits.get(target) ?? 0;
    if (count >= (this.spec.hitsPerTarget ?? 1)) return 0;
    if (!damage.canDamage(this.spec.owner, target, this.spec.tags)) return 0;
    this.hits.set(target, count + 1);
    const { multiplier = 1, ...rest } = extra;
    return damage.deal(target, {
      amount: this.spec.damage * multiplier,
      source: this.spec.owner,
      tags: this.spec.tags,
      ...rest,
    });
  }
}
