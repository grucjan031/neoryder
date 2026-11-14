import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { BoxGeometry, Group, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import type { DamageInfo } from '../../src/combat/damage';
import { StatusSystem } from '../../src/combat/status/statusSystem';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { Assaulter } from '../../src/enemies/assaulter';
import { enemySchema } from '../../src/enemies/enemySchema';
import { EnemyView } from '../../src/enemies/enemyView';
import { EnemyManager } from '../../src/enemies/manager';
import { availableEnemyIds } from '../../src/enemies/registry';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { getMaterial } from '../../src/render/materials';
import shielderRaw from '../../src/data/enemies/shielder.json';
import executorRaw from '../../src/data/enemies/executor.json';
import aiTestRaw from '../../src/data/scenes/aiTest.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  vi.restoreAllMocks();
});

function setup(kind = 'shielder', director = false) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const settings = structuredClone(tuning);
  const world = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  world.createCollider(
    ColliderDesc.cuboid(30, 0.5, 30)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = entities.create('player', 'player');
  const body = world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 1.5),
  );
  const collider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  entities.bindCollider(player, collider.handle);
  hurtboxes.add(player, collider);
  damage.register(player, new Health(() => 10000));
  let target: {
    id: number;
    position: { x: number; y: number; z: number };
  } | null = {
    id: player,
    position: { x: 0, y: 0.9, z: 1.5 },
  };
  const statuses = new StatusSystem(bus, damage, {
    position: () => null,
    targets: () => [],
  });
  const manager = new EnemyManager(
    { bus, rng: new Rng('f2-14'), tuning: settings },
    {
      world,
      entities,
      damage,
      hurtboxes,
      statuses,
      getTarget: () => target,
    },
    director ? { director: { ...aiTestRaw.director, attackTokens: 1 } } : {},
  );
  const enemy = manager.spawn(kind, { x: 0, y: 0, z: 0 });
  world.step();
  cleanup.push(() => {
    manager.dispose();
    statuses.dispose();
    world.free();
  });
  const step = (n = 1, dt = SIM_DT) => {
    for (let i = 0; i < n; i++) {
      damage.step(dt);
      statuses.step(dt);
      manager.step(dt);
      if (dt > 0) {
        world.timestep = dt;
        world.step();
      }
    }
  };
  const hit = (
    tags = ['#melee'],
    dir: DamageInfo['dir'] = { x: 0, y: 0, z: -1 },
  ) =>
    damage.deal(enemy.id, {
      amount: 10,
      source: player,
      tags,
      ...(dir ? { dir } : {}),
    });
  return {
    bus,
    damage,
    statuses,
    manager,
    enemy,
    player,
    step,
    hit,
    removeTarget: () => {
      target = null;
    },
    restoreTarget: () => {
      target = { id: player, position: { x: 0, y: 0.9, z: 1.5 } };
    },
  };
}

describe('F2-14 — dane i rejestr', () => {
  it('validates both variants, defense fields and data-driven weapon proportions', () => {
    expect(availableEnemyIds()).toEqual(
      expect.arrayContaining(['shielder', 'executor']),
    );
    expect(enemySchema.parse(shielderRaw).shield).toEqual(shielderRaw.shield);
    expect(enemySchema.parse(executorRaw).attackTags).toEqual([
      '#melee',
      '#heavy',
    ]);
    for (const shield of [
      { ...shielderRaw.shield, arcDeg: 361 },
      { ...shielderRaw.shield, downS: 0 },
      { ...shielderRaw.shield, blocksTags: ['gun'] },
    ])
      expect(enemySchema.safeParse({ ...shielderRaw, shield }).success).toBe(
        false,
      );
    expect(
      enemySchema.safeParse({ ...executorRaw, parry: { cooldownS: -1 } })
        .success,
    ).toBe(false);
    expect(
      enemySchema.safeParse({ ...executorRaw, attackTags: ['melee'] }).success,
    ).toBe(false);
    expect(
      enemySchema.safeParse({
        ...executorRaw,
        animation: {
          ...executorRaw.animation,
          bladeSizeM: { x: 0, y: 1, z: 1 },
        },
      }).success,
    ).toBe(false);
    expect(setup().enemy).toBeInstanceOf(Assaulter);
    expect(setup('executor').enemy).toBeInstanceOf(Assaulter);
  });
});

