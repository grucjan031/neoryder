import { afterEach, expect, it, vi } from 'vitest';
import {
  Box3,
  Euler,
  Matrix4,
  Quaternion,
  Ray,
  Scene as ThreeScene,
  Vector3,
} from 'three';
import data from '../../src/data/levels/m06-odlewnia.json';
import { EventBus } from '../../src/core/events';
import type { InputSnapshot } from '../../src/core/input';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore, type SaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import { MetaManager } from '../../src/progression/meta';
import {
  loadMetaManagerStrict,
  saveMetaManager,
} from '../../src/progression/metaSave';
import { MissionScene } from '../../src/scenes/mission';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { setDifficultyOverride } from '../../src/world/difficulty';
import { LevelRuntime } from '../../src/world/levelRuntime';
import { levelDefinitions, levelWaves } from '../../src/world/levels';
import { levelSchema, loadLevel } from '../../src/world/levelSchema';
import { missionDefinitions } from '../../src/world/missions';

const ID = 'm06-odlewnia';
const level = levelDefinitions.get(ID)!;
const mission = missionDefinitions.get(ID)!;
const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const active: MissionScene[] = [];
afterEach(() => {
  active.splice(0).forEach((scene) => scene.dispose());
  setDifficultyOverride(null);
});

async function unlockedStore(): Promise<SaveStore> {
  const store = createMemorySaveStore();
  const state = (await loadMetaManagerStrict(store)).serialize();
  state.campaign.completed.push(...mission.requires);
  await saveMetaManager(store, MetaManager.restore(state));
  return store;
}
async function setup(store?: SaveStore, resume = false) {
  store ??= await unlockedStore();
  const commands = new CommandRegistry();
  const bus = new EventBus();
  const three = new ThreeScene();
  const scene = new MissionScene({
    store,
    loadModels: false,
    navigate: vi.fn(),
    params: new URLSearchParams(
      `mission=${ID}&seed=m06-unit${resume ? '&continue=1' : ''}`,
    ),
  });
  active.push(scene);
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('m06-unit'),
      tuning: structuredClone(tuning),
      debug: true,
      loop: new GameLoop({ step() {}, render() {} }),
    },
    three,
  );
  return { scene, commands, bus, store, three };
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
function steps(scene: MissionScene, count: number) {
  for (let index = 0; index < count; index++) scene.step(SIM_DT, idle);
}
function walkTo(
  scene: MissionScene,
  commands: CommandRegistry,
  x: number,
  z: number,
  clear = true,
) {
  const walk: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  for (let index = 0; index < 4000; index++) {
    const position = scene.query('playerPos') as {
      x: number;
      y: number;
      z: number;
    };
    const dx = x - position.x;
    const dz = z - position.z;
    if (Math.hypot(dx, dz) <= 0.12) return position;
    commands.execute(`look ${(Math.atan2(-dx, -dz) * 180) / Math.PI}`);
    scene.step(SIM_DT, walk);
    if (clear && state(scene).activeEncounters.length)
      commands.execute('encounter clear');
  }
  throw new Error(
    `Nie można dojść do (${x}, ${z}): ${JSON.stringify(scene.query('playerPos'))}`,
  );
}
/** Trzy progi faz: każde `kill all` zdejmuje bossa do progu, ostatnie go zabija. */
function killBoss(scene: MissionScene, commands: CommandRegistry) {
  for (let phase = 1; phase <= 3; phase++) {
    commands.execute('kill all');
    steps(scene, 75);
  }
}
/** Debugowe przejście pięciu starć poprzedzających arenę, w kolejności zależności. */
function clearToArena(scene: MissionScene, commands: CommandRegistry) {
  for (const entry of level.encounters.filter((item) => !item.bossFor)) {
    commands.execute(`tp ${entry.zone.position.x} ${entry.zone.position.z}`);
    steps(scene, 4);
    expect(state(scene).activeEncounters).toEqual([entry.id]);
    commands.execute('encounter clear');
  }
  commands.execute('tp 167 0 -90');
  steps(scene, 2);
  expect(state(scene).checkpointId).toBe('przed-arena');
}
const bossSpawnSteps =
  Math.ceil(levelWaves.get('m06Brandt')!.firstBreakS / SIM_DT) + 5;

