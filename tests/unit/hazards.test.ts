import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents, Team } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { initPhysics } from '../../src/physics';
import { HazardSystem } from '../../src/world/hazards';
import type { HazardTarget } from '../../src/world/hazards';
import { hazardSchema, roomSchema } from '../../src/world/roomSchema';
import type { Hazard } from '../../src/world/roomSchema';
import warehouse from '../../src/data/rooms/combatWarehouse.json';

let rapier: Awaited<ReturnType<typeof initPhysics>>;
beforeAll(async () => {
  rapier = await initPhysics();
});
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0).reverse()) fn();
});

const field: Hazard = {
  kind: 'electric_field',
  id: 'field',
  position: { x: 0, y: 1, z: 0 },
  size: { x: 2, y: 2, z: 2 },
};
const barrel = (id: string, x = 0): Hazard => ({
  kind: 'explosive_barrel',
  id,
  position: { x, y: 0, z: 0 },
});
const laser: Hazard = {
  kind: 'laser_gate',
  id: 'laser',
  from: { x: -2, y: 0.5, z: 0 },
  to: { x: 2, y: 0.5, z: 0 },
  cycle: { onS: 10, offS: 1, offsetS: 1 },
};

function setup(hazards: Hazard[]) {
  const bus = new EventBus();
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  const hurtboxes = new Hurtboxes();
  const targets: HazardTarget[] = [];
  const add = (x: number, y = 1, z = 0, team: Team = 'enemy', hp = 1000) => {
    const id = entities.create(team, team);
    damage.register(id, new Health(() => hp));
    targets.push({ id, position: { x, y, z }, radius: 0.3, halfHeight: 0.6 });
    return id;
  };
  const playerId = add(20, 1, 0, 'player');
  const config = { ...tuning.hazards };
  const system = new HazardSystem({
    bus,
    entities,
    damage,
    world,
    hurtboxes,
    playerId,
    hazards,
    tuning: config,
    targets: () => targets,
  });
  const hits: GameEvents['damage_dealt'][] = [];
  const explosions: GameEvents['explosion'][] = [];
  bus.on('damage_dealt', (e) => hits.push(e));
  bus.on('explosion', (e) => explosions.push(e));
  cleanup.push(() => {
    system.dispose();
    world.free();
  });
  const step = (seconds: number) => {
    const count = Math.round(seconds * 60);
    for (let i = 0; i < count; i++) {
      damage.step(1 / 60);
      system.step(1 / 60);
    }
  };
  return {
    system,
    bus,
    entities,
    damage,
    world,
    hurtboxes,
    targets,
    add,
    playerId,
    config,
    hits,
    explosions,
    step,
  };
}

describe('walidacja zagrożeń', () => {
  it('odrzuca nieznany kind, niepoprawne rozmiary i cykle', () => {
    for (const value of [
      { ...field, kind: 'unknown' },
      { ...field, size: { x: -1, y: 1, z: 1 } },
      ...[-1, 0].map((onS) => ({ ...field, cycle: { onS, offS: 1 } })),
      { ...field, cycle: { onS: 1, offS: -1 } },
      { ...field, cycle: { onS: 1, offS: 1, offsetS: -1 } },
    ])
      expect(hazardSchema.safeParse(value).success).toBe(false);
  });
  it('odrzuca duplikaty id i zagrożenia poza podłogą', () => {
    expect(() =>
      roomSchema.parse({
        ...warehouse,
        hazards: [barrel('a'), barrel('a', 1)],
      }),
    ).toThrow('Powtórzone id zagrożenia');
    for (const hazard of [
      barrel('a', 100),
      { ...field, position: { x: 100, y: 1, z: 0 } },
      { ...laser, to: { x: 100, y: 1, z: 0 } },
    ])
      expect(() =>
        roomSchema.parse({ ...warehouse, hazards: [hazard] }),
      ).toThrow('poza granicami');
  });
  it('chroni spawn gracza i wrogów wraz z marginesem 1 m', () => {
    for (const p of [warehouse.playerSpawn, warehouse.spawnPoints[0]!]) {
      for (const hazard of [
        { ...field, position: { x: p.x + 1.9, y: 1, z: p.z } },
        {
          ...laser,
          from: { x: p.x - 1, y: 1, z: p.z },
          to: { x: p.x + 1, y: 1, z: p.z },
        },
      ])
        expect(() =>
          roomSchema.parse({ ...warehouse, hazards: [hazard] }),
        ).toThrow('Punkt spawnu');
    }
    expect(roomSchema.safeParse(warehouse).success).toBe(true);
  });
});

