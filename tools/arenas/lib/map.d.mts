import type { RoomDefinition } from '../../../src/world/roomSchema';
import type { ArenaBuilder, ArenaMetadata } from './arena.mjs';
export function arenaSvg(
  input: ArenaBuilder | RoomDefinition,
  metadata?: Partial<ArenaMetadata>,
): string;
export function writeArenaSvg(
  path: string,
  input: ArenaBuilder | RoomDefinition,
  metadata?: Partial<ArenaMetadata>,
): void;
