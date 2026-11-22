import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { localChallengeDate } from '../../src/core/challengeDate';
import { CHALLENGE_VERSION } from '../../src/core/challengeSave';
import type { ChallengeResult } from '../../src/core/challengeSave';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
} from '../../src/core/save';
import { dailyChallenge } from '../../src/world/dailyChallenge';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const result: ChallengeResult = {
  outcome: 'victory',
  elapsedS: 123.5,
  kills: 7,
  roomsCleared: 4,
};

function raw(name: string, key: string, data?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        'saves',
        data === undefined ? 'readonly' : 'readwrite',
      );
      const store = tx.objectStore('saves');
      const get =
        data === undefined ? store.get(key) : (store.put(data, key), null);
      tx.oncomplete = () => {
        db.close();
        resolve(get?.result);
      };
      tx.onabort = () => reject(tx.error);
    };
  });
}

function allKeys(name: string): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const keys = db.transaction('saves').objectStore('saves').getAllKeys();
      keys.onsuccess = () => {
        db.close();
        resolve(keys.result);
      };
    };
  });
}

describe('seed wyzwania z daty', () => {
  it('ta sama data daje ten sam seed, inna data inny', () => {
    const a = localChallengeDate(new Date(2026, 10, 22, 0, 5));
    const b = localChallengeDate(new Date(2026, 10, 22, 23, 55));
    const c = localChallengeDate(new Date(2026, 10, 23, 0, 5));
    expect(a).toBe('2026-11-22');
    expect(b).toBe(a);
    expect(c).not.toBe(a);
  });

  it('seed z daty generuje powtarzalną mapę, a inny dzień inną', () => {
    const map = (seed: string) =>
      JSON.stringify(generateSectorMap(kuroganeSector, seed));
    expect(map('2026-11-22')).toBe(map('2026-11-22'));
    expect(map('2026-11-22')).not.toBe(map('2026-11-23'));
  });

  it('dane wyzwania przechodzą walidację', () => {
    expect(dailyChallenge.loadoutId).toBeTruthy();
  });
});

describe.each([
  ['pamięć', () => ({ store: createMemorySaveStore() })],
  [
    'IndexedDB',
    () => {
      const name = `challenge-${Math.random()}`;
      return { store: createIndexedDbSaveStore(name), name };
    },
  ],
])('historia wyzwania (%s)', (_label, make) => {
  it('brak rekordu daje pustą historię', async () => {
    expect(await make().store.challenge!.loadHistory()).toEqual({});
  });

  it('jeden run dziennie', async () => {
    const port = make().store.challenge!;
    expect(await port.begin('2026-11-22')).toBe(true);
    expect(await port.begin('2026-11-22')).toBe(false);
    expect(await port.begin('2026-11-23')).toBe(true);
  });

  it('zapisuje i odczytuje wynik; drugi zapis jest ignorowany', async () => {
    const port = make().store.challenge!;
    await port.begin('2026-11-22');
    expect(await port.loadHistory()).toEqual({ '2026-11-22': null });
    await port.finish('2026-11-22', result);
    await port.finish('2026-11-22', { ...result, kills: 99 });
    expect(await port.loadHistory()).toEqual({ '2026-11-22': result });
  });

  it('odrzuca wynik bez rozpoczętej próby i złą datę', async () => {
    const port = make().store.challenge!;
    await expect(port.finish('2026-11-22', result)).rejects.toThrow();
    await expect(port.begin('jutro')).rejects.toThrow();
  });
});

describe('rekord challenge w IndexedDB', () => {
  it('ma własną wersję i nie dotyka SAVE_VERSION', async () => {
    const name = `challenge-${Math.random()}`;
    await createIndexedDbSaveStore(name).challenge!.begin('2026-11-22');
    expect(await raw(name, 'challenge')).toEqual({
      challengeVersion: CHALLENGE_VERSION,
      history: { '2026-11-22': null },
    });
  });

  it('zepsuty rekord: pusta historia, kopia zapasowa, zapis działa', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const name = `challenge-${Math.random()}`;
    const broken = { challengeVersion: 1, history: { zły: 5 } };
    await raw(name, 'challenge', broken);
    const port = createIndexedDbSaveStore(name).challenge!;
    expect(await port.loadHistory()).toEqual({});
    expect(await port.begin('2026-11-22')).toBe(true);
    expect(await port.loadHistory()).toEqual({ '2026-11-22': null });
    const keys = await allKeys(name);
    expect(keys.some((k) => Array.isArray(k) && k[1] === 'challenge')).toBe(
      true,
    );
  });

  it('rekord z nowszej wersji jest chroniony przed zapisem', async () => {
    const name = `challenge-${Math.random()}`;
    const future = { challengeVersion: CHALLENGE_VERSION + 1, history: {} };
    await raw(name, 'challenge', future);
    const port = createIndexedDbSaveStore(name).challenge!;
    expect(await port.loadHistory()).toEqual({});
    await expect(port.begin('2026-11-22')).rejects.toThrow();
    expect(await raw(name, 'challenge')).toEqual(future);
  });
});
