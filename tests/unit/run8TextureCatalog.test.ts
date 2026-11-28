import { readFileSync, statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { resolveTextureKey } from '../../src/render/comicSurfaces';
import { roomDefinitions } from '../../src/world/rooms';
import bounds from '../../src/data/render/mapModelBounds.json';
import catalog from '../../tools/textures/catalog.json';
import comicCatalog from '../../tools/textures/komiks/catalog.json';

interface ManifestEntry {
  id: string;
  path: string;
  bytes: number;
}

it('wiąże katalogi tekstur elektrowni z manifestami i plikami WebP', () => {
  const regular = catalog.filter((item) => item.set === 'run8');
  const comic = comicCatalog.filter((item) => item.set === 'run8');
  expect(regular).toHaveLength(22);
  expect(comic).toHaveLength(4);

  let totalBytes = 0;
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
      const bytes = statSync(root + path).size;
      totalBytes += bytes;
      expect(manifest.filter((entry) => entry.id === id)).toEqual([
        expect.objectContaining({
          category,
          width,
          height,
          path,
          bytes,
        }),
      ]);
    }
  }

  expect(totalBytes).toBeLessThanOrEqual(1_100_000);

  const surfaces = regular.filter((item) => item.category === 'surfaces');
  expect(
    surfaces.map(({ id }) => resolveTextureKey('surfaces', id, true)).sort(),
  ).toEqual(comic.map(({ id }) => `komiks/surfaces/${id}`).sort());
});

it('każdy wzór bazowy jest używany przez run8 lub nadruk jego modelu', () => {
  const room = roomDefinitions.get('run8')!;
  const used = new Set<string>();
  for (const sign of room.signs ?? []) used.add(`signs/${sign.texture}`);
  for (const decal of room.decals ?? [])
    used.add(`${decal.textureFolder ?? 'decals'}/${decal.texture}`);
  for (const block of room.blocks) used.add(`surfaces/${block.material}`);

  const models = new Set([
    ...room.blocks.map((block) => block.model),
    ...(room.decor ?? []).map((decor) => decor.model),
  ]);
  for (const [model, { materials }] of Object.entries(bounds)) {
    if (!models.has(model)) continue;
    for (const material of materials) {
      if (material.startsWith('mat_screen_'))
        used.add(`screens/${material.slice(4)}`);
      if (material.startsWith('mat_label_'))
        used.add(`labels/${material.slice(4)}`);
    }
  }
  for (const { category, id } of catalog.filter((item) => item.set === 'run8'))
    expect(used.has(`${category}/${id}`), id).toBe(true);
});
