import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { World } from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { SIM_DT } from '../../src/core/loop';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { StatusSystem } from '../../src/combat/status/statusSystem';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { Weapon } from '../../src/combat/weapons/weapon';
import {
  loadWeapon,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import { BeamRenderer } from '../../src/render/beamRenderer';
import { ExplosionRenderer } from '../../src/render/explosionRenderer';
import { getMaterial } from '../../src/render/materials';
import { Mesh } from 'three';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
const worlds: World[] = [];
beforeAll(async () => {
  rapier = await initPhysics();
});
afterEach(() => {
  for (const world of worlds.splice(0)) world.free();
  vi.restoreAllMocks();
});
const aim = {
  triggerHeld: true,
  origin: { x: 0, y: 0, z: 0 },
  dir: { x: 0, y: 0, z: -1 },
};

function setup() {
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  worlds.push(world);
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const hurtboxes = new Hurtboxes();
  const damage = new DamageSystem(bus, entities);
  const owner = entities.create('player', 'player');
  const positions = new Map<number, { x: number; y: number; z: number }>();
  const statuses = new StatusSystem(bus, damage, {
    position: (id) => positions.get(id) ?? null,
    targets: () => [...positions.keys()],
  });
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    tuning,
  );
  function target(x: number, y: number, z: number, existing?: number) {
    const id = existing ?? entities.create('dummy', 'enemy');
    const health = existing ? damage.health(id)! : new Health(() => 1000);
    if (!existing) damage.register(id, health);
    positions.set(id, { x, y, z });
    const collider = world.createCollider(
      rapier.ColliderDesc.ball(0.2)
        .setTranslation(x, y, z)
        .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
    );
    hurtboxes.add(id, collider);
    entities.bindCollider(id, collider.handle);
    world.step();
    return { id, health };
  }
  return {
    world,
    bus,
    entities,
    hurtboxes,
    damage,
    owner,
    statuses,
    projectiles,
    target,
  };
}

it('beam data excludes shot fields, requires automatic and positive tick parameters', () => {
  const def = weaponDefinitions.get('beam')!;
  expect(def).not.toHaveProperty('damage');
  for (const invalid of [
    { damage: 0 },
    { projectileSpeed: 5 },
    { automatic: false },
    { tickHz: 0 },
    { heatPerS: -1 },
  ])
    expect(() => loadWeapon({ ...def, ...invalid })).toThrow();
});

it('beam casts every positive step, deals tickHz ticks of dps/tickHz, heats per second, emits once and freezes in hitstop', () => {
  const { owner, bus, damage, projectiles, target } = setup();
  const t = target(0, 0, -2);
  const castBeam = vi.fn(() => ({
    target: t.id,
    distance: 2,
    point: { x: 0, y: 0, z: -2 },
  }));
  const def = loadWeapon({ ...weaponDefinitions.get('beam'), heatPerS: 20 });
  const weapon = new Weapon(
    owner,
    { bus, rng: new Rng('beam'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 0 }),
    { projectiles, damage, castBeam },
    def,
  );
  const dealt = vi.fn();
  const fired = vi.fn();
  bus.on('damage_dealt', dealt);
  bus.on('weapon_fired', fired);
  for (let i = 0; i < 60; i++) weapon.step(SIM_DT, aim);
  expect(castBeam).toHaveBeenCalledTimes(60);
  expect(castBeam).toHaveBeenLastCalledWith(aim.origin, aim.dir, 12);
  expect(dealt).toHaveBeenCalledTimes(10);
  expect(dealt.mock.calls.every(([event]) => event.amount === 4)).toBe(true);
  expect(t.health.current).toBe(960);
  expect(weapon.heat.current).toBeCloseTo(20);
  expect(fired).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 60; i++) weapon.step(0, aim);
  expect(dealt).toHaveBeenCalledTimes(10);
  expect(weapon.heat.current).toBeCloseTo(20);
  weapon.step(SIM_DT, { ...aim, triggerHeld: false });
  expect(weapon.beam?.active).toBe(false);
  weapon.step(SIM_DT, aim);
  expect(fired).toHaveBeenCalledTimes(2);
  weapon.overheat();
  weapon.step(SIM_DT, aim);
  expect(weapon.beam?.active).toBe(false);
  expect(castBeam).toHaveBeenCalledTimes(61);
  weapon.reset();
  expect(weapon.beam?.active).toBe(false);
});

