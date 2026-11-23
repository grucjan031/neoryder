import { z } from 'zod';
import { NODE_TYPES } from '../core/runTypes';
import { vec3Schema, type RoomDefinition } from './roomSchema';
import { layerTypeWeightsSchema } from './sectorSchema';

const id = z.string().min(1);
const positive = z.number().finite().positive();
const count = z.number().int().nonnegative();
const base = { id, label: id };
export const dialogueLineSchema = z.object({
  speaker: z.enum([
    'szron',
    'mira',
    'bajt',
    'tomasz',
    'ida',
    'wolan',
    'nadia',
    'tymon',
    'brandt',
  ]),
  text: id,
  shortText: id.optional(),
});
export const RADIO_PRIORITIES = ['tactical', 'story'] as const;
export type RadioPriority = (typeof RADIO_PRIORITIES)[number];
/**
 * Wyzwalacze radia. `enterSection`, `encounter` i `checkpoint` zgłasza wyłącznie scena
 * misji liniowej (id sekcji, spotkania i punktu kontrolnego poziomu).
 */
export const RADIO_TRIGGER =
  /^(runStart|objectivesDone|boss:phase:[23]|boss:defeated|enterNode:[1-9]\d*|enterSection:[^:\s]+|encounter:[^:\s]+:(started|done)|checkpoint:[^:\s]+|objective:[^:]+:(started|done|paused|progress:(100|[1-9]?\d)))$/;
