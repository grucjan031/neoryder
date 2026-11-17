import { z } from 'zod';

export const ambienceKindSchema = z.enum([
  'fire',
  'generator',
  'drip',
  'steam',
  'screens',
  'crowd',
  'radio',
  'jukebox',
  'cooking',
  'purr',
]);
export type AmbienceKind = z.infer<typeof ambienceKindSchema>;
export const ambienceSourceSchema = z
  .object({
    kind: ambienceKindSchema,
    position: z
      .object({
        x: z.number().finite(),
        y: z.number().finite(),
        z: z.number().finite(),
      })
      .strict(),
    radiusM: z.number().finite().positive(),
    gain: z.number().finite().nonnegative().optional(),
  })
  .strict();
export type AmbienceSource = z.infer<typeof ambienceSourceSchema>;
export const ambienceSchema = z
  .object({ sources: z.array(ambienceSourceSchema) })
  .strict();
export function loadAmbience(data: unknown): z.infer<typeof ambienceSchema> {
  return ambienceSchema.parse(data);
}
