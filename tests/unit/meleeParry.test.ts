import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health } from '../../src/combat/damage';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';

const input = (held: Action[] = []): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

/** Gracz patrzy w -Z; wróg stoi z przodu (z = -2) albo za plecami (z = +2). */
function setup(enemyZ = -2, knowsPosition = true) {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  const enemy = registry.create('trooper', 'enemy');
  const stats = new Stats({ maxHealth: 100, maxEnergy: 100 });
  const health = new Health(() => 100);
  damage.register(player, health, { stats });
  damage.register(enemy, new Health(() => 100));
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
      positionOf: (id) =>
        knowsPosition && id === enemy ? { x: 0, y: 0, z: enemyZ } : null,
    },
    bus,
    structuredClone(tuning),
  );
  let parried = 0;
  const successes: {
    defender: number;
    projectile: number | null;
    attacker: number | null;
  }[] = [];
  const points: { x: number; y: number; z: number }[] = [];
  bus.on('melee_parried', ({ point }) => {
    parried++;
    points.push(point);
  });
  bus.on('parry_success', (e) => successes.push(e));
  const hit = (tags: string[]) =>
    damage.deal(player, { amount: 20, source: enemy, tags });
  const stepFor = (s: number, held: Action[]) => {
    for (let i = 0; i < Math.round(s / SIM_DT); i++)
      blade.step(SIM_DT, input(held));
  };
  return {
    hit,
    stepFor,
    health,
    blade,
    parried: () => parried,
    successes,
    points,
    enemy,
    player,
  };
}

describe('parowanie ciosów wręcz', () => {
  it('addGuard zwraca funkcję, która zdejmuje obronę', () => {
    const bus = new EventBus();
    const registry = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, registry);
    const target = registry.create('player', 'player');
    damage.register(target, new Health(() => 100));
    let calls = 0;
    const off = damage.addGuard(target, () => {
      calls++;
      return 0;
    });
    expect(damage.deal(target, { amount: 10, source: null, tags: [] })).toBe(0);
    off();
    expect(damage.deal(target, { amount: 10, source: null, tags: [] })).toBe(
      10,
    );
    expect(calls).toBe(1);
  });

  it('dispose ostrza zdejmuje obronę z DamageSystem', () => {
    const bus = new EventBus();
    const registry = new EntityRegistry(bus);
    const damage = new DamageSystem(bus, registry);
    const owner = registry.create('player', 'player');
    damage.register(owner, new Health(() => 100));
    let added = 0;
    let removed = 0;
    const original = damage.addGuard.bind(damage);
    damage.addGuard = (target, guard) => {
      added++;
      const off = original(target, guard);
      return () => {
        removed++;
        off();
      };
    };
    const stats = new Stats({ maxHealth: 100, maxEnergy: 100 });
    const blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner,
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
      structuredClone(tuning),
    );
    expect(added).toBe(1);
    blade.dispose();
    expect(removed).toBe(1);
  });

  it('bez znanej pozycji atakującego nie ma parowania', () => {
    const t = setup(-2, false);
    t.stepFor(0.05, ['block']);
    expect(t.hit(['#melee'])).toBeGreaterThan(0);
    expect(t.parried()).toBe(0);
  });

  it('blok w oknie neguje cios i emituje melee_parried', () => {
    const t = setup();
    t.stepFor(0.05, ['block']);
    expect(t.hit(['#melee'])).toBe(0);
    expect(t.health.current).toBe(100);
    expect(t.parried()).toBe(1);
  });

  it('parowanie wręcz liczy się jako parry_success (bez pocisku), iskra przed graczem', () => {
    const t = setup();
    t.stepFor(0.05, ['block']);
    t.hit(['#melee']);
    expect(t.successes).toEqual([
      { defender: t.player, projectile: null, attacker: t.enemy },
    ]);
    const p = t.points[0]!;
    expect(p.z).toBeCloseTo(-tuning.melee.meleeParrySparkM);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1.6 + tuning.melee.meleeParrySparkOffsetYM);
  });

  it('atakujący w osi oczu: iskra w kierunku patrzenia, bez NaN', () => {
    const t = setup(0);
    t.stepFor(0.05, ['block']);
    expect(t.hit(['#melee'])).toBe(0);
    const p = t.points[0]!;
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
    expect(p.z).toBeCloseTo(-tuning.melee.meleeParrySparkM);
  });

  it('bez parowania nie ma parry_success', () => {
    const t = setup();
    t.stepFor((tuning.melee.meleeParryWindowMs + 100) / 1000, ['block']);
    t.hit(['#melee']);
    expect(t.successes).toEqual([]);
  });

  it('blok poza oknem działa jak dotąd (redukcja, bez parowania)', () => {
    const t = setup();
    t.stepFor((tuning.melee.meleeParryWindowMs + 100) / 1000, ['block']);
    expect(t.hit(['#melee'])).toBeGreaterThan(0);
    expect(t.health.current).toBeLessThan(100);
    expect(t.health.current).toBeGreaterThan(80);
    expect(t.parried()).toBe(0);
  });

  it('cios #heavy (nie do zablokowania) nie daje się sparować', () => {
    const t = setup();
    t.stepFor(0.05, ['block']);
    expect(t.hit(['#melee', '#heavy'])).toBe(20);
    expect(t.parried()).toBe(0);
  });

  it('bez bloku cios trafia w pełni', () => {
    const t = setup();
    t.stepFor(0.05, []);
    expect(t.hit(['#melee'])).toBe(20);
    expect(t.parried()).toBe(0);
  });

  it('cios z tyłu nie jest parowany', () => {
    const t = setup(2);
    t.stepFor(0.05, ['block']);
    expect(t.hit(['#melee'])).toBeGreaterThan(0);
    expect(t.parried()).toBe(0);
  });
});
