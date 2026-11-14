import { z } from 'zod';
import { blockMaterialSchema, dressingFields } from './dressingSchema';
import { NODE_TYPES } from '../core/runTypes';
import { directorConfigSchema } from '../enemies/director';

const finite = z.number().finite();
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();

export const vec3Schema = z.object({
  x: finite,
  y: finite,
  z: finite,
});

export const positiveVec3Schema = z.object({
  x: positive,
  y: positive,
  z: positive,
});

export const roomBlockSchema = z.object({
  size: positiveVec3Schema,
  position: vec3Schema,
  material: blockMaterialSchema.optional(),
  model: z.string().min(1).optional(),
});

export const roomSpawnPointSchema = z.object({
  x: finite,
  z: finite,
});

export const roomDoorSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['entry', 'exit']),
  position: vec3Schema,
  size: positiveVec3Schema,
});

export const roomPropSchema = z.object({
  kind: z.string().min(1),
  position: vec3Schema,
});

/** Definicja pokoju z src/data/rooms/*.json (ADR 0005 pkt 2). */
export const roomSchema = z
  .object({
    ...dressingFields,
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(NODE_TYPES),
    playerSpawn: vec3Schema,
    blocks: z.array(roomBlockSchema),
    spawnPoints: z.array(roomSpawnPointSchema),
    doors: z.array(roomDoorSchema),
    director: directorConfigSchema.optional(),
    maxAlive: z.number().int().positive().optional(),
    minSpawnDistance: nonnegative.optional(),
    threatMultiplier: positive.optional(),
    /** Boss pokoju: id wroga z `kind: 'boss'`; włącza tryb bossa w RoomScene (bez fal). */
    bossEnemy: z.string().min(1).optional(),
    props: z.array(roomPropSchema).optional(),
    puzzle: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((room, ctx) => {
    const entries = room.doors.filter((door) => door.role === 'entry');
    if (entries.length !== 1)
      ctx.addIssue({
        code: 'custom',
        path: ['doors'],
        message: 'Pokój wymaga dokładnie jednych drzwi wejściowych (entry).',
      });
    const exits = room.doors.filter((door) => door.role === 'exit');
    if (exits.length !== (room.type === 'boss' ? 0 : 1))
      ctx.addIssue({
        code: 'custom',
        path: ['doors'],
        message: 'Pokój wymaga jednych drzwi exit, a boss nie ma drzwi exit.',
      });
    const doorIds = new Set<string>();
    room.doors.forEach((door, index) => {
      if (doorIds.has(door.id))
        ctx.addIssue({
          code: 'custom',
          path: ['doors', index, 'id'],
          message: `Powtórzone id drzwi: ${door.id}.`,
        });
      doorIds.add(door.id);
    });
    if (
      (room.type === 'combat' || room.type === 'elite') &&
      room.spawnPoints.length < 4
    )
      ctx.addIssue({
        code: 'custom',
        path: ['spawnPoints'],
        message: 'Pokój combat/elite wymaga co najmniej 4 punktów spawnu.',
      });
    if (room.bossEnemy !== undefined && room.type !== 'boss')
      ctx.addIssue({
        code: 'custom',
        path: ['bossEnemy'],
        message: 'bossEnemy jest dozwolone tylko w pokoju typu boss.',
      });
    validateLayout(room, ctx);
  });

export type RoomDefinition = z.infer<typeof roomSchema>;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

function footprint(block: z.infer<typeof roomBlockSchema>): Rect {
  return {
    minX: block.position.x - block.size.x / 2,
    maxX: block.position.x + block.size.x / 2,
    minZ: block.position.z - block.size.z / 2,
    maxZ: block.position.z + block.size.z / 2,
  };
}

function contains(rect: Rect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

function validateLayout(
  room: {
    playerSpawn: z.infer<typeof vec3Schema>;
    blocks: z.infer<typeof roomBlockSchema>[];
    spawnPoints: z.infer<typeof roomSpawnPointSchema>[];
  },
  ctx: z.RefinementCtx,
): void {
  const groundY = room.playerSpawn.y;
  const floors = room.blocks
    .filter((block) => block.position.y + block.size.y / 2 === groundY)
    .map(footprint);
  const obstacles = room.blocks
    .filter(
      (block) =>
        block.position.y - block.size.y / 2 <= groundY &&
        block.position.y + block.size.y / 2 > groundY,
    )
    .map(footprint);
  if (floors.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['blocks'],
      message: 'Układ wymaga podłogi z górną powierzchnią na playerSpawn.y.',
    });
    return;
  }

  const points = [room.playerSpawn, ...room.spawnPoints];
  const valid = points.map((point, index) => {
    const path = index === 0 ? ['playerSpawn'] : ['spawnPoints', index - 1];
    if (!floors.some((floor) => contains(floor, point.x, point.z))) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: 'Punkt poza granicami podłogi pokoju.',
      });
      return false;
    }
    if (obstacles.some((block) => contains(block, point.x, point.z))) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: 'Punkt spawnu znajduje się w bloku.',
      });
      return false;
    }
    return true;
  });
  if (!valid[0]) return;

  // Komórki 1 m; przecięcie wnętrza komórki z blokiem zamyka ją także dla cienkich ścian.
  const walkable = (x: number, z: number): boolean =>
    floors.some(
      (floor) => contains(floor, x, z) && contains(floor, x + 1, z + 1),
    ) &&
    !obstacles.some(
      (block) =>
        block.minX < x + 1 &&
        block.maxX > x &&
        block.minZ < z + 1 &&
        block.maxZ > z,
    );
  const key = (x: number, z: number): string => `${x},${z}`;
  const start = {
    x: Math.floor(room.playerSpawn.x),
    z: Math.floor(room.playerSpawn.z),
  };
  const visited = new Set<string>();
  const queue: { x: number; z: number }[] = [];
  if (walkable(start.x, start.z)) {
    visited.add(key(start.x, start.z));
    queue.push(start);
  } else {
    ctx.addIssue({
      code: 'custom',
      path: ['playerSpawn'],
      message: 'playerSpawn nie ma wolnej komórki siatki 1 m.',
    });
    return;
  }
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index]!;
    for (const next of [
      { x: point.x - 1, z: point.z },
      { x: point.x + 1, z: point.z },
      { x: point.x, z: point.z - 1 },
      { x: point.x, z: point.z + 1 },
    ]) {
      const id = key(next.x, next.z);
      if (visited.has(id) || !walkable(next.x, next.z)) continue;
      visited.add(id);
      queue.push(next);
    }
  }
  room.spawnPoints.forEach((point, index) => {
    if (
      valid[index + 1] &&
      !visited.has(key(Math.floor(point.x), Math.floor(point.z)))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['spawnPoints', index],
        message: 'Punkt spawnu nieosiągalny od playerSpawn na siatce 1 m.',
      });
  });
}

export function loadRoom(data: unknown): RoomDefinition {
  return roomSchema.parse(data);
}
export const loadRoomDefinition = loadRoom;
