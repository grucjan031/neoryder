import { z } from 'zod';
import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';
import { loadRoom } from './roomSchema';
import { tuning } from '../core/tuning';

export const modeIdSchema = z.enum(['conquest']);
export type ModeId = z.infer<typeof modeIdSchema>;
export const pointIdSchema = z.enum(['A', 'B', 'C']);
export type PointId = z.infer<typeof pointIdSchema>;
const positive = z.number().finite().positive();
export const modeSchema = z.object({
  id: modeIdSchema,
  title: z.string().min(1),
  roomId: z.string().min(1),
  points: z
    .array(
      z.object({
        id: pointIdSchema,
        position: z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          z: z.number().finite(),
        }),
        radiusM: positive,
      }),
    )
    .length(3)
    .refine(
      (points) => new Set(points.map((p) => p.id)).size === 3,
      'Wymagane różne punkty A/B/C.',
    ),
  enemies: z.array(z.string().min(1)).min(1),
  enemyTickets: positive.int(),
  maxAlive: positive.int(),
  spawnIntervalS: positive,
  captureS: positive,
  bleed: z.object({
    holdTwoPerS: z.number().finite().nonnegative(),
    holdThreePerS: z.number().finite().nonnegative(),
  }),
  rewardRooms: positive.int(),
});
export type ModeDefinition = z.infer<typeof modeSchema>;

export function freeModePosition(
  room: RoomDefinition,
  point: Vec3,
  radius = 0,
): boolean {
  const contains = (b: RoomDefinition['blocks'][number], margin: number) =>
    Math.abs(point.x - b.position.x) <= b.size.x / 2 + margin &&
    Math.abs(point.z - b.position.z) <= b.size.z / 2 + margin;
  return (
    room.blocks.some(
      (b) =>
        Math.abs(b.position.y + b.size.y / 2 - point.y) < 1e-6 &&
        contains(b, -radius),
    ) &&
    !room.blocks.some(
      (b) =>
        b.position.y - b.size.y / 2 <= point.y &&
        b.position.y + b.size.y / 2 > point.y &&
        Math.hypot(
          Math.max(0, Math.abs(point.x - b.position.x) - b.size.x / 2),
          Math.max(0, Math.abs(point.z - b.position.z) - b.size.z / 2),
        ) <= radius,
    )
  );
}

export function validateMode(
  mode: ModeDefinition,
  room: RoomDefinition,
  enemyIds: readonly string[],
): void {
  if (room.id !== mode.roomId || room.type !== 'combat')
    throw new Error('Tryb wymaga pokoju combat.');
  if (
    mode.enemies.some(
      (id) => !enemyIds.includes(id) || !['assaulter', 'gunner'].includes(id),
    )
  )
    throw new Error('Nieobsługiwany wróg trybu.');
  if (room.maxAlive !== undefined && mode.maxAlive > room.maxAlive)
    throw new Error('Limit trybu przekracza limit pokoju.');
  for (const point of mode.points) {
    if (!freeModePosition(room, point.position, point.radiusM))
      throw new Error(`Strefa ${point.id} poza wolną podłogą.`);
    for (const other of mode.points)
      if (
        point !== other &&
        Math.hypot(
          point.position.x - other.position.x,
          point.position.z - other.position.z,
        ) < tuning.modes.conquest.minPointDistanceM
      )
        throw new Error('Punkty trybu są zbyt blisko.');
  }
  // Ta sama walidacja osiągalności co punkty spawnu pokoju.
  loadRoom({
    ...room,
    spawnPoints: [...room.spawnPoints, ...mode.points.map((p) => p.position)],
  });
}
