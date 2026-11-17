import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { RunState } from '../../src/core/runTypes';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
  loadSettings,
  migrate,
  SAVE_VERSION,
  saveSettings,
} from '../../src/core/save';
import type { MetaSave, RunSave, SaveStore } from '../../src/core/save';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

function createSampleRunState(seed = 'test-seed'): RunState {
  const bus = new EventBus();
  const manager = new RunManager(
    bus,
    (s) => generateSectorMap(kuroganeSector, s),
    {
      sector: kuroganeSector,
      now: () => 300,
    },
  );
  manager.newRun(seed, 'classic');
  const firstNode = manager.availableNodes()[0]!;
  manager.selectNode(firstNode.id);
  manager.step(18.5);
  manager.creditKill(2);
  manager.addImplant('overclock');
  bus.emit('damage_dealt', {
    source: 1,
    target: 2,
    amount: 75,
    tags: ['#melee'],
    point: null,
    dir: null,
    knockback: 0,
    killed: true,
  });
  bus.emit('enemy_killed', { id: 2, killer: 1, tags: ['#melee'] });
  manager.completeRoom({ hp: 82, energy: 65 });
  manager.returnToMap();
  const snapshot = manager.serialize();
  manager.dispose();
  return snapshot;
}

const meta: MetaSave = {
  saveVersion: SAVE_VERSION,
  createdAt: 100,
  updatedAt: 200,
  meta: createStarterMetaState(),
};
const run: RunSave = {
  saveVersion: SAVE_VERSION,
  seed: 'test-seed',
  startedAt: 300,
  run: createSampleRunState('test-seed'),
};
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

async function rawRead(name: string, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('saves');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readonly');
      const getReq = tx.objectStore('saves').get(key);
      tx.oncomplete = () => {
        db.close();
        resolve(getReq.result as unknown);
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
    const runInput = structuredClone(run);
    await store.saveRun(runInput);
    runInput.run.hp = 1;
    runInput.run.visited.push('mutated');
    expect(await store.loadMeta()).toEqual(meta);
    expect(await store.loadRun()).toEqual(run);
    const loaded = await store.loadMeta();
    if (loaded) loaded.updatedAt = 888;
    const loadedRun = await store.loadRun();
    if (loadedRun) {
      loadedRun.run.credits = 9999;
      loadedRun.run.implants.push('mutated');
    }
    expect(await store.loadMeta()).toEqual(meta);
    expect(await store.loadRun()).toEqual(run);
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toEqual(meta);
  });

  it('wykonuje pełny round-trip RunState przez RunManager.serialize i restore', async () => {
    const store = create();
    const state = createSampleRunState('roundtrip-seed');
    const savePayload: RunSave = {
      saveVersion: SAVE_VERSION,
      seed: state.seed,
      startedAt: state.startedAtMs,
      run: state,
    };

    await store.saveRun(savePayload);
    const loaded = await store.loadRun();
    expect(loaded).not.toBeNull();
    expect(loaded?.saveVersion).toBe(SAVE_VERSION);
    expect(loaded?.run).toEqual(state);

    const bus = new EventBus();
    const restoredManager = new RunManager(bus, (s) =>
      generateSectorMap(kuroganeSector, s),
    );
    const restoredState = restoredManager.restore(loaded!.run);
    expect(restoredState).toEqual(state);
    expect(restoredManager.serialize()).toEqual(state);
    expect(restoredManager.screen).toBe('map');
    restoredManager.dispose();
  });

  it('odrzuca zapis niezgodny z bieżącym schematem', async () => {
    const store = create();
    // Funkcje fabryki zwracają Promise, walidacja może odrzucić także synchronicznie.
    await expect(async () =>
      store.saveMeta({ ...meta, saveVersion: SAVE_VERSION + 1 }),
    ).rejects.toThrow();
    await expect(async () =>
      store.saveRun({
        ...run,
        run: { ...run.run, implants: ['dup', 'dup'] },
      }),
    ).rejects.toThrow();
    await expect(async () =>
      store.saveRun({
        ...run,
        run: { ...run.run, currentNodeId: 'L99N99' },
      }),
    ).rejects.toThrow();
  });
});

