import type { RoomDefinition } from '../../../src/world/roomSchema';

export type Vec3 = { x: number; y: number; z: number };
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Block = RoomDefinition['blocks'][number];
export type Material = NonNullable<Block['material']>;
export type Rng = () => number;
export type ZoneKind = 'open' | 'dense' | 'interior' | 'high' | 'low';
export type ArenaMetadata = {
  seed: string | number;
  bounds: Rect;
  zones: { name: string; rect: Rect; kind: ZoneKind }[];
  warnings: { code: string; message: string }[];
};
export interface ArenaBuilder {
  rng: Rng;
  metadata: ArenaMetadata;
  block(box: Block): Block;
  decor(
    model: string,
    position: Vec3,
    rotationY?: number,
    opts?: { scale?: number },
  ): NonNullable<RoomDefinition['decor']>[number];
  light(
    position: Vec3,
    color?: string,
    intensity?: number,
    range?: number,
    opts?: {
      groundGlow?: boolean;
      flicker?: NonNullable<RoomDefinition['lights']>[number]['flicker'];
    },
  ): NonNullable<RoomDefinition['lights']>[number];
  spawn(position: { x: number; z: number; y?: number }): ArenaBuilder;
  point(
    id: 'A' | 'B' | 'C' | 'D' | 'E',
    position: Vec3,
    radiusM?: number,
  ): ArenaBuilder;
  zone(name: string, rect: Rect, kind: ZoneKind): ArenaBuilder;
  arenaMeta(
    fields: Partial<NonNullable<RoomDefinition['arena']>>,
  ): ArenaBuilder;
  roomMeta(
    fields: Partial<
      Omit<RoomDefinition, 'id' | 'blocks' | 'arena' | 'spawnPoints'>
    >,
  ): ArenaBuilder;
  warn(code: string, message: string): void;
  toRoom(): RoomDefinition;
  write(path: string): void;
}
export function vec(x: number, y?: number, z?: number): Vec3;
export function createRng(seed: string | number): Rng;
export function stableJson(value: unknown): string;
export function writeJson(path: string, value: unknown): void;
export function assertRect(rect: Rect): Rect;
export function createArena(options: {
  id: string;
  name: string;
  theme?: string;
  weather?: string;
  seed?: string | number;
  bounds: Rect;
}): ArenaBuilder;
