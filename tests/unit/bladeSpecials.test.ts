import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { Action, InputSnapshot } from '../../src/core/input';
import type { Vec3 } from '../../src/core/math';
import { EntityRegistry } from '../../src/core/entities';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import { queryBladeSegment } from '../../src/combat/melee/bladeQueries';
import { FlyingBlade } from '../../src/render/flyingBlade';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

let R: typeof RAPIER;
const cleanup: (() => void)[] = [];
beforeAll(async () => {
  R = await initPhysics();
});
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});
const input = (
  pressed: Action[] = [],
  held: Action[] = pressed,
): InputSnapshot => ({
  pressed: new Set(pressed),
  held: new Set(held),
  released: new Set(),
  lookDelta: { x: 0, y: 0 },
});

function setup(wallZ?: number) {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const world = new R.World({ x: 0, y: 0, z: 0 });
  const registry = new EntityRegistry(bus);
  const player = registry.create('player', 'player');
  const damage = new DamageSystem(bus, registry);
  const hurtboxes = new Hurtboxes();
  const stats = new Stats({ maxHealth: 100 });
  damage.register(player, new Health(() => 100), { stats });
  const energy = new ResourcePool({ max: () => 100, regenPerS: () => 0 });
  const pose = { origin: { x: 0, y: 1.6, z: 0 }, dir: { x: 0, y: 0, z: -1 } };
  let active = false;
  const hits: GameEvents['damage_dealt'][] = [];
  const thrown: GameEvents['blade_thrown'][] = [];
  const returned: GameEvents['blade_returned'][] = [];
  const swings: GameEvents['melee_swing'][] = [];
  const stops: number[] = [];
  const reflect = vi.fn();
  bus.on('damage_dealt', (e) => hits.push(e));
  bus.on('blade_thrown', (e) => thrown.push(e));
  bus.on('blade_returned', (e) => returned.push(e));
  bus.on('melee_swing', (e) => swings.push(e));
  bus.on('hitstop', (e) => stops.push(e.ms));
  const query = (
    from: typeof pose.origin,
    to: typeof pose.origin,
    radius: number,
    dash: boolean,
    dir?: Vec3,
  ) =>
    queryBladeSegment(
      world,
      hurtboxes,
      from,
      to,
      radius,
      dash,
      t.melee.dashCutHeightM,
      dir,
    );
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner: player,
      team: 'player',
      damage,
      stats,
      energy,
      aim: () => pose,
      projectiles: { reflect },
      dashActive: () => active,
      queryArc: () =>
        query(pose.origin, { ...pose.origin, z: pose.origin.z - 2 }, 1, true),
      querySegment: query,
      hurtboxPosition: (box) =>
        world.getCollider(box.colliderHandle)?.translation() ?? null,
      castWall: (origin, dir, max, ignore) =>
        world.castRay(
          new R.Ray(origin, dir),
          max,
          true,
          undefined,
          interactionGroups(CollisionGroup.Player, CollisionGroup.World),
          undefined,
          undefined,
          ignore === undefined ? undefined : (c) => c.handle !== ignore,
        )?.timeOfImpact ?? null,
    },
    bus,
    t,
  );
  cleanup.push(() => {
    blade.dispose();
    world.free();
  });
  if (wallZ !== undefined)
    world.createCollider(
      R.ColliderDesc.cuboid(10, 3, 0.1)
        .setTranslation(0, 1.6, wallZ)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
  const enemy = (x: number, z: number, y = 1.6, hp = 1000) => {
    const id = registry.create('dummy', 'enemy');
    const health = new Health(() => hp);
    damage.register(id, health);
    // Two hurtboxes must still produce one fixed-damage hit per enemy.
    for (const multiplier of [1, 1.5]) {
      const collider = world.createCollider(
        R.ColliderDesc.ball(0.05)
          .setTranslation(x, y, z)
          .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
      );
      hurtboxes.add(id, collider, multiplier);
    }
    world.step();
    return { id, health };
  };
  const step = (snapshot = input(), n = 1, dt = SIM_DT) => {
    for (let i = 0; i < n; i++) blade.step(dt, snapshot);
  };
  const startDash = (dir = { x: 0, y: 0, z: -1 }) => {
    active = true;
    bus.emit('dash_used', { user: player, dir });
  };
  const endDash = () => {
    active = false;
    step();
  };
  world.step();
  return {
    t,
    bus,
    player,
    blade,
    damage,
    stats,
    energy,
    pose,
    enemy,
    hits,
    thrown,
    returned,
    swings,
    stops,
    reflect,
    world,
    registry,
    hurtboxes,
    query,
    step,
    startDash,
    endDash,
  };
}

