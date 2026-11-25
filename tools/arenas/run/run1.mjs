import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

const bounds = JSON.parse(
  readFileSync(
    new URL('../../../src/data/render/mapModelBounds.json', import.meta.url),
    'utf8',
  ),
);
const quarter = Math.PI / 2;
const guardRoom = R(-24, -6, 14, 30);
const servers = R(-6, 12, 14, 30);
const workshop = R(-24, -8, -8, 14);
const hall = R(-8, 28, -38, 14);

function box(k, x, y, z, w, h, d, material, opts = {}) {
  return k.arena.block({
    position: vec(x, y, z),
    size: vec(w, h, d),
    material,
    ...opts,
  });
}

// Footprints in the current room validator support quarter turns. Keep one GLB
// and its matching local-space collider together, including repeated rack bays.
function prop(k, model, x, z, y = 0, turn = 0, opts = {}) {
  const { min, max } = bounds[model];
  const [w, h, d] = max.map((n, i) => n - min[i]);
  return box(k, x, y + h / 2, z, w, h, d, 'metal', {
    model,
    instance: true,
    ...(turn ? { rotation: vec(0, turn * quarter, 0) } : {}),
    ...opts,
  });
}

function crates(k, model, positions) {
  const s = model === 'crate' ? 1 : 0.5;
  for (const [x, z] of positions)
    k.arena.block({ position: vec(x, s / 2, z), size: vec(s, s, s), model });
}

function lamp(
  k,
  x,
  underside,
  z,
  color,
  intensity,
  range,
  floorY = 0,
  flicker,
) {
  const y = underside - 0.45;
  k.deco('wh_ceiling_lamp', x, y, z);
  k.light(x, y, z, color, intensity, range, {
    floorY,
    cone: y - floorY < 2.8,
    ...(flicker ? { flicker } : {}),
  });
}

function mark(k, texture, x, z, w, h, yaw = 0, tint = COLOR.warm, y = 0) {
  k.decals.push({
    texture,
    position: vec(x, y, z),
    size: { w, h },
    yaw,
    tint,
    surface: 'floor',
    opacity: texture === 'floor_arrow' ? 0.52 : 0.82,
  });
}

function floor(k, rect, material) {
  k.ground(rect, 0, material, { thickness: 1 });
}

function roof(k, rect, h, material = 'metal') {
  k.solid(rect, h, h + 0.4, material, { ceiling: true });
}

// Openings use [start, end, sill, head, fill]. A glass opening has a sill and
// a transparent pane. Door posts stand outside the clear opening.
function wall(
  k,
  axis,
  at,
  start,
  end,
  height,
  material,
  openings = [],
  thickness = 0.5,
  base = 0,
) {
  const panel = (a, b, low, high, mat, depth, opts = {}) => {
    if (b <= a || high <= low) return;
    const rect =
      axis === 'x'
        ? R(a, b, at - depth / 2, at + depth / 2)
        : R(at - depth / 2, at + depth / 2, a, b);
    k.solid(rect, low, high, mat, opts);
  };
  const segment = (a, b, low, high) =>
    panel(a, b, low, high, material, thickness, { model: 'wall_segment' });
  let cursor = start;
  for (const [a, b, low, high, fill] of openings) {
    segment(cursor, a - 0.16, base, height);
    for (const edge of [a - 0.16, b])
      panel(edge, edge + 0.16, base, height, 'trim', thickness);
    panel(a, b, base, low, material, thickness);
    if (fill) panel(a, b, low, high, fill, 0.16);
    panel(a, b, high, high + 0.18, 'hivis', thickness);
    segment(a, b, high + 0.18, height);
    cursor = b + 0.16;
  }
  segment(cursor, end, base, height);
}

// Open steel guardrails leave the view between the handrail and midrail clear.
function rail(k, axis, at, a, b, y, endY = y) {
  const rise = endY - y;
  const angle = Math.atan2(rise, b - a);
  const piece = (along, h, span, height, depth, mat, slope = 0) =>
    axis === 'x'
      ? box(
          k,
          along,
          h,
          at,
          span,
          height,
          depth,
          mat,
          slope ? { rotation: vec(0, 0, slope) } : {},
        )
      : box(
          k,
          at,
          h,
          along,
          depth,
          height,
          span,
          mat,
          slope ? { rotation: vec(-slope, 0, 0) } : {},
        );
  const length = Math.hypot(b - a, rise);
  const mid = (y + endY) / 2;
  piece((a + b) / 2, mid + 1.065, length, 0.07, 0.08, 'hivis', angle);
  piece((a + b) / 2, mid + 0.53, length, 0.05, 0.06, 'metal', angle);
  if (rise) piece((a + b) / 2, mid + 0.08, length, 0.12, 0.06, 'hivis', angle);
  const spans = Math.ceil((b - a) / 2.5);
  for (let i = 0; i <= spans; i++)
    piece(
      a + 0.04 + ((b - a - 0.08) * i) / spans,
      y + (rise * (0.04 + ((b - a - 0.08) * i) / spans)) / (b - a) + 0.52,
      0.08,
      1.04,
      0.08,
      'trim',
    );
}

