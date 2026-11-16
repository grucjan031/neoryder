import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { StatusSystem } from '../../src/combat/status/statusSystem';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { createPower } from '../../src/combat/powers/registry';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { EnemyManager } from '../../src/enemies/manager';
import { enemySchema } from '../../src/enemies/enemySchema';
import { createEnemyView } from '../../src/enemies/views';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { ExecuteSystem } from '../../src/combat/melee/execute';
import { GrabPhysics } from '../../src/physics/grabPhysics';
import type { Vec3 } from '../../src/core/math';
import turret from '../../src/data/enemies/turret.json';
import hacker from '../../src/data/enemies/hacker.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

function setup(kind = 'turret') {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const world = new rapier.World({ x: 0, y: -20, z: 0 });
  const player = entities.create('player', 'player');
  const stats = new Stats({ maxHealth: 100, maxEnergy: 100 });
  damage.register(player, new Health(() => 100), { stats });
  const body = world.createRigidBody(
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0),
  );
  const collider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  entities.bindCollider(player, collider.handle);
  hurtboxes.add(player, collider);
  let target = { x: 0, y: 1, z: 0 };
  const statuses = new StatusSystem(bus, damage, {
    position: () => target,
    targets: () => [player],
  });
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    tuning,
  );
  const manager = new EnemyManager(
    { bus, rng: new Rng('z16'), tuning },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      statuses,
      getTarget: () => ({ id: player, position: target }),
    },
  );
  const enemy = manager.spawn(kind, { x: 0, y: 0, z: -9 });
  const energy = new PlayerEnergy(player, stats, bus, tuning);
  const deps = {
    owner: player,
    bus,
    tuning,
    damage,
    energy,
    statuses,
    projectiles,
    aim: () => ({ origin: target, dir: { x: 0, y: 0, z: -1 } }),
    targets: () => [{ id: enemy.id, position: enemy.current.position }],
    castWall: () => null,
  };
  world.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    statuses.dispose();
    energy.dispose();
    world.free();
  });
  const step = (count = 1) => {
    for (let i = 0; i < count; i++) {
      damage.step(SIM_DT);
      statuses.step(SIM_DT);
      manager.step(SIM_DT);
      world.step();
      projectiles.step(SIM_DT);
    }
  };
  const until = (predicate: () => boolean, max = 600) => {
    for (let i = 0; i < max && !predicate(); i++) step();
    expect(predicate()).toBe(true);
  };
  const move = (position: Vec3) => {
    target = position;
    body.setTranslation(position, true);
    world.step();
  };
  return {
    bus,
    entities,
    damage,
    world,
    player,
    stats,
    statuses,
    manager,
    projectiles,
    enemy,
    energy,
    deps,
    step,
    until,
    move,
  };
}

