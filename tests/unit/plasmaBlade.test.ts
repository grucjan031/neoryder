import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { EntityRegistry } from '../../src/core/entities';
import type { Action, InputSnapshot } from '../../src/core/input';
import { SIM_DT } from '../../src/core/loop';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';
import { tuning } from '../../src/core/tuning';
import { DamageSystem, Health } from '../../src/combat/damage';
import type { Hurtbox } from '../../src/combat/damage';
import { PlasmaBlade } from '../../src/combat/melee/plasmaBlade';
import {
  loadBlade,
  plasmaBladeDefinition,
} from '../../src/combat/melee/bladeSchema';

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

function setup(opts: { inRange?: boolean; enemyHp?: number } = {}) {
  const t = structuredClone(tuning);
  const bus = new EventBus();
  const registry = new EntityRegistry(bus);
  const damage = new DamageSystem(bus, registry);
  const player = registry.create('player', 'player');
  const enemy = registry.create('trooper', 'enemy');
  const playerStats = new Stats({ maxHealth: 100, maxEnergy: 100 });
  const playerHealth = new Health(() => playerStats.get('maxHealth'));
  const enemyHealth = new Health(() => opts.enemyHp ?? 1000);
  damage.register(player, playerHealth, { stats: playerStats });
  damage.register(enemy, enemyHealth);
  const energy = new ResourcePool({ max: () => 100, regenPerS: () => 0 });
  const target: Hurtbox = { entity: enemy, colliderHandle: 1, multiplier: 1 };
  let inRange = opts.inRange ?? true;
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner: player,
      team: 'player',
      damage,
      stats: playerStats,
      energy,
      queryArc: () => (inRange ? [target] : []),
      aim: () => ({
        origin: { x: 0, y: 1.6, z: 0 },
        dir: { x: 0, y: 0, z: -1 },
      }),
    },
    bus,
    t,
  );
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  for (const type of [
    'damage_dealt',
    'melee_swing',
    'hitstop',
    'melee_blocked',
  ] as const)
    bus.on(type, (payload) => log.push({ type, payload }));
  const step = (snapshot: InputSnapshot = input(), n = 1) => {
    for (let i = 0; i < n; i++) blade.step(SIM_DT, snapshot);
  };
  const steps = (s: number) => Math.ceil(s / SIM_DT);
  const dealt = () =>
    log
      .filter((e) => e.type === 'damage_dealt')
      .map((e) => (e.payload as GameEvents['damage_dealt']).amount);
  const setInRange = (v: boolean) => {
    inRange = v;
  };
  return {
    t,
    bus,
    damage,
    blade,
    player,
    enemy,
    playerStats,
    playerHealth,
    enemyHealth,
    energy,
    log,
    step,
    steps,
    dealt,
    setInRange,
  };
}

it('hak wykończenia konsumuje lekki atak i resetuje combo', () => {
  const f = setup();
  let execute = false;
  let calls = 0;
  const blade = new PlasmaBlade(
    plasmaBladeDefinition,
    {
      owner: f.player,
      team: 'player',
      damage: f.damage,
      stats: f.playerStats,
      energy: f.energy,
      queryArc: () => [{ entity: f.enemy, colliderHandle: 1, multiplier: 1 }],
      aim: () => ({ origin: { x: 0, y: 1, z: 0 }, dir: { x: 0, y: 0, z: -1 } }),
      tryExecute: () => {
        calls++;
        return execute;
      },
    },
    f.bus,
    f.t,
  );
  blade.step(SIM_DT, input(['attack'], ['attack']));
  expect(blade.view().stage).toBe(1);
  for (let i = 0; i < 10; i++) blade.step(SIM_DT, input());
  expect(blade.view().phase).toBe('recovery');
  const damageBefore = f.enemyHealth.current;
  const swingsBefore = f.log.filter((e) => e.type === 'melee_swing').length;
  f.t.melee.executeActiveS = 0.04;
  f.t.melee.executeRecoveryS = 0.08;
  execute = true;
  blade.step(SIM_DT, input(['attack'], ['attack']));
  expect(calls).toBe(2);
  expect(blade.view()).toMatchObject({
    state: 'idle',
    stage: 0,
    execution: { phase: 'active', phaseT: 0 },
  });
  blade.step(0, input(['attack']));
  expect(blade.view().execution).toEqual({ phase: 'active', phaseT: 0 });
  blade.step(f.t.melee.executeActiveS / 2, input(['attack']));
  expect(blade.view().execution).toEqual({ phase: 'active', phaseT: 0.5 });
  blade.step(f.t.melee.executeActiveS / 2, input(['attack']));
  expect(blade.view().execution).toEqual({ phase: 'recovery', phaseT: 0 });
  for (let i = 0; i < 40; i++) blade.step(SIM_DT, input(['attack']));
  expect(blade.view().execution).toBeNull();
  expect(f.enemyHealth.current).toBe(damageBefore);
  expect(f.log.filter((e) => e.type === 'melee_swing')).toHaveLength(
    swingsBefore,
  );
  execute = false;
  blade.step(SIM_DT, input(['attack'], ['attack']));
  expect(blade.view().stage).toBe(1);
  blade.dispose();
  f.blade.dispose();
});