export const missionObjectiveSchema = z.discriminatedUnion('kind', [
  z.object({
    ...base,
    kind: z.literal('subdue'),
    targetName: id,
    hpFraction: z.number().finite().gt(0).lt(1),
    neutralizeWith: id,
    timeLimitS: positive,
  }),
  z.object({
    ...base,
    kind: z.literal('reach'),
    position: vec3Schema,
    radiusM: positive,
    timeLimitS: positive,
  }),
  z.object({
    ...base,
    kind: z.literal('sabotage'),
    position: vec3Schema,
    holdS: positive,
    fuseS: positive,
    blastRadiusM: positive,
    blastDamage: positive,
    reinforcements: id.optional(),
  }),
  z.object({
    ...base,
    kind: z.literal('pickup'),
    spawnAfter: id,
    offset: vec3Schema,
  }),
  z.object({
    ...base,
    kind: z.literal('exit'),
    position: vec3Schema,
    holdS: positive,
    unlockAfter: z.array(id),
  }),
  z.object({
    ...base,
    kind: z.literal('interact'),
    position: vec3Schema,
    holdS: positive,
    unlockAfter: z.array(id),
  }),
  z.object({
    ...base,
    kind: z.literal('defend'),
    position: vec3Schema,
    radiusM: positive,
    durationS: positive,
    holdS: z.number().finite().nonnegative().default(0),
    waves: z
      .array(
        z.object({
          atProgress: z.number().finite().gt(0).max(1),
          wave: id,
        }),
      )
      .optional(),
  }),
  z.object({ ...base, kind: z.literal('killBoss') }),
  z.object({ ...base, kind: z.literal('escortPayload') }),
]);
export const missionSchema = z
  .object({
    id,
    number: z.number().int().positive(),
    title: id,
    summary: id,
    act: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    sectorId: id,
    level: id.optional(),
    requires: z.array(id),
    layers: z.number().int().positive(),
    typeWeights: z.array(layerTypeWeightsSchema).optional(),
    roomPools: z
      .array(
        z.object({
          fromLayer: z.number().int().positive(),
          toLayer: z.number().int().positive(),
          type: z.enum(NODE_TYPES),
          rooms: z.array(id).min(1),
        }),
      )
      .optional(),
    enemies: z.array(id).min(1).optional(),
    fixedNodes: z
      .array(
        z.object({
          layer: z.number().int().positive(),
          type: z.enum(NODE_TYPES),
          roomId: id,
          objectives: z.array(id),
          final: z.boolean().optional(),
          guards: z
            .array(
              z.object({
                enemy: id,
                count: z.number().int().positive(),
                nearObjective: id.optional(),
                position: vec3Schema.optional(),
                radiusM: positive,
              }),
            )
            .optional(),
        }),
      )
      .min(1),
    objectives: z.array(missionObjectiveSchema),
    interlude: z
      .object({ title: id, lines: z.array(dialogueLineSchema).min(1) })
      .optional(),
    briefing: z.array(dialogueLineSchema),
    debrief: z.array(dialogueLineSchema),
    radio: z.array(
      z.object({
        trigger: z.string().regex(RADIO_TRIGGER),
        /** `story` czeka na spokój (brak aktywnych spotkań); brak pola = `tactical`, od razu. */
        priority: z.enum(RADIO_PRIORITIES).optional(),
        lines: z.array(dialogueLineSchema).min(1),
      }),
    ),
    rewards: z.object({
      firstClear: z.object({ data: count, cores: count.optional() }),
    }),
    splashAct: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional(),
  })
  .superRefine((mission, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const objectives = new Map(
      mission.objectives.map((objective) => [objective.id, objective]),
    );
    if (!mission.level && mission.objectives.some((o) => o.kind === 'reach'))
      fail(
        'Cel reach wymaga poziomu liniowego z obsługą powrotu do checkpointu.',
      );
    if (objectives.size !== mission.objectives.length)
      fail('Powtórzone id celu.');
    for (const objective of mission.objectives) {
      if (objective.kind !== 'subdue') continue;
      const capture = objectives.get(objective.neutralizeWith);
      if (
        !mission.level ||
        capture?.kind !== 'interact' ||
        !capture.unlockAfter.includes(objective.id)
      )
        fail('Subdue wymaga poziomu i interakcji zależnej od pojmania.');
    }
    if (mission.fixedNodes.filter((node) => node.final).length !== 1)
      fail('Misja wymaga dokładnie jednego węzła final.');
    const layers = new Set<number>();
    const assigned = new Set<string>();
    for (const node of mission.fixedNodes) {
      if (node.layer > mission.layers || layers.has(node.layer))
        fail('Nieprawidłowa lub powtórzona warstwa stała.');
      layers.add(node.layer);
      for (const objective of node.objectives) {
        if (!objectives.has(objective) || assigned.has(objective))
          fail(`Nieprawidłowe przypisanie celu: ${objective}.`);
        assigned.add(objective);
      }
      for (const guard of node.guards ?? []) {
        if (
          (guard.nearObjective === undefined) ===
          (guard.position === undefined)
        )
          fail('Osłona wymaga dokładnie jednego punktu: celu lub pozycji.');
        if (
          guard.nearObjective &&
          !node.objectives.includes(guard.nearObjective)
        )
          fail('Osłona wymaga celu bieżącego węzła.');
        if (mission.enemies && !mission.enemies.includes(guard.enemy))
          fail('Osłona spoza listy wrogów misji.');
      }
    }
    for (const objective of objectives.keys())
      if (!assigned.has(objective)) fail(`Cel bez pokoju: ${objective}.`);
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (key: string): void => {
      if (visiting.has(key)) {
        fail('Cykl zależności celów.');
        return;
      }
      if (visited.has(key)) return;
      const objective = objectives.get(key);
      if (!objective) {
        fail(`Nieznany cel: ${key}.`);
        return;
      }
      visiting.add(key);
      const deps =
        objective.kind === 'pickup'
          ? [objective.spawnAfter]
          : objective.kind === 'exit' || objective.kind === 'interact'
            ? objective.unlockAfter
            : [];
      for (const dependency of deps) visit(dependency);
      visiting.delete(key);
      visited.add(key);
    };
    for (const key of objectives.keys()) visit(key);
    for (const pool of mission.roomPools ?? []) {
      if (pool.fromLayer > pool.toLayer || pool.toLayer > mission.layers)
        fail('Pula pokojów poza zakresem warstw.');
      if (
        (mission.roomPools ?? []).some(
          (other) =>
            other !== pool &&
            other.type === pool.type &&
            other.fromLayer <= pool.toLayer &&
            other.toLayer >= pool.fromLayer,
        )
      )
        fail('Nakładające się pule pokojów.');
    }
  });
export type MissionDefinition = z.infer<typeof missionSchema>;
export type MissionObjective = z.infer<typeof missionObjectiveSchema>;
export type DialogueLine = z.infer<typeof dialogueLineSchema>;

export function loadMission(
  data: unknown,
  rooms: ReadonlyMap<string, RoomDefinition>,
): MissionDefinition {
  const mission = missionSchema.parse(data);
  const check = (roomId: string, type: string) => {
    const room = rooms.get(roomId);
    if (!room || room.type !== type)
      throw new Error(`Nieprawidłowy pokój misji: ${roomId} (${type}).`);
  };
  for (const node of mission.fixedNodes) check(node.roomId, node.type);
  for (const pool of mission.roomPools ?? [])
    for (const room of pool.rooms) check(room, pool.type);
  return mission;
}
