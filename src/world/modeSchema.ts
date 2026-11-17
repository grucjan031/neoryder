import { z } from 'zod';
import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';
import { loadRoom } from './roomSchema';
import { tuning } from '../core/tuning';
import { capturePointsSchema } from './roomSchema';
import { ArenaNavigation } from './arenaNavigation';
import { Rng } from '../core/rng';

export const modeIdSchema = z.enum(['conquest']);
export type ModeId = z.infer<typeof modeIdSchema>;
export const pointIdSchema = z.enum(['A', 'B', 'C']);
export type PointId = z.infer<typeof pointIdSchema>;
const positive = z.number().finite().positive();
export const modeSchema = z
  .object({
    id: modeIdSchema,
    title: z.string().min(1),
    roomId: z.string().min(1).optional(),
    arenas: z
      .array(z.string().min(1))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    points: capturePointsSchema.optional(),
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
  })
  .refine((m) => !!m.arenas?.length || !!m.roomId, 'Brak aren trybu.');
export type ModeDefinition = z.infer<typeof modeSchema>;
export type ResolvedModeDefinition = ModeDefinition & {
  roomId: string;
  points: z.infer<typeof capturePointsSchema>;
};

export function selectArena(
  mode: ModeDefinition,
  seed?: string,
  override?: string | null,
  debug = false,
): string {
  const ids = mode.arenas ?? (mode.roomId ? [mode.roomId] : []);
  if (debug && override) {
    if (!ids.includes(override))
      throw new Error(`Arena poza listą trybu: ${override}`);
    return override;
  }
  if (!ids.length) throw new Error('Brak aren trybu.');
  return seed === undefined
    ? ids[0]!
    : new Rng(seed).fork('conquest-arena').pick(ids);
}

export function modeForArena(
  mode: ModeDefinition,
  room: RoomDefinition,
): ResolvedModeDefinition {
  const points =
    room.arena?.points ?? (mode.roomId === room.id ? mode.points : undefined);
  if (!points) throw new Error(`Brak punktów areny: ${room.id}`);
  return { ...mode, roomId: room.id, points };
}

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
        b.position.y + b.size.y / 2 > point.y + 1e-6 &&
        Math.hypot(
          Math.max(0, Math.abs(point.x - b.position.x) - b.size.x / 2),
          Math.max(0, Math.abs(point.z - b.position.z) - b.size.z / 2),
        ) <= radius,
    )
  );
}

export function validateMode(
  mode: ResolvedModeDefinition,
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
  if (room.arena) {
    for (const spawn of [
      room.playerSpawn,
      ...(room.arena.spawnPoints ?? room.spawnPoints).map((p) => ({
        ...p,
        y: room.playerSpawn.y,
      })),
    ]) {
      if (!freeModePosition(room, spawn, room.arena.navigationClearanceM))
        throw new Error('Spawn areny nie ma wolnego marginesu.');
      if (
        mode.points.some(
          (p) =>
            Math.hypot(p.position.x - spawn.x, p.position.z - spawn.z) <=
            p.radiusM + room.arena!.navigationClearanceM,
        )
      )
        throw new Error('Spawn areny znajduje się w punkcie przejęcia.');
    }
  }
  if (room.blocks.some((b) => b.walkable)) {
    const navigation = new ArenaNavigation(room);
    for (const start of [
      room.playerSpawn,
      ...(room.arena?.spawnPoints ?? room.spawnPoints).map((p) => ({
        ...p,
        y: room.playerSpawn.y,
      })),
    ])
      for (const point of mode.points)
        if (!navigation.path(start, point.position).length)
          throw new Error(
            `Nieosiągalna strefa ${point.id} z ${JSON.stringify(start)}.`,
          );
    return;
  }
  // Ta sama walidacja osiągalności co punkty spawnu pokoju.
  loadRoom({
    ...room,
    spawnPoints: [
      ...(room.arena?.spawnPoints ?? room.spawnPoints),
      ...mode.points.map((p) => p.position),
    ],
  });
}
