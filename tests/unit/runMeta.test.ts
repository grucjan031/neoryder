import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import type { GameContext } from '../../src/core/context';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import type { RunState } from '../../src/core/runTypes';
import { createMemorySaveStore } from '../../src/core/save';
import type { MetaSave, SaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import playerData from '../../src/data/scenes/roomPlayer.json';
import { MetaManager, runIdOf } from '../../src/progression/meta';
import {
  loadMetaManager,
  saveMetaManager,
} from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { RunScene } from '../../src/scenes/run';
import type { RunRoom, RunSavePort } from '../../src/scenes/run';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { registerMetaCommands } from '../../src/ui/metaCommands';
import type {
  RunScreenActions,
  RunScreens,
  RunScreenView,
} from '../../src/ui/runScreens';

const active = new Set<RunScene>();

class Screens implements RunScreens {
  view!: RunScreenView;
  actions!: RunScreenActions;
  show(view: RunScreenView, actions: RunScreenActions): void {
    this.view = view;
    this.actions = actions;
  }
  hide(): void {}
  dispose(): void {}
}

class MemoryRunSave implements RunSavePort {
  state: RunState | null = null;
  constructor(private readonly calls: string[] = []) {}
  async loadRun(): Promise<RunState | null> {
    return structuredClone(this.state);
  }
  async saveRun(state: RunState): Promise<void> {
    this.state = structuredClone(state);
  }
  async clearRun(): Promise<void> {
    this.calls.push('clearRun');
    this.state = null;
  }
}

class FakeRoom implements RunRoom {
  readonly id = 'fake';
  constructor(readonly run: RunState) {}
  async init(ctx: GameContext): Promise<void> {
    ctx.bus.emit('entity_spawned', { id: 1, kind: 'player' });
  }
  clear(): void {}
  exportState(): Pick<RunState, 'hp' | 'energy'> {
    return { hp: this.run.hp, energy: this.run.energy };
  }
  step(): void {}
  render(): void {}
  dispose(): void {}
}

function recordingStore(calls: string[], inner = createMemorySaveStore()) {
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      calls.push('saveMeta');
      await inner.saveMeta(data);
    },
  };
  return store;
}

/** Stan meta z ekwipunkiem, talentami podnoszącymi maxHealth i poziomem zagrożenia 2. */
function configuredMeta(): MetaManager {
  const meta = new MetaManager(createStarterMetaState());
  meta.debugUnlockAll();
  meta.debugAddXp(400);
  meta.setLoadout({
    blade: 'plasmaBlade',
    weapons: ['blaster', 'pistol'],
    powers: ['push'],
  });
  meta.debugGrantTalent('bladeRoot');
  meta.debugGrantTalent('bladeServoFrame');
  const state = meta.state;
  state.threat = { max: 2, selected: 2 };
  return new MetaManager(state);
}

async function setup(
  query: string,
  options: {
    store?: SaveStore;
    save?: MemoryRunSave;
    bus?: EventBus;
  } = {},
) {
  const screens = new Screens();
  const save = options.save ?? new MemoryRunSave();
  const store = options.store ?? createMemorySaveStore();
  const commands = new CommandRegistry();
  const bus = options.bus ?? new EventBus();
  const scene = new RunScene({
    params: new URLSearchParams(query),
    screens,
    save,
    metaStore: store,
    implantDefinitions: new Map(),
    createRoom: (_layout, run) => new FakeRoom(run),
  });
  active.add(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('meta'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
      resume: vi.fn(),
    },
    new ThreeScene(),
  );
  return { scene, screens, save, store, commands, bus };
}

afterEach(() => {
  for (const scene of active) scene.dispose();
  active.clear();
  vi.restoreAllMocks();
});