describe('rzut ostrzem', () => {
  it('leci w kierunku celowania z prędkością z danych i zawraca dokładnie na zasięgu', () => {
    const c = setup();
    const def = plasmaBladeDefinition.throw!;
    c.step(input(['bladeThrow']));
    expect(c.blade.view().flight?.position.z).toBeCloseTo(-def.speed * SIM_DT);
    c.pose.dir.x = 1;
    c.pose.dir.z = 0;
    for (let i = 0; i < 100 && !c.blade.view().flight?.returning; i++) c.step();
    expect(c.blade.view().flight?.position).toEqual({
      x: 0,
      y: 1.6,
      z: -def.rangeM,
    });
    c.step();
    expect(c.blade.view().flight?.position.z).toBeCloseTo(
      -def.rangeM + def.returnSpeed * SIM_DT,
    );
    expect(c.thrown).toEqual([{ owner: c.player }]);
  });

  it('trafia wszystkich na torze raz łącznie z powrotem i pomija cele poza promieniem', () => {
    const c = setup();
    const a = c.enemy(0, -2);
    const b = c.enemy(0.3, -8);
    const outside = c.enemy(0.6, -4);
    const far = c.enemy(0, -18);
    c.step(input(['bladeThrow']));
    c.step(input(), 150);
    expect(c.hits.map((h) => h.target)).toEqual([a.id, b.id]);
    expect(c.hits.map((h) => h.amount)).toEqual([35, 35]);
    expect(
      c.hits.every((h) => h.source === c.player && h.tags.includes('#melee')),
    ).toBe(true);
    expect(outside.health.current).toBe(1000);
    expect(far.health.current).toBe(1000);
    expect(c.stops).toEqual([c.t.time.hitstopLightMs]);
  });

  it('trafia zniszczalną skrzynię (collider World + hurtbox): cel nie zasłania sam siebie', () => {
    const c = setup();
    const id = c.registry.create('prop_crate', 'neutral');
    c.damage.register(id, new Health(() => 1000));
    const collider = c.world.createCollider(
      R.ColliderDesc.cuboid(0.5, 0.8, 0.5)
        .setTranslation(0, 1.6, -4)
        .setCollisionGroups(
          interactionGroups(
            CollisionGroup.World | CollisionGroup.Enemy,
            0xffff,
          ),
        ),
    );
    c.hurtboxes.add(id, collider);
    c.world.step();
    c.step(input(['bladeThrow']));
    c.step(input(), 60);
    expect(c.hits.map((h) => h.target)).toContain(id);
  });

  it('raycast zatrzymuje na ścianie i od następnego kroku wraca', () => {
    const c = setup(-3);
    const behind = c.enemy(0, -4);
    c.step(input(['bladeThrow']));
    for (let i = 0; i < 20 && !c.blade.view().flight?.returning; i++) c.step();
    const z = c.blade.view().flight?.position.z;
    expect(z).toBeCloseTo(-2.9 + plasmaBladeDefinition.throw!.radiusM);
    expect(c.blade.view().flight?.returning).toBe(true);
    c.step();
    expect(c.blade.view().flight!.position.z).toBeGreaterThan(z!);
    c.step(input(), 30);
    expect(behind.health.current).toBe(1000);
    expect(c.returned).toEqual([{ owner: c.player }]);
  });

  it('wraca do poruszającego się gracza i trafia nowy cel na drodze powrotnej', () => {
    const c = setup();
    c.step(input(['bladeThrow']));
    c.step(input(), 48);
    const target = c.enemy(3, -8);
    c.pose.origin.x = 6;
    for (let i = 0; i < 200 && c.blade.view().flight; i++) {
      c.pose.origin.x += 0.01;
      c.step();
    }
    expect(c.hits.map((h) => h.target)).toContain(target.id);
    expect(c.blade.view().state).toBe('idle');
    expect(c.returned).toEqual([{ owner: c.player }]);
    c.step(input(), 10);
    expect(c.returned).toHaveLength(1);
  });

  it('usuwa blok, ignoruje cięcia, ładowanie, parowanie i ponowne rzuty w locie', () => {
    const c = setup();
    c.step(input([], ['block']));
    expect(c.blade.blocking).toBe(true);
    c.step(input(['bladeThrow'], ['block']));
    c.step(input(['bladeThrow', 'attack'], ['attack', 'block']), 50);
    expect(c.blade.view().state).toBe('throwing');
    expect(c.blade.blocking).toBe(false);
    expect(c.stats.modifiers('damageTaken')).toHaveLength(0);
    const attacker = c.enemy(0, -10);
    expect(
      c.blade.interceptProjectile({
        projectile: attacker.id,
        owner: attacker.id,
        target: c.player,
        team: 'enemy',
        point: c.pose.origin,
        dir: { x: 0, y: 0, z: 1 },
        speed: 10,
      }),
    ).toBe(false);
    expect(c.reflect).not.toHaveBeenCalled();
    expect(
      c.damage.deal(c.player, {
        source: attacker.id,
        amount: 40,
        tags: ['#gun'],
      }),
    ).toBe(40);
    expect(c.swings).toHaveLength(0);
    expect(c.thrown).toHaveLength(1);
    expect(c.energy.current).toBe(100);
    c.step(input(), 100);
    expect(c.blade.view().state).toBe('idle');
    expect(c.swings).toHaveLength(0);
  });

  it('nie przesuwa ostrza w hitstopie i reset usuwa lot bez zdarzenia powrotu', () => {
    const c = setup();
    c.step(input(['bladeThrow']));
    const view = c.blade.view();
    c.step(input(['attack']), 1, 0);
    expect(c.blade.view().flight).toEqual({
      ...view.flight,
      previous: view.flight!.position,
      previousAgeS: view.flight!.ageS,
    });
    const renderer = new FlyingBlade();
    cleanup.push(() => renderer.dispose());
    renderer.render(c.blade.view(), 0, c.t);
    const position = renderer.root.position.clone();
    const rotation = renderer.root.rotation.clone();
    renderer.render(c.blade.view(), 1, c.t);
    expect(renderer.root.position).toEqual(position);
    expect(renderer.root.rotation.toArray()).toEqual(rotation.toArray());
    c.blade.reset();
    expect(c.blade.view().flight).toBeNull();
    expect(c.returned).toHaveLength(0);
  });
});

