import 'fake-indexeddb/auto';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { createIndexedDbSaveStore } from '../../src/core/save';
import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import type { GameContext } from '../../src/core/context';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import type { RunState } from '../../src/core/runTypes';
import { tuning } from '../../src/core/tuning';
import { initPhysics } from '../../src/physics';
import { loadImplant } from '../../src/progression/implantSchema';
import { implantDefinitions } from '../../src/progression/implants';
import { RunScene } from '../../src/scenes/run';
import type {
  RunRoom,
  RunSavePort,
  RunSceneOptions,
} from '../../src/scenes/run';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type {
  RunScreenActions,
  RunScreens,
  RunScreenView,
} from '../../src/ui/runScreens';
import { kuroganeSector } from '../../src/world/sectors';

const idle = {
  held: new Set<never>(),
  pressed: new Set<never>(),
  released: new Set<never>(),
  lookDelta: { x: 0, y: 0 },
};
const active = new Set<RunScene>();

class Screens implements RunScreens {
  view!: RunScreenView;
  actions!: RunScreenActions;
  hidden = false;
  disposed = false;
  show(view: RunScreenView, actions: RunScreenActions): void {
    this.view = view;
    this.actions = actions;
    this.hidden = false;
  }
  hide(): void {
    this.hidden = true;
  }
  dispose(): void {
    this.disposed = true;
  }
}

class MemorySave implements RunSavePort {
  state: RunState | null = null;
  readonly writes: RunState[] = [];
  clears = 0;
  async loadRun(): Promise<RunState | null> {
    return structuredClone(this.state);
  }
  async saveRun(state: RunState): Promise<void> {
    this.state = structuredClone(state);
    this.writes.push(structuredClone(state));
  }
  async clearRun(): Promise<void> {
    this.clears++;
    this.state = null;
  }
}

class FakeRoom implements RunRoom {
  readonly id = 'fake';
  ctx!: GameContext;
  hp: number;
  energy: number;
  disposed = false;
  off: (() => void)[] = [];
  insideStep = false;
  clearOnStep = false;
  initGate?: Promise<void>;
  constructor(readonly run: RunState) {
    this.hp = run.hp;
    this.energy = run.energy;
  }
  async init(ctx: GameContext): Promise<void> {
    this.ctx = ctx;
    await this.initGate;
    ctx.bus.emit('entity_spawned', { id: 1, kind: 'player' });
    this.off.push(ctx.bus.on('power_used', () => {}));
    const commandOff = ctx.commands?.register('hurt', 'hurt', (args) => {
      this.hp = Math.max(0, this.hp - Number(args[0]));
      if (!this.hp) ctx.bus.emit('player_died', { id: 1 });
      return 'hurt';
    });
    if (commandOff) this.off.push(commandOff);
    const node = this.run.map.layers
      .flat()
      .find((node) => node.id === this.run.currentNodeId)!;
    ctx.bus.emit('room_entered', {
      nodeId: node.id,
      roomId: this.id,
      type: node.type,
      layer: node.layer,
    });
  }
  clear(): void {
    const node = this.run.map.layers
      .flat()
      .find((node) => node.id === this.run.currentNodeId)!;
    this.ctx.bus.emit('room_cleared', {
      nodeId: node.id,
      type: node.type,
      timeS: 1,
    });
  }
  exportState(): Pick<RunState, 'hp' | 'energy'> {
    return { hp: this.hp, energy: this.energy };
  }
  step(): void {
    this.insideStep = true;
    if (this.clearOnStep) this.clear();
    this.insideStep = false;
  }
  render(): void {}
  query(): unknown {
    return this.hp;
  }
  dispose(): void {
    expect(this.insideStep).toBe(false);
    expect(this.disposed).toBe(false);
    this.disposed = true;
    for (const off of this.off) off();
  }
}

function handlerCount(bus: EventBus): number {
  const handlers = Reflect.get(bus, 'handlers') as Map<unknown, unknown[]>;
  return [...handlers.values()].reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
}

