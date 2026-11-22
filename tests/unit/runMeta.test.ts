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
  loadMetaManagerStrict,
  saveMetaManager,
} from '../../src/progression/metaSave';
import { metaStateSchema } from '../../src/progression/metaStateSchema';
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

/** Nagrody z naszywek Iskry zdobytych w runie (doliczone osobno od `rewards`). */
function patchBonus(meta: NonNullable<RunScreenView['meta']>) {
  const unlocks = meta.achievements ?? [];
  return {
    data: unlocks.reduce((sum, unlock) => sum + unlock.reward.data, 0),
    cores: unlocks.reduce((sum, unlock) => sum + unlock.reward.cores, 0),
  };
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
  return { store, control, inner };
}

/** Podsumowanie z nieznanym Poziomem zagrożenia: `applyRun` rzuca (uszkodzone dane). */
function brokenSummary(seed: string): RunEnded['summary'] {
  return {
    outcome: 'victory',
    seed,
    loadoutId: 'classic',
    elapsedS: 10,
    kills: 1,
    roomsCleared: 1,
    elitesCleared: 0,
    threatLevel: 99,
    layerReached: 1,
    implants: [],
    damage: { melee: 0, power: 0, gun: 0, other: 0 },
  };
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

it.each(['victory', 'death'] as const)(
  'wydobywa jeden z zapisanych modułów po wyniku %s',
  async (outcome) => {
    const { commands, scene, store, screens } = await setup('seed=extraction');
    const found = ['pierce', 'ricochet', 'incendiary'];
    for (const id of found) commands.execute(`run module ${id}`);
    const state = scene.query('runState') as RunState;
    const runId = runIdOf(state);
    const port = createRunSavePort(store);
    await port.saveRun(state);
    expect((await port.loadRun())?.foundModules).toEqual(found);
    commands.execute(outcome === 'victory' ? 'run end win' : 'run end lose');
    await scene.whenReady();
    expect(screens.view.extractionAvailable).toBe(true);
    const summary = screens.view.summary!;
    await port.saveRun(state, { runId, summary });
    expect((await port.loadEnded!())?.summary.foundModules).toEqual(found);

    const meta = await loadMetaManagerStrict(store);
    const [offer] = meta.state.pendingExtractions;
    expect(offer!.runId).toBe(runId);
    expect(offer!.moduleIds).toHaveLength(
      outcome === 'death' ? tuning.run.deathModulePoolSize : found.length,
    );
    expect(found).toEqual(expect.arrayContaining(offer!.moduleIds));
    expect(() => meta.extractModule(runId, 'scope')).toThrow();
    const chosen = offer!.moduleIds[0]!;
    expect(meta.isUnlocked(`module:${chosen}`)).toBe(false);
    meta.extractModule(runId, chosen);
    await saveMetaManager(store, meta);
    const restored = await loadMetaManagerStrict(store);
    expect(restored.state.pendingExtractions).toEqual([]);
    expect(
      restored.state.unlocks.filter((id) => id.startsWith('module:')),
    ).toEqual([`module:${chosen}`]);
    expect(restored.applyRun(summary, runId).applied).toBe(false);
    expect(() => restored.extractModule(runId, chosen)).toThrow();
    restored.setLoadout({
      ...restored.state.loadout,
      modules: { blaster: [chosen] },
    });
    expect(restored.loadout().modules?.blaster).toEqual([chosen]);
  },
);

async function setup(
  query: string,
  options: {
    store?: SaveStore;
    save?: MemoryRunSave;
    bus?: EventBus;
    navigate?: (url: string) => void;
    tuning?: Partial<(typeof tuning)['run']>;
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
    navigate: options.navigate ?? (() => {}),
  });
  active.add(scene);
  const sceneTuning = structuredClone(tuning);
  Object.assign(sceneTuning.run, options.tuning ?? {});
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('meta'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: sceneTuning,
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
    expect(saved.data).toBe(
      meta.state.data + view.rewards.data + patchBonus(view).data,
    );
    expect(saved.cores).toBe(
      meta.state.cores + view.rewards.cores + patchBonus(view).cores,
    );
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
  // Nagroda jest już na dysku: podsumowanie pokazuje ją z rekordu, bez drugiego naliczenia.
  expect(second.screens.view.meta!.rewards).toEqual(
    first.screens.view.meta!.rewards,
  );
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
  const bonus = patchBonus(screens.view.meta!);
  expect(saved.data).toBe(starter.data + rewards.data + bonus.data);
  expect(saved.cores).toBe(starter.cores + rewards.cores + bonus.cores);
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
  // Podwójne kliknięcie tego samego przycisku: druga próba czeka na pierwszą (bez drugiego zapisu).
  const retry = screens.actions.retrySave!;
  retry();
  retry();
  await scene.whenReady();
  screens.actions.retrySave?.();
  await scene.whenReady();
  const rewards = screens.view.meta!.rewards;
  const saved = (await store.loadMeta())!.meta;
  expect(saved.data).toBe(
    createStarterMetaState().data +
      rewards.data +
      patchBonus(screens.view.meta!).data,
  );
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
  const navigate = vi.fn();
  await setup('continue=1', { store, save, navigate });
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/');
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

it('saveMetaManager: zachowuje createdAt, ustawia updatedAt i bieżącą wersję', async () => {
  const store = createMemorySaveStore();
  const manager = new MetaManager(createStarterMetaState());
  await saveMetaManager(store, manager, () => 100);
  manager.debugAddData(7);
  await saveMetaManager(store, manager, () => 250);
  const saved = (await store.loadMeta())!;
  expect(saved).toMatchObject({
    saveVersion: SAVE_VERSION,
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

// ----------------------------------------------------------- poprawki po recenzji

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** Zakończony run zostawiony w zapisie z błędem zapisu meta (pierwsza scena). */
async function leaveUnsettled(seed: string) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control, inner } = flakyStore();
  const save = new MemoryRunSave();
  const first = await setup(`seed=${seed}&loadout=meta`, { store, save });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end win');
  await first.scene.whenReady();
  expect(first.screens.view.rewardError).toBe('save');
  first.scene.dispose();
  return { store, control, inner, save, snapshot };
}

it('pkt 1: udane rozliczenie zostawionego runu pozwala wystartować nowy run, nagroda raz', async () => {
  const { store, control, save, snapshot } = await leaveUnsettled('r1');
  control.fail = false;
  const second = await setup('seed=r1-next&loadout=classic', { store, save });
  expect(second.screens.view.screen).toBe('map');
  expect((second.scene.query('runState') as RunState).seed).toBe('r1-next');
  const saved = (await store.loadMeta())!.meta;
  expect(saved.stats.runs).toBe(1);
  expect(saved.appliedRunIds).toEqual([runIdOf(snapshot)]);
  expect(save.ended).toBeNull();
});

it('pkt 1: nieudane rozliczenie zostawionego runu nie startuje nowego runu i nie rusza zapisu', async () => {
  const { store, save, snapshot } = await leaveUnsettled('r2');
  const before = structuredClone({ state: save.state, ended: save.ended });
  const second = await setup('seed=r2-next&loadout=classic', { store, save });
  expect(second.screens.view.screen).toBe('summary');
  expect(second.screens.view.rewardError).toBe('save');
  expect(second.screens.actions.retrySave).toBeTypeOf('function');
  expect((second.scene.query('runState') as RunState).seed).toBe('r2');
  expect(save.state).toEqual(before.state);
  expect(save.ended).toEqual(before.ended);
  expect(save.ended!.runId).toBe(runIdOf(snapshot));
  expect(await store.loadMeta()).toBeNull();
});

it('pkt 1: błąd applyRun przy zostawionym runie: komunikat, „Porzuć nagrodę” odblokowuje nowy run', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const store = createMemorySaveStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=r3&loadout=classic', { store, save });
  const snapshot = first.scene.query('runState') as RunState;
  first.scene.dispose();
  save.state = snapshot;
  save.ended = { runId: runIdOf(snapshot), summary: brokenSummary('r3') };
  const second = await setup('seed=r3-next&loadout=classic', { store, save });
  expect(second.screens.view.screen).toBe('summary');
  expect(second.screens.view.rewardError).toBe('apply');
  expect(second.screens.actions.retrySave).toBeUndefined();
  expect(save.state).not.toBeNull();
  second.screens.actions.abandonReward!();
  await second.scene.whenReady();
  expect(save.state).toBeNull();
  expect(second.screens.view.rewardError).toBeNull();
  expect(second.screens.actions.abandonReward).toBeUndefined();
  second.scene.dispose();
  const third = await setup('seed=r3-next&loadout=classic', { store, save });
  expect(third.screens.view.screen).toBe('map');
});

it('pkt 2: wyjście z podsumowania czeka na zapis (przyciski w stanie zapisywania)', async () => {
  const calls: string[] = [];
  const gate = deferred();
  const inner = createMemorySaveStore();
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      await gate.promise;
      calls.push('saveMeta');
      await inner.saveMeta(data);
    },
  };
  const save = new MemoryRunSave(calls);
  const navigate = vi.fn((url: string) => calls.push(`navigate ${url}`));
  const { screens, commands, scene } = await setup('seed=r4&loadout=meta', {
    store,
    save,
    navigate,
  });
  commands.execute('run end lose');
  await flush();
  screens.actions.menu();
  await flush();
  expect(navigate).not.toHaveBeenCalled();
  expect(screens.view.leaving).toBe(true);
  gate.resolve();
  await scene.whenReady();
  await flush();
  expect(calls).toEqual(['saveMeta', 'clearRun', 'navigate /']);
});

it('pkt 2: wyjście czeka także na błąd zapisu, potem nawiguje', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const { store } = flakyStore(calls);
  const save = new MemoryRunSave(calls);
  const navigate = vi.fn((url: string) => calls.push(`navigate ${url}`));
  const { screens, commands, scene } = await setup('seed=r5&loadout=meta', {
    store,
    save,
    navigate,
  });
  commands.execute('run end lose');
  screens.actions.hub?.();
  await scene.whenReady();
  await flush();
  expect(calls).toEqual(['saveMeta', 'navigate /?scene=hub']);
});

