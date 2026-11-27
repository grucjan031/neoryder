import { readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { resolveTextureKey } from '../../src/render/comicSurfaces';
import catalog from '../../tools/textures/catalog.json';
import comicCatalog from '../../tools/textures/komiks/catalog.json';

interface ManifestEntry {
  id: string;
  path: string;
  bytes: number;
}

it('wiąże katalogi tekstur biurowca z manifestami i plikami WebP', () => {
  const regular = catalog.filter((item) => item.set === 'office');
  const comic = comicCatalog.filter((item) => item.set === 'office');
  expect(regular).toHaveLength(24);
  expect(comic).toHaveLength(3);

  for (const [prefix, items] of [
    ['', regular],
    ['komiks/', comic],
  ] as const) {
    const root = `public/assets/textures/${prefix}`;
    const manifest: ManifestEntry[] = JSON.parse(
      readFileSync(`${root}manifest.json`, 'utf8'),
    );
    for (const { id, category, width, height } of items) {
      const path = `${category}/${id}.webp`;
      expect(manifest.filter((entry) => entry.id === id)).toEqual([
        expect.objectContaining({
          category,
          width,
          height,
          path,
          bytes: statSync(root + path).size,
        }),
      ]);
    }
  }

  const surfaces = regular.filter((item) => item.category === 'surfaces');
  expect(
    surfaces.map(({ id }) => resolveTextureKey('surfaces', id, true)).sort(),
  ).toEqual(comic.map(({ id }) => `komiks/surfaces/${id}`).sort());
});
