import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import {
  DamageSystem,
  Health,
  Hurtboxes,
  PIERCE_BLOCK_TAG,
  queryHurtboxes,
} from '../../src/combat/damage';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { enemySchema } from '../../src/enemies/enemySchema';
import { EnemyManager } from '../../src/enemies/manager';
import {
  availableEnemyIds,
  createEnemy,
  enemyDefinitions,
} from '../../src/enemies/registry';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import raw from '../../src/data/enemies/assaulter.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function setup(seed = 'enemies', targetZ = 1.5) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const settings = structuredClone(tuning);
  const ctx = { bus, rng: new Rng(seed), tuning: settings };
  const world = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  world.createCollider(
    ColliderDesc.cuboid(30, 0.5, 30)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = entities.create('player', 'player');
  const playerBody = world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, targetZ),
  );
  const playerCollider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    playerBody,
  );
  hurtboxes.add(player, playerCollider);
  entities.bindCollider(player, playerCollider.handle);
  const health = new Health(() => 10000);
  damage.register(player, health);
  let target: {
    id: number;
    position: { x: number; y: number; z: number };
  } | null = { id: player, position: { x: 0, y: 0.9, z: targetZ } };
  const deps = { world, entities, damage, hurtboxes, getTarget: () => target };
  const manager = new EnemyManager(ctx, deps);
  world.step();
  cleanup.push(() => {
    manager.dispose();
    world.free();
  });
  const steps = (n = 1, dt = SIM_DT): void => {
    for (let i = 0; i < n; i++) {
      damage.step(dt);
      manager.step(dt);
      if (dt > 0) {
        world.timestep = dt;
        world.step();
      }
    }
  };
  const moveTarget = (z: number): void => {
    target = { id: player, position: { x: 0, y: 0.9, z } };
    playerBody.setTranslation(target.position, true);
    playerBody.setNextKinematicTranslation(target.position);
    world.step();
  };
  const enemy = manager.spawn('assaulter', { x: 0, y: 0, z: 0 });
  world.step();
  return {
    bus,
    entities,
    damage,
    hurtboxes,
    settings,
    world,
    ctx,
    deps,
    player,
    playerCollider,
    health,
    manager,
    enemy,
    steps,
    moveTarget,
    removeTarget: () => {
      target = null;
    },
  };
}

