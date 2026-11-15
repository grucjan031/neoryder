import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import { HUB_STATION_IDS } from '../../src/core/metaTypes';
import { themeDefinitions } from '../../src/render/themes';
import { loadHubLayout } from '../../src/world/hubSchema';

const layout = loadHubLayout(hideoutData);
const publicFile = (path: string): string =>
  resolve(__dirname, '../../public/assets', path);
const issues = (data: unknown): { path: string; message: string }[] => {
  try {
    loadHubLayout(data);
  } catch (error) {
    const zodIssues = (
      error as { issues: { path: PropertyKey[]; message: string }[] }
    ).issues;
    return zodIssues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }
  return [];
};
type Data = typeof hideoutData;
const mutate = (change: (copy: Data) => void): unknown => {
  const copy = structuredClone(hideoutData);
  change(copy);
  return copy;
};
const paths = (data: unknown): string[] =>
  issues(data).map((issue) => issue.path);

it('kryjówka ma po jednej stacji każdego rodzaju, a spawn leży na poziomie 0', () => {
  expect(layout.stations.map((station) => station.id).sort()).toEqual(
    [...HUB_STATION_IDS].sort(),
  );
  expect(layout.playerSpawn.y).toBe(0);
});

it('układ to peron 36–44 m × 12–16 m z sufitem i niecką torów', () => {
  const floors = layout.blocks.filter(
    (block) => block.position.y + block.size.y / 2 === 0,
  );
  const minX = Math.min(...floors.map((b) => b.position.x - b.size.x / 2));
  const maxX = Math.max(...floors.map((b) => b.position.x + b.size.x / 2));
  expect(maxX - minX).toBeGreaterThanOrEqual(36);
  expect(maxX - minX).toBeLessThanOrEqual(44);
  const ceiling = layout.blocks.find(
    (block) => block.position.y - block.size.y / 2 >= 5,
  );
  expect(ceiling).toBeDefined();
  // Wnętrze: od tylnej ściany (z = −7) do ściany za torami (z = 8).
  const trough = layout.blocks.filter((block) => block.position.y < 0);
  expect(trough.length).toBeGreaterThan(0);
  const depth =
    Math.max(...trough.map((b) => b.position.z + b.size.z / 2)) -
    Math.min(
      ...floors
        .filter((b) => b.size.x >= 30)
        .map((b) => b.position.z - b.size.z / 2),
    );
  expect(depth).toBeGreaterThanOrEqual(12);
  expect(depth).toBeLessThanOrEqual(16);
});

it('dno niecki torów leży najwyżej 1 m pod peronem (wyjście skokiem, bez pułapek)', () => {
  const bed = layout.blocks.filter(
    (block) => block.position.y + block.size.y / 2 < 0 && block.size.y >= 1,
  );
  expect(bed.length).toBeGreaterThan(0);
  for (const block of bed)
    expect(block.position.y + block.size.y / 2).toBeGreaterThanOrEqual(-1);
});

it('motyw hideout istnieje i nie ma deszczu ani burzy', () => {
  expect(layout.theme).toBe('hideout');
  const theme = themeDefinitions.get('hideout')!;
  expect(theme.rain.enabled).toBe(false);
  expect(theme.rain.storm).toBeFalsy();
});

it('tekstury i modele z danych istnieją w public/assets', () => {
  const exists = (path: string): boolean => existsSync(publicFile(path));
  for (const sign of layout.signs ?? [])
    expect(exists(`textures/signs/${sign.texture}.webp`)).toBe(true);
  for (const decal of layout.decals ?? [])
    expect(exists(`textures/decals/${decal.texture}.webp`)).toBe(true);
  for (const panel of layout.panels ?? [])
    expect(
      exists(
        `textures/${panel.kind === 'tiles' ? 'surfaces' : 'screens'}/${panel.texture}.webp`,
      ),
    ).toBe(true);
  for (const decor of layout.decor ?? [])
    expect(exists(`models/city/${decor.model}.glb`)).toBe(true);
  for (const block of layout.blocks)
    if (block.model)
      expect(exists(`models/city/${block.model}.glb`)).toBe(true);
  expect(layout.panels?.some((panel) => panel.texture === 'tiles_wall')).toBe(
    true,
  );
});

it('oprawa: najwyżej 8 świateł i paleta Neon Noir bez czerwieni, cyanu i magenty', () => {
  expect((layout.lights ?? []).length).toBeLessThanOrEqual(8);
  const allowed = new Set([
    '#ffae1a',
    '#6dff4a',
    '#8a5cff',
    '#3d7bff',
    '#fff1d6',
  ]);
  const colors = [
    ...(layout.lights ?? []).map((light) => light.color),
    ...(layout.signs ?? []).flatMap((sign) => (sign.tint ? [sign.tint] : [])),
    ...layout.stations.flatMap((station) =>
      station.sign?.color ? [station.sign.color] : [],
    ),
  ];
  for (const color of colors)
    expect(allowed.has(color.toLowerCase())).toBe(true);
});

it('stacje: strefy się nie nachodzą i mają jasne obiekty interaktywne', () => {
  for (const a of layout.stations)
    for (const b of layout.stations) {
      if (a === b) continue;
      expect(
        Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z),
      ).toBeGreaterThanOrEqual(a.radius + b.radius);
    }
  expect(
    layout.blocks.filter((block) => block.interactive).length,
  ).toBeGreaterThanOrEqual(4);
});

it('schemat odrzuca stację poza podłogą, w bloku i w niecce torów', () => {
  expect(
    paths(
      mutate((copy) => {
        copy.stations[0]!.position = { x: 50, z: 0 };
      }),
    ),
  ).toContain('stations.0.position');
  expect(
    paths(
      mutate((copy) => {
        // Środek tablicy misji: wewnątrz bloku.
        copy.stations[1]!.position = { x: -6, z: -6.8 };
      }),
    ),
  ).toContain('stations.1.position');
  expect(
    paths(
      mutate((copy) => {
        // Niecka torów: dno poniżej poziomu spawnu, więc poza podłogą.
        copy.stations[2]!.position = { x: 0, z: 6 };
      }),
    ),
  ).toContain('stations.2.position');
});

it('schemat odrzuca powtórzoną stację i nachodzące strefy', () => {
  expect(
    issues(
      mutate((copy) => {
        copy.stations[3]!.id = 'workshop';
      }),
    ).some((issue) => issue.message.includes('Powtórzona stacja')),
  ).toBe(true);
  expect(
    issues(
      mutate((copy) => {
        copy.stations[1]!.position = { ...copy.stations[0]!.position };
      }),
    ).some((issue) => issue.message.includes('nachodzą')),
  ).toBe(true);
});

it('stacja odgrodzona od playerSpawn jest odrzucona jako nieosiągalna', () => {
  const walled = mutate((copy) => {
    // Pełna ściana przecina peron na całej szerokości między spawnem a stacjami.
    copy.blocks.push({
      size: { x: 40, y: 5, z: 1.2 },
      position: { x: 0, y: 2.5, z: -2 },
      material: 'concrete',
    } as Data['blocks'][number]);
  });
  expect(
    issues(walled).some((issue) => issue.message.includes('nieosiągalny')),
  ).toBe(true);
});
