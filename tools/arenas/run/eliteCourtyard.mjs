// Dziedziniec korporacji (elite): kolumnada, holograficzna fontanna, ogrody z murkami z żywopłotu,
// tarasy biurowe na 3,6 i 7,2 m. Landmark: wieża biurowa (40 m) z wielkim ekranem. Pogoda: clearNight.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import {
  dressPerimeter,
  scatter,
  spawns,
  tower,
  track,
  wallSets,
} from './_runKitC.mjs';

export default function generate() {
  const bounds = R(-42, 42, -52, 52);
  const k = createRunRoom({
    id: 'eliteCourtyard',
    name: 'Dziedziniec korporacji',
    type: 'elite',
    weather: 'clearNight',
    seed: 'run-courtyard-v1',
    bounds,
    startX: -22,
    exitX: 22,
    wallMaterial: 'facade',
    wallHeights: [15, 20, 17, 24],
  });
  track(k);
  const { arena, p } = k;
  const sets = wallSets({
    neons: ['implants', 'hotel', 'iskra'],
    colors: [COLOR.blue, COLOR.warm, COLOR.violet],
    decals: ['poster_torn1', 'sticker_cluster', 'poster_torn3'],
    top: 6,
  });

  k.ground(R(-42, 42, 28, 52), 0, 'paving');
  k.ground(R(-42, 42, -8, 28), 0, 'quay_concrete');
  k.ground(R(-42, 42, -52, -8), 0, 'paving');
  k.perimeter();

  // Wieża biurowa (landmark): 24 × 18 m w rzucie, 40 m wysokości, ekran na elewacji południowej.
  const TOWER = R(26, 42, -52, -34);
  k.mass(TOWER, 40, 'facade');
  k.faceNeon(TOWER, 'S', 8, 26, 'iskra', 13, 6.5, COLOR.blue, 0.1);
  k.faceNeon(TOWER, 'S', 8, 14, 'implants', 8, 4, COLOR.warm, 0.2);
  k.faceNeon(TOWER, 'W', 9, 26, 'iskra', 12, 6, COLOR.violet, 0.15);
  k.holo('holo_kurogane', 34, 34, -32.8, 12, 7, 0, COLOR.warm);
  for (const [x, y, z, c] of [
    [34, 26, -28, COLOR.blue],
    [34, 14, -30, COLOR.warm],
    [20, 22, -36, COLOR.violet],
    [22, 8, -30, COLOR.blue],
  ])
    k.light(x, y, z, c, 70, 40);
  for (const along of [2, 14])
    for (const y of [4, 9, 18, 33])
      k.face(TOWER, 'S', along, y, 'city_ad_screen', 0.2);

  // Tarasy biurowe: T1 (3,6 m) i T2 (7,2 m) w północno-zachodnim narożniku; rampy o spadku 0,3.
  const T1 = R(-42, -8, -38, -24);
  const T2 = R(-42, -20, -52, -38);
  k.deck(T1, 3.6, 'concrete');
  k.deck(T2, 7.2, 'concrete');
  const rail = (a, b, openings) =>
    p.wall(a, b, 1.1, 0.12, 'trim', openings ? { openings } : {});
  rail(vec(-42, 3.6, -24), vec(-8, 3.6, -24), [
    { at: 22, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-8, 3.6, -38), vec(-8, 3.6, -24));
  rail(vec(-20, 3.6, -38), vec(-8, 3.6, -38));
  rail(vec(-42, 7.2, -52), vec(-42, 7.2, -38));
  rail(vec(-42, 3.6, -38), vec(-42, 3.6, -24));
  k.ramp(vec(-20, 3.6, -24), vec(-20, 0, -12), 4, 'trim');
  k.ramp(vec(-36, 3.6, -26), vec(-36, 7.2, -38), 3, 'trim');
  const ANNEX = R(-20, -8, -52, -38);
  k.mass(ANNEX, 12, 'facade');
  k.faceNeon(ANNEX, 'S', 9, 7, 'hotel', 6, 3, COLOR.warm, 0.2);
  k.faceNeon(ANNEX, 'S', 8, 4.5, 'pharmacy', 2.4, 1.2, COLOR.green, 0.3);

  // Kolumnada: dwa rzędy kolumn 1,4 × 7 m z belką (spód 7 m); środek placu przy fontannie otwarty.
  const colonnade = (z, xs) => {
    for (const x of xs) {
      k.solid(R(x - 0.7, x + 0.7, z - 0.7, z + 0.7), 0, 7, 'plaster');
      k.reserve(R(x - 0.7, x + 0.7, z - 0.7, z + 0.7));
    }
    const a = xs[0] - 0.7,
      b = xs.at(-1) + 0.7;
    k.solid(R(a, b, z - 0.8, z + 0.8), 7, 7.6, 'trim');
  };
  colonnade(20, [-36, -28, -20, -12, -4, 4, 12, 20, 28, 36]);
  colonnade(0, [-36, -28, -20, -12]);
  colonnade(0, [12, 20, 28, 36]);

  // Fontanna holograficzna: niska misa 12 × 12 m, hologramy nad wodą, projektory w narożach.
  const FOUNT = R(-6, 6, 4, 16);
  k.solid(FOUNT, 0, 0.9, 'quay_concrete');
  k.reserve(FOUNT);
  k.solid(R(-1, 1, 9, 11), 0.9, 2.6, 'metal');
  k.holo('holo_koi', 0, 5, 10, 7, 4, 0, COLOR.blue);
  k.holo('holo_jellyfish', 0, 5, 10, 7, 4, Math.PI / 2, COLOR.violet);
  for (const [x, z] of [
    [-5, 5],
    [5, 5],
    [-5, 15],
    [5, 15],
  ])
    k.deco('city_holo_projector', x, 0.95, z);
  k.light(0, 4, 10, COLOR.blue, 60, 22);
  k.light(0, 1.5, 10, COLOR.violet, 40, 14);

  // Ogród wschodni i zachodni: murki z żywopłotu 1,2 m; przejścia co kilka metrów.
  // Pawilony: recepcja przy wjeździe i kawiarnia przy wieży (osłona przed trasą prostą).
  tower(k, R(-18, -6, 30, 36), 6, sets, {
    sides: ['N', 'S', 'E', 'W'],
    margin: 2,
    step: 4,
  });
  tower(k, R(-4, 8, -6, -2), 6, sets, {
    sides: ['N', 'S', 'E', 'W'],
    margin: 2,
    step: 4,
  });
  const hedge = (r) => {
    k.solid(r, 0, 1.2, 'flood_brick_algae');
    k.reserve(r);
  };
  for (const [x0, x1, z] of [
    [-40, -30, 36],
    [-14, -4, 38],
    [6, 16, 36],
    [28, 40, 38],
    [-40, -28, 10],
    [-26, -16, 12],
    [16, 26, 12],
    [28, 40, 10],
    [-34, -24, -4],
    [26, 38, -4],
  ])
    hedge(R(x0, x1, z - 0.6, z + 0.6));
  for (const [x, z0, z1] of [
    [-26, 28, 34],
    [4, 30, 34],
    [-30, 14, 20],
    [34, 14, 20],
    [-40, 2, 8],
  ])
    hedge(R(x - 0.6, x + 0.6, z0, z1));
  scatter(
    k,
    [
      'city_car',
      'city_barrier',
      'city_kiosk',
      'city_vending',
      'city_generator',
      'city_crates',
      'city_highway_barrier',
      'city_dumpster',
    ],
    R(-40, 40, 30, 50),
    { count: 12, clear: 3.2, avoid: [R(-30, -14, 44, 52)] },
  );
  scatter(
    k,
    [
      'city_barrier',
      'city_kiosk',
      'city_vending',
      'city_car',
      'city_crates',
      'city_wrecked_car',
    ],
    R(-40, 40, -8, 28),
    {
      count: 16,
      clear: 3,
      avoid: [R(-8, 8, 2, 18)],
    },
  );
  scatter(
    k,
    [
      'city_barrier',
      'city_kiosk',
      'city_vending',
      'city_generator',
      'city_crates',
      'city_car',
    ],
    R(-8, 40, -50, -10),
    {
      count: 14,
      clear: 3.2,
      avoid: [R(24, 42, -52, -32)],
    },
  );
  for (const [model, x, z, y, quarter] of [
    ['city_vending', -12, -30, 3.6, 1],
    ['city_crates', -30, -28, 3.6, 0],
    ['city_barrier', -22, -26, 3.6, 0],
    ['city_roof_hvac_unit', -32, -44, 7.2, 0],
    ['city_generator', -24, -42, 7.2, 0],
  ])
    k.prop(model, x, z, { y, quarter });

  dressPerimeter(k, { startX: -22, exitX: 22, step: 6, height: 15, sets });

  // Lampy i neony: zimna biel, błękit i fiolet korporacji.
  for (const [x, z, c] of [
    [-38, 46, COLOR.blue],
    [-10, 44, COLOR.warm],
    [14, 46, COLOR.violet],
    [38, 40, COLOR.blue],
    [-38, 24, COLOR.warm],
    [38, 24, COLOR.warm],
    [-24, 10, COLOR.blue],
    [24, 10, COLOR.violet],
    [-24, -4, COLOR.warm],
    [24, -4, COLOR.blue],
    [0, -14, COLOR.warm],
    [-30, -18, COLOR.violet],
    [30, -22, COLOR.blue],
  ])
    k.lamp(x, z, c);
  for (const x of [-32, -16, 0, 16, 32])
    k.light(x, 6.4, 20, COLOR.warm, 22, 14);
  for (const x of [-32, -16, 16, 32]) k.light(x, 6.4, 0, COLOR.blue, 22, 14);
  for (const [x, z, c] of [
    [-34, 38, COLOR.green],
    [34, 30, COLOR.amber],
    [-34, 6, COLOR.violet],
    [34, 6, COLOR.green],
    [0, -26, COLOR.amber],
    [-14, -6, COLOR.blue],
  ])
    k.light(x, 4, z, c, 16, 12);
  for (const [x, z] of [
    [-28, 24],
    [28, 24],
    [0, 24],
  ])
    k.deco('city_lantern_string', x - 5, 5, z, 0);
  for (const [x, z] of [
    [-34, 30],
    [34, 8],
    [-18, -10],
    [8, -12],
  ])
    k.fx('steam', x, 0.1, z, 1);
  for (const [x, y, z] of [
    [0, 1.2, 10],
    [-4, 1, 6],
    [4, 1, 14],
  ])
    k.fx('drip', x, y, z);
  for (const [tex, x, z, w] of [
    ['floor_arrow', 22, -46, 2],
    ['floor_stop', -22, 46, 3],
    ['manhole', 0, 32, 1.6],
    ['manhole', 14, -8, 1.6],
    ['crack_floor', -30, 4, 3],
    ['puddle1', 0, 24, 5],
    ['puddle2', -14, -10, 5],
    ['puddle1', 30, 18, 5],
    ['puddle2', 10, 44, 5],
    ['oil_stain', 20, 34, 3],
    ['tire_marks', -4, 48, 5],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 22],
      ['B', -22, 0, 46],
      ['C', 22, 0, -44],
    ],
    zones: [
      ['Wjazd korporacyjny', R(-42, 42, 28, 52), 'open'],
      ['Kolumnada i fontanna', R(-42, 42, -8, 28), 'dense'],
      ['Tarasy biurowe', R(-42, -8, -52, -24), 'high'],
      ['Plac wieży', R(-8, 42, -52, -8), 'low'],
    ],
    maxAlive: 11,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 95 },
  });
  spawns(k, [
    [-36, 48],
    [-10, 48],
    [10, 42],
    [34, 46],
    [-34, 32],
    [0, 32],
    [32, 32],
    [-36, 22],
    [-18, 24],
    [18, 24],
    [38, 12],
    [-30, 6],
    [-16, 8],
    [16, 6],
    [36, -2],
    [-16, -14],
    [4, -16],
    [32, -14],
    [8, -34],
    [-4, -44],
    [14, -42],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -22, z: 48, yaw: 0, pitch: 14 },
  { name: 'colonnade', x: -30, z: 26, yaw: 350, pitch: 6 },
  { name: 'fountain', x: 0, z: 26, yaw: 0, pitch: 10 },
  { name: 'terrace', x: -30, z: -28, floorY: 3.6, yaw: 90, pitch: -4 },
  { name: 'tower', x: 4, z: -14, yaw: 20, pitch: 30 },
  { name: 'exit', x: 22, z: -20, yaw: 0, pitch: 6 },
];