async function setup(options: RunSceneOptions = {}, bus = new EventBus()) {
  const screens = new Screens();
  const save = new MemorySave();
  const commands = new CommandRegistry();
  const rooms: FakeRoom[] = [];
  const scene = new RunScene({
    params: new URLSearchParams('seed=test1&loadout=classic'),
    screens,
    save,
    implantDefinitions: new Map(),
    createRoom: (_layout, run) => {
      const room = new FakeRoom(run);
      rooms.push(room);
      return room;
    },
    ...options,
  });
  active.add(scene);
  const resume = vi.fn();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('test1'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
      resume,
    },
    new ThreeScene(),
  );
  return { scene, screens, save, commands, rooms, bus, resume };
}

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
});

it('dwa przebiegi z tym samym seedem dają identyczny runLog', async () => {
  const play = async () => {
    const { scene, screens, rooms } = await setup({
      params: new URLSearchParams('seed=stable-run-log&loadout=classic'),
    });
    const node = screens.view.nodes[0]!;
    screens.actions.selectNode(node.id);
    await scene.whenReady();
    rooms[0]!.clear();
    await scene.whenReady();
    return scene.query('runLog');
  };
  expect(await play()).toEqual(await play());
});

it('prowadzi mapa → pokój → nagroda → mapa, zapisuje tylko mapę i przenosi zasoby', async () => {
  const bus = new EventBus();
  const started = vi.fn();
  bus.on('run_started', started);
  const { scene, screens, save, commands, rooms, resume } = await setup(
    {},
    bus,
  );
  expect(started).toHaveBeenCalledExactlyOnceWith({ seed: 'test1' });
  expect(save.writes).toHaveLength(1);
  const node = screens.view.nodes[0]!;
  expect(commands.execute('run node L8N1')).toBe('Węzeł niedostępny.');
  screens.actions.selectNode(node.id);
  expect(scene.query('loading')).toBe(true);
  expect(commands.execute('run clear')).toBe('Brak aktywnego pokoju.');
  await scene.whenReady();
  const room = rooms[0]!;
  expect(room.ctx.bus).toBe(bus);
  expect(room.ctx.rng.next()).toBe(
    new Rng('test1').fork(`room:${node.id}`).next(),
  );
  expect(resume).toHaveBeenCalledOnce();
  expect(screens.hidden).toBe(true);
  expect(scene.query('screen')).toBe('room');
  expect(save.writes).toHaveLength(1);
  commands.execute('hurt 13');
  room.energy = 41;
  room.clearOnStep = true;
  scene.step(SIM_DT, idle);
  expect(room.disposed).toBe(true);
  expect(scene.query('screen')).toBe('reward');
  expect(screens.view.state).toMatchObject({ hp: 87, energy: 41 });
  expect(scene.query('runLog')).toEqual([
    { event: 'node_selected', nodeId: node.id, type: 'combat' },
    { event: 'room_cleared', nodeId: node.id },
    { event: 'reward_offered', nodeId: node.id, options: [] },
  ]);
  expect(save.writes).toHaveLength(1);
  screens.actions.next();
  await scene.whenReady();
  expect(scene.query('screen')).toBe('map');
  expect(scene.query('room')).toBeNull();
  expect(save.writes).toHaveLength(2);
  expect(save.state).toMatchObject({
    hp: 87,
    energy: 41,
    currentNodeId: node.id,
  });
  screens.actions.selectNode(screens.view.nodes[0]!.id);
  await scene.whenReady();
  expect(rooms[1]!.exportState()).toEqual({ hp: 87, energy: 41 });
  expect(JSON.parse(commands.execute('run state'))).toEqual(
    scene.query('runState'),
  );
  expect(scene.query('runError')).toBeNull();
});

it('wznowienie zachowuje węzeł, pełną mapę i stan ostatniego zapisu', async () => {
  const save = new MemorySave();
  const first = await setup({ save });
  first.screens.actions.selectNode(first.screens.view.nodes[0]!.id);
  await first.scene.whenReady();
  first.commands.execute('run clear');
  await first.scene.whenReady();
  first.screens.actions.next();
  await first.scene.whenReady();
  const snapshot = structuredClone(save.state);
  const available = first.screens.view.nodes;
  first.screens.actions.selectNode(available[0]!.id);
  await first.scene.whenReady();
  first.commands.execute('hurt 12');
  first.scene.dispose();
  const second = await setup({
    save,
    params: new URLSearchParams('continue=1&seed=ignored'),
  });
  expect(second.scene.query('screen')).toBe('map');
  expect(second.scene.query('runState')).toEqual(snapshot);
  expect(second.screens.view.nodes).toEqual(available);
  expect(second.rooms).toHaveLength(0);
});