// Zakosy między osłonami; ostatni punkt każdej listy leży przed celem.
const approaches: Record<string, [number, number][]> = {
  brandt: [
    [31, 0.75],
    [40, -1],
    [48, -1],
    [48.2, 1.6],
    [65.3, 1.6],
    [65.3, -0.8],
    [73.5, -0.8],
    [73.5, 2],
    [80.5, 2],
    [80.5, 0],
    [86.5, -0.8],
    [95.5, -0.8],
    [95.5, 2],
    [107.5, 2],
    [107.5, -2],
    [119.5, -2],
    [119.5, 2.5],
    [128.5, 2.5],
    [128.5, -0.5],
    [140, -1],
    [151, -1],
    [151, 0.4],
    [176, 0.4],
    [192, 0],
  ],
  server: [
    [214, 0],
    [223, -5.5],
  ],
  exit: [
    [216, -5.5],
    [216, -11.5],
  ],
};

it('ładuje Odlewnię: pięć sekcji, sześć spotkań, arena bossa i kolejność celów', () => {
  expect(loadLevel(data, mission, levelWaves)).toEqual(level);
  expect(mission.level).toBe(ID);
  expect(level.sections.map((section) => section.id)).toEqual([
    'sluza',
    'piece',
    'formowanie',
    'przedpokoj',
    'centrum',
  ]);
  expect(level.sections.map((section) => section.radio)).toEqual([
    undefined,
    undefined,
    'enterNode:3',
    'enterNode:6',
    'enterNode:7',
  ]);
  expect(level.encounters).toHaveLength(6);
  expect(level.objectiveOrder).toEqual(['brandt', 'server', 'exit']);
  expect(level.encounters.find((entry) => entry.bossFor)).toMatchObject({
    id: 'brandt',
    wave: 'm06Brandt',
    bossFor: 'brandt',
  });
  expect(levelWaves.get('m06Brandt')!.waves).toEqual([
    { spawnIntervalS: 0.5, groups: [{ enemy: 'securityChief', count: 1 }] },
  ]);
  expect(level.gates.find((gate) => gate.closedDuring)).toMatchObject({
    id: 'gate-sztab',
    closedDuring: 'brandt',
  });
  // Wezwania bossa wchodzą wyłącznie bocznymi śluzami areny.
  expect(level.spawnPoints).toHaveLength(4);
  for (const point of level.spawnPoints) {
    expect(point.x).toBeGreaterThan(172);
    expect(point.x).toBeLessThan(212);
    expect(Math.abs(point.z)).toBe(12);
  }
  // Paleta ADR 0006: bursztyn, zieleń, fiolet, błękit i ciepła biel.
  const palette = ['#ffae1a', '#6dff4a', '#8a5cff', '#3d7bff', '#fff1d6'];
  for (const entry of [...(level.lights ?? []), ...(level.signs ?? [])])
    expect(palette).toContain('color' in entry ? entry.color : entry.tint);
});

it('schemat pilnuje celu bossa i spotkania zamykającego bramę', () => {
  const withBoss = (bossFor: string) => ({
    ...data,
    encounters: data.encounters.map((entry) =>
      entry.bossFor ? { ...entry, bossFor } : entry,
    ),
  });
  expect(levelSchema.safeParse(withBoss('missing')).success).toBe(false);
  expect(() => loadLevel(withBoss('server'), mission, levelWaves)).toThrow(
    'Spotkanie bossa wymaga celu killBoss lub subdue.',
  );
  expect(
    levelSchema.safeParse({
      ...data,
      gates: data.gates.map((gate) =>
        gate.closedDuring ? { ...gate, closedDuring: 'missing' } : gate,
      ),
    }).success,
  ).toBe(false);
});

it('LevelRuntime zamyka wrota areny na czas walki i nie wznawia pokonanego bossa', () => {
  const boss = level.encounters.find((entry) => entry.bossFor)!;
  const done = level.encounters
    .filter((entry) => entry !== boss)
    .map((entry) => entry.id);
  const runtime = new LevelRuntime(level, done);
  expect(runtime.openGates({})).toContain('gate-sztab');
  expect(runtime.step(boss.zone.position, {})).toEqual(['brandt']);
  expect(runtime.openGates({})).not.toContain('gate-sztab');
  runtime.clear('brandt');
  expect(runtime.openGates({ brandt: 'done' })).toEqual(
    expect.arrayContaining(['gate-sztab', 'gate-gabinet']),
  );
  const resumed = new LevelRuntime(level, done);
  expect(resumed.step(boss.zone.position, { brandt: 'done' })).toEqual([]);
  expect(resumed.openGates({ brandt: 'done' })).toContain('gate-sztab');
});

