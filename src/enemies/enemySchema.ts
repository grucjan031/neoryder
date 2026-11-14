import { z } from 'zod';

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const size = z.object({ x: positive, y: positive, z: positive });
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
  /** F2-13: ostatnie sekundy telegrafu z zablokowanym celem (unik przed strzałem). */
  aimLockS: nonnegative.optional(),
  /** F2-13: widoczna linia lasera od lufy do celu podczas celowania (render). */
  laserSight: z.boolean().optional(),
  /** Tagi pocisku; domyślnie ['#gun']. '#heavy' przebija blok ostrzem. */
  projectileTags: z.array(z.string().startsWith('#')).min(1).optional(),
});
/** F2-13: lot drona — kinematyka 3D bez character controllera. */
export const droneFields = z.object({
  massKg: positive,
  /** Wysokość środka drona nad punktem spawnu (stopami). */
  hoverHeightM: positive,
  /** Prędkość kątowa krążenia wokół celu. */
  orbitSpeedDegS: positive,
  /** Promień kuli ciała i hurtboxa. */
  radiusM: positive,
  /** Mnożnik obrażeń hurtboxa. */
  hurtboxMultiplier: positive,
  knockbackDamping: positive,
  /** Odstęp od ścian przy castShape. */
  skinM: positive,
  /** Render: obroty wirników na sekundę, przechył ogłuszenia (rad), pulsowanie oka przy celowaniu. */
  rotorSpinHz: positive,
  stunTiltRad: z.number().finite(),
  pulseHz: positive,
  pulseScale: z.number().finite().nonnegative(),
});
/** Archetypy strzelające jak Strzelec (pola gunnerFields wymagane). */
export const RANGED_KINDS: readonly string[] = ['gunner', 'sniper', 'drone'];
export const enemySchema = z
  .object({
    ...gunnerFields.partial().shape,
    id: z.string().min(1),
    kind: z.string().min(1),
    grabbable: z.boolean().optional(),
    /** Nazwa modelu GLB w public/assets/models (bez rozszerzenia); brak = domyślny dla archetypu. */
    model: z.string().min(1).optional(),
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
    attackTags: z.array(z.string().startsWith('#')).min(1).optional(),
    shield: z
      .object({
        arcDeg: positive.max(360),
        downS: positive,
        blocksTags: z.array(z.string().startsWith('#')).min(1),
      })
      .optional(),
    parry: z.object({ cooldownS: positive }).optional(),
    drone: droneFields.optional(),
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
        shieldSizeM: size.optional(),
        bladeSizeM: size.optional(),
        aimAngle: z.number().finite().optional(),
        recoilM: nonnegative.optional(),
        recoilS: positive.optional(),
        /** F2-13: grubość linii lasera i jej mnożnik w czasie blokady celu. */
        laserRadiusM: positive.optional(),
        laserLockScale: positive.optional(),
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
    if (!RANGED_KINDS.includes(definition.kind)) return;
    const result = gunnerFields.safeParse(definition);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
    if (definition.kind === 'drone') {
      if (!definition.drone)
        ctx.addIssue({
          code: 'custom',
          path: ['drone'],
          message: 'Dron wymaga danych drone.',
        });
    } else if (!definition.body)
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'Strzelec wymaga body.',
      });
    if (
      definition.aimLockS !== undefined &&
      definition.aimTelegraphS !== undefined &&
      definition.aimLockS >= definition.aimTelegraphS
    )
      ctx.addIssue({
        code: 'custom',
        path: ['aimLockS'],
        message: 'Blokada celu musi być krótsza niż telegraf.',
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
