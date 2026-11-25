import { expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { PlayerController } from '../../src/player/playerController';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';
import { roomDefinitions } from '../../src/world/rooms';

it.each([
  'combatClinic',
  'combatMarketDeck',
  'eliteTerrace',
  'arenaContainerPort',
  'arenaOverpass',
  'arenaRooftops',
  'arenaPowerPlant',
  'arenaConstructionSite',
  'arenaRailYard',
  'arenaFloodedDocks',
])(
  '%s: kapsuła FPP chodzi do punktów, po trasach bocznych, rampach i schodach bez skoku',
  async (id) => {
    const room = roomDefinitions.get(id)!;
    // Najniższa podłoga trasy (ulica pod dachami): kapsuła nie może spaść niżej.
    const lowest =
      Math.min(
        room.playerSpawn.y,
        ...room.arena!.points.map((point) => point.position.y),
      ) - 0.1;
    const rapier = await initPhysics();
    const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
    const bus = new EventBus();
    const ctx = { bus, tuning: structuredClone(tuning) };
    for (const block of room.blocks) {
      const r = block.rotation;
      const rotation = new Quaternion().setFromEuler(
        new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0),
      );
      world.createCollider(
        rapier.ColliderDesc.cuboid(
          block.size.x / 2,
          block.size.y / 2,
          block.size.z / 2,
        )
          .setTranslation(block.position.x, block.position.y, block.position.z)
          .setRotation(rotation)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    }
    const height =
      tuning.player.capsuleHeight / 2 + tuning.player.controllerOffset;
    const player = new PlayerController(42, world, ctx, {
      ...room.playerSpawn,
      y: room.playerSpawn.y + height,
    });
    const idle = {
      held: new Set<never>(),
      pressed: new Set<never>(),
      released: new Set<never>(),
      lookDelta: { x: 0, y: 0 },
    };
    const tick = () => {
      player.step(SIM_DT, idle);
      world.step();
    };
    // Wykop budowy schodzi na −8 m; pozostałe areny nie mają niższych poziomów.
    const lowestFloor =
      id === 'arenaConstructionSite'
        ? -8.1
        : id === 'arenaPowerPlant'
          ? -3
          : id === 'arenaOverpass'
            ? -4.1
            : id === 'arenaFloodedDocks'
              ? -1.3 + height
              : id === 'arenaRooftops'
                ? lowest
                : -0.1;
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
        expect(player.getState().position.y).toBeGreaterThan(lowestFloor);
      }
      throw new Error(
        `Kapsuła utknęła: ${JSON.stringify(player.getState().position)} → ${JSON.stringify(goal)}`,
      );
    };
    const teleport = (x: number, z: number, floorY = 0) => {
      player.teleport({ x, y: floorY + height, z });
      for (let i = 0; i < 10; i++) tick();
    };
    try {
      world.step();
      const navigation = new ArenaNavigation(room);
      const walkPoints = () => {
        for (const point of room.arena!.points) {
          const path = navigation.path(
            player.getState().position,
            point.position,
          );
          expect(path.length, point.id).toBeGreaterThan(0);
          for (const waypoint of path) walk(waypoint);
          if (id === 'arenaPowerPlant') for (let i = 0; i < 10; i++) tick();
          if (id === 'arenaRailYard') for (let i = 0; i < 15; i++) tick();
          expect(
            Math.abs(player.getState().position.y - point.position.y - height),
            point.id,
          ).toBeLessThan(id === 'arenaOverpass' ? 0.12 : 0.05);
        }
      };
      const starts =
        id === 'arenaRailYard'
          ? [
              room.playerSpawn,
              room.spawnPoints[0]!,
              room.spawnPoints[10]!,
              room.spawnPoints[22]!,
            ]
          : id === 'arenaFloodedDocks'
            ? [room.playerSpawn, room.spawnPoints[4]!, room.spawnPoints[20]!]
            : [null];
      for (const start of starts) {
        if (start) teleport(start.x, start.z);
        walkPoints();
      }
      if (['combatClinic', 'combatMarketDeck', 'eliteTerrace'].includes(id))
        return;
      if (id === 'arenaPowerPlant') {
        const spawns = arenaSpawnPoints(room);
        for (const index of [17, 28]) {
          const spawn = spawns[index]!;
          teleport(spawn.x, spawn.z, spawn.y);
          walkPoints();
        }
        teleport(-110, -24.25);
        walk({ x: -95, y: 6.2, z: -24.25 });
        walk({ x: -21, y: 6.2, z: -24.25 });
        walk({ x: 96, y: 6.2, z: -24.25 });
        expect(player.getState().position.y).toBeCloseTo(6.2 + height, 1);
        teleport(119, -42);
        walk({ x: 134.6, y: 6.2, z: -42 });
        walk({ x: 135, y: 6.2, z: 72 });
        walk({ x: 149, y: 0, z: 72 });
        for (let i = 0; i < 20; i++) tick();
        expect(player.getState().position.y).toBeCloseTo(height, 1);

        teleport(64.5, -119);
        for (const point of [
          { x: 77.2, y: 3.5, z: -119 },
          { x: 77.1, y: 3.5, z: -116 },
          { x: 62.7, y: 7, z: -116 },
          { x: 62.8, y: 7, z: -113 },
          { x: 77.2, y: 10.5, z: -113 },
          { x: 77.1, y: 10.5, z: -110 },
          { x: 61.9, y: 14, z: -110 },
          { x: 55, y: 14, z: -110 },
        ])
          walk(point);
        expect(player.getState().position.y).toBeCloseTo(14 + height, 1);

        teleport(66, 44);
        walk({ x: 81.8, y: 7, z: 44 });
        expect(player.getState().position.y).toBeGreaterThan(6.5 + height);
        return;
      }
      if (id === 'arenaConstructionSite') {
        const level = (y: number) =>
          expect(player.getState().position.y).toBeCloseTo(y + height, 1);
        // Rusztowanie południowe: dwa biegi po lic do B (8 m), bez skoku.
        teleport(41, 6);
        walk({ x: 39.5, y: 0, z: 11.5 });
        walk({ x: 52.8, y: 4, z: 11.5 });
        level(4);
        walk({ x: 52.8, y: 4, z: 8.5 });
        walk({ x: 39.2, y: 4, z: 8.5 });
        walk({ x: 39.2, y: 4, z: 11.5 });
        walk({ x: 52.8, y: 8, z: 11.5 });
        level(8);
        // Rusztowanie zachodnie (bieg wzdłuż Z) na 4 m.
        teleport(12, -13);
        walk({ x: 8.5, y: 0, z: -13 });
        walk({ x: 8.5, y: 4, z: -26.8 });
        level(4);
        // Stalowe schody wykopu (droga gracza, stopień 0,29 × 0,3 m) z krawędzi na dno.
        teleport(-76, 62);
        walk({ x: -76, y: 0, z: 58.6 });
        walk({ x: -82.6, y: -4, z: 58.6 });
        walk({ x: -83.2, y: -4, z: 56.6 });
        walk({ x: -77, y: -8, z: 56.6 });
        level(-8);
        // Schody biur zaplecza na pomost 2,591 m.
        teleport(66, 49.72);
        walk({ x: 73.5, y: 2.591, z: 49.72 });
        walk({ x: 80, y: 2.591, z: 49.72 });
        level(2.591);
        return;
      }
      if (id === 'arenaRailYard') {
        teleport(-30.25, -50.5);
        walk({ x: -30.25, y: 1.1, z: -45 });
        expect(player.getState().position.y).toBeCloseTo(1.1 + height, 1);
        walk({ x: -30.25, y: 0, z: -39.5 });
        teleport(16, 0);
        walk({ x: 44, y: 4.1, z: 0 });
        expect(player.getState().position.y).toBeCloseTo(4.1 + height, 1);
        walk({ x: 66, y: 4.1, z: 0 });
        walk({ x: 92, y: 0, z: 0 });
        for (const [from, to, z, y] of [
          [-34, 20, -80, 8],
          [-34, 20, 60, 8],
          [48, 114, -76, 10],
          [-192, -160, -56, 5],
        ] as const) {
          teleport(from, z);
          walk({ x: to, y, z });
          expect(player.getState().position.y).toBeCloseTo(y + height, 1);
        }
        return;
      }
      if (id === 'arenaFloodedDocks') {
        for (const z of [39, 62]) {
          teleport(77, z);
          walk({ x: 60, y: 1.2, z });
          walk({ x: 60, y: 1.2, z: 50 });
          expect(player.getState().position.y).toBeCloseTo(1.2 + height, 1);
        }
        teleport(-43, 110);
        for (const x of [-7, 0, 7]) {
          walk({ x, y: 6, z: 110 });
          expect(player.getState().position.y).toBeCloseTo(6 + height, 1);
        }
        walk({ x: 43, y: 0, z: 110 });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        return;
      }
      if (id === 'arenaOverpass') {
        for (const index of [0, 14, 24, 30]) {
          const spawn = room.arena!.spawnPoints![index]!;
          for (const point of room.arena!.points) {
            teleport(spawn.x, spawn.z, spawn.y ?? 0);
            const path = navigation.path(
              player.getState().position,
              point.position,
            );
            expect(path.length).toBeGreaterThan(0);
            for (const waypoint of path) walk(waypoint);
            for (let i = 0; i < 10; i++) tick();
            expect(
              Math.abs(
                player.getState().position.y - point.position.y - height,
              ),
              `${index} → ${point.id}`,
            ).toBeLessThan(0.12);
          }
        }
        for (const [x0, x1, z0, z1] of [
          [-164, -80, 134, 62],
          [164, 72, -156, -60],
        ]) {
          teleport(x0!, z0!);
          walk({ x: x1!, y: 5.8, z: z0! });
          walk({ x: x1! + (x1! > x0! ? 7 : -7), y: 5.8, z: z0! });
          walk({ x: x1! + (x1! > x0! ? 7 : -7), y: 5.8, z: z1! });
          walk({ x: x0!, y: 11.6, z: z1! });
          expect(player.getState().position.y).toBeCloseTo(11.6 + height, 1);
        }
        teleport(-127, 80, -4);
        walk({ x: -108, y: 0, z: 80 });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        return;
      }
      if (id === 'arenaRooftops') {
        const curb = -13.85;
        // Schody Targowe: z chodnika na dach nocnego targu.
        teleport(25, 13, curb);
        walk({ x: 28.5, y: curb, z: 13 });
        walk({ x: 80, y: 0, z: 13 });
        walk({ x: 84, y: 0, z: 20 });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        // Most z desek nad ulicą główną i kładka nad zaułkiem.
        teleport(-32, -16, 0);
        walk({ x: -32, y: 0, z: 16 });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        teleport(-68, 44.5, 0);
        walk({ x: -52, y: 0, z: 44.5 });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        // Schody pożarowe na fasadzie przy ulicy (dwa pasy, cztery biegi).
        teleport(-51.6, -9.4, curb);
        for (const [x, z] of [
          [-46, -9.4],
          [-46, -8.2],
          [-51.4, -8.2],
          [-51.4, -9.4],
          [-46, -9.4],
          [-46, -8.2],
          [-51.4, -8.2],
          [-51.4, -12],
        ] as const)
          walk({ x, y: 0, z });
        expect(player.getState().position.y).toBeCloseTo(height, 1);
        // Schody dachowe 0 → 4 m (z dachu startowego na wschodnie kamienice).
        teleport(-56, 116, 0);
        walk({ x: -30, y: 4, z: 116 });
        expect(player.getState().position.y).toBeCloseTo(4 + height, 1);
        return;
      }
      const point = room.arena!.points.find(({ id }) => id === 'C')!;
      for (const start of [
        room.arena!.spawnPoints![12]!,
        room.arena!.spawnPoints![20]!,
      ]) {
        teleport(start.x, start.z, start.y ?? 0);
        for (const goal of room.arena!.points) {
          const state = player.getState().position;
          const path = navigation.path(
            { ...state, y: state.y - height },
            goal.position,
          );
          expect(path.length).toBeGreaterThan(0);
          for (const waypoint of path) walk(waypoint);
          for (let step = 0; step < 12; step++) tick();
          expect(player.getState().position.y).toBeCloseTo(
            goal.position.y + height,
            1,
          );
        }
      }

      for (const [foot, landing] of [
        [-122, -95],
        [-62, -35],
      ] as const) {
        teleport(foot - 2, 69);
        walk({ x: foot - 2, y: 0, z: 70.9 });
        walk({ x: landing, y: 12, z: 70.9 });
        walk({ x: landing, y: 12, z: 73.4 });
        expect(player.getState().position.y).toBeCloseTo(12 + height, 1);
        const approach =
          landing === -95
            ? [
                { x: -84, z: 73.4 },
                { x: -84, z: 78 },
                { x: -75, z: 78 },
                { x: -65, z: 78 },
              ]
            : [
                { x: -55, z: 73.4 },
                { x: -53, z: 77 },
                { x: -65, z: 77 },
              ];
        for (const pos of approach) walk({ ...pos, y: 12.8 });
        walk(point.position);
        expect(player.getState().position.y).toBeCloseTo(12.8 + height, 1);
      }
      teleport(-78, 41);
      for (const waypoint of [
        { x: -63.5, y: 3, z: 41 },
        { x: -63.5, y: 3, z: 45 },
        { x: -77.5, y: 6, z: 45 },
        { x: -77.5, y: 6, z: 49 },
        { x: -63.5, y: 9, z: 49 },
        { x: -63.5, y: 9, z: 53 },
        { x: -77.5, y: 12, z: 53 },
        { x: -77.5, y: 12, z: 57 },
        { x: -66, y: 12.8, z: 57 },
        { x: -65, y: 12.8, z: 79 },
        point.position,
      ])
        walk(waypoint);
      expect(player.getState().position.y).toBeCloseTo(12.8 + height, 1);

      teleport(-45.8, 77, 3);
      walk({ x: -45.8, y: 3, z: 76.1 });
      walk({ x: -29, y: 12, z: 76.1 });
      walk({ x: -29, y: 12, z: 74 });
      expect(player.getState().position.y).toBeCloseTo(12 + height, 1);

      const roofZ = 17.819;
      teleport(-140, roofZ);
      walk({ x: -111, y: 5.182, z: roofZ });
      expect(player.getState().position.y).toBeCloseTo(5.182 + height, 1);
      walk({ x: -46, y: 5.182, z: roofZ });
      walk({ x: 31, y: 7.773, z: roofZ });
      expect(player.getState().position.y).toBeCloseTo(7.773 + height, 1);
      walk({ x: 31, y: 7.773, z: 15 });
      walk({ x: 57, y: 0, z: 15 });
      expect(player.getState().position.y).toBeCloseTo(height, 1);
    } finally {
      player.dispose();
      world.free();
    }
  },
  60_000,
);
