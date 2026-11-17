import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import { HUB_STATION_IDS } from '../../src/core/metaTypes';
import { themeDefinitions } from '../../src/render/themes';
import { loadHubLayout } from '../../src/world/hubSchema';
import { wallDecalFitsBlock } from '../../src/world/dressingSchema';

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

it('układ obejmuje dwa perony i skrzydła północne oraz zachodnie, z sufitem', () => {
  const floors = layout.blocks.filter(
    (block) => block.position.y + block.size.y / 2 === 0,
  );
  const minX = Math.min(...floors.map((b) => b.position.x - b.size.x / 2));
  const maxX = Math.max(...floors.map((b) => b.position.x + b.size.x / 2));
  expect(minX).toBe(-34);
  expect(maxX).toBe(20);
  expect(Math.min(...floors.map((b) => b.position.z - b.size.z / 2))).toBe(-19);
  expect(Math.max(...floors.map((b) => b.position.z + b.size.z / 2))).toBe(16);
  const ceiling = layout.blocks.find(
    (block) => block.position.y - block.size.y / 2 >= 5,
  );
  expect(ceiling).toBeDefined();
  // Wnętrze: od tylnej ściany hali (z = −7) do tylnej ściany peronu B (z = 16).
  const long = floors.filter((b) => b.size.x >= 30);
  expect(long.length).toBeGreaterThanOrEqual(2);
  const front = Math.min(...long.map((b) => b.position.z - b.size.z / 2));
  const back = Math.max(...long.map((b) => b.position.z + b.size.z / 2));
  expect(back - front).toBeGreaterThanOrEqual(20);
  expect(back - front).toBeLessThanOrEqual(26);
  // Niecka torów leży między peronami.
  const trough = layout.blocks.filter(
    (block) => block.position.y + block.size.y / 2 < 0 && block.size.x >= 30,
  );
  expect(trough.length).toBeGreaterThan(0);
  const [hall, platformB] = [...long].sort(
    (a, b) => a.position.z - b.position.z,
  );
  for (const bed of trough) {
    expect(bed.position.z - bed.size.z / 2).toBeGreaterThanOrEqual(
      hall!.position.z + hall!.size.z / 2,
    );
    expect(bed.position.z + bed.size.z / 2).toBeLessThanOrEqual(
      platformB!.position.z - platformB!.size.z / 2,
    );
  }
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
    expect(
      exists(
        `textures/${sign.kind === 'holo' ? 'holo' : 'signs'}/${sign.texture}.webp`,
      ),
    ).toBe(true);
  for (const decal of layout.decals ?? [])
    expect(exists(`textures/decals/${decal.texture}.webp`)).toBe(true);
  for (const panel of layout.panels ?? []) {
    // Wylot tunelu jest malowany proceduralnie, bez pliku tekstury.
    if (panel.kind === 'tunnel') continue;
    expect(
      exists(
        `textures/${{ tiles: 'surfaces', screen: 'screens', poster: 'posters' }[panel.kind]}/${panel.texture}.webp`,
      ),
    ).toBe(true);
  }
  for (const decor of layout.decor ?? [])
    expect(exists(`models/city/${decor.model}.glb`)).toBe(true);
  for (const block of layout.blocks)
    if (block.model)
      expect(exists(`models/city/${block.model}.glb`)).toBe(true);
  expect(layout.panels?.some((panel) => panel.texture === 'tiles_wall')).toBe(
    true,
  );
});

