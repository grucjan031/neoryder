import type { RunSummary } from '../core/runTypes';
import {
  defaultMetaRules,
  MetaManager,
  computeRunRewards,
} from '../progression/meta';
import type { MetaRules } from '../progression/meta';
import { createStarterMetaState } from '../progression/progressionSchema';
import { talentTrees } from '../progression/talentSchema';
import { kuroganeSector } from '../world/sectors';
import type { RunRewards } from '../core/metaTypes';

/**
 * Model typowego runu nowego gracza (F4-11). Ścieżka przez sektor Kurogane Arms jest stała:
 * warstwy 1-3 walka, 4 elita, 5 sklep, 6 elita, 7 odpoczynek, 8 boss. `RunManager` liczy
 * `roomsCleared` jako wszystkie ukończone węzły (także sklep i odpoczynek, a przy zwycięstwie
 * boss), więc śmierć w warstwie L daje `L - 1` ukończonych pokoi, a zwycięstwo 8.
 */
export const TYPICAL_PATH = [
  'combat',
  'combat',
  'combat',
  'elite',
  'shop',
  'elite',
  'rest',
  'boss',
] as const;

export const KILLS_PER_COMBAT = 6;
export const KILLS_PER_ELITE = 10;
export const KILLS_BOSS = 1 + 4;

export interface TypicalRunSpec {
  name: string;
  outcome: 'victory' | 'death';
  /** Warstwa śmierci; dla zwycięstwa liczba warstw sektora. */
  layer: number;
}

export const TYPICAL_RUNS: readonly TypicalRunSpec[] = [
  { name: 'Śmierć w warstwie 3', outcome: 'death', layer: 3 },
  { name: 'Śmierć w warstwie 5', outcome: 'death', layer: 5 },
  { name: 'Zwycięstwo', outcome: 'victory', layer: 8 },
  { name: 'Śmierć w warstwie 6', outcome: 'death', layer: 6 },
  { name: 'Zwycięstwo', outcome: 'victory', layer: 8 },
];

export function typicalSummary(
  spec: TypicalRunSpec,
  threatLevel = 0,
): RunSummary {
  const cleared =
    spec.outcome === 'victory' ? TYPICAL_PATH.length : spec.layer - 1;
  const path = TYPICAL_PATH.slice(0, cleared);
  const durations = kuroganeSector.expectedDurationS;
  const killsFor = (type: string) =>
    type === 'combat'
      ? KILLS_PER_COMBAT
      : type === 'elite'
        ? KILLS_PER_ELITE
        : type === 'boss'
          ? KILLS_BOSS
          : 0;
  return {
    outcome: spec.outcome,
    seed: 'meta-balance',
    loadoutId: 'custom',
    elapsedS: path.reduce((sum, type) => sum + durations[type]!, 0),
    kills: path.reduce((sum, type) => sum + killsFor(type), 0),
    roomsCleared: path.length,
    elitesCleared: path.filter((type) => type === 'elite').length,
    threatLevel,
    layerReached: spec.layer,
    implants: [],
    damage: {} as RunSummary['damage'],
  };
}

export interface MetaSimRow {
  name: string;
  summary: RunSummary;
  rewards: RunRewards;
  levelAfter: number;
  talentsBought: string[];
  unlocksBought: string[];
  dataAfter: number;
  coresAfter: number;
}

export interface MetaSimResult {
  rows: MetaSimRow[];
  finalLevel: number;
  purchases: number;
  levelsPerRun: number[];
}

const totalCost = (cost: { data?: number; cores?: number }) =>
  (cost.data ?? 0) + (cost.cores ?? 0);

/** Zachłannie kupuje, dopóki `buy` się udaje; kandydaci posortowani, pierwszy udany zakup restartuje pętlę. */
function buyGreedy(
  candidates: readonly string[],
  buy: (id: string) => void,
): string[] {
  const bought: string[] = [];
  for (let progress = true; progress;) {
    progress = false;
    for (const id of candidates) {
      try {
        buy(id);
      } catch {
        continue;
      }
      bought.push(id);
      progress = true;
      break;
    }
  }
  return bought;
}

