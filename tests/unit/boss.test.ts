import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ColliderDesc } from '@dimforge/rapier3d-compat';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Rng } from '../../src/core/rng';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { Boss } from '../../src/enemies/boss';
import { enemySchema } from '../../src/enemies/enemySchema';
import type { BossPattern } from '../../src/enemies/enemySchema';
import { createEnemy, enemyDefinitions } from '../../src/enemies/registry';
import { EnemyView } from '../../src/enemies/enemyView';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';
import raw from '../../src/data/enemies/securityChief.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
  vi.restoreAllMocks();
});
const definition = enemySchema.parse(raw);
const slam = definition.boss!.phases[0]!.patterns.find(
  (p) => p.kind === 'slam',
)!;
const fan = definition.boss!.phases[0]!.patterns.find((p) => p.kind === 'fan')!;

function setup(pattern?: BossPattern, seed = 'boss') {
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
  const playerStats = new Stats({ maxHealth: 1000 });
  damage.register(player, new Health(() => playerStats.get('maxHealth')), {
    stats: playerStats,
  });
  const position = { x: 0, y: 1, z: 4 };
  const collider = world.createCollider(
    ColliderDesc.capsule(0.5, 0.35)
      .setTranslation(position.x, position.y, position.z)
      .setCollisionGroups(interactionGroups(CollisionGroup.Player, 0xffff)),
  );
  entities.bindCollider(player, collider.handle);
  hurtboxes.add(player, collider);
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const data = structuredClone(definition);
  if (pattern)
    for (const phase of data.boss!.phases) phase.patterns = [pattern];
  const spawned = vi.fn();
  bus.on('boss_spawned', spawned);
  const boss = new Boss(
    { bus, rng: new Rng(seed), tuning: settings },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => ({ id: player, position }),
    },
    data,
    { x: 0, y: 0, z: 0 },
  );
  world.step();
  cleanup.push(() => {
    boss.dispose();
    projectiles.dispose();
    world.free();
  });
  const step = (count = 1, dt = SIM_DT) => {
    for (let i = 0; i < count; i++) {
      damage.step(dt);
      boss.step(dt);
      if (dt > 0) world.step();
    }
  };
  const hit = (amount = Number.MAX_VALUE) =>
    damage.deal(boss.id, { source: player, amount, tags: ['#gun'] });
  const fire = () => {
    step();
    step(Math.ceil((pattern?.telegraphS ?? fan.telegraphS) / SIM_DT));
  };
  return {
    bus,
    entities,
    damage,
    hurtboxes,
    settings,
    world,
    player,
    playerStats,
    collider,
    position,
    projectiles,
    boss,
    spawned,
    step,
    hit,
    fire,
  };
}

