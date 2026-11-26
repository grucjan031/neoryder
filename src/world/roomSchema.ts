import { z } from 'zod';
import { length, scale, sub } from '../core/math';
import { tuning } from '../core/tuning';
import { blockMaterialSchema, dressingFields } from './dressingSchema';
import { NODE_TYPES } from '../core/runTypes';
import { directorConfigSchema } from '../enemies/director';
import { insideLevelZone } from './levelRuntime';
import { rayAabbDistance } from './hubStations';

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
  /** false = skrzynia `crate` / `crate_small` zostaje statyczną bryłą (domyślnie zniszczalna). */
  destructible: z.boolean().optional(),
  visible: z.boolean().optional(),
  ceiling: z.boolean().optional(),
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

/** Układ Szturmu na dużej arenie: kolejne sektory frontu (ADR 0011 D4). */
export const assaultLayoutSchema = z.object({
  sectors: z
    .array(
      z.object({
        playerSpawn: vec3Schema,
        stations: z.tuple([vec3Schema, vec3Schema]),
        spawnPoints: z.array(vec3Schema).min(1),
      }),
    )
    .min(3)
    .max(4),
});
export type AssaultLayout = z.infer<typeof assaultLayoutSchema>;

/** Układ Kradzieży rdzenia na dużej arenie: baza, ewakuacja i start gracza. */
export const heistLayoutSchema = z.object({
  playerSpawn: vec3Schema,
  base: vec3Schema,
  extraction: vec3Schema,
  spawnPoints: z.array(vec3Schema).min(1),
});
export type HeistLayout = z.infer<typeof heistLayoutSchema>;

export const arenaSchema = z.object({
  exclusive: z.boolean().optional(),
  maxAlive: positive.int().max(tuning.modes.conquest.maxAlive).optional(),
  enemyTickets: positive.int().optional(),
  water: z
    .object({
      shoreZ: finite,
      y: finite,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .optional(),
  spawnRing: z
    .object({ minM: nonnegative, maxM: positive })
    .refine(({ minM, maxM }) => maxM > minM)
    .optional(),
  spawnPoints: z
    .array(z.object({ x: finite, y: finite.optional(), z: finite }))
    .min(4)
    .optional(),
  points: capturePointsSchema,
  assault: assaultLayoutSchema.optional(),
  heist: heistLayoutSchema.optional(),
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

const puzzleObjectSchema = z.object({
  position: vec3Schema,
  size: positiveVec3Schema,
  massKg: positive,
});

const puzzleWorkAreaSchema = z
  .object({
    kind: z.literal('box'),
    position: vec3Schema,
    size: positiveVec3Schema,
  })
  .optional();

const grabPuzzleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('plate'),
    object: puzzleObjectSchema,
    position: vec3Schema,
    radiusM: positive,
    workArea: puzzleWorkAreaSchema,
  }),
  z.object({
    kind: z.literal('laser'),
    object: puzzleObjectSchema,
    laserId: z.string().min(1),
    workArea: puzzleWorkAreaSchema,
  }),
]);
export type GrabPuzzleDefinition = z.infer<typeof grabPuzzleSchema>;

/** Definicja pokoju z src/data/rooms/*.json (ADR 0005 pkt 2). */
export const roomSchema = z
  .object({
    ...dressingFields,
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(NODE_TYPES),
    playerSpawn: vec3Schema,
    panoramaDropM: nonnegative.optional(),
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
    puzzle: grabPuzzleSchema.optional(),
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
    validatePuzzle(room, ctx);
    validateLayout(room, ctx);
  });

export type RoomDefinition = z.infer<typeof roomSchema>;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export const FLOOR_EPSILON_M = 1e-6;

function footprint(block: z.infer<typeof roomBlockSchema>): Rect {
  // Układ walidacji używa prostokątów. Ćwierćobrót zachowuje ten kształt dokładnie.
  const yaw = block.rotation?.y ?? 0;
  const quarterTurn =
    !block.rotation?.x && !block.rotation?.z && Math.abs(Math.cos(yaw)) < 1e-5;
  const width = quarterTurn ? block.size.z : block.size.x;
  const depth = quarterTurn ? block.size.x : block.size.z;
  return {
    minX: block.position.x - width / 2,
    maxX: block.position.x + width / 2,
    minZ: block.position.z - depth / 2,
    maxZ: block.position.z + depth / 2,
  };
}

