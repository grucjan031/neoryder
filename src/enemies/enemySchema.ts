import { z } from 'zod';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
export const gunnerFields = z.object({
  preferredRange: positive,
  rangeTolerance: positive,
  aimTelegraphS: positive,
  burstCount: z.number().int().positive(),
  burstIntervalS: positive,
  projectileSpeed: positive,
  projectileDamage: nonnegative,
  projectileLifetimeS: positive,
  spreadDeg: nonnegative.max(90),
  losRequired: z.boolean(),
  strafeScale: nonnegative.max(1),
  muzzle: z.object({ x: z.number().finite(), y: positive, z: positive }),
});
export const enemySchema = z
  .object({
    ...gunnerFields.partial().shape,
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
    /** F2-12: promień krążenia Szturmowca bez tokenu ataku (większy niż attackRange). */
    flankDistanceM: positive.optional(),
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
        aimAngle: z.number().finite().optional(),
        recoilM: nonnegative.optional(),
        recoilS: positive.optional(),
      })
      .optional(),
  })
  .superRefine((definition, ctx) => {
    if (
      definition.flankDistanceM !== undefined &&
      definition.flankDistanceM <= definition.attackRange
    )
      ctx.addIssue({
        code: 'custom',
        path: ['flankDistanceM'],
        message: 'Promień krążenia musi być większy niż zasięg ataku.',
      });
    if (definition.kind !== 'gunner') return;
    const result = gunnerFields.safeParse(definition);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
    if (!definition.body)
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Strzelec wymaga body.',
      });
    if (
      definition.rangeTolerance !== undefined &&
      definition.preferredRange !== undefined &&
      definition.rangeTolerance >= definition.preferredRange
    )
      ctx.addIssue({
        code: 'custom',
        path: ['rangeTolerance'],
        message: 'Pasmo musi mieć dodatnią dolną granicę.',
      });
  });
export type EnemyDefinition = z.infer<typeof enemySchema>;
