import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import {
  DamageSystem,
  Health,
  Hurtboxes,
  PIERCE_BLOCK_TAG,
} from '../../src/combat/damage';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { EntityId } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import {
  directorConfigSchema,
  EnemyDirector,
} from '../../src/enemies/director';
import type { DirectorConfig } from '../../src/enemies/director';
import { enemySchema } from '../../src/enemies/enemySchema';
import { EnemyManager } from '../../src/enemies/manager';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';
import aiTestData from '../../src/data/scenes/aiTest.json';
import arenaData from '../../src/data/scenes/arena.json';
import assaulterRaw from '../../src/data/enemies/assaulter.json';

const config = (patch: Partial<DirectorConfig> = {}): DirectorConfig => ({
  attackTokens: 2,
  shotTokens: 1,
  maxHoldS: 4,
  reassignS: 1,
  probeHeightM: 0.5,
  slots: {
    melee: { count: 4, offsetDeg: 0 },
    shot: { count: 4, offsetDeg: 45 },
  },
  ...patch,
});

function pure(patch: Partial<DirectorConfig> = {}) {
  const bus = new EventBus();
  const positions = new Map<EntityId, Vec3>();
  let target: { id: EntityId; position: Vec3 } | null = {
    id: 0,
    position: { x: 0, y: 1, z: 0 },
  };
  let blocked: (to: Vec3) => boolean = () => false;
  const director = new EnemyDirector(bus, config(patch), {
    target: () => target,
    position: (id) => positions.get(id) ?? null,
    clear: (_from, to) => !blocked(to),
  });
  return {
    bus,
    director,
    place: (id: EntityId, x: number, z: number) =>
      positions.set(id, { x, y: 0, z }),
    setTarget: (t: typeof target) => (target = t),
    block: (fn: (to: Vec3) => boolean) => (blocked = fn),
    step: (n = 1, dt = SIM_DT) => {
      for (let i = 0; i < n; i++) director.step(dt);
    },
  };
}