export function simulateTypicalRuns(
  rules: MetaRules = defaultMetaRules,
  runs: readonly TypicalRunSpec[] = TYPICAL_RUNS,
): MetaSimResult {
  const meta = new MetaManager(
    createStarterMetaState(rules.progression.starter),
    undefined,
    rules,
  );
  const talentIds = [...talentTrees.values()]
    .flatMap((tree) => tree.nodes)
    .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))
    .map((node) => node.id);
  const unlockIds = [...rules.unlocks.values()]
    .sort(
      (a, b) =>
        totalCost(a.cost) - totalCost(b.cost) || a.id.localeCompare(b.id),
    )
    .map((def) => def.id);
  const rows: MetaSimRow[] = [];
  const levelsPerRun: number[] = [];
  runs.forEach((spec, index) => {
    const summary = typicalSummary(spec);
    const result = meta.applyRun(summary, `meta-balance:${index}`);
    levelsPerRun.push(result.levelAfter - result.levelBefore);
    const talentsBought = buyGreedy(talentIds, (id) => meta.buyTalent(id));
    const unlocksBought = buyGreedy(unlockIds, (id) => meta.buyUnlock(id));
    rows.push({
      name: spec.name,
      summary,
      rewards: result.rewards,
      levelAfter: meta.level,
      talentsBought,
      unlocksBought,
      dataAfter: meta.state.data,
      coresAfter: meta.state.cores,
    });
  });
  return {
    rows,
    finalLevel: meta.level,
    purchases: rows.reduce((sum, row) => sum + row.unlocksBought.length, 0),
    levelsPerRun,
  };
}

export const THREAT_TABLE_LEVELS = [0, 1, 2, 3] as const;

export interface ThreatRewardRow {
  level: number;
  victory: RunRewards;
  deathLayer5: RunRewards;
}

export function threatRewardTable(
  rules: MetaRules = defaultMetaRules,
): ThreatRewardRow[] {
  const victory = TYPICAL_RUNS[2]!;
  const death = TYPICAL_RUNS[1]!;
  return THREAT_TABLE_LEVELS.map((level) => {
    const entry = rules.threat[level]!;
    return {
      level,
      victory: computeRunRewards(
        typicalSummary(victory, level),
        entry,
        rules.progression.rewards,
      ),
      deathLayer5: computeRunRewards(
        typicalSummary(death, level),
        entry,
        rules.progression.rewards,
      ),
    };
  });
}

const rewardCells = (rewards: RunRewards) =>
  `${rewards.xp} | ${rewards.data} | ${rewards.cores}`;

export function renderMetaSection(
  sim: MetaSimResult = simulateTypicalRuns(),
  threatRows: ThreatRewardRow[] = threatRewardTable(),
): string[] {
  const list = (ids: string[]) => (ids.length ? ids.join(', ') : '—');
  return [
    '## Meta-progres (F4)',
    '',
    `Symulacja 5 typowych runów nowego gracza na Poziomie zagrożenia 0 (\`src/balance/metaSim.ts\`, \`tests/unit/metaBalance.test.ts\`). **Wynik: poziom ${sim.finalLevel}, ${sim.purchases} zakupów w warsztacie** (cel bramki F4: poziom 5–8, 2–4 zakupy, pierwszy run co najmniej 1 poziom, żaden run więcej niż 3 poziomy).`,
    '',
    'Model runu: stała ścieżka przez sektor Kurogane Arms (warstwy: walka, walka, walka, elita, sklep, elita, odpoczynek, boss). `roomsCleared` to wszystkie ukończone węzły (tak liczy `RunManager`: także sklep i odpoczynek, a przy zwycięstwie boss), więc śmierć w warstwie L daje L − 1 pokoi, a zwycięstwo 8. `elitesCleared`: 0, 1, 1, 2. Zabójstwa: 6 na pokój walki, 10 na elitę, boss 1 + 4 pomocników. `elapsedS`: suma `expectedDurationS` ukończonych pokoi. Po każdym runie gracz kupuje zachłannie talenty (najtańszy dostępny węzeł, remis: id) za wszystkie wolne punkty oraz odblokowania (najtańsze dostępne, Dane i Rdzenie), dopóki go stać.',
    '',
    '| Run | Pokoje | Elity | Zabójstwa | Czas (s) | XP | Dane | Rdzenie | Poziom po runie | Talenty kupione | Zakupy w warsztacie | Dane po zakupach | Rdzenie po zakupach |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
    ...sim.rows.map(
      (row, i) =>
        `| ${i + 1}. ${row.name} | ${row.summary.roomsCleared} | ${row.summary.elitesCleared} | ${row.summary.kills} | ${row.summary.elapsedS} | ${rewardCells(row.rewards)} | ${row.levelAfter} | ${row.talentsBought.length} | ${list(row.unlocksBought)} | ${row.dataAfter} | ${row.coresAfter} |`,
    ),
    '',
    'Nagrody za typowe zwycięstwo i śmierć w warstwie 5 na Poziomach zagrożenia 0–3 (Rdzenie nie mnożą się przez `rewardMult`, zwycięstwo dolicza `victoryCores`):',
    '',
    '| Poziom zagrożenia | `rewardMult` | Zwycięstwo: XP | Dane | Rdzenie | Śmierć w warstwie 5: XP | Dane | Rdzenie |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...threatRows.map(
      (row) =>
        `| ${row.level} | ${defaultMetaRules.threat[row.level]!.rewardMult} | ${rewardCells(row.victory)} | ${rewardCells(row.deathLayer5)} |`,
    ),
    '',
  ];
}