describe('IndexedDB i migracje v1 -> v2 -> v3', () => {
  it('odczytuje dane przez inną instancję i migruje meta z wersji 0 oraz 1 bez zmian', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name0 = databaseName();
    await rawSave(name0, 'meta', {
      saveVersion: 0,
      createdAt: 100,
      updatedAt: 200,
    });
    expect(await createIndexedDbSaveStore(name0).loadMeta()).toEqual(meta);

    const name1 = databaseName();
    await rawSave(name1, 'meta', {
      saveVersion: 1,
      createdAt: 100,
      updatedAt: 200,
    });
    expect(await createIndexedDbSaveStore(name1).loadMeta()).toEqual(meta);

    await createIndexedDbSaveStore(name1).saveRun(run);
    expect(await createIndexedDbSaveStore(name1).loadRun()).toEqual(run);
    expect(warning).not.toHaveBeenCalled();
  });

  it('traktuje zapis runu v1 (oraz v0) bez stanu RunState jako brak runu (null) i pozwala zapisać nowy run v2', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    await rawSave(name, 'meta', {
      saveVersion: 1,
      createdAt: 100,
      updatedAt: 200,
    });
    await rawSave(name, 'run', {
      saveVersion: 1,
      seed: 'legacy-seed',
      startedAt: 300,
    });

    const store = createIndexedDbSaveStore(name);
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toEqual(meta);
    expect(warning).not.toHaveBeenCalled();

    // Po migracji v1 -> null można normalnie zapisać lub wyczyścić run v2
    await store.saveRun(run);
    expect(await store.loadRun()).toEqual(run);

    // Szkielet v0 runu również migruje do braku runu
    const name0 = databaseName();
    await rawSave(name0, 'run', {
      saveVersion: 0,
      seed: 'v0-seed',
      startedAt: 150,
    });
    expect(await createIndexedDbSaveStore(name0).loadRun()).toBeNull();
    expect(warning).not.toHaveBeenCalled();
  });

  it('odrzuca nowszy zapis z ostrzeżeniem, pozostawiając dane nietknięte bez nadpisania i kasowania', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    const futureRun = { ...run, saveVersion: 99 };
    const futureMeta = { ...meta, saveVersion: 99 };
    await rawSave(name, 'run', futureRun);
    await rawSave(name, 'meta', futureMeta);
    const store = createIndexedDbSaveStore(name);
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toBeNull();
    await expect(store.saveRun(run)).rejects.toThrow('nowszej');
    await expect(store.saveMeta(meta)).rejects.toThrow('nowszej');
    await expect(store.clearRun()).rejects.toThrow('nowszej');
    expect(warning).toHaveBeenCalled();
    // Brak zmiany danych pozwala ponownie stwierdzić konflikt wersji; surowy zapis w bazie jest nietknięty.
    expect(await store.loadRun()).toBeNull();
    await expect(store.saveRun(run)).rejects.toThrow('nowszej');
    expect(await rawRead(name, 'run')).toEqual(futureRun);
    expect(await rawRead(name, 'meta')).toEqual(futureMeta);
  });

  it('uszkodzony zapis meta lub run zwraca null i ostrzeżenie', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();

    // Uszkodzony meta v1
    await rawSave(name, 'meta', { saveVersion: 1, createdAt: 'invalid' });
    expect(await createIndexedDbSaveStore(name).loadMeta()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);

    // Uszkodzony run v2 bez pola run
    await rawSave(name, 'run', {
      saveVersion: 2,
      seed: 'test',
      startedAt: 300,
    });
    expect(await createIndexedDbSaveStore(name).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(2);

    // Uszkodzony run v2 z niepoprawnym RunState (nieznany węzeł currentNodeId)
    await rawSave(name, 'run', {
      ...run,
      run: { ...run.run, currentNodeId: 'INVALID_NODE' },
    });
    expect(await createIndexedDbSaveStore(name).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(3);

    // Uszkodzony run v2 z powtórzonym implantem
    await rawSave(name, 'run', {
      ...run,
      run: { ...run.run, implants: ['impA', 'impA'] },
    });
    expect(await createIndexedDbSaveStore(name).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(4);

    // Uszkodzony run v1 (błędne typy pól szkieletu)
    await rawSave(name, 'run', {
      saveVersion: 1,
      seed: 12345,
      startedAt: 'invalid',
    });
    expect(await createIndexedDbSaveStore(name).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(5);
  });
});

describe('zapis v3: meta-progres F4', () => {
  const progressed = (): MetaSave => {
    const state = createStarterMetaState();
    state.xp = 340;
    state.data = 120;
    state.cores = 2;
    state.talents = ['bladeRoot'];
    state.unlocks.push('weapon:rifle');
    state.threat = { max: 2, selected: 1 };
    state.stats = {
      runs: 1,
      victories: 1,
      deaths: 0,
      kills: 25,
      bestVictoryS: 812.5,
    };
    state.lastRuns = [
      {
        runId: 'seed:300',
        outcome: 'victory',
        elapsedS: 812.5,
        layerReached: 8,
        threatLevel: 1,
        rewards: { xp: 340, data: 120, cores: 2 },
      },
    ];
    state.appliedRunIds = ['seed:300'];
    return { ...meta, meta: state };
  };

  it('round-trip MetaSave v3 w magazynie pamięciowym i IndexedDB zachowuje cały stan meta', async () => {
    for (const store of [
      createMemorySaveStore(),
      createIndexedDbSaveStore(databaseName()),
    ]) {
      expect(await store.loadMeta()).toBeNull();
      await store.saveMeta(progressed());
      expect(await store.loadMeta()).toEqual(progressed());
    }
  });

  it('odrzuca MetaSave bez pola meta albo z niespójnym stanem', async () => {
    const store = createMemorySaveStore();
    const withoutMeta: Record<string, unknown> = { ...progressed() };
    delete withoutMeta.meta;
    await expect(async () =>
      store.saveMeta(withoutMeta as unknown as MetaSave),
    ).rejects.toThrow();
    const broken = progressed();
    broken.meta.threat = { max: 1, selected: 2 };
    await expect(async () => store.saveMeta(broken)).rejects.toThrow();
  });

  it('migruje meta v2 -> v3 do stanu startowego z danych', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    await rawSave(name, 'meta', {
      saveVersion: 2,
      createdAt: 100,
      updatedAt: 200,
    });
    const loaded = await createIndexedDbSaveStore(name).loadMeta();
    expect(loaded).toEqual({
      saveVersion: SAVE_VERSION,
      createdAt: 100,
      updatedAt: 200,
      meta: createStarterMetaState(),
    });
    expect(loaded?.meta.unlocks).toEqual([
      'blade:plasmaBlade',
      'weapon:blaster',
      'weapon:pistol',
      'power:push',
    ]);
    expect(warning).not.toHaveBeenCalled();
  });

  it('migruje run v2 -> v3: ekwipunek z presetu, talents [] i threatLevel 0', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    const legacyState: Record<string, unknown> = {
      ...createSampleRunState('legacy-v2'),
    };
    for (const key of ['loadout', 'talents', 'threatLevel'])
      delete legacyState[key];
    await rawSave(name, 'run', {
      saveVersion: 2,
      seed: 'legacy-v2',
      startedAt: 300,
      run: { ...legacyState, loadoutId: 'bladeDancer' },
    });
    const loaded = await createIndexedDbSaveStore(name).loadRun();
    expect(loaded?.saveVersion).toBe(SAVE_VERSION);
    expect(loaded?.run.loadout).toEqual(loadoutDefinitions.get('bladeDancer'));
    expect(loaded?.run.talents).toEqual([]);
    expect(loaded?.run.threatLevel).toBe(0);
    expect(loaded?.run.loadoutId).toBe('bladeDancer');
    expect(warning).not.toHaveBeenCalled();
  });

  it('run v2 z nieznanym presetem jest nieczytelny (null z ostrzeżeniem), a szkielet v1 nadal daje null bez ostrzeżenia', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const name = databaseName();
    const legacyState: Record<string, unknown> = {
      ...createSampleRunState('x'),
    };
    delete legacyState.loadout;
    await rawSave(name, 'run', {
      saveVersion: 2,
      seed: 'x',
      startedAt: 1,
      run: { ...legacyState, loadoutId: 'missing' },
    });
    expect(await createIndexedDbSaveStore(name).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);

    const v1 = databaseName();
    await rawSave(v1, 'run', { saveVersion: 1, seed: 's', startedAt: 1 });
    expect(await createIndexedDbSaveStore(v1).loadRun()).toBeNull();
    expect(warning).toHaveBeenCalledTimes(1);
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
    expect(defaults).toEqual({
      mouseSensitivity: 1,
      fov: 90,
      masterVolume: 1,
      sfxVolume: 1,
      musicVolume: 0.7,
      invertY: false,
      screenShake: 1,
      flashes: true,
      quality: 'medium',
      bindings: {},
    });
    const settings = {
      ...defaults,
      mouseSensitivity: 2,
      fov: 80,
      masterVolume: 0.5,
    };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
    storage.setItem('neoryder.settings', '{broken');
    expect(loadSettings(storage)).toEqual(defaults);
    storage.setItem('neoryder.settings', '{"masterVolume":0.3}');
    expect(loadSettings(storage)).toEqual({
      ...defaults,
      masterVolume: 0.3,
      quality: 'high',
    });
    storage.setItem('neoryder.settings', '{"fov":-1}');
    expect(loadSettings(storage)).toEqual({
      ...defaults,
      fov: 60,
      quality: 'high',
    });
  });
  it('działa przy braku/dostępie odmówionym do localStorage', () => {
    expect(loadSettings().fov).toBe(90);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveSettings(loadSettings());
    expect(warning).toHaveBeenCalled();
  });
});
