/**
 * Szturm i Kradzież rdzenia na dużych arenach (ADR 0011 D4): dane układów,
 * wybór areny, ścieżki nawigacji, reguły trybów i host RoomScene.
 */
import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import { Assault } from '../../src/world/assault';
import { Heist } from '../../src/world/heist';
import { assaultMode, heistMode, modeSources } from '../../src/world/modes';
import {
  assaultForArena,
  heistForArena,
  selectArena,
  validateMode,
} from '../../src/world/modeSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';
import { Rng } from '../../src/core/rng';
import { EventBus } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { RunManager } from '../../src/world/run';
import { RoomScene } from '../../src/scenes/roomScene';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';
import type { InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';
import type { EnemyManager } from '../../src/enemies/manager';

const assaultArenas = assaultMode.arenas!;
const heistArenas = heistMode.arenas!;
const idle: InputSnapshot = {
  held: new Set(),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
};
const length = (path: Vec3[]) =>
  path.reduce(
    (sum, p, i) =>
      i ? sum + Math.hypot(p.x - path[i - 1]!.x, p.z - path[i - 1]!.z) : 0,
    0,
  );
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

describe('dane układów trybów na dużych arenach', () => {
  it('Szturm: trzy areny, 3–4 sektory, wszystkie pozycje przechodzą walidację', () => {
    expect(assaultArenas).toEqual([
      'arenaRailYard',
      'arenaConstructionSite',
      'arenaFloodedDocks',
    ]);
    for (const id of assaultArenas) {
      const room = roomDefinitions.get(id)!;
      const sectors = room.arena!.assault!.sectors;
      expect(sectors.length).toBeGreaterThanOrEqual(3);
      expect(sectors.length).toBeLessThanOrEqual(4);
      const definition = assaultForArena(assaultMode, room);
      expect(definition.roomId).toBe(id);
      expect(definition.maxAlive).toBe(room.arena!.maxAlive);
      expect(() =>
        validateMode(definition, room, definition.enemies),
      ).not.toThrow();
    }
  });

  it('Kradzież: trzy areny, wszystkie pozycje przechodzą walidację', () => {
    expect(heistArenas).toEqual([
      'arenaContainerPort',
      'arenaPowerPlant',
      'arenaRooftops',
    ]);
    for (const id of heistArenas) {
      const room = roomDefinitions.get(id)!;
      const definition = heistForArena(heistMode, room);
      expect(definition.base).toEqual(room.arena!.heist!.base);
      expect(() =>
        validateMode(definition, room, definition.enemies),
      ).not.toThrow();
    }
  });

  it('walidator odrzuca nakładające się stacje i punkt poza podłogą', () => {
    const room = structuredClone(roomDefinitions.get('arenaRailYard')!);
    const definition = assaultForArena(assaultMode, room);
    room.arena!.assault!.sectors[0]!.stations[1] = {
      ...room.arena!.assault!.sectors[0]!.stations[0],
    };
    expect(() => validateMode(definition, room, definition.enemies)).toThrow(
      /nakładają/,
    );
    const outside = structuredClone(roomDefinitions.get('arenaPowerPlant')!);
    outside.arena!.heist!.base = { x: 9999, y: 0, z: 9999 };
    const heist = heistForArena(heistMode, outside);
    expect(() => validateMode(heist, outside, heist.enemies)).toThrow();
  });

  it.each(assaultArenas)(
    '%s: ścieżka z odrodzenia do stacji, między sektorami i z posiłków jest niepusta',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const navigation = new ArenaNavigation(room);
      const { sectors } = room.arena!.assault!;
      sectors.forEach((sector, index) => {
        for (const station of sector.stations) {
          expect(
            navigation.path(sector.playerSpawn, station).length,
          ).toBeGreaterThan(0);
          for (const spawn of sector.spawnPoints)
            expect(navigation.path(spawn, station).length).toBeGreaterThan(0);
        }
        const next = sectors[index + 1];
        if (next)
          expect(
            navigation.path(sector.playerSpawn, next.playerSpawn).length,
          ).toBeGreaterThan(0);
      });
    },
    30_000,
  );

  it.each(heistArenas)(
    '%s: baza i ewakuacja 120–200 m drogi, z trasą okrężną',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const { base, extraction, playerSpawn } = room.arena!.heist!;
      const navigation = new ArenaNavigation(room);
      const route = navigation.path(base, extraction);
      expect(route.length).toBeGreaterThan(0);
      expect(route.at(-1)).toEqual(extraction);
      const meters = length(route);
      expect(meters).toBeGreaterThanOrEqual(120);
      expect(meters).toBeLessThanOrEqual(200);
      expect(navigation.path(extraction, base).length).toBeGreaterThan(0);
      expect(navigation.path(playerSpawn, extraction).length).toBeGreaterThan(
        0,
      );
      // Wybór ścieżek: po zablokowaniu środka trasy istnieje droga objazdowa.
      const mid = route[Math.floor(route.length / 2)]!;
      const blocked = {
        ...room,
        blocks: [
          ...room.blocks,
          {
            size: { x: 18, y: 60, z: 18 },
            position: { x: mid.x, y: mid.y + 28, z: mid.z },
          },
        ],
      };
      const detour = new ArenaNavigation(blocked).path(base, extraction);
      expect(detour.length).toBeGreaterThan(0);
      expect(length(detour)).toBeLessThanOrEqual(meters * 1.6);
    },
    30_000,
  );
});

