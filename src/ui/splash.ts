import { z } from 'zod';
import { missionCatalog } from '../world/missionCatalog';
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
 * Najwyższy akt z ukończonych misji. Wywołanie z liczbą zachowuje próg zwycięstw
 * dla pustej kampanii i zgodność dotychczasowego API.
 */
export function unlockedSplashAct(
  victories: number | readonly string[],
  thresholds: readonly number[] = tuning.ui.splashActVictories,
): SplashAct {
  let act: SplashAct = 1;
  if (typeof victories !== 'number') {
    for (const id of victories) {
      const unlocked = missionCatalog.get(id)?.splashAct ?? 1;
      if (unlocked > act) act = unlocked;
    }
    return act;
  }
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

let lastSplashFile: string | null = null;

/**
 * Losuje splashart jednostajnie spośród wszystkich odblokowanych obrazów (`entry.act <= maxAct`),
 * bez powtórzenia ostatnio wybranego obrazu, gdy pula ma co najmniej 2 elementy.
 * Domyślnie używa `Math.random` — to kosmetyka UI poza pętlą symulacji (`AGENTS.md` zakazuje
 * `Math.random` tylko w symulacji).
 */
export function pickSplash(
  maxAct: SplashAct = 1,
  all: readonly SplashEntry[] = getSplashes(),
  // eslint-disable-next-line no-restricted-properties -- kosmetyka ekranu ładowania, poza symulacją
  random: () => number = Math.random,
): SplashEntry | null {
  const unlocked = all.filter((entry) => entry.act <= maxAct);
  if (unlocked.length === 0) return null;
  const withoutLast =
    unlocked.length >= 2 && lastSplashFile !== null
      ? unlocked.filter((entry) => entry.file !== lastSplashFile)
      : unlocked;
  const pool = withoutLast.length > 0 ? withoutLast : unlocked;
  const index = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(random() * pool.length)),
  );
  const entry = pool[index] ?? null;
  if (entry) lastSplashFile = entry.file;
  return entry;
}

export function splashUrl(entry: Pick<SplashEntry, 'file'>): string {
  return `/assets/splash/${entry.file}`;
}
