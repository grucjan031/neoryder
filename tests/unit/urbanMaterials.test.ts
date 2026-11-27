import { expect, it } from 'vitest';
import portData from '../../src/data/render/portMaterials.json';
import arenaData from '../../src/data/render/arenaMaterials.json';
import portRailData from '../../src/data/render/portRailMaterials.json';
import overpassData from '../../src/data/render/overpassMaterials.json';
import {
  createUrbanMaterial,
  mergeUrbanMaterialData,
  urbanLooks,
} from '../../src/render/urbanMaterials';
import { resolveTextureKey } from '../../src/render/comicSurfaces';
import { blockMaterialSchema } from '../../src/world/dressingSchema';

it('dane materiałów ładują się bez duplikatów i zachowują wygląd z overpassMaterials.json', () => {
  const sources = {
    'portMaterials.json': portData,
    'arenaMaterials.json': arenaData,
    'portRailMaterials.json': portRailData,
    'overpassMaterials.json': overpassData,
  };
  const keys = Object.values(sources).flatMap((data) => Object.keys(data));
  expect(new Set(keys).size).toBe(keys.length);
  expect(mergeUrbanMaterialData(sources)).toEqual({
    ...portData,
    ...arenaData,
    ...portRailData,
    ...overpassData,
  });
  for (const key of ['hazard_stripes_worn', 'scaffold_planks'] as const)
    expect(urbanLooks[key]).toEqual(overpassData[key]);
});

it.each(['targ_wet_pavers', 'targ_wood_planks', 'targ_fish_tiles'] as const)(
  '%s: ma parametry targu i wariant komiksowy, a schemat mapy przyjmuje jego identyfikator',
  (id) => {
    expect(blockMaterialSchema.parse(id)).toBe(id);
    const look = arenaData[id];
    expect(urbanLooks[id]).toEqual(look);
    expect(look.texture).toBe(id);
    expect(resolveTextureKey('surfaces', id, true)).toBe(
      `komiks/surfaces/komiks_${id}`,
    );
    expect(resolveTextureKey('surfaces', id, false)).toBe(`surfaces/${id}`);
    const material = createUrbanMaterial(id);
    try {
      expect(material.roughness).toBe(look.roughness);
      expect(material.metalness).toBe(look.metalness);
      expect(material.userData.wetness).toBe(look.wetness);
    } finally {
      material.dispose();
    }
  },
);

it.each(['hazard_stripes_worn', 'scaffold_planks'])(
  'scalanie odrzuca duplikat %s z nazwami obu plików',
  (key) => {
    expect(() =>
      mergeUrbanMaterialData({
        'arenaMaterials.json': { [key]: { scale: 1 } },
        'overpassMaterials.json': { [key]: { scale: 2 } },
      }),
    ).toThrow(
      `Powtórzony materiał ${key}: arenaMaterials.json i overpassMaterials.json.`,
    );
  },
);
