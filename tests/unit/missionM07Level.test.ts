import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m07-nocny-dyzur.json';
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
import { LevelRuntime } from '../../src/world/levelRuntime';
import { missionDefinitions } from '../../src/world/missions';
import { MetaManager } from '../../src/progression/meta';
import { saveMetaManager } from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const ID = 'm07-nocny-dyzur';
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

async function unlockedStore(): Promise<SaveStore> {
  const store = createMemorySaveStore();
  const meta = createStarterMetaState();
  meta.campaign.completed = [
    'm01-maszty',
    'm02-punkt-kontrolny',
    'm03-list-przewozowy',
    'm04-ladunek-klasy-k',
    'm06-odlewnia',
  ];
  await saveMetaManager(store, new MetaManager(meta));
  return store;
}
async function setup(store?: SaveStore) {
  const commands = new CommandRegistry();
  const three = new ThreeScene();
  const navigate = vi.fn();
  const scene = new MissionScene({
    store: store ?? (await unlockedStore()),
    loadModels: false,
    navigate,
    params: new URLSearchParams(`mission=${ID}&seed=m07-unit`),
  });
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m07-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    three,
  );
  return { scene, commands, three, navigate };
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
const position = (scene: MissionScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };
function steps(scene: MissionScene, count: number) {
  for (let index = 0; index < count; index++) scene.step(SIM_DT, idle);
}
function walkTo(
  scene: MissionScene,
  commands: CommandRegistry,
  x: number,
  z: number,
) {
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  for (let index = 0; index < 4000; index++) {
    const at = position(scene);
    const dx = x - at.x;
    const dz = z - at.z;
    if (Math.hypot(dx, dz) <= 0.12) return at;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, walk);
    if (state(scene).activeEncounters.length)
      commands.execute('encounter clear');
  }
  throw new Error(
    `Nie można dojść do (${x}, ${z}): ${JSON.stringify(position(scene))}`,
  );
}

it('ładuje poziom M07: pięć sekcji, siedem spotkań, cele krata, kapsula, serwer i exit', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.level).toBe(ID);
  expect(mission.requires).toEqual(['m06-odlewnia']);
  expect(level.sections.map((section) => section.id)).toEqual([
    'bulwar',
    'estakada',
    'przychodnia',
    'serwerownia',
    'targ',
  ]);
  expect(level.encounters.map((entry) => entry.id)).toEqual([
    'alarm-hala',
    'wieza-magazynu',
    'czujnik-serwera',
    'alarm-serwerownia',
    'poscig-targ-1',
    'poscig-targ-2',
    'blokada-windy',
  ]);
  expect(level.objectiveOrder).toEqual(['krata', 'kapsula', 'serwer', 'exit']);
  expect(mission.objectives.map((objective) => objective.kind)).toEqual([
    'interact',
    'pickup',
    'defend',
    'exit',
  ]);
  expect(level.allies).toEqual([{ id: 'nadia', spawn: { x: 4, y: 0, z: -3 } }]);
  expect(level.checkpoints.map((point) => point.id)).toEqual([
    'start',
    'ulica',
    'kuchnia',
    'pomost',
    'hala',
    'magazyn',
    'serwerownia',
    'targ',
    'winda',
  ]);
  for (const encounter of level.encounters)
    for (const wave of levelWaves.get(encounter.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
});

it('fala serwera jest powiązana z progiem celu defend; błędne powiązania są odrzucane', () => {
  const server = mission.objectives.find((item) => item.id === 'serwer')!;
  if (server.kind !== 'defend') throw new Error('serwer nie jest defend');
  expect(server.durationS).toBe(8);
  const encounter = level.encounters.find(
    (item) => item.reinforcementFor === 'serwer:0',
  );
  expect(encounter?.wave).toBe(server.waves![0]!.wave);
  const withKey = (key: string) => ({
    ...data,
    encounters: data.encounters.map((entry) =>
      entry.id === 'czujnik-serwera'
        ? { ...entry, reinforcementFor: key }
        : entry,
    ),
  });
  for (const broken of [withKey('serwer:3'), withKey('serwer'), withKey('x:0')])
    expect(() => loadLevel(broken, mission, levelWaves)).toThrow();
});

