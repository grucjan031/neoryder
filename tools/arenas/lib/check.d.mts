import type { RoomDefinition } from '../../../src/world/roomSchema';
import type { ArenaBuilder, ArenaMetadata, Rect } from './arena.mjs';
export type Issue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  details?: unknown;
};
export type Measurement = {
  areaM2: number;
  footprintM2: number;
  bounds: Rect | null;
  levels: number[];
  sampleM: number;
};
export function measureWalkable(
  room: RoomDefinition,
  sampleM?: number,
): Measurement;
export function checkArena(
  input: ArenaBuilder | RoomDefinition,
  metadata?: Partial<ArenaMetadata>,
  options?: { demo?: boolean; sampleM?: number; profile?: 'run' },
): {
  metrics: Measurement & {
    widthM: number;
    depthM: number;
    outlineFillRatio: number;
    aspectRatio: number;
    zones: number;
    zoneKinds: string[];
    spawnCount: number;
    propCount: number;
    mostCommonProp: { model: string; count: number; share: number } | null;
    /** Tylko profil `run`: zablokowana długość prostej start → wyjście i liczba przecinanych stref. */
    routeBlockedM?: number;
    routeZones?: number;
  };
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
};
type RunLimits = {
  axisM: [number, number];
  areaM2: number;
  levels: number;
  spawns: number;
};
export const RUN_PROFILE: {
  combat: RunLimits;
  elite: RunLimits;
  zones: [number, number];
  maxPropShare: number;
  minBlockedLineM: number;
  minLineZones: number;
  rampMatchM: number;
};
