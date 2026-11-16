import { z } from 'zod';
import { hashSeed } from '../core/rng';
import splashData from '../data/ui/splash.json';

/** Splasharty Gracjana (`docs/fabula/splash`) w wersji zoptymalizowanej: `public/assets/splash/`. */
const splashSchema = z.object({
  file: z.string().regex(/^[a-z0-9-]+\.webp$/),
  title: z.string().min(1),
  /** Motywy pokoi (`src/data/themes`), do których obraz oczywiście pasuje. */
  themes: z.array(z.string()).optional(),
  /** Id pokoi (`src/data/rooms`), do których obraz oczywiście pasuje. */
  rooms: z.array(z.string()).optional(),
});
export type SplashEntry = z.infer<typeof splashSchema>;

export function loadSplashes(data: unknown): SplashEntry[] {
  const list = z.array(splashSchema).min(1).parse(data);
  const files = new Set<string>();
  for (const entry of list) {
    if (files.has(entry.file))
      throw new Error(`Powtórzony splash: ${entry.file}`);
    files.add(entry.file);
  }
  return list;
}

export const splashes: readonly SplashEntry[] = loadSplashes(splashData);

export interface SplashHint {
  theme?: string;
  room?: string;
}

/**
 * Wybór splashartu bez `Math.random`: najpierw obrazy przypisane do pokoju, potem do motywu,
 * w ostateczności cała lista; w obrębie grupy deterministycznie z klucza (ziarno + węzeł).
 */
export function pickSplash(
  key: string,
  hint: SplashHint = {},
  list: readonly SplashEntry[] = splashes,
): SplashEntry {
  const byRoom = hint.room
    ? list.filter((entry) => entry.rooms?.includes(hint.room!))
    : [];
  const byTheme = hint.theme
    ? list.filter((entry) => entry.themes?.includes(hint.theme!))
    : [];
  const pool = byRoom.length ? byRoom : byTheme.length ? byTheme : list;
  const entry = pool[hashSeed(key) % pool.length];
  if (!entry) throw new Error('Brak splasharów.');
  return entry;
}

export function splashUrl(entry: SplashEntry): string {
  return `/assets/splash/${entry.file}`;
}
