// Plac reklam (elite): plac z projektorami holo, dwie trybuny amfiteatru (2,4 i 4,8 m) z rampami po bokach,
// pawilony i stragany, ściana ekranów na północy. Landmark: ściana wielkich ekranów (24 m) z hologramami.
// Pogoda: clearNight.
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
  const bounds = R(-42, 42, -50, 50);
  const k = createRunRoom({
    id: 'plazaHolo',
    name: 'Plac reklam',
    type: 'elite',
    weather: 'clearNight',
    seed: 'run-plaza-v1',
    bounds,
    startX: -22,
    exitX: 28,
    wallMaterial: 'facade',
    wallHeights: [15, 21, 17, 24],
  });
  track(k);
  const { arena } = k;
  const sets = wallSets({
    neons: ['karaoke', 'arcade', 'cocktail'],
    colors: [COLOR.violet, COLOR.blue, COLOR.amber],
    decals: ['graffiti_piece', 'poster_torn3', 'sticker_cluster'],
    top: 6,
  });

  k.ground(R(-42, 42, 26, 50), 0, 'paving');
  k.ground(R(-42, 42, -50, 26), 0, 'overpass_forecourt');
  k.perimeter();

  // Trybuny amfiteatru po bokach placu: T1 (2,4 m) i T2 (4,8 m), rampy o spadku ≤ 0,35.
  for (const s of [-1, 1]) {
    const x = (a, b) => (s < 0 ? R(-b, -a, 0, 0) : R(a, b, 0, 0));
    const [x0, x1] = [x(26, 42).minX, x(26, 42).maxX];
    k.deck(R(x0, x1, -30, 24), 2.4, 'concrete');
    const t2 = s < 0 ? R(-42, -34, -30, 10) : R(34, 42, -30, 10);
    k.deck(t2, 4.8, 'concrete');
    const rx = s * 30;
    k.ramp(vec(rx, 2.4, 24), vec(rx, 0, 31), 3, 'metal');
    k.ramp(vec(s * 38, 4.8, 10), vec(s * 38, 2.4, 17), 3, 'metal');
    // Rzędy siedzisk jako niskie osłony na trybunach.
    for (const z of [-24, -16, -8, 0]) {
      k.prop('city_barrier', s * 38, z, { y: 4.8, quarter: 1 });
    }
    for (const z of [-20, -10, 0, 8, 18]) {
      k.prop('city_barrier', s * 30, z, { y: 2.4, quarter: 1 });
    }
    k.prop('city_vending', s * 40, 14, { y: 2.4, quarter: s < 0 ? 3 : 1 });
    k.prop('city_kiosk', s * 28, -26, { y: 2.4, quarter: 0 });
    k.prop('city_generator', s * 40, -28, { y: 4.8, quarter: 1 });
  }

  // Ściana ekranów (landmark): blok 36 × 24 m z dużymi neonami i hologramami przed nią.
  const SCREEN = R(-22, 14, -50, -40);
  k.mass(SCREEN, 24, 'facade');
  k.faceNeon(SCREEN, 'S', 9, 17, 'karaoke', 14, 7, COLOR.violet, 0.1);
  k.faceNeon(SCREEN, 'S', 27, 17, 'arcade', 14, 7, COLOR.blue, 0.12);
  k.faceNeon(SCREEN, 'S', 9, 8, 'cocktail', 10, 5, COLOR.amber, 0.2);
  k.faceNeon(SCREEN, 'S', 27, 8, 'iskra', 10, 5, COLOR.warm, 0.2);
  k.faceNeon(SCREEN, 'S', 18, 22, 'open', 8, 4, COLOR.green, 0.15);
  for (const [i, along] of [3, 13, 23, 33].entries())
    k.face(
      SCREEN,
      'S',
      along,
      3,
      i % 2 ? 'city_ad_screen' : 'city_sign_box',
      0.2,
    );
  k.holo('holo_kurogane', -8, 12, -35, 12, 7, 0, COLOR.warm);
  k.holo('holo_koi', 6, 12, -33, 12, 7, 0, COLOR.blue);
  k.holo('holo_android', -20, 9, -30, 9, 6, 0.3, COLOR.violet);
  k.holo('holo_jellyfish', 18, 9, -30, 9, 6, -0.3, COLOR.violet);
  for (const [x, y, z, c, i] of [
    [-4, 16, -37, COLOR.violet, 80],
    [-4, 6, -37, COLOR.amber, 60],
    [14, 12, -32, COLOR.blue, 60],
    [-20, 12, -36, COLOR.blue, 50],
  ])
    k.light(x, y, z, c, i, 36);
  tower(k, R(-42, -22, -50, -32), 14, sets, {
    sides: ['E', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(14, 22, -50, -40), 18, sets, {
    sides: ['W', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(34, 42, -50, -32), 16, sets, {
    sides: ['W', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(-42, -30, 38, 50), 8, sets, {
    sides: ['N', 'E'],
    margin: 2,
    step: 5,
  });
  tower(k, R(32, 42, 38, 50), 9, sets, {
    sides: ['N', 'W'],
    margin: 2,
    step: 5,
  });

  // Pawilony reklamowe w środku placu (osłona przed trasą prostą).
  tower(k, R(-14, -2, 12, 20), 5, sets, {
    sides: ['N', 'S', 'E', 'W'],
    margin: 2,
    step: 4,
  });
  tower(k, R(0, 12, -14, -6), 5, sets, {
    sides: ['N', 'S', 'E', 'W'],
    margin: 2,
    step: 4,
  });
  k.faceNeon(
    R(-14, -2, 12, 20),
    'S',
    6,
    3.4,
    'arcade',
    4,
    2,
    COLOR.violet,
    0.3,
  );
  k.faceNeon(R(0, 12, -14, -6), 'S', 6, 3.4, 'karaoke', 4, 2, COLOR.blue, 0.3);

  // Projektory holo na placu i pierścień stoisk wokół środka.
  for (const [x, z] of [
    [-8, -4],
    [8, -4],
    [-8, 6],
    [8, 6],
    [0, 0],
    [-16, 0],
    [16, 0],
    [0, -22],
  ]) {
    k.deco('city_holo_projector', x, 0.4, z);
    k.light(x, 1.2, z, COLOR.blue, 18, 10);
  }
  k.holo('holo_drink', 0, 7, 0, 7, 4, 0, COLOR.green);
  k.holo('holo_implant', 0, 7, 0, 7, 4, Math.PI / 2, COLOR.violet);
  for (const [model, x, z, quarter] of [
    ['city_market_stall_canopy', -20, 8, 0],
    ['city_market_stall_canopy_violet', -20, -6, 2],
    ['city_market_stall_canopy', 20, 6, 0],
    ['city_market_stall_canopy_violet', 20, -8, 2],
    ['city_stall', -14, -20, 0],
    ['city_stall', 8, -22, 0],
  ])
    k.prop(model, x, z, { quarter });
  const base = [
    'city_barrier',
    'city_vending',
    'city_kiosk',
    'city_car',
    'city_crates',
    'city_generator',
    'city_dumpster',
    'city_highway_barrier',
    'city_wrecked_car',
  ];
  scatter(k, base, R(-26, 26, 28, 49), {
    count: 14,
    clear: 3.2,
    avoid: [R(-30, -14, 44, 50)],
  });
  scatter(k, base, R(-26, 26, -4, 26), {
    count: 12,
    clear: 3.2,
    avoid: [R(-4, 4, -4, 4)],
  });
  scatter(k, base, R(-26, 26, -38, -4), {
    count: 10,
    clear: 3.2,
    avoid: [R(-22, 14, -42, -30)],
  });
  scatter(k, base, R(14, 24, -29, -4), { count: 5, clear: 3.2 });

  dressPerimeter(k, { startX: -22, exitX: 28, step: 6, height: 15, sets });

  // Światła: fiolet i błękit reklam, bursztyn i zielony akcent, ciepła biel przy trybunach.
  for (const [x, z, c] of [
    [-34, 44, COLOR.violet],
    [-12, 44, COLOR.blue],
    [12, 46, COLOR.amber],
    [34, 44, COLOR.green],
    [-34, 26, COLOR.warm],
    [34, 26, COLOR.warm],
    [-24, 10, COLOR.violet],
    [24, 10, COLOR.blue],
    [-24, -12, COLOR.amber],
    [24, -12, COLOR.green],
    [0, 20, COLOR.warm],
    [-30, -34, COLOR.blue],
    [30, -34, COLOR.violet],
  ])
    k.lamp(x, z, c);
  for (const [x, z, c] of [
    [-38, 0, COLOR.warm],
    [38, 0, COLOR.warm],
    [-38, -20, COLOR.blue],
    [38, -20, COLOR.violet],
    [0, 36, COLOR.violet],
    [-14, 4, COLOR.green],
    [14, 4, COLOR.amber],
  ])
    k.light(x, 5.5, z, c, 20, 14);
  for (const [x, z] of [
    [-20, 30],
    [0, 30],
    [20, 30],
    [-20, -14],
    [20, -20],
  ])
    k.deco('city_lantern_string', x - 5, 5, z, 0);
  for (const [x, z] of [
    [-30, 32],
    [26, 18],
    [-6, -28],
    [30, -30],
  ])
    k.fx('steam', x, 0.1, z, 1);
  for (const [x, y, z] of [
    [-38, 5, -10],
    [38, 5, -10],
  ])
    k.fx('sparks', x, y, z, 0.4);
  for (const [tex, x, z, w] of [
    ['floor_arrow', 28, -46, 2],
    ['floor_stop', -22, 46, 3],
    ['manhole', 6, 34, 1.6],
    ['manhole', -4, -16, 1.6],
    ['puddle1', -8, 28, 5],
    ['puddle2', 14, 18, 5],
    ['puddle1', 4, -26, 5],
    ['puddle2', -20, -2, 5],
    ['crack_floor', 20, 32, 3],
    ['oil_stain', -26, 36, 3],
    ['tire_marks', 0, 44, 5],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -22, 0, 44],
      ['C', 28, 0, -44],
    ],
    zones: [
      ['Dojazd i bramy', R(-42, 42, 26, 50), 'open'],
      ['Plac holo', R(-26, 26, -30, 26), 'dense'],
      ['Trybuny zachodnie', R(-42, -26, -30, 24), 'high'],
      ['Ściana ekranów', R(-42, 42, -50, -30), 'low'],
    ],
    maxAlive: 12,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 95 },
  });
  spawns(k, [
    [-24, 38],
    [-12, 46],
    [8, 40],
    [30, 46],
    [-24, 32],
    [14, 30],
    [36, 28],
    [-20, 18],
    [-6, 8],
    [10, 14],
    [22, 0],
    [-22, -4],
    [4, 0],
    [-10, -14],
    [16, -18],
    [-18, -26],
    [8, -30],
    [28, -34],
    [-4, -34],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -22, z: 46, yaw: 0, pitch: 12 },
  { name: 'plaza', x: 0, z: 30, yaw: 0, pitch: 14 },
  { name: 'screens', x: 0, z: -6, yaw: 350, pitch: 24 },
  { name: 'stand', x: -38, z: 0, floorY: 4.8, yaw: 270, pitch: -4 },
  { name: 'east', x: 30, z: 12, floorY: 2.4, yaw: 90, pitch: -2 },
  { name: 'exit', x: 28, z: -24, yaw: 0, pitch: 6 },
];
