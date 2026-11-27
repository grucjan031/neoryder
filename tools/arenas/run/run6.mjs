import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom, R, vec } from './_runKit.mjs';
import { createPlacer } from './_run3Kit.mjs';
import { rooms, shell, upper } from './_run6Kit.mjs';
import { furnish } from './_run6Rooms.mjs';
import { dress, city } from './_run6Dress.mjs';
export { shots } from './_run6Dress.mjs';
const WARM_LIGHT = '#fff1d6';
const WARM_SCALE = 0.42;
const ACCENT_SCALE = 1.7;
const ACCENT_RANGE_M = 10;

export default function generate() {
  const k = createRunRoom({
    id: 'run6',
    name: 'Bulwar — nocny targ pod estakadą',
    weather: 'bulwarNightMarket',
    bounds: R(-30, 30, -39, 35),
    startX: 0,
    exitX: 14,
  });
  // Moc świateł po odbiorze zrzutów: ciepła baza przygaszona (bez przepaleń na stropach),
  // barwne akcenty stref wzmocnione i o większym zasięgu.
  const placeLight = k.light;
  k.light = (x, y, z, color, intensity = 20, range = 16, opts = {}) =>
    color === WARM_LIGHT
      ? placeLight(
          x,
          y,
          z,
          color,
          Math.round(intensity * WARM_SCALE),
          range,
          opts,
        )
      : placeLight(
          x,
          y,
          z,
          color,
          Math.round(intensity * ACCENT_SCALE),
          Math.max(range, ACCENT_RANGE_M),
          opts,
        );
  const p = createPlacer(k);
  shell(k);
  upper(k);
  furnish(k, p);
  dress(k, p);
  city(k);
  for (const [x, z, y = 0] of [
    [7.6, 30],
    [-28, 10],
    [-23, 20],
    [-12, 30],
    [13, 12],
    [26, 28],
    [-26, -8],
    [-13, 2],
    [13, -9],
    [26, 1],
    [-6, 10],
    [6, 1.5],
    [-23, -17],
    [-13, -26],
    [1, -28],
    [20, -34],
    [-23, -34, 4.2],
    [7.5, 2, 4.2],
  ]) {
    if (!p.free(x, z, y, 0.65)) throw Error('Zajęty spawn ' + [x, z, y]);
    k.arena.floorSpawn(vec(x, y, z));
  }
  k.arena.roomMeta({
    playerSpawn: vec(0, 0, 31),
    panoramaDropM: 20,
    doors: [
      ['entry', 0, 34.5],
      ['exit', 14, -38.5],
    ].map(([role, x, z]) => ({
      id: role,
      role,
      position: vec(x, 1.5, z),
      size: vec(4, 3, 1),
    })),
  });
  k.finish({
    points: [
      ['A', 0, 0, 12],
      ['B', 12, 0, -28],
      ['C', -21, 4.2, -33],
    ],
    zones: rooms.map(([name, , r, , , , kind]) => [name, r, kind]),
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 24 },
  });
  k.arena.arenaMeta({
    batchCellM: 40,
    navigationCellM: 0.5,
    navigationClearanceM: 0.4,
    navigationMaxRiseM: 0.55,
    navigationHeadroomM: 2.2,
  });
  return k.arena;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generate().write(
    fileURLToPath(
      new URL('../../../src/data/rooms/run6.json', import.meta.url),
    ),
  );
