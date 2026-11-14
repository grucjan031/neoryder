import { z } from 'zod';
import bladeData from '../../data/weapons/plasmaBlade.json';

const strikeSchema = z.object({
  damage: z.number().finite().nonnegative(),
  /** Impuls odrzutu (N·s) przekazywany w DamageInfo.knockback. */
  knockback: z.number().finite().nonnegative(),
  /** Zasięg łuku cięcia od oczu gracza (m). */
  reach: z.number().finite().positive(),
  /** Szerokość łuku (m). */
  width: z.number().finite().positive(),
});

export const bladeSchema = z.object({
  id: z.string().min(1),
  combo: z.array(strikeSchema).min(1).max(5),
  heavy: strikeSchema,
  throw: z
    .object({
      damage: z.number().finite().nonnegative(),
      speed: z.number().finite().positive(),
      rangeM: z.number().finite().positive(),
      radiusM: z.number().finite().positive(),
      returnSpeed: z.number().finite().positive(),
    })
    .optional(),
  dashCut: z
    .object({
      damage: z.number().finite().nonnegative(),
      widthM: z.number().finite().positive(),
      knockback: z.number().finite().nonnegative(),
    })
    .optional(),
  /** Mnożnik otrzymywanych obrażeń w bloku (0.3 = −70%). */
  blockDamageMult: z.number().finite().min(0).max(1),
  /** Energia zużywana przez każdy zablokowany cios: stała + proporcjonalna do obrażeń. */
  blockEnergyPerHit: z.number().finite().nonnegative(),
  blockEnergyPerDamage: z.number().finite().nonnegative(),
  tags: z.array(z.string().startsWith('#')),
});
export type BladeDefinition = z.infer<typeof bladeSchema>;
export type StrikeDefinition = z.infer<typeof strikeSchema>;

export function loadBlade(data: unknown): BladeDefinition {
  const result = bladeSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane ostrza: ${result.error.message}`);
  return result.data;
}

export const plasmaBladeDefinition = loadBlade(bladeData);