it('loadout=meta startuje run z ekwipunkiem, talentami, zdrowiem i poziomem zagrożenia z meta', async () => {
  const store = createMemorySaveStore();
  const meta = configuredMeta();
  await saveMetaManager(store, meta);
  const { scene, screens } = await setup('seed=m1&loadout=meta', { store });
  const state = scene.query('runState') as RunState;
  expect(state.loadoutId).toBe('custom');
  expect(state.loadout).toEqual(meta.loadout());
  expect(state.loadout.weapons).toEqual(['blaster', 'pistol']);
  expect(state.talents).toEqual(['bladeRoot', 'bladeServoFrame']);
  expect(state.threatLevel).toBe(2);
  expect(state.hp).toBe(playerData.maxHealth + 15);
  expect((scene.query('meta') as { xp: number }).xp).toBe(meta.state.xp);
  expect(scene.query('level')).toMatchObject({
    level: meta.level,
    freePoints: meta.freePoints,
  });
  expect(screens.view.state.loadout.tags).toEqual([]);
});

it('presety działają jak dotąd: bez talentów i na poziomie zagrożenia 0, mimo zapisanego meta', async () => {
  const store = createMemorySaveStore();
  await saveMetaManager(store, configuredMeta());
  const { scene } = await setup('seed=m2&loadout=classic', { store });
  const state = scene.query('runState') as RunState;
  expect(state.loadoutId).toBe('classic');
  expect(state.talents).toEqual([]);
  expect(state.threatLevel).toBe(0);
  expect(state.hp).toBe(playerData.maxHealth);
});

it('brak zapisu meta daje stan startowy', async () => {
  const { scene } = await setup('seed=m3&loadout=meta');
  const state = scene.query('runState') as RunState;
  expect(state.loadout.weapons).toEqual(['blaster']);
  expect(state.talents).toEqual([]);
  expect(scene.query('level')).toMatchObject({ level: 1 });
});

it.each([
  ['win', 'victory'],
  ['lose', 'death'],
] as const)(
  'koniec runu (%s): applyRun, zapis meta i dopiero potem clearRun; podsumowanie dostaje nagrody',
  async (arg, outcome) => {
    const calls: string[] = [];
    const store = recordingStore(calls);
    const meta = configuredMeta();
    await saveMetaManager(store, meta);
    calls.length = 0;
    const bus = new EventBus();
    bus.on('meta_rewards', () => calls.push('applyRun'));
    const save = new MemoryRunSave(calls);
    const { scene, screens, commands } = await setup('seed=m4&loadout=meta', {
      store,
      save,
      bus,
    });
    commands.execute(`run end ${arg}`);
    await scene.whenReady();
    expect(calls).toEqual(['applyRun', 'saveMeta', 'clearRun']);
    expect(screens.view.screen).toBe('summary');
    expect(screens.view.summary?.outcome).toBe(outcome);
    const view = screens.view.meta!;
    expect(view.levelBefore).toBe(meta.level);
    const saved = (await store.loadMeta())!.meta;
    expect(saved.xp).toBe(meta.state.xp + view.rewards.xp);
    expect(saved.data).toBe(meta.state.data + view.rewards.data);
    expect(saved.cores).toBe(meta.state.cores + view.rewards.cores);
    expect(saved.stats.runs).toBe(1);
    expect(saved.lastRuns[0]).toMatchObject({ outcome, threatLevel: 2 });
    expect(save.state).toBeNull();
  },
);

it('zwycięstwo daje Rdzenie, a koniec tego samego runu drugi raz nie podwaja nagród', async () => {
  const store = createMemorySaveStore();
  const first = await setup('seed=m5&loadout=meta', { store });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end win');
  await first.scene.whenReady();
  expect(first.screens.view.meta!.rewards.cores).toBeGreaterThan(0);
  const afterFirst = (await store.loadMeta())!.meta;
  expect(afterFirst.appliedRunIds).toEqual([runIdOf(snapshot)]);
  first.scene.dispose();
  const save = new MemoryRunSave();
  save.state = snapshot;
  const second = await setup('continue=1', { store, save });
  second.commands.execute('run end win');
  await second.scene.whenReady();
  expect(second.screens.view.screen).toBe('summary');
  expect(second.screens.view.meta).toBeUndefined();
  expect((await store.loadMeta())!.meta).toEqual(afterFirst);
});

it('wznowiony run z ekwipunkiem własnym (custom) nie wymaga presetu', async () => {
  const store = createMemorySaveStore();
  await saveMetaManager(store, configuredMeta());
  const first = await setup('seed=m6&loadout=meta', { store });
  const snapshot = first.scene.query('runState') as RunState;
  first.scene.dispose();
  const save = new MemoryRunSave();
  save.state = snapshot;
  const second = await setup('continue=1', { store, save });
  expect(second.scene.query('runState')).toEqual(snapshot);
});

