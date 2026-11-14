import { z } from 'zod';

const statusApplicationSchema = z.object({
  id: z.string().min(1),
  durationS: z.number().finite().positive(),
  stacks: z.number().int().positive().optional(),
});

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

export const chainPowerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('chain'),
  cost: z.number().finite().nonnegative(),
  cooldownS: z.number().finite().nonnegative(),
  rangeM: z.number().finite().positive(),
  coneDeg: z.number().finite().positive().max(360),
  jumps: z.number().int().nonnegative(),
  jumpRangeM: z.number().finite().positive(),
  damage: z.number().finite().nonnegative(),
  falloff: z.number().finite().min(0).max(1),
  tags: z.array(z.string().startsWith('#')),
  statuses: z.array(statusApplicationSchema).optional(),
  vfx: z.object({
    arcLifeS: z.number().finite().positive(),
    jitterM: z.number().finite().nonnegative(),
    segments: z.number().int().positive(),
  }),
});
export type ChainPowerDefinition = z.infer<typeof chainPowerSchema> & {
  readonly knockback?: undefined;
};

export const powerSchema = z.discriminatedUnion('kind', [
  conePowerSchema,
  chainPowerSchema,
]);
export type PowerDefinition = ConePowerDefinition | ChainPowerDefinition;