it('pkt 3: nagrody pokazują się dopiero po potwierdzeniu zapisu (także przy ponowieniu)', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  let gate = deferred();
  const inner = createMemorySaveStore();
  const control = { fail: false };
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      await gate.promise;
      if (control.fail) throw new Error('dysk pełny');
      await inner.saveMeta(data);
    },
  };
  const { screens, commands, scene } = await setup('seed=r6&loadout=meta', {
    store,
  });
  commands.execute('run end win');
  await flush();
  expect(screens.view.rewardPending).toBe(true);
  expect(screens.view.meta).toBeUndefined();
  control.fail = true;
  gate.resolve();
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  gate = deferred();
  control.fail = false;
  screens.actions.retrySave!();
  await flush();
  expect(screens.view.rewardPending).toBe(true);
  expect(screens.view.meta).toBeUndefined();
  gate.resolve();
  await scene.whenReady();
  expect(screens.view.rewardPending).toBe(false);
  expect(screens.view.meta).toBeDefined();
});

it('pkt 4: błąd zapisu śladu zakończenia to błąd „save” z ponowieniem, które zapisuje też ślad', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const calls: string[] = [];
  const store = recordingStore(calls);
  const save = new MemoryRunSave(calls);
  const control = { fail: true };
  const endedWrites: RunEnded[] = [];
  const saveRun = save.saveRun.bind(save);
  save.saveRun = async (state, ended) => {
    if (ended) {
      endedWrites.push(ended);
      if (control.fail) throw new Error('zapis runu zablokowany');
    }
    await saveRun(state, ended);
  };
  const { screens, commands, scene } = await setup('seed=r7&loadout=meta', {
    store,
    save,
  });
  calls.length = 0;
  commands.execute('run end lose');
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  expect(calls).toEqual([]);
  control.fail = false;
  screens.actions.retrySave!();
  await scene.whenReady();
  expect(endedWrites).toHaveLength(2);
  expect(calls).toEqual(['saveMeta', 'clearRun']);
  expect(screens.view.rewardError).toBeNull();
  expect(save.state).toBeNull();
});

