import { z } from 'zod';
import { vec3Schema } from './roomSchema';
import { wavesSchema } from './waves';
import escortData from '../data/prototypes/escortTest.json';
import payloadData from '../data/prototypes/payloadTest.json';

const id = z.string().min(1);

/** Fale prototypów: nazwa → definicja (punkty spawnu leżą w danych, blisko trasy). */
const wavesRecord = z.record(id, wavesSchema);

function checkWaves(
  waves: Record<string, unknown>,
  used: readonly string[],
  ctx: z.RefinementCtx,
): void {
  for (const name of used)
    if (!(name in waves))
      ctx.addIssue({
        code: 'custom',
        message: `Nieznana fala prototypu: ${name}.`,
      });
}

/** S4-03: poziom testowy eskorty więźnia (`?scene=escort-test`). */
export const escortTestSchema = z
  .object({
    id,
    roomId: id,
    /** Stopy więźnia (klęczy do uwolnienia). */
    prisoner: vec3Schema,
    /** Środek strefy ewakuacji (promień: `tuning.prototypes.escort.evacRadiusM`). */
    evacuation: vec3Schema,
    /** Fala startująca w chwili uwolnienia. */
    pursuitWave: id,
    waves: wavesRecord,
  })
  .superRefine((data, ctx) => checkWaves(data.waves, [data.pursuitWave], ctx));
export type EscortTestDefinition = z.infer<typeof escortTestSchema>;

export const payloadStopSchema = z.object({
  id,
  name: id,
  atM: z.number().finite().positive(),
  holdS: z.number().finite().nonnegative(),
  wave: id,
  clearRequired: z.boolean(),
});

/** S4-03: poziom testowy wagonu na trasie (`?scene=payload-test`). */
export const payloadTestSchema = z
  .object({
    id,
    roomId: id,
    route: z.array(vec3Schema).min(2),
    stops: z.array(payloadStopSchema),
    waves: wavesRecord,
  })
  .superRefine((data, ctx) => {
    checkWaves(
      data.waves,
      data.stops.map((s) => s.wave),
      ctx,
    );
    let length = 0;
    for (let i = 1; i < data.route.length; i++) {
      const a = data.route[i - 1]!;
      const b = data.route[i]!;
      length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    let previous = 0;
    for (const stop of data.stops) {
      if (!(stop.atM > previous && stop.atM < length))
        ctx.addIssue({
          code: 'custom',
          message: `Postój ${stop.id}: atM musi rosnąć i mieścić się w trasie (${length.toFixed(1)} m).`,
        });
      previous = stop.atM;
    }
    const ids = new Set(data.stops.map((s) => s.id));
    if (ids.size !== data.stops.length)
      ctx.addIssue({ code: 'custom', message: 'Powtórzone id postoju.' });
  });
export type PayloadTestDefinition = z.infer<typeof payloadTestSchema>;

export function loadEscortTest(data: unknown): EscortTestDefinition {
  const result = escortTestSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowy poziom eskorty: ${result.error.message}`);
  return result.data;
}

export function loadPayloadTest(data: unknown): PayloadTestDefinition {
  const result = payloadTestSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowy poziom wagonu: ${result.error.message}`);
  return result.data;
}

export const escortTest = loadEscortTest(escortData);
export const payloadTest = loadPayloadTest(payloadData);
