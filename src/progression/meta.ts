import workshopLabels from '../data/ui/workshop.pl.json';
import type { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { tuning } from '../core/tuning';
import { missionCatalog } from '../world/missionCatalog';
import {
  MAX_APPLIED_RUN_IDS,
  MAX_LAST_RUNS,
  type LoadoutChoice,
  type LoadoutChoiceInput,
  type MetaRunRecord,
  type MetaState,
  type RunRewards,
  type TreeId,
} from '../core/metaTypes';
import type { RunAchievementProgress, RunSummary } from '../core/runTypes';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENT_RULES,
  mergeProgress,
  summaryProgress,
} from './achievements';
import {
  ACHIEVEMENT_COUNTERS,
  MAX_RUN_COUNTER,
  RUN_EVENT_FLAGS,
  achievementDefinitions,
} from './achievementsSchema';
import type { AchievementDefinition } from './achievementsSchema';
import type { Loadout } from './loadout';
import { createStarterMetaState, progression } from './progressionSchema';
import type { ProgressionData, RewardRules } from './progressionSchema';
import { metaStateSchema } from './metaStateSchema';
import { talentTrees } from './talentSchema';
import type { TalentNode, TalentTree } from './talentSchema';
import { threatLevels } from './threatSchema';
import type { ThreatLevel } from './threatSchema';
import { unlockDefinitions } from './unlocksSchema';
import type { UnlockDefinition } from './unlocksSchema';
import {
  moduleDefinitions,
  moduleFitsWeapon,
  sanitizeModules,
} from './moduleSchema';

import {
  skinDefinitions,
  skinFitsWeapon,
  type SkinDefinition,
} from './skinSchema';

export function ownedSkins(
  meta: MetaState,
  weaponId: string,
): SkinDefinition[] {
  return [...skinDefinitions.values()].filter(
    (skin) =>
      skinFitsWeapon(skin, weaponId) &&
      meta.unlocks.includes('skin:' + skin.id),
  );
}
export function skinSource(skinId: string) {
  const id = 'skin:' + skinId;
  const unlock = unlockDefinitions.get(id);
  if (unlock) return { kind: 'shop' as const, unlock };
  for (const def of achievementDefinitions.values())
    if (def.reward.unlocks?.includes(id))
      return { kind: 'achievement' as const, achievementId: def.id };
  return { kind: 'none' as const };
}
export function equipSkin(
  meta: MetaState,
  weaponId: string,
  skinId: string | null,
): LoadoutChoice {
  const skins = { ...meta.loadout.skins };
  if (skinId === null) delete skins[weaponId];
  else {
    if (!ownedSkins(meta, weaponId).some((s) => s.id === skinId))
      throw new Error(workshopLabels.errors.skinUnavailable);
    skins[weaponId] = skinId;
  }
  return { ...meta.loadout, skins };
}

export const CUSTOM_LOADOUT_NAME = 'Własny';

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  /** XP potrzebne do następnego poziomu; null na limicie poziomu. */
  xpForNext: number | null;
}

export function levelFromXp(
  xp: number,
  xpToNext: readonly number[],
): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, xp);
  for (const need of xpToNext) {
    if (remaining < need)
      return { level, xpIntoLevel: remaining, xpForNext: need };
    remaining -= need;
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNext: null };
}

export function talentPoints(level: number): number {
  return level - 1;
}

export function runIdOf(state: { seed: string; startedAtMs: number }): string {
  return `${state.seed}:${state.startedAtMs}`;
}

export function computeRunRewards(
  summary: Pick<
    RunSummary,
    'outcome' | 'roomsCleared' | 'elitesCleared' | 'kills'
  >,
  threatLevel: ThreatLevel,
  rules: RewardRules,
): RunRewards {
  const victory = summary.outcome === 'victory';
  const mult = threatLevel.rewardMult;
  return {
    xp: Math.round(
      (summary.roomsCleared * rules.xpPerRoom +
        summary.elitesCleared * rules.xpPerElite +
        (victory ? rules.xpVictory : 0)) *
        mult,
    ),
    data: Math.round(
      (summary.roomsCleared * rules.dataPerRoom +
        summary.kills * rules.dataPerKill +
        (victory ? rules.dataVictory : 0)) *
        mult,
    ),
    cores:
      summary.elitesCleared * rules.coresPerElite +
      (victory ? rules.coresVictory + threatLevel.victoryCores : 0),
  };
}

