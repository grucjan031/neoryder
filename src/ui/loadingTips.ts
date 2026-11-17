import { z } from 'zod';
import { hashSeed } from '../core/rng';
import data from '../data/ui/loadingTips.pl.json';

const schema = z.object({
  labels: z.object({ gameplay: z.string().min(1), lore: z.string().min(1) }),
  tips: z
    .array(
      z.object({
        text: z.string().min(1),
        kind: z.enum(['gameplay', 'lore']),
      }),
    )
    .min(1),
});

export interface LoadingTip {
  text: string;
  kind: 'gameplay' | 'lore';
  label: string;
}

/** Uszkodzone dane wyłączają porady, bez blokowania startu gry. */
export function loadTips(value: unknown): readonly LoadingTip[] {
  const result = schema.safeParse(value);
  if (!result.success) return [];
  return result.data.tips.map((tip) => ({
    ...tip,
    label: result.data.labels[tip.kind],
  }));
}

let cached: readonly LoadingTip[] | undefined;
export function getTips(): readonly LoadingTip[] {
  return (cached ??= loadTips(data));
}

export function pickTip(
  key: string,
  list: readonly LoadingTip[] = getTips(),
): LoadingTip | null {
  return list[hashSeed(key) % list.length] ?? null;
}
