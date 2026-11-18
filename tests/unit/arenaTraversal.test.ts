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
import { roomDefinitions } from '../../src/world/rooms';

it.each(['arenaContainerPort', 'arenaOverpass', 'arenaRooftops'])(
  '%s: kapsuła FPP chodzi do wszystkich punktów, po rampach i schodach bez skoku',
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
        expect(player.getState().position.y).toBeGreaterThan(lowest);
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
      for (const point of room.arena!.points) {
        const path = navigation.path(
          player.getState().position,
          point.position,
        );
        expect(path.length).toBeGreaterThan(0);
        for (const waypoint of path) walk(waypoint);
        expect(player.getState().position.y).toBeCloseTo(
          point.position.y + height,
          1,
        );
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
      teleport(-46, -14);
      const roof = 2 * 2.591;
      walk({ x: -28, y: roof, z: -14 });
      expect(player.getState().position.y).toBeCloseTo(roof + height, 1);
      walk({ x: -24, y: roof, z: -14 });
      for (const z of [-10.75, -7.5, -4.25, -0.5]) {
        walk({ x: -24, y: roof, z });
        const deck = z < -1 ? 0.1 : 0;
        expect(player.getState().position.y).toBeCloseTo(
          roof + deck + height,
          1,
        );
      }
      teleport(-4, 8);
      walk({ x: -20, y: 2.591, z: 8 });
      expect(player.getState().position.y).toBeCloseTo(2.591 + height, 1);
      teleport(22, -3);
      walk({ x: 22, y: 2.591, z: -15 });
      expect(player.getState().position.y).toBeCloseTo(2.591 + height, 1);
      walk({ x: 35, y: roof, z: -15 });
      walk({ x: 32, y: roof, z: -23 });
      expect(player.getState().position.y).toBeCloseTo(roof + height, 1);
    } finally {
      player.dispose();
      world.free();
    }
  },
);