it('oprawa: definicje świateł (renderer włącza 8 najbliższych) i paleta Neon Noir bez czerwieni, cyanu i magenty', () => {
  expect((layout.lights ?? []).length).toBeLessThanOrEqual(28);
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

it('układ ma pięciu NPC z akcentami z palety, każdy z innym akcentem, na podłodze i poza blokami', () => {
  const npcs = layout.npcs ?? [];
  expect(npcs.map((npc) => npc.id).sort()).toEqual(
    ['bajt', 'mira', 'szron', 'tomasz', 'wolan'].sort(),
  );
  expect(new Set(npcs.map((npc) => npc.accent)).size).toBe(npcs.length);
  for (const npc of npcs) expect(npc.position.y ?? 0).toBe(0);
});

it('schemat odrzuca NPC w bloku, poza podłogą i z powtórzonym id; siedzący stoi na bloku', () => {
  const standing = (copy: Data): void => {
    copy.npcs[0]!.animation = 'Idle_Loop';
  };
  expect(
    paths(
      mutate((copy) => {
        standing(copy);
        // Środek tablicy misji: wewnątrz bloku.
        copy.npcs[0]!.position = { x: -6, z: -6.85 };
      }),
    ),
  ).toContain('npcs.0.position');
  expect(
    paths(
      mutate((copy) => {
        standing(copy);
        copy.npcs[0]!.position = { x: 0, z: 6 };
      }),
    ),
  ).toContain('npcs.0.position');
  expect(
    issues(
      mutate((copy) => {
        copy.npcs[1]!.id = copy.npcs[0]!.id;
      }),
    ).some((issue) => issue.message.includes('Powtórzony NPC')),
  ).toBe(true);
  // Siedzący (stołek to blok) nie podlega walidacji bloków.
  expect(layout.npcs?.some((npc) => npc.animation?.startsWith('Sitting'))).toBe(
    true,
  );
});

it('schemat odrzuca nieznany akcent i klip animacji NPC', () => {
  expect(
    issues(
      mutate((copy) => {
        (copy.npcs[0] as { accent: string }).accent = 'red';
      }),
    ).length,
  ).toBeGreaterThan(0);
  expect(
    issues(
      mutate((copy) => {
        (copy.npcs[0] as { animation: string }).animation = 'Idle_Gun';
      }),
    ).length,
  ).toBeGreaterThan(0);
});

it('animacje NPC istnieją w npc_anims.glb, a kolidery NPC nie blokują wejść do wagonu i pokoju łączności', () => {
  const glb = readFileSync(publicFile('models/npc_anims.glb'));
  const json = JSON.parse(
    glb.subarray(20, 20 + glb.readUInt32LE(12)).toString(),
  ) as { animations: { name: string }[] };
  const clips = new Set(json.animations.map((clip) => clip.name));
  for (const npc of layout.npcs ?? [])
    expect(clips.has(npc.animation ?? 'Idle_Loop')).toBe(true);
  // Wejścia: drzwi wagonu (x −13…−11, −8…−6 przy z = 3) i pokoju łączności (x = 8, z 10…13).
  const doors = [
    { x: -12, z: 3.5 },
    { x: -7, z: 3.5 },
    { x: 8.25, z: 11.5 },
  ];
  for (const door of doors)
    for (const npc of layout.npcs ?? [])
      expect(
        Math.hypot(npc.position.x - door.x, npc.position.z - door.z),
      ).toBeGreaterThan(1.2);
});

it('naklejki ścienne i okładziny w całości mieszczą się na licu ściany, bez zasłaniania drzwi', () => {
  const planes = [
    ...(layout.decals ?? []).filter((decal) => decal.surface === 'wall'),
    ...(layout.panels ?? [])
      .filter((panel) => panel.kind === 'tiles')
      .map((panel) => ({ ...panel, surface: 'wall' as const })),
  ];
  for (const plane of planes)
    expect(
      layout.blocks.some((block) => wallDecalFitsBlock(plane, block, 0.04)),
      `${plane.texture} ${JSON.stringify(plane.position)}`,
    ).toBe(true);
});

it('stacje mają ciemne korpusy z jasnym akcentem wewnątrz zachowanego focusu', () => {
  for (const station of layout.stations) {
    const { position, size } = station.focus;
    const overlaps = layout.blocks.filter((block) =>
      (['x', 'y', 'z'] as const).every(
        (axis) =>
          Math.abs(block.position[axis] - position[axis]) <=
          (block.size[axis] + size[axis]) / 2,
      ),
    );
    expect(
      overlaps.some(
        (block) =>
          !block.interactive &&
          ['metal', 'plastic'].includes(block.material ?? ''),
      ),
      station.id,
    ).toBe(true);
    const accents = overlaps.filter((block) => block.interactive);
    expect(accents.length, station.id).toBeGreaterThan(0);
    const volume = (s: { x: number; y: number; z: number }): number =>
      s.x * s.y * s.z;
    expect(
      accents.reduce((sum, block) => sum + volume(block.size), 0),
      station.id,
    ).toBeLessThan(volume(size) / 4);
  }
  for (const fire of layout.fires ?? [])
    expect(
      layout.blocks.some(
        (block) =>
          block.shape === 'barrel' &&
          block.position.x === fire.position.x &&
          block.position.z === fire.position.z &&
          Math.abs(block.position.y + block.size.y / 2 - fire.position.y) <
            0.001,
      ),
    ).toBe(true);
});

// Rezerwacje opisane w docs/systems/hub.md; nie tworzą NPC w danych gry.
const futurePlaces = [
  { role: 'kucharka', x: -17, z: -18.4 },
  { role: 'jedzący A', x: -17.6, z: -13.55, yaw: 180, seat: true },
  { role: 'jedzący B', x: -17.6, z: -16.05, yaw: 0, seat: true },
  { role: 'jedzący C', x: -10.5, z: -13.55, yaw: 180, seat: true },
  { role: 'jedzący D', x: -10.5, z: -16.05, yaw: 0, seat: true },
  { role: 'radiowa', x: 5, z: -15.9, yaw: 180, seat: true },
  { role: 'sanitariuszka', x: -3.5, z: -13.4 },
  { role: 'mieszkaniec', x: -6.5, z: -16.4, yaw: 0, seat: true },
  { role: 'elektryczka', x: -10, z: -8.7 },
  { role: 'handlarz', x: -25, z: 15.4 },
  { role: 'wartownik', x: -22.5, z: 10.7 },
  { role: 'barman', x: -3, z: 15.2 },
  { role: 'tancerka', x: -6.5, z: 12.8 },
  { role: 'bokser', x: 16.1, z: -2.4 },
];
const walkingRoutes = [
  [
    [-30, 13],
    [-10, 13],
    [-10, 11],
    [5.5, 11],
    [5.5, -2.5],
    [4.5, -2.5],
    [4.5, -9.75],
    [-14, -9.75],
    [-14, -12.5],
  ],
  [
    [-7, -2.5],
    [6, -2.5],
    [6, -0.5],
    [-7, -0.5],
    [-7, -2.5],
  ],
  [
    [0.5, 11],
    [6, 11],
    [6, 13.5],
    [0.5, 13.5],
    [0.5, 11],
  ],
];
const floorBlocks = layout.blocks.filter(
  (b) => b.position.y + b.size.y / 2 === 0,
);
const bodyBlocks = layout.blocks.filter(
  (b) =>
    b.position.y + b.size.y / 2 > 0.35 && b.position.y - b.size.y / 2 < 1.8,
);
const onFloor = (x: number, z: number): boolean =>
  floorBlocks.some(
    (b) =>
      Math.abs(x - b.position.x) <= b.size.x / 2 + 1e-6 &&
      Math.abs(z - b.position.z) <= b.size.z / 2 + 1e-6,
  );
const distanceToBlock = (
  x: number,
  z: number,
  b: (typeof bodyBlocks)[number],
): number =>
  Math.hypot(
    Math.max(0, Math.abs(x - b.position.x) - b.size.x / 2),
    Math.max(0, Math.abs(z - b.position.z) - b.size.z / 2),
  );

it('rezerwacje stojące są osiągalne od spawnu na siatce 1 m', () => {
  expect(() =>
    loadHubLayout({
      ...hideoutData,
      npcs: [
        ...hideoutData.npcs,
        ...futurePlaces
          .filter((place) => !place.seat)
          .map((place, index) => ({
            id: `reserved_${index}`,
            position: { x: place.x, z: place.z },
            rotationDeg: 0,
            accent: 'white',
          })),
      ],
    }),
  ).not.toThrow();
});

it('trzy trasy zachowują przejście 2 m i margines 0,9 m od rezerwacji oraz istniejących NPC', () => {
  for (const route of walkingRoutes)
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1]!;
      const [bx, bz] = route[i]!;
      const steps = Math.ceil(Math.hypot(bx! - ax!, bz! - az!) * 10);
      for (let step = 0; step <= steps; step++) {
        const x = ax! + ((bx! - ax!) * step) / steps;
        const z = az! + ((bz! - az!) * step) / steps;
        const at = `${x.toFixed(2)}, ${z.toFixed(2)}`;
        for (const dx of [-1, 0, 1])
          for (const dz of [-1, 0, 1])
            expect(onFloor(x + dx, z + dz), at).toBe(true);
        for (const b of bodyBlocks)
          expect(
            distanceToBlock(x, z, b),
            `${at}: ${JSON.stringify(b.position)}`,
          ).toBeGreaterThanOrEqual(1 - 1e-6);
        for (const npc of [
          ...futurePlaces,
          ...(layout.npcs ?? []).map((n) => n.position),
        ])
          expect(Math.hypot(x - npc.x, z - npc.z), at).toBeGreaterThanOrEqual(
            0.9,
          );
      }
    }
});

