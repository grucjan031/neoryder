import { beforeAll, describe, expect, it } from 'vitest';
import type * as RAPIER from '@dimforge/rapier3d-compat';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../../src/combat/damage';
import type { Hurtbox } from '../../src/combat/damage';
import {
  queryBladeArc,
  queryBladeSpin,
} from '../../src/combat/melee/bladeQueries';
import {
  bladeDefinitions,
  loadBlade,
  loadBladeDefinitions,
  plasmaBladeDefinition,
  resolveBlade,
  staffBladeDefinition,
  twinBladesDefinition,
} from '../../src/combat/melee/bladeSchema';
import type { BladeDefinition } from '../../src/combat/melee/bladeSchema';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import { ProjectileSystem } from '../../src/combat/weapons/projectiles';
import { loadLoadout, loadoutDefinitions } from '../../src/progression/loadout';
import {
  CollisionGroup,
  initPhysics,
  interactionGroups,
} from '../../src/physics';

const input = (
  held: Action[] = [],
  pressed: Action[] = [],
  released: Action[] = [],
): InputSnapshot => ({
  held: new Set(held),
  pressed: new Set(pressed),
  released: new Set(released),
  lookDelta: { x: 0, y: 0 },
});

let R: typeof RAPIER;
beforeAll(async () => {
  R = await initPhysics();
});

type Point = { x: number; y: number; z: number };
const PLAYER_AT: Point = { x: 0, y: 1, z: 0 };
const EYES: Point = { x: 0, y: 1.6, z: 0 };
const ENEMY = CollisionGroup.Enemy;

/** Prawdziwy Rapier: gracz w (0,1,0) patrzy w -Z; cele i strzelcy dokładani na życzenie. */
function world(def: BladeDefinition) {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const physics = new R.World({ x: 0, y: -20, z: 0 });
  const entities = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, entities);
  const hurtboxes = new Hurtboxes();
  const projectiles = new ProjectileSystem(
    physics,
    entities,
    hurtboxes,
    damage,
    bus,
    t,
  );
  const positions = new Map<number, Point>();
  const add = (
    kind: string,
    team: 'player' | 'enemy',
    at: Point,
    group: number,
    stats?: Stats,
  ) => {
    const id = entities.create(kind, team);
    const health = new Health(() => 1000);
    damage.register(id, health, stats ? { stats } : {});
    const collider = physics.createCollider(
      R.ColliderDesc.capsule(0.5, 0.35)
        .setTranslation(at.x, at.y, at.z)
        .setCollisionGroups(interactionGroups(group, 0xffff)),
    );
    hurtboxes.add(id, collider);
    entities.bindCollider(id, collider.handle);
    positions.set(id, at);
    return { id, health };
  };
  const playerStats = new Stats({ maxHealth: 1000 });
  const player = add(
    'player',
    'player',
    PLAYER_AT,
    CollisionGroup.Player,
    playerStats,
  );
  const blade = new PlasmaBlade(
    def,
    {
      owner: player.id,
      team: 'player',
      damage,
      stats: playerStats,
      energy: new ResourcePool({ max: () => 100, regenPerS: () => 0 }),
      queryArc: (reach, width, shape) =>
        shape === 'spin'
          ? queryBladeSpin(physics, hurtboxes, EYES, reach)
          : queryBladeArc(
              physics,
              hurtboxes,
              { x: EYES.x, y: EYES.y, z: EYES.z - reach / 2 },
              { x: 0, y: 0, z: 0, w: 1 },
              reach,
              width,
            ),
      hurtboxPosition: (box: Hurtbox) =>
        physics.getCollider(box.colliderHandle)?.translation() ?? null,
      aim: () => ({ origin: { ...EYES }, dir: { x: 0, y: 0, z: -1 } }),
      projectiles,
      positionOf: (id) => positions.get(id) ?? null,
    },
    bus,
    t,
  );
  projectiles.addInterceptor(blade.interceptProjectile);
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of ['damage_dealt', 'parry_success', 'melee_swing'] as const)
    bus.on(type, (payload) => log.push({ type, payload }));
  const run = (seconds: number, snapshot = input()) => {
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
      blade.step(SIM_DT, snapshot);
      projectiles.step(SIM_DT);
      damage.step(SIM_DT);
      physics.step();
    }
  };
  physics.step();
  return { t, physics, damage, blade, player, add, run, log, projectiles };
}

