import { z } from 'zod';
import { tuning } from '../core/tuning';
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

const hazardCycleSchema = z.object({
  onS: positive,
  offS: positive,
  offsetS: nonnegative.optional(),
});
export type HazardCycle = z.infer<typeof hazardCycleSchema>;
export const hazardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('electric_field'),
    id: z.string().min(1),
    position: vec3Schema,
    size: positiveVec3Schema,
    cycle: hazardCycleSchema.optional(),
  }),
  z.object({
    kind: z.literal('explosive_barrel'),
    id: z.string().min(1),
    position: vec3Schema,
  }),
  z.object({
    kind: z.literal('laser_gate'),
    id: z.string().min(1),
    from: vec3Schema,
    to: vec3Schema,
    cycle: hazardCycleSchema,
  }),
]);
export type Hazard = z.infer<typeof hazardSchema>;

export const roomBlockSchema = z.object({
  size: positiveVec3Schema,
  position: vec3Schema,
  material: blockMaterialSchema.optional(),
  model: z.string().min(1).optional(),
  rotation: vec3Schema.optional(),
  instance: z.boolean().optional(),
  walkable: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export const pointIdSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const capturePointsSchema = z
  .array(
    z.object({
      id: pointIdSchema,
      position: vec3Schema,
      radiusM: positive,
    }),
  )
  .min(3)
  .max(pointIdSchema.options.length)
  .refine((points) => {
    const ids = new Set(points.map((p) => p.id));
    return pointIdSchema.options
      .slice(0, points.length)
      .every((id) => ids.has(id));
  }, 'Punkty muszą mieć kolejne identyfikatory od A.');

export const arenaSchema = z.object({
  exclusive: z.boolean().optional(),
  maxAlive: positive.int().max(tuning.modes.conquest.maxAlive).optional(),
  enemyTickets: positive.int().optional(),
  spawnRing: z
    .object({ minM: nonnegative, maxM: positive })
    .refine(({ minM, maxM }) => maxM > minM)
    .optional(),
  spawnPoints: z
    .array(z.object({ x: finite, y: finite.optional(), z: finite }))
    .min(4)
    .optional(),
  points: capturePointsSchema,
  batchCellM: positive,
  navigationCellM: positive,
  navigationMaxRiseM: positive.optional(),
  navigationHeadroomM: positive.optional(),
  navigationClearanceM: positive,
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
    arena: arenaSchema.optional(),
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
    hazards: z.array(hazardSchema).optional(),
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

export function validateLayout(
  room: {
    playerSpawn: z.infer<typeof vec3Schema>;
    blocks: z.infer<typeof roomBlockSchema>[];
    spawnPoints: z.infer<typeof roomSpawnPointSchema>[];
    hazards?: Hazard[];
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
  const hazardIds = new Set<string>();
  for (const [index, hazard] of (room.hazards ?? []).entries()) {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', path: ['hazards', index], message });
    if (hazardIds.has(hazard.id))
      issue(`Powtórzone id zagrożenia: ${hazard.id}.`);
    hazardIds.add(hazard.id);
    const bounds =
      hazard.kind === 'laser_gate'
        ? [hazard.from, hazard.to]
        : hazard.kind === 'electric_field'
          ? [-1, 1].flatMap((x) =>
              [-1, 1].map((z) => ({
                x: hazard.position.x + (x * hazard.size.x) / 2,
                z: hazard.position.z + (z * hazard.size.z) / 2,
              })),
            )
          : [
              { x: hazard.position.x - 0.4, z: hazard.position.z - 0.4 },
              { x: hazard.position.x + 0.4, z: hazard.position.z + 0.4 },
            ];
    if (bounds.some((p) => !floors.some((floor) => contains(floor, p.x, p.z))))
      issue('Zagrożenie poza granicami podłogi pokoju.');
    for (const point of points) {
      if (hazard.kind === 'explosive_barrel') continue;
      let unsafe: boolean;
      if (hazard.kind === 'electric_field') {
        unsafe =
          Math.abs(point.x - hazard.position.x) <= hazard.size.x / 2 + 1 &&
          Math.abs(point.z - hazard.position.z) <= hazard.size.z / 2 + 1;
      } else {
        const dx = hazard.to.x - hazard.from.x;
        const dz = hazard.to.z - hazard.from.z;
        const lengthSq = dx * dx + dz * dz;
        const t =
          lengthSq === 0
            ? 0
            : Math.max(
                0,
                Math.min(
                  1,
                  ((point.x - hazard.from.x) * dx +
                    (point.z - hazard.from.z) * dz) /
                    lengthSq,
                ),
              );
        unsafe =
          Math.hypot(
            point.x - hazard.from.x - dx * t,
            point.z - hazard.from.z - dz * t,
          ) <= 1;
      }
      if (unsafe)
        issue(
          'Punkt spawnu znajduje się w zagrożeniu lub jego marginesie 1 m.',
        );
    }
  }
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
