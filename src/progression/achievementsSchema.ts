import { z } from 'zod';
import { unlockIdSchema } from './unlocksSchema';
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
  'kills_blaster',
  'kills_pistol',
  'kills_rifle',
  'kills_scatter',
  'kills_sniper',
  'kills_beam',
  'kills_emp',
  'runs_ended',
  'victories',
] as const;
export type AchievementCounter = (typeof ACHIEVEMENT_COUNTERS)[number];

/** Flagi, które tracker może ustawić ze zdarzeń w runie (reszta wynika z podsumowania albo z meta). */
export const RUN_EVENT_FLAGS = [
  'pierwsza-krew',
  'seria',
  'bez-zadrasniecia',
  'trzy-punkty',
  'upadek-brandta',
] as const;

/** Najwyższy przyrost jednego licznika z jednego runu (ochrona przed uszkodzonym zapisem). */
export const MAX_RUN_COUNTER = 10_000;

/** Postęp osiągnięć z runu zapisywany w `RunState` i `RunSummary` (tylko znane klucze i ograniczone wartości). */
export const runAchievementProgressSchema = z.object({
  counters: z
    .record(z.string(), z.number().int().min(0).max(MAX_RUN_COUNTER))
    .refine(
      (counters) =>
        Object.keys(counters).every((key) =>
          (ACHIEVEMENT_COUNTERS as readonly string[]).includes(key),
        ),
      'Nieznany licznik osiągnięć.',
    ),
  flags: z.array(z.enum(RUN_EVENT_FLAGS)),
});

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

/** Pusta nagroda `{}` oznacza samą naszywkę (bez waluty). */
export const achievementRewardSchema = z
  .object({
    data: amount.optional(),
    cores: amount.optional(),
    unlocks: z.array(unlockIdSchema).optional(),
  })
  .strict();

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