describe('Szturmowiec — prawdziwy Rapier', () => {
  it('validates data and exposes a factory per archetype', () => {
    expect(enemySchema.parse(raw)).toMatchObject({
      maxHealth: 60,
      moveSpeed: 4.2,
      damage: 15,
    });
    for (const patch of [
      { maxHealth: 0 },
      { moveSpeed: -1 },
      { knockbackResist: 1.1 },
      { telegraphS: 0 },
      { damage: Infinity },
      { id: '' },
    ])
      expect(enemySchema.safeParse({ ...raw, ...patch }).success).toBe(false);
    expect(availableEnemyIds()).toContain('assaulter');
    expect(enemyDefinitions.get('assaulter')?.kind).toBe('assaulter');
    const f = setup();
    expect(() =>
      createEnemy(f.ctx, f.deps, 'missing', { x: 0, y: 0, z: 0 }),
    ).toThrow();
  });

  it('registers torso/head hurtboxes and health, chases and stops in attack range', () => {
    const f = setup('chase', 8);
    const boxes = queryHurtboxes(
      f.world,
      f.hurtboxes,
      new rapier.Ball(0.1),
      { x: 0, y: 1.65, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      interactionGroups(CollisionGroup.Player, CollisionGroup.Enemy),
    );
    expect(boxes).toEqual([
      expect.objectContaining({ entity: f.enemy.id, multiplier: 1.5 }),
    ]);
    expect(f.damage.health(f.enemy.id)?.current).toBe(60);
    expect(f.entities.kind(f.enemy.id)).toBe('assaulter');
    f.steps(30);
    expect(f.enemy.current.position.z).toBeGreaterThan(1);
    for (let i = 0; i < 180 && f.enemy.current.state !== 'telegraph'; i++)
      f.steps();
    expect(f.enemy.current.state).toBe('telegraph');
    const position = { ...f.enemy.current.position };
    expect(8 - position.z).toBeCloseTo(raw.attackRange, 3);
    f.steps(10);
    expect(f.enemy.current.position.z).toBeCloseTo(position.z, 5);
    expect(f.enemy.current.position.y).toBeGreaterThanOrEqual(0);
  });

  it('telegraphs for telegraphS before damage, hits only once per swing and can hit on the next swing', () => {
    const f = setup();
    const telegraph = vi.fn();
    const dealt = vi.fn();
    f.bus.on('enemy_telegraph', telegraph);
    f.bus.on('damage_dealt', dealt);
    f.steps();
    expect(telegraph).toHaveBeenCalledExactlyOnceWith({
      id: f.enemy.id,
      kind: 'swing',
      durationS: raw.telegraphS,
    });
    f.steps(Math.round(raw.telegraphS / SIM_DT) - 1);
    expect(dealt).not.toHaveBeenCalled();
    expect(f.enemy.current.state).toBe('telegraph');
    f.steps();
    expect(f.enemy.current.state).toBe('swing');
    expect(dealt).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        source: f.enemy.id,
        target: f.player,
        amount: 15,
        tags: ['#melee'],
      }),
    );
    f.steps(Math.ceil(raw.swingActiveS / SIM_DT));
    expect(dealt).toHaveBeenCalledOnce();
    f.steps(120);
    expect(dealt.mock.calls.length).toBeGreaterThan(1);
  });

  it('swings into empty space when the player leaves during telegraph', () => {
    const f = setup();
    const dealt = vi.fn();
    f.bus.on('damage_dealt', dealt);
    f.steps();
    // Hurtbox gracza nadal przecina prostopadłościan ciosu, ale środek celu jest poza zasięgiem.
    f.moveTarget(raw.attackRange + 0.1);
    f.steps(
      Math.round(raw.telegraphS / SIM_DT) +
        Math.ceil(raw.swingActiveS / SIM_DT),
    );
    expect(dealt).not.toHaveBeenCalled();
  });

  it('freezes AI and physics decisions at dt=0', () => {
    const f = setup('freeze', 8);
    f.steps(5);
    const before = structuredClone(f.enemy.current);
    f.steps(100, 0);
    expect(f.enemy.current).toEqual(before);
    expect(f.enemy.previous).toEqual(before);
  });

  it('knocks back, interrupts telegraph on heavy and does not attack while stunned', () => {
    const f = setup();
    const stunned = vi.fn();
    const dealt = vi.fn();
    f.bus.on('enemy_stunned', stunned);
    f.bus.on('damage_dealt', dealt);
    f.steps();
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1,
      tags: [PIERCE_BLOCK_TAG],
      dir: { x: 0, y: 0, z: -1 },
      knockback: 8,
    });
    expect(stunned).toHaveBeenCalledExactlyOnceWith({
      id: f.enemy.id,
      durationS: raw.stunOnHeavyS,
    });
    expect(f.enemy.current.state).toBe('stunned');
    f.steps(Math.round(raw.stunOnHeavyS / SIM_DT) - 1);
    expect(f.enemy.current.state).toBe('stunned');
    expect(f.enemy.current.position.z).toBeLessThan(-0.5);
    expect(
      dealt.mock.calls.filter(([event]) => event.source === f.enemy.id),
    ).toHaveLength(0);
    f.steps();
    expect(f.enemy.current.state).toBe('chase');
  });

  it('uses knockback threshold without heavy, resolves null dir from known attacker and ignores unknown direction', () => {
    const f = setup();
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1,
      tags: [],
      knockback: f.settings.enemies.stunKnockback,
    });
    expect(f.enemy.current.state).toBe('stunned');
    f.steps(3);
    expect(f.enemy.current.position.z).toBeLessThan(0);
    const other = f.manager.spawn('assaulter', { x: 4, y: 0, z: 0 });
    f.world.step();
    f.damage.deal(other.id, {
      source: null,
      amount: 1,
      tags: [],
      knockback: 8,
    });
    f.steps(5);
    expect(other.current.position.x).toBeCloseTo(4, 5);
    expect(other.current.position.z).toBeCloseTo(0, 5);
  });

  it('kills once and removes body, hurtboxes, damage registration and entity after corpseS', () => {
    const f = setup();
    const killed = vi.fn();
    f.bus.on('enemy_killed', killed);
    const bodies = f.world.bodies.len();
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1000,
      tags: ['#debug'],
    });
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1000,
      tags: ['#debug'],
    });
    expect(killed).toHaveBeenCalledOnce();
    expect(f.enemy.current.state).toBe('dead');
    f.steps(Math.round(f.settings.enemies.corpseS / SIM_DT) - 1);
    expect(f.entities.alive(f.enemy.id)).toBe(true);
    f.steps();
    expect(f.enemy.removed).toBe(true);
    expect(f.entities.alive(f.enemy.id)).toBe(false);
    expect(f.damage.health(f.enemy.id)).toBeUndefined();
    expect(f.world.bodies.len()).toBe(bodies - 1);
    const remaining: number[] = [];
    f.manager.forEach((enemy) => remaining.push(enemy.id));
    expect(remaining).toEqual([]);
  });

  it('separates neighbors and despawns idempotently', () => {
    const f = setup();
    f.removeTarget();
    const other = f.manager.spawn('assaulter', { x: 0.65, y: 0, z: 0 });
    f.world.step();
    f.steps(120);
    expect(
      Math.hypot(
        other.current.position.x - f.enemy.current.position.x,
        other.current.position.z - f.enemy.current.position.z,
      ),
    ).toBeGreaterThan(0.9);
    f.manager.despawnAll();
    f.manager.dispose();
    expect(f.entities.alive(other.id)).toBe(false);
    expect(f.entities.alive(f.enemy.id)).toBe(false);
  });

  it('separates coincident spawns even while telegraphing', () => {
    const f = setup();
    const other = f.manager.spawn('assaulter', { x: 0, y: 0, z: 0 });
    f.world.step();
    f.steps(120);
    expect(
      Math.hypot(
        other.current.position.x - f.enemy.current.position.x,
        other.current.position.z - f.enemy.current.position.z,
      ),
    ).toBeGreaterThan(0.6);
  });

  it('uses seeded wall avoidance and produces identical snapshots for identical seeds', () => {
    const run = (seed: string) => {
      const f = setup(seed, 12);
      f.world.createCollider(
        ColliderDesc.cuboid(0.6, 2, 0.3)
          .setTranslation(0, 2, 3)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      f.world.step();
      const positions = [];
      for (let i = 0; i < 240; i++) {
        f.steps();
        positions.push(structuredClone(f.enemy.current));
      }
      expect(positions.some((s) => Math.abs(s.position.x) > 0.5)).toBe(true);
      expect(f.enemy.current.position.z).toBeGreaterThan(3.5);
      return positions;
    };
    expect(run('same-seed')).toEqual(run('same-seed'));
  });
});