function contains(rect: Rect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

/** Minimalny odstęp obrysu obiektu zagadki od punktu startu gracza (walidacja danych). */
const PUZZLE_SPAWN_MARGIN_M = 0.5;

function validatePuzzle(room: RoomDefinition, ctx: z.RefinementCtx): void {
  const issue = (message: string) =>
    ctx.addIssue({ code: 'custom', path: ['puzzle'], message });
  const puzzle = room.puzzle;
  if ((room.type === 'puzzle') !== (puzzle !== undefined))
    issue('Pokój puzzle wymaga definicji zagadki i tylko on może ją zawierać.');
  if (!puzzle) return;
  const groundY = room.playerSpawn.y;
  const onFloor = (point: { x: number; z: number }) =>
    room.blocks.some(
      (block) =>
        Math.abs(block.position.y + block.size.y / 2 - groundY) <=
          FLOOR_EPSILON_M && contains(footprint(block), point.x, point.z),
    );
  if (
    !onFloor(puzzle.object.position) ||
    puzzle.object.position.y - puzzle.object.size.y / 2 <
      groundY - FLOOR_EPSILON_M
  )
    issue('Obiekt zagadki musi zaczynać nad podłogą.');
  const { position: at, size } = puzzle.object;
  const objectRect = {
    minX: at.x - size.x / 2,
    maxX: at.x + size.x / 2,
    minZ: at.z - size.z / 2,
    maxZ: at.z + size.z / 2,
  };
  const overlapsObstacle = room.blocks.some((block) => {
    const rect = footprint(block);
    return (
      block.position.y + block.size.y / 2 > groundY + FLOOR_EPSILON_M &&
      block.position.y - block.size.y / 2 < at.y + size.y / 2 &&
      rect.minX < objectRect.maxX &&
      rect.maxX > objectRect.minX &&
      rect.minZ < objectRect.maxZ &&
      rect.maxZ > objectRect.minZ
    );
  });
  if (overlapsObstacle) issue('Obiekt zagadki nachodzi na blok układu.');
  if (
    contains(
      {
        minX: objectRect.minX - PUZZLE_SPAWN_MARGIN_M,
        maxX: objectRect.maxX + PUZZLE_SPAWN_MARGIN_M,
        minZ: objectRect.minZ - PUZZLE_SPAWN_MARGIN_M,
        maxZ: objectRect.maxZ + PUZZLE_SPAWN_MARGIN_M,
      },
      room.playerSpawn.x,
      room.playerSpawn.z,
    )
  )
    issue('Obiekt zagadki jest zbyt blisko punktu startu gracza.');
  const { workArea } = puzzle;
  if (workArea && !insideLevelZone(at, workArea))
    issue('Strefa robocza musi obejmować środek obiektu na starcie.');
  if (puzzle.kind === 'plate') {
    if (
      !onFloor(puzzle.position) ||
      Math.abs(puzzle.position.y - groundY) > FLOOR_EPSILON_M
    )
      issue('Płyta naciskowa musi leżeć na podłodze.');
    const goal = { ...puzzle.position, y: groundY + size.y / 2 };
    if (workArea && !insideLevelZone(goal, workArea))
      issue('Tor wagowy musi obejmować środek skrzyni na płycie.');
  } else {
    const laser = room.hazards?.find((hazard) => hazard.id === puzzle.laserId);
    if (
      laser?.kind !== 'laser_gate' ||
      (laser.from.x === laser.to.x &&
        laser.from.y === laser.to.y &&
        laser.from.z === laser.to.z)
    ) {
      issue('Zagadka laserowa wymaga wskazania bramki o różnych końcach.');
    } else if (workArea) {
      const beam = sub(laser.to, laser.from);
      const distance = length(beam);
      const hit = rayAabbDistance(
        laser.from,
        scale(beam, 1 / distance),
        workArea,
      );
      if (hit === null || hit > distance)
        issue('Strefa robocza osłony musi przecinać odcinek wiązki.');
    }
  }
}

/** Pełne pokrycie komórki, także gdy szew dwóch płyt przecina jej wnętrze. */
function supportedCell(floors: Rect[], x: number, z: number): boolean {
  if (floors.some((r) => contains(r, x, z) && contains(r, x + 1, z + 1)))
    return true;
  const tiles = floors.filter(
    (r) => r.minX < x + 1 && r.maxX > x && r.minZ < z + 1 && r.maxZ > z,
  );
  if (!tiles.length) return false;
  const cuts = [
    x,
    x + 1,
    ...tiles.flatMap((r) => [Math.max(x, r.minX), Math.min(x + 1, r.maxX)]),
  ].sort((a, b) => a - b);
  tiles.sort((a, b) => a.minZ - b.minZ);
  for (let i = 1; i < cuts.length; i++) {
    const left = cuts[i - 1]!,
      right = cuts[i]!;
    if (right - left <= FLOOR_EPSILON_M) continue;
    let end = z;
    for (const r of tiles) {
      if (r.minX > left || r.maxX < right) continue;
      if (r.minZ > end + FLOOR_EPSILON_M) break;
      end = Math.max(end, r.maxZ);
    }
    if (end < z + 1 - FLOOR_EPSILON_M) return false;
  }
  return true;
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
    .filter(
      (block) =>
        Math.abs(block.position.y + block.size.y / 2 - groundY) <=
        FLOOR_EPSILON_M,
    )
    .map(footprint);
  const obstacles = room.blocks
    .filter(
      (block) =>
        block.position.y - block.size.y / 2 <= groundY + FLOOR_EPSILON_M &&
        block.position.y + block.size.y / 2 > groundY + FLOOR_EPSILON_M,
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
    supportedCell(floors, x, z) &&
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
