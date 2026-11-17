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
import { modeForArena, validateMode } from '../../src/world/modeSchema';
import { conquestMode } from '../../src/world/modes';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { largeArena } from './largeArenaFixture';
import type { Conquest } from '../../src/world/conquest';

const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};

const active: Arena[] = [];

it('arena 450 × 300 m: 3 poziomy, 5 stref i 12 wrogów', async () => {
  const room = largeArena();
  const definition = modeForArena(conquestMode, room);
  validateMode(definition, room, definition.enemies);
  for (const Navigation of [ArenaSurfaceNavigation, ArenaNavigation]) {
    const start = performance.now();
    const nav = new Navigation(room);
    for (const point of definition.points) {
      const path = nav.path(room.playerSpawn, point.position);
      expect(path.at(-1)).toEqual(point.position);
    }
    const buildMs = performance.now() - start;
    console.info(
      `[perf] ${Navigation.name}: ${buildMs.toFixed(2)} ms (siatka i 5 pól)`,
    );
    expect(buildMs).toBeLessThanOrEqual(500);
  }

  const bus = new EventBus();
  const commands = new CommandRegistry();
  const run = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  run.newRun('large-arena-perf', 'classic', { modeId: 'conquest' });
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
    console.info(`[perf] arena 450 × 300 m: ${perStepMs.toFixed(3)} ms/krok`);
    expect(scene.query('enemies')).toBe(12);
    expect(perStepMs).toBeLessThanOrEqual(2);

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
          Math.abs(p.y - target.position.y) < tuning.modes.conquest.zoneHeightM
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
}, 60_000);

it.each(['arenaOverpass', 'arenaRooftops'])(
  '%s: 30 wrogów, nawigacja i Rapier poniżej 6 ms/krok',
  async (id) => {
    const room = roomDefinitions.get(id)!;
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
      let count = 0;
      for (let x = -40; x <= 40 && count < 30; x += 8)
        for (let z = -40; z <= 40 && count < 30; z += 8) {
          const position = { x, y: room.playerSpawn.y, z };
          if (
            !freeModePosition(room, position, 1.5) ||
            Math.hypot(x - room.playerSpawn.x, z - room.playerSpawn.z) < 15
          )
            continue;
          enemies.spawn(count++ < 20 ? 'assaulter' : 'gunner', position);
        }
      expect(scene.query('enemies')).toBe(30);
      for (let i = 0; i < 120; i++) scene.step(SIM_DT, idle);
      const start = performance.now();
      for (let i = 0; i < 600; i++) scene.step(SIM_DT, idle);
      const perStepMs = (performance.now() - start) / 600;
      console.info(`[perf] ${id}: ${perStepMs.toFixed(3)} ms/krok, 30 wrogów`);
      expect(scene.query('enemies')).toBeGreaterThanOrEqual(30);
      expect(perStepMs).toBeLessThan(6);
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
