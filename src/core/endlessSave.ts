import { z } from 'zod';

const ENDLESS_VERSION = 1;
const scoreSchema = z.strictObject({
  wave: z.int().nonnegative(),
  elapsedS: z.number().nonnegative(),
});
const recordSchema = z.strictObject({
  endlessVersion: z.literal(ENDLESS_VERSION),
  best: scoreSchema,
});

export type EndlessScore = z.infer<typeof scoreSchema>;

export function decodeEndless(raw: unknown) {
  const record = recordSchema.safeParse(raw);
  if (record.success) return { status: 'ok', best: record.data.best } as const;
  if (raw == null) return { status: 'ok', best: null } as const;
  const version = z.object({ endlessVersion: z.int() }).safeParse(raw);
  return {
    status:
      version.success && version.data.endlessVersion > ENDLESS_VERSION
        ? 'future'
        : 'corrupt',
    best: null,
  } as const;
}

export function updateEndlessBest(
  best: EndlessScore | null,
  score: EndlessScore,
) {
  const bestCandidate = scoreSchema.parse(score);
  if (
    best &&
    (best.wave > score.wave ||
      (best.wave === score.wave && best.elapsedS <= score.elapsedS))
  )
    return null;
  return { endlessVersion: ENDLESS_VERSION, best: bestCandidate };
}
