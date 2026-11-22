// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeEndless } from '../../src/core/endlessSave';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
  SAVE_VERSION,
} from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { Arena } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import {
  endless,
  endlessImplantOffers,
  endlessMutator,
  endlessRewardRooms,
  endlessSpawnModifiers,
  planEndlessWave,
} from '../../src/world/endless';
import { WaveDirector } from '../../src/world/waves';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

it('skład i mutatory są deterministyczne, a trudność rośnie po nasyceniu kolejki', () => {
  const rng = new Rng('strefa');
  const plan = (wave: number) =>
    planEndlessWave(wave, rng.fork(String(wave)), 0.7);
  expect(plan(1).groups).toEqual([
    { enemy: 'assaulter', count: endless.baseCount },
  ]);
  expect(plan(5)).toEqual(plan(5));
  expect(plan(5).groups).toContainEqual({
    enemy: endless.eliteEnemy,
    count: 1,
  });
  expect(plan(6).groups.map(({ enemy }) => enemy)).not.toContain(
    endless.eliteEnemy,
  );
  expect(plan(1000).groups.reduce((sum, { count }) => sum + count, 0)).toBe(
    endless.maxCount + 1,
  );
  expect(endlessSpawnModifiers(1001)[0]!.value).toBeGreaterThan(
    endlessSpawnModifiers(1000)[0]!.value,
  );
  expect(endlessMutator(2, rng)).toBeNull();
  expect(endlessMutator(3, rng)).not.toBeNull();
  expect(endlessMutator(3, rng)).toEqual(endlessMutator(5, rng));
  const offers = endlessImplantOffers(3, [], rng).map(({ id }) => id);
  expect(offers).toHaveLength(endless.implantChoices);
  expect(
    endlessImplantOffers(3, offers, rng).some(({ id }) => offers.includes(id)),
  ).toBe(false);
  expect(endlessRewardRooms(4)).toBe(0);
  expect(endlessRewardRooms(5)).toBe(1);
  expect(endlessRewardRooms(1000)).toBe(endless.maxRewardRooms);
});

it('reżyser zamawia kolejne fale po przekroczeniu długości szablonu', () => {
  const bus = new EventBus();
  const rng = new Rng('director');
  const position = { x: 0, y: 0, z: 0 };
  const endlessWave = vi.fn(() => ({
    spawnIntervalS: 0.1,
    groups: [{ enemy: 'assaulter', count: 1 }],
  }));
  let id = 0;
  const cleared: number[] = [];
  bus.on('wave_cleared', ({ wave }) => cleared.push(wave));
  const director = new WaveDirector(
    {
      id: 'test',
      firstBreakS: 0,
      breakS: 0,
      maxAlive: 1,
      minSpawnDistance: 0,
      spawnPoints: [position],
      waves: [endlessWave()],
    },
    {
      difficulty: 'normal',
      endlessWave,
      spawn: () => ++id,
      playerPosition: () => position,
    },
    bus,
    rng,
  );
  director.start();
  for (let i = 1; i <= 15; i++) {
    director.step(SIM_DT);
    director.step(SIM_DT);
    expect(director.spawnLog).toHaveLength(1);
    expect(director.spawnLog[0]?.wave).toBe(i);
    bus.emit('enemy_killed', { id, killer: null, tags: [] });
  }
  expect(cleared).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  expect(endlessWave).toHaveBeenLastCalledWith(15, 1);
  expect(director.currentPhase).toBe('break');
  director.dispose();
});

it('IndexedDB zachowuje najwyższą falę i rozstrzyga remis krótszym czasem w transakcji', async () => {
  const name = 'test-endless-score';
  const first = createIndexedDbSaveStore(name);
  const second = createIndexedDbSaveStore(name);
  const updateMeta = vi.fn(
    (save: Awaited<ReturnType<typeof first.loadMeta>>) => ({
      saveVersion: SAVE_VERSION,
      createdAt: 0,
      updatedAt: 1,
      meta: {
        ...(save?.meta ?? createStarterMetaState()),
        xp: (save?.meta.xp ?? 0) + 25,
      },
    }),
  );
  await first.challenge!.begin('2026-11-22');
  await Promise.all([
    first.endless!.finish({ wave: 5, elapsedS: 153 }, updateMeta),
    second.endless!.finish({ wave: 5, elapsedS: 149 }, updateMeta),
    first.endless!.finish({ wave: 4, elapsedS: 79 }),
  ]);
  expect(await createIndexedDbSaveStore(name).endless!.loadBest()).toEqual({
    wave: 5,
    elapsedS: 149,
  });
  expect((await second.loadMeta())?.meta.xp).toBe(50);
  expect(await second.challenge!.loadHistory()).toEqual({ '2026-11-22': null });
  await expect(
    second.endless!.finish({ wave: 6, elapsedS: 200 }, () => {
      throw new Error('meta');
    }),
  ).rejects.toThrow('meta');
  expect(await first.endless!.loadBest()).toEqual({ wave: 5, elapsedS: 149 });
});

