import { z } from 'zod';
import {
  missionCheckpointSchema,
  type MissionCheckpoint,
} from '../world/missionCheckpoint';
import { modeIdSchema } from '../world/modeSchema';
import { actionSchema, isBindingCode } from './input';
import { loadoutDefinitions } from '../progression/loadout';
import { runAchievementProgressSchema } from '../progression/achievementsSchema';
import { metaStateSchema } from '../progression/metaStateSchema';
import { seedAchievementsFromMeta } from '../progression/achievements';
import { createStarterMetaState } from '../progression/progressionSchema';
import { runStateSchema } from '../world/run';
import type { MetaState } from './metaTypes';
import type { RunState, RunSummary } from './runTypes';
import { tuning } from './tuning';
import {
  difficultyIdSchema,
  registerDifficultySetting,
  type DifficultyId,
} from '../world/difficulty';

export const SAVE_VERSION = 6;
export interface MissionSave extends MissionCheckpoint {
  saveVersion: number;
}
const missionSaveSchema = missionCheckpointSchema.extend({
  saveVersion: z.literal(SAVE_VERSION),
});
export interface MetaSave {
  saveVersion: number;
  createdAt: number;
  updatedAt: number;
  meta: MetaState;
}
/**
 * Zakończony, jeszcze nierozliczony run (ADR 0007 pkt 2): wynik i podsumowanie dla `applyRun`.
 * Zapis runu z tym polem znika dopiero po udanym zapisie meta.
 */
export interface RunEnded {
  runId: string;
  summary: RunSummary;
}
export interface RunSave {
  saveVersion: number;
  seed: string;
  startedAt: number;
  run: RunState;
  /** Opcjonalne i zgodne wstecz: brak pola = run w toku (zapisy sprzed tej zmiany). */
  ended?: RunEnded;
}
export type Migration = (
  data: Record<string, unknown>,
) => Record<string, unknown>;

export function migrate(
  data: Record<string, unknown>,
  migrations: readonly Migration[],
  target: number,
): Record<string, unknown> {
  let result = structuredClone(data);
  let version = result.saveVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0)
    throw new Error('Nieprawidłowa wersja zapisu.');
  if (version > target) throw new Error('Zapis pochodzi z nowszej wersji gry.');
  while (version < target) {
    const migration = migrations[version];
    if (!migration) throw new Error(`Brak migracji wersji ${version}.`);
    result = { ...migration(result), saveVersion: ++version };
  }
  return result;
}

export interface SaveStore {
  loadMeta(): Promise<MetaSave | null>;
  /**
   * Odczyt meta odróżniający brak zapisu (null) od zapisu nieczytelnego (uszkodzony, nowszej
   * wersji, błąd bazy: wyjątek). Używany przy rozliczaniu nagród, żeby nie nadpisać meta stanem
   * startowym. Opcjonalny: bez niego `loadMetaManagerStrict` korzysta z `loadMeta`.
   */
  loadMetaStrict?(): Promise<MetaSave | null>;
  saveMeta(data: MetaSave): Promise<void>;
  loadRun(): Promise<RunSave | null>;
  saveRun(data: RunSave): Promise<void>;
  clearRun(): Promise<void>;
  loadMission?(): Promise<MissionSave | null>;
  saveMission?(data: MissionSave): Promise<void>;
  clearMission?(): Promise<void>;
}

