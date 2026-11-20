/**
 * Budżet wydajności symulacji areny (F1 #16: „30 wrogów jednocześnie”).
 * Mierzy tylko symulację (AI, Rapier, pociski, obrażenia, odłamki) w node — render i GPU
 * sprawdza się ręcznie (docs/playtest-F1.md). Krok symulacji to 1/60 s, więc przy 60 FPS
 * na całą klatkę jest 16,7 ms; symulacji dajemy najwyżej 6 ms średnio na krok (zapas na wolne maszyny CI; lokalnie ~1 ms).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Arena } from '../../src/scenes/arena';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import type { InputSnapshot } from '../../src/core/input';
import { RoomScene } from '../../src/scenes/roomScene';
import { roomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';
import type { EnemyManager } from '../../src/enemies/manager';
import { freeModePosition } from '../../src/world/modeSchema';
import {
  assaultForArena,
  heistForArena,
  modeForArena,
  validateMode,
} from '../../src/world/modeSchema';
import { assaultMode, conquestMode, heistMode } from '../../src/world/modes';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { largeArena } from './largeArenaFixture';
import type { Conquest } from '../../src/world/conquest';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

const active: Arena[] = [];

/** Mediana z 3 przebiegów budowy: pojedynczy pomiar skacze pod obciążeniem maszyny. */
function medianBuildMs(build: () => void): number {
  const times = [0, 1, 2].map(() => {
    const start = performance.now();
    build();
    return performance.now() - start;
  });
  return times.sort((a, b) => a - b)[1]!;
}

// Budżety ADR 0011 D8 (nawigacja ≤ 500 ms, krok ≤ 2 ms) mierzone w izolacji: ok. 180 ms i 0,5 ms.
it('arenaRooftops 300 × 260 m: nawigacja i 12 wrogów z puli areny w budżecie', async () => {
  const room = roomDefinitions.get('arenaRooftops')!;
  const buildMs = medianBuildMs(() => {
    const navigation = new ArenaNavigation(room);
    for (const point of room.arena!.points)
      expect(
        navigation.path(room.playerSpawn, point.position).length,
      ).toBeGreaterThan(0);
  });
  console.info(
    `[perf] arenaRooftops: nawigacja ${buildMs.toFixed(2)} ms (siatka i 5 pól)`,
  );
  expect(buildMs).toBeLessThanOrEqual(500);
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const run = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  run.newRun('rooftops-perf', 'classic', {
    modeId: 'conquest',
    arenaId: room.id,
  });
  run.selectNode('conquest');
  const scene = new RoomScene(
    room,
    run.state,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
    { loadModels: false },
  );
  try {
    await scene.init(
      {
        bus,
        rng: new Rng('rooftops-perf'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
        commands,
        camera: new PerspectiveCamera(),
      },
      new ThreeScene(),
    );
    commands.execute('god');
    commands.execute('kill all');
    const enemies = Reflect.get(scene, 'manager') as EnemyManager;
    // Dwunastu wrogów z różnych stref i poziomów (ulice, dachy 0–12 m) idzie do punktów.
    room
      .arena!.spawnPoints!.filter((_, index) => index % 3 === 0)
      .slice(0, 12)
      .forEach((p, index) =>
        enemies.spawn(index % 3 === 0 ? 'gunner' : 'assaulter', {
          x: p.x,
          y: p.y ?? 0,
          z: p.z,
        }),
      );
    expect(scene.query('enemies')).toBe(12);
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const steps = 600;
    const begin = performance.now();
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - begin) / steps;
    console.info(
      `[perf] arenaRooftops: ${perStepMs.toFixed(3)} ms/krok, 12 wrogów`,
    );
    expect(scene.query('enemies')).toBeGreaterThanOrEqual(12);
    expect(perStepMs).toBeLessThan(6);
  } finally {
    scene.dispose();
  }
}, 60_000);

