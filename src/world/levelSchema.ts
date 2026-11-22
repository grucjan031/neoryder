import { z } from 'zod';
import {
  roomSchema,
  roomBlockSchema,
  vec3Schema,
  positiveVec3Schema,
} from './roomSchema';
import type { MissionDefinition } from './missionSchema';
import { wavesSchema, type WavesDefinition } from './waves';

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

// Pola i geometria pochodzą z pokoju; poziom nie ma semantyki drzwi entry/exit.
export const levelSchema = z
  .object(roomSchema.shape)
  .omit({ doors: true, bossEnemy: true, puzzle: true })
  .extend({
    objectiveOrder: z.array(id).min(1),
    objectivePositions: z.record(id, vec3Schema),
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
  if (mission.level !== level.id)
    throw new Error('Poziom nie odpowiada misji.');
  if (
    level.objectiveOrder.length !== mission.objectives.length ||
    mission.objectives.some(
      (objective) => !level.objectiveOrder.includes(objective.id),
    )
  )
    throw new Error('Poziom musi zawierać wszystkie cele misji.');
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
    if (
      encounter.bossFor &&
      mission.objectives.find((item) => item.id === encounter.bossFor)?.kind !==
        'killBoss'
    )
      throw new Error('Spotkanie bossa wymaga celu killBoss.');
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
    ],
  });
  return level;
}