function security(k) {
  floor(k, guardRoom, 'quay_concrete');
  floor(k, R(-17, -13, 30, 31), 'tread_plate');
  roof(k, guardRoom, 5.2, 'overpass_concrete');
  for (const z of [18.8, 23.8, 28.6])
    box(k, -15, 5.08, z, 17.75, 0.24, 0.28, 'machine', { ceiling: true });
  wall(k, 'x', 30.5, -25, -6, 5.2, 'tiles_wall', [[-17, -13, 0, 3]], 1);
  wall(k, 'z', -24.5, 14, 30, 5.2, 'tiles_wall', [], 1);
  wall(k, 'z', -6, 14.25, 30, 7, 'machine', [[18, 22, 0, 2.65]]);
  wall(k, 'x', 14, -24, -8.25, 5.4, 'tiles_wall', [
    [-18, -14, 0, 3.4],
    [-12.7, -8.9, 3.45, 4.86, 'glass'],
  ]);
  prop(k, 'build_site_office', -9.65, 15.8, 0, 0, { walkable: true });
  k.ramp(vec(-8, 0, 28.5), vec(-8, 2.591, 22.5), 3, 'tread_plate');
  k.ground(R(-9.5, -6.5, 17.019, 22.5), 2.591, 'steel_grating', {
    thickness: 0.16,
  });
  for (const z of [17.72, 22.31])
    box(k, -7.88, 2.35, z, 3.74, 0.16, 0.18, 'machine');
  rail(k, 'z', -9.46, 22.5, 28.5, 2.591, 0);
  rail(k, 'z', -9.46, 17.1, 22.5, 2.591);
  rail(k, 'x', 16.96, -12.6, -9.51, 2.591);
  rail(k, 'z', -12.6, 14.68, 16.92, 2.591);
  prop(k, 'wh_conveyor_scanner', -15.45, 22);
  for (const [x, z] of [
    [-10.8, 27.35],
    [-20.2, 20.6],
  ])
    prop(k, 'wh_weapon_case_stack', x, z);
  prop(k, 'city_barrier', -13.2, 24.2);
  prop(k, 'city_barrier', -20.4, 24.6);
  crates(k, 'crate', [
    [-18, 24.1],
    [-16.8, 19.4],
  ]);
  crates(k, 'crate_small', [
    [-17.55, 22.2],
    [-17.9, 22.8],
    [-11.9, 27.4],
  ]);
  k.deco('wh_wall_terminal', -24, 1.2, 22.8, quarter);
  k.deco('wh_wall_terminal', -10.6, 1.15, 17.019);
  prop(k, 'city_holo_projector', -11.5, 21.5);
  k.holo('holo_kurogane', -11.5, 1.45, 21.5, 1.8, 1.8, 0, COLOR.amber);
  k.light(-23.8, 1.78, 22.8, COLOR.blue, 10, 5, { groundGlow: false });
  k.neon('warsztat', -16, 4.05, 14.27, 2.6, 0.85, 0, COLOR.green, 0);
  k.neon('arrow', -6.27, 3.24, 20, 1.45, 0.65, -quarter, COLOR.blue, 0);
  lamp(k, -15.45, 4.96, 23.8, COLOR.warm, 28, 13);
  lamp(k, -15, 4.96, 28.6, COLOR.amber, 22, 11, 0, {
    pattern: 'pulse',
    periodS: 2,
  });
  lamp(k, -10.6, 5.2, 16.3, COLOR.blue, 18, 10, 2.591);
  lamp(k, -16, 5.2, 15.2, COLOR.green, 16, 9);
  for (const x of [-18.1, -12.85])
    mark(k, 'floor_lane_line', x, 24.25, 9, 0.5, quarter, COLOR.amber);
  mark(k, 'floor_pallet_bay', -20.2, 20.6, 3.2, 2.8, 0, COLOR.amber);
  mark(k, 'floor_sector_k09', -20.2, 26.6, 3.2, 1.55);
  mark(k, 'floor_arrow', -16, 24.8, 1.65, 1.8, 0, '#b4a58b');
  mark(k, 'floor_arrow', -7.4, 20, 1.8, 1.8, -quarter, '#a7aab0');
  mark(k, 'floor_stop', -15, 28.9, 3.5, 0.9, 0, COLOR.amber);
  mark(k, 'manhole', -21.5, 17.3, 1.1, 1.1);
}

function power(k) {
  // Flush perimeter inlays leave both the capsule and the floor grid continuous.
  const left = 3.25,
    right = 5.85,
    front = 18.55,
    back = 21.95,
    band = 0.18;
  for (const rect of [
    R(-6, left, 14, 30),
    R(right, 12, 14, 30),
    R(left, right, 14, front),
    R(left, right, back, 30),
    R(left + band, right - band, front + band, back - band),
  ])
    floor(k, rect, 'power_quay_floor');
  for (const rect of [
    R(left, right, front, front + band),
    R(left, right, back - band, back),
    R(left, left + band, front + band, back - band),
    R(right - band, right, front + band, back - band),
  ])
    floor(k, rect, 'hazard_stripes_worn');
  roof(k, servers, 7);
  wall(k, 'x', 30.5, -6, 13, 7, 'machine', [], 1);
  wall(k, 'z', 12.5, 14, 30, 7, 'smog_soot_wall', [], 1);
  k.deck(R(5.5, 12, 22, 30), 1.6, 'tread_plate');
  k.ramp(vec(1.5, 0, 24), vec(5.5, 1.6, 24), 3, 'tread_plate');
  prop(k, 'power_transformer', 8.7, 27.45, 1.6);
  rail(k, 'x', 25.26, 5.75, 11.68, 1.6);
  k.ramp(vec(9.75, 1.6, 22), vec(9.75, 3.2, 18), 3.5, 'tread_plate');
  rail(k, 'z', 8.05, 18, 22, 3.2, 1.6);
  k.ground(R(7.8, 11.7, 15.6, 18), 3.2, 'steel_grating');
  for (const z of [16, 17.7]) {
    box(k, 9.9, 2.7, z, 4.2, 0.2, 0.2, 'machine');
    box(k, 8.05, 1.3, z, 0.2, 2.6, 0.2, 'metal');
  }
  k.ramp(vec(9.75, 3.2, 15.6), vec(9.75, 3.6, 14), 3.5, 'tread_plate');
  rail(k, 'z', 7.88, 15.65, 17.9, 3.2);
  for (const x of [-2, 2])
    for (const z of [18.3, 19.7, x < 0 ? 24.5 : 27.2])
      prop(k, 'wh_server_rack', x, z, 0, x === 2 && z === 19.7 ? -1 : 1);
  for (const x of [-3.8, 0.2]) prop(k, 'city_generator', x, 28.8);
  k.deco('wh_wall_terminal', 11.99, 4.2, 16.7, -quarter);
  for (const z of [19.5, 25.8]) k.deco('city_ac_unit', -5.74, 3.8, z, quarter);
  for (const x of [-2.6, 1]) k.deco('city_pipe_run', x, 0, 29.99, Math.PI);
  for (const z of [17.4, 24.8])
    k.deco('city_cable_span', 3.13, 6.75, z, 0, 1.77);
  for (const z of [18.5, 26.6]) {
    k.deco('city_vent_grate', -4.7, 0, z);
    k.fx('steam', -4.7, 0.06, z, 0.65);
  }
  k.hazards.push({
    kind: 'electric_field',
    id: 'substation-arc',
    position: vec(4.55, 1, 20.25),
    size: vec(2.2, 2, 3),
    cycle: { onS: 3, offS: 2.5 },
  });
  k.fx('sparks', 2.51, 1, 19.7, 1.2);
  k.fx('drip', -2.6, 5.9, 29.5);
  // The southern beam terminates before the transformer. Both are tied to the slab.
  for (const [z, end] of [
    [18, 7.25],
    [25, 5.4],
  ]) {
    box(k, (-5.75 + end) / 2, 5.4, z, end + 5.75, 0.24, 0.32, 'machine', {
      ceiling: true,
    });
    for (const x of [-4, end - 0.2])
      box(k, x, 6.26, z, 0.12, 1.48, 0.12, 'trim', { ceiling: true });
    lamp(k, 0, 5.28, z, COLOR.blue, 24, 12);
  }
  for (const [x, z, height] of [
    [3.38, 18.68, 2.5],
    [5.72, 21.82, 1.12],
  ]) {
    box(k, x, height / 2, z, 0.22, height, 0.22, 'machine');
    box(k, x, height - 0.16, z, 0.24, 0.13, 0.24, 'neon_violet');
  }
  k.light(3.38, 2.34, 18.81, COLOR.violet, 18, 8, {
    cone: false,
    groundGlow: false,
    flicker: { pattern: 'buzz', strength: 0.22 },
  });
  box(k, 9.85, 6.2, 16.5, 4.3, 0.22, 0.3, 'machine', { ceiling: true });
  lamp(k, 9.7, 6.09, 16.5, COLOR.amber, 20, 10, 3.2);
  for (const x of [-0.85, 0.85])
    mark(k, 'floor_lane_line', x, 22.6, 10.8, 0.45, quarter, COLOR.blue);
  mark(k, 'floor_arrow', 3.4, 16.1, 2, 2);
  mark(k, 'oil_stain', 7, 25.8, 2.3, 1.4, 0, COLOR.warm, 1.6);
}