it('beam ticks hit the current target, rejects out-of-range targets and stops casting on heat capacity', () => {
  const { owner, bus, damage, projectiles, target } = setup();
  const a = target(0, 0, -2),
    b = target(0, 0, -3);
  const hit = { target: a.id, distance: 2, point: { x: 0, y: 0, z: -2 } };
  const castBeam = vi.fn(() => hit);
  const weapon = new Weapon(
    owner,
    { bus, rng: new Rng('heat'), tuning },
    new Stats({ heatCapacity: 65, coolingRate: 0 }),
    { projectiles, damage, castBeam },
    weaponDefinitions.get('beam')!,
  );
  weapon.step(0.05, aim);
  hit.target = b.id;
  weapon.step(0.05, aim);
  expect(a.health.current).toBe(1000);
  expect(b.health.current).toBe(996);
  hit.distance = 13;
  for (let i = 0; i < 54; i++) weapon.step(SIM_DT, aim);
  expect(b.health.current).toBe(996);
  expect(weapon.heat.current).toBeCloseTo(65);
  // Floating point accumulation may leave a fraction below capacity.
  weapon.step(SIM_DT, aim);
  expect(weapon.overheated).toBe(true);
  const calls = castBeam.mock.calls.length;
  weapon.step(SIM_DT, aim);
  expect(castBeam).toHaveBeenCalledTimes(calls);
});

it('ballistic trajectory follows gravity exactly and hitstop does not move a projectile', () => {
  const { projectiles, owner } = setup();
  projectiles.spawn({
    owner,
    team: 'player',
    ...aim,
    speed: 10,
    damage: 1,
    tags: [],
    gravity: 12,
    lifetimeS: 3,
  });
  for (let i = 0; i < 60; i++) projectiles.step(SIM_DT);
  const pos = { x: 0, y: 0, z: 0 };
  projectiles.forEachActive((_id, p) => Object.assign(pos, p));
  expect(pos.y).toBeCloseTo(-6);
  expect(pos.z).toBeCloseTo(-10);
  projectiles.step(0);
  projectiles.forEachActive((_id, p) => expect(p).toEqual(pos));
});

