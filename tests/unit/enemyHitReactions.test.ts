import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { ColliderDesc, Ray } from '@dimforge/rapier3d-compat';
import { PerspectiveCamera, Scene as ThreeScene } from 'three';
import {
  DamageSystem,
  Hurtboxes,
  PIERCE_BLOCK_TAG,
} from '../../src/combat/damage';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { pushDefinition, ResonancePush } from '../../src/combat/powers/push';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { GameLoop, SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { createEnemy } from '../../src/enemies/registry';
import { Boss } from '../../src/enemies/boss';
import { createEnemyView } from '../../src/enemies/views';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import { AiTest } from '../../src/scenes/aiTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import { DebrisSystem } from '../../src/vfx/debris';
import { EnemyShatter } from '../../src/vfx/enemyShatter';
import { PropPhysicsSystem } from '../../src/world/propPhysics';
import { ScatterProps } from '../../src/world/scatterProps';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
const cleanup: (() => void)[] = [];
const zero = { x: 0, y: 0, z: 0 };
const east = { x: 1, y: 0, z: 0 };
const worldGroup = interactionGroups(CollisionGroup.World, 0xffff);
beforeAll(async () => {
  rapier = await initPhysics();
});
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
});

function setup() {
  const settings = structuredClone(tuning);
  const bus = new EventBus();
  const world = new rapier.World({ x: 0, y: settings.physics.gravity, z: 0 });
  world.timestep = SIM_DT;
  world.createCollider(
    ColliderDesc.cuboid(10, 0.5, 10)
      .setTranslation(0, -0.5, 0)
      .setCollisionGroups(worldGroup),
  );
  const entities = new EntityRegistry(bus);
  const hurtboxes = new Hurtboxes();
  const damage = new DamageSystem(bus, entities);
  const playerId = entities.create('player', 'player');
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  cleanup.push(() => world.free());
  return {
    settings,
    bus,
    world,
    entities,
    hurtboxes,
    damage,
    playerId,
    projectiles,
  };
}

function combat(kind = 'assaulter') {
  const f = setup();
  const enemy = createEnemy(
    { bus: f.bus, tuning: f.settings, rng: new Rng('impact') },
    { ...f, getTarget: () => null },
    kind,
    zero,
  );
  const step = () => {
    enemy.step(SIM_DT);
    f.world.step();
    f.damage.step(SIM_DT);
  };
  const hit = (knockback: number, dir = east) =>
    f.damage.deal(enemy.id, {
      amount: 1,
      source: f.playerId,
      tags: ['#debug'],
      dir,
      knockback,
    });
  const wall = (surfaceX: number) =>
    f.world.createCollider(
      ColliderDesc.cuboid(0.1, 2, 2)
        .setTranslation(surfaceX + 0.1, 2, 0)
        .setCollisionGroups(worldGroup),
    );
  cleanup.push(() => enemy.dispose());
  return { ...f, enemy, step, hit, wall };
}

it.each([
  ['assaulter', 'torso'],
  ['drone', 'hull'],
])(
  '%s flinches and returns to base without mutating simulation',
  (kind, nodeName) => {
    const f = combat(kind);
    const view = createEnemyView(f.enemy, false, f.bus);
    cleanup.push(() => view.dispose());
    const part = view.root.getObjectByName(nodeName)!;
    const pose = () => (kind === 'drone' ? part.parent! : part).rotation.z;
    view.render(1, 0);
    const base = pose();
    f.damage.deal(f.enemy.id, {
      amount: 2,
      tags: ['#status'],
      source: f.playerId,
      dir: east,
    });
    view.render(1, SIM_DT);
    expect(pose()).toBeCloseTo(base);
    f.hit(0);
    const current = structuredClone(f.enemy.current);
    const previous = structuredClone(f.enemy.previous);
    view.render(1, SIM_DT * 2);
    expect(pose()).toBeLessThan(base);
    view.render(1, tuning.vfx.enemyFlinchDurationS);
    expect(pose()).toBeCloseTo(base);
    expect(f.enemy.current).toEqual(current);
    expect(f.enemy.previous).toEqual(previous);
  },
);

