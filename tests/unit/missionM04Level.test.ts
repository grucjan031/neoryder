import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m04-ladunek-klasy-k.json';
import { MissionScene } from '../../src/scenes/mission';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore, type SaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { InputSnapshot } from '../../src/core/input';
import { levelDefinitions, levelWaves } from '../../src/world/levels';
import { loadLevel } from '../../src/world/levelSchema';
import { RailPayload, type PayloadSnapshot } from '../../src/world/railPayload';
import { missionDefinitions } from '../../src/world/missions';
import { MetaManager } from '../../src/progression/meta';
import {
  saveMetaManager,
  loadMetaManagerStrict,
} from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const ID = 'm04-ladunek-klasy-k';
const level = levelDefinitions.get(ID)!;
const mission = missionDefinitions.get(ID)!;
const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: MissionScene[] = [];
afterEach(() => active.splice(0).forEach((scene) => scene.dispose()));
async function unlockedStore() {
  const store = createMemorySaveStore();
  const meta = createStarterMetaState();
  meta.campaign.completed = ['m01-maszty', 'm03-list-przewozowy'];
  await saveMetaManager(store, new MetaManager(meta));
  return store;
}
async function setup(store?: SaveStore, resume = false) {
  store ??= await unlockedStore();
  const commands = new CommandRegistry();
  const navigate = vi.fn();
  const bus = new EventBus();
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate,
    params: new URLSearchParams(
      `mission=${ID}&seed=m04-test${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('m04-test'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    new ThreeScene(),
  );
  return { scene, commands, navigate, store, bus };
}
const payload = (scene: MissionScene) =>
  scene.query('payload') as PayloadSnapshot;
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    checkpointId: string;
    objectives: Record<string, string>;
    activeEncounters: string[];
    openGates: string[];
  };
const position = (scene: MissionScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };
function steps(scene: MissionScene, n: number, commands?: CommandRegistry) {
  for (let i = 0; i < n; i++) {
    scene.step(SIM_DT, idle);
    if (commands && i % 30 === 0) commands.execute('kill all');
  }
}
function walkTo(
  scene: MissionScene,
  commands: CommandRegistry,
  x: number,
  z: number,
) {
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  for (let i = 0; i < 4000; i++) {
    const at = position(scene),
      dx = x - at.x,
      dz = z - at.z;
    if (Math.hypot(dx, dz) < 0.15) return;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, walk);
    if (i % 30 === 0) commands.execute('kill all');
  }
  throw new Error(
    `Trasa zablokowana przed ${x},${z}: ${JSON.stringify(position(scene))}`,
  );
}

it('M04: pełny poziom, Szron, osiem celów, dialogi, nagrody i następna misja', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(level.sections).toHaveLength(5);
  expect(level.encounters).toHaveLength(4);
  expect(level.allies).toEqual([
    { id: 'szron', spawn: { x: 10, y: 0, z: -4 } },
  ]);
  expect(mission.requires).toEqual(['m03-list-przewozowy']);
  expect(missionDefinitions.get('m06-odlewnia')!.requires).toEqual([ID]);
  expect(mission.briefing.length).toBeLessThanOrEqual(3);
  expect(mission.debrief.length).toBeLessThanOrEqual(6);
  expect(mission.rewards.firstClear).toEqual({ data: 110, cores: 1 });
  expect(mission.radio.flatMap((event) => event.lines)).toContainEqual({
    speaker: 'ida',
    text: '...Która godzina?',
  });
  for (const stop of level.payload!.stops)
    expect(level.objectiveOrder).toContain(stop.unlockAfter);
});

it('odrzuca błędną trasę, postój, cel i checkpoint wagonu', () => {
  for (const change of [
    (d: typeof data) => {
      d.payload.stops[0]!.unlockAfter = 'missing';
    },
    (d: typeof data) => {
      d.payload.stops[1]!.atM = 1;
    },
    (d: typeof data) => {
      d.payload.stops[0]!.unlockAfter = 'payload';
    },
    (d: typeof data) => {
      d.payload.route[1] = d.payload.route[0]!;
    },
    (d: typeof data) => {
      d.checkpoints[0]!.payloadDistanceM = 999;
    },
    (d: typeof data) => {
      d.payload.objective = 'exit';
    },
  ]) {
    const invalid = structuredClone(data);
    change(invalid);
    expect(() => loadLevel(invalid, mission, levelWaves)).toThrow();
  }
});

it('RailPayload: brama zatrzymuje wagon mimo braku wrogów; po interakcji rusza, checkpoint nie powtarza fal', () => {
  let opened = false;
  const reinforce = vi.fn();
  const cart = new RailPayload(
    [
      { x: 0, y: 0, z: 0 },
      { x: 30, y: 0, z: 0 },
    ],
    [
      {
        id: 'gate',
        name: 'Brama',
        atM: 5,
        holdS: 0,
        wave: 'wave',
        clearRequired: false,
      },
    ],
    tuning.prototypes.payload,
    { reinforce, canDepart: () => opened },
  );
  const input = { player: { x: 5, y: 0, z: 0 }, hostiles: [] };
  cart.step(2, input);
  cart.step(30, input);
  expect(cart.distanceM).toBe(5);
  expect(cart.status).toBe('holding');
  opened = true;
  cart.step(1, input);
  expect(cart.distanceM).toBeGreaterThan(5);
  cart.restore(15);
  expect(reinforce).toHaveBeenCalledOnce();
  expect(cart.snapshot()).toMatchObject({
    distanceM: 15,
    stopIndex: 1,
    hp: 400,
  });
  expect(() => cart.restore(31)).toThrow();
  cart.setHp(0);
  cart.step(1, input);
  expect(cart.status).toBe('destroyed');
});

it('blokuje start bez M03, exit bez wagonu; zniszczenie usuwa próbę bez nagród', async () => {
  await expect(setup(createMemorySaveStore())).rejects.toThrow(
    'Misja jest zablokowana.',
  );
  const { scene, commands, store, navigate, bus } = await setup();
  expect(scene.query('allies')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'szron' })]),
  );
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  commands.execute('payload hp 0');
  steps(scene, 1);
  expect(scene.query('screen')).toBe('failed');
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('?scene=hub'));
  expect(await store.loadMission!()).toBeNull();
  const meta = await loadMetaManagerStrict(store, bus);
  expect(meta.state.campaign.completed).not.toContain(ID);
  expect(meta.state.campaign.pendingDebrief).toBeNull();
});

it('wznowienie checkpointu odtwarza wagon i ukończone blokady', async () => {
  const { scene, commands, store } = await setup();
  for (const id of ['barricade', 'laser', 'switch-1'])
    commands.execute(`objective done ${id}`);
  commands.execute('checkpoint za-rogatka');
  await vi.waitFor(() => expect(scene.query('savePending')).toBe(false));
  scene.dispose();
  const resumed = await setup(store, true);
  expect(payload(resumed.scene)).toMatchObject({ distanceM: 84, hp: 400 });
  expect(state(resumed.scene).objectives['switch-1']).toBe('done');
  expect(state(resumed.scene).openGates).toContain('gate-switch-1');
});

it('błąd zapisu porażki nie pozwala kończyć celów; retry usuwa próbę bez rozliczenia', async () => {
  const store = await unlockedStore();
  const clear = store.clearMission!;
  store.clearMission = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementation(clear);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { scene, commands, navigate } = await setup(store);
    commands.execute('payload hp 0');
    steps(scene, 1);
    await vi.waitFor(() => expect(scene.query('saveError')).toBe('offline'));
    expect(navigate).not.toHaveBeenCalled();
    expect(commands.execute('objective done barricade')).toBe(
      'Cel niedostępny.',
    );
    expect(commands.execute('checkpoint za-rogatka')).toBe(
      'Niedostępny punkt kontrolny.',
    );
    commands.execute('mission retry');
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('?scene=hub'));
    expect(await store.loadMission!()).toBeNull();
    expect(scene.query('screen')).toBe('failed');
  } finally {
    error.mockRestore();
  }
});

it('przechodzi kapsułą całą trasę: interakcje, bramy, Egzekutor, rzeczywisty dojazd wagonu i tunel', async () => {
  const { scene, commands, store, bus } = await setup();
  commands.execute('god');
  // Eskorta idzie tempem wagonu; cele boczne wymagają krótkiego odejścia od toru.
  for (const id of ['barricade', 'laser', 'switch-1', 'carts', 'switch-2']) {
    const target = level.objectivePositions[id]!;
    for (let x = position(scene).x; x < target.x; x += 3) {
      walkTo(scene, commands, x, 4);
      steps(scene, 65, commands);
    }
    walkTo(scene, commands, target.x, target.z);
    steps(scene, 150, commands);
    expect(state(scene).objectives[id]).toBe('done');
    expect(state(scene).openGates).toContain(`gate-${id}`);
    walkTo(scene, commands, target.x, 4);
  }
  walkTo(scene, commands, 180, 4);
  steps(scene, 600, commands);
  expect(state(scene).objectives.executor).toBe('done');
  expect(state(scene).objectives.payload).not.toBe('done');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  // Wracamy po wagon, jeśli wyprzedziliśmy go podczas walki.
  walkTo(scene, commands, payload(scene).position.x, 4);
  for (let x = payload(scene).position.x; x < 240; x += 3) {
    walkTo(scene, commands, x, 4);
    steps(scene, 65, commands);
  }
  walkTo(scene, commands, 240, 4);
  steps(scene, 180, commands);
  expect(payload(scene).status).toBe('arrived');
  expect(state(scene).objectives.payload).toBe('done');
  walkTo(scene, commands, 249, 4);
  steps(scene, 150);
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
  expect(
    (await loadMetaManagerStrict(store, bus)).state.campaign.completed,
  ).toContain(ID);
}, 300_000);
