import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import type { Mesh } from 'three';
import {
  DamageSystem,
  Health,
  Hurtboxes,
  PIERCE_BLOCK_TAG,
} from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { EntityId, GameEvents } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { DroneView } from '../../src/enemies/droneView';
import { enemySchema } from '../../src/enemies/enemySchema';
import { EnemyView } from '../../src/enemies/enemyView';
import { EnemyManager } from '../../src/enemies/manager';
import { availableEnemyIds } from '../../src/enemies/registry';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import { createEnemyView } from '../../src/enemies/views';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import droneRaw from '../../src/data/enemies/drone.json';
import sniperRaw from '../../src/data/enemies/sniper.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function world(seed = 'f2-13', stunned?: (id: EntityId) => number) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const settings = structuredClone(tuning);
  const physics = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  physics.createCollider(
    ColliderDesc.cuboid(40, 0.5, 40)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
  );
  const player = entities.create('player', 'player');
  const body = physics.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0),
  );
  const collider = physics.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  hurtboxes.add(player, collider);
  entities.bindCollider(player, collider.handle);
  damage.register(player, new Health(() => 1e9));
  const projectiles = new ProjectileSystem(
    physics,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  let target = { id: player, position: { x: 0, y: 0.9, z: 0 } };
  const manager = new EnemyManager(
    { bus, rng: new Rng(seed), tuning: settings },
    {
      world: physics,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => target,
      ...(stunned
        ? {
            statuses: {
              has: (id: EntityId) => stunned(id) > 0,
              stacks: () => 0,
              remaining: (id: EntityId) => stunned(id),
            },
          }
        : {}),
    },
  );
  physics.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    physics.free();
  });
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      damage.step(SIM_DT);
      manager.step(SIM_DT);
      physics.timestep = SIM_DT;
      physics.step();
      projectiles.step(SIM_DT);
    }
  };
  const moveTarget = (p: Vec3): void => {
    target = { id: player, position: p };
    body.setNextKinematicTranslation(p);
  };
  const wall = (center: Vec3, half: Vec3) =>
    physics.createCollider(
      ColliderDesc.cuboid(half.x, half.y, half.z)
        .setTranslation(center.x, center.y, center.z)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  return {
    bus,
    damage,
    manager,
    projectiles,
    player,
    step,
    moveTarget,
    wall,
    target: () => target,
  };
}

const telegraphs = (bus: EventBus) => {
  const list: GameEvents['enemy_telegraph'][] = [];
  bus.on('enemy_telegraph', (e) => list.push(e));
  return list;
};

describe('Snajper i Dron — dane', () => {
  it('registers both archetypes and validates their extra fields', () => {
    expect(availableEnemyIds()).toEqual(
      expect.arrayContaining(['sniper', 'drone']),
    );
    expect(enemySchema.parse(sniperRaw).laserSight).toBe(true);
    expect(enemySchema.parse(droneRaw).drone?.hoverHeightM).toBeGreaterThan(0);
    const noFlight: Record<string, unknown> = { ...droneRaw };
    delete noFlight.drone;
    expect(() => enemySchema.parse(noFlight)).toThrow(/Dron wymaga/);
    expect(() =>
      enemySchema.parse({ ...sniperRaw, aimLockS: sniperRaw.aimTelegraphS }),
    ).toThrow(/Blokada celu/);
  });
});