describe('EnemyDirector — tokeny', () => {
  it('limits simultaneous melee attacks and keeps the token for its holder', () => {
    const { director } = pure();
    expect(director.requestToken(1, 'melee')).toBe(true);
    expect(director.requestToken(2, 'melee')).toBe(true);
    expect(director.requestToken(3, 'melee')).toBe(false);
    expect(director.requestToken(1, 'melee')).toBe(true);
    // Pule są osobne: strzał nie zużywa tokenu wręcz.
    expect(director.requestToken(4, 'shot')).toBe(true);
    expect(director.requestToken(5, 'shot')).toBe(false);
    // Posiadacz tokenu wręcz nie dostaje naraz tokenu strzału.
    expect(director.requestToken(1, 'shot')).toBe(false);
    expect(director.snapshot().tokens).toEqual({ melee: [1, 2], shot: [4] });
  });

  it('hands a released shot token to the longest waiting enemy (suppressive fire alternates)', () => {
    const { director, step } = pure();
    const order: EntityId[] = [];
    let holder: EntityId | null = null;
    for (let tick = 0; tick < 40; tick++) {
      for (const id of [1, 2, 3]) {
        if (holder === id) continue;
        if (holder === null && director.requestToken(id, 'shot')) {
          holder = id;
          order.push(id);
        } else if (holder !== null) director.requestToken(id, 'shot');
      }
      // Każda seria trwa 5 kroków.
      if (holder !== null && tick % 5 === 4) {
        director.releaseToken(holder);
        holder = null;
      }
      step();
    }
    expect(order.slice(0, 6)).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('drops waiting entries that were not renewed in a step, but not during hitstop', () => {
    const { director, step } = pure({ shotTokens: 1 });
    expect(director.requestToken(1, 'shot')).toBe(true);
    expect(director.requestToken(2, 'shot')).toBe(false);
    step(1, 0);
    expect(director.snapshot().waiting.shot).toEqual([2]);
    step();
    expect(director.requestToken(3, 'shot')).toBe(false);
    step();
    expect(director.snapshot().waiting.shot).toEqual([3]);
    director.releaseToken(1);
    expect(director.requestToken(3, 'shot')).toBe(true);
  });

  it('frees tokens on death, despawn, stun and the stunned status', () => {
    const { bus, director } = pure({ attackTokens: 4 });
    for (const id of [1, 2, 3, 4]) director.requestToken(id, 'melee');
    bus.emit('enemy_killed', { id: 1, killer: null, tags: [] });
    bus.emit('entity_despawned', { id: 2 });
    bus.emit('enemy_stunned', { id: 3, durationS: 0.6 });
    bus.emit('status_applied', {
      target: 4,
      status: 'stunned',
      stacks: 1,
      durationS: 1,
      source: null,
    });
    expect(director.snapshot().tokens.melee).toEqual([]);
    director.requestToken(5, 'melee');
    bus.emit('status_applied', {
      target: 5,
      status: 'burning',
      stacks: 1,
      durationS: 1,
      source: null,
    });
    expect(director.snapshot().tokens.melee).toEqual([5]);
  });

  it('returns a token held longer than maxHoldS', () => {
    const { director, step } = pure({ attackTokens: 1, maxHoldS: 0.5 });
    expect(director.requestToken(1, 'melee')).toBe(true);
    step(Math.round(0.5 / SIM_DT));
    expect(director.requestToken(2, 'melee')).toBe(false);
    step(2);
    expect(director.requestToken(2, 'melee')).toBe(true);
    expect(director.requestToken(1, 'melee')).toBe(false);
  });
});

describe('EnemyDirector — sloty flankowania', () => {
  it('assigns the nearest free slot on the enemy radius and keeps it while renewed', () => {
    const { director, place, step } = pure();
    place(1, 5, 0.2);
    place(2, 5, 0);
    const a = director.slot(1, 'melee', 4);
    expect(a?.x).toBeCloseTo(4);
    expect(a?.z).toBeCloseTo(0);
    expect(a?.y).toBe(1);
    // Slot +X zajęty: drugi wróg dostaje najbliższy wolny (+Z wygrywa remis niższym indeksem).
    const b = director.slot(2, 'melee', 4);
    expect(b?.x).toBeCloseTo(0);
    expect(b?.z).toBeCloseTo(4);
    step();
    expect(director.slot(1, 'melee', 4)?.x).toBeCloseTo(4);
    // Inny promień, ten sam kąt.
    expect(director.slot(1, 'melee', 2)?.x).toBeCloseTo(2);
    expect(director.snapshot().slots.melee).toEqual([2, 1, null, null]);
  });

  it('follows the target and releases slots that were not renewed', () => {
    const { director, place, setTarget, step } = pure();
    place(1, 0, 6);
    expect(director.slot(1, 'shot', 8)).not.toBeNull();
    setTarget({ id: 0, position: { x: 10, y: 1, z: 10 } });
    const moved = director.slot(1, 'shot', 8);
    expect(Math.hypot((moved?.x ?? 0) - 10, (moved?.z ?? 0) - 10)).toBeCloseTo(
      8,
    );
    step();
    step();
    expect(director.snapshot().slots.shot).toEqual([null, null, null, null]);
    setTarget(null);
    expect(director.slot(1, 'shot', 8)).toBeNull();
  });

  it('skips slots blocked by the world and returns null when none is free', () => {
    const { director, place, block } = pure();
    block((to) => to.x > 1);
    place(1, 5, 0);
    const slot = director.slot(1, 'melee', 4);
    expect(slot?.x).not.toBeCloseTo(4);
    place(2, 0, 5);
    place(3, 0, -5);
    place(4, -5, 0);
    director.slot(2, 'melee', 4);
    director.slot(3, 'melee', 4);
    expect(director.slot(4, 'melee', 4)).toBeNull();
  });

  it('reassigns slots globally every reassignS so enemies do not cross through the player', () => {
    const { director, place, step } = pure({ reassignS: 0.5 });
    place(1, 5, 0);
    place(2, -5, 0);
    director.slot(1, 'melee', 4);
    director.slot(2, 'melee', 4);
    expect(director.snapshot().slots.melee).toEqual([null, 1, null, 2]);
    // Wrogowie zamienili się stronami (np. gracz przebiegł przez grupę).
    place(1, -5, 0);
    place(2, 5, 0);
    const steps = Math.round(0.5 / SIM_DT);
    for (let i = 0; i < steps; i++) {
      director.slot(1, 'melee', 4);
      director.slot(2, 'melee', 4);
      step();
    }
    expect(director.snapshot().slots.melee).toEqual([null, 2, null, 1]);
    expect(director.slot(1, 'melee', 4)?.x).toBeCloseTo(-4);
  });

  it('forgets everything on reset and dispose', () => {
    const { bus, director, place } = pure();
    place(1, 5, 0);
    director.requestToken(1, 'melee');
    director.slot(1, 'melee', 4);
    director.reset();
    expect(director.snapshot()).toEqual({
      tokens: { melee: [], shot: [] },
      waiting: { melee: [], shot: [] },
      slots: {
        melee: [null, null, null, null],
        shot: [null, null, null, null],
      },
    });
    director.dispose();
    director.requestToken(1, 'melee');
    // Po dispose dyrektor nie słucha już zdarzeń.
    bus.emit('enemy_stunned', { id: 1, durationS: 1 });
    expect(director.snapshot().tokens.melee).toEqual([1]);
  });

  it('validates scene data and the assaulter flank radius', () => {
    expect(directorConfigSchema.parse(aiTestData.director).attackTokens).toBe(
      2,
    );
    expect(directorConfigSchema.parse(arenaData.director).shotTokens).toBe(2);
    expect(() =>
      directorConfigSchema.parse({ ...config(), attackTokens: 0 }),
    ).toThrow();
    expect(() =>
      enemySchema.parse({ ...assaulterRaw, flankDistanceM: 1 }),
    ).toThrow(/Promień krążenia/);
  });
});

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});

