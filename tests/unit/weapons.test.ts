import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import type { ProjectileSpec } from '../../src/combat/weapons/projectiles';
import { Blaster } from '../../src/combat/weapons/blaster';
import {
  blasterDefinition,
  loadWeapon,
} from '../../src/combat/weapons/weaponSchema';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
const worlds: World[] = [];
beforeAll(async () => {
  rapier = await initPhysics();
});
afterEach(() => {
  for (const world of worlds.splice(0)) world.free();
});

function setup(capacity = tuning.weapons.maxProjectiles) {
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  worlds.push(world);
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const hurtboxes = new Hurtboxes();
  const damage = new DamageSystem(bus, entities);
  const settings = structuredClone(tuning);
  settings.weapons.maxProjectiles = capacity;
  const system = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const player = entities.create('player', 'player');
  const enemy = entities.create('trooper', 'enemy');
  const playerHealth = new Health(() => 100);
  const enemyHealth = new Health(() => 100);
  damage.register(player, playerHealth);
  damage.register(enemy, enemyHealth);
  const target = (id: number, z: number, group: number, filter: number) => {
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(0.4)
        .setTranslation(0, 0, z)
        .setCollisionGroups(interactionGroups(group, filter)),
    );
    hurtboxes.add(id, collider);
    entities.bindCollider(id, collider.handle);
    return collider;
  };
  target(player, -1, CollisionGroup.Player, CollisionGroup.EnemyProjectile);
  target(enemy, -3, CollisionGroup.Enemy, CollisionGroup.PlayerProjectile);
  world.step();
  const spec: ProjectileSpec = {
    owner: player,
    team: 'player',
    origin: { x: 0, y: 0, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
    speed: 60,
    damage: 20,
    tags: ['#gun'],
  };
  return {
    world,
    bus,
    entities,
    hurtboxes,
    damage,
    system,
    settings,
    spec,
    player,
    enemy,
    playerHealth,
    enemyHealth,
  };
}

describe('weapon data', () => {
  it('loads valid JSON and reports readable validation errors', () => {
    expect(loadWeapon(blasterDefinition)).toEqual(blasterDefinition);
    for (const data of [
      null,
      {},
      { ...blasterDefinition, fireRateHz: 0 },
      { ...blasterDefinition, damage: -1 },
      { ...blasterDefinition, projectileLifetimeS: Infinity },
      { ...blasterDefinition, heatPerShot: NaN },
      { ...blasterDefinition, tags: ['gun'] },
      { ...blasterDefinition, spreadDeg: -1 },
    ])
      expect(() => loadWeapon(data)).toThrow('Nieprawidłowe dane broni');
  });
});

