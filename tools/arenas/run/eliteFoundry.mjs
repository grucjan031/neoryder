// Odlewnia (elite): hala pieców z żarem w paszczach, hałda żużla, kominy, kładki na 4,2 i 8,4 m nad halą,
// bramki laserowe i beczki. Landmark: kadź z ciepłą poświatą nad odlewnią (20 m). Pogoda: ashfall.
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
  const bounds = R(-45, 45, -50, 50);
  const k = createRunRoom({
    id: 'eliteFoundry',
    name: 'Odlewnia',
    type: 'elite',
    weather: 'ashfall',
    seed: 'run-foundry-v1',
    bounds,
    startX: -26,
    exitX: 24,
    wallMaterial: 'smog_soot_wall',
    wallHeights: [14, 19, 16, 22],
  });
  track(k);
  const { arena, p } = k;
  const sets = wallSets({
    neons: ['warsztat', 'repair', 'arrow'],
    colors: [COLOR.amber, COLOR.warm, COLOR.green],
    decals: ['graffiti_tag2', 'poster_torn2', 'sticker_cluster'],
    top: 6,
  });

  k.ground(R(-45, 45, 24, 50), 0, 'excavation_dirt');
  k.ground(R(-45, 45, -16, 24), 0, 'turbine_hall_floor');
  k.ground(R(-45, 45, -50, -16), 0, 'concrete');
  k.ground(R(-6, 6, -50, -33), 0, 'hazard_stripes_worn'); // kanał odlewniczy pod kadzią
  k.perimeter();

  tower(k, R(-45, -34, -50, -16), 14, sets, {
    sides: ['E', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(34, 45, -50, -14), 16, sets, {
    sides: ['W', 'S'],
    margin: 2,
    step: 5,
  });
  tower(k, R(-45, -34, 34, 50), 8, sets, {
    sides: ['N', 'E'],
    margin: 2,
    step: 5,
  });
  tower(k, R(34, 45, 36, 50), 8, sets, {
    sides: ['N', 'W'],
    margin: 2,
    step: 5,
  });

  // Kładki: A (4,2 m) nad halą, B (8,4 m) przed odlewnią; rampy o spadku 0,32.
  const GA = R(-36, 36, -13, -8);
  const GB = R(-14, 14, -31, -26);
  p.floor(GA, 4.2, 'steel_grating', { thickness: 0.4 });
  p.floor(GB, 8.4, 'steel_grating', { thickness: 0.4 });
  for (const x of [-35.4, -24, -12, 0, 12, 24, 35.4])
    for (const z of [-12.6, -8.4])
      k.solid(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), 0, 3.8, 'metal');
  for (const x of [-13.4, 0, 13.4])
    for (const z of [-30.6, -26.4])
      k.solid(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), 0, 8, 'metal');
  const rail = (a, b, openings) =>
    p.wall(a, b, 1.1, 0.12, 'metal', openings ? { openings } : {});
  rail(vec(-36, 4.2, -13), vec(36, 4.2, -13), [
    { at: 36, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-36, 4.2, -8), vec(36, 4.2, -8), [
    { at: 6, width: 3.4, height: 1.1 },
    { at: 66, width: 3.4, height: 1.1 },
  ]);
  rail(vec(-36, 4.2, -13), vec(-36, 4.2, -8));
  rail(vec(36, 4.2, -13), vec(36, 4.2, -8));
  rail(vec(-14, 8.4, -31), vec(14, 8.4, -31));
  rail(vec(-14, 8.4, -31), vec(-14, 8.4, -26));
  rail(vec(14, 8.4, -31), vec(14, 8.4, -26));
  rail(vec(-14, 8.4, -26), vec(-1.7, 8.4, -26));
  rail(vec(1.7, 8.4, -26), vec(14, 8.4, -26));
  k.ramp(vec(-30, 4.2, -8), vec(-30, 0, 5), 3, 'metal');
  k.ramp(vec(30, 4.2, -8), vec(30, 0, 5), 3, 'metal');
  k.ramp(vec(0, 8.4, -26), vec(0, 4.2, -13), 3, 'metal');

  // Landmark: kadź (model zbiornika, skala 4: 12 × 20 × 12 m) z ciepłą poświatą.
  arena.decor('city_roof_water_tank', vec(0, 0, -42), 0, { scale: 4 });
  k.solid(R(-6, 6, -48, -36), 0, 10, 'metal', { visible: false });
  k.reserve(R(-6, 6, -48, -36));
  for (const [x, y, z, c, i] of [
    [0, 14, -42, COLOR.warm, 90],
    [0, 6, -33, COLOR.amber, 70],
    [-9, 10, -40, COLOR.amber, 50],
    [9, 10, -40, COLOR.amber, 50],
    [0, 24, -42, COLOR.amber, 60],
  ])
    k.light(x, y, z, c, i, 40);

  // Piece: bryły z paszczą żarzącą się (neon_amber) od strony kładki; komin na każdym.
  const furnaces = [
    [-30, 10],
    [-10, 16],
    [12, 8],
    [32, 16],
    [-18, -2],
  ];
  for (const [x, z] of furnaces) {
    const r = R(x - 4, x + 4, z - 4, z + 4);
    k.mass(r, 7, 'rust');
    k.solid(R(x - 2, x + 2, z - 4.3, z - 4), 0.8, 3.2, 'neon_amber');
    k.light(x, 2, z - 6, COLOR.amber, 40, 14);
    arena.decor('power_chimney', vec(x, 7, z), 0, { scale: 0.45 });
    k.faceNeon(r, 'S', 4, 5.4, 'warsztat', 3, 1.5, COLOR.warm, 0.4);
  }
  // Hałda żużla przy bramie wsadu.
  arena.decor('power_slag_heap', vec(-34, 0, 22), 0, { scale: 0.7 });
  k.solid(R(-40, -28, 16, 28), 0, 3, 'rust', { visible: false });
  k.reserve(R(-40, -28, 16, 28));

  const base = [
    'city_barrier',
    'city_generator',
    'city_crates',
    'city_dumpster',
    'build_pipe_stack',
    'build_rebar_bundle',
    'build_precast_stack',
    'port_container_20_ochre',
    'port_container_20_graphite',
    'city_wrecked_car',
    'city_vending',
    'city_highway_barrier',
  ];
  scatter(k, base, R(-42, 42, 26, 49), {
    count: 16,
    clear: 3.2,
    avoid: [R(-30, -22, 44, 50)],
  });
  scatter(k, base, R(-42, 42, -14, 24), { count: 16, clear: 3.2 });
  scatter(k, base, R(-32, 32, -50, -16), {
    count: 14,
    clear: 3.2,
    avoid: [R(-16, 16, -50, -26)],
  });
  for (const [model, x, z, y, quarter] of [
    ['city_crates', -26, -10, 4.2, 0],
    ['city_generator', 12, -11, 4.2, 0],
    ['city_barrier', 26, -10, 4.2, 0],
    ['city_roof_hvac_unit', -10, -28, 8.4, 0],
  ])
    k.prop(model, x, z, { y, quarter });
  for (const [x, z] of [
    [-12, 30],
    [4, 34],
    [24, 30],
    [-38, 4],
    [38, 4],
    [-26, -22],
    [20, -24],
    [-4, 22],
  ])
    k.prop('hw_fire_barrel', x, z, {});

  dressPerimeter(k, { startX: -26, exitX: 24, step: 6, height: 14, sets });

  for (const [x, z, c] of [
    [-34, 30, COLOR.amber],
    [0, 40, COLOR.warm],
    [34, 30, COLOR.amber],
    [-38, 4, COLOR.amber],
    [-20, 8, COLOR.warm],
    [0, 4, COLOR.amber],
    [22, 20, COLOR.green],
    [38, 4, COLOR.amber],
    [-26, -22, COLOR.warm],
    [26, -22, COLOR.amber],
    [-8, -40, COLOR.violet],
    [14, -44, COLOR.warm],
  ])
    k.light(x, 6, z, c, 22, 15);
  for (const [x, z, c] of [
    [-38, 46, COLOR.amber],
    [-10, 44, COLOR.green],
    [14, 46, COLOR.warm],
    [38, 30, COLOR.amber],
    [-4, 26, COLOR.amber],
  ])
    k.lamp(x, z, c);
  for (const [x, z] of [
    [-12, 22],
    [14, 22],
    [-40, -4],
    [40, 6],
    [-20, -40],
    [24, -38],
  ])
    k.fx('steam', x, 0.1, z, 1.2);
  for (const [x, y, z] of [
    [-30, 4, 4],
    [12, 4, 2],
    [-10, 4, 10],
    [32, 4, 10],
    [0, 12, -40],
  ])
    k.fx('sparks', x, y, z, 0.7);
  for (const [x, y, z] of [
    [-20, 6, 18],
    [20, 6, -6],
  ])
    k.fx('drip', x, y, z);

  // Hazardy: bramki laserowe na torze wsadu i beczki z olejem.
  k.hazards.push(
    {
      kind: 'laser_gate',
      id: 'foundry-front',
      from: vec(-3.5, 0.7, 28),
      to: vec(3.5, 0.7, 28),
      cycle: { onS: 2, offS: 3 },
    },
    {
      kind: 'laser_gate',
      id: 'foundry-back',
      from: vec(-3.5, 0.7, -20),
      to: vec(3.5, 0.7, -20),
      cycle: { onS: 2, offS: 3, offsetS: 2.5 },
    },
    {
      kind: 'laser_gate',
      id: 'foundry-casting',
      from: vec(-5, 0.7, -34),
      to: vec(5, 0.7, -34),
      cycle: { onS: 2, offS: 3, offsetS: 1 },
    },
    { kind: 'explosive_barrel', id: 'foundry-west', position: vec(-6, 0, 2) },
    { kind: 'explosive_barrel', id: 'foundry-east', position: vec(6, 0, 2) },
  );
  for (const [tex, x, z, w] of [
    ['oil_stain', -2, 14, 4],
    ['oil_stain', 20, -4, 4],
    ['crack_floor', -4, -22, 4],
    ['crack_floor', 28, 30, 3],
    ['leak_streak', -36, -20, 3],
    ['floor_arrow', 24, -46, 2],
    ['floor_stop', -26, 44, 3],
    ['tire_marks', 0, 44, 5],
    ['manhole', 6, 12, 1.6],
    ['manhole', -14, -20, 1.6],
    ['puddle1', 10, 30, 5],
    ['puddle2', -20, 36, 5],
    ['puddle1', 16, -40, 5],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);
  for (const [x, z] of [
    [0, 28],
    [0, -20],
    [0, -34],
  ])
    k.decal('floor_hazard', x, 0.013, z, 8, 1, 0);

  k.finish({
    points: [
      ['A', 0, 0, 2],
      ['B', -26, 0, 44],
      ['C', 24, 0, -44],
    ],
    zones: [
      ['Dziedziniec wsadu', R(-45, 45, 24, 50), 'open'],
      ['Hala pieców', R(-45, 45, -16, 24), 'dense'],
      ['Kładki', R(-45, 45, -31, -8), 'high'],
      ['Odlewnia pod kadzią', R(-45, 45, -50, -16), 'low'],
    ],
    maxAlive: 12,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 95 },
  });
  spawns(k, [
    [-36, 44],
    [-12, 46],
    [8, 40],
    [30, 44],
    [-24, 30],
    [4, 28],
    [36, 28],
    [-40, 12],
    [-20, 18],
    [0, 12],
    [22, 14],
    [40, 4],
    [-24, -4],
    [-4, -6],
    [20, -2],
    [-28, -22],
    [14, -20],
    [30, -26],
    [-20, -42],
    [22, -44],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -26, z: 46, yaw: 0, pitch: 12 },
  { name: 'furnaces', x: -4, z: 24, yaw: 10, pitch: 8 },
  { name: 'hall', x: 20, z: 2, yaw: 90, pitch: 10 },
  { name: 'catwalk', x: -24, z: -10, floorY: 4.2, yaw: 270, pitch: -4 },
  { name: 'ladle', x: 0, z: -18, yaw: 0, pitch: 22 },
  { name: 'cast', x: 14, z: -40, yaw: 150, pitch: 10 },
];
