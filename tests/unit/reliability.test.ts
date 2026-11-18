import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbSaveStore, SAVE_VERSION } from '../../src/core/save';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { RunManager } from '../../src/world/run';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Heist } from '../../src/world/heist';
import { Assault } from '../../src/world/assault';
import { heistDefinition, assaultDefinition } from '../../src/world/modes';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

afterEach(() => vi.restoreAllMocks());

async function database() {
  const name = `reliability-${crypto.randomUUID()}`;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    store: createIndexedDbSaveStore(name),
    put: (key: string, value: unknown) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
      }),
    entries: () =>
      new Promise<{ keys: IDBValidKey[]; values: unknown[] }>((resolve) => {
        const tx = db.transaction('saves');
        const keys = tx.objectStore('saves').getAllKeys();
        const values = tx.objectStore('saves').getAll();
        tx.oncomplete = () =>
          resolve({ keys: keys.result, values: values.result as unknown[] });
      }),
    close: () => db.close(),
  };
}

function fixtures(version: number) {
  const manager = new RunManager(
    new EventBus(),
    (seed) => generateSectorMap(kuroganeSector, seed),
    { now: () => 300 },
  );
  manager.newRun('fixture', 'classic');
  manager.creditKill(3);
  const state = manager.serialize();
  manager.dispose();
  const meta = createStarterMetaState();
  meta.xp = 123;
  meta.data = 45;
  meta.cores = 2;
  const historicalMeta: Record<string, unknown> = { ...meta };
  if (version < 5) delete historicalMeta.achievements;
  if (version < 4) delete historicalMeta.campaign;
  const historicalRun: Record<string, unknown> = { ...state };
  if (version < 3) {
    delete historicalRun.loadout;
    delete historicalRun.talents;
    delete historicalRun.threatLevel;
  }
  return {
    meta: {
      saveVersion: version,
      createdAt: 100,
      updatedAt: 200,
      ...(version >= 3 ? { meta: historicalMeta } : {}),
    },
    run: {
      saveVersion: version,
      seed: state.seed,
      startedAt: state.startedAtMs,
      ...(version >= 2 ? { run: historicalRun } : {}),
    },
    current: {
      saveVersion: SAVE_VERSION,
      seed: state.seed,
      startedAt: state.startedAtMs,
      run: state,
    },
  };
}

describe('Niezawodność zapisu', () => {
  it.each(Array.from({ length: SAVE_VERSION - 1 }, (_, i) => i + 1))(
    'migruje realistyczne fixtures v%i bez utraty istniejącego postępu',
    async (version) => {
      const db = await database();
      const fixture = fixtures(version);
      await db.put('meta', fixture.meta);
      await db.put('run', fixture.run);
      const meta = await db.store.loadMeta();
      expect(meta).toMatchObject({
        saveVersion: SAVE_VERSION,
        createdAt: 100,
        updatedAt: 200,
      });
      expect(meta?.meta).toMatchObject(
        version >= 3
          ? { xp: 123, data: 45, cores: 2 }
          : createStarterMetaState(),
      );
      const run = await db.store.loadRun();
      if (version === 1)
        expect(run).toBeNull(); // v1 nie zawierał stanu gry.
      else expect(run).toEqual(fixture.current);
      db.close();
    },
  );

  it.each(['meta', 'run', 'mission'] as const)(
    'chroni przyszły %s przed zapisem i kasowaniem',
    async (key) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = await database();
      const future = { saveVersion: SAVE_VERSION + 1, progress: 'future' };
      await db.put(key, future);
      const read =
        key === 'meta'
          ? db.store.loadMeta
          : key === 'run'
            ? db.store.loadRun
            : db.store.loadMission!;
      expect(await read()).toBeNull();
      if (key === 'run') {
        await expect(
          db.store.saveRun(fixtures(SAVE_VERSION).current),
        ).rejects.toThrow('nowszej');
        await expect(db.store.clearRun()).rejects.toThrow('nowszej');
      } else if (key === 'mission')
        await expect(db.store.clearMission!()).rejects.toThrow('nowszej');
      else
        await expect(
          db.store.saveMeta({
            saveVersion: SAVE_VERSION,
            createdAt: 1,
            updatedAt: 2,
            meta: createStarterMetaState(),
          }),
        ).rejects.toThrow('nowszej');
      expect((await db.entries()).values).toEqual([future]);
      db.close();
    },
  );

  it.each(['{broken', { saveVersion: SAVE_VERSION }])(
    'zachowuje uszkodzony rekord i tworzy osobną kopię: %j',
    async (broken) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = await database();
      for (const key of ['meta', 'run', 'mission']) await db.put(key, broken);
      expect(await db.store.loadMeta()).toBeNull();
      expect(await db.store.loadRun()).toBeNull();
      expect(await db.store.loadMission!()).toBeNull();
      const entries = await db.entries();
      expect(entries.keys.filter(Array.isArray)).toHaveLength(3);
      expect(entries.values).toEqual(Array.from({ length: 6 }, () => broken));
      db.close();
    },
  );

  it('wycofuje podmianę rekordu po przerwaniu transakcji IndexedDB', async () => {
    const db = await database();
    const old = fixtures(SAVE_VERSION).current;
    await db.store.saveRun(old);
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      const request = put.call(this, value, key);
      this.transaction.abort();
      return request;
    });
    await expect(
      db.store.saveRun({ ...old, run: { ...old.run, credits: 999 } }),
    ).rejects.toBeDefined();
    vi.restoreAllMocks();
    expect(await db.store.loadRun()).toEqual(old);
    db.close();
  });
});

it('pauza zatrzymuje czas Kradzieży rdzenia i odrodzenie Szturmu', () => {
  const heist = new Heist(heistDefinition);
  const assault = new Assault(assaultDefinition, {
    signal: vi.fn(),
    explode: vi.fn(),
  });
  assault.died();
  const loop = new GameLoop({
    step: (dt) => {
      heist.step(dt, heistDefinition.extraction, []);
      assault.stepRespawn(dt);
    },
    render: () => {},
  });
  loop.advance(SIM_DT * 1000);
  const before = [heist.elapsedS, assault.respawnRemainingS];
  expect(before[0]).toBeGreaterThan(0);
  loop.paused = true;
  loop.advance(5000);
  expect([heist.elapsedS, assault.respawnRemainingS]).toEqual(before);
  loop.paused = false;
  loop.advance(SIM_DT * 1000);
  expect(heist.elapsedS).toBeGreaterThan(before[0]!);
  expect(assault.respawnRemainingS).toBeLessThan(before[1]!);
});

it('wznowienie bez klatek w tle nie nadrabia ukrytych pięciu sekund', () => {
  let now = 0;
  let frame: (ms: number) => void = () => {};
  const step = vi.fn();
  const loop = new GameLoop(
    { step, render: () => {} },
    {
      clock: { now: () => now },
      scheduler: {
        request: (cb) => {
          frame = cb;
          return 1;
        },
        cancel: () => {},
      },
    },
  );
  loop.start();
  loop.paused = true;
  now = 5000;
  loop.paused = false;
  frame(now);
  expect(step).not.toHaveBeenCalled();
  now += 20;
  frame(now);
  expect(step).toHaveBeenCalledTimes(1);
  loop.stop();
});
