import { expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { DamageSystem, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { EnemyManager } from '../../src/enemies/manager';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

it.each(['assaulter', 'gunner'])(
  'port: %s dociera ze wszystkich spawnów do A/B/C',
  async (kind) => {
    const room = roomDefinitions.get('arenaContainerPort')!;
    const rapier = await initPhysics();
    const bus = new EventBus();
    const entities = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, entities);
    const hurtboxes = new Hurtboxes();
    const world = new rapier.World({ x: 0, y: tuning.physics.gravity, z: 0 });
    for (const b of room.blocks) {
      const r = b.rotation;
      world.createCollider(
        rapier.ColliderDesc.cuboid(b.size.x / 2, b.size.y / 2, b.size.z / 2)
          .setTranslation(b.position.x, b.position.y, b.position.z)
          .setRotation(
            new Quaternion().setFromEuler(
              new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0),
            ),
          )
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    }
    const projectiles = new ProjectileSystem(
      world,
      entities,
      hurtboxes,
      damage,
      bus,
      tuning,
    );
    const target = {
      id: entities.create('player', 'player'),
      position: { x: 200, y: 1, z: 200 },
    };
    const manager = new EnemyManager(
      { bus, rng: new Rng('port-ai'), tuning },
      {
        world,
        entities,
        damage,
        hurtboxes,
        projectiles,
        getTarget: () => target,
      },
    );
    const navigation = new ArenaNavigation(room);
    world.step();
    try {
      for (const spawn of room.spawnPoints) {
        for (const point of room.arena!.points) {
          const enemy = manager.spawn(kind, { ...spawn, y: 0 });
          let arrived = false;
          for (let i = 0; i < 7200; i++) {
            if (
              Math.hypot(
                enemy.current.position.x - point.position.x,
                enemy.current.position.z - point.position.z,
              ) < point.radiusM
            ) {
              arrived = true;
              break;
            }
            enemy.moveGoal = navigation.next(
              enemy.current.position,
              point.position,
            );
            manager.step(SIM_DT);
            world.step();
          }
          expect(
            arrived,
            `${kind}: ${JSON.stringify(spawn)} → ${point.id}, pozycja ${JSON.stringify(enemy.current.position)}`,
          ).toBe(true);
          enemy.dispose();
        }
      }
    } finally {
      manager.dispose();
      projectiles.dispose();
      world.free();
    }
  },
);
