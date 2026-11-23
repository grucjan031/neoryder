// Zakład chemiczny (elite): pole zbiorników, estakady rurociągów, kładki serwisowe na 3,6 i 7,2 m
// połączone rampami, toksyczne kałuże (hazard). Landmark: gigantyczna płuczka smogu na północy
// (24 m) z zieloną poświatą. Pogoda: smog.
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
  const bounds = R(-40, 40, -55, 55);
  const k = createRunRoom({
    id: 'eliteChemPlant',
    name: 'Zakład chemiczny',
    type: 'elite',
    weather: 'smog',
    seed: 'run-chem-v1',
    bounds,
    startX: -24,
    exitX: 20,
    wallMaterial: 'smog_soot_wall',
    wallHeights: [14, 18, 16, 21],
  });
  track(k);
  const { arena, p } = k;
  const sets = wallSets({
    neons: ['warsztat', 'arrow', 'repair'],
    colors: [COLOR.green, COLOR.amber, COLOR.violet],
    decals: ['graffiti_tag1', 'poster_torn1', 'sticker_cluster'],
    top: 6,
  });

  k.ground(R(-40, 40, 30, 55), 0, 'asphalt');
  k.ground(R(-40, 40, 8, 30), 0, 'concrete');
  k.ground(R(-40, 40, -14, 8), 0, 'hazard_stripes_worn');
  k.ground(R(-40, 40, -30, -14), 0, 'concrete');
  k.ground(R(-40, 40, -55, -30), 0, 'turbine_hall_floor');
  k.perimeter();

  // Budynki: sterownia i magazyn przy bramie, hale boczne na północy.
  tower(k, R(-40, -26, 36, 48), 9, sets, {
    sides: ['N', 'E'],
    margin: 2,
    step: 5,
  });
  tower(k, R(26, 40, 36, 48), 10, sets, {
    sides: ['N', 'W'],
    margin: 2,
    step: 5,
  });
  tower(k, R(-40, -30, -52, -32), 13, sets, {
    sides: ['E', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(30, 40, -52, -30), 15, sets, {
    sides: ['W', 'S'],
    margin: 2,
    step: 5,
  });

  // Kładki serwisowe: A (3,6 m) nad polem zbiorników, B (7,2 m) przed płuczką; rampy o spadku 0,3.
  const CA = R(-30, 30, -9, -4);
  const CB = R(-12, 12, -26, -21);
  p.floor(CA, 3.6, 'steel_grating', { thickness: 0.4 });
  p.floor(CB, 7.2, 'steel_grating', { thickness: 0.4 });
  for (const x of [-29.4, -20, -10, 0, 10, 20, 29.4])
    for (const z of [-8.6, -4.4])
      k.solid(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), 0, 3.2, 'metal');
  for (const x of [-11.4, 0, 11.4])
    for (const z of [-25.6, -21.4])
      k.solid(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), 0, 6.8, 'metal');
  const rail = (a, b, openings) =>
    p.wall(a, b, 1.1, 0.12, 'metal', openings ? { openings } : {});
  rail(vec(-30, 3.6, -9), vec(30, 3.6, -9), [
    { at: 30, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-30, 3.6, -4), vec(30, 3.6, -4), [
    { at: 3, width: 3.4, height: 1.1 },
    { at: 57, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-30, 3.6, -9), vec(-30, 3.6, -4));
  rail(vec(30, 3.6, -9), vec(30, 3.6, -4));
  rail(vec(-12, 7.2, -26), vec(12, 7.2, -26));
  rail(vec(-12, 7.2, -26), vec(-12, 7.2, -21));
  rail(vec(12, 7.2, -26), vec(12, 7.2, -21));
  rail(vec(-12, 7.2, -21), vec(-1.7, 7.2, -21));
  rail(vec(1.7, 7.2, -21), vec(12, 7.2, -21));
  k.ramp(vec(-27, 3.6, -4), vec(-27, 0, 8), 3, 'metal');
  k.ramp(vec(27, 3.6, -4), vec(27, 0, 8), 3, 'metal');
  k.ramp(vec(0, 7.2, -21), vec(0, 3.6, -9), 3, 'metal');

  // Landmark: płuczka smogu (model 3 × 4 × 3, skala 6 → 18 × 24 × 18 m) przy północnej ścianie.
  arena.decor('city_smog_scrubber', vec(0, 0, -44), 0, { scale: 6 });
  k.solid(R(-9, 9, -53, -35), 0, 10, 'metal', { visible: false });
  k.reserve(R(-9, 9, -53, -35));
  for (const [x, y, z, c] of [
    [0, 20, -33, COLOR.green],
    [-8, 8, -32, COLOR.green],
    [8, 8, -32, COLOR.green],
    [0, 26, -44, COLOR.warm],
  ])
    k.light(x, y, z, c, 70, 40);
  k.faceNeon(R(-9, 9, -53, -35), 'S', 9, 11, 'repair', 8, 4, COLOR.green, 0.15);

  // Zbiorniki (model skala 2,4: 7,2 × 12 × 7,2 m) w dwóch rzędach pola.
  for (const [x, z] of [
    [-24, 20],
    [-12, 24],
    [10, 20],
    [26, 24],
    [-26, -18],
    [4, -18],
    [16, -18],
    [27, -16],
  ]) {
    arena.decor('city_roof_water_tank', vec(x, 0, z), 0, { scale: 2.4 });
    k.solid(R(x - 3.4, x + 3.4, z - 3.4, z + 3.4), 0, 8, 'metal', {
      visible: false,
    });
    k.reserve(R(x - 3.4, x + 3.4, z - 3.4, z + 3.4));
  }
  // Estakady rurociągów (moduły 12 m): nogi i niski kolektor; pod nimi można przejść.
  for (const [cx, z] of [
    [-18, 12],
    [-6, 12],
    [6, 12],
    [18, 12],
    [-30, -33],
    [30, -35],
  ]) {
    arena.decor('power_pipe_rack', vec(cx, 0, z), 0);
    k.solid(R(cx - 6, cx + 6, z - 0.7, z + 0.7), 6.2, 6.4, 'metal', {
      visible: false,
    });
    for (const dx of [-5.85, 5.85]) {
      k.solid(
        R(cx + dx - 0.35, cx + dx + 0.35, z - 0.35, z + 0.35),
        0,
        6.2,
        'metal',
      );
      k.reserve(R(cx + dx - 0.35, cx + dx + 0.35, z - 0.35, z + 0.35));
    }
  }
  // Osłony pola i placu.
  const base = [
    'city_barrier',
    'city_generator',
    'city_crates',
    'city_dumpster',
    'build_pipe_stack',
    'city_vending',
    'city_highway_barrier',
    'city_kiosk',
    'port_container_20_olive',
  ];
  scatter(k, base, R(-38, 38, 31, 54), {
    count: 16,
    clear: 3.2,
    avoid: [R(-30, -18, 46, 55)],
  });
  scatter(k, base, R(-38, 38, 9, 29), {
    count: 12,
    clear: 3.2,
    avoid: [R(-30, 30, 8, 16)],
  });
  scatter(k, base, R(-38, 38, -14, 8), { count: 12, clear: 3.2 });
  scatter(k, base, R(-28, 28, -30, -14), {
    count: 12,
    clear: 3.2,
    avoid: [R(-14, 14, -26, -14)],
  });
  scatter(
    k,
    [
      'city_smog_scrubber',
      'city_generator',
      'city_crates',
      'build_rebar_bundle',
      'city_barrier',
      'build_precast_stack',
    ],
    R(-30, 30, -54, -32),
    {
      count: 8,
      clear: 3.2,
      avoid: [R(-11, 11, -54, -32)],
    },
  );
  for (const [model, x, z, y, quarter] of [
    ['city_crates', -22, -7, 3.6, 0],
    ['city_generator', 8, -6, 3.6, 0],
    ['city_barrier', 20, -7, 3.6, 0],
    ['city_roof_hvac_unit', -8, -23, 7.2, 0],
  ])
    k.prop(model, x, z, { y, quarter });

  dressPerimeter(k, {
    startX: -24,
    exitX: 20,
    step: 6,
    height: 14,
    sets,
  });

  // Światła: zielone i bursztynowe ostrzegawcze, zimna biel przy bramie.
  for (const [x, z, c] of [
    [-30, 14, COLOR.green],
    [0, 16, COLOR.amber],
    [30, 14, COLOR.green],
    [-20, 2, COLOR.amber],
    [0, 2, COLOR.green],
    [20, 2, COLOR.violet],
    [-30, -20, COLOR.green],
    [0, -28, COLOR.amber],
    [30, -22, COLOR.green],
    [-20, -44, COLOR.violet],
    [20, -44, COLOR.green],
    [-34, 30, COLOR.warm],
    [34, 30, COLOR.amber],
    [0, 40, COLOR.warm],
  ])
    k.light(x, 6, z, c, 20, 14);
  for (const [x, z, c] of [
    [-34, 52, COLOR.amber],
    [-10, 46, COLOR.green],
    [12, 52, COLOR.warm],
    [34, 50, COLOR.amber],
    [-36, 24, COLOR.warm],
    [36, 24, COLOR.green],
  ])
    k.lamp(x, z, c);
  for (const [x, z] of [
    [-24, 4],
    [24, 4],
    [-14, 34],
    [16, 34],
    [-4, -34],
    [-30, -22],
  ])
    k.fx('steam', x, 0.1, z, 1.2);
  for (const [x, y, z] of [
    [-16, 6, 12],
    [16, 6, 12],
    [0, 3.4, -6],
    [0, 7, -24],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-22, 3, 8],
    [22, 3, -12],
  ])
    k.fx('sparks', x, y, z);

  // Hazardy: toksyczne kałuże (cykliczne pole) i beczki chemikaliów.
  for (const [id, x, z, w, d] of [
    ['chem-puddle-a', -14, 4, 5, 3],
    ['chem-puddle-b', 14, 2, 5, 3],
    ['chem-puddle-c', -4, 30, 4, 3],
    ['chem-puddle-d', 22, -28, 5, 3],
    ['chem-wall-field', -36, -22, 2, 6],
  ])
    k.hazards.push({
      kind: 'electric_field',
      id,
      position: vec(x, 0.7, z),
      size: vec(w, 1.4, d),
      cycle: { onS: 2.5, offS: 3.5, offsetS: (x + 40) % 4 },
    });
  for (const [id, x, z] of [
    ['chem-west-a', -20, -2],
    ['chem-west-b', -17, -2],
    ['chem-west-c', -18.5, 0.5],
    ['chem-east-a', 18, 0],
    ['chem-east-b', 21, 0],
    ['chem-east-c', 19.5, 2.5],
  ])
    k.hazards.push({ kind: 'explosive_barrel', id, position: vec(x, 0, z) });
  for (const [x, z, w] of [
    [-14, 4, 5],
    [14, 2, 5],
    [-4, 30, 4],
    [22, -28, 5],
  ])
    k.decal('puddle2', x, 0.015, z, w + 1, w - 1, 0, 'floor', 0.9);
  for (const [tex, x, z, w] of [
    ['leak_streak', -28, 20, 3],
    ['oil_stain', 6, 24, 4],
    ['oil_stain', -6, -2, 4],
    ['crack_floor', 24, -4, 3],
    ['floor_hazard', 0, 8, 10],
    ['floor_hazard', 0, -14, 10],
    ['floor_arrow', 20, -48, 2],
    ['floor_stop', -24, 46, 3],
    ['manhole', 0, 38, 1.6],
    ['manhole', -20, -24, 1.6],
    ['puddle1', 10, 42, 5],
    ['puddle1', -10, -48, 5],
    ['tire_marks', -4, 50, 5],
  ])
    k.decal(
      tex,
      x,
      0.012,
      z,
      w,
      tex === 'floor_hazard' ? w * 0.12 : w * 0.6,
      0,
    );

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -24, 0, 46],
      ['C', 20, 0, -44],
    ],
    zones: [
      ['Brama i rampa cystern', R(-40, 40, 30, 55), 'open'],
      ['Pole zbiorników', R(-40, 40, 8, 30), 'dense'],
      ['Estakady i kładki', R(-40, 40, -30, 8), 'high'],
      ['Płuczka smogu', R(-40, 40, -55, -30), 'low'],
    ],
    maxAlive: 11,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 90 },
  });
  spawns(k, [
    [-34, 52],
    [-8, 50],
    [10, 44],
    [32, 52],
    [-30, 32],
    [-4, 34],
    [22, 30],
    [-34, 14],
    [-12, 18],
    [16, 14],
    [34, 12],
    [-34, 0],
    [-8, 2],
    [10, -2],
    [34, 0],
    [-20, -20],
    [4, -16],
    [26, -22],
    [-22, -40],
    [24, -44],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -24, z: 52, yaw: 0, pitch: 14 },
  { name: 'tanks', x: -30, z: 24, yaw: 20, pitch: 8 },
  { name: 'racks', x: 0, z: 18, yaw: 0, pitch: 12 },
  { name: 'catwalk', x: -20, z: -6, floorY: 3.6, yaw: 270, pitch: -4 },
  { name: 'scrubber', x: 0, z: -18, yaw: 0, pitch: 28 },
  { name: 'north', x: 16, z: -36, yaw: 200, pitch: 8 },
];
