import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import {
  createIndexedDbSaveStore,
  createMemorySaveStore,
  SAVE_VERSION,
} from '../../src/core/save';
import { RunManager } from '../../src/world/run';
import { RunEconomy } from '../../src/progression/runEconomy';
import { kuroganeSector } from '../../src/world/sectors';
import { RunScene } from '../../src/scenes/run';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { createRunSavePort } from '../../src/ui/runSave';
import type { RunScreenActions, RunScreens } from '../../src/ui/runScreens';
import type { RunState } from '../../src/core/runTypes';

const scenes: RunScene[] = [];
afterEach(() => {
  scenes.splice(0).forEach((scene) => scene.dispose());
  vi.useRealTimers();
});

function manager() {
  return new RunManager(new EventBus(), () => ({
    sectorId: 'test',
    layers: [
      [{ id: 'a', layer: 1, index: 0, type: 'combat', next: ['b'] }],
      [{ id: 'b', layer: 2, index: 0, type: 'combat', next: [] }],
    ],
  }));
}

it('zapis zachowuje nagrody, a pokój i statystyki walki wracają przed wejście', async () => {
  const run = manager();
  run.newRun('refresh');
  run.selectNode('a');
  run.creditKill(3);
  run.addImplant('test-implant');
  const store = createIndexedDbSaveStore('run-refresh-ledger');
  const port = createRunSavePort(store);
  await port.saveRun(run.checkpoint());
  const saved = (await port.loadRun())!;
  expect(saved).toMatchObject({
    credits: 15,
    implants: ['test-implant'],
    currentNodeId: null,
    visited: [],
    roomCredits: { a: 15 },
  });
  expect((await store.loadRun())?.saveVersion).toBe(SAVE_VERSION);
  const resumed = manager();
  resumed.restore(saved);
  expect(resumed.canSelectNode('a')).toBe(true);
  expect(resumed.screen).toBe('map');
});

it('wielokrotne F5 nie odnawia wypłaconych kredytów, nawet po ich wydaniu', () => {
  const run = manager();
  run.newRun('refresh');
  run.selectNode('a');
  expect(run.creditKill(4)).toBe(20);
  run.spendCredits(10);
  run.restore(run.checkpoint());
  run.selectNode('a');
  expect(run.creditKill(2)).toBe(0);
  run.restore(run.checkpoint());
  run.selectNode('a');
  expect(run.creditKill(4)).toBe(0);
  expect(run.creditKill(1)).toBe(5);
  expect(run.state.credits).toBe(15);
  run.completeRoom();
  run.completeReward();
  run.restore(run.serialize());
  run.selectNode('b');
  expect(run.creditKill(1)).toBe(5);
});

it('stary zapis bez licznika pokoju przechodzi przez SaveStore i restore', async () => {
  const run = manager();
  const old = run.newRun('old');
  expect(old).not.toHaveProperty('roomCredits');
  const port = createRunSavePort(createMemorySaveStore());
  await port.saveRun(old);
  run.restore((await port.loadRun())!);
  run.selectNode('a');
  expect(run.creditKill(1)).toBe(5);
});

async function setup() {
  vi.useFakeTimers();
  const bus = new EventBus();
  const commands = new CommandRegistry();
  let actions!: RunScreenActions;
  const screens: RunScreens = {
    show: (_view, next) => {
      actions = next;
    },
    hide() {},
    dispose() {},
  };
  const port = createRunSavePort(createMemorySaveStore());
  const saveRun = vi.spyOn(port, 'saveRun');
  const scene = new RunScene({
    params: new URLSearchParams('seed=test1&loadout=classic'),
    screens,
    save: port,
    metaStore: createMemorySaveStore(),
    createRoom: (_layout, run) => ({
      id: 'fake',
      init() {},
      step() {},
      render() {},
      dispose() {},
      clear() {
        bus.emit('room_cleared', {
          nodeId: run.currentNodeId!,
          type: 'combat',
          timeS: 1,
        });
      },
      exportState: () => ({ hp: 100, energy: 100 }),
    }),
  });
  scenes.push(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('test1'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
    },
    new Scene(),
  );
  const state = scene.query('runState') as RunState;
  actions.selectNode(state.map.layers[0]![0]!.id);
  await scene.whenReady();
  saveRun.mockClear();
  return { scene, bus, commands, port, saveRun };
}

it('kredyty zapisują się po najwyżej 2 s czasu rzeczywistego, również bez kroków gry', async () => {
  const { commands, port, saveRun } = await setup();
  commands.execute('credits 10');
  await vi.advanceTimersByTimeAsync(1999);
  expect(saveRun).not.toHaveBeenCalled();
  commands.execute('credits 5');
  await vi.advanceTimersByTimeAsync(1);
  expect(saveRun).toHaveBeenCalledTimes(1);
  expect(await port.loadRun()).toMatchObject({
    credits: 15,
    visited: [],
    currentNodeId: null,
  });
  commands.execute('credits 5');
  await vi.advanceTimersByTimeAsync(2000);
  expect(saveRun).toHaveBeenCalledTimes(2);
});

it('zakup zapisuje koszt i implant natychmiast w jednej migawce', async () => {
  const { bus, commands, scene, port, saveRun } = await setup();
  const run = Reflect.get(scene, 'manager') as RunManager;
  const state = run.checkpoint();
  state.map.layers[0]![0]!.type = 'shop';
  run.restore(state);
  run.selectNode(state.map.layers[0]![0]!.id);
  run.completeRoom();
  const economy = new RunEconomy(run, bus, kuroganeSector);
  const item = economy.stockShop()[0]!;
  commands.execute(`credits ${item.price + 30}`);
  expect(economy.buy(item.id)).toBe(true);
  await scene.whenReady();
  expect(saveRun).toHaveBeenCalledTimes(1);
  expect(await port.loadRun()).toMatchObject({
    credits: 30,
    implants: [item.id],
    visited: [],
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(saveRun).toHaveBeenCalledTimes(1);
});

it('odebranie implantu bez zakupu zapisuje natychmiast, dispose usuwa timer', async () => {
  const { bus, scene, commands, port, saveRun } = await setup();
  bus.emit('implant_acquired', {
    id: 'test-implant',
    rarity: 'common',
    source: 'reward',
  });
  await scene.whenReady();
  expect((await port.loadRun())?.implants).toEqual(['test-implant']);
  commands.execute('credits 10');
  scene.dispose();
  await vi.advanceTimersByTimeAsync(2000);
  expect(saveRun).toHaveBeenCalledTimes(1);
});