describe('Tarczownik — prawdziwy Rapier', () => {
  it.each(['#gun', '#melee'])(
    'blocks frontal %s without damage and reports the blocked amount',
    (tag) => {
      const f = setup();
      const blocked = vi.fn();
      const dealt = vi.fn();
      f.bus.on('melee_blocked', blocked);
      f.bus.on('damage_dealt', dealt);
      expect(f.hit([tag])).toBe(0);
      expect(f.damage.health(f.enemy.id)?.current).toBe(90);
      expect(blocked).toHaveBeenCalledExactlyOnceWith({
        defender: f.enemy.id,
        attacker: f.player,
        amount: 10,
      });
      expect(dealt).not.toHaveBeenCalled();
      expect(f.enemy.current.shieldUp).toBe(true);
    },
  );

  it.each([
    { x: 0, y: 0, z: 1 },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ])('takes full damage outside the frontal arc: %j', (dir) => {
    expect(setup().hit(['#gun'], dir)).toBe(10);
  });

  it('uses current facing and the configured arc boundary', () => {
    const f = setup();
    f.enemy.current.yaw = Math.PI / 2;
    expect(f.hit(['#gun'], { x: -1, y: 0, z: 0 })).toBe(0);
    expect(f.hit(['#gun'], { x: 0, y: 0, z: -1 })).toBe(10);
    f.enemy.current.yaw = 0;
    const angle = (shielderRaw.shield.arcDeg * Math.PI) / 360;
    expect(
      f.hit(['#gun'], { x: -Math.sin(angle), y: 0, z: -Math.cos(angle) }),
    ).toBe(0);
    expect(
      f.hit(['#gun'], {
        x: -Math.sin(angle + 0.01),
        y: 0,
        z: -Math.cos(angle + 0.01),
      }),
    ).toBe(10);
  });

  it('lets heavy hits through, stuns, lowers for downS and restores the shield in simulation time', () => {
    const f = setup();
    f.removeTarget();
    expect(f.hit(['#melee', '#heavy'])).toBe(10);
    expect(f.enemy.current.state).toBe('stunned');
    expect(f.enemy.current.shieldUp).toBe(false);
    f.step(20, 0);
    expect(f.enemy.current.shieldUp).toBe(false);
    f.step(Math.round(shielderRaw.shield.downS / SIM_DT) - 1);
    expect(f.enemy.current.shieldUp).toBe(false);
    expect(f.hit(['#gun'])).toBe(10);
    f.step();
    expect(f.enemy.current.shieldUp).toBe(true);
    expect(f.hit(['#gun'])).toBe(0);
  });

  it('does not lower the shield on a rear heavy hit beyond its stun', () => {
    const f = setup();
    f.removeTarget();
    expect(f.hit(['#heavy'], { x: 0, y: 0, z: 1 })).toBe(10);
    f.step(Math.ceil(shielderRaw.stunOnHeavyS / SIM_DT) + 1);
    expect(f.enemy.current.shieldUp).toBe(true);
  });

  it('disables shield on overload and status stun, then restores it after expiry', () => {
    const f = setup();
    f.removeTarget();
    for (const status of ['overload', 'stunned']) {
      f.statuses.apply(f.enemy.id, { id: status, durationS: 0.2 }, f.player);
      expect(f.hit(['#gun'])).toBeGreaterThan(0);
      expect(f.enemy.current.shieldUp).toBe(false);
      f.step(14);
      expect(f.enemy.current.shieldUp).toBe(true);
      expect(f.hit(['#gun'])).toBe(0);
    }
  });

  it('passes hits without direction, zero direction and unlisted tags', () => {
    const f = setup();
    expect(
      f.damage.deal(f.enemy.id, {
        amount: 10,
        source: f.player,
        tags: ['#gun'],
      }),
    ).toBe(10);
    expect(f.hit(['#gun'], { x: 0, y: 0, z: 0 })).toBe(10);
    expect(f.hit(['#power'])).toBe(10);
  });
});