function findTalentNode(id: string): { tree: TalentTree; node: TalentNode } {
  for (const tree of talentTrees.values()) {
    const node = tree.nodes.find((candidate) => candidate.id === id);
    if (node) return { tree, node };
  }
  throw new Error(`Nieznany talent: ${id}.`);
}

export interface MetaRules {
  progression: ProgressionData;
  unlocks: ReadonlyMap<string, UnlockDefinition>;
  threat: readonly ThreatLevel[];
  /** Definicje osiągnięć; brak = dane gry (`achievements.json`). */
  achievements?: ReadonlyMap<string, AchievementDefinition>;
}

export const defaultMetaRules: MetaRules = {
  progression,
  unlocks: unlockDefinitions,
  threat: threatLevels,
  achievements: achievementDefinitions,
};

/** Naszywka zdobyta przy rozliczeniu: id i jednorazowa nagroda już doliczona do waluty. */
export interface AchievementUnlock {
  id: string;
  reward: { data: number; cores: number };
}

export interface ApplyRunResult {
  applied: boolean;
  rewards: RunRewards;
  levelBefore: number;
  levelAfter: number;
  threatUnlocked: boolean;
  /** Nowe naszywki Iskry z tego runu (nagrody osobno od `rewards`). */
  achievements: AchievementUnlock[];
}

/** Błędy zakupów i zmian to wyjątki `Error` z polskim komunikatem (jak w `shop.ts`). */
export class MetaManager {
  private current: MetaState;
  private readonly events: EventBus | undefined;
  private readonly rules: MetaRules;

  constructor(
    state: MetaState,
    events?: EventBus,
    rules: MetaRules = defaultMetaRules,
  ) {
    this.current = structuredClone(state);
    this.events = events;
    this.rules = rules;
    for (const id of this.current.achievements.unlocked)
      this.grantItems(this.achievementRules.get(id));
    const skins = this.current.loadout.skins ?? {};
    this.current.loadout.skins = Object.fromEntries(
      Object.entries(skins).filter(([weapon, id]) =>
        ownedSkins(this.current, weapon).some((skin) => skin.id === id),
      ),
    );
  }

  private grantItems(def: AchievementDefinition | undefined): void {
    for (const id of def?.reward.unlocks ?? [])
      if (!this.current.unlocks.includes(id)) this.current.unlocks.push(id);
  }

  static restore(
    data: unknown,
    events?: EventBus,
    rules: MetaRules = defaultMetaRules,
  ): MetaManager {
    return new MetaManager(metaStateSchema.parse(data), events, rules);
  }

  get state(): MetaState {
    return structuredClone(this.current);
  }

  serialize(): MetaState {
    return structuredClone(this.current);
  }

  get xpProgress(): LevelInfo {
    return levelFromXp(this.current.xp, this.rules.progression.levels.xpToNext);
  }

  get level(): number {
    return this.xpProgress.level;
  }

  get talentPoints(): number {
    return talentPoints(this.level);
  }

  get spentPoints(): number {
    const costs = new Map<string, number>();
    for (const tree of talentTrees.values())
      for (const node of tree.nodes) costs.set(node.id, node.cost);
    return this.current.talents.reduce(
      (sum, id) => sum + (costs.get(id) ?? 0),
      0,
    );
  }

  get freePoints(): number {
    return this.talentPoints - this.spentPoints;
  }

  /** Punkty wydane w drzewku (suma `cost` kupionych węzłów tego drzewka). */
  spentInTree(tree: TreeId): number {
    const nodes = talentTrees.get(tree)?.nodes ?? [];
    return nodes
      .filter((node) => this.current.talents.includes(node.id))
      .reduce((sum, node) => sum + node.cost, 0);
  }

  get weaponSlots(): number {
    return (
      1 +
      ['slot:weapon2', 'slot:weapon3'].filter((id) => this.isUnlocked(id))
        .length
    );
  }

