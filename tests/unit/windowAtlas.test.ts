import { describe, expect, it } from 'vitest';
import {
  windowCellUv,
  windowChoice,
  WINDOW_ATLAS_GRID,
} from '../../src/render/city/windowAtlas';
import { tuning } from '../../src/core/tuning';

const c = tuning.city;
const params = {
  litFraction: c.windowLitFraction,
  minWidthM: c.windowMinWidthM,
  maxWidthM: c.windowMaxWidthM,
  minHeightM: c.windowMinHeightM,
  maxHeightM: c.windowMaxHeightM,
};

describe('okna fasad z atlasu', () => {
  it('wybór jest deterministyczny i mieści się w siatce 4x4', () => {
    for (let x = -20; x < 20; x++)
      for (let y = -10; y < 10; y++) {
        const a = windowChoice(x, y, params);
        expect(windowChoice(x, y, params)).toEqual(a);
        expect(a.column).toBeGreaterThanOrEqual(0);
        expect(a.column).toBeLessThan(WINDOW_ATLAS_GRID);
        expect(a.row).toBeGreaterThanOrEqual(0);
        expect(a.row).toBeLessThan(WINDOW_ATLAS_GRID);
      }
  });

  it('udział oświetlonych okien jest bliski ustawieniu (35-45%)', () => {
    let lit = 0;
    const total = 100 * 50;
    for (let x = 0; x < 100; x++)
      for (let y = 0; y < 50; y++) if (windowChoice(x, y, params).lit) lit++;
    expect(lit / total).toBeGreaterThan(0.35);
    expect(lit / total).toBeLessThan(0.45);
  });

  it('proporcje okien są pionowe i w zakresie realnych okien', () => {
    expect(c.windowMaxWidthM).toBeLessThanOrEqual(1.6);
    for (let x = 0; x < 60; x++)
      for (let y = 0; y < 30; y++) {
        const w = windowChoice(x, y, params);
        expect(w.widthM).toBeGreaterThanOrEqual(1.2);
        expect(w.widthM).toBeLessThanOrEqual(1.6);
        expect(w.heightM).toBeGreaterThanOrEqual(1.6);
        expect(w.heightM).toBeLessThanOrEqual(2.2);
        expect(w.heightM).toBeGreaterThan(w.widthM);
      }
    expect(c.windowPitchXM).toBeGreaterThan(c.windowMaxWidthM);
    expect(c.windowPitchYM).toBeGreaterThan(c.windowMaxHeightM);
  });

  it('wykorzystuje wszystkie komórki atlasu i liczy ich UV', () => {
    const used = new Set<number>();
    for (let x = 0; x < 60; x++)
      for (let y = 0; y < 30; y++) {
        const w = windowChoice(x, y, params);
        used.add(w.row * WINDOW_ATLAS_GRID + w.column);
      }
    expect(used.size).toBe(16);
    expect(windowCellUv(1, 2)).toEqual([0.25, 0.5, 0.5, 0.75]);
  });

  it('emisja ciemnych okien jest znacznie słabsza od oświetlonych', () => {
    expect(c.windowDarkEmission).toBeLessThan(c.windowLitEmission * 0.1);
  });
});
