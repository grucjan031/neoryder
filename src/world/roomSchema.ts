import { z } from 'zod';
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

/** Definicja pokoju z src/data/rooms/*.json (ADR 0005 pkt 2). Walidacja przestrzenna w zadaniu F3-03. */
export const roomSchema = z
  .object({
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
    props: z.array(roomPropSchema).optional(),
    puzzle: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((room, ctx) => {
    const hasEntry = room.doors.some((door) => door.role === 'entry');
    if (!hasEntry)
      ctx.addIssue({
        code: 'custom',
        path: ['doors'],
        message: 'Pokój wymaga drzwi wejściowych (entry).',
      });
    const hasExit = room.doors.some((door) => door.role === 'exit');
    if (room.type !== 'boss' && !hasExit)
      ctx.addIssue({
        code: 'custom',
        path: ['doors'],
        message: 'Pokój typu innego niż boss wymaga drzwi wyjściowych (exit).',
      });
  });

export type RoomDefinition = z.infer<typeof roomSchema>;

export function loadRoom(data: unknown): RoomDefinition {
  return roomSchema.parse(data);
}
export const loadRoomDefinition = loadRoom;