function calibration(k) {
  // Recess the test channel into the floor tiling so its grating is flush.
  for (const rect of [
    R(-24, -8, -8, -2),
    R(-24, -8, 0, 14),
    R(-24, -19, -2, 0),
    R(-13, -8, -2, 0),
  ])
    floor(k, rect, 'turbine_hall_floor');
  floor(k, R(-19, -13, -2, 0), 'steel_grating');
  roof(k, workshop, 5.4);
  wall(k, 'z', -24.5, -8, 14, 5.4, 'tiles_wall', [], 1);
  wall(k, 'x', -8.5, -25, -8, 5.4, 'corrugated', [], 1);
  k.ground(R(-13, -8, -8, 3), 3, 'steel_grating');
  k.ramp(vec(-22, 0, -6.4), vec(-15, 3, -6.4), 2.8, 'tread_plate');
  k.ground(R(-15, -13, -7.8, -5), 3, 'steel_grating');
  for (const [x, z] of [
    [-12.75, -7.65],
    [-12.75, 2.72],
    [-8.6, 2.72],
  ])
    box(k, x, 1.3, z, 0.32, 2.6, 0.32, 'machine');
  rail(k, 'z', -12.93, -4.85, 2.93, 3);
  rail(k, 'x', 2.93, -12.85, -8.32, 3);
  for (const [x, z, y, turn] of [
    [-19.5, 7.6, 0, 0],
    [-13, 6, 0, 1],
    [-19.5, 3.2, 0, 2],
    [-10.4, 1.8, 3, 2],
  ])
    prop(k, 'wh_workbench_weapons', x, z, y, turn);
  for (const z of [-2.65, 4.7]) prop(k, 'wh_weapon_case_stack', -22.2, z);
  prop(k, 'city_smog_scrubber', -22.2, 12);
  k.deco('city_pipe_run', -20.22, 0, 13.745, Math.PI, 0.73);
  box(k, -20.65, 3.72, 13.45, 1.08, 0.16, 0.18, 'metal');
  prop(k, 'wh_weapon_case_stack', -16.1, 10.25);
  prop(k, 'city_barrier', -16.1, 11.32);
  k.deco('wh_wall_terminal', -10.5, 3.9, -8);
  for (const x of [-18.8, -13.2]) {
    box(k, x, 0.55, -1, 0.54, 1.1, 3.8, 'machine', { model: 'cover_low' });
    box(k, x, 1.22, -1, 0.36, 0.24, 0.4, 'hivis');
  }
  k.hazards.push(
    {
      kind: 'laser_gate',
      id: 'calibration-beam',
      from: vec(-18.5, 0.8, -1),
      to: vec(-13.5, 0.8, -1),
      cycle: { onS: 2.8, offS: 1.8 },
    },
    {
      kind: 'explosive_barrel',
      id: 'workshop-cell-1',
      position: vec(-21.5, 0, 1.5),
    },
  );
  crates(k, 'crate', [
    [-14.7, 10.5],
    [-18.1, 9.1],
    [-10.1, 10.7],
  ]);
  crates(k, 'crate_small', [
    [-18.8, 9.2],
    [-10.8, 10.1],
    [-11.2, 10.7],
  ]);
  k.fx('sparks', -18.45, 0.8, -1, 0.8);
  k.fx('steam', -22.2, 3.95, 11.8, 0.8);
  lamp(k, -16, 5.4, 7, COLOR.warm, 34, 14);
  lamp(k, -16, 5.4, -4, COLOR.warm, 34, 14);
  lamp(k, -16, 5.4, -1, COLOR.amber, 22, 10, 0, {
    pattern: 'pulse',
    periodS: 1.8,
  });
  k.light(-10.5, 4.47, -7.81, COLOR.blue, 18, 10, { floorY: 3 });
  for (const z of [-3.2, 1.25])
    mark(k, 'floor_hazard', -16, z, 5.2, 0.7, 0, COLOR.amber);
  for (const z of [8.7, 12.1])
    mark(k, 'floor_lane_line', -13.2, z, 9, 0.55, 0, COLOR.amber);
  mark(k, 'floor_arrow', -10.25, 4.6, 2.15, 2.15, -quarter);
  mark(k, 'floor_stop', -9.25, 4.5, 3, 0.8, quarter);
  mark(k, 'tire_marks', -11.2, 7.8, 3.2, 2.1, quarter);
  mark(k, 'oil_stain', -19, 7.3, 2.3, 1.4);
  mark(k, 'crack_floor', -21, 4.6, 2.4, 1.3);
}

