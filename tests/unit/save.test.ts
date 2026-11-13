import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
  loadSettings,
  migrate,
  SAVE_VERSION,
  saveSettings,
} from '../../src/core/save';
import type { SaveStore } from '../../src/core/save';

const meta = { saveVersion: SAVE_VERSION, createdAt: 100, updatedAt: 200 };
const run = { saveVersion: SAVE_VERSION, seed: 'test', startedAt: 300 };
let databaseId = 0;
const databaseName = () => `neoryder-test-${++databaseId}`;

async function rawSave(
  name: string,
  key: string,
  data: unknown,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('saves');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(data, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

afterEach(() => vi.restoreAllMocks());

describe('migrate', () => {
  it('stosuje kolejne migracje i nie mutuje wejścia', () => {
    const original = { saveVersion: 0, name: 'a', nested: { value: 1 } };
    const result = migrate(
      original,
      [
        (data) => ({ ...data, name: 'b' }),
        (data) => ({ ...data, added: true }),
      ],
      2,
    );
    expect(result).toEqual({
      saveVersion: 2,
      name: 'b',
      nested: { value: 1 },
      added: true,
    });
    expect(original.saveVersion).toBe(0);
    expect(migrate(result, [], 2)).toEqual(result);
  });
  it('odrzuca nowszą/nieprawidłową wersję i brakującą migrację', () => {
    expect(() => migrate({ saveVersion: 2 }, [], 1)).toThrow('nowszej');
    expect(() => migrate({ saveVersion: 0 }, [], 1)).toThrow('Brak migracji');
    expect(() => migrate({ saveVersion: -1 }, [], 1)).toThrow('Nieprawidłowa');
    expect(() => migrate({}, [], 1)).toThrow();
  });
});

describe.each([
  ['pamięć', () => createMemorySaveStore()],
  ['IndexedDB', () => createIndexedDbSaveStore(databaseName())],
] as const)('SaveStore: %s', (_name, create: () => SaveStore) => {
  it('oddziela meta i run, kopiuje dane i kasuje tylko run', async () => {
    const store = create();
    expect(await store.loadMeta()).toBeNull();
    expect(await store.loadRun()).toBeNull();
    const input = { ...meta };
    await store.saveMeta(input);
    input.updatedAt = 999;
    await store.saveRun(run);
    expect(await store.loadMeta()).toEqual(meta);
    expect(await store.loadRun()).toEqual(run);
    const loaded = await store.loadMeta();
    if (loaded) loaded.updatedAt = 888;
    expect(await store.loadMeta()).toEqual(meta);
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toEqual(meta);
  });
  it('odrzuca zapis niezgodny z bieżącym schematem', async () => {
    const store = create();
    // Funkcje fabryki zwracają Promise, walidacja może odrzucić także synchronicznie.
    await expect(async () =>
      store.saveMeta({ ...meta, saveVersion: SAVE_VERSION + 1 }),
    ).rejects.toThrow();
  });
});

describe('IndexedDB', () => {
  it('odczytuje dane przez inną instancję i migruje wersję 0', async () => {
    const name = databaseName();
    await rawSave(name, 'meta', { ...meta, saveVersion: 0 });
    expect(await createIndexedDbSaveStore(name).loadMeta()).toEqual(meta);
    await createIndexedDbSaveStore(name).saveRun(run);
    expect(await createIndexedDbSaveStore(name).loadRun()).toEqual(run);
  });
  it('odrzuca nowszy zapis z ostrzeżeniem, bez nadpisania i kasowania', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    await rawSave(name, 'run', { ...run, saveVersion: 99 });
    await rawSave(name, 'meta', { ...meta, saveVersion: 99 });
    const store = createIndexedDbSaveStore(name);
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toBeNull();
    await expect(store.saveRun(run)).rejects.toThrow('nowszej');
    await expect(store.saveMeta(meta)).rejects.toThrow('nowszej');
    await expect(store.clearRun()).rejects.toThrow('nowszej');
    expect(warning).toHaveBeenCalled();
    // Brak zmiany danych pozwala ponownie stwierdzić konflikt wersji.
    expect(await store.loadRun()).toBeNull();
    await expect(store.saveRun(run)).rejects.toThrow('nowszej');
  });
  it('niepoprawny zapis zwraca null i ostrzeżenie', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    await rawSave(name, 'meta', { saveVersion: 1, createdAt: 'invalid' });
    expect(await createIndexedDbSaveStore(name).loadMeta()).toBeNull();
  });
});

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('settings', () => {
  it('zapisuje ustawienia i wraca do domyślnych przy błędnym JSON, brakujących lub błędnych danych', () => {
    const storage = memoryStorage();
    const defaults = loadSettings(storage);
    expect(defaults).toEqual({ mouseSensitivity: 1, fov: 90, masterVolume: 1 });
    const settings = { mouseSensitivity: 2, fov: 80, masterVolume: 0.5 };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
    storage.setItem('neoryder.settings', '{broken');
    expect(loadSettings(storage)).toEqual(defaults);
    storage.setItem('neoryder.settings', '{"masterVolume":0.3}');
    expect(loadSettings(storage)).toEqual({ ...defaults, masterVolume: 0.3 });
    storage.setItem('neoryder.settings', '{"fov":-1}');
    expect(loadSettings(storage)).toEqual(defaults);
  });
  it('działa przy braku/dostępie odmówionym do localStorage', () => {
    expect(loadSettings().fov).toBe(90);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSettings(loadSettings());
    expect(warning).toHaveBeenCalled();
  });
});