describe('dash-cięcie', () => {
  it('pas jest obrócony w kierunku dashu, a nie zastąpiony osiowym bounding boxem', () => {
    const c = setup();
    const onPath = c.enemy(2, -2);
    const offPath = c.enemy(0, -3);
    c.startDash();
    c.pose.origin.x = 4;
    c.pose.origin.z = -4;
    c.step(input(['attack']));
    expect(c.hits.map((h) => h.target)).toEqual([onPath.id]);
    expect(offPath.health.current).toBe(1000);
  });
  it('późne wciśnięcie obejmuje przebyte i kolejne fragmenty toru, raz na wroga', () => {
    const c = setup();
    const a = c.enemy(0, -1);
    const b = c.enemy(0.9, -3);
    const d = c.enemy(0, -5.5);
    const outside = c.enemy(1.2, -2);
    c.startDash();
    c.pose.origin.z = -4;
    c.step(input(['attack']));
    expect(c.hits.map((h) => h.target)).toEqual(
      expect.arrayContaining([a.id, b.id]),
    );
    expect(c.hits).toHaveLength(2);
    c.pose.origin.z = -6;
    c.endDash();
    expect(c.hits.map((h) => h.target)).toEqual(
      expect.arrayContaining([a.id, b.id, d.id]),
    );
    expect(c.hits).toHaveLength(3);
    expect(
      c.hits.every(
        (h) => h.amount === 50 && h.knockback === 7 && h.dir?.z === -1,
      ),
    ).toBe(true);
    expect(outside.health.current).toBe(1000);
    c.step(input(), 15);
    expect(c.hits).toHaveLength(3);
  });

  it('działa w oknie po dashu, używa zamrożonego końca toru i resetuje combo', () => {
    const c = setup();
    c.step(input(['attack']));
    c.step(input(), 30);
    const target = c.enemy(0, -2);
    const pastEnd = c.enemy(0, -8);
    c.startDash();
    c.pose.origin.z = -6;
    c.endDash();
    c.pose.origin.z = -10;
    c.step(input(), 3);
    c.step(input(['attack']));
    expect(c.hits.map((h) => h.target)).toEqual([target.id]);
    expect(pastEnd.health.current).toBe(1000);
    c.step(input(['attack']));
    expect(c.blade.view().stage).toBe(1);
  });

  it('po oknie wykonuje zwykłe cięcie, a bez dashu zachowuje dotychczasowy atak', () => {
    for (const withDash of [false, true]) {
      const c = setup();
      const target = c.enemy(0, -1);
      if (withDash) {
        c.startDash();
        c.endDash();
        c.step(input(), Math.ceil(c.t.melee.dashCutGraceS / SIM_DT) + 1);
      }
      c.step(input(['attack']));
      c.step(input(), 20);
      expect(
        c.hits.filter((h) => h.target === target.id).map((h) => h.amount),
      ).toEqual([37.5]);
    }
  });
});