describe('projectile pool with real Rapier', () => {
  it('sweeps through distance, ignores the player, deals damage once and destroys its entity', () => {
    const {
      system,
      spec,
      entities,
      bus,
      enemyHealth,
      playerHealth,
      enemy,
      player,
    } = setup();
    const dealt = vi.fn();
    const spawned = vi.fn();
    bus.on('damage_dealt', dealt);
    bus.on('projectile_spawned', spawned);
    const id = system.spawn(spec);
    expect(entities.kind(id)).toBe('projectile');
    expect(spawned).toHaveBeenCalledWith({ id, owner: player, team: 'player' });
    system.step(0.1);
    system.step(0.1);
    expect(enemyHealth.current).toBe(80);
    expect(playerHealth.current).toBe(100);
    expect(dealt).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        source: player,
        target: enemy,
        amount: 20,
        tags: ['#gun'],
        point: { x: 0, y: 0, z: expect.closeTo(-2.6) },
      }),
    );
    expect(system.activeCount).toBe(0);
    expect(entities.alive(id)).toBe(false);
  });

  it('returns world hits and expired projectiles to the pool, limits sweeps to lifetime', () => {
    const { system, world, spec, entities, enemyHealth } = setup();
    world.createCollider(
      rapier.ColliderDesc.cuboid(1, 1, 0.1)
        .setTranslation(0, 0, -2)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    world.step();
    const wall = system.spawn(spec);
    system.step(0.1);
    expect(entities.alive(wall)).toBe(false);
    expect(enemyHealth.current).toBe(100);
    const timed = system.spawn({ ...spec, lifetimeS: SIM_DT / 2 });
    system.step(0);
    expect(system.activeCount).toBe(1);
    system.step(SIM_DT);
    expect(system.activeCount).toBe(0);
    expect(entities.alive(timed)).toBe(false);
    const defaultLifetime = system.spawn({
      ...spec,
      dir: { x: 1, y: 0, z: 0 },
    });
    system.step(blasterDefinition.projectileLifetimeS - SIM_DT);
    expect(entities.alive(defaultLifetime)).toBe(true);
    system.step(SIM_DT);
    expect(entities.alive(defaultLifetime)).toBe(false);
  });

  it('enemy shots hit the player; reflection changes owner, registry team and collision filter', () => {
    const {
      system,
      spec,
      entities,
      bus,
      playerHealth,
      enemyHealth,
      player,
      enemy,
    } = setup();
    system.spawn({ ...spec, owner: enemy, team: 'enemy' });
    system.step(0.1);
    expect(playerHealth.current).toBe(80);
    const reflected = vi.fn();
    const dealt = vi.fn();
    bus.on('projectile_reflected', reflected);
    bus.on('damage_dealt', dealt);
    const id = system.spawn({
      ...spec,
      owner: enemy,
      team: 'enemy',
      dir: { x: 1, y: 0, z: 0 },
    });
    system.reflect(id, player, 'player', spec.dir);
    expect(entities.team(id)).toBe('player');
    expect(reflected).toHaveBeenCalledExactlyOnceWith({ id, newOwner: player });
    system.step(0.1);
    expect(playerHealth.current).toBe(80);
    expect(enemyHealth.current).toBe(80);
    expect(dealt).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ source: player, target: enemy }),
    );
    system.reflect(id, player, 'player', spec.dir);
    expect(reflected).toHaveBeenCalledTimes(1);
  });

  it('recycles the oldest active projectile at capacity and clears all entities on dispose', () => {
    const { system, entities, spec } = setup(2);
    const first = system.spawn(spec);
    const second = system.spawn(spec);
    const third = system.spawn(spec);
    expect(entities.alive(first)).toBe(false);
    expect(entities.alive(second)).toBe(true);
    expect(entities.alive(third)).toBe(true);
    expect(system.activeCount).toBe(2);
    const active: number[] = [];
    system.forEachActive((id) => active.push(id));
    expect(active.sort()).toEqual([second, third].sort());
    system.dispose();
    expect(system.activeCount).toBe(0);
    expect(entities.alive(second)).toBe(false);
    expect(entities.alive(third)).toBe(false);
  });
});

function weapon(
  seed = 'weapon-test',
  stats = new Stats({ heatCapacity: 100, coolingRate: 45 }),
) {
  const bus = new EventBus();
  const spawn = vi.fn<(spec: ProjectileSpec) => number>(() => 1);
  const settings = structuredClone(tuning);
  const rng = new Rng(seed);
  const blaster = new Blaster(1, { bus, rng, tuning: settings }, stats, {
    spawn,
  });
  const input = {
    triggerHeld: true,
    origin: { x: 0, y: 0, z: 0 },
    dir: { x: 0, y: 0, z: -1 },
  };
  return { blaster, bus, spawn, input, settings, stats, rng };
}