it('player_died kończy run i usuwa zapis; komendy przetrwają zmianę pokoju', async () => {
  const { scene, screens, commands, save, bus, rooms } = await setup();
  const ended = vi.fn();
  bus.on('run_ended', ended);
  screens.actions.selectNode(screens.view.nodes[0]!.id);
  await scene.whenReady();
  commands.execute('hurt 1000');
  await scene.whenReady();
  expect(ended).toHaveBeenCalledOnce();
  expect(ended.mock.calls[0]?.[0]).toMatchObject({ outcome: 'death' });
  expect(save.clears).toBe(1);
  expect(save.state).toBeNull();
  expect(scene.query('screen')).toBe('summary');
  expect(rooms[0]!.disposed).toBe(true);
  expect(commands.execute('hurt 1')).toBe('Run zakończony.');
  commands.execute('run end win');
  await scene.whenReady();
  expect(ended).toHaveBeenCalledOnce();
});

it('trzy prawdziwe pokoje nie zostawiają subskrypcji, zwalniają światy i naliczają Kredyty', async () => {
  const rapier = await initPhysics();
  const free = vi.spyOn(rapier.World.prototype, 'free');
  const bus = new EventBus();
  const initialHandlers = handlerCount(bus);
  const { scene, screens, commands } = await setup(
    {
      createRoom: (layout, run, waves) =>
        new RoomScene(layout, run, waves, { loadModels: false }),
    },
    bus,
  );
  const hostHandlers = handlerCount(bus);
  for (let i = 0; i < 3; i++) {
    screens.actions.selectNode(screens.view.nodes[0]!.id);
    await scene.whenReady();
    expect(scene.query('runError')).toBeNull();
    commands.execute('spawn gunner 1');
    commands.execute('kill all');
    expect((scene.query('runState') as RunState).credits).toBeGreaterThan(0);
    commands.execute('hurt 1');
    commands.execute('run clear');
    await scene.whenReady();
    expect(scene.query('screen')).toBe('reward');
    expect(handlerCount(bus)).toBe(hostHandlers);
    expect(commands.execute('hurt 0')).toBe('Obrażenia zadane.');
    screens.actions.next();
    await scene.whenReady();
  }
  expect(free).toHaveBeenCalledTimes(3);
  expect(new Set(free.mock.contexts).size).toBe(3);
  scene.dispose();
  expect(handlerCount(bus)).toBe(initialHandlers);
  expect(commands.execute('run state')).toContain('Nieznana komenda');
  expect(commands.execute('hurt 1')).toContain('Nieznana komenda');
});

it('sklep i odpoczynek otwierają się automatycznie, boss z falami kończy run zwycięstwem', async () => {
  const { scene, screens, save, commands } = await setup();
  const state = scene.query('runState') as RunState;
  const path = new Set<string>();
  for (let layer = 0; layer < state.map.layers.length; layer++) {
    const candidates = screens.view.nodes;
    const node =
      candidates.find((node) => node.type === 'shop') ?? candidates[0]!;
    path.add(node.type);
    screens.actions.selectNode(node.id);
    await scene.whenReady();
    if (node.type === 'shop' || node.type === 'rest') {
      expect(scene.query('screen')).toBe(node.type);
      expect(screens.hidden).toBe(false);
      expect(scene.query('room')).not.toBeNull();
      screens.actions.next();
    } else {
      commands.execute('run clear');
      await scene.whenReady();
      if (node.type !== 'boss') screens.actions.next();
    }
    await scene.whenReady();
  }
  expect(path.has('rest')).toBe(true);
  expect(scene.query('screen')).toBe('summary');
  expect(screens.view.summary?.outcome).toBe('victory');
  expect(save.clears).toBe(1);
  expect(save.state).toBeNull();
});

