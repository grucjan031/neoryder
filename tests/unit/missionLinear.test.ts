import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import { MissionScene } from '../../src/scenes/mission';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore, type SaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { InputSnapshot } from '../../src/core/input';
import { levelDefinitions } from '../../src/world/levels';
import {
  loadMetaManagerStrict,
  saveMetaManager,
} from '../../src/progression/metaSave';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: MissionScene[] = [];
afterEach(() => active.splice(0).forEach((scene) => scene.dispose()));

async function setup(
  store: SaveStore = createMemorySaveStore(),
  resume = false,
) {
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const navigate = vi.fn();
  const three = new ThreeScene();
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate,
    params: new URLSearchParams(
      `mission=m01-maszty&seed=linear-unit${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('linear-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    three,
  );
  return { scene, commands, bus, store, three, navigate };
}
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    checkpointId: string;
    state: string;
    objectives: Record<string, string>;
    completedEncounters: string[];
    activeEncounters: string[];
    openGates: string[];
  };
function steps(scene: MissionScene, count: number) {
  for (let index = 0; index < count; index++) scene.step(SIM_DT, idle);
}

it('nie tworzy stanu runu, ładuje całą geometrię i blokuje cele poza kolejnością', async () => {
  const { scene, commands, store, three } = await setup();
  expect(scene.query('runState')).toBeUndefined();
  expect(await store.loadRun()).toBeNull();
  expect(scene.query('screen')).toBe('playing');
  expect(three.getObjectByName('gate:gate-mast-1')?.visible).toBe(true);
  expect(commands.execute('objective done mast-2')).toBe('Cel niedostępny.');
  commands.execute('god');
  commands.execute('objective done mast-1');
  expect(state(scene).openGates).toContain('gate-mast-1');
  expect(three.getObjectByName('gate:gate-mast-1')?.visible).toBe(false);
  expect(state(scene).openGates).not.toContain('gate-mast-2');
});

it('brama ma rzeczywistą kolizję; po ukończeniu celu można przez nią przejść', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  commands.execute('tp 98 0 -90');
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, walk);
  expect((scene.query('playerPos') as { x: number }).x).toBeLessThan(100);
  commands.execute('objective done mast-1');
  for (let i = 0; i < 60; i++) scene.step(SIM_DT, walk);
  expect((scene.query('playerPos') as { x: number }).x).toBeGreaterThan(100);
});

it('checkpoint zapisuje spotkania; śmierć przywraca pozycję, HP i cele, a resetuje walki za checkpointem', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('god');
  commands.execute('tp 18 0');
  steps(scene, 4);
  expect(state(scene).activeEncounters).toContain('patrol-wejscie');
  commands.execute('encounter clear');
  commands.execute('objective done mast-1');
  commands.execute('checkpoint po-maszcie-1');
  commands.execute('tp 116 0');
  steps(scene, 4);
  expect(state(scene).activeEncounters).toContain('patrol-tunel');
  commands.execute('god');
  commands.execute('hurt 9999');
  expect(state(scene).state).toBe('respawning');
  steps(scene, Math.ceil(tuning.level.respawnDelayS / SIM_DT) + 2);
  expect(state(scene).state).toBe('playing');
  expect(state(scene).objectives['mast-1']).toBe('done');
  expect(state(scene).completedEncounters).toEqual(['patrol-wejscie']);
  expect(state(scene).activeEncounters).not.toContain('patrol-tunel');
  expect(scene.query('playerHp')).toBe(scene.query('playerMaxHp'));
  expect((scene.query('playerPos') as { x: number }).x).toBeCloseTo(104);
  await vi.waitFor(async () =>
    expect((await store.loadMission!())?.checkpointId).toBe('po-maszcie-1'),
  );
  scene.dispose();
  const resumed = await setup(store, true);
  expect(state(resumed.scene).checkpointId).toBe('po-maszcie-1');
  expect(state(resumed.scene).objectives['mast-1']).toBe('done');
  expect(resumed.scene.query('playerLook')).toMatchObject({ yawDeg: -90 });
});

it('ukończenie po checkpoincie zachowuje cel po śmierci i po ponownym wczytaniu', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('objective done mast-1');
  commands.execute('hurt 9999');
  steps(scene, Math.ceil(tuning.level.respawnDelayS / SIM_DT) + 2);
  expect(state(scene).checkpointId).toBe('start');
  expect(state(scene).objectives['mast-1']).toBe('done');
  await vi.waitFor(async () =>
    expect((await store.loadMission!())?.objectives['mast-1']).toBe('done'),
  );
  scene.dispose();
  expect(state((await setup(store, true)).scene).objectives['mast-1']).toBe(
    'done',
  );
});

it('cały zestaw celów ma oryginalne czasy i pozycje z poziomu, a nagroda firstClear rozlicza się tylko raz', async () => {
  const store = createMemorySaveStore();
  const meta = await loadMetaManagerStrict(store);
  const before = meta.state.data;
  await saveMetaManager(store, meta);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { scene, commands } = await setup(store);
    commands.execute('god');
    for (const id of levelDefinitions.get('m01-maszty')!.objectiveOrder)
      expect(commands.execute(`objective done ${id}`)).toBe('Cel ukończony.');
    await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
    expect(await store.loadMission!()).toBeNull();
    const saved = await store.loadMeta();
    expect(saved?.meta.campaign.completed).toEqual(['m01-maszty']);
    expect(saved?.meta.data).toBe(before + 60);
    expect(saved?.meta.xp).toBe(meta.state.xp);
    expect(saved?.meta.threat.max).toBe(meta.state.threat.max);
    scene.dispose();
  }
});

it.each(['retry', 'resume'])(
  'przerwane rozliczenie pozostawia ukończony rekord i nie powiela nagrody (%s)',
  async (mode) => {
    const store = createMemorySaveStore();
    const clear = store.clearMission!;
    store.clearMission = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(clear);
    const { scene, commands } = await setup(store);
    commands.execute('god');
    for (const id of levelDefinitions.get('m01-maszty')!.objectiveOrder)
      commands.execute(`objective done ${id}`);
    await vi.waitFor(() => expect(scene.query('screen')).toBe('error'));
    expect((await store.loadMission!())?.completed).toBe(true);
    const first = await store.loadMeta();
    let settledScene = scene;
    if (mode === 'resume') {
      scene.dispose();
      settledScene = (await setup(store, true)).scene;
    } else commands.execute('mission retry');
    await vi.waitFor(() =>
      expect(settledScene.query('screen')).toBe('summary'),
    );
    expect(await store.loadMeta()).toMatchObject({
      meta: {
        data: first!.meta.data,
        appliedRunIds: first!.meta.appliedRunIds,
      },
    });
    expect(await store.loadMission!()).toBeNull();
  },
);

it('pozwala fizycznie przejść całą trasę: bez teleportacji i komend kończących cele', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  const level = levelDefinitions.get('m01-maszty')!;
  for (const id of level.objectiveOrder) {
    const target = level.objectivePositions[id]!;
    let arrived = false;
    for (let index = 0; index < 4000; index++) {
      const position = scene.query('playerPos') as { x: number };
      if (position.x >= target.x - 0.3) {
        arrived = true;
        break;
      }
      scene.step(SIM_DT, walk);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(arrived, `Trasa do ${id}`).toBe(true);
    // Rzeczywisty czas podłożenia 2,5 s + lont 6 s, podniesienie modułu i 2 s włazu.
    for (
      let index = 0;
      index < 600 && state(scene).objectives[id] !== 'done';
      index++
    ) {
      scene.step(SIM_DT, idle);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(state(scene).objectives[id]).toBe('done');
  }
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
});
