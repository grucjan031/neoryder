// Generowanie: node tools/arenas/run/run2.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

const reception = R(-26, 10, 22, 36);
const treatment = R(-26, -6, -22, 22);
const market = R(-6, 30, -22, 22);
const terrace = R(-26, 30, -36, -22);
const grating = 'steel_grating';
const along = (axis, at, a, b, depth) =>
  axis === 'x'
    ? R(a, b, at - depth / 2, at + depth / 2)
    : R(at - depth / 2, at + depth / 2, a, b);

// Przedziały otworów podają światło między słupkami i wysokość od posadzki.
function wall(k, axis, at, start, end, height, openings = []) {
  const part = (a, b, lo, hi, mat, model) => {
    if (a < b && lo < hi)
      k.solid(along(axis, at, a, b, 0.5), lo, hi, mat, model ? { model } : {});
  };
  let cursor = start;
  for (const [a, b, sill, head] of openings) {
    part(cursor, a - 0.15, 0, height, 'tiles_wall', 'wall_segment');
    part(a - 0.15, a, 0, height, 'trim');
    part(b, b + 0.15, 0, height, 'trim');
    part(a, b, 0, sill, 'tiles_wall');
    part(a, b, head, head + 0.15, 'trim');
    part(a, b, head + 0.15, height, 'tiles_wall', 'wall_segment');
    cursor = b + 0.15;
  }
  part(cursor, end, 0, height, 'tiles_wall', 'wall_segment');
}

function shelter(k, rect, top) {
  k.rainShelters.push({
    position: vec(
      (rect.minX + rect.maxX) / 2,
      (top - 0.2) / 2,
      (rect.minZ + rect.maxZ) / 2,
    ),
    size: vec(rect.maxX - rect.minX, top + 0.2, rect.maxZ - rect.minZ),
  });
}

function roof(k, rect, h) {
  k.solid(rect, h, h + 0.4, 'concrete', { ceiling: true });
  shelter(k, rect, h);
}

function box(k, x, z, w, h, d, base = 0, mat = 'metal', opts = {}) {
  return k.solid(
    R(x - w / 2, x + w / 2, z - d / 2, z + d / 2),
    base,
    base + h,
    mat,
    opts,
  );
}

function rail(k, axis, at, a, b, y, endY = y) {
  const slope = Math.atan2(endY - y, b - a);
  const opts = slope
    ? { rotation: axis === 'x' ? vec(0, 0, slope) : vec(-slope, 0, 0) }
    : {};
  const span = Math.hypot(b - a, endY - y);
  const rect = along(axis, at, (a + b - span) / 2, (a + b + span) / 2, 0.09);
  const midY = (y + endY) / 2;
  k.solid(rect, midY + 1, midY + 1.09, 'trim', opts);
  k.solid(rect, midY + 0.45, midY + 0.5, 'metal', opts);
  k.solid(rect, midY, midY + 1.05, 'metal', { ...opts, visible: false });
  const bays = Math.ceil((b - a) / 3);
  for (let i = 0; i <= bays; i++) {
    const t = (0.05 + ((b - a - 0.1) * i) / bays) / (b - a);
    const pos = a + (b - a) * t;
    k.solid(
      along(axis, at, pos - 0.04, pos + 0.04, 0.09),
      y + (endY - y) * t,
      y + (endY - y) * t + 1,
      'metal',
    );
  }
}

function deck(k, rect, y) {
  k.solid(rect, y - 0.25, y, grating, { walkable: true });
}

function flight(k, axis, at, a, b, low, high, width, stairs = false) {
  const point = (s, y) => (axis === 'x' ? vec(s, y, at) : vec(at, y, s));
  const from = point(a, low),
    to = point(b, high);
  k.p.ramp({ from, to, width, material: stairs ? 'tread_plate' : grating });
  // Ryflowany pas dla wózków i AI między dwoma rzędami stopni.
  if (stairs)
    for (const offset of [-1.1, 1.1]) {
      k.p.stairs({
        from: { ...from, z: from.z + offset },
        to: { ...to, z: to.z + offset },
        width: 0.8,
        walkable: false,
        material: 'metal',
      });
    }
  for (const side of [-1, 1])
    rail(k, axis, at + (side * width) / 2, a, b, low, high);
}

