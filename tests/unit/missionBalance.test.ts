import { describe, expect, it } from 'vitest';
import {
  analyzeAct,
  lowReserve,
  measureWave,
  renderMissionReport,
  severity,
  trend,
} from '../../src/balance/missionBalance';
import { runBalance } from '../../src/balance/simulator';
import { levelDefinitions, levelWaves } from '../../src/world/levels';
import { missionCatalog } from '../../src/world/missionCatalog';

const balance = runBalance();
const act = analyzeAct(balance);

describe('raport balansu misji', () => {
  it('odwzorowuje każde spotkanie poziomu raz, w kolejności sekcji', () => {
    expect(act.map((m) => m.id.slice(0, 3))).toEqual([
      'm01',
      'm02',
      'm03',
      'm04',
      'm05',
      'm06',
    ]);
    for (const mission of act) {
      const definition = missionCatalog.get(mission.id)!;
      const level = levelDefinitions.get(definition.level!)!;
      expect(mission.rows.length).toBeGreaterThan(0);
      expect(mission.rows.map((r) => r.id).sort()).toEqual(
        level.encounters.map((e) => e.id).sort(),
      );
      const sections = mission.rows.map((r) => r.section);
      expect(sections).toEqual([...sections].sort((a, b) => a - b));
      expect(mission.escorts.map((e) => e.id)).toEqual(
        definition.objectives
          .filter((o) => o.kind === 'escortPayload')
          .map((o) => o.id),
      );
      for (const row of mission.rows) {
        expect(row.times).toHaveLength(3);
        expect(row.pressure).toHaveLength(3);
        for (const value of [...row.times, ...row.pressure])
          expect(value > 0 && Number.isFinite(value)).toBe(true);
      }
    }
    expect(
      act[2]!.rows
        .filter((r) => r.trigger.includes('terminal:'))
        .map((r) => r.trigger),
    ).toEqual([
      'terminal:0 przy 25%',
      'terminal:1 przy 55%',
      'terminal:2 przy 85%',
    ]);
    expect(act[3]!.escorts[0]).toMatchObject({
      length: 228,
      health: 400,
      targetedDps: 0,
      reserve: 100,
    });
    expect(
      act[0]!.rows
        .filter((r) => r.trigger.startsWith('wybuch '))
        .map((r) => r.id),
    ).toEqual(['reinforce-mast-1', 'reinforce-mast-2', 'reinforce-mast-3']);
  });

  it('rozlicza osobno tury, HP, limit żywych i czas ekspozycji', () => {
    const base = levelWaves.get('missionPatrol')!;
    const turn = { spawnIntervalS: 1, groups: [{ enemy: 'gunner', count: 2 }] };
    const wave = { ...base, maxAlive: 3, waves: [turn, turn] };
    const row = measureWave(wave, 1, balance);
    const one = measureWave({ ...wave, waves: [turn] }, 2, balance);
    expect(row.peak).toBe(1);
    expect(one.peak).toBe(2);
    expect(row.health).toBe(180);
    expect(row.composition).toEqual(['gunner ×2', 'gunner ×2']);
    expect(row.peakDps).toBeCloseTo((0.35 * 36) / (0.5 + 0.44 + 1.6));
    const single = balance.singlePaths.find((r) => r.enemy === 'gunner')!.ttkS;
    const pack = balance.paths.find((r) => r.enemy === 'gunner')!.ttkS;
    row.times.forEach((s, i) => {
      expect(one.times[i]).toBeCloseTo(
        3 + single[i]! + (pack[i]! - single[i]!) / 4,
      );
      expect(s).toBeCloseTo(2 * one.times[i]!);
      expect(row.pressure[i]).toBeCloseTo(row.peakDps * s);
    });
  });

  it('stosuje ostre progi przed zaokrągleniem', () => {
    expect([60, 60.001, 100, 100.001].map(severity)).toEqual([
      '—',
      'ciężkie',
      'ciężkie',
      'zabójcze',
    ]);
    expect([24.99, 25].map(lowReserve)).toEqual([true, false]);
    expect([9, 10, 20, 20.001].map((n) => trend(10, n))).toEqual([
      'spadek',
      '',
      '',
      'skok',
    ]);
  });

  it('dwa niezależne przebiegi generują identyczny tekst', () => {
    expect(renderMissionReport(analyzeAct(), '2026-11-24')).toBe(
      renderMissionReport(act, '2026-11-24'),
    );
  });
});