it('LevelRuntime: alarm tylko w korytarzu środkowym hali; pościg dopiero po serwerze', () => {
  const runtime = new LevelRuntime(level);
  const base = { krata: 'done', kapsula: 'active', serwer: 'pending' };
  // Pasy boczne hali (boksy zabiegowe) są ciche.
  expect(runtime.step({ x: 146, y: 0, z: -9.2 }, base)).toEqual([]);
  expect(runtime.step({ x: 146, y: 0, z: 9.2 }, base)).toEqual([]);
  // Oświetlony korytarz środkowy to wykrycie.
  expect(runtime.step({ x: 146, y: 0, z: 0 }, base)).toEqual(['alarm-hala']);
  expect(runtime.openGates(base)).not.toContain('gate-rolety');
  runtime.clear('alarm-hala');
  expect(runtime.openGates(base)).toContain('gate-rolety');
  // Targ jest pusty do końca transferu.
  expect(runtime.step({ x: 266, y: 0, z: 0 }, base)).toEqual([]);
  expect(
    runtime.step({ x: 266, y: 0, z: 0 }, { ...base, serwer: 'done' }),
  ).toEqual(['poscig-targ-1']);
  // Fale celu defend nie startują od strefy.
  expect(
    runtime.step({ x: 241, y: 0, z: 0 }, { ...base, serwer: 'active' }),
  ).toEqual([]);
});

it('misja wymaga M06, a cele są ułożone w kolejności', async () => {
  await expect(setup(createMemorySaveStore())).rejects.toThrow(
    'Misja jest zablokowana.',
  );
  const { scene, commands } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done kapsula')).toBe('Cel niedostępny.');
  expect(state(scene).checkpointId).toBe('start');
}, 120_000);

it('bramy mają kolizję do czasu celu: krata, magazyn, serwerownia i winda', async () => {
  const { scene, commands, three } = await setup();
  commands.execute('god');
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  const blocked = (x: number, z: number, limit: number) => {
    commands.execute(`tp ${x} ${z} -90`);
    for (let i = 0; i < 90; i++) {
      scene.step(SIM_DT, walk);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(position(scene).x).toBeLessThan(limit);
  };
  blocked(61, 0, 66);
  expect(three.getObjectByName('gate:gate-krata')?.visible).toBe(true);
  expect(commands.execute('objective done krata')).toBe('Cel ukończony.');
  expect(state(scene).openGates).toContain('gate-krata');
  blocked(202, -7, 206);
  expect(commands.execute('objective done kapsula')).toBe('Cel ukończony.');
  expect(state(scene).openGates).toContain('gate-serwerownia');
  blocked(244, 0, 248);
  expect(commands.execute('objective done serwer')).toBe('Cel ukończony.');
  expect(state(scene).openGates).toContain('gate-targ');
  blocked(312, 0, 316);
  expect(state(scene).openGates).not.toContain('gate-winda');
  steps(scene, 2);
}, 120_000);

const route: Record<string, [number, number][]> = {
  krata: [
    [30, 0],
    [44, 0],
    [55, 2.8],
    [60, 2.8],
  ],
  kapsula: [
    // Pomost, lobby i cichy pas południowy hali (bez wejścia w korytarz środkowy).
    [90, 0],
    [118, 0],
    [124, -9.2],
    [165, -9.2],
    [168, -4],
    [170, 0],
    [180, 0],
    [189, 0],
    [189, -7.2],
  ],
  serwer: [
    [203, -7.2],
    [203, 0],
    [230, 0],
  ],
  exit: [
    // Szafa serwera stoi w osi pomieszczenia: obchodzimy ją od północy.
    [242, 3.2],
    [247, 3.2],
    [250, 0],
    [270, 0],
    [310, 0],
    [320, 0],
  ],
};
const stand: Record<string, [number, number]> = {
  krata: [63.5, 0],
  kapsula: [198, -7.2],
  serwer: [238, 0],
  exit: [326, 0],
};

it('pozwala fizycznie przejść całą trasę po cichym pasie: bramy, kapsuła, serwer, targ i winda', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  for (const id of level.objectiveOrder) {
    for (const [x, z] of route[id]!) walkTo(scene, commands, x, z);
    const [x, z] = stand[id]!;
    walkTo(scene, commands, x, z);
    for (
      let index = 0;
      index < 30 / SIM_DT && state(scene).objectives[id] !== 'done';
      index++
    ) {
      scene.step(SIM_DT, idle);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(state(scene).objectives[id]).toBe('done');
    // Zakradanie: do końca fazy cichej alarm hali nie padł.
    if (id === 'kapsula')
      expect(state(scene).completedEncounters).not.toContain('alarm-hala');
  }
  expect(state(scene).completedEncounters).toEqual(
    expect.arrayContaining([
      'wieza-magazynu',
      'poscig-targ-1',
      'poscig-targ-2',
      'blokada-windy',
    ]),
  );
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
}, 400_000);
