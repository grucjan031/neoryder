import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
  SAVE_VERSION,
  type MissionSave,
} from '../../src/core/save';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { EventBus } from '../../src/core/events';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const checkpoint: MissionSave = {
  saveVersion: SAVE_VERSION,
  attemptId: 'mission-attempt',
  missionId: 'm01-maszty',
  levelId: 'm01-maszty',
  seed: 'checkpoint-unit',
  checkpointId: 'po-maszcie-1',
  objectives: { 'mast-1': 'done', 'mast-2': 'pending' },
  completedEncounters: ['patrol-wejscie'],
  elapsedS: 42,
  completed: false,
  loadout: loadoutDefinitions.get('classic')!,
  talents: [],
  implants: [],
  threatLevel: 0,
};

it.each([
  { ids: ['pierce', 'ricochet'], expected: ['pierce'] },
  { ids: ['unknown', 'incendiary'], expected: ['incendiary'] },
])(
  'wczytuje stary run i checkpoint z modułami $ids i pozwala kontynuować',
  async ({ ids, expected }) => {
    const name = `old-module-save-${ids.join('-')}`;
    const manager = new RunManager(new EventBus(), {
      generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
    });
    manager.newRun('old-module-save', 'classic');
    const run = manager.serialize();
    run.loadout.modules = { blaster: ids };
    manager.dispose();
    const mission = {
      ...checkpoint,
      saveVersion: 6,
      loadout: { ...checkpoint.loadout, modules: { blaster: ids } },
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readwrite');
        const saves = tx.objectStore('saves');
        saves.put({ saveVersion: 6, seed: run.seed, startedAt: 1, run }, 'run');
        saves.put(mission, 'mission');
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
    const store = createIndexedDbSaveStore(name);
    const loaded = await store.loadRun();
    expect(loaded).not.toBeNull();
    expect(loaded!.run.loadout.modules).toEqual({ blaster: expected });
    expect(await store.loadMission!()).toEqual({
      ...mission,
      saveVersion: SAVE_VERSION,
      loadout: { ...mission.loadout, modules: { blaster: expected } },
    });
    const restored = new RunManager(new EventBus());
    try {
      restored.restore(loaded!.run);
      expect(restored.active).toBe(true);
      expect(restored.selectNode(restored.availableNodes()[0]!.id)).toBe(true);
      expect(restored.screen).toBe('room');
    } finally {
      restored.dispose();
    }
    expect(run.loadout.modules.blaster).toEqual(ids);
  },
);

it.each(['memory', 'indexeddb'])(
  'zapisuje osobny checkpoint, zwraca kopię i usuwa go bez zmiany meta (%s)',
  async (kind) => {
    const store =
      kind === 'memory'
        ? createMemorySaveStore()
        : createIndexedDbSaveStore('linear-checkpoint-roundtrip');
    const meta = {
      saveVersion: SAVE_VERSION,
      createdAt: 1,
      updatedAt: 2,
      meta: createStarterMetaState(),
    };
    await store.saveMeta(meta);
    await store.saveMission!(checkpoint);
    const loaded = await store.loadMission!();
    expect(loaded).toEqual(checkpoint);
    loaded!.objectives['mast-1'] = 'pending';
    expect((await store.loadMission!())?.objectives['mast-1']).toBe('done');
    expect(await store.loadRun()).toBeNull();
    await store.clearMission!();
    expect(await store.loadMission!()).toBeNull();
    expect(await store.loadMeta()).toEqual(meta);
  },
);

it('migruje v4→v5 bez utraty kampanii, wyposażenia i aktywnego zwykłego runu; checkpoint początkowo nie istnieje', async () => {
  const name = 'linear-migration-v4';
  const meta = createStarterMetaState();
  meta.data = 321;
  meta.campaign.completed = ['m01-maszty'];
  meta.appliedRunIds = ['older-attempt'];
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  manager.newRun('preserved-run', 'classic');
  const run = manager.serialize();
  manager.dispose();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(
        { saveVersion: 4, createdAt: 1, updatedAt: 2, meta },
        'meta',
      );
      tx.objectStore('saves').put(
        { saveVersion: 4, seed: run.seed, startedAt: 1, run },
        'run',
      );
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
  const store = createIndexedDbSaveStore(name);
  expect(await store.loadMetaStrict!()).toEqual({
    saveVersion: SAVE_VERSION,
    createdAt: 1,
    updatedAt: 2,
    meta,
  });
  expect(await store.loadRun()).toEqual({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: 1,
    run,
  });
  expect(await store.loadMission!()).toBeNull();
  await store.saveMission!(checkpoint);
  expect((await store.loadRun())?.run).toEqual(run);
});
