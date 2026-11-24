import type { RunOutcome } from './runTypes';
import type {
  TalentEffects,
  TalentNode,
  TalentTree,
} from '../progression/talentSchema';

export const TREE_IDS = ['blade', 'resonance', 'gunner', 'hybrid'] as const;
export type TreeId = (typeof TREE_IDS)[number];

export const HUB_STATION_IDS = [
  'talents',
  'workshop',
  'missions',
  'arena',
] as const;
export type HubStationId = (typeof HUB_STATION_IDS)[number];

/** Ekwipunek złożony w warsztacie (ADR 0007 pkt 6); do pełnego `Loadout` dochodzi `id: 'custom'` i puste `tags`. */
export interface LoadoutChoice {
  blade: string;
  weapons: string[];
  powers: string[];
  modules: Record<string, string[]>;
  skins: Record<string, string>;
}

/** Starsi nadawcy wyboru wyposażenia mogą pominąć mapę skinów. */
export type LoadoutChoiceInput = Omit<LoadoutChoice, 'skins'> &
  Partial<Pick<LoadoutChoice, 'skins'>>;

export interface RunRewards {
  xp: number;
  data: number;
  cores: number;
}

export interface MetaRunRecord {
  /** `${seed}:${startedAtMs}`. */
  runId: string;
  outcome: RunOutcome;
  elapsedS: number;
  layerReached: number;
  threatLevel: number;
  rewards: RunRewards;
  /** Id naszywek zdobytych w tym runie (podsumowanie po odświeżeniu). */
  achievements?: string[];
}

export interface MetaState {
  campaign: { completed: string[]; pendingDebrief: string | null };
  /** Łączne doświadczenie; poziom wynika z krzywej w danych. */
  xp: number;
  /** Dane. */
  data: number;
  /** Rdzenie. */
  cores: number;
  /** Kupione węzły drzewek. */
  talents: string[];
  /** `weapon:<id>` | `power:<id>` | `blade:<id>` | `slot:<id>` | `module:<id>`. */
  unlocks: string[];
  pendingExtractions: { runId: string; moduleIds: string[] }[];
  /** Ekwipunek wybrany w warsztacie. */
  loadout: LoadoutChoice;
  threat: { max: number; selected: number };
  stats: {
    runs: number;
    victories: number;
    deaths: number;
    kills: number;
    bestVictoryS: number | null;
  };
  /** Najnowsze pierwsze, najwyżej 10. */
  lastRuns: MetaRunRecord[];
  /** Idempotencja nagród, najwyżej 20. */
  appliedRunIds: string[];
  /** Naszywki Iskry: zdobyte id i liczniki łączne (ADR 0007, S4b-01). */
  achievements: AchievementsState;
}

export interface AchievementsState {
  unlocked: string[];
  counters: Record<string, number>;
}

export const MAX_LAST_RUNS = 10;
export const MAX_APPLIED_RUN_IDS = 20;

/** Łatka definicji broni, mocy lub ostrza (ADR 0007 pkt 5). */
export interface DefinitionPatch {
  target: `weapon:${string}` | `power:${string}` | `blade:${string}`;
  op: 'set' | 'add' | 'mul' | 'append';
  /** Ścieżka w definicji, np. 'jumps', 'combo.2.knockback', 'statuses'. */
  path: string;
  /** Liczba dla add/mul; dowolna wartość JSON dla set. */
  value: unknown;
}

export type { TalentEffects, TalentNode, TalentTree };