describe('Z16 — Wieżyczka', () => {
  it('can be finished at low health without moving its fixed body', () => {
    const c = setup();
    c.damage.deal(c.enemy.id, {
      source: c.player,
      amount: turret.maxHealth - 1,
      tags: [],
    });
    const execute = new ExecuteSystem({
      bus: c.bus,
      damage: c.damage,
      tuning,
      owner: c.player,
      statuses: c.statuses,
      enemies: () => [
        { id: c.enemy.id, kind: 'turret', position: { x: 0, y: 1, z: -9 } },
      ],
      aim: () => ({
        origin: { x: 0, y: 1, z: -8 },
        dir: { x: 0, y: 0, z: -1 },
      }),
      addEnergy: () => {},
      heal: () => {},
    });
    expect(execute.tryExecute()).toBe(true);
    expect(c.enemy.current.state).toBe('dead');
    expect(c.enemy.current.position).toEqual({ x: 0, y: 0, z: -9 });
    execute.dispose();
  });
  it('stays at the spawn point after knockback and separation, rejects Grab', () => {
    const c = setup();
    c.manager.spawn('assaulter', { x: 0, y: 0, z: -9 });
    const before = { ...c.enemy.current.position };
    c.damage.deal(c.enemy.id, {
      source: c.player,
      amount: 1,
      tags: ['#power'],
      knockback: 30,
      dir: { x: 1, y: 1, z: 0 },
    });
    c.step(120);
    expect(c.enemy.current.position).toEqual(before);
    expect(c.damage.health(c.enemy.id)?.current).toBe(turret.maxHealth - 1);
    const target = c.enemy.grabTarget!();
    const grab = createPower('grab', {
      ...c.deps,
      aim: () => ({
        origin: { x: 0, y: 1, z: -7 },
        dir: { x: 0, y: 0, z: -1 },
      }),
      grab: new GrabPhysics(c.world, c.entities, () => [target]),
    });
    const denied: string[] = [];
    c.bus.on('power_denied', (e) => denied.push(e.reason));
    grab.step(SIM_DT, { pressed: true, held: true, released: false });
    expect(denied).toEqual(['too_heavy']);
    expect(grab.active).toBe(false);
    expect(c.energy.current).toBe(100);
    grab.reset();
  });

  it('limits turn speed even during a burst; shots follow the barrel', () => {
    const c = setup();
    c.until(() => c.enemy.current.state === 'aim');
    c.move({ x: 9, y: 1, z: -9 });
    const before = c.enemy.current.yaw;
    c.step();
    expect(c.enemy.current.yaw - before).toBeCloseTo(
      ((turret.turnRateDegS * Math.PI) / 180) * SIM_DT,
    );
    let shotYaw = 0;
    c.bus.on('projectile_spawned', ({ id }) =>
      c.projectiles.forEachActive((pid, _p, dir) => {
        if (pid === id) shotYaw = Math.atan2(dir.x, dir.z);
      }),
    );
    c.until(() => c.enemy.current.state === 'burst');
    expect(shotYaw).toBeCloseTo(c.enemy.current.yaw);
    expect(shotYaw).toBeLessThan(Math.PI / 2);
  });

  it('telegraphs before three slow shots and the blade can parry a real shot', () => {
    const c = setup();
    let shots = 0;
    c.bus.on('projectile_spawned', () => shots++);
    c.until(() => c.enemy.current.state === 'aim');
    c.step(Math.floor(turret.aimTelegraphS / SIM_DT) - 1);
    expect(shots).toBe(0);
    c.step();
    expect(shots).toBe(1);
    const blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner: c.player,
        team: 'player',
        damage: c.damage,
        stats: c.stats,
        energy: c.energy.pool,
        queryArc: () => [],
        aim: c.deps.aim,
        projectiles: c.projectiles,
        positionOf: (id) =>
          id === c.enemy.id ? c.enemy.current.position : null,
      },
      c.bus,
      tuning,
    );
    c.projectiles.addInterceptor(blade.interceptProjectile);
    let parried = false;
    c.bus.on('parry_success', () => {
      parried = true;
    });
    let blocking = false;
    for (let i = 0; i < 180 && !parried; i++) {
      c.projectiles.forEachActive((_id, p) => {
        if (p.z > -1.2) blocking = true;
      });
      blade.step(SIM_DT, {
        held: new Set(blocking ? ['block'] : []),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
      c.step();
    }
    expect(parried).toBe(true);
    expect(shots).toBe(3);
    expect(c.damage.health(c.player)?.current).toBe(100);
  });
});

