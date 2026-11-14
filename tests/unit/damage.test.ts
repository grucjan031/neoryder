import { beforeAll, describe, expect, it, vi } from 'vitest';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { StatusApplication } from '../../src/combat/damage/types';
import { EntityRegistry } from '../../src/core/entities';
import { Stats } from '../../src/core/stats';
import {
  DamageSystem,
  Health,
  Hitbox,
  Hurtboxes,
  queryHurtboxes,
} from '../../src/combat/damage';
import {
  initPhysics,
  CollisionGroup,
  interactionGroups,
} from '../../src/physics';

function setup() {
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const events: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of [
    'damage_dealt',
    'health_changed',
    'enemy_killed',
    'player_died',
  ] as const)
    bus.on(type, (payload) => events.push({ type, payload }));
  const player = registry.create('player', 'player');
  const enemy = registry.create('trooper', 'enemy');
  const enemy2 = registry.create('gunner', 'enemy');
  const playerHealth = new Health(() => 100);
  const enemyHealth = new Health(() => 50);
  const enemy2Health = new Health(() => 50);
  damage.register(player, playerHealth);
  damage.register(enemy, enemyHealth);
  damage.register(enemy2, enemy2Health);
  return {
    bus,
    registry,
    damage,
    events,
    player,
    enemy,
    enemy2,
    playerHealth,
    enemyHealth,
  };
}

describe('EntityRegistry', () => {
  it('przydziela kolejne id, emituje spawn/despawn i mapuje collidery', () => {
    const bus = new EventBus();
    const spawned = vi.fn();
    const despawned = vi.fn();
    bus.on('entity_spawned', spawned);
    bus.on('entity_despawned', despawned);
    const registry = new EntityRegistry(bus);
    const a = registry.create('trooper', 'enemy');
    const b = registry.create('player', 'player');
    expect(b).toBe(a + 1);
    expect(spawned).toHaveBeenCalledWith({ id: a, kind: 'trooper' });
    registry.bindCollider(a, 7);
    expect(registry.byCollider(7)).toBe(a);
    expect(registry.team(a)).toBe('enemy');
    registry.destroy(a);
    expect(despawned).toHaveBeenCalledWith({ id: a });
    expect(registry.byCollider(7)).toBeUndefined();
    expect(registry.alive(a)).toBe(false);
    expect(() => registry.bindCollider(a, 8)).toThrow();
  });

  it('setTeam zmienia drużynę (odbity pocisk)', () => {
    const registry = new EntityRegistry();
    const p = registry.create('projectile', 'enemy');
    registry.setTeam(p, 'player');
    expect(registry.team(p)).toBe('player');
  });
});

describe('Health', () => {
  it('nie spada poniżej 0 i zwraca faktycznie zadane obrażenia', () => {
    const h = new Health(() => 30);
    expect(h.apply({ amount: 20 })).toBe(20);
    expect(h.apply({ amount: 20 })).toBe(10);
    expect(h.current).toBe(0);
    expect(h.dead).toBe(true);
    expect(h.apply({ amount: 5 })).toBe(0);
    h.heal(10);
    expect(h.current).toBe(0); // martwego się nie leczy
    h.reset();
    expect(h.current).toBe(30);
  });

  it('obcina current do zmienionego max', () => {
    let max = 100;
    const h = new Health(() => max);
    max = 60;
    expect(h.current).toBe(60);
  });
});

