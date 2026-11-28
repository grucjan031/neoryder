import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const positive = z.number().finite().positive();
export const civilianSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  clothingVariants: z
    .array(
      z.object({
        parts: z.array(z.string().min(1)).min(1),
        coatColor: color,
        pantsColor: color,
        accent: z.enum(['#ffae1a', '#6dff4a', '#8a5cff', '#3d7bff', '#fff1d6']),
      }),
    )
    .min(1),
  maxHealth: positive,
  fleeSpeedMps: positive,
  visionRangeM: positive,
  visionAngleDeg: positive.max(360),
  reactionS: z.number().finite().nonnegative(),
});
export type CivilianDefinition = z.infer<typeof civilianSchema>;
const modules = import.meta.glob('../data/civilians/*.json', {
  eager: true,
  import: 'default',
});
export const civilianDefinitions = new Map<string, CivilianDefinition>();
for (const raw of Object.values(modules)) {
  const def = civilianSchema.parse(raw);
  if (civilianDefinitions.has(def.id))
    throw new Error(`Powtórzone id cywila: ${def.id}`);
  civilianDefinitions.set(def.id, def);
}
