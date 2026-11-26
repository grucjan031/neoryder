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

// Bryły z obrotem ćwierćobrotu mają proxy w osiach świata.
function furnishing(k, model, x, z, w, h, d, turn = false) {
  if (!turn)
    return box(k, x, z, w, h, d, 0, 'metal', { model, instance: true });
  k.deco(model, x, 0, z, Math.PI / 2);
  return box(k, x, z, d, h, w, 0, 'metal', { visible: false });
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
  furnishing(k, 'bw_reception_counter', -20.6, 30.05, 4, 1.15, 0.95);
  furnishing(k, 'bw_reception_counter', -23.075, 31.575, 4, 1.15, 0.95, true);
  k.deco('city_holo_projector', -20.5, 1.15, 30.05);
  k.holo('holo_helixa', -20.5, 2.05, 30.05, 1.65, 1.05, 0, '#273cc0');
  for (const z of [25, 27, 29, 31, 33.5])
    for (const x of [-5, -1.5])
      furnishing(k, 'bw_waiting_seats', x, z, 2.8, 0.95, 0.75);
  furnishing(k, 'bw_waiting_seats', -16.7, 29.98, 2.8, 0.95, 0.75);
  k.deco('bw_entry_scanner', -19, 0, 35.2);
  for (const x of [-20.7, -17.3])
    box(k, x, 35.2, 0.4, 2.85, 0.8, 0, 'metal', { visible: false });
  box(k, -19, 35.2, 3.8, 0.25, 0.8, 2.85, 'metal', { visible: false });
  for (const z of [28, 30]) k.prop('city_vending', 8.8, z);
  k.deco('wh_wall_terminal', -26, 1.2, 29, Math.PI / 2);
  box(k, -9.4, 24.2, 2.4, 0.12, 1, 3.33);
  for (const x of [-10.4, -8.4]) box(k, x, 24.2, 0.18, 0.73, 0.85, 2.6);
  for (const x of [-24.8, 7.9]) {
    box(k, x, 34.6, 0.55, 0.72, 0.55, 0, 'trim');
    box(k, x, 34.6, 0.42, 0.02, 0.42, 0.72, 'rubber');
  }
  for (const x of [-20, 4])
    k.neon('arrow', x, 3.68, 22.26, 1, 0.45, 0, COLOR.green);
  for (const x of [-13, -7.3, 1.6])
    k.decal('floor_lane_line', x, 0, 32, 0.32, 6);
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
  for (const [i, z] of [-10, 1, 15].entries()) {
    for (const [j, x] of [-20, -11.5].entries()) {
      const side = j ? 1 : -1;
      const rear = x + side * 1.47;
      for (const dz of [-1.33, 1.33]) {
        box(k, x, z + dz, 2.8, 0.32, 0.14, 0, 'plaster');
        k.deco('bw_treatment_screen', x, 0.32, z + dz);
        box(k, x, z + dz, 2.8, 1.55, 0.14, 0.32, 'metal', { visible: false });
      }
      box(k, rear, z, 0.14, 0.32, 2.8, 0, 'plaster');
      k.deco('bw_treatment_screen', rear, 0.32, z, Math.PI / 2);
      box(k, rear, z, 0.14, 1.55, 2.8, 0.32, 'metal', { visible: false });
      k.deco('bw_treatment_bed', x, 0, z);
      box(k, x, z, 0.85, 1.05, 2, 0, 'metal', { visible: false });
      const cart = x + side * 0.94;
      box(k, cart, z - 0.6, 0.54, 0.78, 0.6, 0, 'plaster');
      box(k, cart, z - 0.6, 0.61, 0.05, 0.66, 0.78, 'trim');
      box(k, cart, z - 0.82, 0.035, 0.97, 0.035, 0.83);
      box(k, cart, z - 0.73, 0.035, 0.035, 0.2, 1.77);
      box(k, cart, z - 0.65, 0.12, 0.23, 0.07, 1.54, 'plastic');
      box(k, rear, z, 0.08, 0.58, 0.08, 1.87);
      box(k, (x + rear) / 2, z, 1.53, 0.08, 0.08, 2.41);
      box(k, x, z, 0.65, 0.11, 0.41, 2.3, 'plaster');
      box(k, x, z, 0.55, 0.025, 0.33, 2.275, 'light_white');
      if ((i + j) % 2 === 0)
        k.light(x, 2.25, z, COLOR.warm, 6, 5, { floorY: 0 });
      // Tabliczka na bliższym narożniku, cyfrę czyta się od strony korytarza.
      const face = x - side * 1.41;
      box(k, face, z + 1.33, 0.09, 0.6, 0.52, 1.44, 'trim');
      const segments = ['bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgecd'][
        2 * i + j
      ];
      for (const [segment, dz, y, horizontal] of [
        ['a', 0, 1.95, true],
        ['b', 0.12, 1.85, false],
        ['c', 0.12, 1.64, false],
        ['d', 0, 1.54, true],
        ['e', -0.12, 1.64, false],
        ['f', -0.12, 1.85, false],
        ['g', 0, 1.745, true],
      ])
        if (segments.includes(segment))
          box(
            k,
            face - side * 0.05,
            z + 1.33 + side * dz,
            0.02,
            horizontal ? 0.035 : 0.18,
            horizontal ? 0.24 : 0.035,
            y,
            'neon_green',
          );
    }
  }
  for (const x of [-19, -17.4, -15.8])
    furnishing(k, 'bw_sample_fridge', x, -15.5, 1.2, 2.15, 0.95);
  box(k, -17.5, -14.7, 5.4, 0.52, 0.12, 0, 'trim');
  for (const x of [-20.13, -18.2, -16.6, -14.87])
    box(k, x, -14.7, 0.08, 1.8, 0.12, 0.52, 'trim');
  box(k, -17.5, -14.7, 5.4, 0.09, 0.12, 2.32, 'trim');
  box(k, -14.5, -16.3, 0.8, 0.04, 2.8, 0, 'tread_plate');
  k.decal('floor_arrow', -15, 0, -11, 0.45, 0.85);
  k.decal('floor_arrow', -11.8, 0, 31, 0.4, 0.8);
  k.deco('city_pipe_run', -11.68, 0, -9, 0, 0.47);
  k.deco('city_vent_grate', -25.4, 0, -11.5);
  box(k, -19.55, -17.5, 0.45, 2.4, 3);
  box(k, -17, 5, 0.6, 0.14, 0.9, 0.74, 'plaster');
  box(k, -17, 5, 0.55, 0.07, 0.84, 0.19);
  for (const dx of [-0.23, 0.23])
    for (const dz of [-0.37, 0.37]) box(k, -17 + dx, 5 + dz, 0.07, 0.74, 0.07);
  for (const z of [-18, -12, -6, 0, 6, 12, 18])
    k.deco('city_door', -25.99, 0, z, Math.PI / 2);
  for (const z of [-15, 3, 15]) {
    k.neon('pharmacy', -25.95, 2.08, z, 1.2, 0.48, Math.PI / 2, COLOR.green, 0);
    box(k, -25.9, z, 0.16, 0.68, 1.12, 3.45, 'trim');
    for (let n = 0; n < 5; n++)
      box(k, -25.79, z, 0.1, 0.055, 0.97, 3.51 + n * 0.12, 'metal');
  }
  k.deco('city_pipe_run', -25.98, 0, -9, Math.PI / 2);
  box(k, -25.8, 9, 0.38, 0.76, 0.56, 0.83, 'container_ochre');
  furnishing(k, 'bw_waiting_seats', -25.1, -3, 2.8, 0.95, 0.75, true);
  for (const z of [-19, -13, -7, -1]) {
    box(k, -10, z, 3.9, 0.16, 0.23, 2.79);
    box(k, -10, z, 1.7, 0.05, 0.16, 2.74, 'light_white');
  }
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
  const modules = [
    'city_stall',
    'city_market_stall_canopy',
    'city_kiosk',
    'city_market_stall_canopy_violet',
  ];
  for (const [row, x] of [-1, 9, 24].entries()) {
    for (const [i, z] of [-15.3, -11.9, -8.5, -5.1, 5.1, 8.5, 11.9].entries()) {
      const side = (i + row) % 3 ? 1 : -1;
      const yaw = (side * Math.PI) / 2;
      const model = modules[(i + row) % modules.length];
      k.prop(model, x, z, { quarter: side });
      const front = model === 'city_kiosk' ? 0.34 : 1.04;
      k.neon(
        ['ramen', 'noodles', 'open', 'kebab'][(i + row) % 4],
        x + side * front,
        2.04,
        z,
        model === 'city_kiosk' ? 0.72 : 1.55,
        0.42,
        yaw,
        (i + row) % 2 ? '#4536ac' : '#374caa',
        0.04,
      );
      const counter = x + side * (front + 0.35);
      box(k, counter, z, 0.7, 0.83, 2.4, 0, 'wood');
      for (const dz of [-0.66, 0.1, 0.76]) {
        box(k, counter, z + dz, 0.55, 0.12, 0.58, 0.83, 'container_olive');
        k.deco('city_trash_bags', counter, 0.95, z + dz, i, 0.34);
      }
      if (i === 1 || i === 5) {
        k.prop('city_crates', x - side * 1.75, z);
        k.deco('city_trash_bags', x - side * 1.72, 0, z + 1.12, 0.8, 0.85);
      }
      if (i === 0 || i === 4) {
        const table = x + side * 2.8;
        box(k, table, z, 0.9, 0.09, 1.25, 0.75, 'plastic');
        box(k, table, z, 0.21, 0.75, 0.6, 0, 'trim');
        for (const dz of [-0.96, 0.96]) {
          box(k, table, z + dz, 0.41, 0.08, 0.41, 0.38, 'plastic');
          box(k, table, z + dz, 0.29, 0.38, 0.29, 0, 'trim');
        }
      }
    }
  }
  // Lady wydawcze na końcach dwóch połówek rzędu, od strony drogi dostaw.
  for (const side of [-1, 1]) {
    const z = side * 3.54;
    for (const x of [-0.55, 1.7]) {
      box(k, x, z, 2.21, 0.82, 0.92, 0, 'container_olive');
      box(k, x, z, 2.24, 0.08, 0.99, 0.82, 'wood');
      for (const dx of [-0.68, 0, 0.68]) {
        box(k, x + dx, z, 0.61, 0.23, 0.67, 0.9, 'plastic');
        k.deco('city_trash_bags', x + dx, 1.13, z, side, 0.46);
      }
    }
    box(k, 3.27, z, 0.82, 1.05, 0.86, 0, 'wood');
    box(k, 3.27, z, 0.84, 0.07, 0.88, 1.05, 'trim');
    k.deco('wh_wall_terminal', 3.27, 1.12, z, side < 0 ? 0 : Math.PI, 0.55);
  }
  // Automat apteczny i panel informacji na zewnętrznej ścianie kliniki.
  // Drzwi serwisowe pod oknem galerii, widoczne z poprzecznej alei.
  k.deco('city_door', -5.74, 0, 0.22, Math.PI / 2);
  k.neon(
    'pharmacy',
    -5.72,
    2.74,
    0.22,
    1.45,
    0.43,
    Math.PI / 2,
    COLOR.green,
    0,
  );
  k.deco('city_pipe_run', -5.74, 0, 3.48, Math.PI / 2, 0.78);
  k.prop('city_vending', -5.25, -3.82, { quarter: 1 });
  k.deco('wh_wall_terminal', -5.73, 1.1, -5.05, Math.PI / 2);
  k.neon(
    'pharmacy',
    -5.73,
    2.61,
    -4.18,
    1.52,
    0.49,
    Math.PI / 2,
    COLOR.green,
    0,
  );
  k.prop('city_vending', 25, 17.4);
  k.prop('city_generator', 26.7, 16);
  k.prop('city_dumpster', -3.7, -18);
  for (const x of [0.8, 10.8, 25.8]) {
    k.deco('city_traffic_cone', x, 0, 18);
    k.deco('city_trash_bags', x, 0, -14);
    box(k, x, 16.4, 0.88, 0.14, 1.25, 0.22);
    for (const dx of [-0.34, 0.34]) {
      for (const dz of [-0.44, 0.44])
        box(k, x + dx, 16.4 + dz, 0.13, 0.22, 0.22, 0, 'rubber');
      box(k, x + dx, 15.85, 0.07, 0.68, 0.07, 0.36);
    }
    box(k, x, 15.85, 0.75, 0.07, 0.07, 1.04);
  }
  // Przewód biegnie po masztach od agregatu do końcowego stoiska.
  for (const x of [24, 26.7]) box(k, x, 16, 0.12, 2.9, 0.14);
  k.deco('city_cable_span', 25.35, 2.89, 16.05, 0, 0.27);
  box(k, 24, 13, 0.12, 2.9, 0.14);
  k.deco('city_cable_span', 24.06, 2.89, 14.5, Math.PI / 2, 0.3);
  for (const z of [-13, -5.1, 5.1, 13]) {
    for (const x of [-1, 9, 24]) box(k, x, z, 0.14, 3.72, 0.18);
    for (const [x, scale] of [
      [4, 1],
      [16.5, 1.5],
    ]) {
      k.deco('city_lantern_string', x, 3.7, z - 0.08 * scale, 0, scale);
      if (Math.abs(z) === 13)
        k.light(x, 3.7 - scale, z, COLOR.amber, 15, 12, { floorY: 0 });
    }
  }
  for (const x of [3.95, 15.95, 27.95]) {
    box(k, x, 0, 0.17, 0.16, 44, 9.84, 'trim', { ceiling: true });
    for (const z of [-9, 8]) {
      k.fx('drip', x + 0.12, 9.82, z);
      k.decal(z < 0 ? 'puddle1' : 'puddle2', x + 0.5, 0, z, 1.8, 3.5);
    }
  }
  for (const x of [3.95, 15.95, 27.95])
    for (const z of [-9, 8]) k.deco('city_vent_grate', x, 0, z);
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
  // Boczne przyczółki wysunięte poza taras odsłaniają kondygnacje z balkonu.
  for (const [x, end] of [
    [-22, -53],
    [-8, -59],
    [23, -55],
  ]) {
    box(k, x, (end - 38) / 2, 2, 0.65, -38 - end, -5.65, 'concrete');
    box(k, x, (end - 38) / 2, 1.35, 4.45, -38 - end, -10.1, 'facade');
    box(k, x, end, 1.7, 24, 1.7, -34, 'concrete');
    for (let z = end + 1; z < -39; z += 2.3) {
      box(k, x, z, 1.38, 0.36, 1.1, -6.8, 'light_white');
      box(k, x, z, 0.65, 0.07, 0.18, -5, 'neon_amber');
    }
    for (const dx of [-0.76, 0.76])
      box(k, x + dx, (end - 38) / 2, 0.14, 0.14, -38 - end, -7.7);
    box(k, x + 2, end, 4, 0.25, 1.4, -30.25, 'concrete');
    k.deco('city_street_lamp', x + 3, -30, end);
  }
  for (const z of [-15, -3, 12]) {
    box(k, 34, z, 8.5, 0.45, 2.5, -1.45, 'concrete');
    box(k, 37, z, 1.4, 29, 1.6, -30.45, 'concrete');
    box(k, 40, z, 7, 0.25, 2, -28.25, 'concrete');
    k.deco('city_street_lamp', 42, -28, z);
  }
  k.deco('bw_freight_lift_frame', 9, 0, -35.5);
  k.ground(R(7, 11, -37, -36), 0, 'tread_plate', { thickness: 1 });
  for (const x of [6.75, 11.25])
    box(k, x, -35.5, 0.5, 3, 1.1, 0, 'metal', { visible: false });
  box(k, 9, -35.5, 5, 1.2, 1.1, 3, 'metal', { visible: false });
  for (const [x, z, texture, color] of [
    [-5, -32, 'holo_implant', COLOR.violet],
    [2.8, -32, 'holo_koi', '#273cc0'],
    [0, -24, 'holo_jellyfish', COLOR.blue],
    [7, -24, 'holo_drink', COLOR.green],
  ]) {
    box(k, x, z, 1.5, 0.65, 1.5);
    k.deco('city_holo_projector', x, 0.65, z);
    box(k, x, z - 0.85, 1.8, 1.2, 0.2);
    k.holo(texture, x, 1.65, z, 1.5, 1.35, 0, color);
    k.light(x, 0.85, z, color, 9, 7, { floorY: 0.65 });
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
  for (const x of [-14, 18]) {
    k.deco('city_street_lamp', x, 0, -34.5);
    k.light(x, 4.3, -34.1, COLOR.warm, 19, 14, { floorY: 0 });
    box(k, x, -32.8, 2.2, 0.13, 0.55, 0.42);
    for (const dx of [-0.85, 0.85]) box(k, x + dx, -32.8, 0.2, 0.42, 0.5);
    box(k, x + 1.7, -32.8, 0.7, 0.55, 0.7, 0, 'concrete');
    box(k, x + 1.7, -32.8, 0.59, 0.08, 0.59, 0.55, 'rubber');
  }
  for (const x of [-19, -8, 1, 17, 25])
    k.decal('floor_hazard', x, 0, -35.4, 5, 0.5);
  // Ławki przy donicach zostawiają dojście od zachodniego wejścia do windy.
  for (const [x, z] of [
    [-16.32, -26.25],
    [-18.95, -27.23],
    [-15.1, -29.5],
    [-14, -24],
    [-23.8, -24.3],
  ]) {
    box(k, x, z, 2.45, 0.78, 1, 0, 'concrete');
    box(k, x, z, 2.26, 0.09, 0.85, 0.78, 'rubber');
    for (const dx of [-0.85, -0.42, 0, 0.42, 0.85]) {
      box(k, x + dx, z + 0.08, 0.32, 0.64, 0.27, 0.86, 'container_olive', {
        rotation: vec(-0.16, 0, dx * 0.25),
      });
      box(k, x + dx, z - 0.08, 0.28, 0.49, 0.28, 0.86, 'container_olive', {
        rotation: vec(0.23, 0, -dx * 0.28),
      });
    }
    for (const dx of [-0.85, 0.85]) box(k, x + dx, z - 0.86, 0.22, 0.42, 0.46);
    for (const dz of [-1.02, -0.76])
      box(k, x, z + dz, 2.48, 0.11, 0.23, 0.42, 'wood');
  }
  k.prop('city_vending', -24.6, -28.6, { quarter: 1 });
  for (const x of [-22.8, -15.7]) {
    box(k, x, -27.8, 0.49, 0.82, 0.49, 0, 'trim');
    box(k, x, -27.8, 0.38, 0.03, 0.38, 0.82, 'rubber');
  }
  k.decal('floor_stop', 9, 0, -34.8, 3.5, 1);
  k.prop('city_crates', 21.5, -33);
  k.prop('city_crates', 13.5, -34);
  k.prop('city_crates', 14.8, -34);
  k.prop('city_crates', 13.95, -34, { y: 1.59 });
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
    [-9.5, 5.2, 24.2, 2.6, COLOR.warm],
    [-2, 5.2, 32, 0, COLOR.warm],
    [-11, 5.2, 30.5, 0, COLOR.warm],
    [4, 5.2, 24, 0, COLOR.green],
    [-10, 6.4, -12, 3.2, COLOR.warm],
    [-18, 6.4, -18, 0, COLOR.blue],
    [-1, 10, 8, 0, COLOR.amber],
    [11, 10, -8, 0, COLOR.amber],
    [19, 10, 0, 4, COLOR.warm],
    [-2, 10, -16, 0, COLOR.amber],
    [0, 10, 16, 0, COLOR.warm],
    [9, 10, 8, 0, COLOR.violet],
    [12, 10, -17, 0, COLOR.blue],
    [22, 10, -14, 0, COLOR.warm],
    [24, 10, 16, 0, COLOR.blue],
    [0, 3.75, 0, 0, COLOR.warm],
  ]) {
    k.deco('wh_ceiling_lamp', x, roofY - 0.45, z);
    k.light(x, roofY - 0.45, z, color, 26, 16, { floorY });
  }
  for (const x of [-19, -15.8])
    k.light(x, 1.7, -15, COLOR.blue, 18, 11, { floorY: 0 });
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
    panoramaDropM: 61,
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
