import { describe, expect, it, vi } from 'vitest';
import { DamageSystem, Health } from '../../src/combat/damage';
import {
  loadStatusDefinitions,
  STATUS_TAG,
  statusDefinitions,
  StatusSystem,
} from '../../src/combat/status';
import { EntityRegistry } from '../../src/core/entities';
import { EventBus } from '../../src/core/events';
import type { EntityId, GameEvents } from '../../src/core/events';
import { SIM_DT } from '../../src/core/loop';
import type { Vec3 } from '../../src/core/math';
import { Stats } from '../../src/core/stats';
import burningRaw from '../../src/data/statuses/burning.json';
import overloadRaw from '../../src/data/statuses/overload.json';
import stunnedRaw from '../../src/data/statuses/stunned.json';

function setup() {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  damage.register(player, new Health(() => 100), {
    stats: new Stats({ maxHealth: 100 }),
  });
  const positions = new Map<EntityId, Vec3>();
  const enemies: EntityId[] = [];
  const stats = new Map<EntityId, Stats>();
  const spawn = (x: number, hp = 1000): EntityId => {
    const id = registry.create('dummy', 'enemy');
    const s = new Stats({ maxHealth: hp });
    stats.set(id, s);
    damage.register(id, new Health(() => s.get('maxHealth')), { stats: s });
    positions.set(id, { x, y: 1, z: 0 });
    enemies.push(id);
    return id;
  };
  const statuses = new StatusSystem(bus, damage, {
    position: (id) => positions.get(id) ?? null,
    targets: () => enemies,
  });
  const dealt: GameEvents['damage_dealt'][] = [];
  bus.on('damage_dealt', (e) => dealt.push(e));
  const step = (seconds: number) => {
    const n = Math.round(seconds / SIM_DT);
    for (let i = 0; i < n; i++) {
      damage.step(SIM_DT);
      statuses.step(SIM_DT);
    }
  };
  return { bus, damage, player, spawn, statuses, stats, dealt, step };
}

describe('StatusSystem — nakładanie przez obrażenia', () => {
  it('applies statuses only from damage_dealt with amount > 0 and a surviving target', () => {
    const { damage, player, spawn, statuses, bus } = setup();
    const applied = vi.fn();
    bus.on('status_applied', applied);
    const a = spawn(0);
    damage.deal(a, {
      amount: 5,
      source: player,
      tags: ['#gun'],
      statuses: [{ id: 'burning', durationS: 2 }],
    });
    expect(statuses.has(a, 'burning')).toBe(true);
    expect(applied).toHaveBeenCalledWith({
      target: a,
      status: 'burning',
      stacks: 1,
      durationS: 2,
      source: player,
    });
    const b = spawn(5);
    damage.deal(b, {
      amount: 0,
      source: player,
      tags: [],
      statuses: [{ id: 'burning', durationS: 2 }],
    });
    expect(statuses.has(b, 'burning')).toBe(false);
    const c = spawn(10, 10);
    damage.deal(c, {
      amount: 50,
      source: player,
      tags: [],
      statuses: [{ id: 'burning', durationS: 2 }],
    });
    expect(statuses.has(c, 'burning')).toBe(false);
    // Ta sama drużyna: obrażenia odrzucone, więc i status.
    damage.deal(player, {
      amount: 5,
      source: player,
      tags: [],
      statuses: [{ id: 'burning', durationS: 2 }],
    });
    expect(statuses.has(player, 'burning')).toBe(false);
  });

  it('counts duration in simulation time, ignores hitstop and emits status_expired once', () => {
    const { player, spawn, statuses, step, bus } = setup();
    const expired = vi.fn();
    bus.on('status_expired', expired);
    const a = spawn(0);
    statuses.apply(a, { id: 'stunned', durationS: 1 }, player);
    statuses.step(0);
    expect(statuses.remaining(a, 'stunned')).toBe(1);
    step(0.5);
    expect(statuses.remaining(a, 'stunned')).toBeCloseTo(0.5, 5);
    step(0.5);
    expect(statuses.has(a, 'stunned')).toBe(false);
    expect(statuses.remaining(a, 'stunned')).toBe(0);
    step(1);
    expect(expired).toHaveBeenCalledOnce();
    expect(expired).toHaveBeenCalledWith({ target: a, status: 'stunned' });
  });

  it('refreshes to the longer duration and caps stacks at maxStacks', () => {
    const { player, spawn, statuses, step } = setup();
    const a = spawn(0);
    statuses.apply(a, { id: 'burning', durationS: 2 }, player);
    step(1);
    statuses.apply(a, { id: 'burning', durationS: 0.5 }, player);
    expect(statuses.remaining(a, 'burning')).toBeCloseTo(1, 5);
    statuses.apply(a, { id: 'burning', durationS: 3 }, player);
    expect(statuses.remaining(a, 'burning')).toBe(3);
    statuses.apply(a, { id: 'burning', durationS: 3, stacks: 5 }, player);
    expect(statuses.stacks(a, 'burning')).toBe(1);
    statuses.apply(a, { id: 'overload', durationS: 2 }, player);
    statuses.apply(a, { id: 'overload', durationS: 2 }, player);
    expect(statuses.stacks(a, 'overload')).toBe(2);
    expect(() =>
      statuses.apply(a, { id: 'missing', durationS: 1 }, player),
    ).toThrow(/Nieznany status/);
  });
});