describe('wybór areny trybów', () => {
  it.each(['assault', 'heist'] as const)(
    '%s: bez seeda pierwsza arena, seed wybiera deterministycznie, override tylko w debug',
    (modeId) => {
      const mode = modeSources[modeId];
      const ids = mode.arenas!;
      expect(selectArena(mode)).toBe(ids[0]);
      expect(selectArena(mode, 'abc')).toBe(selectArena(mode, 'abc'));
      const picked = new Set(
        Array.from({ length: 40 }, (_, i) => selectArena(mode, `seed-${i}`)),
      );
      expect(picked.size).toBe(ids.length);
      for (const id of picked) expect(ids).toContain(id);
      expect(selectArena(mode, 'abc', ids[2], true)).toBe(ids[2]);
      expect(selectArena(mode, 'abc', ids[2], false)).toBe(
        selectArena(mode, 'abc'),
      );
      expect(() => selectArena(mode, 'abc', 'arenaOverpass', true)).toThrow();
      // Dawny mały pokój pozostaje dostępny jako override.
      expect(selectArena(mode, undefined, mode.roomId, true)).toBe(mode.roomId);
    },
  );

  it('RunManager zapisuje wybraną arenę w węźle trybu', () => {
    const run = new RunManager(new EventBus(), {
      generateMap: () => ({ sectorId: 'unused', layers: [] }),
    });
    run.newRun('x', 'classic', { modeId: 'heist', arenaId: 'arenaRooftops' });
    expect(run.state.map.layers[0]![0]!.fixed?.roomId).toBe('arenaRooftops');
    run.newRun('x', 'classic', {
      modeId: 'assault',
      arenaId: 'combatCorridor',
    });
    expect(run.state.map.layers[0]![0]!.fixed?.roomId).toBe('combatCorridor');
    run.dispose();
  });
});

