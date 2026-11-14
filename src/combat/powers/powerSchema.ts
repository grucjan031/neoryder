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

const timedPowerFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  cost: z.number().finite().nonnegative(),
  cooldownS: z.number().finite().nonnegative(),
  durationS: z.number().finite().positive(),
  tags: z.array(z.string().startsWith('#')),
};
export const focusPowerSchema = z.object({
  ...timedPowerFields,
  kind: z.literal('focus'),
  worldScale: z.number().finite().positive().max(1),
  drainPerS: z.number().finite().nonnegative(),
});
export type FocusPowerDefinition = z.infer<typeof focusPowerSchema> & {
  readonly knockback?: undefined;
};
export const barrierPowerSchema = z.object({
  ...timedPowerFields,
  kind: z.literal('barrier'),
  arcDeg: z.number().finite().positive().max(360),
  costPerReflect: z.number().finite().nonnegative(),
});
export type BarrierPowerDefinition = z.infer<typeof barrierPowerSchema> & {
  readonly knockback?: undefined;
};
export const grabPowerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.literal('grab'),
  cost: z.number().finite().nonnegative(),
  cooldownS: z.number().finite().nonnegative(),
  aimConeDeg: z.number().finite().positive().max(360),
  rangeM: z.number().finite().positive(),
  maxMassKg: z.number().finite().positive(),
  drainPerS: z.number().finite().nonnegative(),
  maxHoldS: z.number().finite().positive(),
  holdDistanceM: z.number().finite().positive(),
  throwSpeed: z.number().finite().positive(),
  minImpactSpeed: z.number().finite().nonnegative(),
  impactDamage: z.number().finite().nonnegative(),
  landingNormalY: z.number().finite().positive().max(1),
  landingSpeedMps: z.number().finite().positive(),
  tags: z.array(z.string().startsWith('#')),
});
export type GrabPowerDefinition = z.infer<typeof grabPowerSchema> & {
  readonly knockback?: undefined;
};

export const powerSchema = z.discriminatedUnion('kind', [
  conePowerSchema,
  chainPowerSchema,
  focusPowerSchema,
  barrierPowerSchema,
  grabPowerSchema,
]);
export type PowerDefinition =
  | ConePowerDefinition
  | ChainPowerDefinition
  | FocusPowerDefinition
  | BarrierPowerDefinition
  | GrabPowerDefinition;