  get powerSlots(): number {
    return 1 + (this.isUnlocked('slot:power2') ? 1 : 0);
  }

  get moduleSlotsPerWeapon(): number {
    return this.rules.progression.moduleSlotsPerWeapon;
  }

  isUnlocked(id: string): boolean {
    return this.current.unlocks.includes(id);
  }

  extractModule(runId: string, moduleId: string): void {
    const offer = this.current.pendingExtractions.find(
      (entry) => entry.runId === runId,
    );
    if (
      !offer?.moduleIds.includes(moduleId) ||
      this.isUnlocked(`module:${moduleId}`)
    )
      throw new Error('Ten moduł nie jest dostępny do wydobycia.');
    this.current.pendingExtractions = this.current.pendingExtractions.filter(
      (entry) => entry !== offer,
    );
    this.current.unlocks.push(`module:${moduleId}`);
    this.removeUnlockedModulesFromOffers();
  }

  private removeUnlockedModulesFromOffers(): void {
    this.current.pendingExtractions = this.current.pendingExtractions.filter(
      (offer) => {
        offer.moduleIds = offer.moduleIds.filter(
          (id) => !this.isUnlocked(`module:${id}`),
        );
        return offer.moduleIds.length > 0;
      },
    );
  }

  loadout(): Loadout {
    const { blade, weapons, powers, modules } = this.current.loadout;
    return {
      id: 'custom',
      name: CUSTOM_LOADOUT_NAME,
      blade,
      startHeld: 'blade',
      weapons: [...weapons],
      powers: [...powers],
      tags: [],
      skins: { ...this.current.loadout.skins },
      modules: sanitizeModules(weapons, modules),
    };
  }

  applyRun(summary: RunSummary, runId: string): ApplyRunResult {
    const levelBefore = this.level;
    const s = this.current;
    if (s.appliedRunIds.includes(runId))
      return {
        applied: false,
        rewards: { xp: 0, data: 0, cores: 0 },
        levelBefore,
        levelAfter: levelBefore,
        threatUnlocked: false,
        achievements: [],
      };
    const entry = this.rules.threat[summary.threatLevel];
    if (!entry)
      throw new Error(`Nieznany Poziom zagrożenia: ${summary.threatLevel}.`);
    const linearMission = summary.missionId
      ? missionCatalog.get(summary.missionId)?.level !== undefined
      : false;
    const victory = summary.outcome === 'victory';
    const rewards =
      linearMission && (!victory || !summary.missionCompleted)
        ? { xp: 0, data: 0, cores: 0 }
        : computeRunRewards(summary, entry, this.rules.progression.rewards);
    if (victory && summary.missionCompleted && summary.missionId) {
      const mission = missionCatalog.get(summary.missionId);
      if (!mission) throw new Error(`Nieznana misja: ${summary.missionId}`);
      if (!s.campaign.completed.includes(mission.id)) {
        rewards.data += mission.rewards.firstClear.data;
        rewards.cores += mission.rewards.firstClear.cores ?? 0;
        s.campaign.completed.push(mission.id);
      }
      s.campaign.pendingDebrief = mission.id;
    }
    s.xp += rewards.xp;
    s.data += rewards.data;
    s.cores += rewards.cores;
    s.stats.runs += 1;
    if (victory) {
      s.stats.victories += 1;
      s.stats.bestVictoryS =
        s.stats.bestVictoryS === null
          ? summary.elapsedS
          : Math.min(s.stats.bestVictoryS, summary.elapsedS);
    } else s.stats.deaths += 1;
    s.stats.kills += summary.kills;
    const record: MetaRunRecord = {
      runId,
      outcome: summary.outcome,
      elapsedS: summary.elapsedS,
      layerReached: summary.layerReached,
      threatLevel: summary.threatLevel,
      rewards,
    };
    s.lastRuns = [record, ...s.lastRuns].slice(0, MAX_LAST_RUNS);
    const found = [...new Set(summary.foundModules)].filter(
      (id) => moduleDefinitions.has(id) && !this.isUnlocked(`module:${id}`),
    );
    const moduleIds = victory
      ? found
      : new Rng(summary.seed)
          .fork('extraction')
          .shuffle(found)
          .slice(0, Math.max(0, tuning.run.deathModulePoolSize));
    if (moduleIds.length) s.pendingExtractions.push({ runId, moduleIds });
    s.appliedRunIds = [...s.appliedRunIds, runId].slice(-MAX_APPLIED_RUN_IDS);
    let threatUnlocked = false;
    if (
      victory &&
      !linearMission &&
      summary.threatLevel === s.threat.max &&
      s.threat.max < this.rules.threat.length - 1
    ) {
      s.threat.max += 1;
      threatUnlocked = true;
    }
    // Postęp z podsumowania liczy tu `MetaManager`; tracker dostarcza tylko przyrosty ze zdarzeń
    // (tylko znane liczniki i flagi zdarzeniowe, ograniczone wartości).
    const tracked = summary.achievements;
    const achievements = this.addAchievementProgress(
      mergeProgress(summaryProgress(summary), {
        counters: tracked?.counters ?? {},
        flags: (tracked?.flags ?? []).filter((flag) =>
          (RUN_EVENT_FLAGS as readonly string[]).includes(flag),
        ),
      }),
      this.level >= ACHIEVEMENT_RULES.characterLevel
        ? [ACHIEVEMENT_IDS.level]
        : [],
    );
    if (achievements.length > 0)
      record.achievements = achievements.map((unlock) => unlock.id);
    const levelAfter = this.level;
    this.events?.emit('meta_rewards', {
      runId,
      rewards,
      levelBefore,
      levelAfter,
    });
    for (let level = levelBefore + 1; level <= levelAfter; level += 1)
      this.events?.emit('level_up', { level });
    for (const unlock of achievements)
      this.events?.emit('achievement_unlocked', { id: unlock.id });
    return {
      applied: true,
      rewards,
      levelBefore,
      levelAfter,
      threatUnlocked,
      achievements,
    };
  }

