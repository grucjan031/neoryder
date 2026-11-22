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
import type {
  BossPattern,
  ShieldPattern,
  SummonPattern,
} from '../../src/enemies/enemySchema';
import { createEnemy, enemyDefinitions } from '../../src/enemies/registry';
import { EnemyView } from '../../src/enemies/enemyView';
import type { Enemy, EnemyDependencies } from '../../src/enemies/types';
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

interface SetupExtra {
  definition?: typeof definition;
  targetHeight?: number;
  spawnEnemy?: EnemyDependencies['spawnEnemy'];
  spawnPoints?: EnemyDependencies['spawnPoints'];
  /** Dowolna zmiana kopii danych bossa przed utworzeniem. */
  data?: (data: typeof definition) => void;
}

function setup(pattern?: BossPattern, seed = 'boss', extra: SetupExtra = {}) {
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
  const data = structuredClone(extra.definition ?? definition);
  if (pattern)
    for (const phase of data.boss!.phases) phase.patterns = [pattern];
  extra.data?.(data);
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
      ...(extra.spawnEnemy ? { spawnEnemy: extra.spawnEnemy } : {}),
      ...(extra.spawnPoints ? { spawnPoints: extra.spawnPoints } : {}),
      getTarget: () => ({ id: player, position, height: extra.targetHeight }),
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

describe('Dyrektor Systemów Orbis Grid', () => {
  const director = enemyDefinitions.get('orbisDirector')!;
  const phases = director.boss!.phases;
  const low = phases[1]!.patterns.find((p) => p.kind === 'laser')!;
  const high = phases[2]!.patterns.find((p) => p.kind === 'laser')!;
  const hack = phases[1]!.patterns.find((p) => p.kind === 'gridHack')!;

  it.each([
    ['stoi w niskiej linii', low, 1.8, 0.9, 0, true],
    ['skacze ponad niską linią', low, 1.8, 1.7, 0, false],
    ['stoi w wysokiej linii', high, 1.8, 0.9, 0, true],
    ['ślizga się pod wysoką linią', high, 1, 0.5, 0, false],
    ['schodzi z linii po zapowiedzi', high, 1.8, 0.9, 2, false],
  ] as const)('%s', (_, pattern, height, y, x, hit) => {
    const f = setup(pattern, 'laser', {
      definition: director,
      targetHeight: height,
    });
    expect(f.boss.forcePattern('laser')).toBe(true);
    expect(f.boss.current.field).toMatchObject({
      kind: 'laser',
      center: { x: 0, z: 4 },
    });
    f.position.y = y;
    f.position.x = x;
    const health = f.damage.health(f.player)!;
    const ticks = Math.ceil(pattern.telegraphS / SIM_DT);
    f.step(ticks - 1);
    expect(health.current).toBe(health.max);
    f.step();
    expect(health.current).toBe(health.max - (hit ? pattern.damage : 0));
  });

  it('zamraża położenie pola i celu teleportu, przenosi hurtbox i przerywa zapowiedź na progu HP', () => {
    const marker = { x: -5, y: 0, z: 6 };
    const f = setup(undefined, 'grid', {
      definition: director,
      spawnPoints: [marker],
    });
    expect(f.boss.forcePattern('gridHack')).toBe(true);
    expect(f.boss.current.field).toMatchObject({
      kind: 'gridHack',
      destination: marker,
    });
    const before = f.boss.current.position;
    f.position.x += hack.radiusM + 1;
    f.step(Math.ceil(hack.telegraphS / SIM_DT) - 1);
    expect(f.boss.current.position.x).toBe(before.x);
    f.step();
    expect(f.damage.health(f.player)?.current).toBe(1000);
    expect(f.boss.current.position.x).toBeCloseTo(marker.x);
    expect(f.boss.previous.position.x).toBeCloseTo(marker.x);
    const colliders = f.world.colliders
      .getAll()
      .filter((c) => f.entities.byCollider(c.handle) === f.boss.id);
    expect(colliders.length).toBeGreaterThan(0);
    for (const c of colliders) expect(c.translation().z).toBeCloseTo(marker.z);
    expect(f.boss.forcePattern('laser')).toBe(true);
    f.hit();
    expect(f.boss.phase).toBe(2);
    expect(f.boss.current.field).toBeUndefined();
    expect(f.hit()).toBe(0);
    f.step(Math.ceil(f.settings.enemies.phaseShiftS / SIM_DT));
    f.hit();
    expect(f.boss.phase).toBe(3);
    expect(f.hit()).toBe(0);
  });
});

describe('Orbis Grid: poprawki po przeglądzie', () => {
  const director = enemyDefinitions.get('orbisDirector')!;
  const fanPattern = director.boss!.phases[0]!.patterns.find(
    (p) => p.kind === 'fan',
  )!;
  const reflectOwnShot = (counter: boolean, hpFraction = 1) => {
    const f = setup(fanPattern, 'refl', {
      definition: director,
      data: (d) => {
        d.boss!.counterOnReflect = counter;
      },
    });
    const events: string[] = [];
    f.bus.on('damage_dealt', ({ target }) => {
      if (target === f.boss.id) events.push('damage');
    });
    f.bus.on('enemy_stunned', ({ id }) => {
      if (id === f.boss.id) events.push('stunned');
    });
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    f.step(1 + Math.ceil(fanPattern.telegraphS / SIM_DT));
    const hp = f.damage.health(f.boss.id)!;
    hp.apply({ amount: hp.max * (1 - hpFraction) });
    const before = hp.current;
    f.projectiles.reflect(
      spawn.mock.results[0]!.value as number,
      f.player,
      'player',
      {
        x: 0,
        y: 0,
        z: -1,
      },
    );
    for (let i = 0; i < 40 && events.length === 0; i++) {
      f.projectiles.step(SIM_DT);
      f.step();
    }
    return { f, events, lost: before - hp.current, hp };
  };

  it('okno kontry otwiera się po przyjęciu obrażeń i nie wzmacnia odbitego pocisku', () => {
    const base = reflectOwnShot(false);
    const withCounter = reflectOwnShot(true);
    expect(base.lost).toBeGreaterThan(0);
    expect(withCounter.lost).toBeCloseTo(base.lost);
    expect(withCounter.events.sort()).toEqual(['damage', 'stunned']);
  });

  it('trafienie odbitym pociskiem na progu fazy nie otwiera kontry', () => {
    const f = reflectOwnShot(true, 0.66);
    expect(f.events).toEqual(['damage']);
    expect(f.f.boss.phase).toBe(2);
  });

  it('koniec ogłuszenia kontry odpowiada końcowi okna zwiększonych obrażeń', () => {
    const { f } = reflectOwnShot(true);
    const { reflectCounterS } = f.settings.enemies;
    f.step(Math.ceil(reflectCounterS / SIM_DT) - 3);
    expect(f.boss.current.state).toBe('stunned');
    f.step();
    expect(f.boss.current.state).toBe('stunned');
    f.step();
    expect(f.boss.current.state).not.toBe('stunned');
  });

  it('gridHack bez znaczników jest pomijany w wyborze wzorca', () => {
    const f = setup(undefined, 'nomarkers', { definition: director });
    expect(f.boss.setPhase(2)).toBe(true);
    expect(f.boss.forcePattern('gridHack')).toBe(false);
    const kinds: string[] = [];
    f.bus.on('enemy_telegraph', ({ kind }) => kinds.push(kind));
    f.step(3000);
    expect(kinds.length).toBeGreaterThan(5);
    expect(kinds).not.toContain('gridHack');
  });

  it('teleport wybiera znacznik najdalszy od gracza i nie zajęty przez gracza', () => {
    const f = setup(undefined, 'far', {
      definition: director,
      spawnPoints: [
        { x: 0, y: 0, z: 4 },
        { x: 3, y: 0, z: 4 },
        { x: -9, y: 0, z: 8 },
        { x: 9, y: 0, z: 9 },
      ],
    });
    expect(f.boss.forcePattern('gridHack')).toBe(true);
    expect(f.boss.current.field).toMatchObject({
      kind: 'gridHack',
      destination: { x: 9, z: 9 },
    });
  });

  it('teleport bez ciała fizycznego aktualizuje pozycję bossa', () => {
    const marker = { x: -5, y: 0, z: 6 };
    const f = setup(undefined, 'nobody', {
      definition: director,
      spawnPoints: [marker],
    });
    (f.boss as unknown as { body: null }).body = null;
    expect(f.boss.forcePattern('gridHack')).toBe(true);
    const hack = director.boss!.phases[1]!.patterns.find(
      (p) => p.kind === 'gridHack',
    )!;
    f.step(Math.ceil(hack.telegraphS / SIM_DT));
    expect(f.boss.current.position.x).toBeCloseTo(marker.x);
    expect(f.boss.current.position.y).toBeCloseTo(
      f.settings.enemies.corpseS * 0 + director.body!.controllerOffset,
    );
  });
});

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
      phaseThresholds: [0.65, 0.3],
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

const summonSpec = definition.boss!.phases[1]!.patterns.find(
  (p): p is SummonPattern => p.kind === 'summon',
)!;
const shieldSpec = definition.boss!.phases[2]!.patterns.find(
  (p): p is ShieldPattern => p.kind === 'shield',
)!;
const spawnAreas = [
  { x: -8, y: 0, z: -8 },
  { x: 8, y: 0, z: -8 },
  { x: -8, y: 0, z: 8 },
  { x: 8, y: 0, z: 8 },
];

/** Sługa-atrapa zarejestrowana w DamageSystem, żeby dało się go zabić jak prawdziwego wroga. */
function minionFactory() {
  const made: {
    enemy: Enemy;
    position: { x: number; y: number; z: number };
  }[] = [];
  const ref: { f?: ReturnType<typeof setup> } = {};
  const spawnEnemy = vi.fn(
    (id: string, position: { x: number; y: number; z: number }) => {
      const f = ref.f!;
      const entity = f.entities.create(id, 'enemy');
      f.damage.register(entity, new Health(() => 50));
      const enemy = {
        id: entity,
        removed: false,
        current: { state: 'idle' },
      } as unknown as Enemy;
      f.bus.on('enemy_killed', ({ id: dead }) => {
        if (dead === entity) enemy.current.state = 'dead';
      });
      made.push({ enemy, position });
      return enemy;
    },
  );
  return {
    made,
    spawnEnemy,
    bind: (f: ReturnType<typeof setup>) => (ref.f = f),
  };
}

describe('F3-17 Boss: wezwanie, tarcza łamana', () => {
  it('waliduje wzorce summon i shield oraz przypisanie do faz w danych', () => {
    expect(
      definition.boss!.phases.map((phase) => phase.patterns.map((p) => p.kind)),
    ).toEqual([
      ['slam', 'fan'],
      ['slam', 'fan', 'summon'],
      ['slam', 'fan', 'summon', 'shield'],
    ]);
    const data = definition.boss!;
    const phase = (patterns: unknown[]) => ({
      ...data,
      phases: [{ hpThreshold: 1, patterns }],
    });
    expect(
      enemySchema.safeParse({ ...raw, boss: phase([slam, shieldSpec]) })
        .success,
    ).toBe(true);
    for (const patterns of [
      [summonSpec],
      [slam, { ...summonSpec, count: 0 }],
      [slam, { ...summonSpec, maxMinions: 0 }],
      [slam, { ...summonSpec, placement: 'nowhere' }],
      [slam, { ...shieldSpec, durability: 0 }],
      [slam, { ...shieldSpec, vulnerableMult: 0.5 }],
      [slam, { ...shieldSpec, stunS: 3, vulnerableS: 2 }],
    ])
      expect(
        enemySchema.safeParse({ ...raw, boss: phase(patterns) }).success,
      ).toBe(false);
  });

  it('wzywa sługi po telegrafie w punktach spawnu i nie przekracza maxMinions', () => {
    const { made, spawnEnemy, bind } = minionFactory();
    const f = setup(summonSpec, 'summon', {
      spawnEnemy,
      spawnPoints: spawnAreas,
    });
    bind(f);
    const telegraphs = vi.fn();
    f.bus.on('enemy_telegraph', telegraphs);
    f.step();
    expect(telegraphs).toHaveBeenCalledExactlyOnceWith({
      id: f.boss.id,
      kind: 'summon',
      durationS: summonSpec.telegraphS,
    });
    f.step(Math.round(summonSpec.telegraphS / SIM_DT) - 2);
    expect(made).toHaveLength(0);
    f.step(2);
    expect(made).toHaveLength(summonSpec.count);
    expect(spawnEnemy.mock.calls.every(([id]) => id === 'shielder')).toBe(true);
    const points = made.map((m) => m.position);
    expect(new Set(points).size).toBe(points.length);
    for (const point of points) expect(spawnAreas).toContainEqual(point);
    expect(f.boss.minionCount).toBe(2);
    // Drugie wezwanie dobija do limitu (3), kolejne wzorce nie są losowane.
    f.step(400);
    expect(made).toHaveLength(summonSpec.maxMinions);
    expect(telegraphs).toHaveBeenCalledTimes(2);
    expect(f.boss.minionCount).toBe(summonSpec.maxMinions);
    // Zabity sługa zwalnia miejsce.
    f.damage.deal(made[0]!.enemy.id, {
      source: f.player,
      amount: 999,
      tags: ['#gun'],
    });
    expect(f.boss.minionCount).toBe(summonSpec.maxMinions - 1);
    f.step(400);
    expect(made).toHaveLength(summonSpec.maxMinions + 1);
    expect(f.boss.minionCount).toBe(summonSpec.maxMinions);
  });

  it('bez punktów spawnu ustawia sługi w pierścieniu wokół bossa; bez spawnera pomija wzorzec', () => {
    const { made, spawnEnemy, bind } = minionFactory();
    const f = setup(summonSpec, 'ring', { spawnEnemy });
    bind(f);
    f.step(1 + Math.round(summonSpec.telegraphS / SIM_DT));
    expect(made).toHaveLength(summonSpec.count);
    const center = f.boss.current.position;
    for (const { position } of made)
      expect(
        Math.hypot(position.x - center.x, position.z - center.z),
      ).toBeCloseTo(summonSpec.radiusM, 5);
    const lone = setup(summonSpec, 'no-spawner');
    const telegraphs = vi.fn();
    lone.bus.on('enemy_telegraph', telegraphs);
    lone.step(300);
    expect(telegraphs).not.toHaveBeenCalled();
  });

  it('po śmierci bossa sługi giną razem z nim (źródło null, bez zasług gracza)', () => {
    const { made, spawnEnemy, bind } = minionFactory();
    const f = setup(summonSpec, 'death', {
      spawnEnemy,
      spawnPoints: spawnAreas,
    });
    bind(f);
    f.step(1 + Math.round(summonSpec.telegraphS / SIM_DT));
    expect(made).toHaveLength(2);
    expect(f.boss.setPhase(3)).toBe(true);
    f.step(Math.round(f.settings.enemies.phaseShiftS / SIM_DT));
    const killed = vi.fn();
    f.bus.on('enemy_killed', killed);
    expect(f.hit()).toBeGreaterThan(0);
    expect(killed.mock.calls.map(([e]) => e.id).sort()).toEqual(
      [f.boss.id, ...made.map((m) => m.enemy.id)].sort(),
    );
    for (const [event] of killed.mock.calls)
      if (event.id !== f.boss.id) expect(event.killer).toBeNull();
    expect(f.boss.minionCount).toBe(0);
  });

  describe('tarcza', () => {
    const withShield = () => {
      const f = setup(undefined, 'shield', {
        data: (data) => {
          for (const phase of data.boss!.phases)
            phase.patterns = [fan, shieldSpec];
        },
      });
      expect(f.boss.forcePattern('shield')).toBe(true);
      return f;
    };
    const raise = (f: ReturnType<typeof setup>) => {
      f.step(Math.round(shieldSpec.telegraphS / SIM_DT));
      expect(f.boss.shield).toBe(shieldSpec.durability);
      expect(f.boss.current.shieldUp).toBe(true);
    };
    const power = (f: ReturnType<typeof setup>, amount: number) =>
      f.damage.deal(f.boss.id, {
        source: f.player,
        amount,
        tags: ['#power'],
      });

    it('telegrafuje tarczę, zeruje obrażenia bez #power i zdejmuje wytrzymałość od #power', () => {
      const f = setup(undefined, 'shield', {
        data: (data) => {
          for (const phase of data.boss!.phases)
            phase.patterns = [fan, shieldSpec];
        },
      });
      const telegraphs = vi.fn();
      const shields = vi.fn();
      f.bus.on('enemy_telegraph', telegraphs);
      f.bus.on('boss_shield', shields);
      f.boss.forcePattern('shield');
      expect(telegraphs).toHaveBeenCalledExactlyOnceWith({
        id: f.boss.id,
        kind: 'shield',
        durationS: shieldSpec.telegraphS,
      });
      expect(f.boss.shield).toBe(0);
      raise(f);
      expect(shields).toHaveBeenLastCalledWith({
        id: f.boss.id,
        current: shieldSpec.durability,
        max: shieldSpec.durability,
      });
      expect(f.hit()).toBe(0);
      expect(
        f.damage.deal(f.boss.id, {
          source: f.player,
          amount: 500,
          tags: ['#melee', '#heavy'],
        }),
      ).toBe(0);
      expect(f.damage.health(f.boss.id)?.current).toBe(900);
      expect(f.boss.shield).toBe(shieldSpec.durability);
      expect(power(f, 50)).toBe(0);
      expect(f.boss.shield).toBe(shieldSpec.durability - 50);
      expect(shields).toHaveBeenLastCalledWith({
        id: f.boss.id,
        current: shieldSpec.durability - 50,
        max: shieldSpec.durability,
      });
      expect(f.damage.health(f.boss.id)?.current).toBe(900);
      // Cheaty debug przechodzą przez tarczę (kill all / hit).
      expect(
        f.damage.deal(f.boss.id, {
          source: f.player,
          amount: 10,
          tags: ['#debug'],
        }),
      ).toBe(10);
      expect(f.boss.shield).toBe(shieldSpec.durability - 50);
    });

    it('odbity pocisk bossa zdejmuje wytrzymałość, zwykły pocisk gracza nie', () => {
      const f = withShield();
      const spawn = vi.spyOn(f.projectiles, 'spawn');
      raise(f);
      const full = f.boss.shield;
      f.projectiles.spawn({
        owner: f.player,
        team: 'player',
        origin: { x: 0, y: 1.5, z: 3 },
        dir: { x: 0, y: 0, z: -1 },
        speed: 30,
        damage: 40,
        tags: ['#gun'],
      });
      for (let i = 0; i < 30; i++) f.projectiles.step(SIM_DT);
      expect(f.boss.shield).toBe(full);
      expect(f.damage.health(f.boss.id)?.current).toBe(900);
      spawn.mockClear();
      for (let i = 0; i < 600 && spawn.mock.calls.length === 0; i++) f.step();
      expect(spawn).toHaveBeenCalled();
      const shots = spawn.mock.results.map((r) => r.value as number);
      const before = f.boss.shield;
      f.projectiles.reflect(shots[0]!, f.player, 'player', {
        x: 0,
        y: 0,
        z: -1,
      });
      for (let i = 0; i < 30; i++) f.projectiles.step(SIM_DT);
      expect(f.boss.shield).toBeLessThan(before);
      expect(f.damage.health(f.boss.id)?.current).toBe(900);
    });

    it('złamanie: ogłuszenie, zdarzenia feel, okno zwiększonych obrażeń i powrót do normy', () => {
      const f = withShield();
      raise(f);
      const stunned = vi.fn(),
        hitstop = vi.fn(),
        shake = vi.fn(),
        telegraphs = vi.fn(),
        phases = vi.fn();
      f.bus.on('enemy_stunned', stunned);
      f.bus.on('hitstop', hitstop);
      f.bus.on('camera_shake', shake);
      f.bus.on('boss_phase', phases);
      expect(power(f, shieldSpec.durability - 1)).toBe(0);
      expect(f.boss.shield).toBe(1);
      expect(stunned).not.toHaveBeenCalled();
      expect(power(f, 5)).toBe(0);
      expect(f.boss.shield).toBe(0);
      expect(f.boss.current.shieldUp).toBe(false);
      expect(f.boss.current.state).toBe('stunned');
      expect(stunned).toHaveBeenCalledExactlyOnceWith({
        id: f.boss.id,
        durationS: shieldSpec.stunS,
      });
      expect(hitstop).toHaveBeenCalledExactlyOnceWith({
        ms: f.settings.enemies.shieldBreakHitstopMs,
      });
      expect(shake).toHaveBeenCalledOnce();
      f.bus.on('enemy_telegraph', telegraphs);
      // Ogłuszony boss nie zaczyna ataku; obrażenia są zwiększone w oknie.
      f.step(Math.round(shieldSpec.stunS / SIM_DT) - 2);
      expect(f.boss.current.state).toBe('stunned');
      expect(telegraphs).not.toHaveBeenCalled();
      expect(f.hit(100)).toBeCloseTo(100 * shieldSpec.vulnerableMult);
      f.step(5);
      expect(f.boss.current.state).not.toBe('stunned');
      f.step(Math.round((shieldSpec.vulnerableS - shieldSpec.stunS) / SIM_DT));
      expect(f.hit(10)).toBeCloseTo(10);
      expect(f.boss.stats.modifiers('damageTaken')).toHaveLength(0);
      expect(phases).not.toHaveBeenCalled();
    });

    it('niezłamana tarcza opada po durationS, a zmiana fazy zdejmuje ją od razu', () => {
      const f = withShield();
      raise(f);
      f.step(Math.round(shieldSpec.durationS / SIM_DT));
      expect(f.boss.shield).toBe(0);
      expect(f.boss.current.shieldUp).toBe(false);
      expect(f.hit(10)).toBe(10);
      const g = withShield();
      raise(g);
      expect(g.boss.setPhase(2)).toBe(true);
      expect(g.boss.shield).toBe(0);
      expect(g.boss.current.shieldUp).toBe(false);
    });
  });

  it('kolejność wzorców (z wezwaniem i tarczą) zależy tylko od seeda', () => {
    const sequence = (seed: string) => {
      const { spawnEnemy, bind } = minionFactory();
      const f = setup(undefined, seed, { spawnEnemy, spawnPoints: spawnAreas });
      bind(f);
      f.boss.setPhase(3);
      const kinds: string[] = [];
      f.bus.on('enemy_telegraph', ({ kind }) => kinds.push(kind));
      f.step(4000);
      return kinds;
    };
    const a = sequence('same');
    expect(new Set(a)).toEqual(new Set(['slam', 'aim', 'summon', 'shield']));
    expect(sequence('same')).toEqual(a);
    expect(sequence('different')).not.toEqual(a);
  });
});

describe('Boss: chód i czytelne ataki (animacja)', () => {
  it('w pościgu czas stanu płynie (animacja chodu nie stoi) i boss się przemieszcza', () => {
    const f = setup(slam, 'boss', {
      data: (d) => {
        d.attackRange = 0.5;
      },
    });
    f.step(30);
    const s = f.boss.current;
    expect(s.state).toBe('chase');
    expect(s.stateTimeS).toBeGreaterThan(25 * SIM_DT);
    expect(s.speed).toBeGreaterThan(0);
    expect(s.distance).toBeGreaterThan(0);
    expect(s.position.z).toBeGreaterThan(0);
  });

  it('wzorzec trafia do snapshotu na czas ataku, a pociski wachlarza wylatują z punktu broni', () => {
    const f = setup(fan);
    const spawn = vi.spyOn(f.projectiles, 'spawn');
    f.step();
    expect(f.boss.current.state).toBe('telegraph');
    expect(f.boss.current.attack).toEqual({
      kind: 'fan',
      telegraphS: fan.telegraphS,
      recoveryS: fan.recoveryS,
    });
    f.step(Math.round(fan.telegraphS / SIM_DT));
    expect(spawn).toHaveBeenCalled();
    const muzzle = definition.boss!.muzzle;
    const p = f.boss.current.position;
    for (const [spec] of spawn.mock.calls) {
      expect(spec.origin.x).toBeCloseTo(p.x + muzzle.x, 1);
      expect(spec.origin.y).toBeCloseTo(p.y + muzzle.y, 1);
      expect(spec.origin.z).toBeCloseTo(p.z + muzzle.z, 1);
    }
  });
});