describe('Snajper — prawdziwy Rapier', () => {
  it('telegraphs long with a tracked laser point, then locks it so a late dodge works', () => {
    const { bus, manager, step, moveTarget, projectiles } = world();
    const events = telegraphs(bus);
    const sniper = manager.spawn('sniper', {
      x: 0,
      y: 0,
      z: -sniperRaw.preferredRange,
    });
    while (sniper.current.state !== 'aim') step();
    expect(events).toEqual([
      { id: sniper.id, kind: 'aim', durationS: sniperRaw.aimTelegraphS },
    ]);
    expect(sniper.current.aim?.x).toBeCloseTo(0);
    // Przed blokadą laser śledzi cel.
    moveTarget({ x: 1, y: 0.9, z: 0 });
    step();
    expect(sniper.current.aim?.x).toBeCloseTo(1);
    const lockAt = sniperRaw.aimTelegraphS - sniperRaw.aimLockS;
    while (sniper.current.stateTimeS < lockAt + SIM_DT) step();
    const locked = { ...sniper.current.aim! };
    // Unik po blokadzie: strzał leci w zamrożony punkt.
    moveTarget({ x: 4, y: 0.9, z: 0 });
    let dir: Vec3 | null = null;
    const off = bus.on('projectile_spawned', ({ id }) => {
      projectiles.forEachActive((pid, _pos, d) => {
        if (pid === id) dir = { ...d };
      });
    });
    while (sniper.current.state === 'aim') step();
    off();
    expect(sniper.current.aim).toBeUndefined();
    expect(dir).not.toBeNull();
    const d = dir as unknown as Vec3;
    const toLocked = Math.atan2(
      locked.x - 0,
      locked.z + sniperRaw.preferredRange,
    );
    expect(Math.atan2(d.x, d.z)).toBeCloseTo(toLocked, 1);
    expect(Math.abs(Math.atan2(d.x, d.z))).toBeLessThan(
      Math.atan2(4, sniperRaw.preferredRange) / 2,
    );
  });

  it('fires a single heavy shot that ignores blade block and backs away from a close player', () => {
    const { bus, manager, step, moveTarget } = world();
    const hits: GameEvents['damage_dealt'][] = [];
    bus.on('damage_dealt', (e) => hits.push(e));
    const sniper = manager.spawn('sniper', {
      x: 0,
      y: 0,
      z: -sniperRaw.preferredRange,
    });
    let shots = 0;
    bus.on('projectile_spawned', () => shots++);
    for (let i = 0; i < 3 / SIM_DT && hits.length === 0; i++) step();
    expect(shots).toBe(sniperRaw.burstCount);
    expect(hits[0]?.source).toBe(sniper.id);
    expect(hits[0]?.tags).toEqual(['#gun', PIERCE_BLOCK_TAG]);
    expect(hits[0]?.amount).toBe(sniperRaw.projectileDamage);
    // Gracz podchodzi blisko: snajper odchodzi.
    moveTarget({ x: 0, y: 0.9, z: -sniperRaw.preferredRange + 5 });
    const near = () =>
      Math.hypot(
        sniper.current.position.x,
        sniper.current.position.z + sniperRaw.preferredRange - 5,
      );
    while (sniper.current.state !== 'reposition') step();
    const before = near();
    step(Math.round(1 / SIM_DT));
    expect(near()).toBeGreaterThan(before + 1);
  });
});

