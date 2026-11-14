import type { Rng } from './rng';
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
  seed: string;
  sectorId: string;
  loadoutId: string;
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
  outcome: RunOutcome;
  seed: string;
  loadoutId: string;
  elapsedS: number;
  kills: number;
  roomsCleared: number;
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
  ): WavesDefinition;
}
