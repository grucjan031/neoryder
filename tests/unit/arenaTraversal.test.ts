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
  'arenaContainerPort',
  'arenaOverpass',
  'arenaRooftops',
  'arenaPowerPlant',
  'arenaConstructionSite',
])(
  '%s: kapsuła FPP chodzi do punktów, po trasach bocznych, rampach i schodach bez skoku',
  async (id) => {
    const room = roomDefinitions.get(id)!;
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
          expect(player.getState().position.y).toBeCloseTo(
            point.position.y + height,
            1,
          );
        }
      };
      walkPoints();
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
      if (id === 'arenaOverpass') {
        for (const z of [-24, 24]) {
          teleport(33, z);
          walk({ x: -12, y: 11.6, z });
          expect(player.getState().position.y).toBeCloseTo(11.6 + height, 1);
        }
        return;
      }
      if (id === 'arenaRooftops') {
        teleport(38, -14, 2);
        walk({ x: 38, y: 6, z: -4.1 });
        walk({ x: 38, y: 6, z: 6 });
        expect(player.getState().position.y).toBeCloseTo(6 + height, 1);
        teleport(42, 24, 6);
        for (let i = 0; i < 120; i++) {
          player.step(SIM_DT, {
            ...idle,
            held: new Set(['moveRight']),
            lookDelta: {
              x: player.getState().yaw / tuning.player.lookSensitivity,
              y: 0,
            },
          });
          world.step();
        }
        expect(Math.abs(player.getState().position.x)).toBeLessThan(45);
        expect(player.getState().position.y).toBeGreaterThan(6);
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
  30_000,
);