it('błąd zapisu meta jest logowany, nie blokuje clearRun ani podsumowania', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const store: SaveStore = {
    ...createMemorySaveStore(),
    saveMeta: async () => {
      calls.push('saveMeta');
      throw new Error('dysk pełny');
    },
  };
  const save = new MemoryRunSave(calls);
  const { scene, screens, commands } = await setup('seed=m7&loadout=meta', {
    store,
    save,
  });
  commands.execute('run end lose');
  await scene.whenReady();
  expect(calls).toEqual(['saveMeta', 'clearRun']);
  expect(screens.view.screen).toBe('summary');
  expect(screens.view.meta).toBeDefined();
  expect(warn).toHaveBeenCalled();
});

it('podsumowanie dostaje akcje hub i newRun', async () => {
  const { scene, screens, commands } = await setup('seed=m8&loadout=meta');
  commands.execute('run end lose');
  await scene.whenReady();
  expect(screens.actions.hub).toBeTypeOf('function');
  expect(screens.actions.newRun).toBeTypeOf('function');
});

it('loadMetaManager: brak zapisu i zapis nieczytelny dają stan startowy bez nadpisywania', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const empty = await loadMetaManager(createMemorySaveStore());
  expect(empty.state).toEqual(createStarterMetaState());
  const writes: MetaSave[] = [];
  const broken: SaveStore = {
    ...createMemorySaveStore(),
    loadMeta: async () => {
      throw new Error('uszkodzone');
    },
    saveMeta: async (data) => {
      writes.push(data);
    },
  };
  const manager = await loadMetaManager(broken);
  expect(manager.state).toEqual(createStarterMetaState());
  expect(writes).toEqual([]);
  expect(warn).toHaveBeenCalled();
});

it('saveMetaManager: zachowuje createdAt, ustawia updatedAt i wersję 3', async () => {
  const store = createMemorySaveStore();
  const manager = new MetaManager(createStarterMetaState());
  await saveMetaManager(store, manager, () => 100);
  manager.debugAddData(7);
  await saveMetaManager(store, manager, () => 250);
  const saved = (await store.loadMeta())!;
  expect(saved).toMatchObject({
    saveVersion: 3,
    createdAt: 100,
    updatedAt: 250,
  });
  expect(saved.meta.data).toBe(7);
  const reloaded = await loadMetaManager(store);
  expect(reloaded.state).toEqual(manager.state);
});

it('komendy meta zmieniają i zapisują stan', async () => {
  const store = createMemorySaveStore();
  const manager = new MetaManager(createStarterMetaState());
  const commands = new CommandRegistry();
  const handle = registerMetaCommands(commands, manager, store);
  expect(commands.execute('meta xp 120')).toContain('Poziom 2');
  commands.execute('meta data 50');
  commands.execute('meta cores 4');
  await handle.settled();
  let saved = (await store.loadMeta())!.meta;
  expect(saved).toMatchObject({ xp: 120, data: 50, cores: 4 });
  expect(JSON.parse(commands.execute('meta state'))).toMatchObject({
    xp: 120,
  });
  commands.execute('meta unlock all');
  await handle.settled();
  saved = (await store.loadMeta())!.meta;
  expect(saved.unlocks).toContain('weapon:rifle');
  expect(commands.execute('meta xp -3')).toContain('Użycie');
  expect(commands.execute('meta unlock x')).toContain('Użycie');
  commands.execute('meta reset');
  await handle.settled();
  expect((await store.loadMeta())!.meta).toEqual(createStarterMetaState());
  handle.dispose();
  expect(commands.execute('meta state')).toContain('Nieznana komenda');
});

it('komendy meta są dostępne w RunScene i zapisują meta', async () => {
  const store = createMemorySaveStore();
  const { scene, commands } = await setup('seed=m9&loadout=meta', { store });
  commands.execute('meta data 33');
  await scene.whenReady();
  expect((await store.loadMeta())!.meta.data).toBe(33);
  expect((scene.query('meta') as { data: number }).data).toBe(33);
});