/** Jeden lekki cios: klik i puszczenie, potem czekanie do fazy odnowienia. */
function tap(ctx: ReturnType<typeof setup>) {
  ctx.step(input(['attack'], ['attack']));
  ctx.step(input([], [], ['attack']));
}

describe('dane ostrza', () => {
  it('waliduje poprawne dane i odrzuca błędne', () => {
    expect(plasmaBladeDefinition.combo.map((s) => s.damage)).toEqual([
      25, 25, 40,
    ]);
    expect(plasmaBladeDefinition.heavy.damage).toBe(80);
    expect(() =>
      loadBlade({ ...plasmaBladeDefinition, blockDamageMult: 2 }),
    ).toThrow(/ostrza/);
    expect(() => loadBlade({ ...plasmaBladeDefinition, combo: [] })).toThrow();
  });
});

describe('combo', () => {
  it('1→2→3 w oknie zadaje 25 / 25 / 40 i emituje etapy', () => {
    const c = setup();
    const m = c.t.melee;
    for (let i = 0; i < 3; i++) {
      tap(c);
      c.step(input(), c.steps(m.lightWindupS + m.lightActiveS) + 1);
    }
    c.step(input(), c.steps(m.lightRecoveryS) + 1);
    expect(c.dealt()).toEqual([25, 25, 40]);
    const stages = c.log
      .filter((e) => e.type === 'melee_swing')
      .map((e) => (e.payload as GameEvents['melee_swing']).stage);
    expect(stages).toEqual([1, 2, 3]);
  });

  it('reset combo poza oknem — kolejny cios znowu jest pierwszym', () => {
    const c = setup();
    const m = c.t.melee;
    tap(c);
    c.step(
      input(),
      c.steps(
        m.lightWindupS + m.lightActiveS + m.lightRecoveryS + m.comboWindowS,
      ) + 3,
    );
    tap(c);
    c.step(input(), c.steps(m.lightWindupS + m.lightActiveS) + 1);
    const stages = c.log
      .filter((e) => e.type === 'melee_swing')
      .map((e) => (e.payload as GameEvents['melee_swing']).stage);
    expect(stages).toEqual([1, 1]);
  });

  it('bufor ataku: klik w trakcie fazy aktywnej wykonuje następny cios po niej', () => {
    const c = setup();
    const m = c.t.melee;
    tap(c);
    c.step(input(), c.steps(m.lightWindupS) + 1); // jesteśmy w fazie aktywnej
    tap(c);
    c.step(
      input(),
      c.steps(m.lightActiveS + m.lightWindupS + m.lightActiveS) + 2,
    );
    expect(c.dealt()).toEqual([25, 25]);
  });

  it('jedno trafienie na cel na cios mimo kilku kroków fazy aktywnej', () => {
    const c = setup();
    tap(c);
    c.step(input(), 30);
    expect(c.dealt()).toEqual([25]);
  });

  it('dwa pierwsze ciosy combo dają mikroodrzut, a trzeci mocny odrzut', () => {
    const c = setup();
    const m = c.t.melee;
    for (let i = 0; i < 3; i++) {
      tap(c);
      c.step(input(), c.steps(m.lightWindupS + m.lightActiveS) + 1);
    }
    const hits = c.log
      .filter((e) => e.type === 'damage_dealt')
      .map((e) => e.payload as GameEvents['damage_dealt']);
    expect(hits.map((h) => h.knockback)).toEqual([1.8, 2.2, 7]);
    expect(hits[2]?.dir).toEqual({ x: 0, y: 0, z: -1 });
  });
});

