import { z } from 'zod';
import { hashSeed } from '../core/rng';
import { tuning } from '../core/tuning';
import splashData from '../data/ui/splash.json';

/** Splasharty Gracjana (`docs/fabula/splash`) w wersji zoptymalizowanej: `public/assets/splash/`. */
const splashSchema = z.object({
  file: z.string().regex(/^[a-z0-9-]+\.webp$/),
  title: z.string().min(1),
  /** Motywy pokoi (`src/data/themes`), do których obraz oczywiście pasuje. */
  themes: z.array(z.string()).optional(),
  /** Id pokoi (`src/data/rooms`), do których obraz oczywiście pasuje. */
  rooms: z.array(z.string()).optional(),
  scenes: z.array(z.string()).optional(),
  /** Akt fabuły (`docs/fabula/zarys-fabuly.md`): 1 prolog/akt I/neutralne, 2–3 akty II–III, 4 epilog. */
  act: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type SplashEntry = z.infer<typeof splashSchema>;
export type SplashAct = SplashEntry['act'];

/**
 * Najwyższy akt splasharów bez spoilerów. Misje nie są podpięte, więc postęp fabuły przybliża
 * liczba zwycięstw z meta-zapisu (`stats.victories`) i progi `tuning.ui.splashActVictories`.
 */
export function unlockedSplashAct(
  victories: number,
  thresholds: readonly number[] = tuning.ui.splashActVictories,
): SplashAct {
  let act: SplashAct = 1;
  for (const next of [2, 3, 4] as const) {
    const need = thresholds[next - 1];
    if (need !== undefined && victories >= need) act = next;
  }
  return act;
}

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

let cached: readonly SplashEntry[] | null | undefined;

/** Leniwa walidacja `splash.json`: błąd danych nie blokuje startu gry, tylko wyłącza splashe. */
export function getSplashes(): readonly SplashEntry[] {
  if (cached === undefined) {
    try {
      cached = loadSplashes(splashData);
    } catch (error) {
      console.warn('Nieprawidłowe dane splasharów; brak splasha.', error);
      cached = null;
    }
  }
  return cached ?? [];
}

export interface SplashHint {
  scene?: string;
  theme?: string;
  room?: string;
}

/**
 * Wybór splashartu bez `Math.random`: najpierw obrazy przypisane do sceny, potem pokoju i motywu,
 * w ostateczności cała lista; w obrębie grupy deterministycznie z klucza (ziarno + węzeł).
 * Obrazy z aktu wyższego niż `maxAct` w ogóle nie biorą udziału (także w dopasowaniu).
 */
export function pickSplash(
  key: string,
  hint: SplashHint = {},
  maxAct: SplashAct = 1,
  all: readonly SplashEntry[] = getSplashes(),
): SplashEntry | null {
  const list = all.filter((entry) => entry.act <= maxAct);
  const byScene = hint.scene
    ? list.filter((entry) => entry.scenes?.includes(hint.scene!))
    : [];
  const byRoom = hint.room
    ? list.filter((entry) => entry.rooms?.includes(hint.room!))
    : [];
  const byTheme = hint.theme
    ? list.filter((entry) => entry.themes?.includes(hint.theme!))
    : [];
  const pool = byScene.length
    ? byScene
    : byRoom.length
      ? byRoom
      : byTheme.length
        ? byTheme
        : list;
  const entry = pool[hashSeed(key) % pool.length];
  return entry ?? null;
}

export function splashUrl(entry: Pick<SplashEntry, 'file'>): string {
  return `/assets/splash/${entry.file}`;
}
