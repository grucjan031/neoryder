import type { EntityId, EventBus } from '../../core/events';
import type { EntityRegistry } from '../../core/entities';
import { computeStat } from '../../core/stats';
import type { Stats } from '../../core/stats';
import type { Health } from './health';
import { BLOCK_SOURCE, FRIENDLY_FIRE_TAG, PIERCE_BLOCK_TAG } from './types';
import type { DamageInfo } from './types';

export interface DamageTargetOptions {
  /** Statystyki celu: modyfikatory 'damageTaken' (np. blok −70% = mult 0.3) zmieniają obrażenia. */
  stats?: Stats;
  /** Okno nietykalności po trafieniu w ms (np. () => tuning.damage.playerInvulnMs). */
  invulnMs?: () => number;
  /** Chwilowa nietykalność niezależna od trafień (np. dash) — sprawdzana przed obrażeniami. */
  invulnerable?: () => boolean;
  /** Obrona kierunkowa lub parowanie: mnożnik 0–1, po nietykalności, przed damageTaken. */
  guard?: (info: DamageInfo) => number;
}

interface Target {
  health: Health;
  opts: DamageTargetOptions;
  invulnUntilS: number;
}

/**
 * Jedyna droga zadawania obrażeń. Sprawdza drużyny, nietykalność i modyfikatory,
 * emituje damage_dealt, health_changed oraz enemy_killed / player_died.
 */
export class DamageSystem {
  private readonly targets = new Map<EntityId, Target>();
  private timeS = 0;

  constructor(
    private readonly bus: EventBus,
    private readonly registry: EntityRegistry,
  ) {}

  register(id: EntityId, health: Health, opts: DamageTargetOptions = {}): void {
    this.targets.set(id, {
      health,
      opts,
      invulnUntilS: Number.NEGATIVE_INFINITY,
    });
  }

  unregister(id: EntityId): void {
    this.targets.delete(id);
  }

  health(id: EntityId): Health | undefined {
    return this.targets.get(id)?.health;
  }

  /** Statystyki celu przekazane w register. */
  stats(id: EntityId): Stats | undefined {
    return this.targets.get(id)?.opts.stats;
  }

  /** Czas symulacji dla okien nietykalności. Scena woła w każdym kroku. */
  step(dt: number): void {
    if (dt > 0) this.timeS += dt;
  }

  /** Czy source może zranić target (rejestracja, drużyny, samotrafienie). Bez skutków ubocznych. */
  canDamage(
    source: EntityId | null,
    target: EntityId,
    tags: readonly string[] = [],
  ): boolean {
    if (!this.targets.has(target)) return false;
    if (source === null || tags.includes(FRIENDLY_FIRE_TAG)) return true;
    if (source === target) return false;
    const a = this.registry.team(source);
    const b = this.registry.team(target);
    return a === undefined || b === undefined || a === 'neutral' || a !== b;
  }

  /** Zwraca faktycznie zadane obrażenia (0, gdy trafienie zostało zignorowane). */
  deal(target: EntityId, info: DamageInfo): number {
    const entry = this.targets.get(target);
    if (!entry || entry.health.dead) return 0;
    if (!this.canDamage(info.source, target, info.tags)) return 0;
    if (this.timeS < entry.invulnUntilS) return 0;
    if (entry.opts.invulnerable?.()) return 0;
    const guard = Math.max(0, Math.min(1, entry.opts.guard?.(info) ?? 1));
    if (guard <= 0) return 0;

    // 'damageTaken' ma zawsze bazę 1 — liczą się tylko modyfikatory.
    // Ciężki cios (#heavy) przebija blok: pomija modyfikatory o źródle BLOCK_SOURCE.
    const pierce = info.tags.includes(PIERCE_BLOCK_TAG);
    const taken = entry.opts.stats
      ? computeStat(
          1,
          entry.opts.stats
            .modifiers('damageTaken')
            .filter((mod) => !pierce || mod.source !== BLOCK_SOURCE),
        )
      : 1;
    const dealt = entry.health.apply({ amount: info.amount * guard * taken });
    if (dealt <= 0) return 0;

    const invulnMs = entry.opts.invulnMs?.() ?? 0;
    if (invulnMs > 0) entry.invulnUntilS = this.timeS + invulnMs / 1000;

    const killed = entry.health.dead;
    this.bus.emit('damage_dealt', {
      source: info.source,
      target,
      amount: dealt,
      tags: info.tags,
      point: info.point ?? null,
      dir: info.dir ?? null,
      knockback: info.knockback ?? 0,
      killed,
      ...(info.statuses !== undefined ? { statuses: info.statuses } : {}),
    });
    this.bus.emit('health_changed', {
      id: target,
      current: entry.health.current,
      max: entry.health.max,
    });
    if (killed) {
      if (this.registry.team(target) === 'player')
        this.bus.emit('player_died', { id: target });
      else
        this.bus.emit('enemy_killed', {
          id: target,
          killer: info.source,
          tags: info.tags,
        });
    }
    return dealt;
  }
}