type World = ReturnType<typeof world>;

/** Ciężki atak: przytrzymanie przez heavyChargeS, puszczenie, czekanie na koniec cięcia. */
function heavy(c: World, def: BladeDefinition) {
  c.run(SIM_DT, input(['attack'], ['attack']));
  c.run(c.t.melee.heavyChargeS + SIM_DT, input(['attack']));
  c.run(SIM_DT, input([], [], ['attack']));
  c.run(
    (c.t.melee.heavyWindupS + c.t.melee.heavyActiveS) * def.timeScale + 0.05,
  );
}

const tap = (c: World) => {
  c.run(SIM_DT, input(['attack'], ['attack']));
  c.run(SIM_DT, input([], [], ['attack']));
};

const hitsOn = (c: World, id: number) =>
  c.log
    .filter((e) => e.type === 'damage_dealt')
    .map((e) => e.payload as GameEvents['damage_dealt'])
    .filter((e) => e.target === id);

/** Trafienia ciężkim atakiem (pierwszy lekki cios przy wciśnięciu też rani cele z przodu). */
const heavyHitsOn = (c: World, id: number) =>
  hitsOn(c, id).filter((e) => e.tags.includes('#heavy'));

const stagesOf = (c: World) =>
  c.log
    .filter((e) => e.type === 'melee_swing')
    .map((e) => (e.payload as GameEvents['melee_swing']).stage);

describe('dane wariantów ostrza', () => {
  it('ładuje trzy warianty z src/data/blades po id', () => {
    expect([...bladeDefinitions.keys()].sort()).toEqual([
      'plasmaBlade',
      'staffBlade',
      'twinBlades',
    ]);
    expect(plasmaBladeDefinition.id).toBe('plasmaBlade');
    expect(plasmaBladeDefinition.heavyShape).toBe('arc');
    expect(plasmaBladeDefinition.timeScale).toBe(1);
    expect(twinBladesDefinition.combo).toHaveLength(4);
    expect(staffBladeDefinition.heavyShape).toBe('spin');
    expect(
      [plasmaBladeDefinition, twinBladesDefinition, staffBladeDefinition].map(
        (d) => d.model,
      ),
    ).toEqual(['plasma_blade', 'blade_twin', 'blade_staff']);
    expect(twinBladesDefinition.offhand).toBe(true);
    expect(staffBladeDefinition.doubleEnded).toBe(true);
  });

  it('proporcje: bliźniacze szybsze, słabsze i z kruchym blokiem; dwustronne szersze, mocniejsze, wolniejsze', () => {
    const p = plasmaBladeDefinition;
    const twin = twinBladesDefinition;
    const staff = staffBladeDefinition;
    expect(twin.timeScale).toBeCloseTo(0.7);
    const twinAvg = twin.combo.reduce((a, s) => a + s.damage, 0) / 4;
    const plasmaAvg = p.combo.reduce((a, s) => a + s.damage, 0) / 3;
    expect(twinAvg / plasmaAvg).toBeGreaterThan(0.55);
    expect(twinAvg / plasmaAvg).toBeLessThan(0.75);
    expect(twin.blockDamageMult).toBeGreaterThan(p.blockDamageMult);
    expect(twin.parryArcDeg).toBeUndefined();
    expect(twin.combo[0]!.reach).toBeLessThan(p.combo[0]!.reach);
    expect(staff.timeScale).toBeCloseTo(1.2);
    expect(staff.combo[0]!.width / p.combo[0]!.width).toBeCloseTo(1.6, 1);
    expect(staff.combo[0]!.damage / p.combo[0]!.damage).toBeCloseTo(1.1, 1);
    expect(staff.parryArcDeg).toBeGreaterThan(tuning.melee.parryArcDeg);
  });

  it('walidacja: odrzuca błędny kształt, czas i powtórzone id', () => {
    expect(() =>
      loadBlade({ ...plasmaBladeDefinition, heavyShape: 'cone' }),
    ).toThrow(/ostrza/);
    expect(() =>
      loadBlade({ ...plasmaBladeDefinition, timeScale: 0 }),
    ).toThrow();
    expect(() =>
      loadBlade({ ...plasmaBladeDefinition, parryArcDeg: 400 }),
    ).toThrow();
    expect(() =>
      loadBladeDefinitions([plasmaBladeDefinition, plasmaBladeDefinition]),
    ).toThrow(/Powtórzone/);
  });
});