const metaSchema: z.ZodType<MetaSave> = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  meta: metaStateSchema,
});
const count = z.number().int().nonnegative();
const runEndedSchema: z.ZodType<RunEnded> = z.object({
  runId: z.string().min(1),
  summary: z.object({
    modeId: modeIdSchema.optional(),
    missionId: z.string().min(1).optional(),
    missionCompleted: z.boolean().optional(),
    outcome: z.enum(['victory', 'death']),
    seed: z.string(),
    loadoutId: z.string().min(1),
    elapsedS: z.number().finite().nonnegative(),
    kills: count,
    roomsCleared: count,
    elitesCleared: count,
    threatLevel: count,
    layerReached: count,
    implants: z.array(z.string()),
    damage: z.object({
      melee: z.number().finite(),
      power: z.number().finite(),
      gun: z.number().finite(),
      other: z.number().finite(),
    }),
    achievements: runAchievementProgressSchema.optional(),
  }),
});
const runSchema: z.ZodType<RunSave> = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  seed: z.string(),
  startedAt: z.number().finite(),
  run: runStateSchema,
  ended: runEndedSchema.optional(),
});
const legacyRunV1Schema = z.object({
  saveVersion: z.literal(1),
  seed: z.string(),
  startedAt: z.number().finite(),
});
const recordSchema = z.record(z.string(), z.unknown());
const identity: Migration = (data) => ({ ...data });

/**
 * Meta 2→3: gracz z F3 nie miał meta-progresu, więc zaczyna od stanu startowego z danych.
 * Meta 4→5: dodaje puste `achievements` (naszywki Iskry); reszta zapisu nietknięta.
 * Meta 5→6: bez zmian meta; v6 dodaje osobny rekord misji liniowej (punkt kontrolny).
 */
const metaMigrations: readonly Migration[] = [
  identity,
  identity,
  (data) =>
    data.meta === undefined
      ? { ...data, meta: createStarterMetaState() }
      : { ...data },
  (data) => ({
    ...data,
    meta: {
      ...recordSchema.parse(data.meta),
      campaign: { completed: [], pendingDebrief: null },
    },
  }),
  (data) => {
    const meta = recordSchema.parse(data.meta);
    if (meta.achievements !== undefined) return { ...data, meta };
    const stats = z
      .object({ runs: count, victories: count })
      .catch({ runs: 0, victories: 0 })
      .parse(meta.stats);
    const unlocks = z.array(z.string()).catch([]).parse(meta.unlocks);
    const xp = count.catch(0).parse(meta.xp);
    return {
      ...data,
      meta: {
        ...meta,
        achievements: seedAchievementsFromMeta({ xp, unlocks, stats }),
      },
    };
  },
  identity,
];

/** Run 2→3: dopisuje ekwipunek z presetu `loadoutId`, talenty i Poziom zagrożenia; nieznany preset = zapis nieczytelny. */
const runMigrations: readonly Migration[] = [
  identity,
  (data) =>
    data.run === undefined && legacyRunV1Schema.safeParse(data).success
      ? { ...data, run: null }
      : { ...data },
  (data) => {
    const state = recordSchema.safeParse(data.run);
    if (!state.success || state.data.loadout !== undefined) return { ...data };
    const preset = loadoutDefinitions.get(String(state.data.loadoutId));
    if (!preset)
      throw new Error(
        `Nieznany ekwipunek w zapisie runu: ${String(state.data.loadoutId)}`,
      );
    return {
      ...data,
      run: {
        ...state.data,
        loadout: structuredClone(preset),
        talents: [],
        threatLevel: 0,
      },
    };
  },
  identity,
  identity,
  identity,
];

function isFuture(data: unknown): boolean {
  const record = recordSchema.safeParse(data);
  return (
    record.success &&
    typeof record.data.saveVersion === 'number' &&
    record.data.saveVersion > SAVE_VERSION
  );
}

function showSaveWarning(message: string): void {
  if (typeof document === 'undefined') return;
  let notice = document.getElementById('save-warning');
  if (!notice) {
    notice = document.createElement('p');
    notice.id = 'save-warning';
    notice.setAttribute('role', 'alert');
    notice.setAttribute('popover', 'manual');
    document.body.append(notice);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Zamknij komunikat';
  close.addEventListener('click', () => notice.remove());
  notice.replaceChildren(document.createTextNode(message), close);
  notice.showPopover?.();
}

function decode<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  migrations: readonly Migration[],
): T | null {
  if (raw == null) return null;
  if (isFuture(raw)) {
    showSaveWarning(
      'Zapis pochodzi z nowszej wersji gry. Otwórz nowszą wersję, aby kontynuować; zapis jest chroniony przed zmianami.',
    );
    console.warn(
      'Zapis pochodzi z nowszej wersji gry; pozostaje nienaruszony.',
    );
    return null;
  }
  try {
    const record = recordSchema.parse(raw);
    const migrated = migrate(record, migrations, SAVE_VERSION);
    if (
      schema === runSchema &&
      record.run === undefined &&
      migrated.run === null
    )
      return null;
    return schema.parse(migrated);
  } catch (error) {
    showSaveWarning(
      'Nie można odczytać zapisu. Zachowano oryginał i kopię bezpieczeństwa; ten postęp nie może zostać wznowiony.',
    );
    console.warn('Nie można odczytać zapisu.', error);
    return null;
  }
}