describe('F3-16 Boss', () => {
  it('validates data, required body/boss, descending HP thresholds and pattern parameters', () => {
    expect(enemyDefinitions.get('securityChief')).toEqual(definition);
    expect(definition.threatCost).toBeUndefined();
    const data = definition.boss!;
    for (const boss of [
      undefined,
      { ...data, phases: [] },
      { ...data, phases: [{ ...data.phases[0], hpThreshold: 0.9 }] },
      { ...data, phases: [data.phases[0], data.phases[0]] },
      { ...data, phases: [{ hpThreshold: 1, patterns: [] }] },
      {
        ...data,
        phases: [{ hpThreshold: 1, patterns: [{ ...slam, radiusM: 0 }] }],
      },
      {
        ...data,
        phases: [
          { hpThreshold: 1, patterns: [{ ...fan, projectileCount: 0 }] },
        ],
      },
    ])
      expect(enemySchema.safeParse({ ...raw, boss }).success).toBe(false);
    expect(enemySchema.safeParse({ ...raw, body: undefined }).success).toBe(
      false,
    );
    const f = setup();
    const second = createEnemy(
      { bus: f.bus, rng: new Rng('registry'), tuning: f.settings },
      {
        world: f.world,
        entities: f.entities,
        damage: f.damage,
        hurtboxes: f.hurtboxes,
        projectiles: f.projectiles,
        getTarget: () => null,
      },
      'securityChief',
      { x: 10, y: 0, z: 0 },
    );
    expect(second).toBeInstanceOf(Boss);
    second.dispose();
  });

  it('emits spawn once, clips after damageTaken, gates each phase in simulation time and dies only in the final phase', () => {
    const f = setup();
    const phases = vi.fn(),
      killed = vi.fn(),
      health = vi.fn();
    f.bus.on('boss_phase', phases);
    f.bus.on('enemy_killed', killed);
    f.bus.on('health_changed', health);
    expect(f.spawned).toHaveBeenCalledExactlyOnceWith({
      id: f.boss.id,
      name: definition.boss!.name,
      maxHealth: 900,
    });
    f.boss.stats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: 2,
      source: 'test',
    });
    expect(f.hit(200)).toBe(315);
    expect(f.damage.health(f.boss.id)?.current).toBe(585);
    expect(f.boss.phase).toBe(2);
    expect(f.hit()).toBe(0);
    f.step(100, 0);
    expect(f.hit()).toBe(0);
    f.step(Math.round(f.settings.enemies.phaseShiftS / SIM_DT) - 1);
    expect(f.hit()).toBe(0);
    f.step();
    expect(f.hit()).toBe(315);
    expect(f.boss.phase).toBe(3);
    expect(f.hit()).toBe(0);
    f.step(Math.round(f.settings.enemies.phaseShiftS / SIM_DT));
    expect(f.hit()).toBe(270);
    expect(killed).toHaveBeenCalledOnce();
    expect(phases.mock.calls.map(([p]) => p)).toEqual([
      { id: f.boss.id, phase: 2, phases: 3 },
      { id: f.boss.id, phase: 3, phases: 3 },
    ]);
    expect(health.mock.calls.map(([p]) => p.current)).toEqual([585, 270, 0]);
    expect(f.boss.current.state).toBe('dead');
    f.step(Math.ceil(f.settings.enemies.corpseS / SIM_DT));
    expect(f.boss.removed).toBe(true);
    expect(f.damage.health(f.boss.id)).toBeUndefined();
  });

  it.each([0.2, 3, 5.5, 6, 10])(
    'telegraphs slam before damage and checks the sphere at impact (distance %s)',
    (distance) => {
      const f = setup(slam);
      const order: string[] = [];
      f.bus.on('enemy_telegraph', ({ kind }) => order.push(kind));
      f.bus.on('damage_dealt', ({ target }) => {
        if (target === f.player) order.push('damage');
      });
      f.step();
      expect(order).toEqual(['slam']);
      // Wyjście z zapowiadanego promienia także po rozpoczęciu ataku.
      f.position.y = 0;
      f.position.z = distance;
      f.step(Math.round(slam.telegraphS / SIM_DT) - 1);
      expect(order).toEqual(['slam']);
      f.position.y = f.boss.current.position.y;
      f.position.x = f.boss.current.position.x;
      f.position.z = f.boss.current.position.z + distance;
      f.step();
      expect(order).toEqual(distance <= 5.5 ? ['slam', 'damage'] : ['slam']);
      f.step(3);
      expect(f.damage.health(f.player)?.current).toBe(
        distance <= 5.5 ? 970 : 1000,
      );
    },
  );

  it('cancels a telegraphed attack on a phase change and emits no damage during the shift', () => {
    const f = setup(slam);
    f.step();
    f.hit();
    const telegraphs = vi.fn();
    f.bus.on('enemy_telegraph', telegraphs);
    f.step(Math.round(f.settings.enemies.phaseShiftS / SIM_DT));
    expect(f.damage.health(f.player)?.current).toBe(1000);
    expect(telegraphs).not.toHaveBeenCalled();
    f.step();
    expect(telegraphs).toHaveBeenCalledOnce();
  });

  it('keeps the enlarged capsule above the floor and respects target invulnerability and damage modifiers', () => {
    const f = setup(slam);
    const health = f.damage.health(f.player)!;
    let invulnerable = true;
    f.damage.register(f.player, health, { invulnerable: () => invulnerable });
    f.boss.stats.add({
      stat: 'damage',
      type: 'mult',
      value: 2,
      source: 'test',
    });
    f.fire();
    expect(health.current).toBe(1000);
    invulnerable = false;
    f.step(180);
    expect(health.current).toBeLessThan(1000);
    expect((1000 - health.current) % (slam.damage * 2)).toBe(0);
    expect(f.boss.current.position.y).toBeGreaterThanOrEqual(0);
    expect(f.boss.current.position.y).toBeLessThan(0.1);
  });

  it('spawns a symmetric #gun fan only after the telegraph and actual blade parry reflects it into the boss', () => {
    const f = setup(fan);
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    const parried = vi.fn(),
      reflected = vi.fn();
    f.bus.on('parry_success', parried);
    f.bus.on('projectile_reflected', reflected);
    f.step();
    f.step(Math.round(fan.telegraphS / SIM_DT) - 1);
    expect(spawn).not.toHaveBeenCalled();
    f.step();
    expect(spawn).toHaveBeenCalledTimes(
      fan.kind === 'fan' ? fan.projectileCount : 0,
    );
    const shots = spawn.mock.calls.map(([spec]) => spec);
    expect(shots.every((spec) => spec.tags?.join() === '#gun')).toBe(true);
    expect(shots[0]!.dir.x).toBeCloseTo(-shots.at(-1)!.dir.x);
    const blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner: f.player,
        team: 'player',
        damage: f.damage,
        stats: f.playerStats,
        energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
        queryArc: () => [],
        aim: () => ({ origin: f.position, dir: { x: 0, y: 0, z: -1 } }),
        projectiles: f.projectiles,
        positionOf: () => f.boss.current.position,
      },
      f.bus,
      f.settings,
    );
    const off = f.projectiles.addInterceptor(blade.interceptProjectile);
    cleanup.unshift(() => {
      off();
      blade.dispose();
    });
    for (let i = 0; i < 60; i++) {
      blade.step(SIM_DT, {
        held: new Set(i >= 5 ? ['block'] : []),
        pressed: new Set(),
        released: new Set(),
        lookDelta: { x: 0, y: 0 },
      });
      f.projectiles.step(SIM_DT);
    }
    expect(parried).toHaveBeenCalledOnce();
    expect(reflected).toHaveBeenCalledOnce();
    expect(f.damage.health(f.player)?.current).toBe(1000);
    expect(f.damage.health(f.boss.id)?.current).toBe(
      900 - fan.damage * f.settings.melee.parryDamageMult,
    );
  });

  it('chooses identical patterns from the same seed independently of entity IDs', () => {
    const sequence = (seed: string) => {
      const f = setup(undefined, seed);
      const kinds: string[] = [];
      f.bus.on('enemy_telegraph', ({ kind }) => kinds.push(kind));
      f.step(2400);
      return kinds;
    };
    const a = sequence('same');
    expect(a.length).toBeGreaterThan(10);
    expect(new Set(a).size).toBe(2);
    expect(sequence('same')).toEqual(a);
    expect(sequence('different')).not.toEqual(a);
  });

  it('supports debug phases, reuses the enemy view, and disposes idempotently', () => {
    const f = setup();
    for (const n of [0, 4, NaN, 1.5]) expect(f.boss.setPhase(n)).toBe(false);
    expect(f.boss.setPhase(3)).toBe(true);
    expect(f.damage.health(f.boss.id)?.current).toBe(270);
    expect(f.hit()).toBe(0);
    const view = new EnemyView(f.boss, false);
    view.render(0.5);
    expect(view.root.visible).toBe(true);
    view.dispose();
    const removed = vi.fn();
    f.bus.on('entity_despawned', removed);
    f.boss.dispose();
    f.boss.dispose();
    expect(removed).toHaveBeenCalledExactlyOnceWith({ id: f.boss.id });
    expect(f.boss.setPhase(1)).toBe(false);
  });
});
