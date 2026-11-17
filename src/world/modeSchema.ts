import { z } from 'zod';
import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';
import { loadRoom, vec3Schema } from './roomSchema';
import { tuning } from '../core/tuning';
import { capturePointsSchema, pointIdSchema } from './roomSchema';
import { arenaSpawnPoints } from './arenaSpawns';
import { ArenaNavigation } from './arenaNavigation';
import { Rng } from '../core/rng';

export const modeIdSchema = z.enum(['conquest', 'assault', 'heist']);
export type ModeId = z.infer<typeof modeIdSchema>;
export { pointIdSchema };
export type PointId = z.infer<typeof pointIdSchema>;
const positive = z.number().finite().positive();
export const conquestSchema = z.object({
  id: z.literal('conquest'),
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
});
/** Przejęcie: lista aren (`arenas`) albo dawne pojedyncze `roomId`. */
export const conquestModeSchema = conquestSchema.refine(
  (m) => !!m.arenas?.length || !!m.roomId,
  'Brak aren trybu.',
);
export type ModeDefinition = z.infer<typeof conquestSchema>;
export type ResolvedModeDefinition = ModeDefinition & {
  roomId: string;
  points: z.infer<typeof capturePointsSchema>;
};

export const assaultSchema = z.object({
  id: z.literal('assault'),
  title: z.string().min(1),
  roomId: z.string().min(1),
  enemies: z.array(z.string().min(1)).min(1),
  maxAlive: positive.int(),
  spawnIntervalS: positive,
  rewardRooms: positive.int(),
  lives: positive.int(),
  respawnS: positive,
  noticeS: positive,
  radiusM: positive,
  holdS: positive,
  fuseS: positive,
  blastRadiusM: positive,
  blastDamage: positive,
  detectRangeM: positive,
  minSpawnDistanceM: positive,
  spawnClearanceM: positive,
  sectors: z
    .array(
      z.object({
        playerSpawn: vec3Schema,
        stations: z.tuple([vec3Schema, vec3Schema]),
        spawnPoints: z.array(vec3Schema).min(1),
      }),
    )
    .length(3),
});
export type AssaultDefinition = z.infer<typeof assaultSchema>;
export const heistSchema = z.object({
  id: z.literal('heist'),
  title: z.string().min(1),
  roomId: z.string().min(1),
  enemies: z.array(z.string().min(1)).min(1),
  maxAlive: positive.int(),
  spawnIntervalS: positive,
  rewardRooms: positive.int(),
  lives: positive.int(),
  respawnS: positive,
  carrySpeed: positive.max(1),
  enemyCarrySpeed: positive.max(1),
  enemyDefendRangeM: positive,
  pickupRadiusM: positive,
  extractRadiusM: positive,
  extractS: positive,
  timeLimitS: z.number().finite().nonnegative(),
  minSpawnDistanceM: positive,
  spawnClearanceM: positive,
  base: vec3Schema,
  extraction: vec3Schema,
  spawnPoints: z.array(vec3Schema).min(1),
});
export type HeistDefinition = z.infer<typeof heistSchema>;
export const modeSchema = z.discriminatedUnion('id', [
  conquestSchema,
  assaultSchema,
  heistSchema,
]);

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
  return {
    ...mode,
    roomId: room.id,
    points,
    maxAlive: room.arena?.maxAlive ?? mode.maxAlive,
    enemyTickets: room.arena?.enemyTickets ?? mode.enemyTickets,
  };
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
  mode: ResolvedModeDefinition | AssaultDefinition | HeistDefinition,
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
  if (mode.id === 'heist') {
    if (
      !freeModePosition(room, mode.base, mode.pickupRadiusM) ||
      !freeModePosition(room, mode.extraction, mode.extractRadiusM) ||
      Math.hypot(
        mode.base.x - mode.extraction.x,
        mode.base.z - mode.extraction.z,
      ) <=
        mode.pickupRadiusM + mode.extractRadiusM ||
      mode.spawnPoints.some(
        (p) => !freeModePosition(room, p, mode.spawnClearanceM),
      )
    )
      throw new Error('Nieprawidłowe strefy Kradzieży rdzenia.');
    loadRoom({
      ...room,
      spawnPoints: [
        ...room.spawnPoints,
        mode.base,
        mode.extraction,
        ...mode.spawnPoints,
      ],
    });
    return;
  }
  if (mode.id === 'assault') {
    const positions: Vec3[] = [];
    for (const [index, sector] of mode.sectors.entries()) {
      const previous = mode.sectors[index - 1];
      if (previous && sector.playerSpawn.z >= previous.playerSpawn.z)
        throw new Error('Front musi przesuwać się ku ujemnemu Z.');
      for (const station of sector.stations) {
        if (
          !freeModePosition(room, station, mode.radiusM) ||
          station.z >= sector.playerSpawn.z
        )
          throw new Error('Stacja poza wolną strefą frontu.');
      }
      if (
        Math.hypot(
          sector.stations[0].x - sector.stations[1].x,
          sector.stations[0].z - sector.stations[1].z,
        ) <
        mode.radiusM * 2
      )
        throw new Error('Strefy stacji nakładają się.');
      for (const spawn of sector.spawnPoints) {
        if (
          !freeModePosition(room, spawn, mode.spawnClearanceM) ||
          sector.stations.some((s) => spawn.z >= s.z)
        )
          throw new Error('Posiłki muszą stać za stacjami.');
      }
      if (!freeModePosition(room, sector.playerSpawn, mode.spawnClearanceM))
        throw new Error('Odrodzenie poza wolną podłogą.');
      positions.push(
        sector.playerSpawn,
        ...sector.stations,
        ...sector.spawnPoints,
      );
    }
    loadRoom({ ...room, spawnPoints: [...room.spawnPoints, ...positions] });
    return;
  }
  capturePointsSchema.parse(mode.points);
  if (mode.maxAlive > tuning.modes.conquest.maxAlive)
    throw new Error('Limit żywych wrogów Przejęcia przekracza limit areny.');
  const spawns = arenaSpawnPoints(room);
  if (room.arena?.spawnRing) {
    const unique = new Set(spawns.map((p) => JSON.stringify(p)));
    if (unique.size < tuning.modes.conquest.minRingSpawns)
      throw new Error(
        `Pierścień posiłków wymaga co najmniej ${tuning.modes.conquest.minRingSpawns} różnych spawnów.`,
      );
  }
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
    for (const spawn of [room.playerSpawn, ...spawns]) {
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
    for (const start of [room.playerSpawn, ...spawns])
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
