import { z } from 'zod';
import bossText from '../data/ui/bossTest.pl.json';

const bossNames = new Map(Object.entries(bossText.names));

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const size = z.object({ x: positive, y: positive, z: positive });
const patternFields = {
  telegraphS: positive,
  recoveryS: nonnegative,
  cooldownS: nonnegative,
  damage: nonnegative,
};
export const bossPatternSchema = z.discriminatedUnion('kind', [
  z.object({
    ...patternFields,
    kind: z.literal('laser'),
    heightM: positive,
    halfLengthM: positive,
    radiusM: positive,
  }),
  z.object({
    ...patternFields,
    kind: z.literal('gridHack'),
    radiusM: positive,
    damage: positive,
    jamS: positive,
  }),
  z.object({ ...patternFields, kind: z.literal('slam'), radiusM: positive }),
  z.object({
    ...patternFields,
    kind: z.literal('fan'),
    projectileCount: z.number().int().positive(),
    spreadDeg: nonnegative.max(180),
    projectileSpeed: positive,
    projectileLifetimeS: positive,
  }),
  /** F3-17: wezwanie sług; `maxMinions` to limit żywych sług bossa naraz. */
  z.object({
    ...patternFields,
    kind: z.literal('summon'),
    enemyId: z.string().min(1),
    count: z.number().int().positive(),
    maxMinions: z.number().int().positive(),
    /** `spawnPoints` — punkty spawnu pokoju (bez nich: pierścień); `around` — pierścień wokół bossa. */
    placement: z.enum(['spawnPoints', 'around']),
    radiusM: positive,
  }),
  /** F3-17: tarcza łamana; obrażenia bez #power i odbitych pocisków są zerowane. */
  z.object({
    ...patternFields,
    kind: z.literal('shield'),
    durability: positive,
    /** Po tym czasie niezłamana tarcza opada. */
    durationS: positive,
    stunS: positive,
    /** Okno zwiększonych obrażeń liczone od złamania tarczy. */
    vulnerableS: positive,
    vulnerableMult: z.number().finite().min(1),
  }),
]);
export type BossPattern = z.infer<typeof bossPatternSchema>;
export type SummonPattern = Extract<BossPattern, { kind: 'summon' }>;
export type ShieldPattern = Extract<BossPattern, { kind: 'shield' }>;
const clipNames = [
  'Idle_Loop',
  'Walk_Loop',
  'Jog_Fwd_Loop',
  'Sword_Idle',
  'Sword_Attack',
  'Hit_Chest',
  'Hit_Head',
] as const;
/**
 * Animacja wzorca ataku bossa w klipie jednorazowym: zapowiedź odtwarza ułamki [0, impact]
 * klipu, dokładnie do chwili skutku (efekt i obrażenia w symulacji), a wymach i regeneracja
 * [impact, end]. `end` = `impact` zatrzymuje pozę (np. wezwanie, tarcza).
 */
export const bossAttackAnimationSchema = z
  .object({
    clip: z.enum(clipNames),
    impact: z.number().finite().min(0).max(1),
    end: z.number().finite().min(0).max(1),
  })
  .refine((a) => a.end >= a.impact, 'Koniec klipu przed chwilą skutku.');