it('pole trafia środek kapsuły co tick, nakłada overload i pomija cele poza bryłą', () => {
  const s = setup([field]);
  const inside = s.add(0);
  const outside = [s.add(1.01), s.add(0, 2.01), s.add(0, 1, -1.01)];
  s.step(29 / 60);
  expect(s.hits).toHaveLength(0);
  s.step(1 / 60);
  expect(s.hits).toEqual([
    expect.objectContaining({
      target: inside,
      source: null,
      amount: 8,
      tags: ['#hazard', '#elektrycznosc'],
      statuses: [{ id: 'overload', durationS: 2 }],
    }),
  ]);
  s.step(0.5);
  expect(s.damage.health(inside)?.current).toBe(984);
  for (const id of outside) expect(s.damage.health(id)?.current).toBe(1000);
});

it('cykl przechodzi off → warn → on, offset przesuwa fazę, pauza nie zmienia stanu', () => {
  const s = setup([
    { ...field, cycle: { onS: 2, offS: 2 } },
    { ...field, id: 'offset', cycle: { onS: 2, offS: 2, offsetS: 2 } },
  ]);
  s.add(0);
  expect(s.system.state().map((x) => x.phase)).toEqual(['off', 'on']);
  const initial = s.system.state();
  s.system.step(0);
  s.system.step(-1);
  expect(s.system.state()).toEqual(initial);
  s.step(1.5);
  expect(s.system.state()[0]).toMatchObject({ phase: 'warn' });
  s.step(0.6);
  expect(s.system.state()[0]).toMatchObject({ phase: 'on' });
  expect(s.system.state()[1]).toMatchObject({ phase: 'off' });
});

it('pole nie rani w off/warn i zeruje licznik po wyłączeniu', () => {
  const s = setup([{ ...field, cycle: { onS: 1, offS: 1 } }]);
  s.add(0);
  s.step(0.9);
  expect(s.hits).toHaveLength(0);
  s.step(0.6);
  expect(s.hits).toHaveLength(1);
  s.step(0.8);
  const count = s.hits.length;
  s.step(0.6);
  expect(s.hits).toHaveLength(count);
});

it('laser mierzy odległość do osi kapsuły, ogranicza trafienia per cel i per bramka', () => {
  const s = setup([laser]);
  const hit = s.add(0, 1.2);
  const above = s.add(0, 3);
  const outside = s.add(2.46, 0.5);
  s.step(1 / 60);
  expect(s.hits).toEqual([
    expect.objectContaining({
      target: hit,
      source: null,
      amount: 25,
      tags: ['#hazard', '#laser'],
    }),
  ]);
  s.step(35 / 60);
  expect(s.hits).toHaveLength(1);
  s.step(1 / 60);
  expect(s.hits).toHaveLength(2);
  for (const id of [above, outside])
    expect(s.damage.health(id)?.current).toBe(1000);
  s.add(1, 0.5);
  s.step(1 / 60);
  expect(s.hits).toHaveLength(3);
  const two = setup([laser, { ...laser, id: 'second' }]);
  two.add(0);
  two.step(1 / 60);
  expect(two.hits).toHaveLength(2);
});

it('laser pionowy i odcinek zerowy trafiają, odcinek wyłączony nie trafia', () => {
  for (const to of [
    { x: 0, y: 3, z: 0 },
    { x: 0, y: 0.5, z: 0 },
  ]) {
    const s = setup([{ ...laser, from: { x: 0, y: 0.5, z: 0 }, to }]);
    s.add(0);
    s.step(1 / 60);
    expect(s.hits).toHaveLength(1);
  }
  const s = setup([{ ...laser, cycle: { onS: 1, offS: 2 } }]);
  s.add(0);
  s.step(1.9);
  expect(s.hits).toHaveLength(0);
});

it('beczka emituje wybuch, rani wszystkie drużyny ze spadkiem i odrzutem, oddaje kredyt źródłu', () => {
  const s = setup([barrel('a')]);
  const near = s.add(0, 0.55, 0, 'enemy', 50);
  const edge = s.add(4.5, 0.55);
  const outside = s.add(4.51, 0.55);
  s.targets[0]!.position = { x: -1, y: 0.55, z: 0 };
  const killed = vi.fn();
  s.bus.on('enemy_killed', killed);
  const id = s.system.targetIds()[0]!;
  expect(s.entities.team(id)).toBe('neutral');
  s.damage.deal(id, { source: s.playerId, amount: 20, tags: ['#gun'] });
  expect(s.explosions).toEqual([
    expect.objectContaining({
      owner: s.playerId,
      radiusM: 4.5,
      point: { x: 0, y: 0.55, z: 0 },
    }),
  ]);
  expect(s.damage.health(near)?.dead).toBe(true);
  expect(s.damage.health(edge)?.current).toBeCloseTo(982);
  expect(s.damage.health(outside)?.current).toBe(1000);
  expect(s.damage.health(s.playerId)?.current).toBeLessThan(1000);
  expect(s.hits.find((e) => e.target === edge)).toMatchObject({
    knockback: 12,
    dir: { x: 1, y: 0, z: 0 },
  });
  expect(killed).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ id: near, killer: s.playerId }),
  );
  expect(s.world.colliders.len()).toBe(0);
  expect(s.system.targetIds()).toEqual([]);
  expect(s.system.detonate('a')).toBe(false);
});