it.each([
  { impulse: 10, distance: 0.85, slams: true },
  { impulse: 3, distance: 0.34, slams: false },
  { impulse: 10, distance: 4, slams: false },
])(
  'requires a real wall impact above the threshold ($impulse m/s at $distance m)',
  ({ impulse, distance, slams }) => {
    const f = combat();
    f.wall(distance);
    f.world.step();
    const impact = vi.fn();
    const damage = vi.fn();
    f.bus.on('enemy_wall_slam', impact);
    f.bus.on('damage_dealt', (event) => {
      if (event.tags.includes('#wall')) damage(event);
    });
    f.hit(impulse);
    for (let i = 0; i < 28; i++) f.step();
    expect(impact).toHaveBeenCalledTimes(Number(slams));
    expect(damage).toHaveBeenCalledTimes(Number(slams));
    expect(
      f.enemy.current.position.x + f.enemy.definition.body!.radius,
    ).toBeLessThanOrEqual(distance + 1e-4);
    if (slams) {
      expect(impact).toHaveBeenCalledWith(
        expect.objectContaining({
          point: expect.objectContaining({ x: expect.closeTo(distance, 3) }),
          normal: expect.objectContaining({ x: expect.closeTo(-1, 3) }),
        }),
      );
      expect(damage).toHaveBeenCalledWith(
        expect.objectContaining({
          source: f.playerId,
          amount: tuning.enemies.wallSlamDamage,
        }),
      );
      expect(f.enemy.current.state).toBe('stunned');
    }
  },
);

it('lifts the enemy, moves its head hurtbox into the prone pose and restores it on recovery', () => {
  const f = combat();
  f.world.step();
  const colliders = f.world.colliders.getAll();
  const head = colliders.find(
    (collider) => f.hurtboxes.get(collider.handle)?.headshot,
  )!;
  f.hit(14, { ...east, y: 0.15 });
  const proneStep = Math.ceil(f.settings.vfx.enemyKnockdown.fallS / SIM_DT) + 1;
  const recoveryStep = Math.ceil(f.settings.enemies.knockdownStunS / SIM_DT);
  let peak = 0;
  for (let i = 0; i < proneStep; i++) {
    f.step();
    peak = Math.max(peak, f.enemy.current.position.y);
  }
  expect(peak).toBeGreaterThan(0.15);
  expect(head.translation().y).toBeLessThan(0.75);
  expect(head.translation().x - f.enemy.current.position.x).toBeGreaterThan(
    0.4,
  );
  for (let i = proneStep; i < recoveryStep - 1; i++) f.step();
  expect(f.enemy.current.state).toBe('stunned');
  f.step();
  expect(f.enemy.current.state).toBe('idle');
  expect(head.translation().y).toBeCloseTo(f.enemy.definition.body!.headY, 1);
  expect(head.translation().x).toBeCloseTo(f.enemy.current.position.x, 3);
});

it.each(['assaulter', 'gunner'])(
  '%s uses stunOnHeavyS for a heavy hit without knockdown',
  (kind) => {
    const f = combat(kind);
    const stunned = vi.fn();
    f.bus.on('enemy_stunned', stunned);
    const durationS = f.enemy.definition.stunOnHeavyS;
    f.damage.deal(f.enemy.id, {
      amount: 1,
      source: f.playerId,
      tags: [PIERCE_BLOCK_TAG],
      dir: east,
      knockback: f.settings.enemies.stunKnockback / 2,
    });
    expect(stunned).toHaveBeenCalledExactlyOnceWith({
      id: f.enemy.id,
      durationS,
    });
    expect(f.enemy.current.state).toBe('stunned');
    expect(f.enemy.current.knockdown).toBeUndefined();
    const recoveryStep = Math.ceil(durationS / SIM_DT);
    for (let i = 0; i < recoveryStep - 1; i++) f.step();
    expect(f.enemy.current.state).toBe('stunned');
    f.step();
    expect(f.enemy.current.state).toBe('idle');
  },
);

