import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import type { GameContext } from '../../src/core/context';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import type { RunState } from '../../src/core/runTypes';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import type { MetaSave, RunEnded, SaveStore } from '../../src/core/save';
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
import { createRunSavePort } from '../../src/ui/runSave';
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
  ended: RunEnded | null = null;
  constructor(private readonly calls: string[] = []) {}
  async loadRun(): Promise<RunState | null> {
    return structuredClone(this.state);
  }
  async loadEnded(): Promise<RunEnded | null> {
    return this.state ? structuredClone(this.ended) : null;
  }
  async saveRun(state: RunState, ended?: RunEnded): Promise<void> {
    this.state = structuredClone(state);
    this.ended = ended ? structuredClone(ended) : null;
  }
  async clearRun(): Promise<void> {
    this.calls.push('clearRun');
    this.state = null;
    this.ended = null;
  }
}

/** Store meta, którego zapis można „zepsuć” i „naprawić” w trakcie testu. */
function flakyStore(calls: string[] = []) {
  const inner = createMemorySaveStore();
  const control = { fail: true };
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      calls.push('saveMeta');
      if (control.fail) throw new Error('dysk pełny');
      await inner.saveMeta(data);
    },
  };
  return { store, control };
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
    modules: { pistol: ['incendiary'] },
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
  expect(state.loadout.modules).toEqual({ pistol: ['incendiary'] });
  meta.setLoadout({ ...meta.state.loadout, modules: {} });
  await saveMetaManager(store, meta);
  expect((scene.query('runState') as RunState).loadout.modules).toEqual({
    pistol: ['incendiary'],
  });
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

it('błąd zapisu meta: zapis runu zostaje z zakończeniem, podsumowanie pokazuje błąd i ponowienie', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const { store } = flakyStore(calls);
  const save = new MemoryRunSave(calls);
  const { scene, screens, commands } = await setup('seed=m7&loadout=meta', {
    store,
    save,
  });
  const snapshot = scene.query('runState') as RunState;
  commands.execute('run end lose');
  await scene.whenReady();
  expect(calls).toEqual(['saveMeta']);
  expect(save.state).not.toBeNull();
  expect(save.ended).toMatchObject({
    runId: runIdOf(snapshot),
    summary: { outcome: 'death', seed: 'm7' },
  });
  expect(screens.view.screen).toBe('summary');
  expect(screens.view.rewardError).toBe('save');
  expect(screens.view.meta).toBeUndefined();
  expect(screens.actions.retrySave).toBeTypeOf('function');
  expect(await store.loadMeta()).toBeNull();
  expect(warn).toHaveBeenCalled();
});

it('ponowienie po naprawie zapisu: nagroda na dysku raz, zapis runu usunięty, komunikat znika', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const { store, control } = flakyStore(calls);
  const save = new MemoryRunSave(calls);
  const { scene, screens, commands } = await setup('seed=m10&loadout=meta', {
    store,
    save,
  });
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  control.fail = false;
  screens.actions.retrySave!();
  await scene.whenReady();
  expect(calls).toEqual(['saveMeta', 'saveMeta', 'clearRun']);
  expect(save.state).toBeNull();
  expect(screens.view.rewardError).toBeNull();
  const rewards = screens.view.meta!.rewards;
  expect(rewards.data).toBeGreaterThan(0);
  const saved = (await store.loadMeta())!.meta;
  const starter = createStarterMetaState();
  expect(saved.data).toBe(starter.data + rewards.data);
  expect(saved.cores).toBe(starter.cores + rewards.cores);
  expect(saved.stats.runs).toBe(1);
  expect(saved.appliedRunIds).toHaveLength(1);
});

it('dwukrotne ponowienie nalicza waluty raz', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control } = flakyStore();
  const save = new MemoryRunSave();
  const { scene, screens, commands } = await setup('seed=m11&loadout=meta', {
    store,
    save,
  });
  commands.execute('run end win');
  await scene.whenReady();
  screens.actions.retrySave!();
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  control.fail = false;
  screens.actions.retrySave!();
  screens.actions.retrySave!();
  await scene.whenReady();
  screens.actions.retrySave?.();
  await scene.whenReady();
  const rewards = screens.view.meta!.rewards;
  const saved = (await store.loadMeta())!.meta;
  expect(saved.data).toBe(createStarterMetaState().data + rewards.data);
  expect(saved.stats.runs).toBe(1);
  expect(save.state).toBeNull();
});

