import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m03-list-przewozowy.json';
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

const ID = 'm03-list-przewozowy';
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
  meta.campaign.completed = ['m01-maszty'];
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
    params: new URLSearchParams(`mission=${ID}&seed=m03-unit`),
  });
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m03-unit'),
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

it('ładuje poziom M03: pięć sekcji, osiem spotkań, cele terminal i exit', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.level).toBe(ID);
  expect(level.sections.map((section) => section.id)).toEqual([
    'nabrzeze',
    'plac-celny',
    'przedpole',
    'magazyn',
    'dok',
  ]);
  expect(level.encounters).toHaveLength(8);
  expect(level.objectiveOrder).toEqual(['terminal', 'exit']);
  expect(level.checkpoints.map((point) => point.id)).toEqual([
    'start',
    'plac-celny',
    'przedpole',
    'magazyn',
    'dok',
  ]);
  // Wrogowie spotkań należą do listy wrogów misji.
  for (const encounter of level.encounters)
    for (const wave of levelWaves.get(encounter.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
  // Radio sekcji wskazuje istniejące wyzwalacze misji.
  for (const section of level.sections)
    if (section.radio)
      expect(mission.radio.map((entry) => entry.trigger)).toContain(
        section.radio,
      );
});

it('każda fala obrony terminala ma spotkanie z tą samą falą; błędne powiązania są odrzucane', () => {
  const terminal = mission.objectives.find((item) => item.id === 'terminal')!;
  if (terminal.kind !== 'defend') throw new Error('terminal nie jest defend');
  expect(terminal.waves).toHaveLength(3);
  terminal.waves!.forEach((entry, index) => {
    const encounter = level.encounters.find(
      (item) => item.reinforcementFor === `terminal:${index}`,
    );
    expect(encounter?.wave).toBe(entry.wave);
    expect(encounter?.after).toBeUndefined();
  });
  const withKey = (key: string, wave?: string) => ({
    ...data,
    encounters: data.encounters.map((entry) =>
      entry.id === 'transfer-1'
        ? { ...entry, reinforcementFor: key, wave: wave ?? entry.wave }
        : entry,
    ),
  });
  for (const broken of [
    withKey('terminal:0', 'missionDockShields'),
    withKey('terminal:7'),
    withKey('terminal'),
    withKey('exit:0'),
    withKey('missing:0'),
  ])
    expect(() => loadLevel(broken, mission, levelWaves)).toThrow();
});

it('LevelRuntime nie uruchamia fal obrony strefą; startuje je dopiero próg transferu', async () => {
  const runtime = new LevelRuntime(level, [
    'patrol-nabrzeze',
    'oslona-celna',
    'posterunek-magazynu',
  ]);
  const started = runtime.step(level.objectivePositions.terminal!, {
    terminal: 'active',
    exit: 'active',
  });
  expect(started).toEqual(['pierwsza-zmiana']);
  expect(
    runtime.step(level.objectivePositions.terminal!, {
      terminal: 'done',
      exit: 'active',
    }),
  ).toEqual(['poscig']);

  const { scene, commands } = await setup();
  commands.execute('god');
  commands.execute('tp 201 1');
  steps(scene, 4);
  commands.execute('encounter clear');
  // 2 s wpięcia + 25% z 90 s transferu.
  for (
    let index = 0;
    index < 26 / SIM_DT &&
    !state(scene).activeEncounters.includes('transfer-1');
    index++
  )
    scene.step(SIM_DT, idle);
  expect(state(scene).activeEncounters).toEqual(['transfer-1']);
  expect(state(scene).objectives.terminal).not.toBe('done');
  expect(state(scene).openGates).not.toContain('gate-dok');
}, 120_000);

it('misja wymaga ukończonej M01, a bramy mają kolizję do czasu spotkania i celu', async () => {
  await expect(setup(createMemorySaveStore())).rejects.toThrow(
    'Misja jest zablokowana.',
  );
  const { scene, commands, three } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  // Brama celna: zamknięta przed patrolem nabrzeża.
  commands.execute('tp 81 0 -90');
  for (let i = 0; i < 90; i++) scene.step(SIM_DT, walk);
  expect(position(scene).x).toBeLessThan(84);
  expect(three.getObjectByName('gate:gate-patrol-nabrzeze')?.visible).toBe(
    true,
  );
  commands.execute('tp 40 0 -90');
  steps(scene, 4);
  expect(state(scene).activeEncounters).toEqual(['patrol-nabrzeze']);
  commands.execute('encounter clear');
  steps(scene, 2);
  expect(state(scene).openGates).toEqual(['gate-patrol-nabrzeze']);
  commands.execute('tp 81 0 -90');
  for (let i = 0; i < 90; i++) scene.step(SIM_DT, walk);
  expect(position(scene).x).toBeGreaterThan(84);
  // Brama dokowa: zamknięta do końca transferu.
  commands.execute('tp 222 0 -90');
  for (let i = 0; i < 90; i++) scene.step(SIM_DT, walk);
  expect(position(scene).x).toBeLessThan(225);
  expect(commands.execute('objective done terminal')).toBe('Cel ukończony.');
  expect(state(scene).openGates).toContain('gate-dok');
  for (let i = 0; i < 120; i++) scene.step(SIM_DT, walk);
  expect(position(scene).x).toBeGreaterThan(226);
  expect(state(scene).checkpointId).toBe('dok');
}, 120_000);

const route: Record<string, [number, number][]> = {
  terminal: [
    [30, 1],
    [60, 1],
    [63, -0.9],
    [77, -1.5],
    [86, -1.5],
    [89, 3.5],
    [108, 3.5],
    [108, -4],
    [124, -4],
    [129, 0],
    [136, 0],
    [180, 0],
    [190, 0],
    [192, 2.5],
    [198, 2.5],
  ],
  exit: [
    [205, -2.5],
    [213, -2.5],
    [220, 0],
    [229, 0],
    [244, -3],
  ],
};

it('pozwala fizycznie przejść całą trasę: bramy, obrona terminala i barka', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  for (const id of level.objectiveOrder) {
    const target = level.objectivePositions[id]!;
    for (const [x, z] of route[id]!) walkTo(scene, commands, x, z);
    walkTo(scene, commands, target.x, target.z + (id === 'terminal' ? 1.4 : 0));
    // Wpięcie 2 s + transfer 90 s w strefie; brama dokowa 2 s.
    for (
      let index = 0;
      index < 95 / SIM_DT && state(scene).objectives[id] !== 'done';
      index++
    ) {
      scene.step(SIM_DT, idle);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(state(scene).objectives[id]).toBe('done');
  }
  expect(state(scene).completedEncounters).toEqual(
    expect.arrayContaining([
      'patrol-nabrzeze',
      'oslona-celna',
      'posterunek-magazynu',
    ]),
  );
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
}, 300_000);