describe('DamageSystem', () => {
  it('guard blocks without damage events or invulnerability and fractions scale before damageTaken', () => {
    const { damage, events, player, enemy, enemyHealth } = setup();
    const stats = new Stats({ maxHealth: 50 });
    stats.add({ stat: 'damageTaken', type: 'flat', value: 1, source: 'test' });
    let multiplier = 0;
    const guard = vi.fn(() => multiplier);
    damage.register(enemy, enemyHealth, { stats, guard, invulnMs: () => 100 });
    const info = { amount: 20, source: player, tags: ['#melee'] };
    expect(damage.deal(enemy, info)).toBe(0);
    expect(guard).toHaveBeenCalledWith(info);
    expect(enemyHealth.current).toBe(50);
    expect(events).toEqual([]);
    multiplier = 0.25;
    expect(damage.deal(enemy, info)).toBe(10);
    expect(enemyHealth.current).toBe(40);
    expect(events.map((event) => event.type)).toEqual([
      'damage_dealt',
      'health_changed',
    ]);
  });

  it('calls guard only after team and invulnerability filters, and preserves unguarded damage', () => {
    const { damage, player, enemy, enemy2, enemyHealth } = setup();
    const guard = vi.fn(() => 1);
    let invulnerable = true;
    damage.register(enemy, enemyHealth, {
      guard,
      invulnerable: () => invulnerable,
      invulnMs: () => 100,
    });
    expect(damage.deal(enemy, { amount: 10, source: enemy2, tags: [] })).toBe(
      0,
    );
    expect(damage.deal(enemy, { amount: 10, source: player, tags: [] })).toBe(
      0,
    );
    expect(guard).not.toHaveBeenCalled();
    invulnerable = false;
    expect(damage.deal(enemy, { amount: 10, source: player, tags: [] })).toBe(
      10,
    );
    expect(damage.deal(enemy, { amount: 10, source: player, tags: [] })).toBe(
      0,
    );
    expect(guard).toHaveBeenCalledOnce();
    expect(damage.deal(enemy2, { amount: 10, source: player, tags: [] })).toBe(
      10,
    );
  });

  it.each([
    {
      statuses: [
        { id: 'burning', durationS: 3 },
        { id: 'overload', durationS: 2, stacks: 2 },
      ],
    },
    { statuses: [] },
  ] satisfies { statuses: StatusApplication[] }[])(
    'przekazuje podane statuses bez zmian: $statuses',
    ({ statuses }) => {
      const { bus, damage, player, enemy } = setup();
      const dealt = vi.fn();
      bus.on('damage_dealt', dealt);
      damage.deal(enemy, { amount: 10, source: player, tags: [], statuses });
      expect(dealt).toHaveBeenCalledOnce();
      expect(dealt.mock.calls[0]?.[0].statuses).toBe(statuses);
    },
  );

  it('pomija pole statuses, gdy nie podano go w DamageInfo', () => {
    const { bus, damage, player, enemy } = setup();
    const dealt = vi.fn();
    bus.on('damage_dealt', dealt);
    damage.deal(enemy, { amount: 10, source: player, tags: [] });
    expect(dealt).toHaveBeenCalledOnce();
    expect(dealt.mock.calls[0]?.[0]).not.toHaveProperty('statuses');
  });

  it('udostępnia zarejestrowane Stats i usuwa dostęp po unregister', () => {
    const { damage, registry, player, enemy, enemyHealth } = setup();
    const stats = new Stats({ maxHealth: 50 });
    const ghost = registry.create('ghost', 'enemy');
    damage.register(enemy, enemyHealth, { stats });
    expect(damage.stats(enemy)).toBe(stats);
    expect(damage.stats(player)).toBeUndefined();
    expect(damage.stats(ghost)).toBeUndefined();
    damage.unregister(enemy);
    expect(damage.stats(enemy)).toBeUndefined();
  });

  it('zadaje obrażenia, emituje zdarzenia i enemy_killed dokładnie raz', () => {
    const { damage, events, player, enemy, enemyHealth } = setup();
    expect(
      damage.deal(enemy, { amount: 30, source: player, tags: ['#melee'] }),
    ).toBe(30);
    expect(enemyHealth.current).toBe(20);
    expect(
      damage.deal(enemy, { amount: 30, source: player, tags: ['#melee'] }),
    ).toBe(20);
    expect(
      damage.deal(enemy, { amount: 30, source: player, tags: ['#melee'] }),
    ).toBe(0);
    expect(enemyHealth.current).toBe(0);
    const kills = events.filter((e) => e.type === 'enemy_killed');
    expect(kills).toEqual([
      {
        type: 'enemy_killed',
        payload: { id: enemy, killer: player, tags: ['#melee'] },
      },
    ]);
    expect(events.filter((e) => e.type === 'damage_dealt')).toHaveLength(2);
    expect(events.at(-2)).toEqual({
      type: 'health_changed',
      payload: { id: enemy, current: 0, max: 50 },
    });
  });

  it('damage_dealt niesie punkt, kierunek i flagę killed', () => {
    const { damage, events, player, enemy } = setup();
    const point = { x: 1, y: 1.5, z: -2 };
    const dir = { x: 0, y: 0, z: -1 };
    damage.deal(enemy, {
      amount: 10,
      source: player,
      tags: ['#gun'],
      point,
      dir,
    });
    damage.deal(enemy, { amount: 99, source: player, tags: ['#gun'] });
    const dealt = events
      .filter((e) => e.type === 'damage_dealt')
      .map((e) => e.payload);
    expect(dealt[0]).toEqual({
      source: player,
      target: enemy,
      amount: 10,
      tags: ['#gun'],
      point,
      dir,
      knockback: 0,
      killed: false,
    });
    expect(dealt[1]).toMatchObject({
      amount: 40,
      point: null,
      dir: null,
      killed: true,
    });
  });

  it('śmierć gracza emituje player_died, nie enemy_killed', () => {
    const { damage, events, enemy, player } = setup();
    damage.deal(player, { amount: 500, source: enemy, tags: [] });
    expect(events.some((e) => e.type === 'player_died')).toBe(true);
    expect(events.some((e) => e.type === 'enemy_killed')).toBe(false);
  });

  it('brak friendly fire i samotrafień, chyba że tag #friendly_fire', () => {
    const { damage, enemy, enemy2, player } = setup();
    expect(damage.deal(enemy2, { amount: 10, source: enemy, tags: [] })).toBe(
      0,
    );
    expect(damage.deal(player, { amount: 10, source: player, tags: [] })).toBe(
      0,
    );
    expect(
      damage.deal(enemy2, {
        amount: 10,
        source: enemy,
        tags: ['#friendly_fire'],
      }),
    ).toBe(10);
    expect(damage.deal(enemy2, { amount: 5, source: null, tags: [] })).toBe(5); // środowisko
  });

  it('modyfikator damageTaken −70% (blok) zmienia wynik zgodnie z computeStat', () => {
    const { damage, registry, enemy } = setup();
    const blocker = registry.create('player', 'player');
    const stats = new Stats({ maxHealth: 100 });
    const health = new Health(() => stats.get('maxHealth'));
    damage.register(blocker, health, { stats });
    stats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: 0.3,
      source: 'block',
    });
    expect(
      damage.deal(blocker, { amount: 40, source: enemy, tags: [] }),
    ).toBeCloseTo(12);
    stats.removeBySource('block');
    expect(damage.deal(blocker, { amount: 40, source: enemy, tags: [] })).toBe(
      40,
    );
  });

  it('okno nietykalności ignoruje trafienia do upływu czasu symulacji', () => {
    const { damage, registry, enemy } = setup();
    const p = registry.create('player', 'player');
    damage.register(p, new Health(() => 100), { invulnMs: () => 500 });
    expect(damage.deal(p, { amount: 10, source: enemy, tags: [] })).toBe(10);
    damage.step(0.4);
    expect(damage.deal(p, { amount: 10, source: enemy, tags: [] })).toBe(0);
    damage.step(0.2);
    expect(damage.deal(p, { amount: 10, source: enemy, tags: [] })).toBe(10);
  });

  it('invulnerable() blokuje obrażenia przed trafieniem i nie przedłuża okna', () => {
    const { damage, registry, enemy } = setup();
    const p = registry.create('player', 'player');
    let dashing = true;
    damage.register(p, new Health(() => 100), {
      invulnMs: () => 250,
      invulnerable: () => dashing,
    });
    expect(damage.deal(p, { amount: 10, source: enemy, tags: [] })).toBe(0);
    dashing = false;
    expect(damage.deal(p, { amount: 10, source: enemy, tags: [] })).toBe(10);
  });

  it('nie zadaje obrażeń niezarejestrowanym ani ujemnych', () => {
    const { damage, registry, player, enemy } = setup();
    const ghost = registry.create('ghost', 'enemy');
    expect(damage.deal(ghost, { amount: 10, source: player, tags: [] })).toBe(
      0,
    );
    expect(damage.deal(enemy, { amount: -10, source: player, tags: [] })).toBe(
      0,
    );
  });
});