describe('wybór wariantu', () => {
  it('ostrze ekwipunku, nadpisanie (?blade= / ekran buildu), nieznane id', () => {
    const blade = loadoutDefinitions.get('blade')!.blade;
    expect(resolveBlade(blade).id).toBe('plasmaBlade');
    expect(resolveBlade(blade, null).id).toBe('plasmaBlade');
    expect(resolveBlade(blade, 'twinBlades').id).toBe('twinBlades');
    expect(resolveBlade(blade, 'staffBlade')).toBe(staffBladeDefinition);
    expect(resolveBlade(blade, 'nieMa').id).toBe('plasmaBlade');
    expect(resolveBlade('twinBlades', 'nieMa').id).toBe('twinBlades');
    expect(resolveBlade('twinBlades', 'staffBlade').id).toBe('staffBlade');
  });

  it('Loadout przyjmuje dowolne znane ostrze i odrzuca nieznane', () => {
    const base = {
      id: 'x',
      name: 'X',
      weapons: ['pistol'],
      powers: ['push'],
      tags: [],
    };
    expect(loadLoadout({ ...base, blade: 'twinBlades' }).blade).toBe(
      'twinBlades',
    );
    expect(() => loadLoadout({ ...base, blade: 'nieMa' })).toThrow();
  });
});

describe('bliźniacze ostrza: combo 1→2→3→4', () => {
  const cycleS = (m: typeof tuning.melee) =>
    (m.lightWindupS + m.lightActiveS + m.lightRecoveryS) *
    twinBladesDefinition.timeScale;

  it('cztery etapy w kolejności i z obrażeniami z danych', () => {
    const c = world(twinBladesDefinition);
    const dummy = c.add('dummy', 'enemy', { x: 0, y: 1, z: -1.2 }, ENEMY);
    c.physics.step();
    tap(c);
    // Kolejne kliknięcia w fazie odnowienia kontynuują combo.
    for (let stage = 2; stage <= 4; stage++) {
      c.run(cycleS(c.t.melee) * 0.5);
      tap(c);
    }
    c.run(cycleS(c.t.melee) * 1.5);
    expect(stagesOf(c)).toEqual([1, 2, 3, 4]);
    expect(hitsOn(c, dummy.id).map((e) => e.amount)).toEqual(
      twinBladesDefinition.combo.map((s) => s.damage),
    );
  });

  it('po czwartym ciosie combo zaczyna się od etapu 1', () => {
    const c = world(twinBladesDefinition);
    c.add('dummy', 'enemy', { x: 0, y: 1, z: -1.2 }, ENEMY);
    for (let i = 0; i < 5; i++) {
      tap(c);
      c.run(cycleS(c.t.melee) * 0.5);
    }
    expect(stagesOf(c)).toEqual([1, 2, 3, 4, 1]);
  });

  it('czas etapu: bliźniacze ok. 70%, dwustronne ok. 120% czasu ostrza plazmowego', () => {
    const lightSteps = (def: BladeDefinition) => {
      const c = world(def);
      tap(c);
      let steps = 2;
      while (c.blade.view().state === 'light' && steps < 200) {
        c.run(SIM_DT);
        steps++;
      }
      return steps;
    };
    const plasma = lightSteps(plasmaBladeDefinition);
    expect(lightSteps(twinBladesDefinition) / plasma).toBeGreaterThan(0.6);
    expect(lightSteps(twinBladesDefinition) / plasma).toBeLessThan(0.8);
    expect(lightSteps(staffBladeDefinition) / plasma).toBeGreaterThan(1.1);
    expect(lightSteps(staffBladeDefinition) / plasma).toBeLessThan(1.3);
  });
});