describe('Dron — lot bez character controllera', () => {
  it('hovers at hoverHeightM and circles the target at preferredRange', () => {
    const { manager, step } = world();
    const drone = manager.spawn('drone', {
      x: 0,
      y: 0,
      z: -droneRaw.preferredRange,
    });
    expect(drone.current.position.y).toBeCloseTo(droneRaw.drone.hoverHeightM);
    const bearing = () =>
      Math.atan2(drone.current.position.x, drone.current.position.z);
    const start = bearing();
    let turned = 0;
    let last = start;
    for (let i = 0; i < 4 / SIM_DT; i++) {
      step();
      const b = bearing();
      turned += Math.abs(Math.atan2(Math.sin(b - last), Math.cos(b - last)));
      last = b;
      expect(drone.current.position.y).toBeCloseTo(
        droneRaw.drone.hoverHeightM,
        1,
      );
    }
    expect(turned).toBeGreaterThan(0.5);
    expect(
      Math.hypot(drone.current.position.x, drone.current.position.z),
    ).toBeCloseTo(droneRaw.preferredRange, 0);
  });

  it('never enters a wall on its orbit and turns back instead', () => {
    const { manager, step, wall } = world('wall');
    const center = { x: droneRaw.preferredRange, y: 3, z: 0 };
    const half = { x: 0.5, y: 3, z: 2.5 };
    wall(center, half);
    const drone = manager.spawn('drone', {
      x: 0,
      y: 0,
      z: -droneRaw.preferredRange,
    });
    let minGap = Infinity;
    const signs = new Set<number>();
    let lastX = drone.current.position.x;
    for (let i = 0; i < 14 / SIM_DT; i++) {
      step();
      const p = drone.current.position;
      const gx = Math.max(0, Math.abs(p.x - center.x) - half.x);
      const gy = Math.max(0, Math.abs(p.y - center.y) - half.y);
      const gz = Math.max(0, Math.abs(p.z - center.z) - half.z);
      minGap = Math.min(minGap, Math.hypot(gx, gy, gz));
      if (Math.abs(p.x - lastX) > 1e-4) signs.add(Math.sign(p.x - lastX));
      lastX = p.x;
    }
    expect(minGap).toBeGreaterThanOrEqual(droneRaw.drone.radiusM - 1e-3);
    expect(signs.size).toBe(2);
  });

  it('shoots telegraphed bursts, is stunned by heavy hits and statuses, and despawns after death', () => {
    let stunUntil = 0;
    let t = 0;
    const { bus, damage, manager, step } = world('burst', () =>
      Math.max(0, stunUntil - t),
    );
    const events = telegraphs(bus);
    let shots = 0;
    bus.on('projectile_spawned', () => shots++);
    const drone = manager.spawn('drone', {
      x: 0,
      y: 0,
      z: -droneRaw.preferredRange,
    });
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) {
        step();
        t += SIM_DT;
      }
    };
    tick(Math.round(3 / SIM_DT));
    expect(events.some((e) => e.id === drone.id && e.kind === 'aim')).toBe(
      true,
    );
    expect(shots).toBeGreaterThanOrEqual(droneRaw.burstCount);
    damage.deal(drone.id, {
      amount: 1,
      source: null,
      tags: [PIERCE_BLOCK_TAG],
    });
    expect(drone.current.state).toBe('stunned');
    tick(Math.round((droneRaw.stunOnHeavyS + 0.2) / SIM_DT));
    expect(drone.current.state).not.toBe('stunned');
    stunUntil = t + 1;
    tick(1);
    expect(drone.current.state).toBe('stunned');
    const before = shots;
    tick(Math.round(0.9 / SIM_DT));
    expect(drone.current.state).toBe('stunned');
    expect(shots).toBe(before);
    damage.deal(drone.id, { amount: 1e9, source: null, tags: [] });
    expect(drone.current.state).toBe('dead');
    tick(Math.round((tuning.enemies.corpseS + 0.1) / SIM_DT));
    expect(drone.removed).toBe(true);
    expect(damage.health(drone.id)).toBeUndefined();
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const { manager, step } = world('same');
      const drone = manager.spawn('drone', { x: 2, y: 0, z: -6 });
      step(Math.round(3 / SIM_DT));
      return { ...drone.current.position };
    };
    expect(run()).toEqual(run());
  });
});

function fake(raw: unknown, state: EnemySnapshot['state'] = 'idle'): Enemy {
  const snapshot = (): EnemySnapshot => ({
    position: { x: 0, y: 2, z: 0 },
    yaw: 0,
    speed: 0,
    distance: 0,
    state,
    stateTimeS: 0,
  });
  return {
    id: 1,
    definition: enemySchema.parse(raw),
    previous: snapshot(),
    current: snapshot(),
    removed: false,
    step() {},
    dispose() {},
  };
}