function clinic(k) {
  k.ground(R(-21, -17, 36, 37), 0, 'gas_station_tiles', { thickness: 1 });
  roof(k, reception, 5.2);
  roof(k, treatment, 6.4);
  wall(k, 'x', 36.5, -26.5, 10.5, 5.2, [[-21, -17, 0, 3]]);
  wall(k, 'z', 10.25, 22, 36.25, 5.2);
  wall(k, 'z', -26.25, 22, 36.25, 5.2);
  wall(k, 'z', -26.25, -22, 22, 6.4);
  wall(k, 'x', 22, -26, 10, 5.2, [
    [-22, -18, 0, 3.3],
    [2, 6, 0, 3.3],
  ]);
  wall(k, 'z', -6, -22, 22, 6.4, [
    [-2, 2, 3.2, 6.2],
    [5, 9, 0, 3.3],
  ]);
  wall(k, 'x', -22, -26, -6, 6.4, [
    [-22, -18, 0, 3.3],
    [-12, -8, 3.2, 5.9],
  ]);
  shelter(k, R(-12, -8, -22.25, -22), 6.4);
  shelter(k, R(-6, -5.75, -2, 2), 6.4);

  deck(k, R(-15, -7, 23, 29.5), 2.6);
  flight(k, 'x', 28, -23, -15, 0, 2.6, 3);
  for (const z of [23, 29.5]) {
    k.solid(along('x', z, -15, -7, 0.12), 2.6, 3.45, 'metal');
    k.solid(along('x', z, -15, -7, 0.12), 3.45, 5.2, 'glass');
  }
  rail(k, 'z', -7, 23, 29.5, 2.6);
  rail(k, 'z', -15, 23, 26.5, 2.6);
  for (const x of [-14.8, -7.2])
    for (const z of [23.2, 29.3]) box(k, x, z, 0.25, 2.35, 0.25);
  // C2: bw_reception_counter
  box(k, -10, 26, 4, 1.15, 0.95);
  box(k, -8.475, 28.475, 0.95, 1.15, 4);
  // C2: bw_waiting_seats
  for (const z of [30.5, 33.5])
    for (const x of [-5, 0]) box(k, x, z, 2.8, 0.95, 0.75);
  // C2: bw_entry_scanner
  for (const x of [2.3, 5.7]) box(k, x, 25, 0.4, 2.85, 0.8);
  box(k, 4, 25, 3.8, 0.25, 0.8, 2.85);
  k.prop('city_vending', 8.8, 28);
  k.arena.block({
    position: vec(-12, 0.25, 32),
    size: vec(0.5, 0.5, 0.5),
    model: 'crate_small',
  });

  deck(k, R(-12, -8, -22, 2), 3.2);
  deck(k, R(-8, -6, -1.5, 1.5), 3.2);
  flight(k, 'z', -10, 2, 12, 3.2, 0, 3);
  rail(k, 'z', -12, -22, 2, 3.2);
  rail(k, 'z', -8, -22, -1.5, 3.2);
  rail(k, 'z', -8, 1.5, 2, 3.2);
  for (const z of [-1.5, 1.5]) rail(k, 'x', z, -8, -6, 3.2);
  for (const z of [-18, -9, 1]) box(k, -11.7, z, 0.35, 2.95, 0.35);
  // C2: bw_treatment_screen
  for (const z of [-10, 1, 15])
    for (const [x, side] of [
      [-20, -1],
      [-10, 1],
    ]) {
      box(k, x + side * 1.47, z, 0.14, 1.55, 2.8);
      for (const dz of [-1.33, 1.33]) box(k, x, z + dz, 2.8, 1.55, 0.14);
      // C2: bw_treatment_bed
      box(k, x, z, 0.85, 1.05, 2);
    }
  // C2: bw_sample_fridge
  for (const x of [-19, -17.4, -15.8]) box(k, x, -15.5, 1.2, 2.15, 0.95);
  box(k, -19.55, -17.5, 0.45, 2.4, 3);
  box(k, -17, 5, 1.2, 1.8, 0.75);
}