function hallGalleries(k) {
  const deck = (rect) =>
    k.ground(rect, 3.6, 'steel_grating', { thickness: 0.3 });
  // Leave a notch for the transition from the lower workshop gallery.
  deck(R(-8, -4, -13, -6.75));
  deck(R(-6, -4, -6.75, -3.25));
  deck(R(-8, -4, -3.25, 6));
  k.ramp(vec(-8, 3, -5), vec(-6, 3.6, -5), 3.5, 'tread_plate');
  deck(R(24, 28, -13, 10));
  deck(R(8, 28, 10, 14));
  for (const x of [-6, 26]) {
    k.ramp(vec(x, 0, -22), vec(x, 3.6, -13), 3.5, 'tread_plate');
    rail(k, 'z', x + (x < 0 ? 1.71 : -1.71), -22, -13, 0, 3.6);
  }
  for (const x of [-4.07, 24.07]) {
    rail(k, 'z', x, -13, -5.08, 3.6);
    rail(k, 'z', x, -1.92, x < 0 ? 5.95 : 9.95, 3.6);
  }
  rail(k, 'x', 5.94, -7.7, -4.2, 3.6);
  rail(k, 'x', 10.06, 8.08, 23.9, 3.6);
  rail(k, 'z', 8.07, 10.1, 13.72, 3.6);
  for (const [x, z] of [
    [-4.35, -12.5],
    [-4.35, 5.6],
    [24.35, -12.5],
    [24.35, 9.6],
    [8.4, 10.4],
    [17.1, 10.4],
  ])
    box(k, x, 1.65, z, 0.32, 3.3, 0.32, 'machine');

  // Raise the crossing only over the freight lanes. The gallery doors stay at 3.6 m.
  // The collision plate spans the gaps between the individual steel bearing bars.
  const bridgeZ = -3.5,
    high = 5.8,
    width = 3;
  for (const [x0, x1, y0, y1] of [
    [-4, 2, 3.6, high],
    [2, 18, high, high],
    [18, 24, high, 3.6],
  ]) {
    if (y0 === y1) {
      k.ground(
        R(x0 + 0.6, x1 - 0.6, bridgeZ - width / 2, bridgeZ + width / 2),
        high,
        'steel_grating',
        { visible: false, thickness: 0.18 },
      );
      for (const start of [x0, x1 - 0.6])
        k.ground(
          R(start, start + 0.6, bridgeZ - width / 2, bridgeZ + width / 2),
          high,
          'steel_grating',
          { thickness: 0.18 },
        );
      for (let i = 3; i < 77; i++)
        box(
          k,
          x0 + (i + 0.5) * 0.2,
          high - 0.055,
          bridgeZ,
          0.066,
          0.11,
          width,
          'steel_grating',
          { instance: true },
        );
      for (const z of [-4.89, -3.5, -2.11])
        box(k, 10, high - 0.16, z, 16, 0.1, 0.1, 'machine');
    } else {
      k.p.ramp({
        from: vec(x0, y0, bridgeZ),
        to: vec(x1, y1, bridgeZ),
        width,
        material: 'steel_grating',
        thickness: 0.18,
      });
    }
    for (const z of [-4.95, -2.05]) rail(k, 'x', z, x0, x1, y0, y1);
  }
  for (const x of [2, 10, 18]) {
    box(k, x, high - 0.27, bridgeZ, 0.22, 0.12, 3.3, 'machine');
    for (const z of [-5.08, -1.92]) {
      box(
        k,
        x,
        (11.46 + high - 0.33) / 2,
        z,
        0.07,
        11.46 - high + 0.33,
        0.07,
        'metal',
      );
      box(
        k,
        x,
        11.55,
        (z - 7) / 2,
        0.16,
        0.18,
        Math.abs(z + 7) + 0.3,
        'machine',
        { ceiling: true },
      );
    }
  }
}

function runway(k) {
  const craneX = 6,
    craneZ = -12;
  for (const side of [-1, 1]) {
    const railX = craneX + side * 7.68;
    const columnX = railX + side * 0.26;
    for (const z of [-37, -31, -25, -19, -14.5, -7, -1, 5, 8]) {
      prop(k, 'wh_hall_column', columnX, z, 0, side < 0 ? 0 : 2);
      box(k, columnX + side * 0.23, 10.69, z, 0.48, 1.38, 0.46, 'metal');
    }
    for (const z of [-35, -29, -23, -17, -11, -5, 1, 7])
      prop(k, 'wh_crane_rail', railX, z, 8.2);
  }
  // Shallow transverse trusses clear the entire crane envelope at 10.9 m.
  for (const z of [-37, -31, -25, -19, -14.5, -7, -1, 5, 8]) {
    box(k, 10, 11.46, z, 36, 0.16, 0.34, 'machine', { ceiling: true });
    box(k, 10, 12.43, z, 36, 0.14, 0.28, 'metal', { ceiling: true });
    for (let i = 0; i < 12; i++) {
      const dy = i % 2 === 0 ? 0.97 : -0.97;
      box(k, -6.5 + 3 * i, 11.945, z, Math.hypot(3, dy), 0.105, 0.15, 'trim', {
        ceiling: true,
        rotation: vec(0, 0, Math.atan2(dy, 3)),
      });
    }
  }
  prop(k, 'wh_overhead_crane', craneX, craneZ, 8.5);
  prop(k, 'port_container_20_graphite', craneX, craneZ, 5.5);
  // The hook carries the central stem of the spreader. Its four short vertical
  // slings terminate at the top corner castings of the container.
  const cargoTop = 5.5 + bounds.port_container_20_graphite.max[1];
  box(k, 6, 8.43, -12, 0.09, 0.16, 0.09, 'metal');
  box(k, 6, 8.31, -12, 5.82, 0.12, 0.18, 'crane_paint');
  for (const x of [3.15, 8.85]) {
    box(k, x, 8.31, -12, 0.12, 0.12, 2.28, 'crane_paint');
    for (const z of [-13.08, -10.92])
      box(k, x, (cargoTop + 8.25) / 2, z, 0.06, 8.25 - cargoTop, 0.06, 'metal');
  }
  // Outboard brackets put the warning lamps in front of the cargo's south face.
  for (const x of [3.55, 8.45]) {
    box(k, x, 5.72, -10.63, 0.95, 0.14, 0.44, 'machine');
    lamp(k, x, 5.65, -10.51, COLOR.amber, 26, 12);
  }
}

// Wire-mesh wall of the deposit cage: grating panels between posts with door gaps.
function mesh(k, axis, at, a, b, gaps = [], h = 2.5, corners = true) {
  const runs = [];
  let cursor = a;
  for (const [g0, g1] of [...gaps, [b, b]]) {
    if (g0 > cursor) runs.push([cursor, g0]);
    cursor = g1;
  }
  const put = (mid, y, len, height, depth, material) =>
    axis === 'x'
      ? box(k, mid, y, at, len, height, depth, material)
      : box(k, at, y, mid, depth, height, len, material);
  for (const [s, e] of runs) {
    const n = Math.ceil((e - s) / 1.6);
    for (let i = 0; i <= n; i++)
      if (corners || !((i === 0 && s === a) || (i === n && e === b)))
        put(s + ((e - s) * i) / n, (h + 0.1) / 2, 0.1, h + 0.1, 0.1, 'machine');
    for (let i = 0; i < n; i++) {
      const p0 = s + ((e - s) * i) / n + 0.06,
        p1 = s + ((e - s) * (i + 1)) / n - 0.06;
      put(
        (p0 + p1) / 2,
        (h + 0.25) / 2,
        p1 - p0,
        h - 0.25,
        0.04,
        'steel_grating',
      );
      put((p0 + p1) / 2, 0.125, p1 - p0, 0.25, 0.06, 'machine');
      put((p0 + p1) / 2, h + 0.04, p1 - p0, 0.08, 0.08, 'hivis');
    }
  }
  for (const [g0, g1] of gaps)
    put((g0 + g1) / 2, h - 0.05, g1 - g0, 0.2, 0.14, 'hazard');
}

