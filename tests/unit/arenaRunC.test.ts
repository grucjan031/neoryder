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
import type { ArenaBuilder } from '../../tools/arenas/lib/arena.mjs';
import { checkArena } from '../../tools/arenas/lib/check.mjs';
import combatSubstation from '../../tools/arenas/run/combatSubstation.mjs';
import combatWarehouse from '../../tools/arenas/run/combatWarehouse.mjs';
import combatYard from '../../tools/arenas/run/combatYard.mjs';

import eliteChemPlant from '../../tools/arenas/run/eliteChemPlant.mjs';
import eliteFoundry from '../../tools/arenas/run/eliteFoundry.mjs';
import eliteCourtyard from '../../tools/arenas/run/eliteCourtyard.mjs';
import eliteHall from '../../tools/arenas/run/eliteHall.mjs';
import plazaHolo from '../../tools/arenas/run/plazaHolo.mjs';
// Pokoje partii C (brief aren runu); profil i pomocnicze testy: arenaRun.test.ts.
type Generated = {
  id: string;
  generate: () => ArenaBuilder;
  type: 'combat' | 'elite';
  maxAlive: number;
  /** Cele poza siatką gruntu: dachy, antresole, tunele. */
  goals: Vec3[];
  lowest: number;
};
const rooms: Generated[] = [
  {
    id: 'combatSubstation',
    generate: combatSubstation,
    type: 'combat',
    maxAlive: 9,
    goals: [
      { x: 0, y: 4, z: -21.5 },
      { x: -20, y: 4, z: -34 },
    ],
    lowest: -0.1,
  },
  {
    id: 'combatWarehouse',
    generate: combatWarehouse,
    type: 'combat',
    maxAlive: 10,
    goals: [{ x: -30, y: 4, z: -38 }],
    lowest: -0.1,
  },
  {
    id: 'combatYard',
    generate: combatYard,
    type: 'combat',
    maxAlive: 9,
    goals: [
      { x: -34, y: 3.2, z: -20 },
      { x: 35, y: 4.8, z: -5 },
    ],
    lowest: -0.1,
  },
  {
    id: 'eliteChemPlant',
    generate: eliteChemPlant,
    type: 'elite',
    maxAlive: 11,
    goals: [
      { x: 0, y: 3.6, z: -6.5 },
      { x: 0, y: 7.2, z: -23.5 },
    ],
    lowest: -0.1,
  },
  {
    id: 'eliteFoundry',
    generate: eliteFoundry,
    type: 'elite',
    maxAlive: 12,
    goals: [
      { x: 0, y: 4.2, z: -10.5 },
      { x: 0, y: 8.4, z: -28.5 },
    ],
    lowest: -0.1,
  },
  {
    id: 'eliteCourtyard',
    generate: eliteCourtyard,
    type: 'elite',
    maxAlive: 11,
    goals: [
      { x: -30, y: 3.6, z: -30 },
      { x: -36, y: 7.2, z: -44 },
    ],
    lowest: -0.1,
  },
  {
    id: 'eliteHall',
    generate: eliteHall,
    type: 'elite',
    maxAlive: 11,
    goals: [
      { x: -30, y: 4.8, z: 20 },
      { x: -11, y: -1.2, z: -20 },
      { x: 12, y: -1.2, z: -20 },
    ],
    lowest: -1.3,
  },
  {
    id: 'plazaHolo',
    generate: plazaHolo,
    type: 'elite',
    maxAlive: 12,
    goals: [
      { x: -38, y: 4.8, z: -10 },
      { x: 38, y: 4.8, z: -10 },
      { x: -30, y: 2.4, z: 0 },
    ],
    lowest: -0.1,
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
