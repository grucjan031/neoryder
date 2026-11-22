import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { PlayerController } from '../../src/player/playerController';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomSchema } from '../../src/world/roomSchema';
import type { RoomDefinition } from '../../src/world/roomSchema';
import { createArena, vec } from '../../tools/arenas/lib/arena.mjs';
import { createPrimitives } from '../../tools/arenas/lib/prims.mjs';
import { RUN_PROFILE, checkArena } from '../../tools/arenas/lib/check.mjs';
import alleyBackstreet from '../../tools/arenas/run/alleyBackstreet.mjs';
import alleyCrossing from '../../tools/arenas/run/alleyCrossing.mjs';
import alleyMarket from '../../tools/arenas/run/alleyMarket.mjs';
import alleyUnderpass from '../../tools/arenas/run/alleyUnderpass.mjs';

const rect = (minX: number, maxX: number, minZ: number, maxZ: number) => ({
  minX,
  maxX,
  minZ,
  maxZ,
});
const codes = (report: ReturnType<typeof checkArena>) =>
  report.errors.map((e) => e.code);

/** Minimalna arena runu spełniająca profil combat; testy psują po jednym progu. */
function syntheticRun(
  options: {
    size?: number;
    elite?: boolean;
    levels?: boolean;
    ramp?: boolean;
    wall?: boolean;
    spawns?: number;
  } = {},
) {
  const { size = 80, elite = false, levels = true, ramp = true } = options;
  const half = size / 2;
  const arena = createArena({
    id: 'syntheticRun',
    name: 'Syntetyczna',
    bounds: rect(-half, half, -half, half),
    exclusive: false,
  });
  const p = createPrimitives(arena);
  arena.roomMeta({
    type: elite ? 'elite' : 'combat',
    playerSpawn: vec(0, 0, half - 3),
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(0, 1.5, half),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(0, 1.5, -half),
        size: vec(4, 3, 1),
      },
    ],
  });
  p.floor(rect(-half, half, -half, half), 0, 'asphalt');
  if (options.wall !== false)
    p.wall(vec(0, 0, -20), vec(0, 0, 20), 4, 1, 'facade');
  if (levels) {
    arena.block({
      size: vec(12, 3.2, 12),
      position: vec(-25, 1.6, 20),
      material: 'concrete',
      walkable: true,
    });
    if (ramp) p.ramp({ from: vec(-25, 3.2, 14), to: vec(-25, 0, 3), width: 3 });
    if (elite) {
      arena.block({
        size: vec(12, 6.4, 12),
        position: vec(25, 3.2, 20),
        material: 'concrete',
        walkable: true,
      });
      p.ramp({ from: vec(25, 6.4, 14), to: vec(25, 0, 1), width: 3 });
    }
  }
  for (const [name, r, kind] of [
    ['A', rect(-half, half, 10, half), 'open'],
    ['B', rect(-half, half, -10, 10), 'dense'],
    ['C', rect(-half, half, -half, -10), 'low'],
  ] as const)
    arena.zone(name, r, kind);
  const models = [
    'city_car',
    'city_crates',
    'city_barrier',
    'city_kiosk',
    'city_vending',
  ];
  for (let i = 0; i < 20; i++)
    arena.decor(models[i % models.length]!, vec(-30 + i * 3, 0, 30));
  for (let i = 0; i < (options.spawns ?? 18); i++)
    arena.spawn(vec(-30 + i * 3, 0, 33));
  return arena;
}