/** Jak `decode` dla meta, ale nieczytelny zapis rzuca zamiast udawać brak zapisu. */
function decodeMetaStrict(raw: unknown): MetaSave | null {
  if (raw == null) return null;
  if (isFuture(raw)) throw new Error('Zapis pochodzi z nowszej wersji gry.');
  const record = recordSchema.parse(raw);
  return metaSchema.parse(migrate(record, metaMigrations, SAVE_VERSION));
}

function assertWritable(raw: unknown): void {
  if (isFuture(raw)) {
    console.warn('Odmowa nadpisania zapisu z nowszej wersji gry.');
    throw new Error('Zapis pochodzi z nowszej wersji gry.');
  }
}

function backupCorrupt(store: IDBObjectStore, key: string, raw: unknown): void {
  if (raw == null || isFuture(raw)) return;
  try {
    const record = recordSchema.parse(raw);
    if (key === 'meta') decodeMetaStrict(raw);
    else if (key === 'mission') missionSaveSchema.parse(raw);
    else {
      const migrated = migrate(record, runMigrations, SAVE_VERSION);
      if (record.run === undefined && migrated.run === null) return;
      runSchema.parse(migrated);
    }
  } catch {
    store.put(raw, ['corrupt', key, Date.now(), crypto.randomUUID()]);
  }
}

export function createMemorySaveStore(): SaveStore {
  let meta: unknown = null;
  let run: unknown = null;
  let mission: unknown = null;
  return {
    loadMission: async () =>
      mission == null
        ? null
        : missionSaveSchema.parse(structuredClone(mission)),
    saveMission: async (data) => {
      assertWritable(mission);
      mission = structuredClone(missionSaveSchema.parse(data));
    },
    clearMission: async () => {
      assertWritable(mission);
      mission = null;
    },
    loadMeta: async () => decode(meta, metaSchema, metaMigrations),
    loadMetaStrict: async () => decodeMetaStrict(meta),
    saveMeta: async (data) => {
      assertWritable(meta);
      meta = structuredClone(metaSchema.parse(data));
    },
    loadRun: async () => decode(run, runSchema, runMigrations),
    saveRun: async (data) => {
      assertWritable(run);
      run = structuredClone(runSchema.parse(data));
    },
    clearRun: async () => {
      assertWritable(run);
      run = null;
    },
  };
}

