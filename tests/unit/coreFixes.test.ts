import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeStat } from '../../src/core/stats';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('computeStat: wartości graniczne', () => {
  it('dwa ujemne czynniki nie dają dodatniego wyniku', () => {
    const mods = [
      { stat: 'damage', type: 'flat', value: -50, source: 'a' },
      { stat: 'damage', type: 'percent', value: -2, source: 'b' },
    ] as const;
    expect(computeStat(10, mods)).toBe(0);
  });
  it('NaN i Infinity nie trafiają do cache statystyk', () => {
    const nan = [{ stat: 'damage', type: 'mult', value: NaN, source: 'a' }];
    expect(computeStat(10, nan as never)).toBe(0);
    expect(computeStat(NaN, [])).toBe(0);
  });
});

describe('saveSettings i współdzielone ustawienia', () => {
  it('loadSettings po saveSettings zwraca zapisane ustawienia', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const save = await import('../../src/core/save');
    const first = save.loadSettings();
    save.saveSettings({ ...first, difficulty: 'hard' });
    expect(save.loadSettings().difficulty).toBe('hard');
  });
});

describe('kopia uszkodzonego zapisu', () => {
  it('działa bez crypto.randomUUID (kontekst niezabezpieczony)', async () => {
    const name = 'core-fixes-corrupt';
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(
          { saveVersion: 1, meta: 'zepsute' },
          'meta',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
    vi.stubGlobal('crypto', {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createIndexedDbSaveStore } = await import('../../src/core/save');
    const store = createIndexedDbSaveStore(name);
    await expect(store.loadMeta()).resolves.toBeNull();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const get = req.result
          .transaction('saves', 'readonly')
          .objectStore('saves')
          .getAllKeys();
        get.onsuccess = () => resolve(get.result);
      };
    });
    expect(keys.some((k) => Array.isArray(k) && k[0] === 'corrupt')).toBe(true);
  });
});