it('łańcuch zachowuje źródło i opóźnienie każdej kolejnej beczki', () => {
  const s = setup([barrel('a'), barrel('b', 4), barrel('c', 8)]);
  expect(s.system.detonate('a')).toBe(true);
  s.step(8 / 60);
  expect(s.explosions).toHaveLength(1);
  s.step(1 / 60);
  expect(s.system.state().map((e) => e.alive)).toEqual([false, false, true]);
  s.step(0.15);
  expect(s.explosions.map((e) => e.owner)).toEqual([
    s.playerId,
    s.playerId,
    s.playerId,
  ]);
  expect(s.system.state().every((e) => !e.alive)).toBe(true);
});

it('środowisko zachowuje null w obrażeniach łańcucha, owner zdarzenia ma fallback gracza', () => {
  const s = setup([barrel('a'), barrel('b', 4)]);
  const enemy = s.add(4, 0.55, 1, 'enemy', 10);
  const killed = vi.fn();
  s.bus.on('enemy_killed', killed);
  s.damage.deal(s.system.targetIds()[0]!, {
    source: null,
    amount: 20,
    tags: ['#hazard'],
  });
  s.step(0.15);
  expect(s.explosions.map((e) => e.owner)).toEqual([s.playerId, s.playerId]);
  expect(killed).toHaveBeenCalledWith(
    expect.objectContaining({ id: enemy, killer: null }),
  );
  expect(s.hits.every((e) => e.source === null)).toBe(true);
});

it('pole może zniszczyć beczkę i nie nalicza jej jako zabitego wroga', () => {
  const s = setup([field, barrel('a')]);
  const killed = vi.fn();
  s.bus.on('enemy_killed', killed);
  s.step(1.5);
  expect(s.system.state()[1]?.alive).toBe(false);
  expect(s.explosions).toHaveLength(1);
  expect(killed).not.toHaveBeenCalled();
});

it('regresja: neutralna skrzynia emituje damage_dealt.killed i health_changed, wróg także enemy_killed', () => {
  const s = setup([]);
  const neutral = s.add(0, 1, 0, 'neutral', 10);
  const enemy = s.add(1, 1, 0, 'enemy', 10);
  const killed = vi.fn();
  const health = vi.fn();
  s.bus.on('enemy_killed', killed);
  s.bus.on('health_changed', health);
  for (const id of [neutral, enemy])
    s.damage.deal(id, { source: s.playerId, amount: 10, tags: ['#gun'] });
  expect(s.hits.map((e) => [e.target, e.killed])).toEqual([
    [neutral, true],
    [enemy, true],
  ]);
  expect(health).toHaveBeenCalledWith({ id: neutral, current: 0, max: 10 });
  expect(killed).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ id: enemy }),
  );
});

it('dispose usuwa collidery, hurtboxy, encje, zdrowie i nasłuch; jest idempotentne', () => {
  const s = setup([barrel('a'), barrel('b', 4)]);
  const ids = s.system.targetIds();
  s.system.detonate('a');
  s.system.dispose();
  s.system.dispose();
  expect(s.world.colliders.len()).toBe(0);
  for (const id of ids) {
    expect(s.entities.alive(id)).toBe(false);
    expect(s.damage.health(id)).toBeUndefined();
  }
  s.bus.emit('damage_dealt', {
    target: ids[1]!,
    source: s.playerId,
    killed: true,
    amount: 20,
    tags: [],
    point: null,
    dir: null,
    knockback: 0,
  });
  s.step(1);
  expect(s.explosions).toHaveLength(1);
  expect(s.system.detonate('b')).toBe(false);
});

it('dwa przebiegi mają identyczne stany i zdarzenia', () => {
  const run = () => {
    const s = setup([field, laser, barrel('a'), barrel('b', 4)]);
    s.add(0);
    const states = [];
    for (let i = 0; i < 180; i++) {
      s.step(1 / 60);
      states.push(s.system.state());
    }
    return { states, hits: s.hits, explosions: s.explosions };
  };
  expect(run()).toEqual(run());
});

it('zdarzenia zachowują punkt trafienia po ponownym użyciu obiektu celu', () => {
  const s = setup([field]);
  const id = s.add(0);
  s.step(0.5);
  const target = s.targets.find((t) => t.id === id)!;
  target.position.x = 10;
  s.step(0.5);
  expect(s.hits[0]?.point).toEqual({ x: 0, y: 1, z: 0 });
  const state = s.system.state();
  state[0]!.alive = false;
  expect(s.system.state()[0]?.alive).toBe(true);
});