it('sklep na ścieżce otwiera nakładkę przed pierwszym krokiem walki', async () => {
  const sector = structuredClone(kuroganeSector);
  sector.typeWeights = [{ fromLayer: 1, toLayer: 8, weights: { shop: 1 } }];
  sector.guarantees = [];
  const { scene, screens, commands } = await setup({ sector });
  for (let i = 0; i < 3; i++) {
    screens.actions.selectNode(screens.view.nodes[0]!.id);
    await scene.whenReady();
    if (i === 0) {
      commands.execute('run clear');
      await scene.whenReady();
    } else expect(scene.query('screen')).toBe('shop');
    screens.actions.next();
    await scene.whenReady();
  }
  expect(scene.query('screen')).toBe('map');
});

it('run end, credits i opcjonalny implant walidują argumenty i zachowują stan', async () => {
  const implant = loadImplant({
    id: 'test',
    name: 'Test',
    rarity: 'common',
    tags: [],
    modifiers: [],
  });
  const { scene, commands, screens } = await setup({
    implantDefinitions: new Map([[implant.id, implant]]),
  });
  expect(commands.execute('credits NaN')).toContain('Podaj');
  commands.execute('credits 20');
  commands.execute('implant test');
  commands.execute('implant test');
  expect(scene.query('runState')).toMatchObject({
    credits: 20,
    implants: ['test'],
  });
  expect(commands.execute('run end invalid')).toContain('Użycie');
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.summary?.outcome).toBe('victory');
});

it('dispose podczas ładowania zwalnia gotowy pokój bez ponownego pokazania ekranów', async () => {
  let resolve!: () => void;
  const gate = new Promise<void>((done) => {
    resolve = done;
  });
  let room!: FakeRoom;
  const { scene, screens, bus } = await setup({
    createRoom: (_layout, run) => {
      room = new FakeRoom(run);
      room.initGate = gate;
      return room;
    },
  });
  const hostHandlers = handlerCount(bus);
  screens.actions.selectNode(screens.view.nodes[0]!.id);
  scene.dispose();
  resolve();
  await scene.whenReady();
  expect(room.disposed).toBe(true);
  expect(screens.disposed).toBe(true);
  expect(handlerCount(bus)).toBeLessThan(hostHandlers);
  expect(handlerCount(bus)).toBe(0);
});

it('clearRun czeka na zaległy saveRun, więc zapis nie odżywa po końcu runu', async () => {
  const save = new MemorySave();
  const originalSave = save.saveRun.bind(save);
  let unblock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  const { scene, screens, commands } = await setup({ save });
  screens.actions.selectNode(screens.view.nodes[0]!.id);
  await scene.whenReady();
  commands.execute('run clear');
  await scene.whenReady();
  save.saveRun = async (state) => {
    await gate;
    await originalSave(state);
  };
  screens.actions.next();
  commands.execute('run end lose');
  expect(save.clears).toBe(0);
  unblock();
  await scene.whenReady();
  expect(save.state).toBeNull();
  expect(save.clears).toBe(1);
});

it('real offers reach the run screen, selection persists and a second selection is rejected', async () => {
  const { scene, screens, commands, save } = await setup({
    implantDefinitions,
  });
  screens.actions.selectNode(screens.view.nodes[0]!.id);
  await scene.whenReady();
  commands.execute('run clear');
  await scene.whenReady();
  const offers = screens.view.offers!;
  expect(offers).toHaveLength(3);
  expect(
    offers.every(
      (offer) => offer.label === implantDefinitions.get(offer.id)!.name,
    ),
  ).toBe(true);
  expect(scene.query('runLog')).toContainEqual({
    event: 'reward_offered',
    nodeId: screens.view.state.currentNodeId,
    options: offers.map((offer) => offer.id),
  });
  screens.actions.next();
  expect(scene.query('screen')).toBe('reward');
  screens.actions.chooseReward!(offers[0]!.id);
  await scene.whenReady();
  expect(scene.query('screen')).toBe('map');
  expect(save.state!.implants).toEqual([offers[0]!.id]);
  screens.actions.chooseReward!(offers[1]!.id);
  expect((scene.query('runState') as RunState).implants).toEqual([
    offers[0]!.id,
  ]);
});

