import { z } from 'zod';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
export const enemySchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  maxHealth: positive,
  moveSpeed: positive,
  turnRateDegS: positive,
  attackRange: positive,
  telegraphS: positive,
  swingActiveS: positive,
  recoveryS: nonnegative,
  cooldownS: nonnegative,
  damage: nonnegative,
  knockbackResist: z.number().min(0).max(1),
  stunOnHeavyS: positive,
  repathJitter: nonnegative,
  body: z
    .object({
      height: positive,
      halfHeight: positive,
      radius: positive,
      centerY: positive,
      headY: positive,
      headRadius: positive,
      headMultiplier: positive,
      controllerOffset: positive,
      knockbackDamping: positive,
      attackHalfWidth: positive,
      attackHalfHeight: positive,
    })
    .refine(
      (body) => body.height >= body.radius * 2,
      'Wysokość kapsuły musi obejmować średnicę.',
    )
    .optional(),
  animation: z
    .object({
      strideM: positive,
      walkAngle: nonnegative,
      telegraphAngle: z.number().finite(),
      swingAngle: z.number().finite(),
      elbowAngle: z.number().finite(),
      stunAngle: nonnegative,
      pulseHz: positive,
      pulseScale: nonnegative,
    })
    .optional(),
});
export type EnemyDefinition = z.infer<typeof enemySchema>;