it('knock accepts an optional world-space angle and rejects invalid arguments', async () => {
  const scene = new AiTest(false);
  cleanup.push(() => scene.dispose());
  const bus = new EventBus();
  const commands = new CommandRegistry();
  await scene.init(
    {
      bus,
      commands,
      rng: new Rng('knock-command'),
      tuning: structuredClone(tuning),
      debug: false,
      loop: new GameLoop({ step() {}, render() {} }),
      camera: new PerspectiveCamera(),
    },
    new ThreeScene(),
  );
  const hit = vi.fn<(event: GameEvents['damage_dealt']) => void>();
  bus.on('damage_dealt', hit);
  for (const invalid of ['knock east', 'knock Infinity', 'knock 90 0'])
    expect(commands.execute(invalid)).toBe('Uzycie: knock [kątDeg]');
  expect(hit).not.toHaveBeenCalled();

  expect(commands.execute('knock 90')).toBe('Odrzut zadany.');
  expect(hit).toHaveBeenCalledTimes(3);
  for (const [event] of hit.mock.calls) {
    expect(event.dir).toEqual({ x: 1, y: 0, z: expect.closeTo(0, 12) });
    expect(event.knockback).toBeGreaterThan(tuning.enemies.stunKnockback);
  }

  hit.mockClear();
  expect(commands.execute('knock')).toBe('Odrzut zadany.');
  expect(hit).toHaveBeenCalledTimes(3);
  const directions = hit.mock.calls.map(([event]) => event.dir!.x);
  expect(Math.min(...directions)).toBeLessThan(0);
  expect(Math.max(...directions)).toBeGreaterThan(0);
});

it.each(['assaulter', 'gunner', 'drone', 'turret', 'securityChief'])(
  'disables all %s colliders on death in the same step',
  (kind) => {
    const f = combat(kind);
    if (f.enemy instanceof Boss) {
      f.settings.enemies.phaseShiftS = 0;
      expect(f.enemy.setPhase(3)).toBe(true);
    }
    f.world.step();
    const colliders = f.world.colliders
      .getAll()
      .filter((c) => f.entities.byCollider(c.handle) === f.enemy.id);
    const y = kind === 'drone' ? f.enemy.current.position.y : 1.05;
    const ray = new Ray({ x: -2, y, z: 0 }, east);
    expect(f.world.castRay(ray, 4, true)).not.toBeNull();
    f.damage.deal(f.enemy.id, {
      amount: Number.MAX_VALUE,
      dir: east,
      tags: ['#debug'],
      source: f.playerId,
    });
    expect(f.enemy.current.state).toBe('dead');
    expect(f.enemy.removed).toBe(false);
    expect(colliders.length).toBeGreaterThan(0);
    expect(colliders.every((c) => !c.isValid())).toBe(true);
    expect(f.world.castRay(ray, 4, true)).toBeNull();
  },
);

it('keeps a directional death pose until the main shatter, with only chips on impact', () => {
  const f = combat();
  const view = createEnemyView(f.enemy, false, f.bus);
  const debris = new DebrisSystem({
    maxDebris: 100,
    tuning: f.settings.vfx,
    seed: 123,
  });
  const burst = vi.spyOn(debris, 'burst');
  const shatter = new EnemyShatter(f.bus, debris, {
    positionOf: (id) => (id === f.enemy.id ? f.enemy.current.position : null),
    collapse: {
      tuning: f.settings.enemies,
      ageOf: () => f.enemy.current.stateTimeS,
    },
    tuning: f.settings,
    settings: { flashes: true },
  });
  cleanup.push(
    () => view.dispose(),
    () => shatter.dispose(),
  );
  f.damage.deal(f.enemy.id, {
    amount: 100,
    point: { x: 0, y: 1, z: 0 },
    dir: east,
    tags: ['#debug'],
    source: f.playerId,
  });
  const frame = () => {
    f.step();
    shatter.step(SIM_DT);
    view.render(1);
  };
  for (let i = 0; i < 4; i++) frame();
  expect(view.root.visible).toBe(true);
  expect(view.root.position.x).toBeGreaterThan(0);
  expect(burst).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 5; i++) frame();
  expect(view.root.visible).toBe(false);
  expect(burst).toHaveBeenCalledTimes(3);
  expect(burst.mock.calls[1]?.[0].origin.x).toBeGreaterThan(
    tuning.enemies.deathCollapseSlideM,
  );
});