  hasAchievement(id: string): boolean {
    return this.current.achievements.unlocked.includes(id);
  }

  private get achievementRules(): ReadonlyMap<string, AchievementDefinition> {
    return this.rules.achievements ?? achievementDefinitions;
  }

  /**
   * Dolicza przyrosty liczników i spełnione flagi, odblokowuje osiągnięcia i dolicza ich
   * jednorazowe nagrody. Idempotencję zapewnia wywołujący (`appliedRunIds`).
   */
  private addAchievementProgress(
    progress?: RunAchievementProgress,
    extraFlags: readonly string[] = [],
  ): AchievementUnlock[] {
    const state = this.current.achievements;
    for (const name of ACHIEVEMENT_COUNTERS) {
      const delta = progress?.counters[name];
      if (typeof delta === 'number' && Number.isFinite(delta) && delta > 0)
        state.counters[name] =
          (state.counters[name] ?? 0) +
          Math.min(MAX_RUN_COUNTER, Math.floor(delta));
    }
    const flags = new Set([...(progress?.flags ?? []), ...extraFlags]);
    const unlocks: AchievementUnlock[] = [];
    for (const def of this.achievementRules.values()) {
      if (state.unlocked.includes(def.id)) continue;
      const met =
        def.kind === 'counter'
          ? (state.counters[def.counter ?? ''] ?? 0) >= (def.target ?? Infinity)
          : flags.has(def.id);
      if (!met) continue;
      state.unlocked.push(def.id);
      this.grantItems(def);
      const reward = {
        data: def.reward.data ?? 0,
        cores: def.reward.cores ?? 0,
      };
      this.current.data += reward.data;
      this.current.cores += reward.cores;
      unlocks.push({ id: def.id, reward });
    }
    return unlocks;
  }

  /** Flaga poza runem (zakup, poziom): odblokowuje i emituje zdarzenie. */
  private grantFlag(id: string): void {
    for (const unlock of this.addAchievementProgress(undefined, [id]))
      this.events?.emit('achievement_unlocked', { id: unlock.id });
  }

  clearDebrief(): void {
    this.current.campaign.pendingDebrief = null;
  }