export function createIndexedDbSaveStore(dbName = 'neoryder'): SaveStore {
  // Krótkie połączenia nie blokują przyszłych aktualizacji schematu bazy.
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('saves');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error('Baza zapisu jest zablokowana.'));
    });

  async function read(key: string): Promise<unknown> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const request = tx.objectStore('saves').get(key);
      request.onsuccess = () => {
        // Kopia i odczyt należą do jednej transakcji; oryginał zostaje nietknięty.
        backupCorrupt(tx.objectStore('saves'), key, request.result);
      };
      tx.oncomplete = () => {
        db.close();
        resolve(request.result as unknown);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
      tx.onerror = () => {
        /* onabort obsługuje błąd transakcji. */
      };
    });
  }

  async function write(
    key: string,
    value?: MetaSave | RunSave | MissionSave,
  ): Promise<void> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      const request = store.get(key);
      let failure: unknown;
      request.onsuccess = () => {
        try {
          assertWritable(request.result);
          backupCorrupt(store, key, request.result);
          if (value === undefined) store.delete(key);
          else store.put(value, key);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(failure ?? tx.error);
      };
      tx.onerror = () => {
        /* onabort obsługuje błąd transakcji. */
      };
    });
  }

  return {
    loadMission: async () => {
      const raw = await read('mission');
      return decode(raw, missionSaveSchema, []);
    },
    saveMission: async (data) =>
      write('mission', missionSaveSchema.parse(data)),
    clearMission: () => write('mission'),
    loadMeta: async () =>
      decode(await read('meta'), metaSchema, metaMigrations),
    loadMetaStrict: async () => decodeMetaStrict(await read('meta')),
    saveMeta: async (data) => write('meta', metaSchema.parse(data)),
    loadRun: async () => decode(await read('run'), runSchema, runMigrations),
    saveRun: async (data) => write('run', runSchema.parse(data)),
    clearRun: () => write('run'),
  };
}

export interface Settings {
  /** Brak w starym zapisie = normal. */
  difficulty?: DifficultyId;
  mouseSensitivity: number;
  fov: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  invertY: boolean;
  screenShake: number;
  flashes: boolean;
  quality: 'low' | 'medium' | 'high';
  bindings: import('./input').BindingOverrides;
}
export const SETTINGS_RANGES = {
  mouseSensitivity: { min: 0.1, max: 5 },
  fov: { min: 60, max: 110 },
} as const;

function clampedSetting(range: { min: number; max: number }, fallback: number) {
  return z
    .number()
    .finite()
    .transform((value) => Math.min(range.max, Math.max(range.min, value)))
    .catch(fallback);
}

const settingsSchema = z.object({
  difficulty: difficultyIdSchema.optional().catch(undefined),
  mouseSensitivity: clampedSetting(SETTINGS_RANGES.mouseSensitivity, 1),
  fov: clampedSetting(SETTINGS_RANGES.fov, 90),
  masterVolume: z.number().min(0).max(1).catch(1),
  sfxVolume: z.number().min(0).max(1).catch(1),
  musicVolume: z.number().min(0).max(1).catch(0.7),
  invertY: z.boolean().catch(false),
  screenShake: z.number().min(0).max(1).catch(1),
  flashes: z.boolean().catch(true),
  quality: z.enum(['low', 'medium', 'high']).catch('high'),
  bindings: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((value) => {
      const result: import('./input').BindingOverrides = {};
      for (const [name, code] of Object.entries(value)) {
        const action = actionSchema.safeParse(name);
        if (action.success && typeof code === 'string' && isBindingCode(code))
          result[action.data] = code;
      }
      return result;
    }),
});
const settingsKey = 'neoryder.settings';
const defaults = (): Settings => ({
  mouseSensitivity: 1,
  fov: tuning.camera.fov,
  masterVolume: 1,
  sfxVolume: 1,
  musicVolume: 0.7,
  invertY: false,
  screenShake: 1,
  flashes: true,
  quality: 'medium',
  bindings: {},
});

let sharedSettings: Settings | undefined;

export function loadSettings(storage?: Storage): Settings {
  if (!storage && typeof window !== 'undefined' && sharedSettings)
    return sharedSettings;
  let result = defaults();
  try {
    const raw = (storage ?? localStorage).getItem(settingsKey);
    result = raw
      ? settingsSchema.parse({
          ...defaults(),
          quality: 'high',
          ...recordSchema.parse(JSON.parse(raw)),
        })
      : defaults();
  } catch {
    // Brak dostępu do localStorage nie blokuje zmiany ustawień w bieżącej sesji.
  }
  if (!storage && typeof window !== 'undefined') sharedSettings = result;
  return result;
}

export function saveSettings(s: Settings, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(
      settingsKey,
      JSON.stringify(settingsSchema.parse(s)),
    );
  } catch (error) {
    console.warn('Nie można zapisać ustawień.', error);
  }
}

registerDifficultySetting(() => loadSettings().difficulty);
