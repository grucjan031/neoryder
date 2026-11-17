import type { ModeId } from '../world/modeSchema';
import type { Rng } from './rng';
import type { Loadout } from '../progression/loadout';
import type { RoomDefinition } from '../world/roomSchema';
import type { SectorDefinition } from '../world/sectorSchema';
import type { WavesDefinition } from '../world/waves';

export const NODE_TYPES = [
  'combat',
  'elite',
  'shop',
  'rest',
  'puzzle',
  'boss',
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export interface MapNode {
  id: string;
  layer: number;
  index: number;
  type: NodeType;
  next: string[];
  fixed?: { roomId: string; objectives: string[]; final?: boolean };
}

export interface SectorMap {
  sectorId: string;
  layers: MapNode[][];
}

export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITIES)[number];

export type RunOutcome = 'victory' | 'death';

export interface RunDamageStats {
  melee: number;
  power: number;
  gun: number;
  other: number;
}

export interface RunState {
  modeId?: ModeId;
  missionId?: string;
  objectives?: Record<string, 'pending' | 'active' | 'done'>;
  objectiveProgress?: Record<string, number>;
  seed: string;
  sectorId: string;
  loadoutId: string;
  /** Pełna kopia ekwipunku z chwili startu runu (ADR 0007 pkt 6). */
  loadout: Loadout;
  /** Id talentów zamrożone na start runu. */
  talents: string[];
  /** Poziom zagrożenia zamrożony na start runu (0 = F3). */
  threatLevel: number;
  startedAtMs: number;
  /** Czas symulacji w sekundach (nie zegar ściany). */
  elapsedS: number;
  map: SectorMap;
  currentNodeId: string | null;
  visited: string[];
  hp: number;
  /** Ciepło broni nie jest przenoszone między pokojami (broń startuje zimna). */
  energy: number;
  credits: number;
  /** Id posiadanych implantów, bez duplikatów. */
  implants: string[];
  stats: {
    kills: number;
    damage: RunDamageStats;
  };
}

export interface RunSummary {
  modeId?: ModeId;
  missionId?: string;
  missionCompleted?: boolean;
  outcome: RunOutcome;
  seed: string;
  loadoutId: string;
  elapsedS: number;
  kills: number;
  roomsCleared: number;
  /** Ukończone pokoje typu elite. */
  elitesCleared: number;
  threatLevel: number;
  layerReached: number;
  implants: string[];
  damage: RunDamageStats;
}

/** Planowanie fal pokoju na podstawie budżetu zagrożenia sektora (ADR 0005 pkt 3). */
export interface RoomPlanner {
  planWaves(
    room: RoomDefinition,
    sector: SectorDefinition,
    node: MapNode,
    rng: Rng,
    /** F4-05: Poziom zagrożenia z RunState (mnożnik budżetu); domyślnie 0 = F3. */
    threatLevel?: number,
  ): WavesDefinition;
}
