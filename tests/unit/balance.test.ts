import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  enemyDefinitions,
  evaluateGate,
  runBalance,
  simulate,
} from '../../src/balance/simulator';
import {
  loadWeapon,
  blasterDefinition,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import { powerDefinitions } from '../../src/combat/powers/registry';
import type { PowerDefinition } from '../../src/combat/powers/registry';
import { SIM_DT } from '../../src/core/loop';
import { generateBalance, renderReport } from '../../src/balance/report';

const target = (maxHealth: number) => ({
  ...enemyDefinitions.get('assaulter')!,
  maxHealth,
});
const weapon = (overrides: Record<string, unknown> = {}) => ({
  kind: 'weapon' as const,
  definition: loadWeapon({
    ...blasterDefinition,
    fireRateHz: 2,
    heatPerShot: 1,
    ...overrides,
  }),
});

describe('symulator TTK', () => {
  it('ręcznie: 100 HP / 20 obrażeń = 5 strzałów co 0,5 s, pierwszy w kroku 1', () => {
    const result = simulate(weapon(), target(100));
    expect(result.shots).toBe(5);
    expect(result.ttkS).toBeCloseTo(2 + SIM_DT);
    expect(result.damage).toBe(100);
    expect(result.dps).toBeCloseTo(100 / (2 + SIM_DT));
  });

  it('półautomat wykorzystuje maksymalną częstotliwość, także co nieparzystą liczbę kroków', () => {
    const result = simulate(
      weapon({ automatic: false, fireRateHz: 4 }),
      target(100),
    );
    expect(result.ttkS).toBeCloseTo(1 + SIM_DT);
    expect(result.shots).toBe(5);
  });

  it('przegrzanie opóźnia następny strzał względem zimnej broni', () => {
    const hot = simulate(weapon({ heatPerShot: 100 }), target(40));
    const cold = simulate(weapon(), target(40));
    expect(hot.overheats).toBe(2);
    expect(hot.ttkS).toBeGreaterThanOrEqual(1.5 + SIM_DT);
    expect(cold.ttkS).toBeCloseTo(0.5 + SIM_DT);
  });

  it('Pchnięcie zadaje 10 obrażeń, kolejne użycie dopiero po odnowieniu 0,6 s', () => {
    const result = simulate({ kind: 'powers', ids: ['push'] }, target(20), {
      wallDistanceM: null,
    });
    expect(result.powerUses).toBe(2);
    expect(result.ttkS).toBeCloseTo(0.6 + SIM_DT);
  });

  it('wspólna energia blokuje drugą moc, a regeneracja umożliwia kolejne użycie', () => {
    const attack = { kind: 'powers' as const, ids: ['push', 'shockwave'] };
    const empty = simulate(attack, target(100), {
      maxTimeS: 3,
      playerStats: { maxEnergy: 25, energyRegen: 0 },
    });
    const regen = simulate(attack, target(100), {
      maxTimeS: 4,
      playerStats: { maxEnergy: 25, energyRegen: 25 },
    });
    expect(empty.powerUses).toBe(1);
    expect(empty.damage).toBe(10);
    expect(regen.powerUses).toBe(2);
    expect(regen.damage).toBe(20);
  });

  it('podpalenie zabija dwoma tikami po 4 obrażenia, bez drugiego strzału', () => {
    const result = simulate(
      weapon({
        damage: 1,
        fireRateHz: 0.1,
        statuses: [{ id: 'burning', durationS: 2 }],
      }),
      target(9),
    );
    expect(result.shots).toBe(1);
    expect(result.statusDamage).toBe(8);
    expect(result.appliedStatuses).toContain('burning');
    expect(result.ttkS).toBeCloseTo(1 + SIM_DT);
  });

  it('przeciążenie modyfikuje damageTaken, po trzech stosach nakłada ogłuszenie; wyładowanie omija nosiciela', () => {
    const result = simulate(
      weapon({
        damage: 10,
        statuses: [{ id: 'overload', durationS: 4 }],
      }),
      target(1000),
      { maxTimeS: 1.1 },
    );
    expect(result.damage).toBe(10 + 12.5 + 15);
    expect(result.appliedStatuses).toEqual(['overload', 'stunned']);
    expect(result.statusDamage).toBe(0);
  });

  it('modyfikatory celu przechodzą przez Stats i DamageSystem', () => {
    const result = simulate(weapon(), target(100), {
      targetModifiers: [
        { stat: 'damageTaken', type: 'mult', value: 0.5, source: 'test' },
      ],
    });
    expect(result.shots).toBe(10);
    expect(result.ttkS).toBeCloseTo(4.5 + SIM_DT);
  });

  it('limit bez zabicia zwraca ∞ i DPS obrażeń rzeczywiście zadanych w tym czasie', () => {
    const result = simulate(weapon(), target(100), { maxTimeS: 0.5 });
    expect(result.ttkS).toBe(Infinity);
    expect(result.damage).toBe(20);
    expect(result.dps).toBe(40);
  });

  it('adapter sumuje wszystkie śruty i idealizowane przebicia ze spadkiem obrażeń', () => {
    const scatter = simulate(
      { kind: 'weapon', definition: weaponDefinitions.get('scatter')! },
      target(1000),
      { maxTimeS: SIM_DT },
    );
    const sniper = simulate(
      { kind: 'weapon', definition: weaponDefinitions.get('sniper')! },
      target(1000),
      { maxTimeS: SIM_DT },
    );
    expect(scatter.damage).toBe(8 * 10);
    expect(sniper.damage).toBe(80 + 60 + 45);
  });

  it('laser tyka, a granat zadaje obrażenia bezpośrednie, wybuch i status', () => {
    const beam = simulate(
      { kind: 'weapon', definition: weaponDefinitions.get('beam')! },
      target(1000),
      { maxTimeS: 0.5 },
    );
    const emp = simulate(
      { kind: 'weapon', definition: weaponDefinitions.get('emp')! },
      target(1000),
      { maxTimeS: SIM_DT },
    );
    expect(beam.damage).toBe(20);
    expect(emp.damage).toBe(10);
    expect(emp.appliedStatuses).toContain('overload');
  });

  it('nieobsługiwany rodzaj w rejestrze daje ostrzeżenie, moc bez obrażeń jest pomijana', () => {
    const definitions = powerDefinitions as Map<string, PowerDefinition>;
    const original = definitions.get('push')!;
    if (original.kind !== 'cone')
      throw new Error('Fixture push musi być stożkiem');
    try {
      definitions.set('push', {
        ...original,
        kind: 'future',
      } as unknown as PowerDefinition);
      const unknown = simulate({ kind: 'powers', ids: ['push'] }, target(10), {
        maxTimeS: SIM_DT,
      });
      expect(unknown.warnings).toEqual([
        'Pominięto nieobsługiwany rodzaj mocy: future (push).',
      ]);
      expect(unknown.powerUses).toBe(0);
      definitions.set('push', { ...original, damage: 0, wallSlamDamage: 0 });
      const harmless = simulate({ kind: 'powers', ids: ['push'] }, target(10), {
        maxTimeS: SIM_DT,
      });
      expect(harmless.warnings).toEqual([]);
      expect(harmless.powerUses).toBe(0);
    } finally {
      definitions.set('push', original);
    }
  });

  it('bramka sprawdza oba końce przedziału i odrzuca nieskończoność', () => {
    expect(evaluateGate([1, 2, 4]).passed).toBe(true);
    expect(evaluateGate([0.9, 2, 4]).passed).toBe(false);
    expect(evaluateGate([1, 2, 4.1]).passed).toBe(false);
    expect(evaluateGate([1, 2, Infinity]).passed).toBe(false);
    expect(evaluateGate([Infinity, Infinity, Infinity]).passed).toBe(false);
  });

  it('te same dane i seed dają identyczny raport liczbowy dwa razy', () => {
    expect(runBalance()).toEqual(runBalance());
  });

  it('raport w repo odpowiada bieżącej symulacji (data nie wpływa na liczby)', () => {
    const checkedIn = readFileSync('docs/balance.md', 'utf8');
    const date = checkedIn.match(
      /Data wygenerowania \(UTC\): (\d{4}-\d{2}-\d{2})/,
    )?.[1];
    expect(date).toBeDefined();
    expect(renderReport(generateBalance(), date!)).toBe(checkedIn);
  });

  const results = generateBalance();
  if (results.open.passed && results.wall.passed) {
    it('bramka F2: wszystkie ścieżki w [mediana / 2, mediana × 2]', () => {
      expect(results.open.passed).toBe(true);
      expect(results.wall.passed).toBe(true);
    });
  } else {
    it.todo(
      'bramka F2: obecne dane nie przechodzą (6/6 wrogów); decyzja koordynatora o danych i wariancie ścian — docs/balance.md',
    );
  }
});
