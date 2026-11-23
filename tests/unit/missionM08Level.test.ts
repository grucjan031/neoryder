import { afterEach, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import data from '../../src/data/levels/m08-kwarantanna.json';
import { MissionScene } from '../../src/scenes/mission';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
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

const ID = 'm08-kwarantanna';
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
async function setup(unlocked = true) {
  const store = createMemorySaveStore();
  const meta = createStarterMetaState();
  if (unlocked) meta.campaign.completed = ['m07-nocny-dyzur'];
  await saveMetaManager(store, new MetaManager(meta));
  const commands = new CommandRegistry();
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate: vi.fn(),
    params: new URLSearchParams(`mission=${ID}&seed=m08-unit`),
  });
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m08-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    new Scene(),
  );
  return { scene, commands, store };
}
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    checkpointId: string;
    state: string;
    objectives: Record<string, string>;
    activeEncounters: string[];
    completedEncounters: string[];
    openGates: string[];
  };
const position = (scene: MissionScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };
function steps(scene: MissionScene, count: number) {
  for (let n = 0; n < count; n++) scene.step(SIM_DT, idle);
}
function walkTo(
  scene: MissionScene,
  commands: CommandRegistry,
  x: number,
  z = 0,
) {
  for (let n = 0; n < 4000; n++) {
    const at = position(scene);
    const dx = x - at.x,
      dz = z - at.z;
    if (Math.hypot(dx, dz) < 0.15) return;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
    if (state(scene).activeEncounters.length)
      commands.execute('encounter clear');
  }
  throw new Error(
    `Trasa zablokowana: ${JSON.stringify(position(scene))} -> ${x}, ${z}`,
  );
}

it('M08 wymaga M07, ma pięć sekcji, trzy grupy 3+3+4 i Szrona od startu', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.number).toBe(8);
  expect(mission.requires).toEqual(['m07-nocny-dyzur']);
  expect(level.sections.map((s) => s.id)).toEqual([
    'kordon',
    'skrzydlo-a',
    'skrzydlo-b',
    'dziedziniec',
    'winda',
  ]);
  expect(level.allies).toEqual([{ id: 'szron', spawn: { x: 4, y: 0, z: -2 } }]);
  expect(
    ['a', 'b', 'c'].map(
      (id) =>
        level.objectiveNpcs!.filter((npc) => npc.objective === `grupa-${id}`)
          .length,
    ),
  ).toEqual([3, 3, 4]);
  expect(level.objectiveOrder).toEqual(mission.objectives.map((o) => o.id));
  for (const entry of level.encounters)
    for (const wave of levelWaves.get(entry.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
  expect(mission.rewards.firstClear).toEqual({ data: 100, cores: 1 });
});

it('brak M07 blokuje misję; śluza wymaga pokonania osłony, exit wszystkich grup i obrony', async () => {
  await expect(setup(false)).rejects.toThrow('Misja jest zablokowana.');
  const { scene, commands } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done sluza-a')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done grupa-a')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done ewakuacja')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  commands.execute('tp 16 0 -90');
  steps(scene, 2);
  commands.execute('tp 37 0 -90');
  for (let n = 0; n < 90; n++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
  expect(position(scene).x).toBeLessThan(39);
  expect(state(scene).openGates).not.toContain('gate-kordon');
  commands.execute('encounter clear');
  steps(scene, 2);
  expect(state(scene).openGates).toContain('gate-kordon');
  walkTo(scene, commands, 48);
  expect(position(scene).x).toBeGreaterThan(39);
  expect(state(scene).checkpointId).toBe('skrzydlo-a');
}, 120_000);

it('fale obrony startują od progów, a nie wejścia w strefę windy', () => {
  const runtime = new LevelRuntime(level, [
    'kordon',
    'oslona-a',
    'oslona-b',
    'oslona-c',
  ]);
  expect(
    runtime.step(level.objectivePositions.ewakuacja!, { 'grupa-c': 'done' }),
  ).toEqual([]);
  const defense = mission.objectives.find((o) => o.id === 'ewakuacja')!;
  if (defense.kind !== 'defend') throw new Error('Brak obrony windy');
  expect(defense.durationS).toBe(25);
  defense.waves!.forEach((wave, index) =>
    expect(
      level.encounters.find((e) => e.reinforcementFor === `ewakuacja:${index}`)
        ?.wave,
    ).toBe(wave.wave),
  );
  expect(() =>
    loadLevel(
      {
        ...data,
        encounters: data.encounters.map((e) =>
          e.id === 'ewakuacja-1'
            ? { ...e, reinforcementFor: 'ewakuacja:9' }
            : e,
        ),
      },
      mission,
      levelWaves,
    ),
  ).toThrow();
});

it('limit grupy przywraca checkpoint i zachowuje otwartą śluzę', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  walkTo(scene, commands, 62);
  steps(scene, 130);
  expect(state(scene).objectives['sluza-a']).toBe('done');
  expect(state(scene).checkpointId).toBe('skrzydlo-a');
  // Gracz zostaje przy śluzie, zamiast doprowadzić grupę do x=82.
  steps(scene, 60 * 60);
  expect(state(scene).state).toBe('respawning');
  steps(scene, 2 * 60);
  expect(state(scene).state).toBe('playing');
  expect(position(scene).x).toBeCloseTo(43, 0);
  expect(state(scene).objectives['sluza-a']).toBe('done');
  expect(state(scene).objectives['grupa-a']).not.toBe('done');
  expect(state(scene).openGates).toContain('gate-sluza-a');
  walkTo(scene, commands, 82);
  expect(state(scene).objectives['grupa-a']).toBe('done');
}, 120_000);

it('kapsuła przechodzi całą trasę bez teleportów: śluzy, grupy, obrona z pauzą i powrót', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('god');
  const reinforced = new Set<string>();
  for (const id of level.objectiveOrder) {
    const target = level.objectivePositions[id]!;
    walkTo(scene, commands, target.x, target.z);
    if (id === 'ewakuacja') {
      steps(scene, 4 * 60);
      walkTo(scene, commands, 230);
      steps(scene, 30 * 60);
      expect(state(scene).objectives.ewakuacja).not.toBe('done');
      expect(state(scene).openGates).not.toContain('gate-winda');
      walkTo(scene, commands, 222);
    }
    for (
      let n = 0;
      n < 35 / SIM_DT && state(scene).objectives[id] !== 'done';
      n++
    ) {
      scene.step(SIM_DT, idle);
      for (const fight of state(scene).activeEncounters) reinforced.add(fight);
      if (state(scene).activeEncounters.length)
        commands.execute('encounter clear');
    }
    expect(state(scene).objectives[id], id).toBe('done');
  }
  expect([...reinforced]).toEqual(
    expect.arrayContaining(['ewakuacja-1', 'ewakuacja-2']),
  );
  expect(state(scene).completedEncounters).toHaveLength(6);
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
  expect(await store.loadMission!()).toBeNull();
}, 300_000);
