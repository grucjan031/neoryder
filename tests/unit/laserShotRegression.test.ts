import { beforeAll, expect, it } from 'vitest';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import sniper from '../../src/data/enemies/sniper.json';

let R: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  R = await initPhysics();
});

it.each([sniper])(
  '$id: laser zapowiada pocisk co najmniej 120 m/s',
  (definition) => {
    expect(definition.laserSight).toBe(true);
    expect(definition.projectileSpeed).toBeGreaterThanOrEqual(120);
  },
);

it.each([120, 480])(
  'pocisk %i m/s trafia także między klatkami, a ostrze odbija go w strzelca',
  (speed) => {
    const bus = new EventBus();
    const world = new R.World({ x: 0, y: 0, z: 0 });
    const entities = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, entities);
    const hurtboxes = new Hurtboxes();
    const projectiles = new ProjectileSystem(
      world,
      entities,
      hurtboxes,
      damage,
      bus,
      tuning,
    );
    const add = (team: 'player' | 'enemy', z: number) => {
      const id = entities.create(team, team);
      const hp = new Health(() => 100);
      damage.register(id, hp);
      const collider = world.createCollider(
        R.ColliderDesc.ball(0.1)
          .setTranslation(0, 1, z)
          .setCollisionGroups(
            interactionGroups(
              team === 'player' ? CollisionGroup.Player : CollisionGroup.Enemy,
              0xffff,
            ),
          ),
      );
      hurtboxes.add(id, collider);
      entities.bindCollider(id, collider.handle);
      return { id, hp };
    };
    const player = add('player', 0);
    const shooter = add('enemy', -1.5);
    world.step();
    const blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner: player.id,
        team: 'player',
        damage,
        stats: new Stats({}),
        energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
        queryArc: () => [],
        projectiles,
        aim: () => ({
          origin: { x: 0, y: 1, z: 0 },
          dir: { x: 0, y: 0, z: -1 },
        }),
      },
      bus,
      tuning,
    );
    const fire = () =>
      projectiles.spawn({
        owner: shooter.id,
        team: 'enemy',
        origin: { x: 0, y: 1, z: -0.8 },
        dir: { x: 0, y: 0, z: 1 },
        speed,
        damage: sniper.projectileDamage,
        tags: sniper.projectileTags,
      });
    try {
      fire();
      projectiles.step(SIM_DT);
      expect(player.hp.current).toBe(70);
      expect(projectiles.activeCount).toBe(0);
      projectiles.addInterceptor(blade.interceptProjectile);
      blade.step(SIM_DT, {
        held: new Set(['block']),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
      fire();
      projectiles.step(SIM_DT);
      expect(player.hp.current).toBe(70);
      expect(projectiles.activeCount).toBe(1);
      projectiles.step(SIM_DT);
      expect(shooter.hp.current).toBeCloseTo(
        100 - sniper.projectileDamage * tuning.melee.parryDamageMult,
      );
      expect(projectiles.activeCount).toBe(0);
      // Cienka ściana także leży pomiędzy początkiem a końcem kroku.
      world.createCollider(
        R.ColliderDesc.cuboid(1, 1, 0.01)
          .setTranslation(0, 1, -0.5)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      world.step();
      fire();
      projectiles.step(SIM_DT);
      expect(player.hp.current).toBe(70);
      expect(projectiles.activeCount).toBe(0);
    } finally {
      blade.dispose();
      projectiles.dispose();
      world.free();
    }
  },
);
