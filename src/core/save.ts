import { z } from 'zod';
import { loadoutDefinitions } from '../progression/loadout';
import { metaStateSchema } from '../progression/metaStateSchema';
import { createStarterMetaState } from '../progression/progressionSchema';
import { runStateSchema } from '../world/run';
import type { MetaState } from './metaTypes';
import type { RunState } from './runTypes';
import { tuning } from './tuning';

export const SAVE_VERSION = 3;
export interface MetaSave {
  saveVersion: number;
  createdAt: number;
  updatedAt: number;
  meta: MetaState;
}
export interface RunSave {
  saveVersion: number;
  seed: string;
  startedAt: number;
  run: RunState;
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
  saveMeta(data: MetaSave): Promise<void>;
  loadRun(): Promise<RunSave | null>;
  saveRun(data: RunSave): Promise<void>;
  clearRun(): Promise<void>;
}

const metaSchema: z.ZodType<MetaSave> = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  meta: metaStateSchema,
});
const runSchema: z.ZodType<RunSave> = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  seed: z.string(),
  startedAt: z.number().finite(),
  run: runStateSchema,
});
const legacyRunV1Schema = z.object({
  saveVersion: z.literal(1),
  seed: z.string(),
  startedAt: z.number().finite(),
});
const recordSchema = z.record(z.string(), z.unknown());
const identity: Migration = (data) => ({ ...data });

/** Meta 2→3: gracz z F3 nie miał meta-progresu, więc zaczyna od stanu startowego z danych. */
const metaMigrations: readonly Migration[] = [
  identity,
  identity,
  (data) =>
    data.meta === undefined
      ? { ...data, meta: createStarterMetaState() }
      : { ...data },
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
];

function isFuture(data: unknown): boolean {
  const record = recordSchema.safeParse(data);
  return (
    record.success &&
    typeof record.data.saveVersion === 'number' &&
    record.data.saveVersion > SAVE_VERSION
  );
}

function decode<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  migrations: readonly Migration[],
): T | null {
  if (raw == null) return null;
  if (isFuture(raw)) {
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
    console.warn('Nie można odczytać zapisu.', error);
    return null;
  }
}

function assertWritable(raw: unknown): void {
  if (isFuture(raw)) {
    console.warn('Odmowa nadpisania zapisu z nowszej wersji gry.');
    throw new Error('Zapis pochodzi z nowszej wersji gry.');
  }
}

export function createMemorySaveStore(): SaveStore {
  let meta: unknown = null;
  let run: unknown = null;
  return {
    loadMeta: async () => decode(meta, metaSchema, metaMigrations),
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
      const tx = db.transaction('saves', 'readonly');
      const request = tx.objectStore('saves').get(key);
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

  async function write(key: string, value?: MetaSave | RunSave): Promise<void> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const store = tx.objectStore('saves');
      const request = store.get(key);
      let failure: unknown;
      request.onsuccess = () => {
        try {
          assertWritable(request.result);
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
    loadMeta: async () =>
      decode(await read('meta'), metaSchema, metaMigrations),
    saveMeta: async (data) => write('meta', metaSchema.parse(data)),
    loadRun: async () => decode(await read('run'), runSchema, runMigrations),
    saveRun: async (data) => write('run', runSchema.parse(data)),
    clearRun: () => write('run'),
  };
}

export interface Settings {
  mouseSensitivity: number;
  fov: number;
  masterVolume: number;
}
const settingsSchema = z.object({
  mouseSensitivity: z.number().positive().finite(),
  fov: z.number().positive().max(179),
  masterVolume: z.number().min(0).max(1),
});
const settingsKey = 'neoryder.settings';
const defaults = (): Settings => ({
  mouseSensitivity: 1,
  fov: tuning.camera.fov,
  masterVolume: 1,
});

export function loadSettings(storage?: Storage): Settings {
  try {
    const raw = (storage ?? localStorage).getItem(settingsKey);
    return raw
      ? settingsSchema.parse({
          ...defaults(),
          ...recordSchema.parse(JSON.parse(raw)),
        })
      : defaults();
  } catch {
    return defaults();
  }
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