const active: Arena[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

async function setupArena() {
  const store = createMemorySaveStore();
  const bus = new EventBus();
  let playerId = 0;
  bus.on('entity_spawned', ({ id, kind }) => {
    if (kind === 'player') playerId = id;
  });
  const commands = new CommandRegistry();
  const scene = new Arena(false, false, 'endless', store.endless);
  const settings = structuredClone(tuning);
  settings.endless.firstBreakS = 0;
  settings.endless.breakS = 0;
  settings.endless.spawnIntervalS = SIM_DT;
  await scene.init(
    {
      bus,
      rng: new Rng('endless-integration'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: settings,
      debug: true,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active.push(scene);
  return {
    scene,
    commands,
    bus,
    store,
    die: () => bus.emit('player_died', { id: playerId }),
    step(steps = 1) {
      for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    },
  };
}

it('po trzeciej fali wybór implantu zatrzymuje czas, a walka kontynuuje numerację i mutator', async () => {
  const { scene, commands, store, step, die } = await setupArena();
  expect(commands.execute('endless wave 3')).toBe('Fala 3.');
  step(15);
  expect(scene.query('phase')).toBe('fighting');
  commands.execute('kill all');
  step();
  const before = scene.query('endless');
  expect(scene.query('state')).toBe('intermission');
  step(60);
  expect(scene.query('endless')).toEqual(before);
  expect(document.querySelectorAll('.run-screen__card')).toHaveLength(3);
  document.querySelector<HTMLButtonElement>('.run-screen__card')!.click();
  step();
  expect(scene.query('endless')).toMatchObject({
    wave: 4,
    implants: [expect.any(String)],
    practice: true,
  });
  expect(scene.query('mutator')).not.toBeNull();
  die();
  expect(scene.query('endless')).toMatchObject({ settlement: 'practice' });
  expect(await store.endless!.loadBest()).toBeNull();
  expect(await store.loadMeta()).toBeNull();
});

it('śmierć rozlicza próbę jeden raz, aktualizuje rekord i pozwala zagrać od nowa', async () => {
  const { scene, bus, store, step, die } = await setupArena();
  step(10);
  bus.emit('wave_cleared', { wave: 100 });
  die();
  die();
  await vi.waitFor(() =>
    expect(scene.query('endless')).toMatchObject({ settlement: 'saved' }),
  );
  expect(await store.endless!.loadBest()).toEqual({
    wave: 100,
    elapsedS: 10 * SIM_DT,
  });
  const meta = await store.loadMeta();
  expect(meta?.meta).toMatchObject({
    xp: 50,
    data: 10,
    cores: 0,
    appliedRunIds: [expect.any(String)],
  });
  document.querySelector<HTMLButtonElement>('[data-action=retry]')!.click();
  expect(scene.query('endless')).toMatchObject({
    wave: 0,
    score: { wave: 0, elapsedS: 0 },
    implants: [],
  });
});

describe('rekord endless: odczyt', () => {
  it('brak rekordu to pusty rekord, a poprawny odczytuje się bez zmian', async () => {
    const store = createMemorySaveStore();
    expect(await store.endless!.loadBest()).toBeNull();
    expect(decodeEndless(undefined)).toEqual({ status: 'ok', best: null });
    expect(
      decodeEndless({ endlessVersion: 1, best: { wave: 3, elapsedS: 10 } }),
    ).toEqual({ status: 'ok', best: { wave: 3, elapsedS: 10 } });
  });

  it('zepsuty rekord jest wykrywany, nowszy osobno', () => {
    expect(
      decodeEndless({ endlessVersion: 1, best: { wave: -1 } }).status,
    ).toBe('corrupt');
    expect(decodeEndless('x').status).toBe('corrupt');
    expect(
      decodeEndless({ endlessVersion: 2, best: { wave: 9, elapsedS: 1 } })
        .status,
    ).toBe('future');
  });
});

function rawPut(name: string, key: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(data, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

describe('rekord endless: zepsuty i nowszy w IndexedDB', () => {
  it('loadBest daje pusty rekord i ostrzeżenie, a finish przy nowszym odmawia bez ruszania meta', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const corruptName = 'test-endless-corrupt';
    await rawPut(corruptName, 'endless', { endlessVersion: 1, best: 'x' });
    const corrupt = createIndexedDbSaveStore(corruptName);
    expect(await corrupt.endless!.loadBest()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);

    const futureName = 'test-endless-future';
    const future = { endlessVersion: 2, best: { wave: 9, elapsedS: 1 } };
    await rawPut(futureName, 'endless', future);
    const store = createIndexedDbSaveStore(futureName);
    expect(await store.endless!.loadBest()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    const updateMeta = vi.fn(() => null);
    await expect(
      store.endless!.finish({ wave: 12, elapsedS: 5 }, updateMeta),
    ).rejects.toThrow();
    expect(updateMeta).not.toHaveBeenCalled();
    expect(await store.loadMeta()).toBeNull();
    warn.mockRestore();
  });
});

describe('skalowanie fali przez trudność', () => {
  it('łączna liczba wrogów nie przekracza limitu, a Egzekutor jest jeden', () => {
    const wave = planEndlessWave(100, new Rng('cap'), 0.7, 1.5);
    const total = wave.groups.reduce((sum, { count }) => sum + count, 0);
    expect(total).toBe(endless.maxCount + 1);
    expect(
      wave.groups.find(({ enemy }) => enemy === endless.eliteEnemy),
    ).toEqual({ enemy: endless.eliteEnemy, count: 1 });
  });

  it('reżyser w endless nie mnoży grup drugi raz', () => {
    const bus = new EventBus();
    const position = { x: 0, y: 0, z: 0 };
    const director = new WaveDirector(
      {
        id: 'test',
        firstBreakS: 0,
        breakS: 0,
        maxAlive: 50,
        minSpawnDistance: 0,
        spawnPoints: [position],
        waves: [{ spawnIntervalS: 0, groups: [] }],
      },
      {
        difficulty: 'nightmare',
        endlessWave: () => ({
          spawnIntervalS: 0,
          groups: [{ enemy: 'executor', count: 1 }],
        }),
        spawn: () => 1,
        playerPosition: () => position,
      },
      bus,
      new Rng('x'),
    );
    director.start();
    for (let i = 0; i < 20; i++) director.step(SIM_DT);
    expect(director.spawnLog).toHaveLength(1);
    director.dispose();
  });
});

describe('Nieskończona strefa: poprawki przeglądu', () => {
  it('odznaki implantów znikają po ponownej próbie', async () => {
    const { scene, commands, step, die } = await setupArena();
    commands.execute('endless wave 3');
    step(15);
    commands.execute('kill all');
    step();
    document.querySelector<HTMLButtonElement>('.run-screen__card')!.click();
    step();
    expect(document.querySelectorAll('.run-hud__implant')).toHaveLength(1);
    die();
    document.querySelector<HTMLButtonElement>('[data-action=retry]')!.click();
    expect(scene.query('endless')).toMatchObject({ implants: [] });
    expect(document.querySelectorAll('.run-hud__implant')).toHaveLength(0);
  });

  it('mutator następnej fali działa już w przerwie przed nią', async () => {
    const { scene, bus, step } = await setupArena();
    step(2);
    expect(scene.query('mutator')).toBeNull();
    bus.emit('wave_cleared', { wave: 5 });
    expect(scene.query('mutator')).not.toBeNull();
  });

  it('klatki hitstopu nie wydłużają czasu próby', async () => {
    const { scene, step } = await setupArena();
    step(5);
    const before = scene.query('endless');
    for (let i = 0; i < 10; i++) scene.step(0, idle);
    expect(scene.query('endless')).toEqual(before);
  });

  it('ekwipunek nie otwiera się nad oczekującym wyborem implantu', async () => {
    const { scene, bus } = await setupArena();
    bus.emit('wave_cleared', { wave: 3 });
    scene.step(SIM_DT, { ...idle, pressed: new Set(['inventory']) });
    expect(document.querySelector('.run-inventory')).toBeNull();
    expect(scene.query('state')).toBe('intermission');
  });
});