it('nowe siedziska mają wierzch 0,48 m, podparcie miednicy i wolną przestrzeń na nogi', () => {
  for (const place of futurePlaces) {
    expect(onFloor(place.x, place.z), place.role).toBe(true);
    if (!place.seat) {
      for (const b of bodyBlocks)
        expect(
          distanceToBlock(place.x, place.z, b),
          place.role,
        ).toBeGreaterThan(0);
      continue;
    }
    expect(
      layout.blocks.some(
        (b) =>
          Math.abs(b.position.y + b.size.y / 2 - 0.48) < 1e-6 &&
          Math.abs(place.x - b.position.x) < b.size.x / 2 &&
          Math.abs(place.z - b.position.z) < b.size.z / 2,
      ),
      place.role,
    ).toBe(true);
    const yaw = (place.yaw! * Math.PI) / 180;
    for (const forward of [0.5, 0.75, 1])
      for (const side of [-0.2, 0, 0.2]) {
        const x = place.x + Math.sin(yaw) * forward + Math.cos(yaw) * side;
        const z = place.z + Math.cos(yaw) * forward - Math.sin(yaw) * side;
        expect(onFloor(x, z), place.role).toBe(true);
        for (const b of layout.blocks.filter(
          (b) =>
            b.position.y + b.size.y / 2 > 0.02 &&
            b.position.y - b.size.y / 2 < 0.7,
        ))
          expect(distanceToBlock(x, z, b), place.role).toBeGreaterThan(0);
      }
  }
});

it('miejsca aktywności mają pełne wolne kwadraty: taniec i boks 2 m, sanitariuszka i elektryczka 1 m', () => {
  for (const [x, z, width] of [
    [-6.5, 12.8, 2],
    [16.1, -2.4, 2],
    [-3.5, -13.4, 1],
    [-10, -8.7, 1],
  ]) {
    for (const dx of [-width! / 2, 0, width! / 2])
      for (const dz of [-width! / 2, 0, width! / 2]) {
        expect(onFloor(x! + dx, z! + dz)).toBe(true);
        for (const b of bodyBlocks)
          expect(distanceToBlock(x! + dx, z! + dz, b)).toBeGreaterThan(0);
      }
  }
});
