import { z } from 'zod';
import threatData from '../data/meta/threat.json';

const nonnegative = z.number().finite().min(0);

export const threatLevelSchema = z
  .object({
    level: z.number().int().min(0),
    name: z.string().min(1),
    /** Przyrost zdrowia wrogów jako ułamek (0.1 = +10%). */
    enemyHealth: nonnegative,
    /** Przyrost obrażeń wrogów jako ułamek (0.1 = +10%). */
    enemyDamage: nonnegative,
    budgetMult: z.number().finite().positive(),
    rewardMult: z.number().finite().positive(),
    victoryCores: z.number().int().min(0),
  })
  .strict();
export type ThreatLevel = z.infer<typeof threatLevelSchema>;

/** Poziomy kolejne od 0 bez luk; poziom 0 jest neutralny (identyczny z F3). */
export const threatSchema = z
  .array(threatLevelSchema)
  .min(1)
  .superRefine((levels, ctx) => {
    levels.forEach((entry, index) => {
      if (entry.level !== index)
        ctx.addIssue({
          code: 'custom',
          path: [index, 'level'],
          message: `Poziomy zagrożenia muszą być kolejne od 0 (pozycja ${index}: ${entry.level}).`,
        });
    });
    const base = levels[0];
    if (
      base &&
      (base.level !== 0 ||
        base.enemyHealth !== 0 ||
        base.enemyDamage !== 0 ||
        base.budgetMult !== 1 ||
        base.rewardMult !== 1)
    )
      ctx.addIssue({
        code: 'custom',
        path: [0],
        message:
          'Poziom 0 jest wymagany i neutralny: enemyHealth 0, enemyDamage 0, budgetMult 1, rewardMult 1.',
      });
  });

export function loadThreatLevels(data: unknown): ThreatLevel[] {
  return threatSchema.parse(data);
}

export const threatLevels: readonly ThreatLevel[] =
  loadThreatLevels(threatData);