describe('ciężki atak', () => {
  it('przytrzymanie do naładowania i puszczenie zadaje 80 z tagiem #heavy', () => {
    const c = setup({ inRange: false });
    const m = c.t.melee;
    c.step(input(['attack'], ['attack']));
    c.step(input(['attack']), c.steps(m.heavyChargeS) + 1);
    expect(c.blade.view().state).toBe('charging');
    expect(c.blade.view().charge).toBe(1);
    c.setInRange(true);
    c.step(input([], [], ['attack']));
    c.step(input(), c.steps(m.heavyWindupS + m.heavyActiveS) + 2);
    const heavy = c.log
      .filter((e) => e.type === 'damage_dealt')
      .map((e) => e.payload as GameEvents['damage_dealt']);
    expect(heavy.map((h) => h.amount)).toEqual([80]);
    expect(heavy[0]?.tags).toContain('#heavy');
  });

  it('puszczenie przed naładowaniem anuluje cios', () => {
    const c = setup({ inRange: false });
    const m = c.t.melee;
    c.step(input(['attack'], ['attack']));
    c.step(input(['attack']), c.steps(m.heavyHoldS) + 2);
    expect(c.blade.view().state).toBe('charging');
    c.setInRange(true);
    c.step(input([], [], ['attack']));
    c.step(input(), 40);
    expect(c.dealt()).toEqual([]);
    expect(c.blade.view().state).toBe('idle');
  });
});

describe('hitstop', () => {
  it('40 ms dla lekkiego, 80 ms dla ciężkiego i dla zabójstwa', () => {
    const c = setup();
    tap(c);
    c.step(input(), 20);
    const light = setup({ inRange: false });
    const m = light.t.melee;
    light.step(input(['attack'], ['attack']));
    light.step(input(['attack']), light.steps(m.heavyChargeS) + 1);
    light.setInRange(true);
    light.step(input([], [], ['attack']));
    light.step(input(), 30);
    const kill = setup({ enemyHp: 10 });
    tap(kill);
    kill.step(input(), 20);
    const ms = (ctx: ReturnType<typeof setup>) =>
      ctx.log
        .filter((e) => e.type === 'hitstop')
        .map((e) => (e.payload as GameEvents['hitstop']).ms);
    expect(ms(c)).toEqual([c.t.time.hitstopLightMs]);
    expect(ms(light)).toEqual([light.t.time.hitstopHeavyMs]);
    expect(ms(kill)).toEqual([kill.t.time.hitstopHeavyMs]);
  });
});

describe('blok', () => {
  it('redukuje obrażenia o 70%, zużywa energię i emituje melee_blocked', () => {
    const c = setup();
    c.step(input(['block']));
    expect(c.blade.blocking).toBe(true);
    const dealt = c.damage.deal(c.player, {
      amount: 40,
      source: c.enemy,
      tags: [],
    });
    expect(dealt).toBeCloseTo(12);
    const def = plasmaBladeDefinition;
    expect(c.energy.current).toBeCloseTo(
      100 - (def.blockEnergyPerHit + 40 * def.blockEnergyPerDamage),
    );
    const blocked = c.log.find((e) => e.type === 'melee_blocked')
      ?.payload as GameEvents['melee_blocked'];
    expect(blocked.amount).toBeCloseTo(28);
  });

  it('ciężki cios przebija blok i nie zużywa energii', () => {
    const c = setup();
    c.step(input(['block']));
    expect(
      c.damage.deal(c.player, {
        amount: 40,
        source: c.enemy,
        tags: ['#heavy'],
      }),
    ).toBe(40);
    expect(c.energy.current).toBe(100);
  });

  it('puszczenie bloku zdejmuje redukcję', () => {
    const c = setup();
    c.step(input(['block']));
    c.step(input([], [], ['block']));
    expect(c.blade.blocking).toBe(false);
    expect(
      c.damage.deal(c.player, { amount: 40, source: c.enemy, tags: [] }),
    ).toBe(40);
  });

  it('brak energii rozbija gardę i blokuje blok na guardBreakLockS', () => {
    const c = setup();
    c.energy.set(5);
    c.step(input(['block']));
    c.damage.deal(c.player, { amount: 40, source: c.enemy, tags: [] });
    expect(c.blade.blocking).toBe(false);
    expect(c.energy.current).toBe(0);
    c.step(input(['block']));
    expect(c.blade.blocking).toBe(false);
    c.step(input(['block']), c.steps(c.t.melee.guardBreakLockS) + 1);
    expect(c.blade.blocking).toBe(true);
  });

  it('blockAgeS rośnie w trakcie bloku (okno parowania #10)', () => {
    const c = setup();
    c.step(input(['block']));
    c.step(input(['block']), 6);
    expect(c.blade.view().blockAgeS).toBeCloseTo(6 * SIM_DT);
  });
});