it('Pchnięcie przesuwa małą skrzynię i przewraca dekorację w stożku', () => {
  const f = setup();
  const props = new PropPhysicsSystem({ ...f, tuning: f.settings });
  const scatter = new ScatterProps({ ...f, tuning: f.settings });
  cleanup.push(
    () => props.dispose(),
    () => scatter.dispose(),
  );
  const size = { x: 0.5, y: 0.5, z: 0.5 };
  props.claim({
    model: 'crate_small',
    position: { x: 2, y: 0.25, z: -0.5 },
    size,
  });
  props.claim({ model: 'crate', position: { x: 2, y: 0.25, z: 0.5 }, size });
  props.claim({
    model: 'crate_small',
    position: { x: 8, y: 0.25, z: 0 },
    size,
  });
  scatter.add({
    model: 'city_traffic_cone',
    position: { x: 2, y: 0, z: 0 },
    yaw: 0,
  });
  scatter.add({
    model: 'city_traffic_cone',
    position: { x: -2, y: 0, z: 0 },
    yaw: 0,
  });
  f.world.step();
  const energy = new PlayerEnergy(
    f.playerId,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    f.bus,
    f.settings,
  );
  cleanup.push(() => energy.dispose());
  const push = new ResonancePush(
    pushDefinition,
    {
      owner: f.playerId,
      damage: f.damage,
      energy,
      aim: () => ({ origin: { x: 0, y: 1.5, z: 0 }, dir: east }),
      targets: () => [],
      castWall: () => null,
    },
    f.bus,
    f.settings,
  );
  expect(push.use()).toBe(0);
  expect(scatter.bodyCount).toBe(1);
  for (let i = 0; i < 10; i++) {
    f.world.step();
    props.step(SIM_DT);
    scatter.step(SIM_DT, {
      position: zero,
      velocity: zero,
      sliding: false,
      sprinting: false,
      dashS: 0,
    });
  }
  const crateX: number[] = [];
  props.forEach((prop) => crateX.push(prop.position.x));
  expect(crateX[0]).toBeGreaterThan(2.05);
  expect(crateX[1]).toBe(2);
  expect(crateX[2]).toBeCloseTo(8, 1);
  scatter.forEach((index, view) => {
    if (index === 0) expect(Math.abs(view.quat.z)).toBeGreaterThan(0.1);
    else expect(view.moving).toBe(false);
  });
  expect(props.entityIds().map((id) => f.damage.health(id)?.current)).toEqual([
    f.settings.props.smallCrateHealth,
    f.settings.props.crateHealth,
    f.settings.props.smallCrateHealth,
  ]);
});

it('cone skips wall predictions for a real enemy', () => {
  const f = combat();
  f.world.step();
  const energy = new PlayerEnergy(
    f.playerId,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    f.bus,
    f.settings,
  );
  cleanup.push(() => energy.dispose());
  const castWall = vi.fn(() => 1);
  const push = new ResonancePush(
    pushDefinition,
    {
      owner: f.playerId,
      damage: f.damage,
      energy,
      aim: () => ({ origin: { x: -2, y: 1, z: 0 }, dir: east }),
      targets: () => [
        { id: f.enemy.id, position: { x: 0, y: 1, z: 0 }, physical: true },
      ],
      castWall,
    },
    f.bus,
    f.settings,
  );
  expect(push.use()).toBe(1);
  for (let i = 0; i < 20; i++) {
    f.step();
    push.step(SIM_DT, { pressed: false, held: false, released: false });
  }
  expect(castWall).not.toHaveBeenCalled();
  expect(f.damage.health(f.enemy.id)?.current).toBe(60 - pushDefinition.damage);
});