describe('regresje przeglądu F2-10', () => {
  it('rzut czeka na koniec dash-cięcia, które zachowuje listę trafionych celów', () => {
    const c = setup();
    const a = c.enemy(0, -1);
    const b = c.enemy(0, -3);
    c.startDash();
    c.pose.origin.z = -2;
    c.step(input(['attack']));
    c.step(input(['bladeThrow']));
    expect(c.blade.view().state).toBe('dashCut');
    expect(c.thrown).toHaveLength(0);
    c.pose.origin.z = -4;
    c.endDash();
    expect(c.hits.map((h) => h.target)).toEqual([a.id, b.id]);
    expect(c.thrown).toHaveLength(0);
    c.step();
    expect(c.thrown).toHaveLength(1);
  });

  it('zachowuje rzut w długim hitstopie do pierwszego dodatniego kroku', () => {
    const c = setup();
    c.step(input(['bladeThrow']), 1, 0);
    c.step(input(), 100, 0);
    expect(c.thrown).toHaveLength(0);
    c.step();
    expect(c.thrown).toHaveLength(1);
  });

  it.each([false, true])(
    'atak w hitstopie daje dash-cięcie (okno po dashu: %s)',
    (afterDash) => {
      const c = setup();
      const target = c.enemy(0, -2);
      c.startDash();
      c.pose.origin.z = -4;
      if (afterDash) c.endDash();
      c.step(input(['attack']), 1, 0);
      c.step(input(), 100, 0);
      expect(c.hits).toHaveLength(0);
      c.step();
      expect(c.hits.map((h) => [h.target, h.amount])).toEqual([
        [target.id, 50],
      ]);
    },
  );

  it('klik w ostatniej części okna łaski nie ginie po hitstopie', () => {
    const c = setup();
    c.startDash();
    c.endDash();
    c.step(input(), 1, c.t.melee.dashCutGraceS - SIM_DT / 2);
    c.step(input(['attack']), 1, 0);
    c.step();
    expect(c.swings).toHaveLength(1);
    expect(c.blade.view().state).toBe('idle');
  });

  it.each(['bladeThrow', 'attack'] as const)(
    'akcja %s nie przerywa windup/active lekkiego ciosu',
    (action) => {
      const c = setup();
      c.step(input(['attack']));
      expect(c.blade.view().phase).toBe('windup');
      c.step(input(['bladeThrow']));
      expect(c.blade.view().state).toBe('light');
      for (let i = 0; i < 10 && c.blade.view().phase !== 'active'; i++)
        c.step();
      expect(c.blade.view().phase).toBe('active');
      c.startDash();
      c.step(input([action]));
      expect(c.blade.view().state).toBe('light');
      c.step(input([action]));
      expect(c.blade.view().phase).toBe('active');
      for (let i = 0; i < 20 && c.blade.view().state === 'light'; i++) c.step();
      expect(c.blade.view().state).toBe(
        action === 'bladeThrow' ? 'throwing' : 'dashCut',
      );
    },
  );

  function heavy(c: ReturnType<typeof setup>) {
    c.step(input(['attack']));
    c.step(
      input([], ['attack']),
      Math.ceil(c.t.melee.heavyChargeS / SIM_DT) + 1,
    );
    c.step();
    expect(c.blade.view().state).toBe('heavy');
  }

  it.each(['bladeThrow', 'attack'] as const)(
    'akcja %s nie przerywa ciężkiego ciosu z recovery',
    (action) => {
      const c = setup();
      heavy(c);
      c.startDash();
      // Stałe odnawianie żądania w każdej fazie, także w recovery.
      for (let i = 0; i < 90 && c.blade.view().state === 'heavy'; i++) {
        c.step(input([action]));
        expect(c.thrown).toHaveLength(0);
        expect(c.swings.filter((e) => e.stage === 1)).toHaveLength(1);
      }
      expect(c.blade.view().state).toBe('idle');
      c.step();
      expect(c.blade.view().state).toBe(
        action === 'bladeThrow' ? 'throwing' : 'dashCut',
      );
    },
  );

  it('ciężki cios i dash-cięcie nie sumują obrażeń w kroku trafienia', () => {
    const c = setup();
    heavy(c);
    const target = c.enemy(0, -3);
    c.startDash();
    // Początek toru jest przed celem, bieżąca pozycja za nim.
    c.pose.origin.z = -2;
    for (let i = 0; i < 60 && c.blade.view().state === 'heavy'; i++) {
      const before = c.hits.length;
      c.step(input(['attack']));
      expect(c.hits.slice(before).some((h) => h.amount === 50)).toBe(false);
      if (c.blade.view().phase === 'recovery') c.pose.origin.z = -4;
    }
    c.step();
    expect(c.hits.some((h) => h.tags.includes('#heavy'))).toBe(true);
    expect(
      c.hits.filter((h) => h.target === target.id && h.amount === 50),
    ).toHaveLength(1);
  });

  it('stary bufor rzutu wygasa podczas ciężkiego ciosu', () => {
    const c = setup();
    heavy(c);
    c.step(input(['bladeThrow']));
    c.step(input(), 90);
    expect(c.thrown).toHaveLength(0);
    expect(c.blade.view().state).toBe('idle');
  });

  it.each(['bladeThrow', 'attack'] as const)(
    'odlicza rozbicie gardy podczas %s',
    (action) => {
      const c = setup();
      const attacker = c.enemy(5, -10);
      c.energy.set(0);
      c.step(input([], ['block']));
      c.damage.deal(c.player, { source: attacker.id, amount: 40, tags: [] });
      expect(c.blade.view().guardBrokenS).toBe(c.t.melee.guardBreakLockS);
      c.startDash();
      c.step(input([action]));
      c.step(input(), 5);
      expect(c.blade.view().guardBrokenS).toBeCloseTo(
        c.t.melee.guardBreakLockS - 6 * SIM_DT,
      );
      const remaining = c.blade.view().guardBrokenS;
      c.step(input(), 10, 0);
      expect(c.blade.view().guardBrokenS).toBe(remaining);
    },
  );

  it.each([-3, -0.15])(
    'nie trafia tuż za cienką ścianą przy z=%s, także na powrocie',
    (z) => {
      const c = setup();
      c.world.createCollider(
        R.ColliderDesc.cuboid(2, 3, 0.01)
          .setTranslation(0, 1.6, z)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      const behind = c.enemy(0, z - 0.11);
      c.step(input(['bladeThrow']));
      c.step(input(), 100);
      expect(behind.health.current).toBe(1000);
      expect(c.returned).toHaveLength(1);
    },
  );

  it('zerowy tor używa kierunku dashu do obrotu pasa i odrzutu', () => {
    const c = setup();
    const across = c.enemy(0, 0.7);
    const forward = c.enemy(0.7, 0);
    c.startDash({ x: 1, y: 0, z: 0 });
    c.step(input(['attack']));
    expect(c.hits.map((h) => h.target)).toEqual([across.id]);
    expect(c.hits[0]?.dir).toEqual({ x: 1, y: 0, z: 0 });
    expect(forward.health.current).toBe(1000);
  });

  it('zerowy krok rzutu przy ścianie zachowuje kierunek celowania', () => {
    const c = setup();
    c.pose.dir = { x: 1, y: 0, z: 0 };
    c.world.createCollider(
      R.ColliderDesc.cuboid(0.01, 2, 2)
        .setTranslation(0.15, 1.6, 0)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    const target = c.enemy(0, 0.2);
    c.step(input(['bladeThrow']));
    expect(c.blade.view().flight?.position).toEqual(c.pose.origin);
    expect(c.hits.map((h) => h.target)).toEqual([target.id]);
    expect(c.hits[0]?.dir).toEqual({ x: 1, y: 0, z: 0 });
  });

  it.each(['bladeThrow', 'attack'] as const)(
    'zabójstwa w dalszych krokach %s podbijają hitstop raz',
    (action) => {
      const c = setup();
      c.enemy(0, -1);
      c.enemy(0, -3, 1.6, 20);
      c.enemy(0, -5, 1.6, 20);
      if (action === 'attack') {
        c.startDash();
        c.pose.origin.z = -2;
      }
      c.step(input([action]));
      if (action === 'attack') {
        c.pose.origin.z = -4;
        c.step();
        c.pose.origin.z = -6;
        c.endDash();
      } else c.step(input(), 100);
      expect(c.hits.filter((h) => h.killed)).toHaveLength(2);
      expect(c.stops).toEqual([
        c.t.time.hitstopLightMs,
        c.t.time.hitstopHeavyMs,
      ]);
    },
  );

  it.each(['bladeThrow', 'attack'] as const)(
    'pierwsze zabójstwo %s emituje tylko ciężki hitstop',
    (action) => {
      const c = setup();
      c.enemy(0, -0.3, 1.6, 20);
      if (action === 'attack') {
        c.startDash();
        c.pose.origin.z = -1;
      }
      c.step(input([action]));
      c.step(input(), 100);
      expect(c.stops).toEqual([c.t.time.hitstopHeavyMs]);
    },
  );

  it.each(['bladeThrow', 'attack'] as const)(
    'punkt trafienia %s to pozycja trafionego hurtboxa',
    (action) => {
      const c = setup();
      const a = c.enemy(0, -1, 1.7);
      const b = c.enemy(0, -3, 1.4);
      if (action === 'attack') {
        c.startDash();
        c.pose.origin.z = -4;
      }
      c.step(input([action]));
      c.step(input(), 80);
      expect(c.hits.find((h) => h.target === a.id)?.point).toEqual({
        x: 0,
        y: expect.closeTo(1.7),
        z: -1,
      });
      expect(c.hits.find((h) => h.target === b.id)?.point).toEqual({
        x: 0,
        y: expect.closeTo(1.4),
        z: -3,
      });
    },
  );

  it('pas dash-cięcia ogranicza również wysokość', () => {
    const c = setup();
    const within = c.enemy(0, -1, 2.1);
    const above = c.enemy(0, -2, 2.4);
    const below = c.enemy(0, -3, 0.8);
    c.startDash();
    c.pose.origin.z = -4;
    c.step(input(['attack']));
    expect(c.hits.map((h) => h.target)).toEqual([within.id]);
    expect(above.health.current).toBe(1000);
    expect(below.health.current).toBe(1000);
  });

  it.each([
    { x: 0, y: 0.6, z: -0.8 },
    { x: 0, y: -1, z: 0 },
  ])('rzut w pionie: %j', (dir) => {
    const c = setup();
    c.pose.dir = dir;
    const target = c.enemy(dir.x * 3, dir.z * 3, 1.6 + dir.y * 3);
    const outside = c.enemy(1, dir.z * 3, 1.6 + dir.y * 3);
    c.step(input(['bladeThrow']));
    const first = c.blade.view().flight!.position;
    expect(first.y).toBeCloseTo(1.6 + dir.y * 20 * SIM_DT);
    c.step(input(), 100);
    expect(c.hits.map((h) => h.target)).toEqual([target.id]);
    expect(outside.health.current).toBe(1000);
  });
});