describe('Z16 — Haker i jammed', () => {
  it.each(['push', 'chain', 'focus', 'barrier', 'grab'])(
    '%s denies activation before energy, cooldown or target checks',
    (id) => {
      const c = setup('hacker');
      c.statuses.apply(c.player, { id: 'jammed', durationS: 3 }, c.enemy.id);
      c.energy.set(0);
      const power = createPower(id, c.deps);
      const denied: string[] = [];
      c.bus.on('power_denied', (event) => denied.push(event.reason));
      power.step(SIM_DT, { pressed: true, held: true, released: false });
      expect(denied).toEqual(['jammed']);
      expect(c.energy.current).toBe(0);
      expect(power.cooldownRemaining).toBe(0);
      expect(power.active).toBe(false);
      power.reset();
    },
  );

  it('heavy interruption cannot shorten the hack cooldown through stun recovery', () => {
    const c = setup('hacker');
    c.until(() => c.enemy.current.state === 'aim');
    c.damage.deal(c.enemy.id, {
      source: c.player,
      amount: 1,
      tags: ['#heavy'],
    });
    expect(c.enemy.current.state).toBe('stunned');
    for (
      let i = 0;
      i < Math.floor(hacker.hack.hackCooldownS / SIM_DT) - 1;
      i++
    ) {
      c.step();
      expect(c.enemy.current.state).not.toBe('aim');
      expect(c.statuses.has(c.player, 'jammed')).toBe(false);
    }
    c.until(() => c.enemy.current.state === 'aim');
  });

  it('hits with a beam, blocks activation without spending energy, expires and permits power again', () => {
    const c = setup('hacker');
    const power = createPower('push', c.deps);
    const denied: string[] = [];
    c.bus.on('power_denied', (e) => denied.push(e.reason));
    c.until(() => c.statuses.has(c.player, 'jammed'));
    expect(c.damage.health(c.player)?.current).toBe(98);
    expect(c.statuses.remaining(c.player, 'jammed')).toBeCloseTo(
      hacker.hack.durationS,
    );
    power.step(SIM_DT, { pressed: true, held: true, released: false });
    expect(denied).toEqual(['jammed']);
    expect(c.energy.current).toBe(100);
    expect(power.cooldownRemaining).toBe(0);
    c.step(Math.ceil(hacker.hack.durationS / SIM_DT));
    expect(c.statuses.has(c.player, 'jammed')).toBe(false);
    power.step(SIM_DT, { pressed: true, held: true, released: false });
    expect(c.energy.current).toBe(100 - power.def.cost);
    power.reset();
  });

  it('any damage interrupts aim and waits the complete hack cooldown', () => {
    const c = setup('hacker');
    c.until(() => c.enemy.current.state === 'aim');
    c.damage.deal(c.enemy.id, { source: c.player, amount: 1, tags: ['#gun'] });
    expect(c.enemy.current.state).toBe('cooldown');
    expect(c.enemy.current.aim).toBeUndefined();
    c.step(Math.floor(hacker.hack.hackCooldownS / SIM_DT) - 1);
    expect(c.enemy.current.state).toBe('cooldown');
    expect(c.statuses.has(c.player, 'jammed')).toBe(false);
    c.until(() => c.enemy.current.state === 'aim');
  });

  it('cover introduced during aim prevents jamming', () => {
    const c = setup('hacker');
    c.until(() => c.enemy.current.state === 'aim');
    c.world.createCollider(
      ColliderDesc.cuboid(20, 5, 0.3)
        .setTranslation(0, 2, -4)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    c.world.step();
    c.step(120);
    expect(c.statuses.has(c.player, 'jammed')).toBe(false);
    expect(c.damage.health(c.player)?.current).toBe(100);
  });

  it('stun, death and despawn stop the beam and dispose the body', () => {
    const c = setup('hacker');
    c.until(() => c.enemy.current.state === 'aim');
    c.statuses.apply(c.enemy.id, { id: 'stunned', durationS: 2 }, c.player);
    c.step(60);
    expect(c.enemy.current.state).toBe('stunned');
    expect(c.statuses.has(c.player, 'jammed')).toBe(false);
    c.damage.deal(c.enemy.id, { source: c.player, amount: 100, tags: [] });
    c.step(Math.ceil((tuning.enemies.corpseS + 0.1) / SIM_DT));
    expect(c.enemy.removed).toBe(true);
    expect(c.damage.health(c.enemy.id)).toBeUndefined();
  });
});

describe('Z16 — dane i widoki', () => {
  it('validates both definitions and rejects incomplete archetypes', () => {
    expect(enemySchema.parse(turret).threatCost).toBe(3);
    expect(enemySchema.parse(hacker).threatCost).toBe(2.5);
    expect(
      enemySchema.safeParse({ ...turret, stationary: false }).success,
    ).toBe(false);
    expect(enemySchema.safeParse({ ...hacker, hack: undefined }).success).toBe(
      false,
    );
    expect(enemySchema.safeParse({ ...hacker, drone: undefined }).success).toBe(
      false,
    );
  });

  it.each(['turret', 'hacker'])(
    '%s has red geometry, distinct shape and an aim line',
    (kind) => {
      const c = setup(kind);
      c.until(() => c.enemy.current.state === 'aim');
      const view = createEnemyView(c.enemy, false);
      cleanup.push(() => view.dispose());
      view.render(1);
      expect(
        view.root.getObjectByName(kind === 'turret' ? 'barrel' : 'antenna'),
      ).toBeDefined();
      expect(view.root.getObjectByName('laser')?.visible).toBe(true);
      c.enemy.current.state = 'cooldown';
      view.render(1);
      expect(view.root.getObjectByName('laser')?.visible).toBe(false);
    },
  );
});