describe('Egzekutor — prawdziwy Rapier', () => {
  it('parries the first melee hit, telegraphs a heavy counter, and strikes the player with heavy tags', () => {
    const f = setup('executor');
    const blocked = vi.fn();
    const telegraph = vi.fn();
    const hits: GameEvents['damage_dealt'][] = [];
    f.bus.on('melee_blocked', blocked);
    f.bus.on('enemy_telegraph', telegraph);
    f.bus.on('damage_dealt', (event) => hits.push(event));
    expect(f.hit()).toBe(0);
    expect(blocked).toHaveBeenCalledExactlyOnceWith({
      defender: f.enemy.id,
      attacker: f.player,
      amount: 10,
    });
    expect(telegraph).toHaveBeenCalledExactlyOnceWith({
      id: f.enemy.id,
      kind: 'heavy',
      durationS: executorRaw.telegraphS,
    });
    expect(f.hit()).toBe(10);
    f.step(Math.round(executorRaw.telegraphS / SIM_DT) - 1);
    expect(hits.filter((event) => event.target === f.player)).toHaveLength(0);
    f.step();
    expect(hits.filter((event) => event.target === f.player)).toEqual([
      expect.objectContaining({
        source: f.enemy.id,
        amount: 28,
        tags: ['#melee', '#heavy'],
      }),
    ]);
  });

  it('requires parry cooldown and freezes it during hitstop', () => {
    const f = setup('executor');
    f.removeTarget();
    expect(f.hit()).toBe(0);
    f.step(100, 0);
    expect(f.hit()).toBe(10);
    f.step(Math.round(executorRaw.parry.cooldownS / SIM_DT) - 1);
    expect(f.hit()).toBe(10);
    f.step();
    expect(f.hit()).toBe(0);
  });

  it.each([{ tags: ['#melee', '#heavy'] }, { tags: ['#gun'] }])(
    'does not parry $tags or consume its ready parry',
    ({ tags }) => {
      const f = setup('executor');
      f.removeTarget();
      expect(f.hit(tags)).toBe(10);
      if (tags.includes('#heavy'))
        f.step(Math.ceil(executorRaw.stunOnHeavyS / SIM_DT) + 1);
      expect(f.hit()).toBe(0);
    },
  );

  it('cannot parry while attacking, stunned or dead', () => {
    const f = setup('executor');
    f.step();
    expect(f.enemy.current.state).toBe('telegraph');
    expect(f.hit()).toBe(10);
    f.statuses.apply(f.enemy.id, { id: 'stunned', durationS: 1 }, f.player);
    expect(f.hit()).toBe(10);
    f.step();
    expect(f.enemy.current.state).toBe('stunned');
    expect(f.hit()).toBe(10);
    f.damage.deal(f.enemy.id, {
      amount: 1000,
      source: f.player,
      tags: ['#gun'],
    });
    const blocked = vi.fn();
    f.bus.on('melee_blocked', blocked);
    expect(f.hit()).toBe(0);
    expect(blocked).not.toHaveBeenCalled();
  });

  it('parries without a counter out of range', () => {
    const f = setup('executor');
    f.enemy.current.position.z = -10;
    const telegraph = vi.fn();
    f.bus.on('enemy_telegraph', telegraph);
    expect(f.hit()).toBe(0);
    expect(telegraph).not.toHaveBeenCalled();
  });

  it('uses the normal director token for a counter and releases it on heavy stun', () => {
    const f = setup('executor', true);
    const director = f.manager.director!;
    expect(director.requestToken(999, 'melee')).toBe(true);
    expect(f.hit()).toBe(0);
    expect(f.enemy.current.state).toBe('idle');
    f.removeTarget();
    f.step(Math.round(executorRaw.parry.cooldownS / SIM_DT));
    director.releaseToken(999);
    f.restoreTarget();
    expect(f.hit()).toBe(0);
    expect(director.snapshot().tokens.melee).toEqual([f.enemy.id]);
    expect(f.hit(['#melee', '#heavy'])).toBe(10);
    expect(director.snapshot().tokens.melee).toEqual([]);
  });
});

describe('F2-14 — widoki', () => {
  it.each([false, true])(
    'shows independent shields and glowing blades (GLB: %s)',
    async (models) => {
      const source = new Group();
      source.name = 'trooper-rig';
      const hand = new Group();
      hand.name = 'hand_R';
      const baton = new Group();
      baton.name = 'baton';
      hand.add(baton);
      source.add(hand);
      const load = vi
        .spyOn(GLTFLoader.prototype, 'loadAsync')
        .mockResolvedValue({ scene: source } as GLTF);
      const shield = setup().enemy;
      const elite = setup('executor').enemy;
      const a = new EnemyView(shield, models);
      const b = new EnemyView(elite, models);
      cleanup.unshift(() => {
        a.dispose();
        b.dispose();
      });
      if (models) {
        await vi.waitFor(() =>
          expect(a.root.getObjectByName('trooper-rig')).toBeDefined(),
        );
        expect(load.mock.calls.map(([url]) => url).sort()).toEqual([
          '/assets/models/enemy_executor.glb',
          '/assets/models/enemy_shielder.glb',
        ]);
      }
      a.render(1);
      const mesh = a.root.getObjectByName('shield') as Mesh<BoxGeometry>;
      expect(mesh.parent).toBe(a.root);
      expect(mesh.visible).toBe(true);
      expect(mesh.material).toBe(getMaterial('enemy'));
      expect(mesh.geometry.parameters.width).toBe(
        shielderRaw.animation.shieldSizeM.x,
      );
      shield.current.shieldUp = false;
      a.render(1);
      expect(mesh.visible).toBe(false);
      shield.current.shieldUp = true;
      a.render(1);
      expect(mesh.visible).toBe(true);
      const blade = b.root.getObjectByName(
        'executor_blade',
      ) as Mesh<BoxGeometry>;
      expect(blade.material).toBe(getMaterial('enemyGlow'));
      expect(blade.geometry.parameters.depth).toBe(
        executorRaw.animation.bladeSizeM.z,
      );
      expect(b.root.getObjectByName('baton')?.visible).toBe(false);
      expect(source.getObjectByName('baton')?.visible).toBe(true);
      const disposeShield = vi.spyOn(mesh.geometry, 'dispose');
      const disposeBlade = vi.spyOn(blade.geometry, 'dispose');
      a.dispose();
      b.dispose();
      expect(disposeShield).toHaveBeenCalledOnce();
      expect(disposeBlade).toHaveBeenCalledOnce();
    },
  );
});