describe('profil run w checkArena', () => {
  it('akceptuje poprawną arenę combat i elite z progami z briefu', () => {
    const combat = checkArena(syntheticRun(), undefined, { profile: 'run' });
    expect(codes(combat)).toEqual([]);
    expect(combat.metrics.routeBlockedM).toBeGreaterThanOrEqual(8);
    expect(RUN_PROFILE.combat).toMatchObject({
      areaM2: 3500,
      levels: 2,
      spawns: 10,
    });
    expect(RUN_PROFILE.elite).toMatchObject({
      areaM2: 6000,
      levels: 3,
      spawns: 14,
    });
    const elite = checkArena(
      syntheticRun({ size: 100, elite: true }),
      undefined,
      {
        profile: 'run',
      },
    );
    expect(codes(elite)).toEqual([]);
  });

  it('profil dużych aren pozostaje niezmieniony i odrzuca arenę runu', () => {
    const report = checkArena(syntheticRun());
    expect(codes(report)).toEqual(
      expect.arrayContaining([
        'dimensions',
        'walkable-area',
        'height-levels',
        'capture-points',
      ]),
    );
  });

  it('wymiar: combat 70–100 m, elite 90–130 m', () => {
    expect(
      codes(
        checkArena(syntheticRun({ size: 60 }), undefined, { profile: 'run' }),
      ),
    ).toContain('dimensions');
    expect(
      codes(
        checkArena(syntheticRun({ size: 104 }), undefined, { profile: 'run' }),
      ),
    ).toContain('dimensions');
    // 80 m wystarcza dla combat, ale nie dla elite.
    expect(
      codes(
        checkArena(syntheticRun({ size: 80, elite: true }), undefined, {
          profile: 'run',
        }),
      ),
    ).toContain('dimensions');
  });

  it('powierzchnia: combat ≥3500 m², elite ≥6000 m²', () => {
    const small = checkArena(
      syntheticRun({ size: 70, levels: false }),
      undefined,
      { profile: 'run' },
    );
    expect(small.metrics.areaM2).toBeGreaterThan(3500);
    const tight = syntheticRun({ size: 100, elite: true });
    expect(
      checkArena(tight, undefined, { profile: 'run' }).metrics.areaM2,
    ).toBeGreaterThan(6000);
  });

  it('poziomy: ≥2 (elite ≥3) i każdy połączony rampą', () => {
    expect(
      codes(
        checkArena(syntheticRun({ levels: false }), undefined, {
          profile: 'run',
        }),
      ),
    ).toContain('height-levels');
    const noRamp = checkArena(syntheticRun({ ramp: false }), undefined, {
      profile: 'run',
    });
    expect(codes(noRamp)).toContain('level-ramps');
    // Elite z dwoma poziomami nie spełnia progu trzech.
    const thin = syntheticRun({ size: 100 });
    thin.arenaMeta({});
    const room = thin.toRoom();
    room.type = 'elite';
    expect(
      codes(checkArena(room, thin.metadata, { profile: 'run' })),
    ).toContain('height-levels');
  });

  it('strefy 3–5, spawny ≥10 (elite ≥14), udział modelu ≤20%', () => {
    const arena = syntheticRun({ spawns: 9 });
    expect(codes(checkArena(arena, undefined, { profile: 'run' }))).toContain(
      'spawn-count',
    );
    const many = syntheticRun();
    many.metadata.zones.push(
      ...['D', 'E', 'F'].map((n) => ({
        name: n,
        rect: rect(-30, 30, 10, 30),
        kind: 'open' as const,
      })),
    );
    expect(codes(checkArena(many, undefined, { profile: 'run' }))).toContain(
      'zones',
    );
    const few = syntheticRun();
    few.metadata.zones.length = 2;
    expect(codes(checkArena(few, undefined, { profile: 'run' }))).toContain(
      'zones',
    );
    const same = syntheticRun();
    for (let i = 0; i < 40; i++) same.decor('city_car', vec(i, 0, 36));
    expect(codes(checkArena(same, undefined, { profile: 'run' }))).toContain(
      'prop-share',
    );
  });

  it('linia start → wyjście nie może być prosta', () => {
    const straight = checkArena(syntheticRun({ wall: false }), undefined, {
      profile: 'run',
    });
    expect(codes(straight)).toContain('straight-route');
  });
});