function bazaar(k) {
  wall(k, 'x', 22, 10, 30, 3.8);
  rail(k, 'z', 29.9, -22, 22, 0);
  wall(k, 'x', -22, -6, 30, 7, [
    [15, 19, 3.65, 6.65],
    [23, 27, 0, 3.3],
  ]);
  for (const x of [-1, 11, 23]) {
    roof(k, R(x - 5, x + 5, -22, 22), 10);
    for (const z of [-19.5, 19.5]) {
      box(k, x, z, 2.5, 10, 2.513, 0, 'concrete', {
        model: 'city_overpass_pillar',
        instance: true,
      });
      for (const offset of [-3.125, 3.125])
        box(k, x + offset, z, 3.75, 0.4, 0.6, 9.6, 'metal', { ceiling: true });
    }
  }
  const models = [
    'city_stall',
    'city_market_stall_canopy',
    'city_market_stall_canopy_violet',
  ];
  for (const [row, x] of [-1, 9, 24].entries()) {
    for (const [i, z] of [-13, -5, 6, 13].entries())
      k.prop(models[(row + i) % 3], x, z);
    k.prop('city_kiosk', x + 2, 6);
    k.prop('city_crates', x + 2, -12);
  }
  k.neon('ramen', -1, 2.05, 7.025, 1.5, 0.5, 0, COLOR.amber);
  box(k, -3, 7, 0.25, 2.4, 3.2);
  flight(k, 'x', 0, -6, -2, 3.2, 4, 3);
  deck(k, R(-2, 15, -1.5, 1.5), 4);
  shelter(k, R(-2, 15, -1.5, 1.5), 3.75);
  rail(k, 'x', 1.5, -2, 15, 4);
  rail(k, 'x', -1.5, -2, 3.5, 4);
  rail(k, 'x', -1.5, 6.5, 15, 4);
  flight(k, 'z', 5, -12, -1.5, 0, 4, 3);
  deck(k, R(15, 19, -22, 6), 4);
  rail(k, 'z', 15, -22, -1.5, 4);
  rail(k, 'z', 15, 1.5, 6, 4);
  rail(k, 'z', 19, -22, 6, 4);
  flight(k, 'z', 17, 6, 18, 4, 0, 4);
  for (const [x, z] of [
    [-1, 1.25],
    [10, 1.25],
    [17, -20],
    [17, -9],
    [17, 5],
  ]) {
    box(k, x, z, 0.32, 3.5, 0.32);
    box(k, x, z, 1.2, 0.25, 0.5, 3.5);
  }
}