describe('blaster heat and timing', () => {
  it('adds heat, waits the cooling delay, then cools; emits shot and throttled cooling events', () => {
    const { blaster, input, bus } = weapon();
    const heat = vi.fn();
    const fired = vi.fn();
    bus.on('heat_changed', heat);
    bus.on('weapon_fired', fired);
    blaster.step(0, input);
    expect(blaster.shots).toBe(0);
    blaster.step(SIM_DT, input);
    expect(blaster.heat.current).toBe(14);
    expect(fired).toHaveBeenCalledExactlyOnceWith({
      owner: 1,
      weapon: 'blaster',
    });
    expect(heat).toHaveBeenLastCalledWith({
      id: 1,
      current: 14,
      max: 100,
      overheated: false,
    });
    for (let i = 0; i < 15; i++)
      blaster.step(SIM_DT, { ...input, triggerHeld: false });
    expect(blaster.heat.current).toBeCloseTo(14);
    for (let i = 0; i < 6; i++)
      blaster.step(SIM_DT, { ...input, triggerHeld: false });
    expect(blaster.heat.current).toBeCloseTo(9.5);
    heat.mockClear();
    for (let i = 0; i < 60; i++)
      blaster.step(SIM_DT, { ...input, triggerHeld: false });
    expect(blaster.heat.current).toBe(0);
    expect(heat.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('fires six shots in a second when held, with no burst after releasing the trigger', () => {
    const { blaster, input, spawn } = weapon();
    for (let i = 0; i < 60; i++) blaster.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(6);
    for (let i = 0; i < 120; i++)
      blaster.step(SIM_DT, { ...input, triggerHeld: false });
    blaster.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(7);
  });

  it('reaching capacity locks shots for overheatLockS while heat cools, then permits firing', () => {
    const { blaster, input, settings, bus } = weapon(
      'heat',
      new Stats({ heatCapacity: 28, coolingRate: 45 }),
    );
    const heat = vi.fn();
    bus.on('heat_changed', heat);
    blaster.step(SIM_DT, input);
    for (let i = 0; i < 10; i++) blaster.step(SIM_DT, input);
    expect(blaster.shots).toBe(2);
    expect(blaster.overheated).toBe(true);
    expect(blaster.heat.current).toBe(28);
    for (let i = 1; i < settings.weapons.overheatLockS / SIM_DT; i++)
      blaster.step(SIM_DT, input);
    expect(blaster.shots).toBe(2);
    expect(blaster.overheated).toBe(true);
    expect(blaster.heat.current).toBe(0);
    blaster.step(SIM_DT, input);
    expect(blaster.overheated).toBe(false);
    expect(blaster.shots).toBe(3);
    expect(
      heat.mock.calls.some(
        ([event]) => event.overheated === false && event.current === 0,
      ),
    ).toBe(true);
  });

  it('uses live Stats for capacity and cooling, and ignores hitstop for the lock', () => {
    const { blaster, input, stats } = weapon();
    stats.add({
      stat: 'heatCapacity',
      type: 'flat',
      value: 100,
      source: 'test',
    });
    stats.add({ stat: 'coolingRate', type: 'mult', value: 2, source: 'test' });
    blaster.overheat();
    expect(blaster.heat.current).toBe(200);
    blaster.step(0, input);
    expect(blaster.overheated).toBe(true);
    blaster.step(0.5, { ...input, triggerHeld: false });
    expect(blaster.heat.current).toBe(155);
  });

  it('produces deterministic normalized spread in an independent RNG stream', () => {
    const first = weapon('same');
    const second = weapon('same');
    const other = weapon('other');
    const state = first.rng.getState();
    for (let i = 0; i < 60; i++) {
      first.blaster.step(SIM_DT, first.input);
      second.blaster.step(SIM_DT, second.input);
      other.blaster.step(SIM_DT, other.input);
    }
    expect(first.spawn.mock.calls).toEqual(second.spawn.mock.calls);
    expect(first.spawn.mock.calls).not.toEqual(other.spawn.mock.calls);
    expect(first.rng.getState()).toBe(state);
    for (const [spec] of first.spawn.mock.calls) {
      expect(Math.hypot(spec.dir.x, spec.dir.y, spec.dir.z)).toBeCloseTo(1);
      expect((Math.acos(-spec.dir.z) * 180) / Math.PI).toBeLessThanOrEqual(
        blasterDefinition.spreadDeg,
      );
    }
  });
});