type Generated = {
  id: string;
  generate: () => ReturnType<typeof createArena>;
  type: 'combat' | 'elite';
  maxAlive: number;
  /** Cele poza siatką gruntu: dachy, antresole, tunele. */
  goals: Vec3[];
  lowest: number;
};
const rooms: Generated[] = [
  {
    id: 'alleyBackstreet',
    generate: alleyBackstreet,
    type: 'combat',
    maxAlive: 10,
    goals: [
      { x: -2, y: 3.2, z: 15 },
      { x: -9, y: 3.2, z: -6 },
      { x: 28, y: 6.4, z: 14 },
    ],
    lowest: -0.1,
  },
  {
    id: 'alleyCrossing',
    generate: alleyCrossing,
    type: 'combat',
    maxAlive: 10,
    goals: [
      { x: -8, y: -3.2, z: 0 },
      { x: 0, y: -3.2, z: 0 },
      { x: 36, y: 3.4, z: 13 },
    ],
    lowest: -3.3,
  },
  {
    id: 'alleyMarket',
    generate: alleyMarket,
    type: 'combat',
    maxAlive: 9,
    goals: [{ x: 0, y: 4, z: -13.5 }],
    lowest: -0.1,
  },
  {
    id: 'alleyUnderpass',
    generate: alleyUnderpass,
    type: 'elite',
    maxAlive: 11,
    goals: [
      { x: -8, y: -1.4, z: -8 },
      { x: 0, y: -1.4, z: 22 },
      { x: 29, y: 4.5, z: -46 },
    ],
    lowest: -1.5,
  },
];

const onDisk = (id: string): unknown =>
  JSON.parse(readFileSync(`src/data/rooms/${id}.json`, 'utf8'));