it('pkt 5: błąd clearRun po udanym zapisie meta pokazuje nagrody normalnie', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const store = createMemorySaveStore();
  const save = new MemoryRunSave();
  save.clearRun = async () => {
    throw new Error('nie można usunąć');
  };
  const { screens, commands, scene } = await setup('seed=r8&loadout=meta', {
    store,
    save,
  });
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.rewardError).toBeNull();
  expect(screens.view.meta!.rewards.data).toBeGreaterThan(0);
  expect(save.ended).not.toBeNull();
  expect((await store.loadMeta())!.meta.stats.runs).toBe(1);
});

it('pkt 5: Kontynuuj z runem już zapisanym na dysku: tylko clearRun, nagrody z rekordu albo neutralny tekst', async () => {
  const calls: string[] = [];
  const store = recordingStore(calls);
  const save = new MemoryRunSave(calls);
  const first = await setup('seed=r9&loadout=meta', { store, save });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end win');
  await first.scene.whenReady();
  const rewards = first.screens.view.meta!.rewards;
  const summary = first.screens.view.summary!;
  first.scene.dispose();
  save.state = snapshot;
  save.ended = { runId: runIdOf(snapshot), summary };
  calls.length = 0;
  const second = await setup('continue=1', { store, save });
  await second.scene.whenReady();
  expect(calls).toEqual(['clearRun']);
  expect(second.screens.view.meta!.rewards).toEqual(rewards);
  expect(second.screens.view.rewardAlreadySaved).toBe(false);
  second.scene.dispose();
  // Rekord wypadł z lastRuns: neutralny tekst zamiast nagród.
  const meta = (await store.loadMeta())!.meta;
  meta.lastRuns = [];
  await store.saveMeta({
    saveVersion: SAVE_VERSION,
    createdAt: 0,
    updatedAt: 0,
    meta,
  });
  save.state = snapshot;
  save.ended = { runId: runIdOf(snapshot), summary };
  const third = await setup('continue=1', { store, save });
  await third.scene.whenReady();
  expect(third.screens.view.meta).toBeUndefined();
  expect(third.screens.view.rewardAlreadySaved).toBe(true);
  expect(save.state).toBeNull();
});

