import { describe, expect, it } from 'vitest';
import { isCityModelFile } from '../../src/render/cityModels';
import {
  createUrbanMaterial,
  mallKinds,
  urbanKinds,
} from '../../src/render/urbanMaterials';
import { weatherDefinitions } from '../../src/render/weatherSchema';
import { blockMaterialSchema } from '../../src/world/dressingSchema';

describe('fundamenty galerii (run2, etap A)', () => {
  it('glass_clear jest przezroczysty bez zapisu głębi, reszta materiałów nie', () => {
    const glass = createUrbanMaterial('glass_clear');
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBeCloseTo(0.22);
    expect(glass.depthWrite).toBe(false);
    for (const kind of ['glass', 'mall_stone_floor'] as const) {
      const solid = createUrbanMaterial(kind);
      expect(solid.transparent).toBe(false);
      expect(solid.opacity).toBe(1);
    }
  });

  it('materiały galerii są znane rejestrowi i schematowi bloków', () => {
    for (const kind of mallKinds) {
      expect(urbanKinds).toContain(kind);
      expect(blockMaterialSchema.safeParse(kind).success).toBe(true);
    }
  });

  it('prefiks mall_ ładuje modele miasta', () => {
    expect(isCityModelFile('mall_entrance_doors')).toBe(true);
    expect(isCityModelFile('mallard')).toBe(false);
  });

  it('profil mallAfterHours ma deszcz i jaśniejsze światło niż 2,1', () => {
    const profile = weatherDefinitions.get('mallAfterHours')!;
    expect(profile.precipitation.kind).toBe('rain');
    expect(profile.lighting?.hemiIntensity).toBeGreaterThan(2.1);
  });
});