describe('reguły trybów na danych dużej areny', () => {
  it.each(assaultArenas)(
    'Szturm %s: front przesuwa się przez sektory aż do zwycięstwa',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const definition = assaultForArena(assaultMode, room);
      const model = new Assault(definition, {
        signal: vi.fn(),
        explode: vi.fn(),
      });
      for (const [index, sector] of definition.sectors.entries()) {
        expect(model.sectorIndex).toBe(index);
        expect(model.snapshot().stations.map((s) => s.position)).toEqual(
          sector.stations,
        );
        model.destroy('A');
        model.destroy('B');
        model.step(SIM_DT, sector.playerSpawn);
      }
      expect(model.outcome).toBe('victory');
    },
  );

  it.each(assaultArenas)(
    'Szturm %s: posiłki w pierścieniu, najbliżej aktywnych stacji',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const definition = assaultForArena(assaultMode, room);
      const model = new Assault(definition, {
        signal: vi.fn(),
        explode: vi.fn(),
      });
      const ring = room.arena!.spawnRing!;
      const sector = definition.sectors[0]!;
      const player = sector.playerSpawn;
      const pool = new Set(
        [...sector.spawnPoints, ...arenaSpawnPoints(room)].map((p) =>
          JSON.stringify(p),
        ),
      );
      const rng = new Rng('szturm-ring');
      for (let i = 0; i < 20; i++) {
        const spawn = model.spawnPosition(room, player, [], rng)!;
        expect(spawn).not.toBeNull();
        expect(pool.has(JSON.stringify(spawn))).toBe(true);
        expect(distance(spawn, player)).toBeGreaterThanOrEqual(ring.minM);
      }
      // Gdy stacje są wszędzie poza pierścieniem, wybór zostaje najbliżej stacji.
      const near = model.spawnPosition(room, player, [], new Rng('a'))!;
      const stationDistance = (p: Vec3) =>
        Math.min(...sector.stations.map((s) => distance(s, p)));
      const inRing = [...pool]
        .map((p) => JSON.parse(p) as Vec3)
        .filter(
          (p) =>
            distance(p, player) >= ring.minM &&
            distance(p, player) <= ring.maxM,
        );
      if (inRing.length)
        expect(stationDistance(near)).toBeCloseTo(
          Math.min(...inRing.map(stationDistance)),
          6,
        );
    },
  );

  it.each(heistArenas)(
    'Kradzież %s: rdzeń z bazy do ewakuacji, nosiciel wroga odnosi go do bazy',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const definition = heistForArena(heistMode, room);
      const floor = definition.base.y;
      const heist = new Heist(definition);
      const player = (p: Vec3): Vec3 => ({ ...p, y: p.y + 0.9 });
      heist.step(SIM_DT, player(definition.base), []);
      expect(heist.state).toBe('player');
      // Gracz piętro wyżej lub niżej nie podnosi rdzenia ani nie ewakuuje.
      const other = new Heist(definition);
      other.step(
        SIM_DT,
        { ...definition.base, y: floor + tuning.modes.heist.zoneHeightM + 3 },
        [],
      );
      expect(other.state).toBe('base');
      for (let t = 0; t < definition.extractS + 0.5; t += SIM_DT)
        heist.step(SIM_DT, player(definition.extraction), []);
      expect(heist.outcome).toBe('victory');

      const enemy = new Heist(definition);
      enemy.step(SIM_DT, definition.extraction, [
        { id: 5, position: definition.base },
      ]);
      expect(enemy.state).toBe('base');
      enemy.grab();
      enemy.drop(definition.extraction);
      enemy.step(SIM_DT, { x: 9999, y: 0, z: 9999 }, [
        { id: 5, position: definition.extraction },
      ]);
      expect(enemy.state).toBe('enemy');
      expect(enemy.moveGoal(5, definition.extraction)).toEqual(definition.base);
      enemy.step(SIM_DT, { x: 9999, y: 0, z: 9999 }, [
        { id: 5, position: definition.base },
      ]);
      expect(enemy.state).toBe('base');
    },
  );

  it.each(heistArenas)(
    'Kradzież %s: posiłki w pierścieniu wokół gracza, w puli areny',
    (id) => {
      const room = roomDefinitions.get(id)!;
      const definition = heistForArena(heistMode, room);
      const heist = new Heist(definition);
      const ring = room.arena!.spawnRing!;
      const pool = new Set(
        [...definition.spawnPoints, ...arenaSpawnPoints(room)].map((p) =>
          JSON.stringify(p),
        ),
      );
      const player = definition.playerSpawn!;
      const rng = new Rng('heist-ring');
      for (let i = 0; i < 20; i++) {
        const spawn = heist.spawnPosition(room, player, [], rng)!;
        expect(pool.has(JSON.stringify(spawn))).toBe(true);
        expect(distance(spawn, player)).toBeGreaterThanOrEqual(ring.minM);
      }
    },
  );
});

async function hostScene(
  modeId: 'assault' | 'heist',
  id: string,
  seed = 'arena-modes',
) {
  const room = roomDefinitions.get(id)!;
  const bus = new EventBus();
  const commands = new CommandRegistry();
  const run = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  run.newRun(seed, 'classic', { modeId, arenaId: id });
  run.selectNode(modeId);
  const scene = new RoomScene(
    room,
    run.state,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
    { loadModels: false },
  );
  await scene.init(
    {
      bus,
      rng: new Rng(seed),
      loop: new GameLoop({ step() {}, render() {} }),
      tuning: structuredClone(tuning),
      debug: false,
      commands,
      camera: new PerspectiveCamera(),
    },
    new ThreeScene(),
  );
  const step = (n: number) => {
    for (let i = 0; i < n; i++) scene.step(SIM_DT, idle);
  };
  return { scene, commands, run, step, room };
}

