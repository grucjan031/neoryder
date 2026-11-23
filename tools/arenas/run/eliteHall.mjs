// Hala dworca zimą (elite): dworzec czołowy z halą kas pod dźwigarami (antresola na 4,8 m), trzy perony
// i dwa zamarznięte tory w rowach (−1,2 m) z wagonami maglev jako osłonami. Zaspy i śnieg.
// Landmark: wieża zegarowa (35 m) w skrzydle hali. Pogoda: snow.
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
  const bounds = R(-42, 42, -56, 56);
  const k = createRunRoom({
    id: 'eliteHall',
    name: 'Hala dworca',
    type: 'elite',
    weather: 'snow',
    seed: 'run-hall-v1',
    bounds,
    startX: -22,
    exitX: 22,
    wallMaterial: 'snow_concrete',
    wallHeights: [14, 18, 16, 20],
  });
  track(k);
  const { arena, p } = k;
  const sets = wallSets({
    neons: ['metro', 'hotel', 'arrow'],
    colors: [COLOR.blue, COLOR.amber, COLOR.green],
    decals: ['poster_torn2', 'sticker_cluster', 'graffiti_resist'],
    top: 6,
  });
  const bed = -1.2;

  // Grunt: plac przed dworcem, hala, perony na 0 m i tory w rowach (−1,2 m); szwy na liczbach całkowitych.
  k.ground(R(-42, 42, 30, 56), 0, 'snow_asphalt');
  k.ground(R(-42, 42, 6, 30), 0, 'snow_concrete');
  k.ground(R(-42, -20, -56, 6), 0, 'snow_concrete'); // peron zachodni
  k.ground(R(-20, -8, -56, 6), bed, 'rail_ballast'); // tor 1
  k.ground(R(-8, 8, -56, 6), 0, 'snow_concrete'); // peron wyspowy
  k.ground(R(8, 20, -56, 6), bed, 'rail_ballast'); // tor 2
  k.ground(R(20, 42, -56, 6), 0, 'snow_concrete'); // peron wschodni
  k.perimeter();

  // Rampy zejścia z peronów do rowów torowych (spadek 0,3).
  k.ramp(vec(-20, 0, -42), vec(-16, bed, -42), 3, 'snow_concrete');
  k.ramp(vec(-8, 0, -14), vec(-12, bed, -14), 3, 'snow_concrete');
  k.ramp(vec(-20, 0, -2), vec(-16, bed, -2), 3, 'snow_concrete');
  k.ramp(vec(8, 0, -30), vec(12, bed, -30), 3, 'snow_concrete');
  k.ramp(vec(20, 0, -10), vec(16, bed, -10), 3, 'snow_concrete');
  k.ramp(vec(8, 0, 0), vec(12, bed, 0), 3, 'snow_concrete');
  // Tory (dekoracje) i zamarznięte wagony maglev na obu torach.
  for (const x of [-15.2, -12.8, 12.8, 15.2])
    for (let z = -50; z <= 4; z += 12)
      k.deco('rail_track_straight', x, bed - 0.3, z, Math.PI / 2);
  k.prop('rail_maglev_car', -16, -29, {
    y: bed + 0.65,
    quarter: 1,
    material: 'concrete',
  });
  k.prop('rail_maglev_car_open', 16, -37, {
    y: bed + 0.65,
    quarter: 1,
    material: 'concrete',
  });
  k.prop('rail_maglev_car', 16, -10, {
    y: bed + 0.65,
    quarter: 1,
    material: 'concrete',
  });

  // Antresola kas (4,8 m) nad zachodnim skrzydłem hali, rampa od strony hali.
  const MEZ = R(-42, -20, 8, 30);
  k.deck(MEZ, 4.8, 'snow_concrete');
  k.ramp(vec(-20, 4.8, 14), vec(-4, 0, 14), 3, 'snow_concrete');
  const rail = (a, b, openings) =>
    p.wall(a, b, 1.1, 0.12, 'metal', openings ? { openings } : {});
  rail(vec(-42, 4.8, 8), vec(-20, 4.8, 8));
  rail(vec(-20, 4.8, 8), vec(-20, 4.8, 30), [
    { at: 6, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-42, 4.8, 30), vec(-20, 4.8, 30));
  k.prop('city_vending', -38, 12, { y: 4.8, quarter: 3 });
  k.prop('city_kiosk', -26, 28, { y: 4.8, quarter: 0 });
  k.prop('city_crates', -39, 26, { y: 4.8, quarter: 0 });
  k.faceNeon(MEZ, 'S', 10, 7.5, 'metro', 5, 2.5, COLOR.blue, 0.15);

  // Landmark: wieża zegarowa w skrzydle wschodnim hali (kolizja: cokół 8 × 8 m).
  arena.block({
    model: 'roof_clock_tower',
    size: vec(8, 35, 8),
    position: vec(34, 17.5, 18),
    material: 'concrete',
    instance: true,
  });
  k.reserve(R(30, 38, 14, 22));
  k.light(34, 24, 12, COLOR.warm, 90, 46);
  k.light(34, 10, 12, COLOR.amber, 50, 30);
  k.light(24, 30, 18, COLOR.blue, 40, 40);

  // Dźwigary hali (dekoracja) i zadaszenia peronów; kolumny wspierają zadaszenie.
  for (const x of [-15, 15])
    for (let z = 9; z <= 27; z += 6)
      arena.decor('port_warehouse_roof_truss', vec(x, 11, z), 0);
  for (const x of [-27, 0, 27])
    for (let z = -48; z <= -12; z += 12)
      arena.decor('rail_platform_canopy', vec(x, 0, z), Math.PI / 2);
  for (const [x, z] of [
    [-27, 28],
    [-6, 28],
    [6, 28],
    [27, 28],
    [-6, 10],
    [6, 10],
  ]) {
    k.solid(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), 0, 11, 'snow_concrete');
    k.reserve(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5));
  }
  // Belka nad kolumnami (spód 11 m): wsparcie dla słupów.
  k.solid(R(-28, 28, 9.5, 10.5), 11, 11.6, 'snow_concrete');
  k.solid(R(-28, 28, 27.5, 28.5), 11, 11.6, 'snow_concrete');

  // Skrzydła i zaplecza: mury hali, poczta, bagażownia, nastawnia na północy.
  tower(k, R(-42, -30, 30, 44), 9, sets, {
    sides: ['N', 'E'],
    margin: 2,
    step: 5,
  });
  tower(k, R(32, 42, 34, 48), 10, sets, {
    sides: ['N', 'W'],
    margin: 2,
    step: 5,
  });
  tower(k, R(-42, -34, -56, -46), 12, sets, {
    sides: ['S', 'E'],
    margin: 2,
    step: 5,
  });
  tower(k, R(34, 42, -56, -48), 12, sets, {
    sides: ['S', 'W'],
    margin: 2,
    step: 5,
  });
  tower(k, R(-6, 6, 36, 46), 7, sets, {
    sides: ['N', 'S', 'E', 'W'],
    margin: 2,
    step: 4,
  });

  // Osłony: peron, hala, plac. Zaspy to dekoracje (bez kolizji).
  const cover = [
    'city_barrier',
    'city_vending',
    'city_kiosk',
    'city_crates',
    'city_generator',
    'city_dumpster',
    'city_highway_barrier',
    'city_car',
  ];
  scatter(k, cover, R(-40, 40, 32, 55), {
    count: 14,
    clear: 3.2,
    avoid: [R(-8, 8, 34, 48)],
  });
  scatter(k, cover, R(-18, 40, 8, 29), {
    count: 10,
    clear: 3.2,
    avoid: [R(-8, 8, 8, 12)],
  });
  scatter(k, cover, R(-40, -20, -54, 4), { count: 9, clear: 3, avoid: [] });
  scatter(k, cover, R(-6, 6, -54, 4), { count: 8, clear: 3, avoid: [] });
  scatter(k, cover, R(22, 40, -54, 4), { count: 10, clear: 3, avoid: [] });
  for (const [x, z, s] of [
    [-34, 50, 1],
    [-10, 40, 1],
    [14, 52, 1],
    [36, 40, 1],
    [-26, 34, 1],
    [30, 30, 1],
    [-34, -40, 1],
    [30, -20, 1],
    [0, -30, 1],
    [-30, -10, 1],
    [38, -42, 1],
    [-4, 20, 1],
  ]) {
    k.deco('rail_snow_drift', x, 0, z, (x * 7) % 3);
    k.deco('rail_snow_drift_long', x + 5, 0, z + 3, 0, s > 1 ? s : undefined);
  }
  for (const [x, z] of [
    [-24, 46],
    [8, 32],
    [26, 54],
    [-36, 30],
    [26, 24],
    [-10, 24],
  ])
    k.deco('rail_snow_drift_patch', x, 0, z, 0.4);

  dressPerimeter(k, { startX: -22, exitX: 22, step: 6, height: 14, sets });

  // Światła: zimna biel w hali i na peronach, bursztynowe lampy na placu, błękit na torach.
  for (const x of [-24, -8, 8, 24])
    for (const z of [14, 24]) k.light(x, 9, z, COLOR.warm, 26, 16);
  for (const x of [-30, 0, 30])
    for (const z of [-44, -24, -4]) k.light(x, 4.5, z, COLOR.warm, 20, 14);
  for (const [x, z, c] of [
    [-14, -20, COLOR.blue],
    [14, -30, COLOR.blue],
    [-14, -44, COLOR.green],
    [14, -6, COLOR.green],
    [-4, 26, COLOR.amber],
    [36, 6, COLOR.violet],
  ])
    k.light(x, 1, z, c, 14, 10);
  for (const [x, z, c] of [
    [-36, 52, COLOR.amber],
    [-12, 46, COLOR.warm],
    [12, 50, COLOR.amber],
    [38, 52, COLOR.green],
    [-36, 34, COLOR.warm],
    [24, 34, COLOR.amber],
  ])
    k.lamp(x, z, c);
  for (const [x, z] of [
    [-24, 26],
    [10, 8],
    [-4, 52],
    [30, -6],
  ])
    k.fx('steam', x, 0.1, z, 1);
  for (const [x, y, z] of [
    [-27, 5, -20],
    [27, 5, -30],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-14, -0.4, -30],
    [14, -0.4, -10],
  ])
    k.fx('sparks', x, y, z, 0.4);
  for (const [tex, x, z, w] of [
    ['floor_arrow', 22, -52, 2],
    ['floor_stop', -22, 52, 3],
    ['floor_hazard', -20, -20, 10],
    ['floor_hazard', 20, -20, 10],
    ['floor_hazard', -8, -20, 10],
    ['manhole', 6, 44, 1.6],
    ['crack_floor', -30, -30, 3],
    ['puddle1', 10, 20, 5],
    ['puddle2', -4, 36, 5],
    ['oil_stain', 30, 40, 3],
    ['tire_marks', -4, 50, 5],
  ])
    k.decal(
      tex,
      x,
      0.012,
      z,
      w,
      tex === 'floor_hazard' ? 0.5 : w * 0.6,
      tex === 'floor_hazard' ? Math.PI / 2 : 0,
    );

  k.finish({
    points: [
      ['A', 0, 0, 20],
      ['B', -22, 0, 50],
      ['C', 22, 0, -48],
    ],
    zones: [
      ['Plac przed dworcem', R(-42, 42, 30, 56), 'open'],
      ['Hala kas', R(-42, 42, 6, 30), 'dense'],
      ['Antresola', MEZ, 'high'],
      ['Perony i tory', R(-42, 42, -56, 6), 'low'],
    ],
    maxAlive: 11,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 95 },
  });
  spawns(k, [
    [-36, 52],
    [-12, 52],
    [8, 44],
    [34, 54],
    [-34, 36],
    [16, 38],
    [-12, 22],
    [10, 18],
    [24, 12],
    [-30, 0],
    [-4, -4],
    [30, -2],
    [-30, -24],
    [4, -22],
    [28, -18],
    [-36, -40],
    [2, -44],
    [30, -34],
    [30, -50],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -22, z: 52, yaw: 0, pitch: 12 },
  { name: 'hall', x: 0, z: 30, yaw: 20, pitch: 12 },
  { name: 'clock', x: 10, z: 36, yaw: 55, pitch: 30 },
  { name: 'platforms', x: 0, z: 2, yaw: 0, pitch: 8 },
  { name: 'tracks', x: -12, z: -4, floorY: -1.2, yaw: 0, pitch: 6 },
  { name: 'mezzanine', x: -36, z: 14, floorY: 4.8, yaw: 90, pitch: -4 },
];
