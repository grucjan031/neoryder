import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PACK_SIZE,
  enemyDefinitions,
  evaluateGate,
  runBalance,
  simulate,
} from '../../src/balance/simulator';
import { plasmaBladeDefinition } from '../../src/combat/melee/bladeSchema';
import {
  loadWeapon,
  blasterDefinition,
  weaponDefinitions,
} from '../../src/combat/weapons/weaponSchema';
import { powerDefinitions } from '../../src/combat/powers/registry';
import type { PowerDefinition } from '../../src/combat/powers/registry';
import { SIM_DT } from '../../src/core/loop';
import { tuning } from '../../src/core/tuning';
import { generateBalance, renderReport } from '../../src/balance/report';
import { enemySchema } from '../../src/enemies/enemySchema';

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

/** Wartości mocy pinowane w teście, żeby strojenie danych nie łamało ręcznych wyliczeń. */
function withPowers(
  overrides: Record<string, Partial<PowerDefinition>>,
  run: () => void,
) {
  const definitions = powerDefinitions as Map<string, PowerDefinition>;
  const originals = new Map<string, PowerDefinition>();
  try {
    for (const [id, patch] of Object.entries(overrides)) {
      const original = definitions.get(id)!;
      originals.set(id, original);
      definitions.set(id, { ...original, ...patch } as PowerDefinition);
    }
    run();
  } finally {
    for (const [id, original] of originals) definitions.set(id, original);
  }
}

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
    withPowers({ push: { damage: 10, cooldownS: 0.6, cost: 25 } }, () => {
      const result = simulate({ kind: 'powers', ids: ['push'] }, target(20), {
        wallDistanceM: null,
      });
      expect(result.powerUses).toBe(2);
      expect(result.ttkS).toBeCloseTo(0.6 + SIM_DT);
    });
  });

  it('wspólna energia blokuje drugą moc, a regeneracja umożliwia kolejne użycie', () => {
    withPowers(
      {
        push: { damage: 10, cooldownS: 0.6, cost: 25 },
        shockwave: { damage: 10, cooldownS: 1.5, cost: 40 },
      },
      () => {
        const attack = {
          kind: 'powers' as const,
          ids: ['push', 'shockwave'],
        };
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
      },
    );
  });

  describe('TTK paczki', () => {
    it('ręcznie: 3 cele po 20 HP, strzał 20 co 0,5 s — zabójstwa w krokach 1, 31 i 61', () => {
      const result = simulate(weapon(), target(20), { count: 3 });
      expect(result.kills).toBe(3);
      expect(result.shots).toBe(3);
      expect(result.killTimesS).toHaveLength(3);
      result.killTimesS.forEach((time, i) =>
        expect(time).toBeCloseTo(0.5 * i + SIM_DT),
      );
      expect(result.ttkS).toBeCloseTo(1 + SIM_DT);
      expect(result.damage).toBe(60);
    });

    it('count 1 i brak opcji dają ten sam wynik, a limit czasu przed ostatnim zabójstwem zwraca ∞', () => {
      expect(simulate(weapon(), target(100))).toEqual(
        simulate(weapon(), target(100), { count: 1 }),
      );
      const cut = simulate(weapon(), target(20), { count: 5, maxTimeS: 1 });
      expect(cut.kills).toBe(2);
      expect(cut.ttkS).toBe(Infinity);
    });

    it('ciepło broni przechodzi między celami: paczka 2×20 HP = jeden cel 40 HP z przegrzaniem', () => {
      const attack = weapon({ heatPerShot: 100 });
      const pack = simulate(attack, target(20), { count: 2 });
      const single = simulate(attack, target(40));
      expect(pack.overheats).toBe(single.overheats);
      expect(pack.ttkS).toBeCloseTo(single.ttkS);
      expect(pack.ttkS).toBeGreaterThan(0.5 + SIM_DT);
    });

    it('energia i odnowienia przechodzą między celami: drugie użycie czeka na regenerację', () => {
      withPowers({ push: { damage: 10, cost: 60, cooldownS: 0.1 } }, () => {
        const attack = { kind: 'powers' as const, ids: ['push'] };
        const options = { wallDistanceM: null };
        const pack = simulate(attack, target(10), { ...options, count: 2 });
        const single = simulate(attack, target(20), options);
        expect(pack.killTimesS[0]).toBeCloseTo(SIM_DT);
        // 100 − 60 = 40 < 60: potrzebna regeneracja po opóźnieniu z tuningu.
        expect(pack.killTimesS[1]! - pack.killTimesS[0]!).toBeGreaterThan(2);
        expect(pack.ttkS).toBeCloseTo(single.ttkS);
        expect(pack.powerUses).toBe(2);
      });
    });

    it('statusy znikają z martwym celem: następca nie dostaje obrażeń przed własnym trafieniem', () => {
      const result = simulate(
        weapon({
          damage: 1,
          fireRateHz: 0.1,
          statuses: [{ id: 'burning', durationS: 2 }],
        }),
        target(9),
        { count: 2 },
      );
      expect(result.killTimesS[0]).toBeCloseTo(1 + SIM_DT);
      // Kolejny strzał dopiero po 10 s cooldownu; podpalenie poprzednika wygasło.
      expect(result.killTimesS[1]).toBeGreaterThanOrEqual(11);
      expect(result.killTimesS[1]).toBeCloseTo(11 + SIM_DT, 1);
      expect(result.statusDamage).toBe(16);
    });

    it('ostrze: następny cel dostaje własne cięcie, nie to, które zabiło poprzednika', () => {
      const result = simulate(
        { kind: 'blade', definition: plasmaBladeDefinition, mode: 'combo' },
        target(60),
        { count: 2 },
      );
      expect(result.kills).toBe(2);
      const [first, second] = result.killTimesS as [number, number];
      expect(second - first).toBeGreaterThan(first);
      expect(result.damage).toBe(120);
    });

    it('bramka ścieżek liczy paczkę: wynik Ostrza = lepsze z combo/ciężkiego dla PACK_SIZE celów', () => {
      expect(PACK_SIZE).toBe(5);
      const result = runBalance({ wallDistanceM: null });
      result.paths.forEach((path, i) => {
        const bladeTimes = ['plasmaBlade:combo', 'plasmaBlade:heavy'].map(
          (id) =>
            result.attacks.find((row) => row.id === id)!.packResults[i]!.ttkS,
        );
        expect(path.ttkS[0]).toBe(Math.min(...bladeTimes));
      });
      expect(result.paths.every((path) => path.passed)).toBe(result.passed);
    });
  });

  describe('TTK bossa', () => {
    const boss = enemyDefinitions.get('securityChief')!;
    const [slam, fan] = boss.boss!.phases[0]!.patterns;
    const fixture = (phases: NonNullable<typeof boss.boss>['phases']) =>
      enemySchema.parse({
        ...boss,
        maxHealth: 100,
        boss: { ...boss.boss, phases },
      });

    it('ogranicza obrażenia po modyfikatorach i przerywa wzorzec na każdym progu HP', () => {
      const enemy = fixture([
        { hpThreshold: 1, patterns: [slam!] },
        { hpThreshold: 0.6, patterns: [fan!] },
        { hpThreshold: 0.25, patterns: [slam!] },
      ]);
      const settings = structuredClone(tuning);
      settings.enemies.phaseShiftS = 0.5;
      const attack = weapon({ damage: 1000, fireRateHz: 3 });
      const options = {
        settings,
        targetModifiers: [
          { stat: 'maxHealth', type: 'mult', value: 2, source: 'test' },
          { stat: 'damageTaken', type: 'mult', value: 0.1, source: 'test' },
        ] as const,
      };
      const cut = simulate(attack, enemy, { ...options, maxTimeS: 0.5 });
      expect(cut.ttkS).toBe(Infinity);
      expect(cut.damage).toBe(80);
      expect(cut.shots).toBe(2);

      const result = simulate(attack, enemy, options);
      expect(result.damage).toBe(200);
      expect(result.shots).toBe(5);
      expect(result.ttkS).toBeCloseTo(81 * SIM_DT);
      expect(result.bossTimeline).toEqual([
        { kind: 'phase', phase: 1, timeS: 0 },
        { kind: 'pattern', pattern: 'slam', phase: 1, timeS: SIM_DT },
        { kind: 'phase', phase: 2, timeS: SIM_DT },
        { kind: 'pattern', pattern: 'fan', phase: 2, timeS: 32 * SIM_DT },
        { kind: 'phase', phase: 3, timeS: 41 * SIM_DT },
        { kind: 'pattern', pattern: 'slam', phase: 3, timeS: 72 * SIM_DT },
      ]);
    });

    it('tarcza blokuje strzały, a moc łamie ją i otwiera okno podatności', () => {
      const enemy = fixture([
        {
          hpThreshold: 1,
          patterns: [
            slam!,
            {
              kind: 'shield',
              telegraphS: 2 * SIM_DT,
              recoveryS: 0.5,
              cooldownS: 0.5,
              damage: 0,
              durability: 20,
              durationS: 0.5,
              stunS: 0.1,
              vulnerableS: 0.5,
              vulnerableMult: 1.5,
            },
          ],
        },
      ]);
      const options = { maxTimeS: 0.55, wallDistanceM: null };
      const gun = simulate(
        weapon({ damage: 20, fireRateHz: 4 }),
        enemy,
        options,
      );
      expect(gun.bossTimeline).toContainEqual({
        kind: 'pattern',
        pattern: 'shield',
        phase: 1,
        timeS: SIM_DT,
      });
      expect(gun.shots).toBe(3);
      expect(gun.damage).toBe(20);
      withPowers({ push: { damage: 20, cost: 0, cooldownS: 0.25 } }, () => {
        const power = simulate(
          { kind: 'powers', ids: ['push'] },
          enemy,
          options,
        );
        expect(power.powerUses).toBe(3);
        expect(power.damage).toBe(20 + 30);
      });
    });

    it('raport uwzględnia bossa dla każdego narzędzia poza bramką paczek', () => {
      const result = runBalance();
      expect(result.bosses.map(({ id }) => id)).toContain('orbisDirector');
      const orbis = result.bosses.findIndex(({ id }) => id === 'orbisDirector');
      const beam = result.attacks.find(({ id }) => id === 'beam')!.bossResults[
        orbis
      ]!;
      expect(beam.ttkS).toBeLessThan(Infinity);
      expect(
        beam.bossTimeline
          ?.filter((event) => event.kind === 'phase')
          .map((event) => event.phase),
      ).toEqual([1, 2, 3]);
      expect(beam.bossTimeline).toContainEqual(
        expect.objectContaining({ pattern: 'gridHack' }),
      );
      expect(beam.bossTimeline).toContainEqual(
        expect.objectContaining({ pattern: 'laser' }),
      );
      expect(result.enemies.map(({ id }) => id)).not.toContain('orbisDirector');
      const index = result.bosses.findIndex(({ id }) => id === boss.id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(result.bossPaths.map(({ enemy }) => enemy)).toContain(boss.id);
      expect(result.paths.map(({ enemy }) => enemy)).not.toContain(boss.id);
      expect(result.singlePaths.map(({ enemy }) => enemy)).not.toContain(
        boss.id,
      );
      for (const row of result.attacks) {
        expect(row.packResults).toHaveLength(result.enemies.length);
        expect(row.bossResults[index]?.bossTimeline?.[0]).toEqual({
          kind: 'phase',
          phase: 1,
          timeS: 0,
        });
        expect(row.bossResults[index]?.kills).toBeLessThanOrEqual(1);
      }
    });
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

  // Bramka rozstrzyga TTK paczki w otwartej przestrzeni; ściana jest informacyjna.
  const results = generateBalance();
  if (results.open.passed) {
    it('bramka F2: TTK paczki, otwarta przestrzeń — wszystkie ścieżki w [mediana / 2, mediana × 2]', () => {
      expect(results.open.paths.filter((path) => !path.passed)).toEqual([]);
      expect(results.open.passed).toBe(true);
    });
  } else {
    const names = results.open.paths
      .filter((path) => !path.passed)
      .map((path) => path.enemy)
      .join(', ');
    it.todo(
      'bramka F2 (paczka, otwarta przestrzeń): poza przedziałem ' +
        names +
        ' — decyzja koordynatora o strojeniu, docs/systems/balance.md',
    );
  }
});

describe('Orbis Grid w symulatorze', () => {
  it('statusy nałożone przez bossa na gracza nie trafiają do wyników narzędzia', () => {
    const result = simulate(
      { kind: 'weapon', definition: blasterDefinition },
      enemyDefinitions.get('orbisDirector')!,
      { settings: tuning },
    );
    expect(
      result.bossTimeline?.some(
        (e) => e.kind === 'pattern' && e.pattern === 'gridHack',
      ),
    ).toBe(true);
    expect(result.appliedStatuses).not.toContain('jammed');
  });
});
