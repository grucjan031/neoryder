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
  options?: { demo?: boolean; sampleM?: number },
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
  };
  issues: Issue[];
  errors: Issue[];
  warnings: Issue[];
};
