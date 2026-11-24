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
import { Weapon } from '../../src/combat/weapons/weapon';
import {
  loadWeapon,
  loadWeaponDefinitions,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../../src/combat/weapons/weaponSchema';

function definition(id: string): WeaponDefinition {
  return weaponDefinitions.get(id)!;
}

const input = {
  triggerHeld: true,
  origin: { x: 0, y: 0, z: 0 },
  dir: { x: 0, y: 0, z: -1 },
};

function setupWeapon(
  id: string,
  seed = 'fire-modes',
  overrides: Partial<WeaponDefinition> = {},
) {
  const bus = new EventBus();
  const rng = new Rng(seed);
  const spawn = vi.fn<(spec: ProjectileSpec) => number>(() => 1);
  const stats = new Stats({ heatCapacity: 1000, coolingRate: 0 });
  const weapon = new Weapon(
    1,
    { bus, rng, tuning },
    stats,
    { projectiles: { spawn } },
    loadWeapon({ ...definition(id), ...overrides }),
  );
  return {
    weapon: weapon as Weapon & {
      readonly definition: Exclude<WeaponDefinition, { fireMode: 'beam' }>;
    },
    bus,
    rng,
    spawn,
    stats,
  };
}

describe('fire mode data', () => {
  it('loads all firearm JSON definitions and excludes the blade', () => {
    expect([...weaponDefinitions.keys()].sort()).toEqual([
      'beam',
      'blaster',
      'crossbow',
      'emp',
      'pistol',
      'revolver',
      'rifle',
      'scatter',
      'smg',
      'sniper',
    ]);
    for (const def of weaponDefinitions.values()) {
      expect(loadWeapon(def)).toEqual(def);
      expect(def.tags).toContain('#gun');
      expect(def.name.length).toBeGreaterThan(0);
    }
  });

  it('rejects duplicate ids, unknown and future modes, invalid mode fields and statuses', () => {
    expect(() =>
      loadWeaponDefinitions([definition('pistol'), definition('pistol')]),
    ).toThrow('Powtórzone id broni: pistol');
    for (const raw of [
      { ...definition('pistol'), fireMode: 'unknown' },
      { ...definition('pistol'), fireMode: 'beam' },
      { ...definition('pistol'), fireMode: 'lob' },
      { ...definition('pistol'), automatic: undefined },
      { ...definition('pistol'), name: '' },
      { ...definition('pistol'), statuses: [{ id: 'burning', durationS: 0 }] },
      {
        ...definition('pistol'),
        statuses: [{ id: 'burning', durationS: 1, stacks: 0 }],
      },
      ...[1, 2.5].map((pellets) => ({ ...definition('scatter'), pellets })),
      ...[0, 1.5].map((pierceCount) => ({
        ...definition('sniper'),
        pierceCount,
      })),
      ...[-0.1, 1.1].map((pierceFalloff) => ({
        ...definition('sniper'),
        pierceFalloff,
      })),
    ])
      expect(() => loadWeapon(raw)).toThrow('Nieprawidłowe dane broni');
  });
});

describe('Weapon', () => {
  it.each(['pistol', 'rifle', 'scatter', 'sniper'])(
    '%s spawns the mode payload and adds heat once per shot',
    (id) => {
      const { weapon, spawn, bus } = setupWeapon(id);
      const fired = vi.fn();
      bus.on('weapon_fired', fired);
      weapon.step(SIM_DT, input);
      const def = weapon.definition;
      expect(spawn).toHaveBeenCalledTimes(
        def.fireMode === 'spread' ? def.pellets : 1,
      );
      for (const [spec] of spawn.mock.calls) {
        expect(spec.damage).toBe(def.damage);
        expect(spec.speed).toBe(def.projectileSpeed);
        expect(spec.lifetimeS).toBe(def.projectileLifetimeS);
        expect(spec.pierce).toEqual(
          def.fireMode === 'pierce'
            ? { count: def.pierceCount, falloff: def.pierceFalloff }
            : undefined,
        );
      }
      expect(weapon.heat.current).toBe(def.heatPerShot);
      expect(weapon.shots).toBe(1);
      expect(fired).toHaveBeenCalledExactlyOnceWith({ owner: 1, weapon: id });
    },
  );

  it('semi fires only on press edges, discards presses during cooldown and ignores held trigger after cooling', () => {
    const { weapon, spawn } = setupWeapon('pistol');
    weapon.step(0, input);
    weapon.step(SIM_DT, input);
    weapon.step(SIM_DT, { ...input, triggerHeld: false });
    weapon.step(SIM_DT, input);
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(1);
    weapon.step(SIM_DT, { ...input, triggerHeld: false });
    weapon.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('auto fires at fireRateHz and does not accumulate shots while released', () => {
    const { weapon, spawn } = setupWeapon('rifle');
    for (let i = 0; i < 60; i++) weapon.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(10);
    for (let i = 0; i < 120; i++)
      weapon.step(SIM_DT, { ...input, triggerHeld: false });
    weapon.step(SIM_DT, input);
    expect(spawn).toHaveBeenCalledTimes(11);
  });

  it('locks at heat capacity; semi requires another press after lock expiry', () => {
    const { weapon, stats } = setupWeapon('scatter');
    stats.setBase('heatCapacity', weapon.definition.heatPerShot);
    stats.setBase('coolingRate', 100);
    weapon.step(SIM_DT, input);
    expect(weapon.overheated).toBe(true);
    weapon.step(0, { ...input, triggerHeld: false });
    expect(weapon.overheated).toBe(true);
    for (let i = 0; i < 120; i++) weapon.step(SIM_DT, input);
    expect(weapon.overheated).toBe(false);
    expect(weapon.heat.current).toBe(0);
    expect(weapon.shots).toBe(1);
    weapon.step(SIM_DT, { ...input, triggerHeld: false });
    weapon.step(SIM_DT, input);
    expect(weapon.shots).toBe(2);
  });

  it.each([
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 },
    { x: 0.6, y: 0, z: -0.8 },
  ])('spread stays in a deterministic normalized cone around %j', (dir) => {
    const a = setupWeapon('scatter', 'same');
    const b = setupWeapon('scatter', 'same');
    const c = setupWeapon('scatter', 'different');
    const state = a.rng.getState();
    for (const instance of [a, b, c])
      instance.weapon.step(SIM_DT, { ...input, dir });
    expect(a.spawn.mock.calls).toEqual(b.spawn.mock.calls);
    expect(a.spawn.mock.calls).not.toEqual(c.spawn.mock.calls);
    expect(a.rng.getState()).toBe(state);
    for (const [spec] of a.spawn.mock.calls) {
      const d = spec.dir;
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
      expect(d.x * dir.x + d.y * dir.y + d.z * dir.z).toBeGreaterThanOrEqual(
        Math.cos((a.weapon.definition.spreadDeg * Math.PI) / 180),
      );
    }
    a.weapon.reset();
    a.weapon.step(SIM_DT, { ...input, dir });
    expect(a.spawn.mock.calls.slice(0, 8)).toEqual(a.spawn.mock.calls.slice(8));
  });
});

let rapier: Awaited<ReturnType<typeof initPhysics>>;
const worlds: World[] = [];
beforeAll(async () => {
  rapier = await initPhysics();
});
afterEach(() => {
  for (const world of worlds.splice(0)) world.free();
});

function setupProjectiles(capacity = 16) {
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  worlds.push(world);
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const hurtboxes = new Hurtboxes();
  const damage = new DamageSystem(bus, entities);
  const settings = structuredClone(tuning);
  settings.weapons.maxProjectiles = capacity;
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const owner = entities.create('player', 'player');
  function target(
    z: number,
    team: 'player' | 'enemy' = 'enemy',
    existing?: number,
  ) {
    const id = existing ?? entities.create('dummy', team);
    const health = new Health(() => 1000);
    if (!existing) damage.register(id, health);
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(0.5)
        .setTranslation(0, 0, z)
        .setCollisionGroups(
          interactionGroups(
            team === 'enemy' ? CollisionGroup.Enemy : CollisionGroup.Player,
            0xffff,
          ),
        ),
    );
    entities.bindCollider(id, collider.handle);
    hurtboxes.add(id, collider);
    world.step();
    return { id, health, collider };
  }
  const spec: ProjectileSpec = {
    ...input,
    owner,
    team: 'player',
    speed: 60,
    damage: 80,
    tags: ['#gun'],
    pierce: { count: 3, falloff: 0.25 },
  };
  return {
    world,
    bus,
    entities,
    damage,
    hurtboxes,
    projectiles,
    owner,
    target,
    spec,
  };
}

describe('piercing sweeps with real Rapier', () => {
  it('rykoszet odbija lustrzanie od ściany raz, zużywa resztę kroku i ginie na następnej ścianie', () => {
    const { world, projectiles, spec, entities } = setupProjectiles();
    for (const z of [-4, 4])
      world.createCollider(
        rapier.ColliderDesc.cuboid(100, 2, 0.05)
          .setTranslation(0, 0, z)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    world.step();
    const id = projectiles.spawn({
      ...spec,
      dir: { x: 1, y: 0, z: -1 },
      ricochets: 1,
    });
    projectiles.step(0.1);
    const inspect = vi.fn();
    projectiles.forEachActive(inspect);
    const [, pos, dir] = inspect.mock.calls[0]!;
    expect(dir.x).toBeCloseTo(Math.SQRT1_2);
    expect(dir.z).toBeCloseTo(Math.SQRT1_2);
    expect(dir.y).toBe(0);
    expect(pos.x).toBeCloseTo(6 * Math.SQRT1_2, 3);
    expect(pos.z).toBeCloseTo(6 * Math.SQRT1_2 - 7.9, 3);
    expect(entities.alive(id)).toBe(true);
    projectiles.step(0.3);
    expect(projectiles.activeCount).toBe(0);
    expect(entities.alive(id)).toBe(false);
  });

  it('rykoszet nie odbija się od wroga i nie odnawia czasu życia ani licznika po użyciu puli', () => {
    const { world, projectiles, spec, target } = setupProjectiles(1);
    const enemy = target(-2);
    projectiles.spawn({ ...spec, pierce: undefined, ricochets: 1 });
    projectiles.step(0.1);
    expect(enemy.health.current).toBe(920);
    expect(projectiles.activeCount).toBe(0);
    world.removeCollider(enemy.collider, true);
    world.createCollider(
      rapier.ColliderDesc.cuboid(10, 2, 0.05)
        .setTranslation(0, 0, -1)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    world.step();
    projectiles.spawn({ ...spec, ricochets: 1, lifetimeS: 0.05 });
    projectiles.step(0.05);
    expect(projectiles.activeCount).toBe(0);
    projectiles.spawn({ ...spec, ricochets: 1 });
    projectiles.step(0.05);
    expect(projectiles.activeCount).toBe(1);
    projectiles.spawn(spec);
    projectiles.step(0.05);
    expect(projectiles.activeCount).toBe(0);
  });
  it('hits count distinct entities in one sweep, skips all hurtboxes of a hit entity and applies multiplicative falloff', () => {
    const { target, projectiles, spec, bus, entities } = setupProjectiles();
    const targets = [-2, -4, -6, -8].map((z) => target(z));
    target(-3, 'enemy', targets[0]!.id);
    const dealt = vi.fn();
    bus.on('damage_dealt', dealt);
    const id = projectiles.spawn(spec);
    projectiles.step(0.2);
    expect(
      dealt.mock.calls.map(([event]) => [event.target, event.amount]),
    ).toEqual(targets.slice(0, 3).map((t, i) => [t.id, 80 * 0.75 ** i]));
    expect(targets.map((t) => t.health.current)).toEqual([920, 940, 955, 1000]);
    expect(projectiles.activeCount).toBe(0);
    expect(entities.alive(id)).toBe(false);
  });

  it('does not hit the same target across steps, expires while penetrating and resets pooled hit state', () => {
    const { target, projectiles, spec } = setupProjectiles(1);
    const a = target(-2);
    target(-2.2, 'enemy', a.id);
    const b = target(-4);
    projectiles.spawn({ ...spec, speed: 1, lifetimeS: 2 });
    for (let i = 0; i < 150; i++) projectiles.step(SIM_DT);
    expect(a.health.current).toBe(920);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(0);
    projectiles.spawn({ ...spec, pierce: undefined });
    projectiles.step(0.2);
    expect(a.health.current).toBe(840);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(0);
  });

  it('a wall stops a piercing projectile before the next target', () => {
    const { target, projectiles, spec, world } = setupProjectiles();
    const a = target(-2);
    const b = target(-6);
    world.createCollider(
      rapier.ColliderDesc.cuboid(2, 2, 0.05)
        .setTranslation(0, 0, -4)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    world.step();
    projectiles.spawn(spec);
    projectiles.step(0.2);
    expect(a.health.current).toBe(920);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(0);
  });

  it.each([0, 1])('supports falloff boundary %s and count one', (falloff) => {
    const { target, projectiles, spec } = setupProjectiles();
    const a = target(-2);
    const b = target(-4);
    projectiles.spawn({ ...spec, pierce: { count: 2, falloff } });
    projectiles.step(0.2);
    expect(a.health.current).toBe(920);
    expect(b.health.current).toBe(1000 - 80 * (1 - falloff));
    projectiles.spawn({ ...spec, pierce: { count: 1, falloff } });
    projectiles.step(0.2);
    expect(a.health.current).toBe(840);
    expect(b.health.current).toBe(1000 - 80 * (1 - falloff));
  });

  it('carries weapon statuses through ProjectileSpec to DamageInfo and damage events, clears them on reuse', () => {
    const { target, projectiles, damage, bus, owner } = setupProjectiles(1);
    target(-2);
    const statuses = [{ id: 'overload', durationS: 2, stacks: 2 }];
    const def = loadWeapon({ ...definition('pistol'), spreadDeg: 0, statuses });
    const weapon = new Weapon(
      owner,
      { bus, rng: new Rng('status'), tuning },
      new Stats({ heatCapacity: 100 }),
      { projectiles },
      def,
    );
    const deal = vi.spyOn(damage, 'deal');
    const event = vi.fn();
    bus.on('damage_dealt', event);
    weapon.step(SIM_DT, input);
    projectiles.step(0.1);
    expect(deal.mock.calls[0]?.[1].statuses).toEqual(statuses);
    expect(event.mock.calls[0]?.[0].statuses).toEqual(statuses);
    const plain = new Weapon(
      owner,
      { bus, rng: new Rng('status'), tuning },
      new Stats({ heatCapacity: 100 }),
      { projectiles },
      loadWeapon({ ...def, statuses: undefined }),
    );
    plain.step(SIM_DT, input);
    projectiles.step(0.1);
    expect(deal.mock.calls[1]?.[1]).not.toHaveProperty('statuses');
  });

  it('interception preserves the piercing budget and reflection clears hit history while keeping damage falloff', () => {
    const { target, projectiles, spec, owner } = setupProjectiles();
    const a = target(-2);
    const b = target(-4);
    const c = target(0, 'player');
    const off = projectiles.addInterceptor((hit) => {
      if (hit.target !== b.id) return false;
      projectiles.reflect(hit.projectile, b.id, 'enemy', { x: 0, y: 0, z: 1 });
      return true;
    });
    projectiles.spawn(spec);
    projectiles.step(0.2);
    expect(a.health.current).toBe(920);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(1);
    projectiles.step(0.2);
    expect(c.health.current).toBe(940);
    expect(projectiles.activeCount).toBe(1);
    let id = 0;
    projectiles.forEachActive((active) => {
      id = active;
    });
    projectiles.reflect(id, owner, 'player', { x: 0, y: 0, z: -1 });
    off();
    projectiles.step(0.4);
    expect(a.health.current).toBe(875);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(0);
  });

  it('does not continue the old sweep when a damage handler recycles its slot', () => {
    const { target, projectiles, spec, bus } = setupProjectiles(1);
    const a = target(-2);
    const b = target(-4);
    bus.once('damage_dealt', () =>
      projectiles.spawn({
        ...spec,
        pierce: undefined,
        dir: { x: 1, y: 0, z: 0 },
      }),
    );
    projectiles.spawn(spec);
    projectiles.step(0.2);
    expect(a.health.current).toBe(920);
    expect(b.health.current).toBe(1000);
    expect(projectiles.activeCount).toBe(1);
  });
});