function arena(patch: Partial<DirectorConfig>) {
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
    RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0),
  );
  const collider = world.createCollider(
    ColliderDesc.capsule(0.55, 0.35).setCollisionGroups(
      interactionGroups(CollisionGroup.Player, 0xffff),
    ),
    body,
  );
  hurtboxes.add(player, collider);
  entities.bindCollider(player, collider.handle);
  damage.register(player, new Health(() => 1e9));
  const projectiles = new ProjectileSystem(
    world,
    entities,
    hurtboxes,
    damage,
    bus,
    settings,
  );
  const manager = new EnemyManager(
    { bus, rng: new Rng('director'), tuning: settings },
    {
      world,
      entities,
      damage,
      hurtboxes,
      projectiles,
      getTarget: () => ({ id: player, position: { x: 0, y: 0.9, z: 0 } }),
    },
    { director: config(patch) },
  );
  world.step();
  cleanup.push(() => {
    manager.dispose();
    projectiles.dispose();
    world.free();
  });
  const step = (): void => {
    damage.step(SIM_DT);
    manager.step(SIM_DT);
    world.timestep = SIM_DT;
    world.step();
    projectiles.step(SIM_DT);
  };
  return { bus, damage, manager, step };
}

describe('EnemyDirector — wrogowie w Rapierze', () => {
  const ring = (n: number, radius: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: Math.sin((i / n) * Math.PI * 2) * radius,
      y: 0,
      z: Math.cos((i / n) * Math.PI * 2) * radius,
    }));
  const melee8 = {
    slots: {
      melee: { count: 8, offsetDeg: 0 },
      shot: { count: 4, offsetDeg: 45 },
    },
  };

  it('never lets more than attackTokens assaulters attack at once and rotates the tokens', () => {
    const { bus, manager, step } = arena({ attackTokens: 2, ...melee8 });
    const enemies = ring(5, 9).map((p) => manager.spawn('assaulter', p));
    const attackers = new Set<EntityId>();
    bus.on('enemy_telegraph', ({ id }) => attackers.add(id));
    let maxAttacking = 0;
    for (let i = 0; i < 6 / SIM_DT; i++) {
      step();
      const attacking = enemies.filter((e) =>
        ['telegraph', 'swing'].includes(e.current.state),
      ).length;
      maxAttacking = Math.max(maxAttacking, attacking);
    }
    expect(maxAttacking).toBe(2);
    expect(attackers.size).toBeGreaterThan(2);
  });

  it('keeps assaulters without a token circling in slots at flank distance', () => {
    const { bus, manager, step } = arena({ attackTokens: 2, ...melee8 });
    const enemies = ring(8, 9).map((p) => manager.spawn('assaulter', p));
    const attackers = new Set<EntityId>();
    bus.on('enemy_telegraph', ({ id }) => attackers.add(id));
    for (let i = 0; i < 2.5 / SIM_DT; i++) step();
    const holders = manager.director?.snapshot().tokens.melee ?? [];
    const waiting = enemies.filter(
      (e) => !attackers.has(e.id) && !holders.includes(e.id),
    );
    expect(waiting.length).toBeGreaterThan(0);
    for (const e of waiting) {
      expect(e.current.state).toBe('chase');
      expect(
        Math.hypot(e.current.position.x, e.current.position.z),
      ).toBeCloseTo(assaulterRaw.flankDistanceM, 0);
    }
    const slots = manager.director?.snapshot().slots.melee ?? [];
    for (const e of waiting) expect(slots).toContain(e.id);
  });

  it('makes gunners take turns: never two at once with one shot token, alternating', () => {
    const { bus, manager, step } = arena({ shotTokens: 1 });
    const gunners = [
      manager.spawn('gunner', { x: -6, y: 0, z: -6 }),
      manager.spawn('gunner', { x: 6, y: 0, z: -6 }),
    ];
    const shooters: EntityId[] = [];
    bus.on('enemy_telegraph', ({ id, kind }) => {
      if (kind === 'aim') shooters.push(id);
    });
    for (let i = 0; i < 10 / SIM_DT; i++) {
      step();
      const firing = gunners.filter((g) =>
        ['aim', 'burst'].includes(g.current.state),
      ).length;
      expect(firing).toBeLessThanOrEqual(1);
    }
    expect(shooters.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < shooters.length; i++)
      expect(shooters[i]).not.toBe(shooters[i - 1]);
  });

  it('passes the token on when the holder is stunned by a heavy hit and frees it on death', () => {
    const { damage, manager, step } = arena({ attackTokens: 1 });
    const a = manager.spawn('assaulter', { x: 0, y: 0, z: 3 });
    const b = manager.spawn('assaulter', { x: 3, y: 0, z: 0 });
    for (let i = 0; i < 5; i++) step();
    const director = manager.director;
    expect(director?.snapshot().tokens.melee).toEqual([a.id]);
    damage.deal(a.id, { amount: 1, source: null, tags: [PIERCE_BLOCK_TAG] });
    expect(a.current.state).toBe('stunned');
    for (let i = 0; i < 2; i++) step();
    expect(director?.snapshot().tokens.melee).toEqual([b.id]);
    damage.deal(b.id, { amount: 1e9, source: null, tags: [] });
    expect(director?.snapshot().tokens.melee).toEqual([]);
  });
});
