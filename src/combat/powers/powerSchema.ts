import { z } from 'zod';

export const conePowerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('cone'),
  cost: z.number().finite().nonnegative(),
  cooldownS: z.number().finite().nonnegative(),
  /** Pełny kąt stożka; 360° pomija filtr kierunku. */
  coneAngleDeg: z.number().finite().positive().max(360),
  range: z.number().finite().positive(),
  knockback: z.number().finite().nonnegative(),
  knockbackLift: z.number().finite().nonnegative(),
  damage: z.number().finite().nonnegative(),
  wallSlamDamage: z.number().finite().nonnegative(),
  wallSlamRange: z.number().finite().positive(),
  shakeDurationS: z.number().finite().nonnegative(),
  tags: z.array(z.string().startsWith('#')),
});
export type ConePowerDefinition = z.infer<typeof conePowerSchema>;

export const powerSchema = z.discriminatedUnion('kind', [conePowerSchema]);
export type PowerDefinition = z.infer<typeof powerSchema>;
