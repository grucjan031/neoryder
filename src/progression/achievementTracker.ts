import type { EventBus, EntityId } from '../core/events';
import type { AchievementsState } from '../core/metaTypes';
import type { RunAchievementProgress } from '../core/runTypes';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_RULES,
  addCounter,
  damageCategory,
  emptyProgress,
  isAchieved,
  mergeProgress,
} from './achievements';
import type { DamageCategory } from './achievements';
import { achievementDefinitions } from './achievementsSchema';
import type { AchievementDefinition } from './achievementsSchema';

export interface AchievementTrackerOptions {
  /** Stan meta z początku runu: pozwala wykryć przekroczenie progu w trakcie runu. */
  base: AchievementsState;
  /** Czas symulacji w sekundach (okno serii zabójstw). */
  clock: () => number;
  /** Zliczanie tylko w aktywnym runie (po `run_ended` nic się już nie liczy). */
  active?: () => boolean;
  definitions?: ReadonlyMap<string, AchievementDefinition>;
}

/**
 * Zbiera w trakcie runu przyrosty liczników i spełnione flagi osiągnięć ze strumienia
 * `EventBus` (S4b-01). Nic nie zapisuje: wynik trafia do `RunSummary.achievements`, a
 * `MetaManager.applyRun` dolicza go idempotentnie razem z nagrodami runu. Przekroczenie progu
 * w trakcie runu emituje `achievement_earned` (komunikat w HUD); nagroda wpływa dopiero przy rozliczeniu.
 */
export class AchievementTracker {
  private readonly progress = emptyProgress();
  private readonly flags = new Set<string>();
  private readonly announced = new Set<string>();
  private readonly kinds = new Map<EntityId, string>();
  private readonly lastCategory = new Map<EntityId, DamageCategory>();
  private readonly killTimes: number[] = [];
  private readonly definitions: ReadonlyMap<string, AchievementDefinition>;
  private playerId: EntityId | null = null;
  private eliteRoom = false;
  private eliteHit = false;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly bus: EventBus,
    private readonly options: AchievementTrackerOptions,
  ) {
    this.definitions = options.definitions ?? achievementDefinitions;
    this.off.push(
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind === 'player') this.playerId = id;
        else this.kinds.set(id, kind);
      }),
      bus.on('entity_despawned', ({ id }) => {
        if (id === this.playerId) this.playerId = null;
        this.kinds.delete(id);
        this.lastCategory.delete(id);
      }),
      bus.on('damage_dealt', ({ source, target, amount, tags }) => {
        if (!this.live() || !(amount > 0)) return;
        if (target === this.playerId) {
          if (this.eliteRoom) this.eliteHit = true;
          return;
        }
        if (source === null || source !== this.playerId) return;
        const category = damageCategory(tags);
        if (category) this.lastCategory.set(target, category);
      }),
      bus.on('enemy_killed', ({ id, killer }) => {
        if (!this.live() || killer === null || killer !== this.playerId) return;
        this.setFlag(ACHIEVEMENT_IDS.firstKill);
        const category = this.lastCategory.get(id);
        if (category) this.count(`kills_${category}`);
        this.registerStreak();
        if (this.kinds.get(id) === ACHIEVEMENT_RULES.bossKind)
          this.setFlag(ACHIEVEMENT_IDS.boss);
      }),
      bus.on('parry_success', () => this.counted('parry_success')),
      bus.on('execute_performed', ({ attacker }) => {
        if (attacker === this.playerId) this.counted('execute_performed');
      }),
      bus.on('synergy_triggered', ({ user }) => {
        if (user === this.playerId) this.counted('synergy_triggered');
      }),
      bus.on('dash_used', ({ user }) => {
        if (user === this.playerId) this.counted('dash_used');
      }),
      bus.on('room_entered', ({ type }) => {
        this.eliteRoom = type === 'elite';
        this.eliteHit = false;
      }),
      bus.on('room_cleared', ({ type }) => {
        if (!this.live()) return;
        if (type === 'elite' && this.eliteRoom && !this.eliteHit)
          this.setFlag(ACHIEVEMENT_IDS.noScratch);
        this.eliteRoom = false;
      }),
      bus.on('conquest_captured', ({ owners }) => {
        if (!this.live()) return;
        // Faktyczny stan wszystkich punktów (także po utracie na rzecz neutralnego).
        if (
          ACHIEVEMENT_RULES.conquestPoints.every(
            (p) => owners[p as 'A'] === 'player',
          )
        )
          this.setFlag(ACHIEVEMENT_IDS.threePoints);
      }),
    );
  }

  /** Bieżące przyrosty z runu (kopia), bez danych z podsumowania. */
  get tracked(): RunAchievementProgress {
    return mergeProgress(this.progress);
  }

  /** Odtwarza przyrosty z zapisanego runu (`continue=1`); progi już przekroczone nie wywołają komunikatu. */
  restore(progress: RunAchievementProgress | undefined): void {
    this.progress.counters = { ...(progress?.counters ?? {}) };
    this.progress.flags = [...(progress?.flags ?? [])];
    this.flags.clear();
    for (const flag of this.progress.flags) this.flags.add(flag);
    this.announce(false);
  }

  /** Nowa baza (stan meta po rozliczeniu zostawionego runu): bez ponownych komunikatów. */
  setBase(base: AchievementsState): void {
    this.options.base = base;
    this.announce(false);
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
  }

  private live(): boolean {
    return this.options.active?.() ?? true;
  }

  private counted(name: string): void {
    if (this.live()) this.count(name);
  }

  private count(name: string): void {
    addCounter(this.progress, name);
    this.announce();
  }

  private setFlag(id: string): void {
    if (this.flags.has(id)) return;
    this.flags.add(id);
    this.progress.flags.push(id);
    this.announce();
  }

  private registerStreak(): void {
    const { kills, windowS } = ACHIEVEMENT_RULES.streak;
    const now = this.options.clock();
    this.killTimes.push(now);
    while (this.killTimes.length > 0 && now - this.killTimes[0]! > windowS)
      this.killTimes.shift();
    if (this.killTimes.length >= kills) this.setFlag(ACHIEVEMENT_IDS.streak);
  }

  /** Progi przekroczone w tym runie, których meta jeszcze nie zna: jednorazowy komunikat. */
  private announce(emit = true): void {
    const { base } = this.options;
    const counters = { ...base.counters };
    for (const [name, delta] of Object.entries(this.progress.counters))
      counters[name] = (counters[name] ?? 0) + delta;
    for (const def of this.definitions.values()) {
      if (base.unlocked.includes(def.id) || this.announced.has(def.id))
        continue;
      if (!isAchieved(def, counters, this.flags)) continue;
      this.announced.add(def.id);
      if (emit) this.bus.emit('achievement_earned', { id: def.id });
    }
  }
}