it('pkt 6: błąd odczytu meta przy rozliczeniu nie nadpisuje meta i daje błąd „save”', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const inner = createMemorySaveStore();
  await saveMetaManager(inner, configuredMeta());
  const before = (await inner.loadMeta())!;
  const writes: MetaSave[] = [];
  const control = { brokenRead: false };
  const store: SaveStore = {
    ...inner,
    loadMeta: async () => {
      if (control.brokenRead) throw new Error('uszkodzony odczyt');
      return inner.loadMeta();
    },
    loadMetaStrict: undefined,
    saveMeta: async (data) => {
      writes.push(data);
      await inner.saveMeta(data);
    },
  };
  const save = new MemoryRunSave();
  const { screens, commands, scene } = await setup('seed=r10&loadout=meta', {
    store,
    save,
  });
  control.brokenRead = true;
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  expect(writes).toEqual([]);
  expect(await inner.loadMeta()).toEqual(before);
  expect(save.ended).not.toBeNull();
  control.brokenRead = false;
  screens.actions.retrySave!();
  await scene.whenReady();
  expect(writes).toHaveLength(1);
  expect((await inner.loadMeta())!.meta.stats.runs).toBe(1);
});

it('pkt 6: loadMetaManagerStrict rzuca przy błędzie odczytu, brak zapisu to stan startowy', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const empty = await loadMetaManagerStrict(createMemorySaveStore());
  expect(empty.state).toEqual(createStarterMetaState());
  const broken: SaveStore = {
    ...createMemorySaveStore(),
    loadMeta: async () => {
      throw new Error('uszkodzone');
    },
    loadMetaStrict: undefined,
  };
  await expect(loadMetaManagerStrict(broken)).rejects.toThrow('uszkodzone');
  // Dotychczasowa funkcja bez zmian: stan startowy.
  expect((await loadMetaManager(broken)).state).toEqual(
    createStarterMetaState(),
  );
});

it('pkt 7: ponowienie czyta meta z dysku; zmiana między błędem a ponowieniem zostaje, nagroda raz', async () => {
  const { store, control, inner, save } = await leaveUnsettledInScene();
  const { scene, screens } = save;
  // W międzyczasie (np. zakup w innej karcie) na dysku zmieniły się Dane.
  const meta = new MetaManager(createStarterMetaState());
  meta.debugAddData(500);
  await saveMetaManager(inner, meta);
  control.fail = false;
  screens.actions.retrySave!();
  await scene.whenReady();
  const rewards = screens.view.meta!.rewards;
  const saved = (await store.loadMeta())!.meta;
  expect(saved.data).toBe(
    500 + rewards.data + patchBonus(screens.view.meta!).data,
  );
  expect(saved.stats.runs).toBe(1);
});

async function leaveUnsettledInScene() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control, inner } = flakyStore();
  const runSave = new MemoryRunSave();
  const { scene, screens, commands } = await setup('seed=r11&loadout=meta', {
    store,
    save: runSave,
  });
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('save');
  return { store, control, inner, save: { scene, screens, runSave } };
}

it('pkt 9: continue=1 bez zapisu wraca do menu zamiast wyjątku', async () => {
  const navigate = vi.fn();
  const { scene } = await setup('continue=1', { navigate });
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/');
  await expect(scene.whenReady()).resolves.toBeUndefined();
});

