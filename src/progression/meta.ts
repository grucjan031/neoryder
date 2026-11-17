import type { EventBus } from '../core/events';
import { missionDefinitions } from '../world/missions';
import {
  MAX_APPLIED_RUN_IDS,
  MAX_LAST_RUNS,
  type LoadoutChoice,
  type MetaRunRecord,
  type MetaState,
  type RunRewards,
  type TreeId,
} from '../core/metaTypes';
import type { RunSummary } from '../core/runTypes';
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
import { moduleDefinitions, moduleFitsWeapon } from './moduleSchema';

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
}

export const defaultMetaRules: MetaRules = {
  progression,
  unlocks: unlockDefinitions,
  threat: threatLevels,
};

export interface ApplyRunResult {
  applied: boolean;
  rewards: RunRewards;
  levelBefore: number;
  levelAfter: number;
  threatUnlocked: boolean;
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
      modules: structuredClone(modules),
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
      };
    const entry = this.rules.threat[summary.threatLevel];
    if (!entry)
      throw new Error(`Nieznany Poziom zagrożenia: ${summary.threatLevel}.`);
    const rewards = computeRunRewards(
      summary,
      entry,
      this.rules.progression.rewards,
    );
    const victory = summary.outcome === 'victory';
    if (victory && summary.missionCompleted && summary.missionId) {
      const mission = missionDefinitions.get(summary.missionId);
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
    s.appliedRunIds = [...s.appliedRunIds, runId].slice(-MAX_APPLIED_RUN_IDS);
    let threatUnlocked = false;
    if (
      victory &&
      summary.threatLevel === s.threat.max &&
      s.threat.max < this.rules.threat.length - 1
    ) {
      s.threat.max += 1;
      threatUnlocked = true;
    }
    const levelAfter = this.level;
    this.events?.emit('meta_rewards', {
      runId,
      rewards,
      levelBefore,
      levelAfter,
    });
    for (let level = levelBefore + 1; level <= levelAfter; level += 1)
      this.events?.emit('level_up', { level });
    return { applied: true, rewards, levelBefore, levelAfter, threatUnlocked };
  }

  clearDebrief(): void {
    this.current.campaign.pendingDebrief = null;
  }

  buyUnlock(id: string): void {
    const def = this.rules.unlocks.get(id);
    if (!def) throw new Error(`Nieznane odblokowanie: ${id}.`);
    if (this.isUnlocked(id)) throw new Error('Już odblokowane.');
    if (def.minLevel !== undefined && this.level < def.minLevel)
      throw new Error(`Wymagany poziom ${def.minLevel}.`);
    const data = def.cost.data ?? 0;
    const cores = def.cost.cores ?? 0;
    if (this.current.data < data) throw new Error('Za mało Danych.');
    if (this.current.cores < cores) throw new Error('Za mało Rdzeni.');
    this.current.data -= data;
    this.current.cores -= cores;
    this.current.unlocks.push(id);
    this.events?.emit('unlock_purchased', { id });
  }

  setLoadout(choice: LoadoutChoice): void {
    if (!this.isUnlocked(`blade:${choice.blade}`))
      throw new Error(`Ostrze nieodblokowane: ${choice.blade}.`);
    this.checkList(choice.weapons, 'weapon', 'broń', this.weaponSlots);
    this.checkList(choice.powers, 'power', 'moc', this.powerSlots);
    for (const [weaponId, ids] of Object.entries(choice.modules)) {
      if (!choice.weapons.includes(weaponId))
        throw new Error(
          `Moduły przypisane do broni spoza ekwipunku: ${weaponId}.`,
        );
      if (ids.length > this.moduleSlotsPerWeapon)
        throw new Error(`Limit modułów na broń: ${this.moduleSlotsPerWeapon}.`);
      if (new Set(ids).size !== ids.length)
        throw new Error(`Powtórzone moduły broni: ${weaponId}.`);
      for (const id of ids) {
        const module = moduleDefinitions.get(id);
        if (!module || !this.isUnlocked(`module:${id}`))
          throw new Error(`Moduł nieodblokowany lub nieznany: ${id}.`);
        if (!moduleFitsWeapon(module, weaponId))
          throw new Error(`Moduł ${id} nie pasuje do broni ${weaponId}.`);
      }
    }
    this.current.loadout = {
      blade: choice.blade,
      weapons: [...choice.weapons],
      powers: [...choice.powers],
      modules: structuredClone(choice.modules),
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
    const before = this.level;
    this.current.xp += Math.max(0, Math.floor(amount));
    for (let level = before + 1; level <= this.level; level += 1)
      this.events?.emit('level_up', { level });
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
    this.current.data += Math.max(0, Math.floor(amount));
  }

  debugAddCores(amount: number): void {
    this.current.cores += Math.max(0, Math.floor(amount));
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
  }

  debugReset(): void {
    this.current = createStarterMetaState(this.rules.progression.starter);
  }
}
