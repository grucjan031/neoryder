import { z } from 'zod';
import textData from '../data/ui/achievements.pl.json';
import { ACHIEVEMENT_CATEGORIES } from '../progression/achievementsSchema';
import type { AchievementReward } from '../progression/achievementsSchema';

export const achievementText = z
  .object({
    panel: z.object({
      tabsLabel: z.string(),
      tabTalents: z.string(),
      tabAchievements: z.string(),
      heading: z.string(),
      count: z.string(),
      intro: z.string(),
      categories: z.record(z.enum(ACHIEVEMENT_CATEGORIES), z.string()),
      earned: z.string(),
      missing: z.string(),
      progress: z.string(),
      reward: z.string(),
      noReward: z.string(),
      unlocksPurchase: z.string(),
    }),
    reward: z.object({
      data: z.string(),
      cores: z.object({ one: z.string(), few: z.string(), many: z.string() }),
      join: z.string(),
    }),
    toast: z.object({ prefix: z.string() }),
    summary: z.object({
      heading: z.string(),
      line: z.string(),
      lineNoReward: z.string(),
    }),
    workshop: z.object({ requires: z.string() }),
  })
  .parse(textData);

export const fill = (
  template: string,
  values: Record<string, string | number>,
): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

function coresLabel(n: number): string {
  const forms = achievementText.reward.cores;
  const last = n % 10;
  const form =
    n === 1
      ? forms.one
      : last >= 2 && last <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? forms.few
        : forms.many;
  return fill(form, { n });
}

/** „10 Danych”, „1 Rdzeń”, „2 Rdzenie” (nagrody mieszane łączone spójnikiem). */
export function rewardLabel(reward: AchievementReward): string {
  const parts: string[] = [];
  if (reward.data)
    parts.push(fill(achievementText.reward.data, { n: reward.data }));
  if (reward.cores) parts.push(coresLabel(reward.cores));
  return parts.join(achievementText.reward.join);
}