it('pkt 10: po wiszącym zapisie ponowienie jest możliwe i działa po jego rozwiązaniu', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const hung = deferred();
  const inner = createMemorySaveStore();
  let first = true;
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      if (first) {
        first = false;
        await hung.promise;
        throw new Error('przekroczony czas');
      }
      await inner.saveMeta(data);
    },
  };
  const save = new MemoryRunSave();
  const { screens, commands, scene } = await setup('seed=r12&loadout=meta', {
    store,
    save,
    tuning: { rewardSaveTimeoutS: 0.02 },
  });
  commands.execute('run end win');
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(screens.view.rewardError).toBe('save');
  screens.actions.retrySave!();
  hung.resolve();
  await scene.whenReady();
  expect(screens.view.rewardError).toBeNull();
  expect(screens.view.meta).toBeDefined();
  expect((await inner.loadMeta())!.meta.stats.runs).toBe(1);
  expect(save.state).toBeNull();
});

it('naszywki z runu: zdarzenia gry i zwycięstwo trafiają do meta, podsumowania i zapisu runu', async () => {
  const { scene, screens, commands, bus, store } = await setup(
    'seed=a1&loadout=meta',
  );
  const earned: string[] = [];
  bus.on('achievement_earned', ({ id }) => earned.push(id));
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  bus.emit('entity_spawned', { id: 9, kind: 'drone' });
  bus.emit('damage_dealt', {
    source: 1,
    target: 9,
    amount: 5,
    tags: ['#gun'],
    point: null,
    dir: null,
    knockback: 0,
    killed: true,
  });
  bus.emit('enemy_killed', { id: 9, killer: 1, tags: ['#gun'] });
  for (let i = 0; i < 3; i += 1)
    bus.emit('dash_used', { user: 1, dir: { x: 0, y: 0, z: 1 } });
  expect(earned).toEqual(['pierwsza-krew']);
  expect(scene.query('runAchievements')).toMatchObject({
    counters: { kills_gun: 1, dash_used: 3 },
    flags: ['pierwsza-krew'],
  });
  commands.execute('run end win');
  await scene.whenReady();
  const view = screens.view.meta!;
  // Run z samymi obrażeniami bronią palną to też „Droga strzelca”.
  expect(view.achievements!.map((unlock) => unlock.id)).toEqual([
    'pierwsza-krew',
    'droga-strzelca',
    'pierwsze-zwyciestwo',
  ]);
  const saved = (await store.loadMeta())!.meta;
  expect(saved.achievements.unlocked).toEqual([
    'pierwsza-krew',
    'droga-strzelca',
    'pierwsze-zwyciestwo',
  ]);
  expect(saved.achievements.counters).toEqual({
    kills_gun: 1,
    dash_used: 3,
    runs_ended: 1,
    victories: 1,
  });
  expect(scene.query('achievements')).toEqual(saved.achievements);
  // Zdarzenia po końcu runu nie zmieniają już niczego.
  bus.emit('dash_used', { user: 1, dir: { x: 0, y: 0, z: 1 } });
  expect(scene.query('runAchievements')).toMatchObject({
    counters: { dash_used: 3 },
  });
});

it('naszywki: ponowienie zapisu po błędzie i wznowienie nie dublują liczników ani nagród', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control } = flakyStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=a2&loadout=meta', { store, save });
  first.bus.emit('entity_spawned', { id: 1, kind: 'player' });
  first.bus.emit('dash_used', { user: 1, dir: { x: 0, y: 0, z: 1 } });
  first.commands.execute('run end win');
  await first.scene.whenReady();
  expect(first.screens.view.rewardError).toBe('save');
  // Zakończenie z przyrostami czeka w zapisie runu (przeżywa odświeżenie).
  expect(save.ended?.summary.achievements?.counters).toEqual({
    dash_used: 1,
  });
  control.fail = false;
  first.screens.actions.retrySave!();
  await first.scene.whenReady();
  const afterRetry = (await store.loadMeta())!.meta;
  expect(afterRetry.achievements.counters).toEqual({
    dash_used: 1,
    runs_ended: 1,
    victories: 1,
  });
  first.scene.dispose();
  // Odświeżenie po rozliczeniu: nie ma już czego wznawiać ani liczyć.
  const navigate = vi.fn();
  await setup('continue=1', { store, save, navigate });
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/');
  expect((await store.loadMeta())!.meta).toEqual(afterRetry);
});