it.each(['wall', 'floor', 'enemy', 'lifetime'])(
  'detonates on %s, damages each entity once in radius, excludes owner and applies EMP through StatusSystem',
  (kind) => {
    const {
      projectiles,
      owner,
      target,
      world,
      bus,
      statuses,
      damage,
      hurtboxes,
    } = setup();
    const near = target(1, 0, -1),
      far = target(6, 0, -1);
    target(1.1, 0, -1, near.id);
    const ownerHealth = new Health(() => 1000);
    damage.register(owner, ownerHealth);
    const ownerCollider = world.createCollider(
      rapier.ColliderDesc.ball(0.2).setTranslation(0, 0, -1),
    );
    hurtboxes.add(owner, ownerCollider);
    const direct = kind === 'enemy' ? target(0, 0, -1) : null;
    if (kind === 'wall')
      world.createCollider(
        rapier.ColliderDesc.cuboid(2, 2, 0.05)
          .setTranslation(0, 0, -1)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    if (kind === 'floor')
      world.createCollider(
        rapier.ColliderDesc.cuboid(2, 0.05, 2)
          .setTranslation(0, -1, -1)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    world.step();
    const explosion = vi.fn();
    const dealt = vi.fn();
    bus.on('explosion', explosion);
    bus.on('damage_dealt', dealt);
    projectiles.spawn({
      owner,
      team: 'player',
      ...aim,
      ...(kind === 'floor' ? { dir: { x: 0, y: -1, z: 0 } } : {}),
      speed: 10,
      damage: 2,
      tags: ['#gun'],
      lifetimeS: 0.2,
      explode: {
        radiusM: 3.5,
        damage: 8,
        tags: ['#gun', '#elektrycznosc'],
        statuses: [{ id: 'overload', durationS: 4, stacks: 2 }],
      },
    });
    projectiles.step(0.2);
    expect(explosion).toHaveBeenCalledTimes(1);
    expect(explosion.mock.calls[0]?.[0]).toMatchObject({
      owner,
      radiusM: 3.5,
      tags: ['#gun', '#elektrycznosc'],
    });
    const point = explosion.mock.calls[0]![0].point;
    expect(point.y).toBeCloseTo(kind === 'floor' ? -0.95 : 0);
    expect(point.z).toBeCloseTo(
      kind === 'floor'
        ? 0
        : kind === 'wall'
          ? -0.95
          : kind === 'enemy'
            ? -0.8
            : -2,
    );
    if (direct) {
      expect(direct.health.current).toBe(990);
      expect(statuses.stacks(direct.id, 'overload')).toBe(2);
    }
    expect(near.health.current).toBe(992);
    expect(far.health.current).toBe(1000);
    expect(ownerHealth.current).toBe(1000);
    expect(dealt.mock.calls.filter(([e]) => e.target === near.id)).toHaveLength(
      1,
    );
    expect(statuses.stacks(near.id, 'overload')).toBe(2);
    expect(statuses.remaining(near.id, 'overload')).toBe(4);
    expect(projectiles.activeCount).toBe(0);
    statuses.dispose();
  },
);

it('lob weapon copies explosion payload and semi trigger and heat behavior', () => {
  const bus = new EventBus();
  const spawn = vi.fn(() => 1);
  const weapon = new Weapon(
    1,
    { bus, rng: new Rng('emp'), tuning },
    new Stats({ heatCapacity: 100, coolingRate: 0 }),
    { projectiles: { spawn } },
    weaponDefinitions.get('emp')!,
  );
  for (let i = 0; i < 120; i++) weapon.step(SIM_DT, aim);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(weapon.heat.current).toBe(60);
  expect(spawn).toHaveBeenCalledWith(
    expect.objectContaining({
      damage: 2,
      gravity: 12,
      speed: 12,
      lifetimeS: 2,
      explode: {
        radiusM: 3.5,
        damage: 8,
        tags: ['#gun', '#elektrycznosc'],
        statuses: [{ id: 'overload', durationS: 4, stacks: 2 }],
      },
    }),
  );
});

it('resets gravity and explosion state on pool reuse, safely recycles during explosion damage and filters friendly targets', () => {
  const { world, entities, hurtboxes, damage, bus, owner, target } = setup();
  const settings = structuredClone(tuning);
  settings.weapons.maxProjectiles = 1;
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const enemy = target(1, 0, -1),
    friendly = target(-1, 0, -1);
  entities.setTeam(friendly.id, 'player');
  const explosion = vi.fn();
  bus.on('explosion', explosion);
  const plain = {
    owner,
    team: 'player' as const,
    ...aim,
    speed: 10,
    damage: 1,
    tags: ['#gun'],
    lifetimeS: 2,
  };
  bus.once('damage_dealt', () => projectiles.spawn(plain));
  projectiles.spawn({
    ...plain,
    gravity: 1,
    lifetimeS: 0.1,
    explode: { radiusM: 3.5, damage: 8, tags: ['#gun'] },
  });
  projectiles.step(0.1);
  expect(enemy.health.current).toBe(992);
  expect(friendly.health.current).toBe(1000);
  expect(explosion).toHaveBeenCalledTimes(1);
  expect(projectiles.activeCount).toBe(1);
  projectiles.step(0.1);
  projectiles.forEachActive((_id, pos) => {
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(-1);
  });
  projectiles.dispose();
  expect(explosion).toHaveBeenCalledTimes(1);
});

it('explosion excludes the owner even with friendly fire enabled', () => {
  const { projectiles, target, owner, damage, bus } = setup();
  const own = target(0, 0, 0, owner);
  // Existing owner has no health in this fixture until explicitly registered.
  const health = new Health(() => 100);
  damage.register(own.id, health);
  const explosion = vi.fn();
  bus.on('explosion', explosion);
  projectiles.spawn({
    owner,
    team: 'player',
    ...aim,
    speed: 1,
    damage: 1,
    tags: [],
    lifetimeS: 0.1,
    explode: { radiusM: 3.5, damage: 8, tags: ['#friendly_fire'] },
  });
  projectiles.step(0.1);
  expect(health.current).toBe(100);
  expect(explosion).toHaveBeenCalledTimes(1);
});

it('renderers reuse meshes, react to beam state and explosion events, expire and dispose owned resources', () => {
  const bus = new EventBus();
  const beam = new BeamRenderer();
  const explosion = new ExplosionRenderer(bus);
  const shared = vi.spyOn(getMaterial('player'), 'dispose');
  const mesh = beam.root.children[0] as Mesh;
  const geometry = vi.spyOn(mesh.geometry, 'dispose');
  beam.render({
    active: true,
    from: { x: 0, y: 0, z: 0 },
    to: { x: 0, y: 0, z: -8 },
  });
  expect(mesh.visible).toBe(true);
  expect(mesh.scale.y).toBe(8);
  expect(mesh.position.z).toBe(-4);
  beam.render(null);
  expect(mesh.visible).toBe(false);
  const meshes = [...explosion.root.children] as Mesh[];
  const sphereGeometry = vi.spyOn(meshes[0]!.geometry, 'dispose');
  const materials = meshes.map((m) =>
    vi.spyOn(
      Array.isArray(m.material) ? m.material[0]! : m.material,
      'dispose',
    ),
  );
  bus.emit('explosion', {
    point: { x: 1, y: 2, z: 3 },
    radiusM: 3.5,
    owner: 1,
    tags: [],
  });
  explosion.render(0.15);
  expect(meshes[0]!.visible).toBe(true);
  expect(meshes[0]!.scale.x).toBeCloseTo(1.75);
  explosion.render(0.15);
  expect(meshes[0]!.visible).toBe(false);
  expect(explosion.root.children).toEqual(meshes);
  beam.dispose();
  explosion.dispose();
  expect(shared).not.toHaveBeenCalled();
  expect(geometry).toHaveBeenCalledOnce();
  expect(sphereGeometry).toHaveBeenCalledOnce();
  for (const material of materials) expect(material).toHaveBeenCalledOnce();
  bus.emit('explosion', { point: aim.origin, radiusM: 1, owner: 1, tags: [] });
  expect(meshes.every((m) => !m.visible)).toBe(true);
});
