import { z } from 'zod';
import {
  roomSchema,
  roomBlockSchema,
  vec3Schema,
  positiveVec3Schema,
} from './roomSchema';
import type { MissionDefinition } from './missionSchema';
import { wavesSchema, type WavesDefinition } from './waves';
import { allyDefinitions } from '../allies/allySchema';

const id = z.string().min(1);
export const levelZoneSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('box'),
    position: vec3Schema,
    size: positiveVec3Schema,
  }),
  z.object({
    kind: z.literal('sphere'),
    position: vec3Schema,
    radiusM: z.number().finite().positive(),
  }),
]);
const dependency = z.object({ kind: z.enum(['objective', 'encounter']), id });
/**
 * Sojusznik na poziomie: `id` z `src/data/allies`, `spawn` to stopy. Bez `joinAfter` dołącza
 * na starcie; z nim dopiero po ukończeniu celu albo spotkania.
 */
export const levelAllySchema = z.object({
  id,
  spawn: vec3Schema,
  joinAfter: dependency.optional(),
});
export type LevelAlly = z.infer<typeof levelAllySchema>;

// Pola i geometria pochodzą z pokoju; poziom nie ma semantyki drzwi entry/exit.
export const levelSchema = z
  .object(roomSchema.shape)
  .omit({ doors: true, bossEnemy: true, puzzle: true })
  .extend({
    objectiveOrder: z.array(id).min(1),
    objectivePositions: z.record(id, vec3Schema),
    /** Dodatkowy warunek celu, np. osłona musi zginąć przed zabraniem karty. */
    objectiveAfter: z
      .record(id, z.object({ kind: z.literal('encounter'), id }))
      .optional(),
    /** Neutralna postać przy celu: bez AI walki, hurtboxa i slotu drużyny. */
    objectiveNpcs: z
      .array(
        z.object({
          objective: id,
          spawn: vec3Schema,
          yawDeg: z.number().finite(),
        }),
      )
      .optional(),
    payload: z
      .object({
        objective: id,
        route: z.array(vec3Schema).min(2),
        stops: z.array(
          z.object({
            id,
            name: id,
            atM: z.number().finite().positive(),
            unlockAfter: id,
          }),
        ),
      })
      .optional(),
    sections: z
      .array(
        z.object({ id, name: id, zone: levelZoneSchema, radio: id.optional() }),
      )
      .min(1),
    encounters: z.array(
      z.object({
        id,
        zone: levelZoneSchema,
        wave: id,
        spawnPoints: wavesSchema.shape.spawnPoints,
        spawnHeightM: z.number().finite().optional(),
        after: dependency.optional(),
        reinforcementFor: id.optional(),
        /** Spotkanie z bossem: jego ukończenie kończy wskazany cel `killBoss`. */
        bossFor: id.optional(),
      }),
    ),
    checkpoints: z
      .array(
        z.object({
          id,
          position: vec3Schema,
          yawDeg: z.number().finite(),
          payloadDistanceM: z.number().finite().nonnegative().optional(),
          zone: levelZoneSchema,
          after: dependency.optional(),
        }),
      )
      .min(1),
    gates: z.array(
      z.object({
        id,
        block: roomBlockSchema,
        after: dependency,
        /** Brama zamyka się ponownie na czas aktywnego spotkania (arena bossa). */
        closedDuring: id.optional(),
      }),
    ),
    allies: z.array(levelAllySchema).optional(),
  })
  .superRefine((level, ctx) => {
    const checkUnique = (ids: string[], path: string) => {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: 'custom',
          path: [path],
          message: 'Powtórzone id.',
        });
    };
    checkUnique(level.objectiveOrder, 'objectiveOrder');
    for (const key of [
      'sections',
      'encounters',
      'checkpoints',
      'gates',
    ] as const)
      checkUnique(
        level[key].map((entry) => entry.id),
        key,
      );
    const known = (entry: z.infer<typeof dependency>) =>
      entry.kind === 'objective'
        ? level.objectiveOrder.includes(entry.id)
        : level.encounters.some((encounter) => encounter.id === entry.id);
    for (const entry of [
      ...level.encounters,
      ...level.checkpoints,
      ...level.gates,
    ])
      if (entry.after && !known(entry.after))
        ctx.addIssue({
          code: 'custom',
          message: `Nieznana zależność: ${entry.after.id}`,
        });
    checkUnique(
      (level.allies ?? []).map((ally) => ally.id),
      'allies',
    );
    for (const ally of level.allies ?? [])
      if (ally.joinAfter && !known(ally.joinAfter))
        ctx.addIssue({
          code: 'custom',
          path: ['allies'],
          message: `Nieznana zależność sojusznika: ${ally.joinAfter.id}`,
        });
    for (const [objective, after] of Object.entries(level.objectiveAfter ?? {}))
      if (!level.objectiveOrder.includes(objective) || !known(after))
        ctx.addIssue({
          code: 'custom',
          message: `Nieznana zależność celu: ${objective}`,
        });
    for (const npc of level.objectiveNpcs ?? [])
      if (!level.objectiveOrder.includes(npc.objective))
        ctx.addIssue({
          code: 'custom',
          message: `Nieznany cel postaci: ${npc.objective}`,
        });
    for (const gate of level.gates)
      if (
        gate.closedDuring &&
        !level.encounters.some((item) => item.id === gate.closedDuring)
      )
        ctx.addIssue({
          code: 'custom',
          message: `Nieznane spotkanie bramy: ${gate.closedDuring}`,
        });
    for (const objective of level.objectiveOrder)
      if (!level.objectivePositions[objective])
        ctx.addIssue({
          code: 'custom',
          path: ['objectivePositions'],
          message: `Brak pozycji celu: ${objective}`,
        });
    for (const encounter of level.encounters) {
      if (
        encounter.reinforcementFor &&
        // Klucz posiłków: id celu sabotage albo `<id celu defend>:<indeks fali>`.
        !level.objectiveOrder.includes(
          encounter.reinforcementFor.split(':')[0]!,
        )
      )
        ctx.addIssue({
          code: 'custom',
          message: `Nieznany cel posiłków: ${encounter.reinforcementFor}`,
        });
      if (
        encounter.bossFor &&
        !level.objectiveOrder.includes(encounter.bossFor)
      )
        ctx.addIssue({
          code: 'custom',
          message: `Nieznany cel bossa: ${encounter.bossFor}`,
        });
      const seen = new Set([encounter.id]);
      let after = encounter.after;
      while (after?.kind === 'encounter') {
        if (seen.has(after.id)) {
          ctx.addIssue({ code: 'custom', message: 'Cykl zależności spotkań.' });
          break;
        }
        seen.add(after.id);
        after = level.encounters.find((item) => item.id === after!.id)?.after;
      }
    }
  });

