import { z } from 'zod';
import { tuning } from './tuning';

export const SAVE_VERSION = 1;
export interface MetaSave {
  saveVersion: number;
  createdAt: number;
  updatedAt: number;
}
export interface RunSave {
  saveVersion: number;
  seed: string;
  startedAt: number;
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

const metaSchema = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
});
const runSchema = z.object({
  saveVersion: z.literal(SAVE_VERSION),
  seed: z.string(),
  startedAt: z.number().finite(),
});
const recordSchema = z.record(z.string(), z.unknown());
const migrations: readonly Migration[] = [(data) => ({ ...data })];

function isFuture(data: unknown): boolean {
  const record = recordSchema.safeParse(data);
  return (
    record.success &&
    typeof record.data.saveVersion === 'number' &&
    record.data.saveVersion > SAVE_VERSION
  );
}

function decode<T>(raw: unknown, schema: z.ZodType<T>): T | null {
  if (raw == null) return null;
  if (isFuture(raw)) {
    console.warn(
      'Zapis pochodzi z nowszej wersji gry; pozostaje nienaruszony.',
    );
    return null;
  }
  try {
    return schema.parse(
      migrate(recordSchema.parse(raw), migrations, SAVE_VERSION),
    );
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
    loadMeta: async () => decode(meta, metaSchema),
    saveMeta: async (data) => {
      assertWritable(meta);
      meta = structuredClone(metaSchema.parse(data));
    },
    loadRun: async () => decode(run, runSchema),
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
    loadMeta: async () => decode(await read('meta'), metaSchema),
    saveMeta: async (data) => write('meta', metaSchema.parse(data)),
    loadRun: async () => decode(await read('run'), runSchema),
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