it.each(['450 × 300 m', 'arenaFloodedDocks'])(
  '%s: budżet nawigacji i 12 wrogów',
  async (id) => {
    const docks = id === 'arenaFloodedDocks';
    const room = docks ? roomDefinitions.get(id)! : largeArena();
    const definition = modeForArena(conquestMode, room);
    validateMode(definition, room, definition.enemies);
    for (const Navigation of [ArenaSurfaceNavigation, ArenaNavigation]) {
      const buildMs = medianBuildMs(() => {
        const nav = new Navigation(room);
        for (const point of definition.points) {
          const path = nav.path(room.playerSpawn, point.position);
          expect(path.at(-1)).toEqual(point.position);
        }
      });
      console.info(
        `[perf] ${id} ${Navigation.name}: ${buildMs.toFixed(2)} ms (mediana z 3, siatka i 5 pól)`,
      );
      expect(buildMs).toBeLessThanOrEqual(500);
    }

    const bus = new EventBus();
    const commands = new CommandRegistry();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('large-arena-perf', 'classic', {
      modeId: 'conquest',
      ...(docks ? { arenaId: id } : {}),
    });
    run.selectNode('conquest');
    const scene = new RoomScene(
      room,
      run.state,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    try {
      await scene.init(
        {
          bus,
          rng: new Rng('large-arena-perf'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
          commands,
          camera: new PerspectiveCamera(),
        },
        new ThreeScene(),
      );
      commands.execute('god');
      if (docks) (Reflect.get(scene, 'conquest') as Conquest).setTickets(0);
      const enemies = Reflect.get(scene, 'manager') as EnemyManager;
      room.spawnPoints
        .slice(0, definition.maxAlive)
        .forEach((position, index) => {
          enemies.spawn(index % 3 === 0 ? 'gunner' : 'assaulter', {
            ...position,
            y: 0,
          });
        });
      for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
      expect(scene.query('enemies')).toBe(12);
      const steps = 600;
      const start = performance.now();
      for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
      const perStepMs = (performance.now() - start) / steps;
      console.info(`[perf] ${id}: ${perStepMs.toFixed(3)} ms/krok`);
      expect(scene.query('enemies')).toBe(12);
      expect(perStepMs).toBeLessThanOrEqual(2);

      if (docks) return;
      const conquest = Reflect.get(scene, 'conquest') as Conquest;
      for (const target of conquest.points) {
        commands.execute('kill all');
        conquest.setTickets(0);
        for (const point of conquest.points) {
          point.owner = point === target ? 'neutral' : 'enemy';
          point.progress = point === target ? 0 : -1;
        }
        const enemy = enemies.spawn('assaulter', { x: -120, y: 0, z: -60 });
        const arrived = () => {
          const p = enemy.current.position;
          return (
            Math.hypot(p.x - target.position.x, p.z - target.position.z) <=
              target.radiusM &&
            Math.abs(p.y - target.position.y) <
              tuning.modes.conquest.zoneHeightM
          );
        };
        for (let i = 0; i < 9000 && !arrived(); i++) scene.step(SIM_DT, idle);
        expect(
          arrived(),
          `${target.id}: ${JSON.stringify(enemy.current.position)}`,
        ).toBe(true);
      }
    } finally {
      scene.dispose();
    }
  },
  60_000,
);

// Szturm i Kradzież rdzenia na dużych arenach (ADR 0011 D4/D8): nawigacja ≤ 500 ms, 12 wrogów ≤ 2 ms/krok.
it.each([
  ['assault', 'arenaRailYard'],
  ['assault', 'arenaConstructionSite'],
  ['assault', 'arenaFloodedDocks'],
  ['heist', 'arenaContainerPort'],
  ['heist', 'arenaPowerPlant'],
  ['heist', 'arenaRooftops'],
] as const)(
  '%s %s: nawigacja ≤ 500 ms, 12 wrogów ≤ 2 ms/krok',
  async (modeId, id) => {
    const room = roomDefinitions.get(id)!;
    const goals =
      modeId === 'assault'
        ? assaultForArena(assaultMode, room).sectors.flatMap((s) => s.stations)
        : [
            heistForArena(heistMode, room).base,
            heistForArena(heistMode, room).extraction,
          ];
    const buildMs = medianBuildMs(() => {
      const nav = new ArenaNavigation(room);
      for (const goal of goals)
        expect(nav.path(room.playerSpawn, goal).length).toBeGreaterThan(0);
    });
    console.info(`[perf] ${modeId} ${id}: nawigacja ${buildMs.toFixed(2)} ms`);
    expect(buildMs).toBeLessThanOrEqual(500);
    const bus = new EventBus();
    const commands = new CommandRegistry();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('mode-arena-perf', 'classic', { modeId, arenaId: id });
    run.selectNode(modeId);
    const scene = new RoomScene(
      room,
      run.state,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    try {
      await scene.init(
        {
          bus,
          rng: new Rng('mode-arena-perf'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
          commands,
          camera: new PerspectiveCamera(),
        },
        new ThreeScene(),
      );
      commands.execute('god');
      const enemies = Reflect.get(scene, 'manager') as EnemyManager;
      arenaSpawnPoints(room)
        .slice(0, 12)
        .forEach((p, index) =>
          enemies.spawn(index % 3 === 0 ? 'gunner' : 'assaulter', p),
        );
      for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
      expect(scene.query('enemies')).toBe(12);
      const steps = 600;
      const start = performance.now();
      for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
      const perStepMs = (performance.now() - start) / steps;
      console.info(
        `[perf] ${modeId} ${id}: ${perStepMs.toFixed(3)} ms/krok, 12 wrogów`,
      );
      expect(scene.query('enemies')).toBe(12);
      expect(perStepMs).toBeLessThanOrEqual(2);
    } finally {
      scene.dispose();
    }
  },
  60_000,
);

it.each(['arenaConstructionSite', 'arenaRailYard'])(
  '%s: nawigacja ≤ 500 ms, 12 wrogów na poziomach ≤ 2 ms/krok',
  async (id) => {
    const room = roomDefinitions.get(id)!;
    const definition = modeForArena(conquestMode, room);
    for (const Navigation of [ArenaSurfaceNavigation, ArenaNavigation]) {
      const buildMs = medianBuildMs(() => {
        const nav = new Navigation(room);
        for (const point of definition.points)
          expect(nav.path(room.playerSpawn, point.position).at(-1)).toEqual(
            point.position,
          );
      });
      console.info(
        `[perf] budowa ${Navigation.name}: ${buildMs.toFixed(2)} ms (mediana z 3, siatka i 5 pól)`,
      );
      expect(buildMs).toBeLessThanOrEqual(500);
    }
    const bus = new EventBus();
    const commands = new CommandRegistry();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('large-arena-perf', 'classic', {
      modeId: 'conquest',
      arenaId: room.id,
    });
    run.selectNode('conquest');
    const scene = new RoomScene(
      room,
      run.state,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    try {
      await scene.init(
        {
          bus,
          rng: new Rng('large-arena-perf'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
          commands,
          camera: new PerspectiveCamera(),
        },
        new ThreeScene(),
      );
      commands.execute('god');
      const enemies = Reflect.get(scene, 'manager') as EnemyManager;
      // Wykop, piętra szkieletu i grunt: wrogowie idą do punktów po schodach i rampach.
      arenaSpawnPoints(room)
        .slice(0, definition.maxAlive)
        .forEach((position, index) =>
          enemies.spawn(index % 3 === 0 ? 'gunner' : 'assaulter', position),
        );
      for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
      expect(scene.query('enemies')).toBe(12);
      const start = performance.now();
      for (let i = 0; i < 600; i++) scene.step(SIM_DT, idle);
      const perStepMs = (performance.now() - start) / 600;
      console.info(`[perf] ${id}: ${perStepMs.toFixed(3)} ms/krok, 12 wrogów`);
      expect(perStepMs).toBeLessThanOrEqual(2);
    } finally {
      scene.dispose();
    }
  },
  60_000,
);

it.each([
  ['arenaOverpass', 12, 2],
  ['arenaRooftops', 30, 6],
  ['arenaContainerPort', 12, 2],
  ['arenaPowerPlant', 12, 2],
] as const)(
  '%s: %i wrogów, nawigacja i Rapier poniżej %i ms/krok',
  async (id, limit, budget) => {
    const room = roomDefinitions.get(id)!;
    const port = id === 'arenaContainerPort';
    if (id === 'arenaPowerPlant' || port) {
      const buildMs = medianBuildMs(() => {
        const nav = new ArenaNavigation(room);
        for (const point of room.arena!.points)
          expect(nav.path(room.playerSpawn, point.position).at(-1)).toEqual(
            point.position,
          );
      });
      console.info(
        `[perf] ${id}: ${buildMs.toFixed(2)} ms (mediana z 3, siatka i 5 pól)`,
      );
      expect(buildMs).toBeLessThanOrEqual(500);
    }
    const bus = new EventBus();
    const commands = new CommandRegistry();
    const run = new RunManager(bus, {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('arena-perf', 'classic', { modeId: 'conquest', arenaId: id });
    run.selectNode('conquest');
    const scene = new RoomScene(
      room,
      run.state,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
      { loadModels: false },
    );
    try {
      await scene.init(
        {
          bus,
          rng: new Rng('arena-perf'),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
          commands,
          camera: new PerspectiveCamera(),
        },
        new ThreeScene(),
      );
      commands.execute('god');
      // Test przeciążeniowy omija limit posiłków 8, zachowuje rzeczywisty host trybu.
      const enemies = Reflect.get(scene, 'manager') as EnemyManager;
      const targetCount = id === 'arenaOverpass' ? 12 : 30;
      let count = 0;
      if (port) {
        for (const position of room.arena!.spawnPoints!.slice(0, limit))
          enemies.spawn(count++ < 8 ? 'assaulter' : 'gunner', {
            ...position,
            y: position.y ?? 0,
          });
      }
      for (let x = -40; x <= 40 && count < limit; x += 8)
        for (let z = -40; z <= 40 && count < limit; z += 8) {
          const position = { x, y: room.playerSpawn.y, z };
          if (
            !freeModePosition(room, position, 1.5) ||
            Math.hypot(x - room.playerSpawn.x, z - room.playerSpawn.z) < 15
          )
            continue;
          enemies.spawn(
            count++ < (targetCount * 2) / 3 ? 'assaulter' : 'gunner',
            position,
          );
        }
      expect(scene.query('enemies')).toBe(limit);
      for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
      const start = performance.now();
      for (let i = 0; i < 600; i++) scene.step(SIM_DT, idle);
      const perStepMs = (performance.now() - start) / 600;
      console.info(
        `[perf] ${id}: ${perStepMs.toFixed(3)} ms/krok, ${limit} wrogów`,
      );
      expect(scene.query('enemies')).toBeGreaterThanOrEqual(limit);
      if (id === 'arenaPowerPlant') expect(scene.query('enemies')).toBe(limit);
      expect(perStepMs).toBeLessThan(budget);
    } finally {
      scene.dispose();
    }
  },
  60_000,
);
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
});

async function setup() {
  const scene = new Arena(false);
  const commands = new CommandRegistry();
  const t = structuredClone(tuning);
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('perf'),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: t,
      debug: false,
      camera: new PerspectiveCamera(),
      commands,
    },
    new ThreeScene(),
  );
  active.push(scene);
  return { scene, commands };
}

describe('wydajność symulacji areny', () => {
  it('30 wrogów (Szturmowcy + Strzelcy) mieści się w budżecie 6 ms na krok', async () => {
    const { scene, commands } = await setup();
    commands.execute('god');
    commands.execute('spawn assaulter 20');
    commands.execute('spawn gunner 10');
    expect(scene.query('enemies')).toBe(30);
    // Rozgrzewka JIT i ustawienie się wrogów wokół gracza.
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const steps = 600; // 10 s symulacji
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / steps;
    console.info(
      `[perf] arena 30 wrogów: ${perStepMs.toFixed(3)} ms / krok symulacji`,
    );
    expect(scene.query('enemies')).toBeGreaterThanOrEqual(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);

  it('30 wrogów z mieszanki fal F2 (wszystkie archetypy) mieści się w budżecie', async () => {
    const { scene, commands } = await setup();
    commands.execute('god');
    for (const [kind, n] of [
      ['assaulter', 8],
      ['gunner', 6],
      ['drone', 6],
      ['sniper', 4],
      ['shielder', 4],
      ['executor', 2],
    ] as const)
      commands.execute(`spawn ${kind} ${n}`);
    expect(scene.query('enemies')).toBe(30);
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const steps = 600;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / steps;
    console.info(
      `[perf] arena 30 wrogów F2: ${perStepMs.toFixed(3)} ms / krok symulacji`,
    );
    expect(scene.query('enemies')).toBeGreaterThanOrEqual(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);

  it('masowe zabójstwo 30 wrogów naraz (odłamki) nie przekracza budżetu', async () => {
    const { scene, commands } = await setup();
    commands.execute('spawn assaulter 30');
    for (let i = 0; i < 30; i++) scene.step(SIM_DT, idle);
    const t0 = performance.now();
    commands.execute('kill all');
    for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
    const perStepMs = (performance.now() - t0) / 120;
    console.info(
      `[perf] rozpad 30 wrogów: ${perStepMs.toFixed(3)} ms / krok, odłamki: ${String(scene.query('debris'))}`,
    );
    expect(scene.query('kills')).toBe(30);
    expect(perStepMs).toBeLessThan(6);
  }, 60_000);
});
