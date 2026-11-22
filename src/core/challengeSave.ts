import { z } from 'zod';

/** Wersja rekordu `challenge`, niezależna od SAVE_VERSION. */
export const CHALLENGE_VERSION = 1;

const challengeDateSchema = z.iso.date();
const count = z.number().int().nonnegative();
const challengeResultSchema = z.object({
  outcome: z.enum(['victory', 'death']),
  elapsedS: z.number().finite().nonnegative(),
  kills: count,
  roomsCleared: count,
});
const challengeSchema = z.object({
  challengeVersion: z.literal(CHALLENGE_VERSION),
  history: z.record(challengeDateSchema, challengeResultSchema.nullable()),
});

export type ChallengeResult = z.infer<typeof challengeResultSchema>;
export type ChallengeHistory = z.infer<typeof challengeSchema>['history'];
export type ChallengeRecord = z.infer<typeof challengeSchema>;
export interface ChallengeSavePort {
  loadHistory(): Promise<ChallengeHistory>;
  /** Rezerwuje dzień; false, jeśli próba już istnieje. */
  begin(date: string): Promise<boolean>;
  /** Zapisuje pierwszy wynik zarezerwowanej próby; kolejne wywołania są ignorowane. */
  finish(date: string, result: ChallengeResult): Promise<void>;
}

type ChallengeMigration = (
  data: Record<string, unknown>,
) => Record<string, unknown>;
/** Indeks = wersja źródłowa. Wersja bieżąca to 1, więc na razie brak migracji. */
const challengeMigrations: readonly (ChallengeMigration | undefined)[] = [
  undefined,
];

export interface ChallengeDecoded {
  status: 'ok' | 'corrupt' | 'future';
  history: ChallengeHistory;
}

/** Brak rekordu = pusta historia; zepsuty = pusta historia ze statusem `corrupt`. */
export function decodeChallenge(raw: unknown): ChallengeDecoded {
  if (raw == null) return { status: 'ok', history: {} };
  try {
    const record = z.record(z.string(), z.unknown()).parse(raw);
    let version = record.challengeVersion;
    if (
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      version < 1
    )
      throw new Error('Nieprawidłowa wersja wyzwania.');
    if (version > CHALLENGE_VERSION) return { status: 'future', history: {} };
    let data: Record<string, unknown> = structuredClone(record);
    while (version < CHALLENGE_VERSION) {
      const migration = challengeMigrations[version];
      if (!migration) throw new Error(`Brak migracji wyzwania ${version}.`);
      data = { ...migration(data), challengeVersion: ++version };
    }
    return { status: 'ok', history: challengeSchema.parse(data).history };
  } catch {
    return { status: 'corrupt', history: {} };
  }
}

/** Czyste przejście `begin`; null = bez zmian (dzień już zajęty). */
export function beginChallenge(
  history: ChallengeHistory,
  value: string,
): ChallengeRecord | null {
  const date = challengeDateSchema.parse(value);
  if (Object.hasOwn(history, date)) return null;
  return {
    challengeVersion: CHALLENGE_VERSION,
    history: { ...history, [date]: null },
  };
}

/** Czyste przejście `finish`; null = wynik już zapisany. */
export function finishChallenge(
  history: ChallengeHistory,
  value: string,
  result: ChallengeResult,
): ChallengeRecord | null {
  const date = challengeDateSchema.parse(value);
  if (!Object.hasOwn(history, date))
    throw new Error('Brak rozpoczętej próby wyzwania.');
  if (history[date] !== null) return null;
  return {
    challengeVersion: CHALLENGE_VERSION,
    history: { ...history, [date]: challengeResultSchema.parse(result) },
  };
}

/**
 * Port nad dowolnym magazynem: `update` dostaje funkcję zmiany zdekodowanego rekordu
 * i zwraca, czy cokolwiek zapisano. Kopię zepsutego rekordu robi magazyn.
 */
export function challengePort(
  read: () => Promise<unknown>,
  update: (
    change: (decoded: ChallengeDecoded) => ChallengeRecord | null,
  ) => Promise<boolean>,
): ChallengeSavePort {
  return {
    loadHistory: async () =>
      structuredClone(decodeChallenge(await read()).history),
    begin: (date) => update((d) => beginChallenge(d.history, date)),
    finish: async (date, result) => {
      await update((d) => finishChallenge(d.history, date, result));
    },
  };
}
