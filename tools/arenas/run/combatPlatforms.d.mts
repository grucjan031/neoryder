import type { ArenaBuilder } from '../lib/arena.mjs';
export default function generate(): ArenaBuilder;
/** Widoki kontrolne dla `_shots.mjs`. */
export const shots: {
  name: string;
  x: number;
  z: number;
  yaw?: number;
  pitch?: number;
  floorY?: number;
}[];