describe('Hitbox', () => {
  it('nie rani właściciela ani własnej drużyny, trafia cel raz na cios', () => {
    const { damage, registry, player, enemy, enemyHealth } = setup();
    const ally = registry.create('ally', 'player');
    damage.register(ally, new Health(() => 100));
    const hit = new Hitbox({
      owner: player,
      team: 'player',
      damage: 25,
      tags: ['#melee'],
      lifetimeS: 0.1,
    });
    expect(hit.strike(player, damage)).toBe(0);
    expect(hit.strike(ally, damage)).toBe(0);
    expect(hit.strike(enemy, damage)).toBe(25);
    expect(hit.strike(enemy, damage)).toBe(0);
    expect(enemyHealth.current).toBe(25);
  });

  it('wygasa po lifetimeS i stosuje mnożnik hurtboxa', () => {
    const { damage, player, enemy, enemy2 } = setup();
    const hit = new Hitbox({
      owner: player,
      team: 'player',
      damage: 20,
      tags: [],
      lifetimeS: 0.1,
    });
    expect(hit.strike(enemy, damage, { multiplier: 1.5 })).toBe(30);
    hit.step(0.1);
    expect(hit.expired).toBe(true);
    expect(hit.strike(enemy2, damage)).toBe(0);
  });
});

