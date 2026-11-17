import type { AchievementsState } from '../core/metaTypes';
import type { RunAchievementProgress, RunSummary } from '../core/runTypes';
import type { AchievementDefinition } from './achievementsSchema';

/**
 * Reguły warunków, których dane osiągnięć (`achievements.json`) nie wyrażają: progi zdarzeń
 * i mapowanie misji na osiągnięcia. Liczniki, cele i nagrody są w danych.
 */
export const ACHIEVEMENT_RULES = {
  /** `seria`: tyle zabójstw w oknie czasu symulacji. */
  streak: { kills: 5, windowS: 2 },
  /** `droga-*`: minimalny udział jednej kategorii w obrażeniach zwycięskiego runu. */
  pathShare: 0.8,
  /** `zagrozenie-3`: minimalny Poziom zagrożenia zwycięstwa. */
  threatLevel: 3,
  /** `poziom-10`. */
  characterLevel: 10,
  /** Id ukończonej misji => osiągnięcie-flaga. */
  missions: {
    'm01-maszty': 'cisza-w-niecce',
    'm03-list-przewozowy': 'list-w-reku',
    'm06-odlewnia': 'ja-tylko-dowoze',
  } as Readonly<Record<string, string>>,
  /** `upadek-brandta`: rodzaj wroga (`entity_spawned.kind`) uznawany za bossa sektora. */
  bossKind: 'securityChief',
  /** `trzy-punkty`: wszystkie punkty trybu Podbój. */
  conquestPoints: ['A', 'B', 'C'] as readonly string[],
} as const;

export const ACHIEVEMENT_IDS = {
  firstKill: 'pierwsza-krew',
  streak: 'seria',
  noScratch: 'bez-zadrasniecia',
  threePoints: 'trzy-punkty',
  conquestWin: 'pelna-kontrola',
  firstVictory: 'pierwsze-zwyciestwo',
  threat3: 'zagrozenie-3',
  boss: 'upadek-brandta',
  firstPurchase: 'pierwszy-zakup',
  level: 'poziom-10',
  pathMelee: 'droga-ostrza',
  pathPower: 'droga-rezonansu',
  pathGun: 'droga-strzelca',
} as const;

export type DamageCategory = 'melee' | 'power' | 'gun';

export function emptyProgress(): RunAchievementProgress {
  return { counters: {}, flags: [] };
}

export function addCounter(
  progress: RunAchievementProgress,
  name: string,
  delta = 1,
): void {
  progress.counters[name] = (progress.counters[name] ?? 0) + delta;
}

export function mergeProgress(
  ...parts: readonly (RunAchievementProgress | undefined)[]
): RunAchievementProgress {
  const result = emptyProgress();
  for (const part of parts) {
    if (!part) continue;
    for (const [name, delta] of Object.entries(part.counters))
      addCounter(result, name, delta);
    for (const flag of part.flags)
      if (!result.flags.includes(flag)) result.flags.push(flag);
  }
  return result;
}

/** Kategoria obrażeń z tagów `damage_dealt`; `null` = inne (statusy, wybuchy, otoczenie). */
export function damageCategory(tags: readonly string[]): DamageCategory | null {
  if (tags.includes('#melee')) return 'melee';
  if (tags.includes('#power')) return 'power';
  if (tags.includes('#gun')) return 'gun';
  return null;
}

/** Dominująca kategoria obrażeń (udział co najmniej `pathShare` sumy wszystkich obrażeń) albo `null`. */
export function dominantPath(
  damage: RunSummary['damage'],
): DamageCategory | null {
  const total = damage.melee + damage.power + damage.gun + damage.other;
  if (!(total > 0)) return null;
  for (const category of ['melee', 'power', 'gun'] as const)
    if (damage[category] / total >= ACHIEVEMENT_RULES.pathShare)
      return category;
  return null;
}

const PATH_ACHIEVEMENT: Record<DamageCategory, string> = {
  melee: ACHIEVEMENT_IDS.pathMelee,
  power: ACHIEVEMENT_IDS.pathPower,
  gun: ACHIEVEMENT_IDS.pathGun,
};

/**
 * Postęp wynikający wyłącznie z podsumowania runu: ukończone runy i zwycięstwa, zwycięstwo,
 * Poziom zagrożenia, tryb, misja i czysta ścieżka. Czysta funkcja, bez zdarzeń.
 */
export function summaryProgress(
  summary: Pick<
    RunSummary,
    | 'outcome'
    | 'modeId'
    | 'missionId'
    | 'missionCompleted'
    | 'threatLevel'
    | 'damage'
  >,
): RunAchievementProgress {
  const progress = emptyProgress();
  addCounter(progress, 'runs_ended');
  if (summary.outcome !== 'victory') return progress;
  addCounter(progress, 'victories');
  progress.flags.push(ACHIEVEMENT_IDS.firstVictory);
  if (summary.threatLevel >= ACHIEVEMENT_RULES.threatLevel)
    progress.flags.push(ACHIEVEMENT_IDS.threat3);
  if (summary.modeId === 'conquest')
    progress.flags.push(ACHIEVEMENT_IDS.conquestWin);
  const mission =
    summary.missionCompleted && summary.missionId
      ? ACHIEVEMENT_RULES.missions[summary.missionId]
      : undefined;
  if (mission) progress.flags.push(mission);
  const path = dominantPath(summary.damage);
  if (path) progress.flags.push(PATH_ACHIEVEMENT[path]);
  return progress;
}

/** Czy osiągnięcie jest spełnione przy danych licznikach i zbiorze spełnionych flag. */
export function isAchieved(
  def: AchievementDefinition,
  counters: Readonly<Record<string, number>>,
  flags: ReadonlySet<string>,
): boolean {
  return def.kind === 'counter'
    ? (counters[def.counter ?? ''] ?? 0) >= (def.target ?? Infinity)
    : flags.has(def.id);
}

/** Postęp licznika osiągnięcia: `[bieżący, cel]` (flaga: 0/1 albo 1/1). */
export function achievementProgress(
  def: AchievementDefinition,
  state: AchievementsState,
): { current: number; target: number } {
  if (def.kind === 'flag')
    return { current: state.unlocked.includes(def.id) ? 1 : 0, target: 1 };
  const target = def.target ?? 1;
  const current = state.unlocked.includes(def.id)
    ? target
    : Math.min(target, state.counters[def.counter ?? ''] ?? 0);
  return { current, target };
}