// Roller belt on a solid frame with a rubber top; cases ride on it.
function belt(k, x0, x1, z, cases = []) {
  const mid = (x0 + x1) / 2,
    len = x1 - x0;
  box(k, mid, 0.4, z, len, 0.8, 1, 'machine');
  box(k, mid, 0.825, z, len, 0.05, 0.9, 'rubber');
  for (const [x, mat] of cases) box(k, x, 1.1, z, 0.62, 0.45, 0.55, mat);
}

// Slim post lamp: the arm and the visible lamp head carry the light.
function postLamp(k, x, z, y, color, intensity, range) {
  box(k, x, y / 2, z, 0.12, y, 0.12, 'machine');
  box(k, x, y + 0.05, z, 0.8, 0.1, 0.12, 'machine');
  box(k, x, y - 0.06, z, 0.7, 0.1, 0.24, 'light_white');
  k.light(x, y - 0.12, z, color, intensity, range);
}

// North-west: stilted foreman booth with a window on the hall, ramp access.
function foremanBooth(k) {
  const top = 3.6;
  k.ground(R(-8, -3, -38, -33), top, 'steel_grating', { thickness: 0.3 });
  k.ramp(vec(-6.2, 0, -24.5), vec(-6.2, top, -33), 3.5, 'tread_plate');
  rail(k, 'z', -4.49, -33, -24.5, top, 0);
  rail(k, 'z', -3.05, -38, -33, top);
  rail(k, 'x', -33.05, -4.45, -3.05, top);
  for (const [x, z] of [
    [-7.8, -37.8],
    [-3.2, -37.8],
    [-3.2, -33.2],
    [-7.8, -33.4],
  ])
    box(k, x, 1.65, z, 0.34, 3.3, 0.34, 'machine');
  for (const z of [-33.2, -37.8])
    box(k, -5.5, 3.2, z, 4.8, 0.14, 0.14, 'machine');
  wall(
    k,
    'z',
    -4.5,
    -38,
    -34.6,
    6.6,
    'machine',
    [[-37.4, -35.2, 4.5, 5.8, 'glass']],
    0.3,
    top,
  );
  wall(
    k,
    'x',
    -34.6,
    -8,
    -4.5,
    6.6,
    'machine',
    [[-7.5, -5.5, top, 5.75]],
    0.3,
    top,
  );
  k.solid(R(-8, -4.5, -38, -34.6), 6.6, 6.8, 'machine');
  box(k, -6.6, top + 0.4, -37.55, 2.6, 0.8, 0.8, 'machine');
  for (const x of [-7.4, -6.6, -5.8])
    box(k, x, top + 1.0, -37.75, 0.62, 0.4, 0.06, 'neon_blue');
  box(k, -5.3, top + 0.25, -36.4, 0.5, 0.5, 0.5, 'plastic');
  k.deco('wh_wall_terminal', -8, 4.9, -36.3, quarter);
  lamp(k, -6.2, 6.6, -36.2, COLOR.warm, 20, 8, top);
  lamp(k, -5.5, 3.3, -35.5, COLOR.amber, 22, 10);
  mark(k, 'floor_hazard', -6.2, -23.8, 3.4, 0.7, 0, COLOR.amber);
  mark(k, 'floor_lane_line', -6.2, -26.8, 4.5, 0.4, quarter, COLOR.amber);
}

// Two sorting lines with scanner gates, a walking lane between them.
function sortingLine(k) {
  belt(k, -3, -0.2, -28, [[-2.1, 'container_ochre']]);
  prop(k, 'wh_conveyor_scanner', 1.6, -28);
  belt(k, 3.4, 6.2, -28, [
    [4.6, 'container_graphite'],
    [5.4, 'container_ochre'],
  ]);
  box(k, 6.3, 0.45, -28, 0.1, 0.9, 1, 'hazard');
  belt(k, -2.6, 0.8, -34.4, [[-1.4, 'container_graphite']]);
  prop(k, 'wh_conveyor_scanner', 2.6, -34.4);
  belt(k, 4.4, 6.4, -34.4, [[5.2, 'container_ochre']]);
  box(k, 6.5, 0.45, -34.4, 0.1, 0.9, 1, 'hazard');
  prop(k, 'wh_weapon_case_stack', 7.2, -28, 0, 0);
  prop(k, 'wh_weapon_case_stack', 7.3, -34.4, 0, 0);
  postLamp(k, 0.4, -31.2, 3.3, COLOR.warm, 26, 10);
  postLamp(k, 4.6, -31.2, 3.3, COLOR.amber, 22, 9);
  prop(k, 'city_barrier', 8.3, -31, 0, 0);
  prop(k, 'city_barrier', 11.7, -31, 0, 0);
  mark(k, 'floor_hazard', 1.6, -26.7, 4.4, 0.6, 0, COLOR.amber);
  mark(k, 'floor_hazard', 2.6, -35.7, 4.4, 0.6, 0, COLOR.amber);
  mark(k, 'floor_lane_line', -0.6, -31.2, 10, 0.45, 0, COLOR.amber);
  mark(k, 'oil_stain', 2.8, -30.2, 2.4, 1.4);
}

// Open dock lane to the exit: cones, bollards, lane lines, high-bay lamps.
function dockLane(k) {
  for (const [x, z] of [
    [7.6, -35.6],
    [12.4, -35.6],
    [7.9, -32.8],
    [12.1, -32.8],
  ])
    k.deco('city_traffic_cone', x, 0, z);
  for (const x of [7.5, 12.5]) prop(k, 'port_bollard', x, -37.2);
  for (const z of [-30, -25.6])
    mark(k, 'floor_arrow', 10, z, 1.8, 2.1, 0, '#b4a58b');
  mark(k, 'floor_hazard', 10, -34.4, 5.4, 0.7, 0, COLOR.amber);
  mark(k, 'floor_lane_line', 7.2, -31, 14, 0.45, quarter, COLOR.green);
  mark(k, 'floor_lane_line', 12.8, -31, 14, 0.45, quarter, COLOR.green);
  mark(k, 'tire_marks', 10, -33, 3.2, 2.2, quarter);
  mark(k, 'manhole', 7.4, -24.8, 1.1, 1.1);
  lamp(k, 6, 11.38, -25, COLOR.warm, 52, 22);
  lamp(k, 0, 11.38, -31, COLOR.warm, 50, 22);
  lamp(k, 10, 11.38, -31, COLOR.warm, 52, 22);
  lamp(k, -3.25, 11.38, -25, COLOR.warm, 40, 20);
}

