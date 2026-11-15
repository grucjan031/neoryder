import { describe, expect, it } from 'vitest';
import {
  TYPICAL_RUNS,
  simulateTypicalRuns,
  threatRewardTable,
  typicalSummary,
} from '../../src/balance/metaSim';

// Bramka F4 (docs/issues/F4/README.md, zadanie 11): 5 typowych runów nowego gracza
// na Poziomie zagrożenia 0: śmierć w warstwie 3, śmierć w warstwie 5, zwycięstwo,
// śmierć w warstwie 6, zwycięstwo. Model runu opisuje src/balance/metaSim.ts.
describe('balans meta (F4-11)', () => {
  const sim = simulateTypicalRuns();

  it('model runu: pokoje, elity, zabójstwa i czas wynikają ze stałej ścieżki sektora', () => {
    const row = (i: number) => {
      const s = typicalSummary(TYPICAL_RUNS[i]!);
      return [s.roomsCleared, s.elitesCleared, s.kills, s.elapsedS];
    };
    expect(row(0)).toEqual([2, 0, 12, 300]);
    expect(row(1)).toEqual([4, 1, 28, 660]);
    expect(row(2)).toEqual([8, 2, 43, 1275]);
    expect(row(3)).toEqual([5, 1, 28, 720]);
  });

  it('po 5 runach poziom 5–8', () => {
    expect(sim.finalLevel).toBeGreaterThanOrEqual(5);
    expect(sim.finalLevel).toBeLessThanOrEqual(8);
  });

  it('po 5 runach 2–4 zakupy w warsztacie (Dane i Rdzenie)', () => {
    expect(sim.purchases).toBeGreaterThanOrEqual(2);
    expect(sim.purchases).toBeLessThanOrEqual(4);
  });

  it('pierwszy run (śmierć w warstwie 3) daje co najmniej 1 poziom, żaden run więcej niż 3', () => {
    expect(sim.levelsPerRun[0]).toBeGreaterThanOrEqual(1);
    for (const gained of sim.levelsPerRun)
      expect(gained).toBeLessThanOrEqual(3);
  });

  it('symulacja jest deterministyczna', () => {
    expect(simulateTypicalRuns()).toEqual(sim);
  });

  it('nagrody rosną z Poziomem zagrożenia, a zwycięstwo daje więcej niż śmierć', () => {
    const table = threatRewardTable();
    expect(table.map((row) => row.level)).toEqual([0, 1, 2, 3]);
    table.forEach((row, i) => {
      expect(row.victory.xp).toBeGreaterThan(row.deathLayer5.xp);
      expect(row.victory.cores).toBeGreaterThan(row.deathLayer5.cores);
      if (i > 0) {
        const prev = table[i - 1]!;
        expect(row.victory.data).toBeGreaterThan(prev.victory.data);
        expect(row.deathLayer5.xp).toBeGreaterThan(prev.deathLayer5.xp);
      }
    });
  });
});