export type LevelDefinition = z.infer<typeof levelSchema>;
export type LevelZone = z.infer<typeof levelZoneSchema>;
export type LevelDependency = z.infer<typeof dependency>;

export function loadLevel(
  data: unknown,
  mission: MissionDefinition,
  waves: ReadonlyMap<string, WavesDefinition>,
): LevelDefinition {
  const level = levelSchema.parse(data);
  if (level.payload) {
    const payload = level.payload;
    if (
      mission.objectives.find((o) => o.id === payload.objective)?.kind !==
      'escortPayload'
    )
      throw new Error('Wagon wymaga celu escortPayload.');
    let length = 0;
    for (let i = 1; i < payload.route.length; i++) {
      const a = payload.route[i - 1]!,
        b = payload.route[i]!;
      const span = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (span <= 0) throw new Error('Powtórzony punkt trasy wagonu.');
      length += span;
    }
    let previous = 0;
    const seen = new Set<string>();
    for (const stop of payload.stops) {
      if (
        seen.has(stop.id) ||
        stop.atM <= previous ||
        stop.atM >= length ||
        !level.objectiveOrder.includes(stop.unlockAfter) ||
        level.objectiveOrder.indexOf(stop.unlockAfter) >=
          level.objectiveOrder.indexOf(payload.objective)
      )
        throw new Error('Nieprawidłowy postój wagonu.');
      seen.add(stop.id);
      previous = stop.atM;
    }
    for (const point of level.checkpoints)
      if (
        point.payloadDistanceM === undefined ||
        point.payloadDistanceM > length
      )
        throw new Error('Checkpoint wymaga dystansu na trasie wagonu.');
  } else if (mission.objectives.some((o) => o.kind === 'escortPayload')) {
    throw new Error('Cel escortPayload wymaga wagonu poziomu.');
  }
  if (mission.level !== level.id)
    throw new Error('Poziom nie odpowiada misji.');
  if (
    level.objectiveOrder.length !== mission.objectives.length ||
    mission.objectives.some(
      (objective) => !level.objectiveOrder.includes(objective.id),
    )
  )
    throw new Error('Poziom musi zawierać wszystkie cele misji.');
  for (const ally of level.allies ?? [])
    if (!allyDefinitions.has(ally.id))
      throw new Error(`Nieznany sojusznik: ${ally.id}`);
  for (const objective of mission.objectives)
    if (
      objective.kind === 'subdue' &&
      level.encounters.filter((entry) => entry.bossFor === objective.id)
        .length !== 1
    )
      throw new Error('Subdue wymaga dokładnie jednego spotkania bossFor.');
  for (const encounter of level.encounters) {
    if (!waves.has(encounter.wave))
      throw new Error(`Nieznana fala: ${encounter.wave}`);
    if (encounter.reinforcementFor) {
      const [objectiveId, index] = encounter.reinforcementFor.split(':');
      const objective = mission.objectives.find(
        (item) => item.id === objectiveId,
      );
      const wave =
        objective?.kind === 'sabotage' && index === undefined
          ? objective.reinforcements
          : objective?.kind === 'defend' && index !== undefined
            ? objective.waves?.[Number(index)]?.wave
            : undefined;
      if (wave !== encounter.wave)
        throw new Error('Posiłki nie odpowiadają celowi misji.');
    }
    if (encounter.bossFor) {
      const objective = mission.objectives.find(
        (item) => item.id === encounter.bossFor,
      );
      if (objective?.kind !== 'killBoss' && objective?.kind !== 'subdue')
        throw new Error('Spotkanie bossa wymaga celu killBoss lub subdue.');
      if (objective.kind === 'subdue') {
        const groups = waves
          .get(encounter.wave)!
          .waves.flatMap((wave) => wave.groups);
        if (
          groups.length !== 1 ||
          groups[0]!.count !== 1 ||
          level.objectiveOrder.indexOf(objective.neutralizeWith) !==
            level.objectiveOrder.indexOf(objective.id) + 1
        )
          throw new Error(
            'Subdue wymaga jednego celu i opaski bezpośrednio po nim.',
          );
      }
    }
  }
  // Reużycie walidacji osiągalności pokoju także dla celów, checkpointów i spawnów.
  roomSchema.parse({
    ...level,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: level.playerSpawn,
        size: { x: 1, y: 1, z: 1 },
      },
      {
        id: 'exit',
        role: 'exit',
        position: level.playerSpawn,
        size: { x: 1, y: 1, z: 1 },
      },
    ],
    spawnPoints: [
      ...level.spawnPoints,
      ...Object.values(level.objectivePositions),
      ...level.checkpoints.map((point) => point.position),
      ...level.encounters.flatMap((encounter) => encounter.spawnPoints),
      ...(level.allies ?? []).map((ally) => ally.spawn),
      ...(level.objectiveNpcs ?? []).map((npc) => npc.spawn),
      ...(level.payload?.route ?? []),
    ],
  });
  return level;
}