describe('dwustronne ostrze: obrót 360°', () => {
  it('ciężki atak trafia cele dookoła (też za plecami), nie trafia poza zasięgiem', () => {
    const c = world(staffBladeDefinition);
    const behind = c.add('dummy', 'enemy', { x: 0, y: 1, z: 1.6 }, ENEMY);
    const front = c.add('dummy', 'enemy', { x: 0, y: 1, z: -1.6 }, ENEMY);
    const side = c.add('dummy', 'enemy', { x: -1.8, y: 1, z: 0.4 }, ENEMY);
    const far = c.add('dummy', 'enemy', { x: 0, y: 1, z: 5 }, ENEMY);
    c.physics.step();
    heavy(c, staffBladeDefinition);
    for (const target of [behind, front, side]) {
      const hits = heavyHitsOn(c, target.id);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.amount).toBe(staffBladeDefinition.heavy.damage);
    }
    expect(heavyHitsOn(c, far.id)).toHaveLength(0);
    // Odrzut od gracza: cel za plecami leci w +Z, nie w kierunku patrzenia.
    expect(heavyHitsOn(c, behind.id)[0]!.dir!.z).toBeGreaterThan(0.9);
    expect(heavyHitsOn(c, front.id)[0]!.dir!.z).toBeLessThan(-0.9);
  });

  it('zwykły łuk (ciężki cios ostrza plazmowego) nie trafia celu za plecami', () => {
    const c = world(plasmaBladeDefinition);
    const behind = c.add('dummy', 'enemy', { x: 0, y: 1, z: 1.6 }, ENEMY);
    const front = c.add('dummy', 'enemy', { x: 0, y: 1, z: -1.6 }, ENEMY);
    c.physics.step();
    heavy(c, plasmaBladeDefinition);
    expect(heavyHitsOn(c, front.id)).toHaveLength(1);
    expect(heavyHitsOn(c, behind.id)).toHaveLength(0);
  });

  it('lekkie cięcie dwustronnego jest łukiem: cel za plecami bezpieczny', () => {
    const c = world(staffBladeDefinition);
    const behind = c.add('dummy', 'enemy', { x: 0, y: 1, z: 1.2 }, ENEMY);
    const front = c.add('dummy', 'enemy', { x: 0, y: 1, z: -1.2 }, ENEMY);
    c.physics.step();
    tap(c);
    c.run(0.4);
    expect(hitsOn(c, front.id).map((e) => e.amount)).toEqual([
      staffBladeDefinition.combo[0]!.damage,
    ]);
    expect(hitsOn(c, behind.id)).toHaveLength(0);
  });

  it('łuk dwustronnego jest szerszy: cel z boku trafiony, u plazmowego nie', () => {
    const sideHits = (def: BladeDefinition) => {
      const c = world(def);
      const side = c.add('dummy', 'enemy', { x: 1.6, y: 1, z: -1.2 }, ENEMY);
      c.physics.step();
      tap(c);
      c.run(0.4);
      return hitsOn(c, side.id).length;
    };
    expect(sideHits(staffBladeDefinition)).toBe(1);
    expect(sideHits(plasmaBladeDefinition)).toBe(0);
  });
});

