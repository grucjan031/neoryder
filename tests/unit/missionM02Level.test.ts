import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m02-punkt-kontrolny.json';
import { MissionScene } from '../../src/scenes/mission';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore, type SaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { InputSnapshot } from '../../src/core/input';
import type { AllySnapshot } from '../../src/allies/ally';
import { levelDefinitions, levelWaves } from '../../src/world/levels';
import { loadLevel } from '../../src/world/levelSchema';
import { LevelRuntime } from '../../src/world/levelRuntime';
import { missionDefinitions } from '../../src/world/missions';
import { MetaManager } from '../../src/progression/meta';
import { saveMetaManager } from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const ID = 'm02-punkt-kontrolny';
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
async function setup(store?: SaveStore, resume = false) {
  if (!store) {
    store = createMemorySaveStore();
    const meta = createStarterMetaState();
    meta.campaign.completed = ['m01-maszty'];
    await saveMetaManager(store, new MetaManager(meta));
  }
  const commands = new CommandRegistry();
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate: vi.fn(),
    params: new URLSearchParams(
      `mission=${ID}&seed=m02-unit${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  const three = new ThreeScene();
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m02-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    three,
  );
  return { scene, commands, store, three };
}
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    checkpointId: string;
    objectives: Record<string, string>;
    activeEncounters: string[];
    completedEncounters: string[];
    openGates: string[];
  };
const position = (scene: MissionScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };
const allies = (scene: MissionScene) => scene.query('allies') as AllySnapshot[];
function steps(scene: MissionScene, count: number) {
  for (let i = 0; i < count; i++) scene.step(SIM_DT, idle);
}
function walkTo(
  scene: MissionScene,
  commands: CommandRegistry,
  x: number,
  z = 0,
) {
  for (let i = 0; i < 4000; i++) {
    const at = position(scene);
    const dx = x - at.x,
      dz = z - at.z;
    if (Math.hypot(dx, dz) <= 0.12) return;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
    // Spotkanie finałowe musi zakończyć dyrektor, nie komenda clear.
    if (!state(scene).activeEncounters.includes('egzekutor'))
      commands.execute('encounter clear');
  }
  throw new Error(
    `Trasa zablokowana przed (${x}, ${z}): ${JSON.stringify(position(scene))}`,
  );
}

it('M02 ma pięć sekcji, trzy cele, Egzekutora, zachodni exit i Nadię po drugiej celi', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.requires).toEqual(['m01-maszty']);
  expect(missionDefinitions.get('m03-list-przewozowy')!.requires).toEqual([ID]);
  expect(mission.objectives.filter((o) => o.kind === 'interact')).toHaveLength(
    3,
  );
  expect(mission.rewards.firstClear).toEqual({ data: 80, cores: 1 });
  expect(level.sections.map((s) => s.id)).toEqual([
    'kordon',
    'bocznica',
    'cele',
    'dowodztwo',
    'ewakuacja',
  ]);
  expect(level.encounters).toHaveLength(8);
  expect(level.checkpoints).toHaveLength(5);
  expect(level.objectiveOrder).toEqual([
    'cell-1',
    'cell-2',
    'cell-3',
    'executor',
    'exit',
  ]);
  expect(level.objectivePositions.exit!.x).toBeLessThan(level.playerSpawn.x);
  expect(level.allies).toEqual([
    {
      id: 'nadia',
      spawn: { x: 92, y: 0, z: 7 },
      joinAfter: { kind: 'objective', id: 'cell-2' },
    },
  ]);
  for (const encounter of level.encounters)
    for (const wave of levelWaves.get(encounter.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
  const palette = ['#ffae1a', '#6dff4a', '#fff1d6', '#3d7bff', '#8a5cff'];
  for (const light of level.lights ?? [])
    expect(palette).toContain(light.color);
});

it('posiłki wymagają otwarcia cel; dowódca nie pojawia się przed trzecią celą ani po jego pokonaniu', () => {
  const runtime = new LevelRuntime(level, [
    'patrol-kordon',
    'rampa',
    'straz-cel',
  ]);
  expect(runtime.step({ x: 110, y: 0, z: 0 }, {})).toEqual([]);
  expect(runtime.step({ x: 110, y: 0, z: 0 }, { 'cell-1': 'done' })).toEqual([
    'poscig-1',
  ]);
  expect(
    runtime.step({ x: 94, y: 0, z: 7 }, { 'cell-1': 'done', 'cell-2': 'done' }),
  ).toEqual(['poscig-2']);
  const done = { 'cell-1': 'done', 'cell-2': 'done', 'cell-3': 'done' };
  expect(runtime.step({ x: 61, y: 0, z: -7 }, done)).toEqual([
    'oslona-suwnicy',
    'egzekutor',
    'poscig-3',
  ]);
  expect(runtime.openGates(done)).not.toContain('gate-zachod');
  expect(runtime.openGates({ ...done, executor: 'done' })).toContain(
    'gate-zachod',
  );
  const resumed = new LevelRuntime(level);
  expect(
    resumed.step({ x: 48, y: 0, z: 0 }, { ...done, executor: 'done' }),
  ).not.toContain('egzekutor');
});

it('blokuje start bez M01 i przejście zamkniętej bramy; otwiera kolizję razem z widokiem', async () => {
  await expect(setup(createMemorySaveStore())).rejects.toThrow(
    'Misja jest zablokowana.',
  );
  const { scene, commands, three } = await setup();
  commands.execute('god');
  commands.execute('tp 173 0 90');
  for (let i = 0; i < 120; i++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
  expect(position(scene).x).toBeGreaterThan(170);
  expect(three.getObjectByName('gate:gate-kordon')?.visible).toBe(true);
  commands.execute('tp 190 0 90');
  steps(scene, 4);
  expect(state(scene).activeEncounters).toContain('patrol-kordon');
  commands.execute('encounter clear');
  steps(scene, 2);
  expect(three.getObjectByName('gate:gate-kordon')?.visible).toBe(false);
  walkTo(scene, commands, 166);
  expect(state(scene).checkpointId).toBe('bocznica');
}, 120_000);

it('przechodzi całą trasę kapsułą, otwiera cele obecnością, dołącza Nadię i pokonuje Egzekutora', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  expect(allies(scene)).toHaveLength(0);
  for (const x of [190, 166, 150, 126]) walkTo(scene, commands, x);
  for (const id of ['cell-1', 'cell-2', 'cell-3']) {
    const target = level.objectivePositions[id]!;
    walkTo(scene, commands, target.x);
    walkTo(scene, commands, target.x, target.z);
    steps(scene, 130);
    expect(state(scene).objectives[id]).toBe('done');
    if (id === 'cell-1') expect(allies(scene)).toHaveLength(0);
    else expect(allies(scene)).toHaveLength(1);
    if (id !== 'cell-3') {
      commands.execute('encounter clear');
      walkTo(scene, commands, target.x);
    }
    if (id === 'cell-2') {
      walkTo(scene, commands, 76);
      expect(state(scene).checkpointId).toBe('zbiorka');
    }
  }
  expect(state(scene).activeEncounters).toContain('egzekutor');
  expect(state(scene).openGates).not.toContain('gate-zachod');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  // kill all zabija faktycznie utworzone encje; cel kończy normalny WaveDirector.
  for (let i = 0; i < 10 && state(scene).objectives.executor !== 'done'; i++) {
    steps(scene, 120);
    commands.execute('kill all');
  }
  steps(scene, 120);
  expect(state(scene).objectives.executor).toBe('done');
  expect(allies(scene)[0]!.shots).toBeGreaterThan(0);
  expect(state(scene).completedEncounters).toContain('egzekutor');
  expect(state(scene).openGates).toContain('gate-zachod');
  walkTo(scene, commands, 61);
  walkTo(scene, commands, 26);
  expect(state(scene).checkpointId).toBe('ewakuacja');
  expect(allies(scene)).toHaveLength(1);
  walkTo(scene, commands, 8);
  steps(scene, 130);
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
  expect((await store.loadMeta())?.meta.campaign.completed).toContain(ID);
}, 300_000);

it('wznowienie po uwolnieniu Nadii odtwarza sojuszniczkę i odblokowane cele', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('objective done cell-1');
  commands.execute('objective done cell-2');
  commands.execute('checkpoint zbiorka');
  await vi.waitFor(() => expect(scene.query('savePending')).toBe(false));
  scene.dispose();
  active.splice(active.indexOf(scene), 1);
  const resumed = await setup(store, true);
  expect(state(resumed.scene).checkpointId).toBe('zbiorka');
  expect(state(resumed.scene).objectives['cell-2']).toBe('done');
  expect(allies(resumed.scene)).toHaveLength(1);
  expect(state(resumed.scene).openGates).toContain('gate-sluza');
  expect(state(resumed.scene).openGates).not.toContain('gate-zachod');
});