// Weapons deposit cage: an island of cover behind wire mesh.
function depositCage(k) {
  const x0 = 15,
    x1 = 18.2,
    z0 = -38,
    z1 = -31.6;
  mesh(k, 'z', x0, z0, z1, [[-35.9, -34]]);
  mesh(k, 'z', x1, z0, z1);
  mesh(k, 'x', z1, x0, x1, [[16, 17.6]], 2.5, false);
  box(
    k,
    (x0 + x1) / 2,
    2.63,
    (z0 + z1) / 2,
    x1 - x0,
    0.06,
    z1 - z0,
    'steel_grating',
  );
  prop(k, 'wh_weapon_case_stack', 17.5, -36.9, 0, 1);
  prop(k, 'wh_weapon_case_stack', 17.5, -35.1, 0, 1);
  prop(k, 'wh_weapon_case_stack', 15.85, -36.9, 0, 1);
  prop(k, 'wh_workbench_weapons', 16.05, -33.1, 0, 1);
  k.arena.block({
    position: vec(15.85, 0.5, -35.2),
    size: vec(1, 1, 1),
    model: 'crate',
  });
  k.arena.block({
    position: vec(16.62, 0.25, -34.7),
    size: vec(0.5, 0.5, 0.5),
    model: 'crate_small',
  });
  lamp(k, 16.6, 2.6, -34.8, COLOR.amber, 22, 8);
  mark(k, 'floor_pallet_bay', 16.6, -34.8, 3, 5.4, 0, COLOR.amber);
  mark(k, 'floor_stop', 16.8, -30.6, 3.2, 0.8, 0, COLOR.amber);
}

// Container canyon between a two-high stack and the trailer.
function containerYard(k) {
  prop(k, 'port_container_20_olive', 21.4, -34.9, 0, 1);
  prop(k, 'port_container_20_graphite', 21.4, -28.8, 0, 1);
  prop(k, 'port_container_20_ochre', 21.4, -34.9, 2.591, 1);
  lamp(k, 23.8, 11.38, -31, COLOR.warm, 40, 20);
  mark(k, 'floor_lane_line', 23.9, -31.5, 11, 0.5, quarter, COLOR.amber);
  mark(k, 'floor_hazard', 23.9, -25.3, 2.4, 0.6, 0, COLOR.amber);
}

// Trailer docked along the east wall, walkable through the open rear.
function trailerBay(k) {
  const x0 = 25.2,
    x1 = 27.6,
    z0 = -37.6,
    z1 = -27;
  k.ground(R(x0, x1, z0, z1), 1.2, 'tread_plate', { thickness: 0.2 });
  box(k, 26.4, 0.85, -32.3, 0.3, 0.35, 10.6, 'machine');
  for (const x of [25.05, 27.75])
    for (const z of [-29.5, -30.8]) box(k, x, 0.5, z, 0.3, 1, 1, 'rubber');
  for (const x of [25.5, 27.3]) box(k, x, 0.5, -35, 0.15, 1, 0.15, 'machine');
  for (const [a, b] of [
    [x0, x0 + 0.12],
    [x1 - 0.12, x1],
  ])
    k.solid(R(a, b, z0, z1), 1.2, 3.5, 'container_graphite');
  k.solid(R(x0, x1, z0, z0 + 0.15), 1.2, 3.5, 'container_graphite');
  k.solid(R(x0, x1, z0, z1), 3.5, 3.62, 'machine');
  k.solid(R(x0, x1, z1 - 0.12, z1), 3.38, 3.5, 'hazard');
  k.ramp(vec(26.4, 0, -23.6), vec(26.4, 1.2, z1), 2.2, 'tread_plate');
  prop(k, 'wh_weapon_case_stack', 26.4, -36.6, 1.2, 1);
  prop(k, 'wh_weapon_case_stack', 26.4, -34.8, 1.2, 1);
  box(k, 26.4, 1.45, -32.8, 0.5, 0.5, 0.5, 'container_ochre');
  lamp(k, 26.4, 3.5, -31.5, COLOR.warm, 22, 8, 1.2);
  for (const z of [-36.5, -32, -28.5])
    box(k, 25.14, 3.0, z, 0.08, 0.14, 0.3, 'neon_amber');
  k.light(25.0, 3.0, -32, COLOR.amber, 16, 8, { groundGlow: false });
  mark(k, 'floor_stop', 26.4, -22.6, 2.4, 0.7, 0, COLOR.amber);
  mark(k, 'oil_stain', 26.4, -24.6, 2.4, 1.6);
}

// Scissor lift raised to 1.6 m with a pallet on top, reached by a ramp.
function scissorLift(k) {
  k.ramp(vec(10.6, 0, -28.1), vec(15, 1.6, -28.1), 2, 'tread_plate');
  k.ground(R(15, 18.2, -29.2, -27), 1.6, 'tread_plate', { thickness: 0.2 });
  box(k, 16.6, 0.125, -28.1, 2.8, 0.25, 2.1, 'machine');
  for (const z of [-28.95, -27.25]) {
    box(k, 16.6, 0.8, z, 2.6, 0.1, 0.12, 'hivis', {
      rotation: vec(0, 0, 0.395),
    });
    box(k, 16.6, 0.8, z + 0.2, 2.6, 0.1, 0.12, 'hivis', {
      rotation: vec(0, 0, -0.395),
    });
  }
  rail(k, 'x', -29.12, 15.1, 18.1, 1.6);
  rail(k, 'x', -27.08, 15.1, 18.1, 1.6);
  rail(k, 'z', 18.12, -29.1, -27.1, 1.6);
  prop(k, 'wh_weapon_case_stack', 17.3, -28.1, 1.6, 0);
  box(k, 15.6, 2.35, -29.05, 0.1, 1.5, 0.1, 'machine');
  box(k, 15.6, 3.2, -29.05, 0.22, 0.22, 0.22, 'neon_amber');
  k.light(15.6, 3.2, -29.05, COLOR.amber, 14, 7, {
    floorY: 1.6,
    groundGlow: false,
    flicker: { pattern: 'pulse', periodS: 1.4 },
  });
  mark(k, 'floor_hazard', 16.6, -25.9, 4.2, 0.6, 0, COLOR.amber);
}

// A rack frame leans on a crate stack; its load is strewn across the floor.
function spilledRack(k) {
  for (const [z, mat, h, d] of [
    [-24.0, 'hivis', 0.12, 1.2],
    [-24.8, 'metal', 0.1, 0.1],
    [-23.2, 'metal', 0.1, 0.1],
  ])
    box(k, 17.6, 1.0, z, 4.2, h, d, mat, { rotation: vec(0, 0, 0.49) });
  for (const [y, z] of [
    [0.5, -24],
    [1.5, -24],
    [0.5, -22.7],
  ])
    k.arena.block({
      position: vec(20, y, z),
      size: vec(1, 1, 1),
      model: 'crate',
    });
  crates(k, 'crate_small', [
    [16.1, -23.2],
    [16.8, -24.9],
    [17.5, -22.5],
    [18.4, -25.2],
    [15.5, -24.3],
    [19, -22.5],
  ]);
  prop(k, 'wh_weapon_case_stack', 16.3, -26.2, 0, 1);
  prop(k, 'city_crates', 18.9, -26.1);
  mark(k, 'oil_stain', 17.4, -24.2, 3.4, 2.2);
  mark(k, 'crack_floor', 18, -23, 2.6, 1.3);
  mark(k, 'floor_hazard', 17.5, -21.5, 6, 0.6, 0, COLOR.amber);
}