it('trasa między osłonami ma ciągły prześwit 3 m po otwarciu bram', () => {
  const walls = level.blocks
    .map(({ position, size, rotation }) => {
      const bounds = new Box3().setFromCenterAndSize(
        new Vector3(),
        new Vector3(size.x, size.y, size.z),
      );
      const transform = new Matrix4().compose(
        new Vector3(position.x, position.y, position.z),
        new Quaternion().setFromEuler(
          new Euler(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0),
        ),
        new Vector3(1, 1, 1),
      );
      return bounds.applyMatrix4(transform);
    })
    .filter(
      (bounds) =>
        bounds.max.y > 0 && bounds.min.y < tuning.player.capsuleHeight,
    )
    .map((bounds) => {
      bounds.min.y = 0;
      bounds.max.y = 1;
      return bounds.expandByVector(new Vector3(1.5, 0, 1.5));
    });
  let start = new Vector3(level.playerSpawn.x, 0.5, level.playerSpawn.z);
  for (const id of level.objectiveOrder)
    for (const [x, z] of approaches[id]!) {
      const end = new Vector3(x, 0.5, z);
      const direction = end.clone().sub(start);
      const length = direction.length();
      const ray = new Ray(start, direction.normalize());
      for (const wall of walls) {
        expect(wall.containsPoint(start), `Odcinek do ${x}, ${z}`).toBe(false);
        const hit = ray.intersectBox(wall, new Vector3());
        expect(
          hit === null || hit.distanceTo(start) > length,
          `Odcinek do ${x}, ${z}`,
        ).toBe(true);
      }
      start = end;
    }
});

it.each([-10.5, 10.5])(
  'kładka hali formowania z=%s: wejście rampą, przejście i zejście',
  async (z) => {
    const { scene, commands } = await setup();
    commands.execute('god');
    commands.execute(`tp 88.7 ${z} -90`);
    steps(scene, 10);
    const ground = (scene.query('playerPos') as { y: number }).y;
    const y = (x: number) => walkTo(scene, commands, x, z).y;
    expect(y(99) - ground).toBeCloseTo(4.25, 1);
    expect(y(124) - ground).toBeCloseTo(4.25, 1);
    expect(y(133)).toBeCloseTo(ground, 1);
  },
);