function overlook(k) {
  deck(k, R(-12, 19, -30, -26), 3.2);
  deck(k, R(-12, -8, -26, -22), 3.2);
  shelter(k, R(-12, 19, -30, -26), 2.95);
  shelter(k, R(-12, -8, -26, -22), 2.95);
  flight(k, 'z', 17, -26, -22, 3.2, 4, 4);
  flight(k, 'x', -28, 19, 27, 3.2, 0, 3, true);
  for (const x of [-12, -8]) rail(k, 'z', x, -26, -22, 3.2);
  rail(k, 'z', -12, -30, -26, 3.2);
  rail(k, 'x', -30, -12, 19, 3.2);
  rail(k, 'x', -26, -8, 15, 3.2);
  for (const x of [-11, 0, 10, 18]) box(k, x, -29.5, 0.4, 2.95, 0.4);
  rail(k, 'z', -25.9, -36, -22, 0);
  rail(k, 'z', 29.9, -36, -22, 0);
  for (const [a, b] of [
    [-26, 6.5],
    [11.5, 30],
  ]) {
    rail(k, 'x', -36, a, b, 0);
    k.solid(R(a, b, -36.5, -36), -5, 0, 'concrete');
    k.solid(R(a, b, -38, -36), -5.4, -5, 'concrete');
    k.solid(R(a, b, -38, -37.5), -10, -5.4, 'facade');
    k.solid(R(a, b, -39, -37.5), -10.4, -10, 'concrete');
    for (let x = a + 2; x < b - 1; x += 5) {
      box(k, x, -36.55, 1.6, 0.75, 0.12, -3, 'glass');
      box(k, x, -38, 0.5, 4.6, 0.6, -10, 'metal');
    }
  }
  // C2: bw_freight_lift_frame
  k.ground(R(7, 11, -37, -36), 0, 'tread_plate', { thickness: 1 });
  for (const x of [6.75, 11.25]) box(k, x, -36.5, 0.5, 3, 1.1);
  box(k, 9, -36.5, 5, 1.2, 1.1, 3);
  for (const [x, z] of [
    [-5, -32],
    [2.8, -32],
    [0, -24],
    [7, -24],
  ]) {
    box(k, x, z, 1.5, 0.65, 1.5);
    k.deco('city_holo_projector', x, 0.65, z);
    box(k, x, z - 0.85, 1.8, 1.2, 0.2);
    k.light(x, 0.93, z, COLOR.violet, 9, 7, { floorY: 0.65 });
  }
  box(k, -17, -33, 3, 2.1, 1);
  for (const x of [-18.6, -15.4]) box(k, x, -31, 0.2, 0.5, 0.6);
  k.hazards.push({
    id: 'bulwar-switchboard',
    kind: 'electric_field',
    position: vec(-17, 1, -31),
    size: vec(3, 2, 2),
    cycle: { onS: 3, offS: 2.5 },
  });
  k.decal('floor_hazard', -17, 0, -31, 3, 2);
  k.prop('city_crates', 21.5, -33);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run2',
    name: 'Bulwar — przychodnia Helixa Dynamics',
    weather: 'bulwarNightMarket',
    bounds: R(-26, 30, -36, 36),
    startX: -19,
    exitX: 9,
  });
  for (const [area, mat] of [
    [reception, 'gas_station_tiles'],
    [treatment, 'rubber'],
    [market, 'highway_asphalt_worn'],
    [terrace, 'quay_concrete'],
  ])
    k.ground(area, 0, mat, { thickness: 1 });
  clinic(k);
  bazaar(k);
  overlook(k);
  for (const [x, roofY, z, floorY, color] of [
    [-19, 5.2, 32, 0, COLOR.warm],
    [-11, 5.2, 30.5, 0, COLOR.warm],
    [4, 5.2, 24, 0, COLOR.green],
    [-16, 6.4, 12, 0, COLOR.blue],
    [-10, 6.4, -12, 3.2, COLOR.warm],
    [-18, 6.4, -18, 0, COLOR.blue],
    [-1, 10, 8, 0, COLOR.amber],
    [11, 10, -8, 0, COLOR.amber],
    [19, 10, 0, 4, COLOR.warm],
  ]) {
    k.deco('wh_ceiling_lamp', x, roofY - 0.45, z);
    k.light(x, roofY - 0.45, z, color, 26, 16, { floorY });
  }
  const spawns = [
    [-23, 25],
    [-9, 33],
    [7, 26],
    [-23, 14],
    [-15, 7],
    [-22, -7],
    [-14, -18],
    [-3, 16],
    [12, 13],
    [26, 9],
    [0, -7],
    [12, -16],
    [27, -16],
    [-22, -27],
    [1, -32],
    [24, -33],
  ];
  for (const [x, z] of spawns) k.arena.spawn(vec(x, 0, z));
  k.arena.roomMeta({
    playerSpawn: vec(-19, 0, 32),
    doors: [
      ['entry', -19, 36.5],
      ['exit', 9, -36.5],
    ].map(([role, x, z]) => ({
      id: role,
      role,
      position: vec(x, 1.5, z),
      size: vec(4, 3, 1),
    })),
  });
  k.finish({
    points: [
      ['A', -15, 0, 7],
      ['B', 12, 0, 13],
      ['C', 1, 0, -32],
    ],
    zones: [
      ['Rejestracja', reception, 'interior'],
      ['Zabiegowe', treatment, 'interior'],
      ['Targ', market, 'dense'],
      ['Taras', terrace, 'high'],
    ],
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 22 },
  });
  k.arena.arenaMeta({ navigationCellM: 0.5, navigationClearanceM: 0.4 });
  return k.arena;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generate().write(
    fileURLToPath(
      new URL('../../../src/data/rooms/run2.json', import.meta.url),
    ),
  );