describe('StatusSystem — efekty', () => {
  it('burns every tickS through DamageSystem with the applier as source and #status tag', () => {
    const { damage, player, spawn, statuses, step, dealt } = setup();
    const a = spawn(0);
    statuses.apply(a, { id: 'burning', durationS: 2 }, player);
    step(2);
    const ticks = dealt.filter((e) => e.tags.includes(STATUS_TAG));
    expect(ticks).toHaveLength(2 / burningRaw.tick.intervalS);
    for (const tick of ticks) {
      expect(tick.source).toBe(player);
      expect(tick.amount).toBe(burningRaw.tick.damage);
      expect(tick.tags).toEqual(['#fire', STATUS_TAG]);
      expect(tick.statuses).toBeUndefined();
    }
    expect(damage.health(a)?.current).toBe(
      1000 - (2 / burningRaw.tick.intervalS) * burningRaw.tick.damage,
    );
  });

  it('stops ticking and clears statuses when the target dies', () => {
    const { damage, player, spawn, statuses, step, dealt } = setup();
    const a = spawn(0, 5);
    statuses.apply(a, { id: 'burning', durationS: 5 }, player);
    step(1);
    expect(damage.health(a)?.dead).toBe(true);
    expect(statuses.has(a, 'burning')).toBe(false);
    expect(dealt.filter((e) => e.target === a)).toHaveLength(2);
  });

  it('raises damageTaken by percent per overload stack and removes it on expiry', () => {
    const { damage, player, spawn, statuses, stats, step } = setup();
    const a = spawn(0);
    const hit = () => damage.deal(a, { amount: 10, source: player, tags: [] });
    statuses.apply(a, { id: 'overload', durationS: 1 }, player);
    expect(hit()).toBeCloseTo(10 * (1 + overloadRaw.damageTakenPerStack));
    statuses.apply(a, { id: 'overload', durationS: 1 }, player);
    expect(hit()).toBeCloseTo(10 * (1 + 2 * overloadRaw.damageTakenPerStack));
    step(1);
    expect(hit()).toBe(10);
    expect(stats.get(a)?.modifiers('damageTaken')).toEqual([]);
  });

  it('at max overload consumes stacks, stuns the target and discharges nearby without a chain loop', () => {
    const { damage, player, spawn, statuses, dealt } = setup();
    const a = spawn(0);
    const near = spawn(overloadRaw.onMaxStacks.discharge.radiusM - 0.5);
    const far = spawn(overloadRaw.onMaxStacks.discharge.radiusM + 2);
    statuses.apply(near, { id: 'overload', durationS: 5, stacks: 2 }, player);
    for (let i = 0; i < overloadRaw.maxStacks; i++)
      damage.deal(a, {
        amount: 1,
        source: player,
        tags: ['#power'],
        statuses: [{ id: 'overload', durationS: 5 }],
      });
    expect(statuses.has(a, 'overload')).toBe(false);
    expect(statuses.has(a, 'stunned')).toBe(true);
    expect(statuses.remaining(a, 'stunned')).toBe(
      overloadRaw.onMaxStacks.apply[0]?.durationS,
    );
    const discharge = dealt.filter(
      (e) => e.tags.includes(STATUS_TAG) && e.target !== a,
    );
    expect(discharge.map((e) => e.target)).toEqual([near]);
    expect(discharge[0]?.amount).toBeCloseTo(
      overloadRaw.onMaxStacks.discharge.damage *
        (1 + 2 * overloadRaw.damageTakenPerStack),
    );
    expect(discharge[0]?.source).toBe(player);
    // Wyładowanie nie niesie statusów: sąsiad z 2 stosami nie osiąga progu.
    expect(statuses.stacks(near, 'overload')).toBe(2);
    expect(statuses.has(near, 'stunned')).toBe(false);
    expect(damage.health(far)?.current).toBe(1000);
  });

  it('clears on despawn and resets without events or leftover modifiers', () => {
    const { bus, damage, player, spawn, statuses, stats } = setup();
    const expired = vi.fn();
    bus.on('status_expired', expired);
    const a = spawn(0);
    const b = spawn(1);
    statuses.apply(a, { id: 'burning', durationS: 3 }, player);
    bus.emit('entity_despawned', { id: a });
    expect(statuses.has(a, 'burning')).toBe(false);
    expect(expired).toHaveBeenCalledOnce();
    statuses.apply(b, { id: 'overload', durationS: 3 }, player);
    statuses.reset();
    expect(statuses.list(b)).toEqual([]);
    expect(stats.get(b)?.modifiers('damageTaken')).toEqual([]);
    expect(expired).toHaveBeenCalledOnce();
    statuses.dispose();
    damage.deal(b, {
      amount: 1,
      source: player,
      tags: [],
      statuses: [{ id: 'burning', durationS: 1 }],
    });
    expect(statuses.has(b, 'burning')).toBe(false);
  });

  it('validates definitions: data files, duplicates, unknown and self-applied statuses', () => {
    expect([...statusDefinitions.keys()].sort()).toEqual([
      'burning',
      'jammed',
      'overload',
      'slowed',
      'stunned',
    ]);
    expect(() => loadStatusDefinitions([stunnedRaw, stunnedRaw])).toThrow(
      /Powtórzony/,
    );
    expect(() => loadStatusDefinitions([overloadRaw])).toThrow(/nieznany/);
    expect(() =>
      loadStatusDefinitions([
        {
          ...stunnedRaw,
          onMaxStacks: { apply: [{ id: 'stunned', durationS: 1 }] },
        },
      ]),
    ).toThrow(/sam siebie/);
  });
});
