import { z } from 'zod';
import achievementsData from '../data/meta/achievements.json';

export const ACHIEVEMENT_CATEGORIES = [
  'walka',
  'sciezki',
  'misje',
  'progres',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

/** Liczniki, które wolno liczyć w danych; źródła opisuje `docs/systems/achievements.md`. */
export const ACHIEVEMENT_COUNTERS = [
  'parry_success',
  'execute_performed',
  'synergy_triggered',
  'dash_used',
  'kills_melee',
  'kills_power',
  'kills_gun',
  'runs_ended',
  'victories',
] as const;
export type AchievementCounter = (typeof ACHIEVEMENT_COUNTERS)[number];

/** Klucze ikon rysowanych w `src/ui/achievementIcons.ts` (paleta: bursztyn, ciepła biel, zieleń). */
export const ACHIEVEMENT_ICONS = [
  'spark',
  'mirror',
  'execute',
  'chain',
  'rings',
  'dash',
  'aegis',
  'blade',
  'wave',
  'gun',
  'crown',
  'antenna',
  'letter',
  'foundry',
  'flag',
  'triad',
  'trophy',
  'repeat',
  'target',
  'alert',
  'chevrons',
  'cart',
  'level',
] as const;

const amount = z.number().int().min(0);

export const achievementRewardSchema = z
  .object({ data: amount.optional(), cores: amount.optional() })
  .strict()
  .refine(
    (reward) => (reward.data ?? 0) + (reward.cores ?? 0) > 0,
    'Nagroda wymaga Danych lub Rdzeni.',
  );

export const achievementSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Id w formacie kebab-case.'),
    title: z.string().min(1),
    description: z.string().min(1),
    hint: z.string().min(1),
    category: z.enum(ACHIEVEMENT_CATEGORIES),
    kind: z.enum(['counter', 'flag']),
    counter: z.enum(ACHIEVEMENT_COUNTERS).optional(),
    target: z.number().int().min(1).optional(),
    reward: achievementRewardSchema,
    icon: z.enum(ACHIEVEMENT_ICONS),
  })
  .strict()
  .superRefine((def, ctx) => {
    const counter = def.kind === 'counter';
    if (counter && (def.counter === undefined || def.target === undefined))
      ctx.addIssue({
        code: 'custom',
        message: 'Osiągnięcie licznikowe wymaga pól counter i target.',
      });
    if (!counter && (def.counter !== undefined || def.target !== undefined))
      ctx.addIssue({
        code: 'custom',
        message: 'Osiągnięcie-flaga nie ma pól counter ani target.',
      });
  });
export type AchievementDefinition = z.infer<typeof achievementSchema>;
export type AchievementReward = z.infer<typeof achievementRewardSchema>;

export const achievementsSchema = z
  .array(achievementSchema)
  .refine(
    (list) => new Set(list.map((entry) => entry.id)).size === list.length,
    'Powtórzone id osiągnięcia.',
  );

export function loadAchievements(data: unknown): AchievementDefinition[] {
  return achievementsSchema.parse(data);
}

export function loadAchievementDefinitions(
  data: unknown,
): ReadonlyMap<string, AchievementDefinition> {
  return new Map(loadAchievements(data).map((entry) => [entry.id, entry]));
}

export const achievementDefinitions =
  loadAchievementDefinitions(achievementsData);