describe('queryHurtboxes (Rapier)', () => {
  let R: typeof RAPIER;
  beforeAll(async () => {
    R = await initPhysics();
  });

  it('znajduje hurtboxy w kształcie, jeden na encję (największy mnożnik), z filtrem grup', () => {
    const world = new R.World({ x: 0, y: -20, z: 0 });
    const hurtboxes = new Hurtboxes();
    const enemyGroups = interactionGroups(CollisionGroup.Enemy, 0xffff);
    const body = world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, -1.5),
    );
    const torso = world.createCollider(
      R.ColliderDesc.cuboid(0.3, 0.5, 0.2).setCollisionGroups(enemyGroups),
      body,
    );
    const head = world.createCollider(
      R.ColliderDesc.ball(0.15)
        .setTranslation(0, 0.7, 0)
        .setCollisionGroups(enemyGroups),
      body,
    );
    const far = world.createRigidBody(
      R.RigidBodyDesc.fixed().setTranslation(0, 1, -10),
    );
    const farCol = world.createCollider(
      R.ColliderDesc.cuboid(0.3, 0.5, 0.2).setCollisionGroups(enemyGroups),
      far,
    );
    hurtboxes.add(1, torso, 1);
    hurtboxes.add(1, head, 1.5);
    hurtboxes.add(2, farCol, 1);
    world.step(); // zbudowanie struktur zapytań

    const arc = new R.Cuboid(1, 1, 1);
    const playerAttack = interactionGroups(
      CollisionGroup.PlayerProjectile,
      CollisionGroup.Enemy,
    );
    const found = queryHurtboxes(
      world,
      hurtboxes,
      arc,
      { x: 0, y: 1.2, z: -1 },
      { x: 0, y: 0, z: 0, w: 1 },
      playerAttack,
    );
    expect(found).toEqual([
      { entity: 1, colliderHandle: head.handle, multiplier: 1.5 },
    ]);

    const worldOnly = interactionGroups(
      CollisionGroup.PlayerProjectile,
      CollisionGroup.World,
    );
    expect(
      queryHurtboxes(
        world,
        hurtboxes,
        arc,
        { x: 0, y: 1.2, z: -1 },
        { x: 0, y: 0, z: 0, w: 1 },
        worldOnly,
      ),
    ).toEqual([]);
    world.free();
  });
});