  buyUnlock(id: string): void {
    const def = this.rules.unlocks.get(id);
    if (!def) throw new Error(`Nieznane odblokowanie: ${id}.`);
    if (this.isUnlocked(id)) throw new Error('Już odblokowane.');
    if (
      def.requiresAchievement &&
      !this.hasAchievement(def.requiresAchievement)
    ) {
      const required = this.achievementRules.get(def.requiresAchievement);
      throw new Error(
        `Wymagana naszywka: ${required?.title ?? def.requiresAchievement}.`,
      );
    }
    if (def.minLevel !== undefined && this.level < def.minLevel)
      throw new Error(`Wymagany poziom ${def.minLevel}.`);
    const data = def.cost.data ?? 0;
    const cores = def.cost.cores ?? 0;
    if (this.current.data < data) throw new Error('Za mało Danych.');
    if (this.current.cores < cores) throw new Error('Za mało Rdzeni.');
    this.current.data -= data;
    this.current.cores -= cores;
    this.current.unlocks.push(id);
    if (id.startsWith('module:')) this.removeUnlockedModulesFromOffers();
    this.events?.emit('unlock_purchased', { id });
    this.grantFlag(ACHIEVEMENT_IDS.firstPurchase);
  }

  setLoadout(choice: LoadoutChoiceInput): void {
    if (!this.isUnlocked(`blade:${choice.blade}`))
      throw new Error(`Ostrze nieodblokowane: ${choice.blade}.`);
    this.checkList(choice.weapons, 'weapon', 'broń', this.weaponSlots);
    this.checkList(choice.powers, 'power', 'moc', this.powerSlots);
    const modules: LoadoutChoice['modules'] = {};
    for (const [weaponId, installed] of Object.entries(choice.modules)) {
      const ids = installed.filter((id) => {
        const module = moduleDefinitions.get(id);
        return module !== undefined && moduleFitsWeapon(module, weaponId);
      });
      if (!choice.weapons.includes(weaponId))
        throw new Error(
          `Moduły przypisane do broni spoza ekwipunku: ${weaponId}.`,
        );
      if (ids.length > this.moduleSlotsPerWeapon)
        throw new Error(`Limit modułów na broń: ${this.moduleSlotsPerWeapon}.`);
      if (new Set(ids).size !== ids.length)
        throw new Error(`Powtórzone moduły broni: ${weaponId}.`);
      const slots = new Set<string>();
      for (const id of ids) {
        const module = moduleDefinitions.get(id);
        if (!module || !this.isUnlocked(`module:${id}`))
          throw new Error(`Moduł nieodblokowany lub nieznany: ${id}.`);
        if (slots.has(module.slot))
          throw new Error(`Slot ${module.slot} jest już zajęty: ${weaponId}.`);
        slots.add(module.slot);
      }
      modules[weaponId] = ids;
    }
    const skins = { ...(choice.skins ?? this.current.loadout.skins) };
    for (const [weapon, id] of Object.entries(skins))
      if (!ownedSkins(this.current, weapon).some((s) => s.id === id))
        throw new Error(workshopLabels.errors.skinUnavailable);
    this.current.loadout = {
      skins,
      blade: choice.blade,
      weapons: [...choice.weapons],
      powers: [...choice.powers],
      modules,
    };
    this.events?.emit('loadout_changed', {
      loadout: structuredClone(this.current.loadout),
    });
  }

  private checkList(
    ids: readonly string[],
    kind: string,
    label: string,
    slots: number,
  ): void {
    if (ids.length < 1 || ids.length > slots)
      throw new Error(
        `Liczba pozycji (${label}) musi mieścić się w 1..${slots}.`,
      );
    if (new Set(ids).size !== ids.length)
      throw new Error(`Powtórzone pozycje (${label}).`);
    for (const id of ids)
      if (!this.isUnlocked(`${kind}:${id}`))
        throw new Error(`Nieodblokowane (${label}): ${id}.`);
  }

  selectThreat(level: number): void {
    if (
      !Number.isInteger(level) ||
      level < 0 ||
      level > this.current.threat.max
    )
      throw new Error(
        `Poziom zagrożenia musi mieścić się w 0..${this.current.threat.max}.`,
      );
    this.current.threat.selected = level;
    this.events?.emit('threat_selected', { level });
  }

