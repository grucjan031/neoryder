import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m10-archiwum.json';
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
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionObjectiveSchema } from '../../src/world/missionSchema';

const ID = 'm10-archiwum';
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
  meta.campaign.completed = [...mission.requires];
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
    params: new URLSearchParams(`mission=${ID}&seed=m10-unit`),
  });
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m10-unit'),
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

it('M10: walidacja, infiltracja solo, zależność tymczasowa M07 i komplet fal', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.number).toBe(10);
  expect(mission.requires).toEqual(['m09-brat']);
  expect(level.sections.map((section) => section.id)).toEqual([
    'winda',
    'pasaz',
    'wieza',
    'archiwum',
    'szyb',
  ]);
  expect(level.allies).toEqual([]);
  expect(level.objectiveOrder).toEqual(['sluza', 'transfer', 'rdzen', 'exit']);
  expect(mission.briefing).toHaveLength(3);
  expect(mission.debrief).toHaveLength(6);
  expect(
    mission.radio
      .find((entry) => entry.trigger === 'objective:transfer:progress:50')
      ?.lines.some((line) => line.text.includes('doktor Helena Wolan')),
  ).toBe(true);
  for (const entry of level.encounters) {
    for (const wave of levelWaves.get(entry.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
  }
  const transfer = mission.objectives.find((entry) => entry.kind === 'defend')!;
  if (transfer.kind !== 'defend') throw new Error('Brak transferu');
  transfer.waves!.forEach((wave, index) => {
    expect(
      level.encounters.find(
        (entry) => entry.reinforcementFor === `transfer:${index}`,
      )?.wave,
    ).toBe(wave.wave);
  });
});

it('cichy pas omija alarm, środek pasażu go wyzwala; fale transferu czekają na próg', () => {
  const runtime = new LevelRuntime(level);
  for (let x = 30; x < 96; x++)
    expect(runtime.step({ x, y: 0, z: -8 }, {})).toEqual([]);
  expect(runtime.step({ x: 60, y: 0, z: 0 }, {})).toEqual(['alarm-pasaz']);
  expect(runtime.step(level.objectivePositions.transfer!, {})).toEqual([]);
  expect(runtime.openGates({ sluza: 'done' })).toEqual(['gate-archiwum']);
});

it('przerwanie transferu cofa do 0 lub 50%, zachowuje nośnik; stare misje tylko pauzują', () => {
  const definition = mission.objectives.find(
    (entry) => entry.kind === 'defend',
  )!;
  const signals: string[] = [];
  const reinforce = vi.fn();
  const model = new MissionObjectives(
    { objectives: [definition] },
    ['transfer'],
    {},
    {
      signal: (trigger) => signals.push(trigger),
      explode() {},
      reinforce,
    },
    2,
    2,
  );
  const inside = level.objectivePositions.transfer!;
  const outside = { ...inside, z: 20 };
  model.step(11, inside);
  expect(model.progress.transfer).toBeCloseTo(0.3);
  model.step(SIM_DT, outside);
  expect(model.progress.transfer).toBe(0);
  expect(model.progress['transfer:connection']).toBe(1);
  model.step(21, inside);
  expect(model.progress.transfer).toBeCloseTo(0.7);
  model.step(SIM_DT, outside);
  expect(model.progress.transfer).toBe(0.5);
  model.step(15, inside);
  expect(model.objectives.transfer).toBe('done');
  expect(signals).toContain('objective:transfer:progress:50');
  expect(reinforce).toHaveBeenCalledWith('m10Commander', 'transfer:1');
  const old = { ...definition, checkpoints: undefined };
  const legacy = new MissionObjectives(
    { objectives: [old] },
    ['transfer'],
    {},
    { signal() {}, explode() {} },
    2,
    2,
  );
  legacy.step(11, inside);
  legacy.step(1, outside);
  expect(legacy.progress.transfer).toBeCloseTo(0.3);
  for (const checkpoints of [[0], [1], [0.5, 0.5], [0.8, 0.5]])
    expect(
      missionObjectiveSchema.safeParse({ ...definition, checkpoints }).success,
    ).toBe(false);
});

it('blokuje misję bez wymagania i nie pozwala zniszczyć rdzenia przed transferem', async () => {
  await expect(setup(createMemorySaveStore())).rejects.toThrow(
    'Misja jest zablokowana.',
  );
  const { scene, commands } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done rdzen')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done sluza')).toBe('Cel niedostępny.');
  // Fizycznie zamknięta śluza na galerii.
  commands.execute('checkpoint wieza');
  walkTo(scene, commands, 153, 0);
  commands.execute('look -90');
  for (let i = 0; i < 90; i++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
  expect(position(scene).x).toBeLessThan(156);
}, 120_000);

it('przechodzi kapsułą cichy pas, rampę, śluzę, transfer, sabotaż i zejście szybem', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  for (const [x, z] of [
    [26, 0],
    [30, -8],
    [90, -8],
    [94, 0],
    [114, 0],
    [150, 0],
  ])
    walkTo(scene, commands, x!, z!);
  expect(position(scene).y).toBeGreaterThan(4.9);
  expect(state(scene).completedEncounters).not.toContain('alarm-pasaz');
  steps(scene, 150);
  expect(state(scene).objectives.sluza).toBe('done');
  expect(state(scene).openGates).toContain('gate-archiwum');
  walkTo(scene, commands, 178, 1);
  for (let i = 0; i < 34 / SIM_DT; i++) {
    scene.step(SIM_DT, idle);
    if (state(scene).activeEncounters.length)
      commands.execute('encounter clear');
  }
  expect(state(scene).objectives.transfer).toBe('done');
  expect(state(scene).completedEncounters).toEqual(
    expect.arrayContaining(['transfer-1', 'transfer-2']),
  );
  expect(state(scene).openGates).not.toContain('gate-szyb');
  walkTo(scene, commands, 188, 1);
  steps(scene, 9 / SIM_DT);
  expect(state(scene).objectives.rdzen).toBe('done');
  expect(state(scene).openGates).toContain('gate-szyb');
  expect(state(scene).activeEncounters).toContain('poscig');
  for (const x of [202, 220, 232, 244]) walkTo(scene, commands, x, 0);
  expect(position(scene).y).toBeLessThan(1.1);
  steps(scene, 200);
  expect(state(scene).objectives.exit).toBe('done');
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
}, 300_000);
