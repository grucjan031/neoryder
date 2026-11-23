import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MissionObjectives } from '../../src/world/missionObjectives';
import { missionSchema } from '../../src/world/missionSchema';
import { Scene as ThreeScene } from 'three';
import { MissionScene } from '../../src/scenes/mission';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { InputSnapshot } from '../../src/core/input';
import { missionDefinitions } from '../../src/world/missions';
import { loadLevel } from '../../src/world/levelSchema';
import { MetaManager } from '../../src/progression/meta';
import {
  saveMetaManager,
  loadMetaManagerStrict,
} from '../../src/progression/metaSave';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import data from '../../src/data/levels/m09-brat.json';
import { levelSchema } from '../../src/world/levelSchema';
import { roomSchema } from '../../src/world/roomSchema';
import { LevelRuntime } from '../../src/world/levelRuntime';
import { levelWaves } from '../../src/world/levels';

const ID = 'm09-brat';
const mission = missionDefinitions.get(ID)!;

it('M09: wszystkie kwestie odprawy i radia są zachowane, debrief jest wyborem ze scenariusza', () => {
  const source = readFileSync(
    new URL('../../docs/fabula/misje/misja-09-brat.md', import.meta.url),
    'utf8',
  );
  const parts = source
    .split('## Dialogi')[1]!
    .split('## Nagrody')[0]!
    .split('### ')
    .slice(1);
  const lines = (part: string) =>
    part.split(/\r?\n/).flatMap((line) => {
      const match = line.match(
        /^\*\*(Mira|Szron|Bajt|Wolan|Tymon|Ida)(?:[^:]*):\*\* (.+)$/u,
      );
      return match ? [match[2]!] : [];
    });
  const expected = [...lines(parts[0]!), ...lines(parts[1]!)];
  const actual = [
    ...mission.briefing,
    ...mission.radio.flatMap((e) => e.lines),
  ].map((l) => l.text);
  for (const text of expected)
    expect(actual.filter((line) => line === text)).toHaveLength(1);
  for (const line of mission.debrief)
    expect(lines(parts[2]!)).toContain(line.text);
});

it('M09: schemat odrzuca błędny próg, brak opaski oraz brak spotkania pojmania', () => {
  for (const hpFraction of [0, 1, -1])
    expect(
      missionSchema.safeParse({
        ...mission,
        objectives: mission.objectives.map((o) =>
          o.kind === 'subdue' ? { ...o, hpFraction } : o,
        ),
      }).success,
    ).toBe(false);
  expect(
    missionSchema.safeParse({ ...mission, level: undefined }).success,
  ).toBe(false);
  expect(
    missionSchema.safeParse({
      ...mission,
      objectives: mission.objectives.map((o) =>
        o.kind === 'subdue' ? { ...o, neutralizeWith: 'brama' } : o,
      ),
    }).success,
  ).toBe(false);
  expect(() =>
    loadLevel(
      {
        ...data,
        encounters: data.encounters.map((e) => ({ ...e, bossFor: undefined })),
      },
      mission,
      levelWaves,
    ),
  ).toThrow('bossFor');
});