describe('parowanie: kąt odbijania', () => {
  /** Pocisk nadlatuje pod kątem `deg` od kierunku patrzenia (0 = z przodu, 90 = z boku). */
  function parries(def: BladeDefinition, deg: number): boolean {
    const c = world(def);
    const rad = (deg * Math.PI) / 180;
    const distance = 9;
    const origin = {
      x: Math.sin(rad) * distance,
      y: 1,
      z: -Math.cos(rad) * distance,
    };
    const shooter = c.add('gunner', 'enemy', origin, ENEMY);
    c.physics.step();
    c.projectiles.spawn({
      owner: shooter.id,
      team: 'enemy',
      origin,
      dir: { x: -Math.sin(rad), y: 0, z: Math.cos(rad) },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 4,
    });
    c.run((distance - 0.35) / 10 - 0.08);
    c.run(1.5, input(['block']));
    return c.log.some((e) => e.type === 'parry_success');
  }

  it('dwustronne odbija pocisk z boku, którego plazmowe i bliźniacze nie odbijają', () => {
    expect(parries(plasmaBladeDefinition, 0)).toBe(true);
    expect(parries(staffBladeDefinition, 0)).toBe(true);
    // 100° od patrzenia: poza 160° plazmowego (±80°), w 240° dwustronnego (±120°).
    expect(parries(plasmaBladeDefinition, 100)).toBe(false);
    expect(parries(twinBladesDefinition, 100)).toBe(false);
    expect(parries(staffBladeDefinition, 100)).toBe(true);
    // 140° nie mieści się nawet w 240°.
    expect(parries(staffBladeDefinition, 140)).toBe(false);
  });

  it('okno parowania bez zmian: blok trzymany dłużej nie odbija', () => {
    const c = world(staffBladeDefinition);
    const origin = { x: 0, y: 1, z: -9 };
    const shooter = c.add('gunner', 'enemy', origin, ENEMY);
    c.physics.step();
    c.projectiles.spawn({
      owner: shooter.id,
      team: 'enemy',
      origin,
      dir: { x: 0, y: 0, z: 1 },
      speed: 10,
      damage: 12,
      tags: ['#gun'],
      lifetimeS: 4,
    });
    c.run((9 - 0.35) / 10 - 0.4);
    c.run(1.5, input(['block']));
    expect(c.log.some((e) => e.type === 'parry_success')).toBe(false);
  });
});

describe('blok bliźniaczych', () => {
  it('słabsza redukcja obrażeń niż plazmowe', () => {
    const taken = (def: BladeDefinition) => {
      const c = world(def);
      const shooter = c.add('gunner', 'enemy', { x: 0, y: 1, z: -9 }, ENEMY);
      c.physics.step();
      c.run(0.5, input(['block']));
      c.damage.deal(c.player.id, { amount: 20, source: shooter.id, tags: [] });
      return 1000 - c.player.health.current;
    };
    expect(taken(plasmaBladeDefinition)).toBeCloseTo(
      20 * plasmaBladeDefinition.blockDamageMult,
    );
    expect(taken(twinBladesDefinition)).toBeCloseTo(
      20 * twinBladesDefinition.blockDamageMult,
    );
    expect(taken(twinBladesDefinition)).toBeGreaterThan(
      taken(plasmaBladeDefinition),
    );
  });
});

describe('zmiana wariantu w locie', () => {
  it('setDefinition podmienia dane i czyści stan', () => {
    const c = world(plasmaBladeDefinition);
    c.run(SIM_DT, input(['attack'], ['attack']));
    expect(c.blade.view().state).toBe('light');
    c.blade.setDefinition(twinBladesDefinition);
    expect(c.blade.definition.id).toBe('twinBlades');
    expect(c.blade.view().state).toBe('idle');
  });
});