  /**
   * Kupuje węzeł talentu: wolne punkty, wszystkie `requires`, próg drzewka
   * (`tierThresholds[tier - 1]`) i `requiresTreePoints` (punkty wydane w danym drzewku).
   */
  buyTalent(id: string): void {
    const { tree, node } = findTalentNode(id);
    if (this.current.talents.includes(id)) throw new Error('Już kupione.');
    if (this.freePoints < node.cost)
      throw new Error(`Za mało punktów talentów (koszt ${node.cost}).`);
    for (const required of node.requires)
      if (!this.current.talents.includes(required))
        throw new Error(`Wymagany talent: ${required}.`);
    const threshold = tree.tierThresholds[node.tier - 1] ?? 0;
    if (this.spentInTree(tree.tree) < threshold)
      throw new Error(
        `Wymagane ${threshold} pkt w drzewku ${tree.name} (próg ${node.tier}).`,
      );
    for (const [requiredTree, points] of Object.entries(
      node.requiresTreePoints ?? {},
    )) {
      if (this.spentInTree(requiredTree as TreeId) < points)
        throw new Error(
          `Wymagane ${points} pkt w drzewku ${talentTrees.get(requiredTree as TreeId)?.name ?? requiredTree}.`,
        );
    }
    this.current.talents.push(id);
    this.events?.emit('talents_changed', {
      talents: [...this.current.talents],
    });
  }

  /** Darmowy reset: czyści wszystkie talenty, punkty wracają do puli. */
  resetTalents(): void {
    this.current.talents = [];
    this.events?.emit('talents_changed', { talents: [] });
  }

  debugAddXp(amount: number): void {
    this.validateDebugAmount(amount);
    const before = this.level;
    this.current.xp += Math.max(0, Math.floor(amount));
    for (let level = before + 1; level <= this.level; level += 1)
      this.events?.emit('level_up', { level });
    if (this.level >= ACHIEVEMENT_RULES.characterLevel)
      this.grantFlag(ACHIEVEMENT_IDS.level);
  }

  /** Oznacza osiągnięcie jako zdobyte bez wypłaty waluty i bez sprawdzania warunku (konsola debug). */
  debugGrantAchievement(id: string): void {
    if (!this.achievementRules.has(id))
      throw new Error(`Nieznane osiągnięcie: ${id}.`);
    if (this.hasAchievement(id)) return;
    this.current.achievements.unlocked.push(id);
    this.grantItems(this.achievementRules.get(id));
    this.events?.emit('achievement_unlocked', { id });
  }

  /** Dodaje talent bez kosztu i bez sprawdzania progów (konsola debug). */
  debugGrantTalent(id: string): void {
    findTalentNode(id);
    if (this.current.talents.includes(id)) return;
    this.current.talents.push(id);
    this.events?.emit('talents_changed', {
      talents: [...this.current.talents],
    });
  }

  debugAddData(amount: number): void {
    this.validateDebugAmount(amount);
    this.current.data += Math.max(0, Math.floor(amount));
  }

  debugAddCores(amount: number): void {
    this.validateDebugAmount(amount);
    this.current.cores += Math.max(0, Math.floor(amount));
  }

  private validateDebugAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0)
      throw new Error('Wartość musi być skończoną liczbą ≥ 0.');
  }

  /** Ustawia najwyższy dostępny Poziom zagrożenia (konsola debug); wybrany poziom nie przekracza nowego limitu. */
  debugSetThreatMax(level: number): void {
    const max = Math.max(
      0,
      Math.min(Math.floor(level), this.rules.threat.length - 1),
    );
    this.current.threat.max = max;
    this.current.threat.selected = Math.min(this.current.threat.selected, max);
  }

  debugUnlockAll(): void {
    for (const id of this.rules.unlocks.keys())
      if (!this.isUnlocked(id)) this.current.unlocks.push(id);
    this.removeUnlockedModulesFromOffers();
  }

  debugReset(): void {
    this.current = createStarterMetaState(this.rules.progression.starter);
  }
}