describe('host RoomScene na dużej arenie', () => {
  it.each(assaultArenas)(
    'Szturm %s: start w pierwszym sektorze, posiłki, front i zwycięstwo',
    async (id) => {
      const { scene, commands, run, step, room } = await hostScene(
        'assault',
        id,
      );
      try {
        const first = room.arena!.assault!.sectors[0]!.playerSpawn;
        const start = scene.query('playerPos') as Vec3;
        expect(start.x).toBeCloseTo(first.x, 1);
        expect(start.z).toBeCloseTo(first.z, 1);
        commands.execute('god');
        step(360);
        expect(scene.query('enemies') as number).toBeGreaterThan(0);
        const enemies = Reflect.get(scene, 'manager') as EnemyManager;
        enemies.forEach((enemy) => {
          expect(
            distance(enemy.current.position, start),
            'posiłki w pierścieniu od gracza',
          ).toBeGreaterThanOrEqual(room.arena!.spawnRing!.minM - 1);
        });
        const sectors = room.arena!.assault!.sectors.length;
        for (let sector = 1; sector <= sectors; sector++) {
          expect((scene.query('assault') as { sector: number }).sector).toBe(
            sector,
          );
          commands.execute('assault destroy A');
          commands.execute('assault destroy B');
          step(2);
        }
        expect(scene.query('assault')).toMatchObject({ outcome: 'victory' });
      } finally {
        scene.dispose();
        run.dispose();
      }
    },
    60_000,
  );

  it.each(heistArenas)(
    'Kradzież %s: start przy ewakuacji, rdzeń i zwycięstwo po teleporcie',
    async (id) => {
      const { scene, commands, run, step, room } = await hostScene('heist', id);
      try {
        const layout = room.arena!.heist!;
        const start = scene.query('playerPos') as Vec3;
        expect(start.x).toBeCloseTo(layout.playerSpawn.x, 1);
        expect(start.z).toBeCloseTo(layout.playerSpawn.z, 1);
        commands.execute('god');
        step(360);
        expect(scene.query('enemies') as number).toBeGreaterThan(0);
        commands.execute(
          `tp ${layout.base.x} ${layout.base.z} 0 0 ${layout.base.y}`,
        );
        step(2);
        expect(scene.query('heist')).toMatchObject({ state: 'player' });
        commands.execute(
          `tp ${layout.extraction.x} ${layout.extraction.z} 0 0 ${layout.extraction.y}`,
        );
        step(Math.ceil((heistMode.extractS + 0.5) / SIM_DT));
        expect(scene.query('heist')).toMatchObject({ outcome: 'victory' });
      } finally {
        scene.dispose();
        run.dispose();
      }
    },
    60_000,
  );

  it.each([
    ['assault', 'arenaRailYard'],
    ['assault', 'arenaConstructionSite'],
    ['assault', 'arenaFloodedDocks'],
    ['heist', 'arenaContainerPort'],
    ['heist', 'arenaPowerPlant'],
    ['heist', 'arenaRooftops'],
  ] as const)(
    '%s %s: wróg z odległego spawnu dochodzi do celu nawigacją',
    async (modeId, id) => {
      const { scene, commands, run, step, room } = await hostScene(modeId, id);
      try {
        commands.execute('god');
        commands.execute('kill all');
        const layout =
          modeId === 'assault'
            ? room.arena!.assault!.sectors[0]!
            : room.arena!.heist!;
        // Gracz odsunięty: wróg nie wykrywa go i idzie do celu trybu.
        const goal =
          'stations' in layout ? layout.stations : [room.arena!.heist!.base];
        const from = layout.spawnPoints
          .map((p) => ({ p, d: Math.min(...goal.map((g) => distance(g, p))) }))
          .sort((a, b) => b.d - a.d)[0]!.p;
        const enemies = Reflect.get(scene, 'manager') as EnemyManager;
        const enemy = enemies.spawn('assaulter', from);
        const arrived = () =>
          goal.some(
            (g) =>
              distance(enemy.current.position, g) <= 4 &&
              Math.abs(enemy.current.position.y - g.y) < 3,
          );
        for (let i = 0; i < 12000 && !arrived(); i++) step(1);
        expect(arrived(), JSON.stringify(enemy.current.position)).toBe(true);
      } finally {
        scene.dispose();
        run.dispose();
      }
    },
    120_000,
  );
});
