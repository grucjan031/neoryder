import type {
  ArenaBuilder,
  Vec3,
  Rect,
  Block,
  Material,
  Rng,
} from './arena.mjs';
export const CONTROLLER_LIMITS: {
  maxSlopeDeg: number;
  stepHeight: number;
  stepMinWidth: number;
};
export type Opening = {
  at: number;
  width: number;
  height: number;
  bottom?: number;
};
export type Side = 'north' | 'south' | 'east' | 'west';
export type Door = { side: Side; at: number; width: number; height?: number };
export type Surface = { rect: Rect; y: number; blocks: Block[] };
export type Ramp = {
  from: Vec3;
  to: Vec3;
  width: number;
  run: number;
  rise: number;
  angle: number;
  blocks: Block[];
};
export type StairOptions = {
  width?: number;
  stepRise?: number;
  stepDepth?: number;
  material?: Material;
};
export type Stairs = {
  from: Vec3;
  to: Vec3;
  width: number;
  rise: number;
  run: number;
  angle: number;
  count: number;
  stepRise: number;
  stepDepth: number;
  blocks: Block[];
};
export type Building = {
  rect: Rect;
  y: number;
  height: number;
  surfaces: Surface[];
  flights: Stairs[];
  blocks: Block[];
  stairwell?: Rect;
};
export function floor(
  arena: ArenaBuilder,
  rect: Rect,
  y?: number,
  material?: Material,
  opts?: { thickness?: number; walkable?: boolean; visible?: boolean },
): Surface;
export function wall(
  arena: ArenaBuilder,
  from: Vec3,
  to: Vec3,
  height: number,
  thickness?: number,
  material?: Material,
  opts?: { openings?: Opening[]; visible?: boolean },
): {
  from: Vec3;
  to: Vec3;
  height: number;
  thickness: number;
  openings: Opening[];
  blocks: Block[];
};
export function ramp(
  arena: ArenaBuilder,
  options: {
    from: Vec3;
    to: Vec3;
    width: number;
    material?: Material;
    thickness?: number;
  },
): Ramp;
export function stairs(
  arena: ArenaBuilder,
  options: StairOptions & {
    from: Vec3;
    to: Vec3;
    width: number;
    walkable?: boolean;
  },
): Stairs;
export function building(
  arena: ArenaBuilder,
  options: {
    rect: Rect;
    height: number;
    floors?: number;
    wallMaterial?: Material;
    roofMaterial?: Material;
    doors?: Door[];
    windows?: (Opening & { side: Side })[];
    interior?: boolean;
    stairs?: boolean | StairOptions;
    y?: number;
    roofAccessible?: boolean;
    thickness?: number;
  },
): Building;
export function hall(
  arena: ArenaBuilder,
  options: {
    rect: Rect;
    height: number;
    mezzanine?: { side: Side; depth: number; y: number };
    doors?: Door[];
    roofTrussModel?: string;
    y?: number;
    wallMaterial?: Material;
  },
): Building & { flight?: Stairs };
export function bridge(
  arena: ArenaBuilder,
  options: {
    from: Vec3;
    to: Vec3;
    width: number;
    y?: number;
    railings?: boolean;
    material?: Material;
    thickness?: number;
  },
): Ramp;
export function containerStack(
  arena: ArenaBuilder,
  options: {
    position: Vec3;
    rotationY?: number;
    layers?: number;
    length?: 20 | 40;
    palette?: ('navy' | 'olive' | 'ochre' | 'graphite')[];
  },
): { blocks: Block[]; roofY: number };
export function fence(
  arena: ArenaBuilder,
  options: {
    from: Vec3;
    to: Vec3;
    height?: number;
    model?: string;
    thickness?: number;
  },
): { blocks: Block[] };
export function pit(
  arena: ArenaBuilder,
  options: {
    rect: Rect;
    depth: number;
    ramps?: {
      side: Side;
      at: number;
      from: Vec3;
      to: Vec3;
      width: number;
      material?: Material;
      thickness?: number;
    }[];
    wallMaterial?: Material;
    y?: number;
  },
): { rect: Rect; bottomY: number; blocks: Block[]; connections: Ramp[] };
export function quay(
  arena: ArenaBuilder,
  options: {
    edge: Vec3;
    waterSide: Side;
    length: number;
    height?: number;
    width?: number;
    material?: Material;
  },
): Surface;
export function safetyBoundary(
  arena: ArenaBuilder,
  polygon: Vec3[],
  height?: number,
): { polygon: Vec3[]; blocks: Block[] };
export function scatter(
  arena: ArenaBuilder,
  options: {
    rect: Rect;
    models: string[];
    count: number;
    minSpacing?: number;
    rng?: Rng;
    avoid?: Rect[];
    y?: number;
  },
): {
  placements: { model: string; position: Vec3; yaw?: number; scale?: number }[];
};
type Bind<T> = T extends (arena: ArenaBuilder, ...args: infer A) => infer R
  ? (...args: A) => R
  : never;
type Primitives = {
  floor: typeof floor;
  wall: typeof wall;
  building: typeof building;
  hall: typeof hall;
  ramp: typeof ramp;
  stairs: typeof stairs;
  bridge: typeof bridge;
  containerStack: typeof containerStack;
  fence: typeof fence;
  pit: typeof pit;
  quay: typeof quay;
  safetyBoundary: typeof safetyBoundary;
  scatter: typeof scatter;
};
export function createPrimitives(arena: ArenaBuilder): {
  [K in keyof Primitives]: Bind<Primitives[K]>;
};