it('M09: zegar pojmania ma pierwszeństwo przed opaską, pauza go nie zużywa', () => {
  const model = new MissionObjectives(
    mission,
    ['tymon', 'opaska', 'brama', 'exit'],
    {},
    { signal() {}, explode() {} },
    2,
    2,
    ['tymon', 'opaska', 'brama', 'exit'],
  );
  expect(model.done('opaska')).toBe(false);
  model.done('tymon');
  model.step(0, { x: 166, y: 0, z: 0 });
  expect(model.remainingS.tymon).toBeUndefined();
  model.step(10, { x: 166, y: 0, z: 0 });
  expect(model.failed).toBe('tymon');
  expect(model.objectives.opaska).not.toBe('done');
  expect(model.done('opaska')).toBe(false);
});
const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: MissionScene[] = [];
afterEach(() => active.splice(0).forEach((scene) => scene.dispose()));
async function setup(store = createMemorySaveStore(), resume = false) {
  if (!resume) {
    const meta = createStarterMetaState();
    meta.campaign.completed = [...mission.requires];
    await saveMetaManager(store, new MetaManager(meta));
  }
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const navigate = vi.fn();
  const scene = new MissionScene({
    store,
    navigate,
    loadModels: false,
    params: new URLSearchParams(
      `mission=${ID}&seed=m09-unit${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('m09-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    new ThreeScene(),
  );
  commands.execute('god');
  return { scene, commands, bus, store, navigate };
}
const state = (scene: MissionScene) =>
  scene.query('mission') as {
    objectives: Record<string, string>;
    activeEncounters: string[];
    openGates: string[];
    checkpointId: string;
  };
const captive = (scene: MissionScene) =>
  scene.query('subdue') as {
    id: number;
    hp: number;
    maxHp: number;
    subdued: boolean;
    captured: boolean;
    position: { x: number; y: number; z: number };
  } | null;
const position = (scene: MissionScene) =>
  scene.query('playerPos') as { x: number; y: number; z: number };
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
    const at = position(scene),
      dx = x - at.x,
      dz = z - at.z;
    if (Math.hypot(dx, dz) <= 0.15) return;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, { ...idle, held: new Set(['moveForward']) });
    if (state(scene).activeEncounters.some((id) => id !== 'tymon'))
      commands.execute('encounter clear');
  }
  throw new Error(
    `Zablokowana kapsuła: ${JSON.stringify(position(scene))} -> ${x},${z}`,
  );
}
async function atBoss() {
  const result = await setup();
  const { scene, commands } = result;
  for (const x of [16, 58, 104]) {
    commands.execute(`tp ${x} 0`);
    steps(scene, 2);
    commands.execute('encounter clear');
  }
  commands.execute('tp 136 0');
  steps(scene, 2);
  commands.execute('tp 148 0');
  steps(scene, 75);
  expect(captive(scene)).not.toBeNull();
  return result;
}
function subdue(scene: MissionScene, commands: CommandRegistry) {
  for (let i = 0; i < 3; i++) {
    commands.execute('kill all');
    steps(scene, 75);
  }
  expect(captive(scene)?.hp).toBeCloseTo(captive(scene)!.maxHp * 0.15);
  expect(state(scene).objectives.tymon).toBe('done');
}

it('M09: loadLevel, wymaganie kampanii i spójne dane pojmania', () => {
  expect(loadLevel(data, mission, levelWaves).id).toBe(ID);
  expect(mission.number).toBe(9);
  // Tymczasowy poprzednik: M08 powstaje w osobnym worktree (walidator wymaga pliku).
  expect(mission.requires).toEqual(['m07-nocny-dyzur']);
  expect(mission.briefing).toHaveLength(3);
  expect(mission.debrief).toHaveLength(6);
  expect(mission.objectives.map((o) => o.kind)).toEqual([
    'subdue',
    'interact',
    'defend',
    'exit',
  ]);
  for (const encounter of data.encounters)
    for (const wave of levelWaves.get(encounter.wave)!.waves)
      for (const group of wave.groups)
        expect(mission.enemies).toContain(group.enemy);
});

it('M09: kapsuła przechodzi trasę, pojmanie otwiera rampę, 60 s obrony i powrót', async () => {
  const { scene, commands, store } = await setup();
  expect(scene.query('allies')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'nadia' })]),
  );
  expect(commands.execute('objective done tymon')).toBe('Cel niedostępny.');
  expect(commands.execute('objective done exit')).toBe('Cel niedostępny.');
  for (const x of [40, 52, 90, 100, 136, 148]) walkTo(scene, commands, x);
  steps(scene, 75);
  expect(state(scene).openGates).not.toContain('gate-arena');
  subdue(scene, commands);
  const down = captive(scene)!;
  commands.execute('kill all');
  steps(scene, 1);
  expect(captive(scene)!.hp).toBe(down.hp);
  walkTo(scene, commands, down.position.x - 1.5, down.position.z);
  steps(scene, 100);
  expect(state(scene).objectives.opaska).toBe('done');
  expect(state(scene).openGates).toContain('gate-rampa');
  walkTo(scene, commands, down.position.x - 1.5, 3);
  walkTo(scene, commands, 186, 3);
  walkTo(scene, commands, 190);
  walkTo(scene, commands, 216);
  // Fizyczna obecność; fale kończymy debugiem, czas obrony płynie normalnie.
  for (let i = 0; i < 61 / SIM_DT; i++) {
    scene.step(SIM_DT, idle);
    commands.execute('encounter clear');
  }
  expect(state(scene).objectives.brama).toBe('done');
  expect(state(scene).openGates).toContain('gate-transport');
  walkTo(scene, commands, 238);
  steps(scene, 130);
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
  expect(
    (await loadMetaManagerStrict(store)).state.campaign.completed,
  ).toContain(ID);
  expect(await store.loadMission!()).toBeNull();
}, 300_000);

it('M09: przekroczenie okna opaski kończy próbę bez nagrody', async () => {
  const { scene, commands, navigate, store } = await atBoss();
  subdue(scene, commands);
  steps(scene, 610);
  expect(scene.query('screen')).toBe('failed');
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('?scene=hub'));
  expect(
    (await loadMetaManagerStrict(store)).state.campaign.completed,
  ).not.toContain(ID);
  expect(await store.loadMission!()).toBeNull();
}, 120_000);

it('M09: śmierć celu jest porażką, a nie zwycięstwem spotkania', async () => {
  const { scene, bus, navigate } = await atBoss();
  bus.emit('enemy_killed', {
    id: captive(scene)!.id,
    killer: null,
    tags: ['#debug'],
  });
  steps(scene, 1);
  expect(scene.query('screen')).toBe('failed');
  expect(state(scene).objectives.tymon).not.toBe('done');
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('?scene=hub'));
}, 120_000);

it('M09: śmierć gracza resetuje niedokończone pojmanie; po opasce zapis zachowuje cel', async () => {
  const { scene, commands, store } = await atBoss();
  subdue(scene, commands);
  commands.execute('god');
  commands.execute('hurt 9999');
  steps(scene, 100);
  expect(state(scene).objectives.tymon).toBe('pending');
  expect(captive(scene)).toBeNull();
  expect(state(scene).checkpointId).toBe('przed-tymonem');
  commands.execute('god');
  commands.execute('tp 148 0');
  steps(scene, 75);
  subdue(scene, commands);
  const at = captive(scene)!.position;
  commands.execute(`tp ${at.x - 1.5} ${at.z}`);
  steps(scene, 100);
  expect(state(scene).objectives.opaska).toBe('done');
  commands.execute('tp 198 0');
  steps(scene, 2);
  await vi.waitFor(() => expect(scene.query('savePending')).toBe(false));
  scene.dispose();
  const resumed = await setup(store, true);
  expect(state(resumed.scene).objectives).toMatchObject({
    tymon: 'done',
    opaska: 'done',
  });
  expect(state(resumed.scene).checkpointId).toBe('rampa');
  resumed.commands.execute('tp 148 0');
  steps(resumed.scene, 75);
  expect(captive(resumed.scene)).toBeNull();
}, 120_000);

it('M09: wczytanie po przełamaniu bez opaski odtwarza pojedynek, nie pomija celu', async () => {
  const { scene, commands, store } = await atBoss();
  subdue(scene, commands);
  await vi.waitFor(() => expect(scene.query('savePending')).toBe(false));
  scene.dispose();
  const resumed = await setup(store, true);
  expect(state(resumed.scene).checkpointId).toBe('przed-tymonem');
  expect(state(resumed.scene).objectives.tymon).toBe('pending');
  expect(resumed.commands.execute('objective done opaska')).toBe(
    'Cel niedostępny.',
  );
  resumed.commands.execute('tp 148 0');
  steps(resumed.scene, 75);
  expect(captive(resumed.scene)?.hp).toBe(captive(resumed.scene)?.maxHp);
}, 120_000);

it('M09: pięć sekcji Bulwaru, Nadia od startu i istniejące fale', () => {
  const level = levelSchema.parse(data);
  expect(level.sections.map((section) => section.id)).toEqual([
    'kladki',
    'kontrola',
    'pokaz',
    'pojedynek',
    'rampa',
  ]);
  expect(level.allies).toEqual([{ id: 'nadia', spawn: { x: 4, y: 0, z: -2 } }]);
  for (const encounter of level.encounters)
    expect(levelWaves.has(encounter.wave)).toBe(true);
  expect(() =>
    roomSchema.parse({
      ...level,
      doors: ['entry', 'exit'].map((role) => ({
        id: role,
        role,
        position: level.playerSpawn,
        size: { x: 1, y: 1, z: 1 },
      })),
      spawnPoints: [
        ...level.spawnPoints,
        ...Object.values(level.objectivePositions),
        ...level.checkpoints.map((point) => point.position),
        ...level.allies!.map((ally) => ally.spawn),
      ],
    }),
  ).not.toThrow();
});

it('M09: bramy wymagają osłony, opaski i obrony; posiłki czekają na progi', () => {
  const runtime = new LevelRuntime(levelSchema.parse(data));
  expect(runtime.openGates({})).toEqual([]);
  for (const [id, x] of [
    ['kordon', 16],
    ['kontrola', 58],
    ['oslona', 104],
  ] as const) {
    expect(runtime.step({ x, y: 0, z: 0 }, {})).toEqual([id]);
    runtime.clear(id);
  }
  expect(runtime.openGates({})).toEqual([
    'gate-kladki',
    'gate-kontrola',
    'gate-arena',
  ]);
  expect(runtime.step({ x: 148, y: 0, z: 0 }, {})).toEqual(['tymon']);
  expect(runtime.openGates({})).not.toContain('gate-arena');
  runtime.clear('tymon');
  expect(runtime.openGates({ opaska: 'done' })).toContain('gate-rampa');
  expect(runtime.openGates({ opaska: 'done' })).not.toContain('gate-transport');
  expect(runtime.openGates({ opaska: 'done', brama: 'done' })).toContain(
    'gate-transport',
  );
  expect(runtime.step({ x: 216, y: 0, z: 0 }, { opaska: 'done' })).toEqual([]);
});