export type BossAttackAnimation = z.infer<typeof bossAttackAnimationSchema>;
export const bossSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .transform((name) => bossNames.get(name) ?? name),
    counterOnReflect: z.boolean().optional(),
    modelScale: positive,
    /** Animacja ataku wg rodzaju wzorca; bez wpisu obowiązuje klip domyślny. */
    attackAnimations: z
      .object({
        slam: bossAttackAnimationSchema.optional(),
        fan: bossAttackAnimationSchema.optional(),
        summon: bossAttackAnimationSchema.optional(),
        shield: bossAttackAnimationSchema.optional(),
        laser: bossAttackAnimationSchema.optional(),
        gridHack: bossAttackAnimationSchema.optional(),
      })
      .optional(),
    muzzle: z.object({ x: z.number().finite(), y: positive, z: positive }),
    phases: z
      .array(
        z.object({
          hpThreshold: positive.max(1),
          patterns: z.array(bossPatternSchema).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((boss, ctx) => {
    boss.phases.forEach((phase, index) => {
      if (
        !phase.patterns.some(
          (p) => p.kind === 'slam' || p.kind === 'fan' || p.kind === 'laser',
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'patterns'],
          message:
            'Faza wymaga co najmniej jednego wzorca zadającego obrażenia.',
        });
      phase.patterns.forEach((pattern, p) => {
        if (pattern.kind === 'shield' && pattern.vulnerableS < pattern.stunS)
          ctx.addIssue({
            code: 'custom',
            path: ['phases', index, 'patterns', p, 'vulnerableS'],
            message: 'Okno obrażeń nie może być krótsze niż ogłuszenie.',
          });
      });
      if (
        (index === 0 && phase.hpThreshold !== 1) ||
        (index > 0 && phase.hpThreshold >= boss.phases[index - 1]!.hpThreshold)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'hpThreshold'],
          message: 'Progi HP muszą maleć, zaczynając od 1.',
        });
    });
  });
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
  antenna: z.boolean().optional(),
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
export const RANGED_KINDS: readonly string[] = [
  'gunner',
  'sniper',
  'drone',
  'turret',
  'hacker',
];
export const enemySchema = z
  .object({
    ...gunnerFields.partial().shape,
    id: z.string().min(1),
    kind: z.string().min(1),
    /** F3: koszt wroga w budżecie zagrożenia pokoju (dodatni). */
    threatCost: positive.optional(),
    grabbable: z.boolean().optional(),
    stationary: z.boolean().optional(),
    hack: z
      .object({
        hackCooldownS: positive,
        hackTelegraphS: positive,
        durationS: positive,
      })
      .optional(),
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
    boss: bossSchema.optional(),
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
        /** Tarcza trzymana w ręce: kość oraz pozycja i obrót (m, stopnie) w układzie wroga w pozie Idle_Loop. */
        shieldHold: z
          .object({
            bone: z.string().min(1),
            position: z.object({
              x: z.number().finite(),
              y: z.number().finite(),
              z: z.number().finite(),
            }),
            rotationDeg: z.object({
              x: z.number().finite(),
              y: z.number().finite(),
              z: z.number().finite(),
            }),
            /** Jaka część obrotu kości przenosi się na tarczę (1 = sztywne przypięcie). */
            rotationFollow: z.number().finite().min(0).max(1),
          })
          .optional(),
        /** Droga stóp (m świata) na cykl klipu chodu i biegu; bez wpisu ruch używa `strideM`. */
        clipStrideM: z
          .object({
            Walk_Loop: positive.optional(),
            Jog_Fwd_Loop: positive.optional(),
          })
          .optional(),
        /** Ułamek moveSpeed, powyżej którego ruch używa biegu zamiast chodu (domyślnie 0,5). */
        jogFromSpeedFrac: positive.optional(),
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
      definition.kind === 'turret' &&
      (!definition.stationary ||
        definition.grabbable !== false ||
        definition.knockbackResist !== 1)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['stationary'],
        message:
          'Wieżyczka wymaga stationary, grabbable false i knockbackResist 1.',
      });
    if (definition.kind === 'hacker' && !definition.hack)
      ctx.addIssue({
        code: 'custom',
        path: ['hack'],
        message: 'Haker wymaga danych hack.',
      });
    if (definition.kind === 'boss' && (!definition.boss || !definition.body))
      ctx.addIssue({
        code: 'custom',
        path: ['boss'],
        message: 'Boss wymaga danych boss i body.',
      });
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
    if (definition.kind === 'drone' || definition.kind === 'hacker') {
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