describe('Widoki F2-13', () => {
  it('picks DroneView for drones, spins rotors, pulses the eye while aiming and tilts when stunned', () => {
    const e = fake(droneRaw, 'aim');
    const v = createEnemyView(e, false);
    cleanup.push(() => v.dispose());
    expect(v).toBeInstanceOf(DroneView);
    expect(createEnemyView(fake(sniperRaw), false)).toBeInstanceOf(EnemyView);
    e.current.position = { x: 2, y: 2, z: 0 };
    v.render(0.5);
    expect(v.root.position.x).toBeCloseTo(1);
    const rotor = v.root.getObjectByName('rotor')!;
    const spin = rotor.rotation.y;
    e.current.stateTimeS = 1 / (4 * droneRaw.drone.pulseHz);
    v.render(1);
    expect(rotor.rotation.y).not.toBe(spin);
    expect(v.root.getObjectByName('eye')!.scale.x).toBeGreaterThan(1);
    e.current.state = 'stunned';
    v.render(1);
    expect(v.root.children[0]!.rotation.z).toBe(droneRaw.drone.stunTiltRad);
    e.current.state = 'dead';
    v.render(1);
    expect(v.root.visible).toBe(false);
  });

  it('draws the sniper laser from the muzzle to the aim point only while aiming, thicker when locked', () => {
    const e = fake(sniperRaw, 'aim');
    e.current.position = { x: 0, y: 0, z: 0 };
    e.previous.position = { x: 0, y: 0, z: 0 };
    const v = new EnemyView(e, false);
    cleanup.push(() => v.dispose());
    const laser = v.root.getObjectByName('laser') as Mesh;
    v.render(1);
    expect(laser.visible).toBe(false);
    e.current.aim = { x: 0, y: sniperRaw.muzzle.y, z: 10 };
    v.render(1);
    expect(laser.visible).toBe(true);
    expect(laser.scale.y).toBeCloseTo(
      Math.hypot(sniperRaw.muzzle.x, 10 - sniperRaw.muzzle.z),
      3,
    );
    const thin = laser.scale.x;
    e.current.stateTimeS = sniperRaw.aimTelegraphS - sniperRaw.aimLockS / 2;
    v.render(1);
    expect(laser.scale.x).toBeCloseTo(
      thin * sniperRaw.animation.laserLockScale,
    );
    e.current.state = 'burst';
    v.render(1);
    expect(laser.visible).toBe(false);
  });
});

describe('F2-13 — poprawki po przeglądzie', () => {
  it('drone slides along a wall that is closer than its orbit instead of freezing', () => {
    const { manager, step, wall } = world('slide');
    // Ściana między graczem a okręgiem orbity (z = -5 < preferredRange 7).
    wall({ x: 0, y: 3, z: -5.25 }, { x: 20, y: 3, z: 0.25 });
    const drone = manager.spawn('drone', { x: 0, y: 0, z: -4 });
    const start = { ...drone.current.position };
    let minZ = Infinity;
    step(Math.round(0.2 / SIM_DT));
    for (let i = 0; i < 2 / SIM_DT; i++) {
      step();
      minZ = Math.min(minZ, drone.current.position.z);
    }
    expect(
      Math.hypot(
        drone.current.position.x - start.x,
        drone.current.position.z - start.z,
      ),
    ).toBeGreaterThan(1);
    expect(minZ).toBeGreaterThanOrEqual(-5 - 1e-3 + droneRaw.drone.radiusM);
  });

  it('sniper keeps the locked point: faces it, and fires even when the player hides after the lock', () => {
    const { bus, manager, step, moveTarget, wall } = world('lock');
    const sniper = manager.spawn('sniper', {
      x: 0,
      y: 0,
      z: -sniperRaw.preferredRange,
    });
    while (sniper.current.state !== 'aim') step();
    const lockAt = sniperRaw.aimTelegraphS - sniperRaw.aimLockS;
    while (sniper.current.stateTimeS < lockAt + SIM_DT) step();
    // Unik w bok i osłona między snajperem a graczem.
    moveTarget({ x: 4, y: 0.9, z: 0 });
    wall({ x: 4, y: 1.5, z: -3 }, { x: 1.5, y: 1.5, z: 0.3 });
    let shots = 0;
    bus.on('projectile_spawned', () => shots++);
    while (sniper.current.state === 'aim') {
      step();
      expect(Math.abs(sniper.current.yaw)).toBeLessThan(0.05);
    }
    expect(sniper.current.state).not.toBe('reposition');
    expect(shots).toBe(1);
  });
});
