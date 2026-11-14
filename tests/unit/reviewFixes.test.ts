/**
 * Regresje znalezisk z przeglądu F1 (Codex, 2026-11-14): pocisk vs kapsuła ruchu wroga,
 * Pchnięcie w hitstopie, reset stanu walki, powtarzalność fal po „Jeszcze raz”.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { PlayerEnergy } from '../../src/combat/powers/energy';
import { pushDefinition, ResonancePush } from '../../src/combat/powers/push';
import { Blaster } from '../../src/combat/weapons/blaster';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import arenaWaves from '../../src/data/waves/arena.json';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { loadWaves, WaveDirector } from '../../src/world/waves';

const input = (held: Action[] = [], pressed: Action[] = []): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(pressed),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

let R: typeof RAPIER;
beforeAll(async () => {
  R = await initPhysics();
});

describe('pocisk a kapsuła ruchu wroga (P1)', () => {
  it('strzał w głowę przechodzi przez kapsułę ruchu i trafia sensor głowy ×1,5', () => {
    const bus = new EventBus();
    const world = new R.World({ x: 0, y: -20, z: 0 });
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
    const shooter = entities.create('player', 'player');
    const enemy = entities.create('gunner', 'enemy');
    const health = new Health(() => 100);
    damage.register(enemy, health);
    const groups = interactionGroups(CollisionGroup.Enemy, 0xffff);
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.92, -5),
    );
    // Kapsuła ruchu (jak EnemyBody): obejmuje całą sylwetkę, łącznie z głową — NIE jest hurtboxem.
    const movement = world.createCollider(
      R.ColliderDesc.capsule(0.57, 0.35).setCollisionGroups(groups),
      body,
    );
    entities.bindCollider(enemy, movement.handle);
    const head = world.createCollider(
      R.ColliderDesc.ball(0.2)
        .setTranslation(0, 1.65 - 0.92, 0)
        .setSensor(true)
        .setCollisionGroups(groups),
      body,
    );
    hurtboxes.add(enemy, head, 1.5);
    entities.bindCollider(enemy, head.handle);
    world.step();
    projectiles.spawn({
      owner: shooter,
      team: 'player',
      origin: { x: 0, y: 1.65, z: 0 },
      dir: { x: 0, y: 0, z: -1 },
      speed: 60,
      damage: 20,
      tags: ['#gun'],
    });
    for (let i = 0; i < 30; i++) projectiles.step(SIM_DT);
    expect(health.current).toBe(100 - 30);
    world.free();
  });

  it('ściana świata nadal zatrzymuje pocisk', () => {
    const bus = new EventBus();
    const world = new R.World({ x: 0, y: -20, z: 0 });
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
    const enemy = entities.create('gunner', 'enemy');
    const health = new Health(() => 100);
    damage.register(enemy, health);
    world.createCollider(
      R.ColliderDesc.cuboid(2, 2, 0.2)
        .setTranslation(0, 1, -2)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    const target = world.createCollider(
      R.ColliderDesc.ball(0.3)
        .setTranslation(0, 1, -5)
        .setSensor(true)
        .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
    );
    hurtboxes.add(enemy, target);
    world.step();
    projectiles.spawn({
      owner: 99,
      team: 'player',
      origin: { x: 0, y: 1, z: 0 },
      dir: { x: 0, y: 0, z: -1 },
      speed: 60,
      damage: 20,
      tags: [],
    });
    for (let i = 0; i < 30; i++) projectiles.step(SIM_DT);
    expect(health.current).toBe(100);
    expect(projectiles.activeCount).toBe(0);
    world.free();
  });
});

function pushSetup() {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  const enemy = registry.create('dummy', 'enemy');
  const health = new Health(() => 100);
  damage.register(enemy, health);
  const energy = new PlayerEnergy(
    player,
    new Stats({ maxEnergy: 100, energyRegen: 0 }),
    bus,
    tuning,
  );
  const push = new ResonancePush(
    pushDefinition,
    {
      owner: player,
      damage,
      energy,
      aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
      targets: () => [{ id: enemy, position: { x: 0, y: 1, z: -3 } }],
      castWall: () => null,
    },
    bus,
    tuning,
  );
  return { push, health, energy };
}

describe('Pchnięcie w hitstopie (P2)', () => {
  it('wciśnięcie przy dt = 0 nie działa od razu, wykonuje się w pierwszym kroku z dt > 0', () => {
    const c = pushSetup();
    c.push.step(0, input([], ['power']));
    c.push.step(0, input());
    expect(c.health.current).toBe(100);
    expect(c.energy.current).toBe(100);
    c.push.step(SIM_DT, input());
    expect(c.health.current).toBe(100 - pushDefinition.damage);
    expect(c.energy.current).toBe(100 - pushDefinition.cost);
  });

  it('reset kasuje odnowienie i kolejkę', () => {
    const c = pushSetup();
    c.push.step(SIM_DT, input([], ['power']));
    expect(c.push.cooldownRemaining).toBeGreaterThan(0);
    c.push.reset();
    expect(c.push.cooldownRemaining).toBe(0);
  });
});

describe('reset stanu walki (P2)', () => {
  it('Blaster.reset: zimny, bez przegrzania', () => {
    const bus = new EventBus();
    const projectiles = { spawn: () => 1 };
    const blaster = new Blaster(
      1,
      { bus, rng: new Rng('b'), tuning },
      new Stats({ heatCapacity: 100, coolingRate: 45 }),
      projectiles,
    );
    blaster.overheat();
    expect(blaster.overheated).toBe(true);
    blaster.reset();
    expect(blaster.overheated).toBe(false);
    expect(blaster.heat.current).toBe(0);
  });

  it('PlasmaBlade.reset: przerywa zamach i zdejmuje blok', () => {
    const bus = new EventBus();
    const registry = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, registry);
    const player = registry.create('player', 'player');
    const stats = new Stats({ maxHealth: 100 });
    const blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner: player,
        team: 'player',
        damage,
        stats,
        energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
        queryArc: () => [],
        aim: () => ({
          origin: { x: 0, y: 1.6, z: 0 },
          dir: { x: 0, y: 0, z: -1 },
        }),
      },
      bus,
      tuning,
    );
    blade.step(SIM_DT, input(['block']));
    expect(stats.modifiers('damageTaken')).toHaveLength(1);
    blade.reset();
    expect(blade.view().state).toBe('idle');
    expect(stats.modifiers('damageTaken')).toHaveLength(0);
    blade.step(SIM_DT, input(['attack'], ['attack']));
    expect(blade.view().stage).toBe(1); // combo od początku
  });
});

describe('powtarzalność fal po „Jeszcze raz” (P2)', () => {
  it('start(1, świeży fork) odtwarza ten sam przebieg spawnów', () => {
    const def = loadWaves(arenaWaves);
    const bus = new EventBus();
    const root = new Rng('review');
    let next = 100;
    const director = new WaveDirector(
      def,
      { spawn: () => next++, playerPosition: () => ({ x: 0, y: 0, z: 4 }) },
      bus,
      root.fork('waves'),
    );
    const run = () => {
      for (let i = 0; i < 400; i++) director.step(SIM_DT);
      return director.spawnLog.map((e) => `${e.enemy}@${e.x},${e.z}`);
    };
    director.start(1);
    const first = run();
    director.start(1, root.fork('waves'));
    const second = run();
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it('bez świeżego strumienia przebieg byłby inny (dowód, że test coś mierzy)', () => {
    const def = loadWaves(arenaWaves);
    const director = new WaveDirector(
      def,
      {
        spawn: (() => {
          let n = 1;
          return () => n++;
        })(),
        playerPosition: () => ({ x: 0, y: 0, z: 4 }),
      },
      new EventBus(),
      new Rng('review').fork('waves'),
    );
    director.start(3);
    for (let i = 0; i < 400; i++) director.step(SIM_DT);
    const first = director.spawnLog.map((e) => `${e.x},${e.z}`);
    director.start(3);
    for (let i = 0; i < 400; i++) director.step(SIM_DT);
    expect(director.spawnLog.map((e) => `${e.x},${e.z}`)).not.toEqual(first);
  });
});
