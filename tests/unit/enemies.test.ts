import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { ProjectileRenderer } from '../../src/render/projectileRenderer';
import { getMaterial } from '../../src/render/materials';
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
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import gunnerRaw from '../../src/data/enemies/gunner.json';
import raw from '../../src/data/enemies/assaulter.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function setup(seed = 'enemies', targetZ = 1.5, kind = 'assaulter') {
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
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const deps = {
    world,
    entities,
    damage,
    hurtboxes,
    projectiles,
    getTarget: () => target,
  };
  const manager = new EnemyManager(ctx, deps);
  world.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    world.free();
  });
  const steps = (n = 1, dt = SIM_DT): void => {
    for (let i = 0; i < n; i++) {
      damage.step(dt);
      manager.step(dt);
      if (dt > 0) {
        world.timestep = dt;
        world.step();
        projectiles.step(dt);
      }
    }
  };
  const moveTarget = (z: number, x = 0): void => {
    target = { id: player, position: { x, y: 0.9, z } };
    playerBody.setTranslation(target.position, true);
    playerBody.setNextKinematicTranslation(target.position);
    world.step();
  };
  const enemy = manager.spawn(kind, { x: 0, y: 0, z: 0 });
  world.step();
  return {
    bus,
    projectiles,
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

describe('Strzelec — prawdziwy Rapier i ProjectileSystem', () => {
  it('validates ranged fields without changing assaulter data', () => {
    expect(enemySchema.parse(raw)).toEqual(raw);
    expect(enemySchema.parse(gunnerRaw)).toMatchObject({
      maxHealth: 45,
      moveSpeed: 3.4,
      projectileSpeed: 11,
      projectileDamage: 12,
      burstCount: 3,
    });
    expect(availableEnemyIds()).toContain('gunner');
    for (const patch of [
      { projectileSpeed: 0 },
      { burstCount: 1.5 },
      { aimTelegraphS: 0 },
      { projectileLifetimeS: -1 },
      { spreadDeg: -1 },
      { preferredRange: undefined },
      { losRequired: undefined },
      { rangeTolerance: 10 },
      { body: undefined },
    ])
      expect(enemySchema.safeParse({ ...gunnerRaw, ...patch }).success).toBe(
        false,
      );
  });

  it.each([2, 18])(
    'moves from %s m into the 7–11 m band with seeded strafe',
    (range) => {
      const f = setup('range', range, 'gunner');
      f.steps(20);
      expect(f.enemy.current.position.z * (range < 7 ? -1 : 1)).toBeGreaterThan(
        0.5,
      );
      expect(Math.abs(f.enemy.current.position.x)).toBeGreaterThan(0);
      for (let i = 0; i < 300 && f.enemy.current.state !== 'aim'; i++)
        f.steps();
      const p = f.enemy.current.position;
      const distance = Math.hypot(p.x, p.z - range);
      expect(f.enemy.current.state).toBe('aim');
      expect(distance).toBeGreaterThanOrEqual(7 - 1e-5);
      expect(distance).toBeLessThanOrEqual(11 + 1e-5);
    },
  );

  it('waits a full aim telegraph, fires exactly three shots at the current target and cools down', () => {
    const f = setup('burst', 9, 'gunner');
    const telegraph = vi.fn();
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    f.bus.on('enemy_telegraph', telegraph);
    f.steps();
    expect(telegraph).toHaveBeenCalledExactlyOnceWith({
      id: f.enemy.id,
      kind: 'aim',
      durationS: 0.5,
    });
    const pos = { ...f.enemy.current.position };
    f.steps(29);
    expect(f.enemy.current.state).toBe('aim');
    expect(spawn).not.toHaveBeenCalled();
    expect(f.enemy.current.position.x).toBeCloseTo(pos.x);
    expect(f.enemy.current.position.z).toBeCloseTo(pos.z);
    f.steps();
    expect(spawn).toHaveBeenCalledTimes(1);
    const before = structuredClone(f.enemy.current);
    f.steps(50, 0);
    expect(f.enemy.current).toEqual(before);
    expect(spawn).toHaveBeenCalledTimes(1);
    f.moveTarget(10.5, 2);
    f.steps(26);
    expect(spawn).toHaveBeenCalledTimes(2);
    f.steps();
    expect(spawn).toHaveBeenCalledTimes(3);
    for (const [spec] of spawn.mock.calls)
      expect(spec).toMatchObject({
        owner: f.enemy.id,
        team: 'enemy',
        speed: 11,
        damage: 12,
        lifetimeS: 4,
        tags: ['#gun'],
      });
    expect(spawn.mock.calls[1]?.[0].dir).not.toEqual(
      spawn.mock.calls[0]?.[0].dir,
    );
    const second = spawn.mock.calls[1]![0];
    const expectedYaw = Math.atan2(2 - second.origin.x, 10.5 - second.origin.z);
    const expectedPitch = Math.atan2(
      0.9 - second.origin.y,
      Math.hypot(2 - second.origin.x, 10.5 - second.origin.z),
    );
    expect(
      Math.abs(Math.atan2(second.dir.x, second.dir.z) - expectedYaw),
    ).toBeLessThanOrEqual((gunnerRaw.spreadDeg * Math.PI) / 180);
    expect(
      Math.abs(Math.asin(second.dir.y) - expectedPitch),
    ).toBeLessThanOrEqual((gunnerRaw.spreadDeg * Math.PI) / 180);
    expect(f.enemy.current.state).toBe('cooldown');
    f.steps(95);
    expect(f.enemy.current.state).toBe('cooldown');
    expect(spawn).toHaveBeenCalledTimes(3);
    f.steps();
    expect(f.enemy.current.state).toBe('reposition');
  });

  it('does not shoot through World and interrupts aim when LOS is lost', () => {
    const f = setup('wall', 9, 'gunner');
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    f.steps();
    expect(f.enemy.current.state).toBe('aim');
    f.world.createCollider(
      ColliderDesc.cuboid(20, 3, 0.25)
        .setTranslation(0, 3, 4)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    f.world.step();
    f.steps(240);
    expect(f.enemy.current.state).toBe('reposition');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('moves a slow projectile at 11 m/s and deals exactly projectileDamage to the player', () => {
    const f = setup('damage', 9, 'gunner');
    const dealt = vi.fn();
    f.bus.on('damage_dealt', dealt);
    f.steps(31);
    let first: { x: number; y: number; z: number } | undefined;
    f.projectiles.forEachActive((_id, pos) => {
      first = { ...pos };
    });
    expect(first).toBeDefined();
    f.steps();
    f.projectiles.forEachActive((_id, pos) => {
      expect(
        Math.hypot(pos.x - first!.x, pos.y - first!.y, pos.z - first!.z),
      ).toBeCloseTo(11 * SIM_DT);
    });
    for (let i = 0; i < 90 && dealt.mock.calls.length === 0; i++) f.steps();
    expect(dealt.mock.calls[0]?.[0]).toMatchObject({
      source: f.enemy.id,
      target: f.player,
      amount: gunnerRaw.projectileDamage,
      tags: ['#gun'],
    });
    expect(f.health.current).toBe(10000 - gunnerRaw.projectileDamage);
  });

  it('reflects an enemy shot back into its owner using the shared ProjectileSystem', () => {
    const f = setup('reflect', 9, 'gunner');
    f.steps(40);
    let reflected = false;
    f.projectiles.forEachActive((id, pos) => {
      if (reflected) return;
      reflected = true;
      f.projectiles.reflect(id, f.player, 'player', {
        x: f.enemy.current.position.x - pos.x,
        y: f.enemy.current.position.y + 1.05 - pos.y,
        z: f.enemy.current.position.z - pos.z,
      });
    });
    expect(reflected).toBe(true);
    f.steps(30);
    expect(f.damage.health(f.enemy.id)?.current).toBe(45 - 12);
  });

  it('cancels a burst on stun, does not shoot while stunned and cleans up after death', () => {
    const f = setup('stun', 9, 'gunner');
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    f.steps(31);
    expect(spawn).toHaveBeenCalledTimes(1);
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1,
      tags: [PIERCE_BLOCK_TAG],
    });
    f.steps(35);
    expect(f.enemy.current.state).toBe('stunned');
    expect(spawn).toHaveBeenCalledTimes(1);
    f.damage.deal(f.enemy.id, {
      source: f.player,
      amount: 1000,
      tags: ['#debug'],
    });
    f.steps(30);
    expect(f.enemy.removed).toBe(true);
    expect(f.entities.alive(f.enemy.id)).toBe(false);
    expect(f.damage.health(f.enemy.id)).toBeUndefined();
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it('reproduces positions, bursts and spread with the same seed', () => {
    const run = (seed: string) => {
      const f = setup(seed, 15, 'gunner');
      const trace: unknown[] = [];
      const spawn = vi.spyOn(f.projectiles, 'spawn');
      for (let i = 0; i < 360; i++) {
        f.steps();
        trace.push(structuredClone(f.enemy.current));
      }
      expect(spawn.mock.calls.length).toBeGreaterThan(3);
      return { trace, shots: spawn.mock.calls.map(([spec]) => spec) };
    };
    const a = run('same');
    expect(a).toEqual(run('same'));
    expect(a).not.toEqual(run('other'));
  });

  it('renders interpolated enemy shots with glow, flight orientation and larger instances, then changes team on reflect', () => {
    const f = setup('render', 9, 'gunner');
    const renderer = new ProjectileRenderer(f.projectiles, 4, false);
    cleanup.unshift(() => renderer.dispose());
    const id = f.projectiles.spawn({
      owner: f.enemy.id,
      team: 'enemy',
      origin: { x: 5, y: 2, z: 0 },
      dir: { x: 1, y: 0, z: 0 },
      speed: 11,
      damage: 12,
      tags: ['#gun'],
    });
    renderer.capturePrevious();
    f.projectiles.step(SIM_DT);
    renderer.render(0.5);
    const meshes = renderer.root.children.filter(
      (node): node is InstancedMesh => node instanceof InstancedMesh,
    );
    const enemy = meshes.find(
      (mesh) => mesh.material === getMaterial('enemyGlow'),
    )!;
    const player = meshes.find(
      (mesh) => mesh.material === getMaterial('player'),
    )!;
    expect(enemy.count).toBe(1);
    expect(player.count).toBe(0);
    const matrix = new Matrix4(),
      position = new Vector3(),
      rotation = new Quaternion(),
      scale = new Vector3();
    enemy.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(position.x).toBeCloseTo(5 + (11 * SIM_DT) / 2);
    expect(scale.x).toBeCloseTo(1.6);
    expect(new Vector3(0, 0, 1).applyQuaternion(rotation).x).toBeCloseTo(1);
    f.projectiles.reflect(id, f.player, 'player', { x: -1, y: 0, z: 0 });
    renderer.render(1);
    expect(enemy.count).toBe(0);
    expect(player.count).toBe(1);
    player.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(scale.x).toBeCloseTo(1);
  });
});