it('domyślny SaveStore v2 zapisuje mapę, wznawia pełen stan i czyści po run_ended', async () => {
  const store = createIndexedDbSaveStore();
  await store.clearRun();
  const first = await setup({ save: undefined });
  first.screens.actions.selectNode(first.screens.view.nodes[0]!.id);
  await first.scene.whenReady();
  first.commands.execute('run clear');
  await first.scene.whenReady();
  first.commands.execute('credits 23');
  first.bus.emit('implant_acquired', {
    id: 'test-save',
    rarity: 'common',
    source: 'reward',
  });
  first.screens.actions.next();
  await first.scene.whenReady();
  // Kredyty z zabójstw (F3-11) dochodzą do 23 z komendy — porównujemy ze stanem runu.
  const credits = (first.scene.query('runState') as RunState).credits;
  expect(credits).toBeGreaterThanOrEqual(23);
  const saved = await store.loadRun();
  expect(saved).toMatchObject({
    saveVersion: 3,
    run: { credits, implants: ['test-save'] },
  });
  expect(saved!.run.currentNodeId).not.toBeNull();
  first.scene.dispose();
  const second = await setup({
    save: undefined,
    params: new URLSearchParams('continue=1'),
  });
  expect(second.scene.query('runState')).toEqual(saved!.run);
  expect(second.scene.query('screen')).toBe('map');
  second.commands.execute('run end lose');
  await second.scene.whenReady();
  expect(await store.loadRun()).toBeNull();
});
function bossRunState(): RunState {
  return {
    seed: 'boss-run',
    sectorId: 'kurogane',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: {
      sectorId: 'kurogane',
      layers: [[{ id: 'B', layer: 8, index: 0, type: 'boss', next: [] }]],
    },
    currentNodeId: null,
    visited: [],
    hp: 100,
    energy: 50,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  };
}

async function bossRun() {
  const save = new MemorySave();
  save.state = bossRunState();
  const made = setup({
    save,
    params: new URLSearchParams('continue=1'),
    createRoom: (layout, run, waves) => {
      expect(waves.waves).toHaveLength(0);
      return new RoomScene(layout, run, waves, { loadModels: false });
    },
  });
  return { ...(await made), save };
}

it('węzeł boss: pokój bossa bez fal, boss pojawia się po wejściu, śmierć bossa kończy run zwycięstwem bez nagrody', async () => {
  const { scene, screens, commands, save } = await bossRun();
  screens.actions.selectNode('B');
  await scene.whenReady();
  expect(scene.query('runError')).toBeNull();
  expect(scene.query('room')).toBe('bossRoom');
  expect(scene.query('screen')).toBe('room');
  expect(scene.query('phase')).toBe('stopped');
  expect(scene.query('boss')).toMatchObject({ phase: 1, hp: 900 });
  commands.execute('god');
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
  expect(scene.query('screen')).toBe('room');
  for (let n = 0; n < 3; n++) {
    commands.execute('kill all');
    for (let i = 0; i < 70; i++) scene.step(SIM_DT, idle);
  }
  await scene.whenReady();
  expect(scene.query('screen')).toBe('summary');
  expect(screens.view.summary?.outcome).toBe('victory');
  expect(scene.query('room')).toBeNull();
  expect(scene.query('runLog')).toEqual([
    { event: 'node_selected', nodeId: 'B', type: 'boss' },
    { event: 'room_cleared', nodeId: 'B' },
    { event: 'run_ended', outcome: 'victory' },
  ]);
  expect(save.clears).toBe(1);
  expect(save.state).toBeNull();
});

it('węzeł boss: śmierć gracza kończy run porażką jak w innych pokojach', async () => {
  const { scene, screens, commands } = await bossRun();
  screens.actions.selectNode('B');
  await scene.whenReady();
  commands.execute('hurt 1000');
  await scene.whenReady();
  expect(scene.query('screen')).toBe('summary');
  expect(screens.view.summary?.outcome).toBe('death');
  expect(scene.query('runLog')).toEqual([
    { event: 'node_selected', nodeId: 'B', type: 'boss' },
    { event: 'run_ended', outcome: 'death' },
  ]);
});