it('pełne przejście pieszo: bramy, arena Brandta z zamkniętymi wrotami, serwer, winda i nagroda', async () => {
  const { scene, commands, bus, store, three } = await setup();
  const before = (await store.loadMeta())!.meta;
  const events: string[] = [];
  bus.on('boss_spawned', ({ name }) => events.push(`spawn:${name}`));
  bus.on('boss_phase', ({ phase }) => events.push(`phase:${phase}`));
  commands.execute('god');
  expect(commands.execute('objective done server')).toBe('Cel niedostępny.');
  expect(three.getObjectByName('gate:gate-sluza')?.visible).toBe(true);

  const route = approaches.brandt!;
  const arena = route.findIndex(([x]) => x > 172);
  for (const [x, z] of route.slice(0, arena)) walkTo(scene, commands, x, z);
  walkTo(scene, commands, 168, 0.4);
  expect(state(scene).completedEncounters).toEqual([
    'patrol-sluza',
    'piece',
    'formowanie-front',
    'formowanie-tyl',
    'straz',
  ]);
  expect(state(scene).checkpointId).toBe('przed-arena');
  expect(state(scene).openGates).toContain('gate-sztab');

  // Wejście na płytę zamyka wrota za graczem; Brandt schodzi po zapowiedzi.
  walkTo(scene, commands, 183, 0.4, false);
  expect(state(scene).activeEncounters).toEqual(['brandt']);
  expect(state(scene).openGates).not.toContain('gate-sztab');
  expect(three.getObjectByName('gate:gate-sztab')?.visible).toBe(true);
  expect(scene.query('enemies')).toBe(0);
  steps(scene, bossSpawnSteps);
  expect(scene.query('enemies')).toBe(1);
  expect(events).toEqual(['spawn:Dyrektor Ochrony Kurogane Arms']);
  commands.execute('tp 174 0.4 90');
  const back: InputSnapshot = { ...idle, held: new Set(['moveForward']) };
  for (let index = 0; index < 90; index++) scene.step(SIM_DT, back);
  expect((scene.query('playerPos') as { x: number }).x).toBeGreaterThan(172.5);

  killBoss(scene, commands);
  expect(events.slice(1)).toEqual(['phase:2', 'phase:3']);
  expect(scene.query('enemies')).toBe(0);
  expect(state(scene)).toMatchObject({
    objectives: { brandt: 'done', server: 'pending' },
    activeEncounters: [],
    checkpointId: 'po-brandcie',
  });
  expect(state(scene).completedEncounters).toContain('brandt');
  expect(state(scene).openGates).toEqual(
    expect.arrayContaining(['gate-sztab', 'gate-gabinet']),
  );
  expect(state(scene).openGates).not.toContain('gate-winda');

  for (const id of ['server', 'exit']) {
    const target = level.objectivePositions[id]!;
    for (const [x, z] of approaches[id]!) walkTo(scene, commands, x, z);
    walkTo(scene, commands, target.x, target.z + (id === 'server' ? 1 : 0));
    // Zgranie serwera trwa 3 s, wyjazd windą 2 s.
    for (
      let index = 0;
      index < 300 && state(scene).objectives[id] !== 'done';
      index++
    )
      scene.step(SIM_DT, idle);
    expect(state(scene).objectives[id]).toBe('done');
  }
  await vi.waitFor(() => expect(scene.query('screen')).toBe('summary'));
  const saved = (await store.loadMeta())!.meta;
  expect(saved.campaign.completed).toContain(ID);
  expect(saved.data - before.data).toBeGreaterThanOrEqual(150);
  expect(saved.cores - before.cores).toBeGreaterThanOrEqual(3);
  expect(await store.loadMission!()).toBeNull();
});

it('śmierć w walce z Brandtem: powrót przed arenę, otwarte wrota i walka od początku', async () => {
  const { scene, commands } = await setup();
  commands.execute('god');
  clearToArena(scene, commands);
  commands.execute('tp 185 0 -90');
  steps(scene, bossSpawnSteps);
  expect(state(scene).activeEncounters).toEqual(['brandt']);
  commands.execute('kill all');
  steps(scene, 75);
  commands.execute('god');
  commands.execute('hurt 9999');
  expect(state(scene).state).toBe('respawning');
  steps(scene, Math.ceil(tuning.level.respawnDelayS / SIM_DT) + 2);
  expect(state(scene)).toMatchObject({
    state: 'playing',
    checkpointId: 'przed-arena',
    activeEncounters: [],
    objectives: { brandt: 'pending' },
  });
  expect(state(scene).openGates).toContain('gate-sztab');
  expect(scene.query('enemies')).toBe(0);
  expect((scene.query('playerPos') as { x: number }).x).toBeCloseTo(167);
  commands.execute('god');
  commands.execute('tp 185 0 -90');
  steps(scene, bossSpawnSteps);
  expect(scene.query('enemies')).toBe(1);
  killBoss(scene, commands);
  expect(state(scene).objectives.brandt).toBe('done');
});

it('wznowienie po pokonaniu Brandta nie przywraca bossa; najwyższa trudność też daje jednego', async () => {
  setDifficultyOverride('nightmare');
  const { scene, commands, store } = await setup();
  commands.execute('god');
  clearToArena(scene, commands);
  commands.execute('tp 185 0 -90');
  steps(scene, bossSpawnSteps + 120);
  expect(scene.query('enemies')).toBe(1);
  killBoss(scene, commands);
  expect(state(scene).objectives.brandt).toBe('done');
  await vi.waitFor(async () =>
    expect((await store.loadMission!())?.checkpointId).toBe('po-brandcie'),
  );
  scene.dispose();
  const resumed = await setup(store, true);
  expect(state(resumed.scene)).toMatchObject({
    checkpointId: 'po-brandcie',
    objectives: { brandt: 'done' },
  });
  steps(resumed.scene, bossSpawnSteps + 30);
  expect(state(resumed.scene).activeEncounters).toEqual([]);
  expect(resumed.scene.query('enemies')).toBe(0);
  expect((resumed.scene.query('playerPos') as { x: number }).x).toBeCloseTo(
    204,
  );
});