// Forklift charging stalls under the east gallery, nose to the lanes.
function chargingStation(k) {
  for (const z of [-3.8, -1.4, 1]) {
    prop(k, 'wh_forklift', 26, z, 0, 2);
    box(k, 27.75, 0.7, z, 0.3, 1.4, 0.4, 'machine');
    box(k, 27.75, 1.5, z, 0.32, 0.18, 0.26, 'neon_amber');
    mark(k, 'floor_pallet_bay', 25.9, z, 3.3, 1.7, 0, COLOR.amber);
  }
  k.light(27.2, 1.7, -2.6, COLOR.amber, 16, 7, { groundGlow: false });
  k.light(27.2, 1.7, 1, COLOR.amber, 16, 7, { groundGlow: false });
  mark(k, 'floor_stop', 22.7, -1.4, 0.8, 5.6, 0, COLOR.amber);
}

function northYard(k) {
  foremanBooth(k);
  sortingLine(k);
  dockLane(k);
  depositCage(k);
  containerYard(k);
  trailerBay(k);
  scissorLift(k);
  spilledRack(k);
  chargingStation(k);
}

function dispatch(k) {
  floor(k, R(-8, 28, -38, -16), 'quay_concrete');
  floor(k, R(8, 12, -39, -38), 'tread_plate');
  for (const [left, right, mat] of [
    [-8, 2, 'turbine_hall_floor'],
    [2, 10, 'concrete'],
    [10, 28, 'turbine_hall_floor'],
  ])
    floor(k, R(left, right, -16, 14), mat);
  roof(k, hall, 12.5);
  wall(k, 'x', -38.5, -9, 29, 12.5, 'corrugated', [[8, 12, 0, 3]], 1);
  k.solid(R(28, 28.73, -38, 12), 10, 12.5, 'corrugated', {
    model: 'wall_segment',
  });
  k.solid(R(28, 28.73, -38, -36), 0, 10, 'corrugated', {
    model: 'wall_segment',
  });
  wall(k, 'z', 28.5, 12, 14, 12.5, 'corrugated', [], 1);
  wall(k, 'z', -8.5, -38, -8.25, 12.5, 'corrugated', [], 1);
  wall(k, 'z', -8, -8.25, 14, 12.5, 'corrugated', [
    [-7, -3, 2.68, 5.4],
    [-2, 1.65, 3.25, 5.05, 'glass'],
    [2, 7, 0, 3.45],
  ]);
  wall(k, 'x', 14, -8, 29, 12.5, 'corrugated', [
    [1, 5, 0, 3.45],
    [7.9, 11.65, 3.15, 6.25],
  ]);
  // The shutter is raised on the tall hall face of the workshop opening.
  k.deco('city_shutter', -7.747, 3.65, 4.5, quarter);
  for (const z of [-33, -27, -21, -15, -9, -3, 3, 9]) {
    k.deco('port_warehouse_shell_panel', 28.73, 0, z, -quarter);
    box(k, 28.365, 5, z, 0.73, 10, 6, 'corrugated', { visible: false });
  }
  hallGalleries(k);
  runway(k);
  northYard(k);

  for (const x of [0, 12])
    for (const z of [-17, -13, -9, 0, 4, 8])
      for (const side of [-1, 1])
        prop(k, 'wh_pallet_rack', x + 0.6 * side, z, 0, side);
  for (const [x, z, turn] of [
    [4.2, 3.6, 0],
    [18, -2, 1],
    [16.5, -21, 2],
  ])
    prop(k, 'wh_forklift', x, z, 0, turn);
  prop(k, 'city_crates', 5.2, -1.4);
  prop(k, 'city_barrier', 5.25, -2.46);
  crates(k, 'crate', [[6.5, -1.55]]);
  for (const [x, color] of [
    [0, COLOR.amber],
    [12, COLOR.green],
  ]) {
    k.neon('arrow', x, 4.25, -2.04, 1.8, 0.78, Math.PI, color, 0);
    k.neon('arrow', x, 4.25, -6.96, 1.8, 0.78, 0, color, 0);
  }
  for (const z of [-20.2, -16.6]) k.deco('city_pipe_run', -8, 0, z, quarter);
  prop(k, 'port_container_40_navy', 2.25, -21.6);
  prop(k, 'port_container_20_graphite', 20.6, 7.4);
  prop(k, 'port_container_20_ochre', 20.6, 7.4, 2.591);
  prop(k, 'port_container_20_navy', 20.5, -13.719, 0, 0, { walkable: true });
  prop(k, 'build_precast_stack', 19, -8.2, 0, 0, { walkable: true });
  k.ramp(vec(26.5, 0, -8), vec(22, 1.6, -8), 2.6, 'tread_plate');
  k.p.ramp({
    from: vec(20, 1.6, -9.403),
    to: vec(20, 2.591, -12.5),
    width: 2.8,
    thickness: 0.16,
    material: 'tread_plate',
  });
  for (const [x, z] of [
    [7.5, 2],
    [2.9, -6],
    [18.9, 2.3],
    [21.4, -18.2],
    [9.1, 12.2],
    [-3.7, 11.6],
  ])
    prop(k, 'wh_weapon_case_stack', x, z);
  for (const [x, z] of [
    [15.2, 12.6],
    [17.6, 11.6],
    [-2.5, 3.2],
    [20.7, -16.5],
  ])
    prop(k, 'city_crates', x, z);
  for (const [x, z] of [
    [0, 10.55],
    [12, -20],
    [12, 10.6],
    [0, -19.45],
  ])
    prop(k, 'city_barrier', x, z);
  for (const [x, z] of [
    [6.65, -18.5],
    [15.75, -16.5],
  ])
    prop(k, 'city_highway_barrier', x, z);
  crates(k, 'crate', [
    [3, 11],
    [4.2, 11.1],
    [16.2, 10.2],
    [22, 1.7],
    [15.3, -9.25],
    [7.6, -8.2],
  ]);
  crates(k, 'crate_small', [
    [3.4, 12.2],
    [4.5, 12.2],
    [15.7, 11.1],
    [22.9, 1.3],
    [7.1, -7.3],
  ]);
  k.hazards.push(
    {
      kind: 'explosive_barrel',
      id: 'hall-fuel-south',
      position: vec(6, 0, 9.5),
    },
    {
      kind: 'explosive_barrel',
      id: 'hall-fuel-north',
      position: vec(14.5, 0, -18.5),
    },
  );
  for (const x of [-3.25, 18])
    for (const z of [-14.5, 5]) lamp(k, x, 11.38, z, COLOR.warm, 45, 22);
  for (const z of [5, -19]) lamp(k, 6, 11.38, z, COLOR.warm, 58, 24);
  for (const x of [2.5, 19.5]) {
    box(k, x, 8.65, -36.5, 0.3, 0.24, 3, 'machine', { ceiling: true });
    lamp(k, x, 8.53, -35.4, COLOR.warm, 42, 16);
  }
  for (const x of [5.5, 15.75]) {
    box(k, x, 5.53, -3.5, 1.85, 0.12, 0.64, 'machine');
    lamp(k, x, 5.47, -3.5, COLOR.warm, 44, 14);
  }
  // Shelf-front task lights face the central aisle below the high-bay wash.
  for (const x of [1.2, 10.8]) {
    const side = x === 1.2 ? 1 : -1;
    for (const z of [1.2, -14]) {
      box(k, x + side * 0.53, 4.05, z, 1.06, 0.12, 0.48, 'machine');
      box(k, x + side * 0.91, 3.94, z, 0.23, 0.1, 0.44, 'light_white');
      k.light(x + side * 1.04, 3.88, z, COLOR.warm, 28, 10, {
        groundGlow: false,
      });
    }
  }
  for (const x of [-6.5, 26]) {
    lamp(k, x, 3.3, 1.5, COLOR.warm, 16, 10);
    lamp(k, x, 11.38, -7, COLOR.blue, 22, 14, 3.6);
  }
  // Segments A B C D F G of a seven-segment nine, with slight gaps at the bends.
  // The digit is scaled up so it reads from the far end of the hall.
  const gs = 1.35,
    gy = 3.9,
    gap = 0.7 * gs;
  for (const y of [gy, gy + gap, gy + 2 * gap])
    box(k, 10, y, -37.93, 1.03 * gs, 0.12 * gs, 0.14, 'neon_green');
  for (const [x, y] of [
    [10 - 0.56 * gs, gy + 1.5 * gap],
    [10 + 0.56 * gs, gy + 1.5 * gap],
    [10 + 0.56 * gs, gy + 0.5 * gap],
  ])
    box(k, x, y, -37.93, 0.12 * gs, 0.56 * gs, 0.14, 'neon_green');
  box(k, 10, 6.55, -37.42, 4.7, 0.24, 1.16, 'machine');
  lamp(k, 10, 6.43, -37.4, COLOR.green, 19, 9);
  k.deco('wh_wall_terminal', 15.85, 1.32, -38);
  k.deco('wh_wall_terminal', 21.8, 1.3, 13.75, Math.PI);
  for (const [x, z] of [
    [-3.7, -17.5],
    [20.2, -22.3],
    [8.2, 4.8],
  ]) {
    k.deco('city_vent_grate', x, 0, z);
    k.fx('steam', x, 0.08, z, 0.6);
  }
  k.fx('sparks', -1.68, 8.84, -12.9, 0.7);
  k.fx('drip', -1.68, 8.2, 2.7, 0.5);
  for (const x of [2.2, 9.8, 15.1, 22.8])
    for (const z of [-13.2, -3.3, 6.6])
      mark(k, 'floor_lane_line', x, z, 9.85, 0.65, quarter, COLOR.amber);
  for (const [x, z, w] of [
    [18.9, 2.3, 3.05],
    [9.1, 12.2, 3.05],
    [20.6, 7.4, 6.7],
  ])
    mark(k, 'floor_pallet_bay', x, z, w, 3.25, 0, '#c0a877');
  mark(k, 'oil_stain', 7.5, 2, 2.2, 1.2);
  mark(k, 'tire_marks', 21.4, -18.2, 3.1, 1.8, quarter);
  mark(k, 'crack_floor', -3.7, 11.6, 2.6, 1.3);
  for (const [x, z] of [
    [6, -14],
    [6, -10],
    [10, -19.8],
  ])
    mark(k, 'floor_hazard', x, z, 6.4, 0.7, 0, COLOR.amber);
  for (const [x, z] of [
    [6, 5.3],
    [6, -3.6],
    [10, -21.1],
  ])
    mark(k, 'floor_arrow', x, z, 1.8, 2.1, 0, '#b4a58b');
  for (const [x, z] of [
    [-3.4, 4.5],
    [16.6, -20.8],
    [5.2, 8],
    [22, -3.2],
  ])
    mark(k, 'tire_marks', x, z, 3.8, 2.2, quarter);
  for (const [x, z] of [
    [4.2, 3.6],
    [16.5, -21],
  ])
    mark(k, 'oil_stain', x, z, 3, 1.75);
  mark(k, 'floor_stop', 10, -36.6, 3.8, 0.8, 0, COLOR.green);
  mark(k, 'floor_sector_k09', 9.5, -17.6, 3.5, 1.65, 0, COLOR.green);
  mark(k, 'crack_floor', -5, 8.6, 2.4, 1.2);
  mark(k, 'manhole', 21, -20, 1.1, 1.1);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run1',
    name: 'Magazyn Kurogane Arms',
    weather: 'kuroganeWarehouse',
    bounds: R(-24, 28, -38, 30),
    startX: -15,
    exitX: 10,
  });
  k.arena.arenaMeta({ navigationCellM: 0.5, navigationClearanceM: 0.4 });
  security(k);
  power(k);
  calibration(k);
  dispatch(k);
  k.arena.roomMeta({
    doors: [
      ['entry', -15, 30.5],
      ['exit', 10, -38.5],
    ].map(([role, x, z]) => ({
      id: role,
      role,
      position: vec(x, 1.5, z),
      size: vec(4, 3, 1),
    })),
  });
  for (const [x, z] of [
    [-19, 18],
    [-9, 19],
    [0, 26],
    [0, 17],
    [-20, 10],
    [-15, 3],
    [-16, -5],
    [-3, 9],
    [6, 6],
    [16, 8],
    [-3, -5],
    [17, -5],
    [5, -16],
    [19, -20],
    [2.5, -31.2],
    [23.5, -31],
    [11.5, -24.2],
  ])
    k.arena.spawn(vec(x, 0, z));
  k.finish({
    points: [
      ['A', -19, 0, 18],
      ['B', 0, 0, 17],
      ['C', 6, 0, 6],
    ],
    zones: [
      ['Śluza ochrony', guardRoom, 'interior'],
      ['Rozdzielnia', servers, 'dense'],
      ['Warsztat kalibracji', workshop, 'interior'],
      ['Hala składowania', hall, 'high'],
    ],
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 22 },
  });
  k.arena.arenaMeta({ navigationCellM: 0.5 });
  return k.arena;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generate().write(
    fileURLToPath(
      new URL('../../../src/data/rooms/run1.json', import.meta.url),
    ),
  );
