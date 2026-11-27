import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom, R, vec } from './_runKit.mjs';
import { createPlacer } from './_run3Kit.mjs';
import { atrium, interiors, rooms, shell } from './_run5Kit.mjs';
import { furnish } from './_run5Rooms.mjs';
import { city, dress } from './_run5Dress.mjs';
export { shots } from './_run5Dress.mjs';

export default function generate() {
  const k = createRunRoom({
    id: 'run5',
    name: 'Przychodnia Helixa Dynamics — 61. piętro',
    weather: 'helixaClinic',
    bounds: R(-28, 28, -39, 35),
    startX: 0,
    exitX: 0,
  });
  const p = createPlacer(k);
  shell(k);
  atrium(k, p);
  furnish(k, p);
  dress(k);
  interiors(k, p);
  city(k);
  const spawns = [
    [-7.5, 30.4],
    [-24.4, 30.5],
    [-14.5, 23.3],
    [11.8, 19.2],
    [26.3, 25],
    [16, 32.1],
    [-25, 17.6],
    [-16, 10],
    [-5.9, 1.6],
    [6.3, 13.1],
    [-25.5, -1],
    [-12.8, -4.7],
    [11.9, 2.4],
    [26, -3.3],
    [-17.3, -23],
    [23.7, -25.1],
    [-16, -10.7, 4.4],
    [9.4, -32.8, 4.4],
  ];
  for (const [x, z, y = 0] of spawns) {
    if (!p.free(x, z, y, 1))
      throw Error('Brak metra wokół spawnu ' + [x, y, z]);
    k.arena.floorSpawn(vec(x, y, z));
  }
  k.arena.roomMeta({
    panoramaDropM: 61,
    playerSpawn: vec(0, 0, 31),
    doors: [
      ['entry', 34.5],
      ['exit', -38.5],
    ].map(([role, z]) => ({
      id: role,
      role,
      position: vec(0, 1.5, z),
      size: vec(4, 3, 1),
    })),
  });
  k.finish({
    points: [
      ['A', 0, 0, 12],
      ['B', 0, 0, -23],
      ['C', 0, 4.4, -33],
    ],
    zones: [
      ...rooms.map(([name, , r], i) => [
        name,
        r,
        i === 7 ? 'open' : 'interior',
      ]),
      ['Antresola', R(-28, 28, -12, -8), 'high'],
      ['Kładka', R(-2, 2, -31, -12), 'high'],
      ['Taras widokowy', R(-12, 12, -35, -31), 'high'],
    ],
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
      new URL('../../../src/data/rooms/run5.json', import.meta.url),
    ),
  );