describe.each(rooms)('arena runu $id', (entry) => {
  const arena = entry.generate();
  const room = roomSchema.parse(onDisk(entry.id)) as RoomDefinition;

  it('zapisany JSON odpowiada generatorowi i przechodzi roomSchema', () => {
    expect(onDisk(entry.id)).toEqual(
      JSON.parse(JSON.stringify(arena.toRoom())),
    );
    expect(roomSchema.safeParse(arena.toRoom()).error).toBeUndefined();
  });

  it('zachowuje id, typ, drzwi, dyrektora i nie jest wyłączną areną trybów', () => {
    expect(room.id).toBe(entry.id);
    expect(room.type).toBe(entry.type);
    expect(room.doors.map((d) => `${d.id}:${d.role}`)).toEqual([
      'entry:entry',
      'exit:exit',
    ]);
    expect(room.director).toBeDefined();
    expect(room.maxAlive).toBe(entry.maxAlive);
    expect(room.maxAlive).toBeGreaterThan(entry.type === 'elite' ? 10 : 8);
    expect(room.minSpawnDistance).toBeGreaterThanOrEqual(12);
    // Run losuje tylko pokoje bez arena.exclusive.
    expect(room.arena?.exclusive).toBeUndefined();
    expect(room.weather).toBeTruthy();
    expect(room.weather).not.toBe('');
  });

  it('check profilu run bez błędów, neony tylko z palety Neon Noir', () => {
    const report = checkArena(arena, arena.metadata, { profile: 'run' });
    expect(report.errors).toEqual([]);
    // Ostrzeżenia generatora (kolizje rekwizytów, spawny przy bryłach) traktujemy jak błąd.
    expect(report.warnings).toEqual([]);
    const forbidden = /^#(ff0000|ff2bd6|00e5ff|e0262b|ff5050)$/i;
    const colours = [
      ...(room.lights ?? []).map((l) => l.color),
      ...(room.signs ?? []).map((s) => s.tint ?? '#fff1d6'),
    ];
    for (const colour of colours) expect(colour).not.toMatch(forbidden);
  });

  it('cele misji m01 w tym pokoju leżą na wolnym gruncie (strefa 1,6 m, strażnicy w promieniu 3 m)', () => {
    const mission = JSON.parse(
      readFileSync('src/data/missions/m01-maszty.json', 'utf8'),
    ) as {
      fixedNodes: { roomId: string; objectives: string[] }[];
      objectives: {
        id: string;
        position?: Vec3;
        spawnAfter?: string;
        offset?: Vec3;
      }[];
    };
    const node = mission.fixedNodes.find((n) => n.roomId === entry.id);
    if (!node) return;
    const base = (o: (typeof mission.objectives)[number]): Vec3 | undefined =>
      o.position ??
      (o.spawnAfter && o.offset
        ? (() => {
            const parent = mission.objectives.find(
              (x) => x.id === o.spawnAfter,
            )!;
            return (
              parent.position && {
                x: parent.position.x + o.offset!.x,
                y: 0,
                z: parent.position.z + o.offset!.z,
              }
            );
          })()
        : undefined);
    const solid = room.blocks.filter((b) =>
      !b.walkable && b.visible !== false ? true : !b.walkable,
    );
    const blocked = (x: number, z: number, margin: number) =>
      solid.some(
        (b) =>
          b.position.y - b.size.y / 2 <= 0.3 &&
          b.position.y + b.size.y / 2 > 0.5 &&
          Math.abs(x - b.position.x) < b.size.x / 2 + margin &&
          Math.abs(z - b.position.z) < b.size.z / 2 + margin,
      );
    for (const id of node.objectives) {
      const point = base(mission.objectives.find((o) => o.id === id)!);
      if (!point) continue;
      expect(blocked(point.x, point.z, 0.8), id).toBe(false);
      for (let a = 0; a < 8; a++)
        expect(
          blocked(
            point.x + 3 * Math.cos((a * Math.PI) / 4),
            point.z + 3 * Math.sin((a * Math.PI) / 4),
            0.3,
          ),
          `${id} strażnik ${a}`,
        ).toBe(false);
    }
  });

  it('nawigacja prowadzi od startu do punktów, spawnów, wyjścia i wyższych poziomów', () => {
    const navigation = new ArenaNavigation(room);
    const start = room.playerSpawn;
    const exit = room.doors.find((d) => d.role === 'exit')!;
    const goals: Vec3[] = [
      ...room.arena!.points.map((p) => p.position),
      ...room.spawnPoints.map((s) => ({ x: s.x, y: 0, z: s.z })),
      { x: exit.position.x, y: 0, z: exit.position.z + 2.5 },
      ...entry.goals,
    ];
    for (const goal of goals)
      expect(
        navigation.path(start, goal).length,
        JSON.stringify(goal),
      ).toBeGreaterThan(0);
    // Droga powrotna z najwyższego celu na grunt (wrogowie wchodzą tylko rampami).
    const high = entry.goals.reduce((a, b) => (b.y > a.y ? b : a));
    expect(navigation.path(high, { ...start }).length).toBeGreaterThan(0);
  });

  it('kapsuła FPP przechodzi od startu do wyjścia i na najwyższy poziom bez skoku', async () => {
    const rapier = await initPhysics();
    const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
    const ctx = { bus: new EventBus(), tuning: structuredClone(tuning) };
    for (const block of room.blocks) {
      const r = block.rotation;
      world.createCollider(
        rapier.ColliderDesc.cuboid(
          block.size.x / 2,
          block.size.y / 2,
          block.size.z / 2,
        )
          .setTranslation(block.position.x, block.position.y, block.position.z)
          .setRotation(
            new Quaternion().setFromEuler(
              new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0),
            ),
          )
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    }
    const height =
      tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset;
    const player = new PlayerController(7, world, ctx, {
      ...room.playerSpawn,
      y: room.playerSpawn.y + height,
    });
    const idle = {
      held: new Set<never>(),
      pressed: new Set<never>(),
      released: new Set<never>(),
      lookDelta: { x: 0, y: 0 },
    };
    const walk = (goal: Vec3) => {
      for (let i = 0; i < 2400; i++) {
        const state = player.getState();
        const dx = goal.x - state.position.x,
          dz = goal.z - state.position.z;
        if (Math.hypot(dx, dz) < 0.22) return;
        const yaw = Math.atan2(-dx, -dz);
        player.step(SIM_DT, {
          ...idle,
          held: new Set(['moveForward']),
          lookDelta: {
            x: (state.yaw - yaw) / tuning.player.lookSensitivity,
            y: 0,
          },
        });
        world.step();
        expect(state.position.y).toBeGreaterThan(entry.lowest + height - 0.1);
      }
      throw new Error(
        `Kapsuła utknęła: ${JSON.stringify(player.getState().position)} → ${JSON.stringify(goal)}`,
      );
    };
    try {
      world.step();
      const navigation = new ArenaNavigation(room);
      const exit = room.doors.find((d) => d.role === 'exit')!;
      const high = entry.goals.reduce((a, b) => (b.y > a.y ? b : a));
      for (const goal of [
        { x: exit.position.x, y: 0, z: exit.position.z + 2.5 },
        high,
      ]) {
        const path = navigation.path(player.getState().position, goal);
        expect(path.length).toBeGreaterThan(0);
        for (const waypoint of path) walk(waypoint);
        expect(
          Math.abs(player.getState().position.y - goal.y - height),
        ).toBeLessThan(0.12);
      }
    } finally {
      player.dispose();
      world.free();
    }
  }, 120_000);
});