it('odświeżenie po błędzie (continue=1 na tym samym zapisie) rozlicza run raz i pokazuje podsumowanie', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control } = flakyStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=m12&loadout=meta', { store, save });
  first.commands.execute('run end win');
  await first.scene.whenReady();
  expect(first.screens.view.rewardError).toBe('save');
  first.scene.dispose();
  control.fail = false;
  const second = await setup('continue=1', { store, save });
  await second.scene.whenReady();
  expect(second.screens.view.screen).toBe('summary');
  expect(second.screens.view.summary?.outcome).toBe('victory');
  expect(second.screens.view.rewardError).toBeNull();
  const rewards = second.screens.view.meta!.rewards;
  expect(rewards.cores).toBeGreaterThan(0);
  const saved = (await store.loadMeta())!.meta;
  expect(saved.cores).toBe(createStarterMetaState().cores + rewards.cores);
  expect(saved.stats.runs).toBe(1);
  expect(save.state).toBeNull();
  // Kolejne odświeżenie nie ma już czego rozliczać ani wznawiać.
  second.scene.dispose();
  await expect(setup('continue=1', { store, save })).rejects.toThrow(
    /Brak zapisu runu/,
  );
  expect((await store.loadMeta())!.meta).toEqual(saved);
});

it('zakończony run, którego nagroda jest już na dysku, nie nalicza się drugi raz przy wznowieniu', async () => {
  const store = createMemorySaveStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=m13&loadout=meta', { store, save });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end win');
  await first.scene.whenReady();
  const afterFirst = (await store.loadMeta())!.meta;
  first.scene.dispose();
  // Zapis meta się udał, ale clearRun nie zdążył (np. zamknięta karta).
  save.state = snapshot;
  save.ended = {
    runId: runIdOf(snapshot),
    summary: first.screens.view.summary!,
  };
  const second = await setup('continue=1', { store, save });
  await second.scene.whenReady();
  expect(second.screens.view.screen).toBe('summary');
  expect((await store.loadMeta())!.meta).toEqual(afterFirst);
  expect(save.state).toBeNull();
});

it('błąd applyRun (uszkodzone dane): zapis runu zostaje, komunikat bez pętli ponowień', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const store = recordingStore(calls);
  const save = new MemoryRunSave(calls);
  const first = await setup('seed=m14&loadout=classic', { store, save });
  const snapshot = first.scene.query('runState') as RunState;
  first.scene.dispose();
  save.state = snapshot;
  save.ended = {
    runId: runIdOf(snapshot),
    summary: {
      outcome: 'victory',
      seed: 'm14',
      loadoutId: 'classic',
      elapsedS: 10,
      kills: 1,
      roomsCleared: 1,
      elitesCleared: 0,
      threatLevel: 99,
      layerReached: 1,
      implants: [],
      damage: { melee: 0, power: 0, gun: 0, other: 0 },
    },
  };
  const ended = structuredClone(save.ended);
  calls.length = 0;
  const { scene, screens } = await setup('continue=1', { store, save });
  await scene.whenReady();
  expect(screens.view.screen).toBe('summary');
  expect(screens.view.rewardError).toBe('apply');
  expect(screens.actions.retrySave).toBeUndefined();
  expect(calls).toEqual([]);
  expect(save.state).toEqual(snapshot);
  expect(save.ended).toEqual(ended);
});

it('stary zapis runu bez pola zakończenia wczytuje się i wznawia jak dotąd', async () => {
  const store = createMemorySaveStore();
  const first = await setup('seed=m15&loadout=classic', { store });
  const snapshot = first.scene.query('runState') as RunState;
  first.scene.dispose();
  await store.saveRun({
    saveVersion: SAVE_VERSION,
    seed: snapshot.seed,
    startedAt: snapshot.startedAtMs,
    run: snapshot,
  });
  const port = createRunSavePort(store);
  expect(await port.loadEnded!()).toBeNull();
  const screens = new Screens();
  const scene = new RunScene({
    params: new URLSearchParams('continue=1'),
    screens,
    save: port,
    metaStore: store,
    implantDefinitions: new Map(),
    createRoom: (_layout, run) => new FakeRoom(run),
  });
  active.add(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands: new CommandRegistry(),
      rng: new Rng('meta'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: true,
      resume: vi.fn(),
    },
    new ThreeScene(),
  );
  expect(screens.view.screen).toBe('map');
  expect(scene.query('runState')).toEqual(snapshot);
});

it('zapis runu z zakończeniem przechodzi przez SaveStore i port', async () => {
  const store = createMemorySaveStore();
  const port = createRunSavePort(store);
  const first = await setup('seed=m16&loadout=classic', { store });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end lose');
  await first.scene.whenReady();
  const summary = first.screens.view.summary!;
  await port.saveRun(snapshot, { runId: runIdOf(snapshot), summary });
  expect(await port.loadRun()).toEqual(snapshot);
  expect(await port.loadEnded!()).toEqual({
    runId: runIdOf(snapshot),
    summary,
  });
  await port.saveRun(snapshot);
  expect(await port.loadEnded!()).toBeNull();
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
