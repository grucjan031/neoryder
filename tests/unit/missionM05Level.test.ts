import { afterEach, expect, it, vi } from 'vitest';
import { Scene as ThreeScene } from 'three';
import data from '../../src/data/levels/m05-adiutant.json';
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
import { missionDefinitions } from '../../src/world/missions';
import { MetaManager } from '../../src/progression/meta';
import { saveMetaManager } from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const ID = 'm05-adiutant';
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
async function setup(
  unlocked = true,
  store = createMemorySaveStore(),
  resume = false,
) {
  const commands = new CommandRegistry();
  if (unlocked && !resume) {
    const meta = createStarterMetaState();
    meta.campaign.completed = [
      'm01-maszty',
      'm02-punkt-kontrolny',
      'm03-list-przewozowy',
      'm04-ladunek-klasy-k',
    ];
    await saveMetaManager(store, new MetaManager(meta));
  }
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate: vi.fn(),
    params: new URLSearchParams(
      `mission=${ID}&seed=m05-unit${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      commands,
      rng: new Rng('m05-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    new ThreeScene(),
  );
  return { scene, commands, store };
}
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    state: string;
    checkpointId: string;
    objectives: Record<string, string>;
    activeEncounters: string[];
    completedEncounters: string[];
    openGates: string[];
    chaseRemainingS: Record<string, number>;
    failedObjective: string | null;
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
  z = 0,
) {
  for (let index = 0; index < 1800; index++) {
    const at = position(scene);
    if (Math.hypot(x - at.x, z - at.z) < 0.15) return;
    commands.execute(
      `look ${(Math.atan2(at.x - x, at.z - z) * 180) / Math.PI}`,
    );
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
    if (state(scene).activeEncounters.length)
      commands.execute('encounter clear');
  }
  throw new Error(
    `Trasa (${x}, ${z}) zablokowana: ${JSON.stringify(position(scene))}`,
  );
}

it('waliduje pięć sekcji, trzy odcinki czasu, eskortę, samotny pościg i ciągłość kampanii', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(level.sections.map((s) => s.id)).toEqual([
    'dachy',
    'estakada',
    'maszynownia',
    'suwnice',
    'ladowisko',
  ]);
  expect(
    mission.objectives
      .filter((o) => o.kind === 'reach')
      .map((o) => o.timeLimitS),
  ).toEqual([95, 110, 90]);
  expect(level.allies).toEqual([]);
  expect(level.objectiveNpcs?.[0]?.objective).toBe('karta');
  expect(mission.requires).toEqual(['m04-ladunek-klasy-k']);
  expect(missionDefinitions.get('m06-odlewnia')!.requires).toEqual([ID]);
  expect(mission.briefing.length).toBeLessThanOrEqual(3);
  expect(mission.debrief.length).toBeLessThanOrEqual(6);
  expect(mission.interlude).toBeUndefined();
  for (const entry of level.encounters)
    for (const wave of levelWaves.get(entry.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
  const palette = ['#ffae1a', '#6dff4a', '#fff1d6', '#3d7bff', '#8a5cff'];
  for (const light of level.lights ?? [])
    expect(palette).toContain(light.color);
  expect(() =>
    loadLevel(
      {
        ...data,
        objectiveAfter: { karta: { kind: 'encounter', id: 'missing' } },
      },
      mission,
      levelWaves,
    ),
  ).toThrow();
});

it('odrzuca start bez M04 i nie pozwala przejąć karty przed pokonaniem osłony', async () => {
  await expect(setup(false)).rejects.toThrow('Misja jest zablokowana.');
  const { scene, commands } = await setup();
  commands.execute('god');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  for (const id of ['estakada', 'suwnice', 'ladowisko'])
    commands.execute(`objective done ${id}`);
  commands.execute('tp 206 0');
  steps(scene, 2);
  commands.execute('tp 240 0');
  steps(scene, 20);
  commands.execute('encounter clear');
  steps(scene, 2);
  expect(state(scene).activeEncounters).toContain('oslona-ladowiska');
  expect(state(scene).objectives.karta).not.toBe('done');
  expect(commands.execute('objective done karta')).toBe('Cel niedostępny.');
  expect(scene.query('allies')).toEqual([]);
}, 120_000);

it('przekroczenie limitu wraca do checkpointu, resetuje czas i zachowuje zakończone cele po wznowieniu', async () => {
  const { scene, commands, store } = await setup();
  commands.execute('god');
  commands.execute('objective done estakada');
  commands.execute('checkpoint maszynownia');
  steps(scene, 110 * 60);
  expect(state(scene).state).toBe('respawning');
  expect(state(scene).failedObjective).toBe('suwnice');
  expect(state(scene).objectives.estakada).toBe('done');
  steps(scene, 80);
  expect(state(scene).state).toBe('playing');
  expect(position(scene).x).toBeCloseTo(92, 1);
  expect(state(scene).chaseRemainingS.suwnice).toBeGreaterThan(109);
  await vi.waitFor(() => expect(scene.query('savePending')).toBe(false));
  scene.dispose();
  const resumed = await setup(true, store, true);
  steps(resumed.scene, 1);
  expect(state(resumed.scene).objectives.estakada).toBe('done');
  expect(state(resumed.scene).checkpointId).toBe('maszynownia');
  expect(state(resumed.scene).chaseRemainingS.suwnice).toBeCloseTo(
    110 - SIM_DT,
  );
}, 120_000);

it('kapsuła przechodzi całą dolną trasę z bramami, rzeczywistymi celami i powrotem', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  for (const x of [36, 50, 74, 92, 100, 118, 134, 154, 180, 190, 206])
    walkTo(scene, commands, x);
  expect(state(scene).objectives.ladowisko).toBe('done');
  walkTo(scene, commands, 218);
  // Drugie spotkanie lądowiska wymaga kolejnego kroku po snajperach.
  steps(scene, 2);
  commands.execute('encounter clear');
  walkTo(scene, commands, 240);
  expect(state(scene).objectives.karta).toBe('done');
  expect(state(scene).openGates).toContain('gate-ewakuacja');
  walkTo(scene, commands, 240, -7);
  walkTo(scene, commands, 248, -7);
  steps(scene, 125);
  expect(state(scene).objectives.exit).toBe('done');
  expect(state(scene).completedEncounters).toEqual(
    expect.arrayContaining([
      'tylna-straz',
      'tarcze-suwnic',
      'snajperzy',
      'oslona-ladowiska',
    ]),
  );
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
}, 300_000);

it('zamknięta gródź blokuje marsz, ale ślizg przechodzi pod boczną roletą bez zabijania eskorty', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  commands.execute('tp 67 0 -90');
  for (let i = 0; i < 90; i++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
  expect(position(scene).x).toBeLessThan(70);
  expect(state(scene).openGates).not.toContain('grodz-estakada');
  commands.execute('tp 60 -6.5 -90');
  for (let i = 0; i < 36; i++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward', 'sprint']) });
  scene.step(SIM_DT, {
    ...idle,
    held: new Set(['moveForward', 'sprint', 'crouch']),
    pressed: new Set(['crouch']),
  });
  for (let i = 0; i < 60; i++)
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward', 'crouch']) });
  expect(position(scene).x).toBeGreaterThan(71);
  expect(state(scene).completedEncounters).not.toContain('tylna-straz');
}, 120_000);

it('górna trasa suwnic pozwala przeskoczyć lukę podwójnym skokiem i dashem', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  commands.execute('objective done estakada');
  commands.execute('tp 130 -5.5 -90 0 3.2');
  steps(scene, 5);
  const forward: InputSnapshot['held'] = new Set([
    'moveForward',
    'sprint',
    'jump',
  ]);
  scene.step(SIM_DT, { ...idle, held: forward, pressed: new Set(['jump']) });
  for (let i = 0; i < 14; i++) scene.step(SIM_DT, { ...idle, held: forward });
  scene.step(SIM_DT, {
    ...idle,
    held: forward,
    pressed: new Set(['jump', 'dash']),
  });
  for (let i = 0; i < 24; i++) scene.step(SIM_DT, { ...idle, held: forward });
  // Hamowanie na środkowej belce; nie teleportujemy przez lukę.
  for (let i = 0; i < 80; i++) scene.step(SIM_DT, idle);
  expect(position(scene).x).toBeGreaterThan(141);
  expect(position(scene).x).toBeLessThan(151);
  expect(position(scene).y).toBeGreaterThan(3.2);
  expect(state(scene).openGates).not.toContain('grodz-suwnice');
}, 120_000);