it('postęp naszywek z pokoi przed odświeżeniem trafia do meta po Kontynuuj', async () => {
  const store = createMemorySaveStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=a3&loadout=meta', { store, save });
  first.bus.emit('entity_spawned', { id: 1, kind: 'player' });
  for (let i = 0; i < 3; i += 1)
    first.bus.emit('dash_used', { user: 1, dir: { x: 0, y: 0, z: 1 } });
  (first.scene as unknown as { showMap(): void }).showMap();
  await first.scene.whenReady();
  expect(save.state?.achievementProgress?.counters).toEqual({ dash_used: 3 });
  first.scene.dispose();
  const second = await setup('continue=1', { store, save });
  expect(second.scene.query('runAchievements')).toMatchObject({
    counters: { dash_used: 3 },
  });
  second.commands.execute('run end lose');
  await second.scene.whenReady();
  expect((await store.loadMeta())!.meta.achievements.counters).toMatchObject({
    dash_used: 3,
    runs_ended: 1,
  });
});

it('naszywka z zostawionego runu nie pokazuje się ponownie w HUD nowego runu', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { store, control } = flakyStore();
  const save = new MemoryRunSave();
  const first = await setup('seed=a4&loadout=meta', { store, save });
  first.bus.emit('entity_spawned', { id: 1, kind: 'player' });
  first.bus.emit('enemy_killed', { id: 9, killer: 1, tags: [] });
  first.commands.execute('run end lose');
  await first.scene.whenReady();
  expect(first.screens.view.rewardError).toBe('save');
  first.scene.dispose();
  control.fail = false;
  const bus = new EventBus();
  const earned: string[] = [];
  bus.on('achievement_earned', ({ id }) => earned.push(id));
  const second = await setup('seed=a5&loadout=meta', { store, save, bus });
  await second.scene.whenReady();
  expect((await store.loadMeta())!.meta.achievements.unlocked).toContain(
    'pierwsza-krew',
  );
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  bus.emit('enemy_killed', { id: 10, killer: 1, tags: [] });
  expect(earned).toEqual([]);
});

it('dane odrzucone przez walidację zapisu meta to błąd „apply” (Porzuć nagrodę), nie „save”', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const inner = createMemorySaveStore();
  const store: SaveStore = {
    ...inner,
    saveMeta: async () => {
      metaStateSchema.parse({});
    },
  };
  const { scene, screens, commands } = await setup('seed=a6&loadout=meta', {
    store,
  });
  commands.execute('run end win');
  await scene.whenReady();
  expect(screens.view.rewardError).toBe('apply');
  expect(screens.actions.abandonReward).toBeTypeOf('function');
  expect(screens.actions.retrySave).toBeUndefined();
});

it('podsumowanie po odświeżeniu pokazuje naszywki zdobyte w rozliczonym runie', async () => {
  const store = createMemorySaveStore();
  const first = await setup('seed=a7&loadout=meta', { store });
  const snapshot = first.scene.query('runState') as RunState;
  first.commands.execute('run end win');
  await first.scene.whenReady();
  expect(
    first.screens.view.meta!.achievements!.map((unlock) => unlock.id),
  ).toContain('pierwsze-zwyciestwo');
  first.scene.dispose();
  const save = new MemoryRunSave();
  save.state = snapshot;
  const second = await setup('continue=1', { store, save });
  second.commands.execute('run end win');
  await second.scene.whenReady();
  expect(
    second.screens.view.meta!.achievements!.map((unlock) => unlock.id),
  ).toContain('pierwsze-zwyciestwo');
});

it('zamknięta scena: timer wiszącego zapisu nic nie robi, a nagroda i tak się zapisuje', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const hung = deferred();
  const inner = createMemorySaveStore();
  const store: SaveStore = {
    ...inner,
    saveMeta: async (data) => {
      await hung.promise;
      await inner.saveMeta(data);
    },
  };
  const { commands, scene, screens } = await setup('seed=r13&loadout=meta', {
    store,
    tuning: { rewardSaveTimeoutS: 0.02 },
  });
  commands.execute('run end win');
  const refreshes = screens.view;
  scene.dispose();
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(
    warn.mock.calls.some(([text]) => String(text).includes('Rozliczenie')),
  ).toBe(false);
  expect(screens.view).toBe(refreshes);
  hung.resolve();
  await vi.waitFor(async () =>
    expect((await inner.loadMeta())?.meta.stats.runs).toBe(1),
  );
});
