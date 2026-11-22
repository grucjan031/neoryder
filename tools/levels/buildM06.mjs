// Generator poziomu M06 (wzorzec: tools/levels/buildM01.mjs). Uruchamiac z katalogu repo.
import { writeFileSync, readFileSync } from 'node:fs';
const v = (x, y = 0, z = 0) => ({ x, y, z });
const block = (x, y, z, sx, sy, sz, material = 'concrete', model) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...(model ? { model } : {}),
});
const box = (x, z, length, width) => ({
  kind: 'box',
  position: v(x, 2, z),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const AMBER = '#ffae1a',
  GREEN = '#6dff4a',
  VIOLET = '#8a5cff',
  BLUE = '#3d7bff',
  WHITE = '#fff1d6';
const HALF_PI = Math.PI / 2;

const level = {
  id: 'm06-odlewnia',
  name: 'Huty — Odlewnia',
  type: 'combat',
  theme: 'neonStreet',
  playerSpawn: v(5),
  blocks: [],
  spawnPoints: [],
  signs: [],
  lights: [],
  decor: [],
  decals: [],
  ambientFx: [],
  rainShelters: [],
  hazards: [],
  sections: [],
  checkpoints: [],
  encounters: [],
  gates: [],
  maxAlive: 12,
  objectiveOrder: ['brandt', 'server', 'exit'],
  objectivePositions: {
    brandt: v(192),
    server: v(224, 0, -7.05),
    exit: v(216, 0, -11.5),
  },
};
const B = (...args) => level.blocks.push(block(...args));
const light = (x, y, z, color, intensity, range, extra = {}) =>
  level.lights.push({
    position: v(x, y, z),
    color,
    intensity,
    range,
    ...extra,
  });
const decor = (model, x, y, z, yaw = 0, scale) =>
  level.decor.push({
    model,
    position: v(x, y, z),
    ...(yaw ? { yaw } : {}),
    ...(scale ? { scale } : {}),
  });
const decal = (texture, x, z, w, h, yaw = 0, opacity) =>
  level.decals.push({
    texture,
    position: v(x, 0.01, z),
    size: { w, h },
    yaw,
    surface: 'floor',
    ...(opacity ? { opacity } : {}),
  });
const sign = (kind, texture, x, y, z, w, h, yaw, tint, flicker) =>
  level.signs.push({
    kind,
    texture,
    position: v(x, y, z),
    size: { w, h },
    yaw,
    tint,
    ...(flicker ? { flicker } : {}),
  });
const fx = (kind, x, y, z, rate) =>
  level.ambientFx.push({ kind, position: v(x, y, z), rate });
const cover = (x, z, sx, sz, h = 1.2) =>
  B(x, h / 2, z, sx, h, sz, 'trim', 'cover_low');
const crates = (x, z) =>
  B(x, 0.795, z, 1.212, 1.59, 1.256, 'metal', 'city_crates');
function ramp(start, end, startY, endY, z) {
  const angle = Math.atan2(endY - startY, end - start);
  const thickness = 0.4;
  return {
    ...block(
      (start + end) / 2 + (Math.sin(angle) * thickness) / 2,
      (startY + endY) / 2 - (Math.cos(angle) * thickness) / 2,
      z,
      Math.hypot(end - start, endY - startY),
      thickness,
      2.5,
      'steel_grating',
    ),
    rotation: v(0, 0, angle),
    walkable: true,
  };
}
const DOOR_HALF = 2.5,
  DOOR_H = 4;
/** Przegroda z przejsciem w osi; brama wypelnia otwor. */
function partition(x, halfSpan, height, material = 'concrete') {
  const side = halfSpan - DOOR_HALF;
  for (const s of [-1, 1])
    B(x, height / 2, s * (DOOR_HALF + side / 2), 1, height, side, material);
  B(x, (DOOR_H + height) / 2, 0, 1, height - DOOR_H, DOOR_HALF * 2, material);
}
const gate = (id, x, after, extra = {}) =>
  level.gates.push({
    id,
    block: block(
      x,
      DOOR_H / 2,
      0,
      1,
      DOOR_H,
      DOOR_HALF * 2,
      'hazard_stripes_worn',
    ),
    after,
    ...extra,
  });
function floor(from, to, width, material, z = 0) {
  for (let x = from; x < to; x += 4) B(x + 2, -0.5, z, 4, 1, width, material);
}
function section(id, name, from, to, width, radio) {
  level.sections.push({
    id,
    name,
    zone: box((from + to) / 2, 0, to - from, width),
    ...(radio ? { radio } : {}),
  });
}
function shell(from, to, width, wallH, material, roofUnder) {
  const center = (from + to) / 2,
    length = to - from;
  for (const s of [-1, 1])
    B(center, wallH / 2, s * (width / 2 + 1), length, wallH, 2, material);
  if (roofUnder !== undefined) {
    level.rainShelters.push({
      position: v(center, roofUnder / 2),
      size: v(length, roofUnder, width),
    });
  }
}

// ---------- 1. Sluza chlodnicza (x 0-36, szer. 10, strop 5 m)
section('sluza', 'Śluza chłodnicza', 0, 36, 10);
floor(0, 36, 10, 'concrete_raw_cast');
shell(0, 36, 10, 7, 'concrete', 5);
B(18, 5.5, 0, 36, 1, 10, 'concrete');
B(-1, 3.5, 0, 2, 7, 14, 'concrete');
decor('city_shutter', 0.13, 0, 0, HALF_PI);
cover(13, -3, 1, 3);
crates(22, 3.6);
cover(28, -3, 1, 3);
for (const x of [4, 12, 20, 28]) light(x, 4.3, 0, WHITE, 20, 11);
light(8, 2.6, 4, BLUE, 9, 9);
light(25, 2.6, -4, BLUE, 9, 9);
light(1.6, 2.2, 3, GREEN, 5, 6);
for (const [x, s] of [
  [10, -1],
  [24, -1],
  [17, 1],
  [31, 1],
])
  decor('city_pipe_run', x, 0, s * 4.8, s === 1 ? Math.PI : 0, 0.8);
decor('city_ac_unit', 6, 3, -4.75);
decor('city_ac_unit', 20, 3.2, 4.75, Math.PI);
decor('city_vent_grate', 9, 0, 2.5);
decor('city_vent_grate', 19, 0, -3);
fx('steam', 9, 0.05, 2.5, 4);
fx('steam', 19, 0.05, -3, 4);
fx('drip', 15, 4.8, 1.5, 3);
sign('neon', 'arrow', 32.5, 3.3, -4.85, 2, 1, 0, WHITE);
decal('floor_arrow', 7, 0, 2.4, 2.8, -HALF_PI, 0.55);
decal('floor_hazard', 33.5, 0, 3, 1);
decal('puddle2', 16, 1.5, 3, 2, 0.4, 0.7);

// ---------- 2. Piece wstepne (x 36-84, szer. 24, pod golym niebem)
section('piece', 'Piece wstępne', 36, 84, 24);
floor(36, 84, 24, 'asphalt');
shell(36, 84, 24, 14, 'facade');
partition(36, 14, 14);
for (const x of [46, 60, 74])
  for (const s of [-1, 1]) {
    B(x, 3.5, s * 9.5, 6, 7, 5, 'rust');
    // Palenisko za rusztem: żar widać między prętami.
    B(x, 1.5, s * 6.97, 2.6, 1.4, 0.08, 'neon_amber');
    for (const dx of [-0.87, -0.29, 0.29, 0.87])
      B(x + dx, 1.5, s * 6.88, 0.16, 1.4, 0.1, 'metal');
    B(x, 2.45, s * 6.85, 3.4, 0.5, 0.3, 'metal');
    B(x, 0.4, s * 6.85, 3.4, 0.8, 0.3, 'metal');
    B(x, 5, s * 9.5, 6.2, 0.4, 5.2, 'metal');
    B(x, 7.6, s * 9.5, 4, 1.2, 3, 'metal');
    B(x, 11, s * 10.5, 1.6, 6, 1.6, 'metal');
    light(
      x,
      2.2,
      s * 5.2,
      AMBER,
      15,
      13,
      x === 60
        ? { flicker: { pattern: 'pulse', strength: 0.25, periodS: 3 } }
        : {},
    );
    decal('floor_hazard', x, s * 5.6, 3, 1, 0, 0.7);
  }
B(60, 0.8, -1.5, 6, 1.6, 2.4, 'concrete', 'build_precast_stack');
B(52, 0.6, -2.5, 3, 1.2, 2, 'metal');
B(69, 0.6, 3, 3, 1.2, 2, 'metal');
crates(59.5, 5.2);
cover(77, -2, 1, 3);
cover(45, 3, 1, 3);
// Suwnica z kadzia nad placem.
B(60, 9.5, 0, 1.5, 1, 24, 'crane_paint');
B(60, 8.6, 3, 2, 0.8, 2, 'metal');
B(60, 6.9, 3, 0.3, 2.6, 0.3, 'metal');
B(60, 4.9, 3, 1.8, 1.4, 1.8, 'rust');
B(60, 5.62, 3, 1.4, 0.05, 1.4, 'neon_amber');
light(60, 6.6, 3, AMBER, 10, 10, {
  flicker: { pattern: 'pulse', strength: 0.3, periodS: 2 },
});
decor('rail_signal_gantry', 40, 0, 0);
decor('rail_signal_gantry', 80.5, 0, 0);
light(52, 8, 0, WHITE, 16, 16);
light(68, 8, 0, WHITE, 16, 16);
light(40, 5, 0, WHITE, 12, 12);
sign('holo', 'holo_kurogane', 53, 10.5, -11.85, 7, 3.5, 0, AMBER, 0.15);
sign('holo', 'holo_kurogane', 67, 10.5, 11.85, 7, 3.5, Math.PI, BLUE, 0.15);
sign('neon', 'warsztat', 53, 4.2, 11.85, 4, 2, Math.PI, AMBER, 0.15);
sign('neon', 'arrow', 80.5, 4.6, -11.85, 2.4, 1.2, 0, WHITE);
decor('power_slag_heap', 80, 0, 9, 0, 0.14);
decor('power_slag_heap', 39.5, 0, -9.5, 0, 0.1);
decor('city_generator', 53, 0, -11, 0);
decor('build_pipe_stack', 67, 0, 10.2, 0, 0.7);
decor('city_traffic_cone', 56, 0, 7.5);
decor('city_vent_grate', 67, 0, -8);
fx('steam', 67, 0.05, -8, 5);
fx('sparks', 46, 2.6, -6.6, 0.8);
fx('sparks', 74, 2.6, 6.6, 0.8);
fx('sparks', 60, 5.8, 3, 0.5);
decal('oil_stain', 64, -5, 2.4, 2.4, 0.5, 0.6);
decal('tire_marks', 49, 0.5, 5, 2, 0, 0.6);
decal('puddle1', 71, -1, 4, 2.4, 0.3, 0.8);
decal('puddle2', 42, -4, 3, 2, 1.1, 0.8);
decal('crack_floor', 78, 3, 2.6, 2.6, 0.9, 0.5);

// ---------- 3. Hala formowania (x 84-136, szer. 28, dach 11 m, kladki 4,25 m)
section('formowanie', 'Hala formowania', 84, 136, 28, 'enterNode:3');
floor(84, 136, 28, 'turbine_hall_floor');
shell(84, 136, 28, 12, 'corrugated', 11);
partition(84, 16, 14);
for (const s of [-1, 1]) B(110, 11.5, s * 9.5, 52, 1, 13, 'concrete');
B(110, 11.5, 0, 52, 1, 6, 'glass');
for (const s of [-1, 1]) {
  const z = s * 10.5;
  level.blocks.push(
    { ...block(110, 4, z, 32, 0.5, 2.5, 'steel_grating'), walkable: true },
    ramp(89, 94, 0, 4.25, z),
    ramp(126, 131, 4.25, 0, z),
  );
  for (const railZ of [z - 1.2, z + 1.2])
    B(110, 4.7, railZ, 32, 0.9, 0.1, 'metal');
  for (const x of [96, 110, 124]) B(x, 1.875, z, 0.4, 3.75, 0.4, 'metal');
  for (const x of [100, 120]) light(x, 3.3, z, WHITE, 10, 8);
  B(110, 0.7, s * 13.3, 1.6, 1.4, 1, 'metal', 'city_generator');
  light(110, 2.2, s * 12.2, GREEN, 3, 5);
}
for (const [x, z] of [
  [100, -3],
  [112, 3],
  [124, -3],
]) {
  B(x, 1.5, z, 5, 3, 5, 'metal');
  B(x, 3.1, z, 5.4, 0.2, 5.4, 'rust');
  B(x, 3.22, z, 4.2, 0.05, 4.2, 'neon_amber');
  // Rynna spustowa od strony wejścia: żar na wysokości oczu.
  B(x - 2.54, 1.3, z, 0.08, 1.4, 0.5, 'neon_amber');
  for (const dz of [-0.35, 0.35])
    B(x - 2.56, 1.3, z + dz, 0.12, 1.7, 0.2, 'metal');
  light(x, 4.8, z, AMBER, 15, 13);
  light(x - 3.8, 1.6, z, AMBER, 11, 10);
  decal('floor_hazard', x - 3.6, z, 1, 3, HALF_PI, 0.7);
}
cover(93, 3, 1, 3);
cover(106, -7, 3, 1);
cover(118, 7.5, 3, 1);
cover(131, 3.5, 1, 3);
crates(112, -5);
crates(105.5, 6.5);
for (const x of [97, 110, 123])
  decor('port_warehouse_roof_truss', x, 7.7, 0, HALF_PI);
for (const x of [92, 110, 128]) light(x, 9, 0, WHITE, 34, 20);
sign('holo', 'holo_kurogane', 135.45, 7.5, 0, 8, 4, -HALF_PI, AMBER, 0.15);
sign('neon', 'arrow', 132.5, 4.6, -13.85, 2.4, 1.2, 0, WHITE);
sign('neon', 'repair', 97, 7.5, 13.85, 4, 2, Math.PI, GREEN, 0.2);
decor('city_vent_grate', 106, 0, 1.5);
decor('city_vent_grate', 118, 0, -1.5);
fx('steam', 106, 0.05, 1.5, 5);
fx('steam', 118, 0.05, -1.5, 5);
fx('sparks', 112, 3.6, 3, 0.6);
fx('sparks', 124, 3.6, -3, 0.6);
fx('drip', 90, 10.5, -5, 2);
decal('floor_arrow', 87.5, 0, 2.4, 2.8, -HALF_PI, 0.55);
decal('oil_stain', 108, 4, 2.4, 2.4, 0.4, 0.55);
decal('crack_floor', 121, 2, 2.6, 2.6, 0.6, 0.5);
decal('oil_stain', 127, 6, 2, 2, 1.2, 0.55);

// ---------- 4. Przedpokoj sztabu (x 136-172, szer. 14, strop 6 m)
section('przedpokoj', 'Przedpokój sztabu', 136, 172, 14, 'enterNode:6');
floor(136, 172, 14, 'power_quay_floor');
shell(136, 172, 14, 8, 'concrete', 6);
partition(136, 16, 13);
B(154, 6.5, 0, 36, 1, 14, 'concrete');
// Dyzurka nadzorcy z przeszklonym frontem.
B(150, 1.75, 5.75, 6, 3.5, 2.5, 'trim');
B(150, 2.1, 4.44, 5, 1.6, 0.1, 'glass');
light(150, 2.8, 3.4, BLUE, 8, 7);
light(147.4, 1.4, 4.2, GREEN, 3, 4);
B(146, 3, -3.5, 1.2, 6, 1.2, 'trim', 'pillar');
B(162, 3, 3.5, 1.2, 6, 1.2, 'trim', 'pillar');
cover(143, 2.5, 1, 3);
cover(155, -3, 1, 3);
cover(164, -2.5, 3, 1);
crates(158, 5.5);
light(145, 5.2, 0, WHITE, 16, 11);
light(163, 5.2, 0, WHITE, 16, 11);
light(141, 3.4, -6, BLUE, 9, 9);
light(156, 3.4, -6, VIOLET, 9, 9);
light(166, 3.4, 6, BLUE, 9, 9);
light(170, 4.6, 0, VIOLET, 10, 8);
sign('holo', 'holo_kurogane', 171.45, 5, 0, 3, 1.5, -HALF_PI, VIOLET, 0.1);
sign('neon', 'arrow', 167.5, 3.8, -6.85, 2, 1, 0, WHITE);
decor('city_pipe_run', 140, 0, -6.8, 0, 0.95);
decor('city_pipe_run', 160, 0, 6.8, Math.PI, 0.95);
decor('city_ac_unit', 152, 4, -6.75);
decor('city_vent_grate', 139, 0, 4);
fx('steam', 139, 0.05, 4, 3);
decal('floor_stop', 168.5, 0, 3, 1, HALF_PI);
decal('floor_hazard', 170.5, 0, 1, 4, 0, 0.7);

// ---------- 5. Centrum dowodzenia: arena (x 172-212, szer. 32, dach 13 m), gabinet i winda
section('centrum', 'Centrum dowodzenia', 172, 212, 32, 'enterNode:7');
for (let x = 172; x < 212; x += 4) {
  if (x >= 180 && x < 204) {
    B(x + 2, -0.5, 0, 4, 1, 20, 'ship_deck_steel');
    for (const s of [-1, 1])
      B(x + 2, -0.5, s * 13, 4, 1, 6, 'turbine_hall_floor');
  } else B(x + 2, -0.5, 0, 4, 1, 32, 'turbine_hall_floor');
}
shell(172, 212, 32, 15, 'concrete', 13);
partition(172, 18, 15);
for (const s of [-1, 1]) B(192, 13.5, s * 10.5, 40, 1, 15, 'concrete');
B(192, 13.5, 0, 40, 1, 6, 'glass');
// Kanal odlewniczy po obu stronach plyty.
for (const s of [-1, 1]) {
  B(192, 0.3, s * 13.5, 22, 0.6, 2, 'metal');
  B(192, 0.62, s * 13.5, 21.4, 0.05, 1.4, 'neon_amber');
  for (const x of [185, 199]) light(x, 1.6, s * 12.4, AMBER, 16, 13);
  B(191, 6.5, s * 10.9, 1.4, 13, 1.4, 'concrete');
  for (const x of [177, 207]) {
    decor('city_shutter', x, 0, s * 15.87, s === 1 ? Math.PI : 0);
    light(x, 3.6, s * 14.6, WHITE, 6, 7);
    level.spawnPoints.push({ x, z: s * 12 });
  }
  fx('steam', 180.5, 0.05, s * 13.5, 5);
  fx('steam', 203.5, 0.05, s * 13.5, 5);
  fx('sparks', 192, 1.2, s * 13.5, 0.5);
}
cover(184, -5, 1, 3.5, 1.4);
cover(184, 5, 1, 3.5, 1.4);
cover(198, -6, 3.5, 1, 1.4);
cover(198, 6, 3.5, 1, 1.4);
for (const x of [181, 192, 203])
  decor('port_warehouse_roof_truss', x, 9.4, 0, HALF_PI, 1.1);
light(184, 10.5, 0, WHITE, 38, 22);
light(200, 10.5, 0, WHITE, 38, 22);
light(175, 4.5, 0, WHITE, 10, 10);
light(209, 3.2, -5.5, BLUE, 16, 12);
light(209, 3.2, 5.5, VIOLET, 16, 12);
sign('holo', 'holo_kurogane', 211.45, 9, 0, 10, 5, -HALF_PI, BLUE, 0.1);
sign('holo', 'holo_android', 211.45, 8, -12, 2.5, 5, -HALF_PI, VIOLET, 0.2);
sign('holo', 'holo_implant', 211.45, 8, 12, 2.5, 5, -HALF_PI, BLUE, 0.2);
decal('floor_hazard', 192, 0, 4, 4, 0, 0.7);
decal('floor_arrow', 176, 0, 2.4, 2.8, -HALF_PI, 0.55);
decal('oil_stain', 188, -8, 2.4, 2.4, 0.3, 0.5);
decal('crack_floor', 201, 3, 2.6, 2.6, 0.7, 0.5);
// Sciana gabinetu: pancerna szyba po bokach wrot.
for (const s of [-1, 1]) {
  B(212, 7.5, s * 13, 1, 15, 10, 'concrete');
  B(212, 2, s * 5.25, 0.3, 4, 5.5, 'glass');
}
B(212, 9.5, 0, 1, 11, 16, 'concrete');
// Gabinet Brandta z serwerem (x 212-228, szer. 16) i szyb windy towarowej.
floor(212, 228, 16, 'gas_station_tiles');
B(220, 3, 9, 16, 6, 2, 'concrete');
B(229, 3, 0, 2, 6, 20, 'concrete');
B(213, 3, -8.25, 2, 6, 0.5, 'concrete');
B(223, 3, -8.25, 10, 6, 0.5, 'concrete');
B(216, 5, -8.25, 4, 2, 0.5, 'concrete');
B(220, 6.5, 0, 18, 1, 18, 'concrete');
B(216, -0.5, -11, 8, 1, 6, 'steel_grating');
B(220.5, 3, -11.25, 1, 6, 5.5, 'concrete');
B(216.25, 3, -14.5, 9.5, 6, 1, 'concrete');
B(216, 6.5, -11.25, 9, 1, 6.5, 'concrete');
B(224.5, 3, -11.5, 7, 6, 6, 'concrete');
level.rainShelters.push({ position: v(220, 3, -3), size: v(16, 6, 24) });
for (const x of [219, 221.5, 224, 226.5])
  B(x, 1.2, 7.4, 1.4, 2.4, 0.9, 'container_graphite');
B(226.6, 0.45, -1, 1.4, 0.9, 3.2, 'trim');
light(222, 2.4, 6.2, GREEN, 5, 6);
light(218, 4.6, 1, WHITE, 14, 11);
light(225, 4.2, 3, BLUE, 9, 9);
light(226, 1.6, -1, AMBER, 5, 5);
light(224, 3.2, -5.4, VIOLET, 9, 8);
light(216, 4.4, -11, WHITE, 12, 9);
sign('holo', 'holo_kurogane', 227.95, 3.4, 2, 4, 2, -HALF_PI, BLUE, 0.1);
decal('floor_arrow', 216, -9.6, 1.8, 2.1, 0, 0.55);

// ---------- Spotkania, bramy, punkty kontrolne
const points = (list) => list.map(([x, z]) => ({ x, z }));
level.encounters.push(
  {
    id: 'patrol-sluza',
    zone: box(14, 0, 12, 10),
    wave: 'm06Sluza',
    spawnPoints: points([
      [25, -3],
      [26, 2.5],
      [31, -2],
      [31, 2.5],
    ]),
  },
  {
    id: 'piece',
    zone: box(44, 0, 12, 24),
    wave: 'm06Piece',
    spawnPoints: points([
      [62, -5.5],
      [64, 5.5],
      [70, -4],
      [72.5, 5.5],
      [53, 9.5],
      [67, -9.5],
    ]),
    after: encounter('patrol-sluza'),
  },
  {
    id: 'formowanie-front',
    zone: box(92, 0, 12, 28),
    wave: 'm06Formowanie',
    spawnPoints: points([
      [105, 2],
      [107, -3.5],
      [108, 8],
      [103, -8.5],
    ]),
    after: encounter('piece'),
  },
  {
    id: 'formowanie-tyl',
    zone: box(113, 0, 14, 28),
    wave: 'm06Rozdzielnia',
    spawnPoints: points([
      [128, -7],
      [129, 6],
      [132, -2],
      [124, 7.5],
    ]),
    after: encounter('formowanie-front'),
  },
  {
    id: 'straz',
    zone: box(143, 0, 10, 14),
    wave: 'm06Straz',
    spawnPoints: points([
      [158, -5],
      [160, 0.5],
      [166, 3],
      [167, -4],
    ]),
    after: encounter('formowanie-tyl'),
  },
  {
    id: 'brandt',
    zone: box(195, 0, 30, 32),
    wave: 'm06Brandt',
    spawnPoints: points([[205, 0]]),
    after: encounter('straz'),
    bossFor: 'brandt',
  },
);
gate('gate-sluza', 36, encounter('patrol-sluza'));
gate('gate-piece', 84, encounter('piece'));
gate('gate-formowanie', 136, encounter('formowanie-tyl'));
gate('gate-sztab', 172, encounter('straz'), { closedDuring: 'brandt' });
gate('gate-gabinet', 212, objective('brandt'));
level.gates.push({
  id: 'gate-winda',
  block: block(216, 2, -8.25, 4, 4, 0.5, 'hazard_stripes_worn'),
  after: objective('server'),
});
for (const [id, x, width, after] of [
  ['start', 5, 10],
  ['piece', 40, 24, encounter('patrol-sluza')],
  ['formowanie', 88, 28, encounter('piece')],
  ['przedpokoj', 140, 14, encounter('formowanie-tyl')],
  ['przed-arena', 167, 14, encounter('straz')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: box(x, 0, 6, width),
    ...(after ? { after } : {}),
  });
level.checkpoints.push({
  id: 'po-brandcie',
  position: v(204),
  yawDeg: -90,
  zone: box(200, 0, 56, 36),
  after: objective('brandt'),
});
writeFileSync(
  'src/data/levels/m06-odlewnia.json',
  JSON.stringify(level, null, 2) + '\n',
);

for (const [id, waves, extra] of [
  [
    'm06Sluza',
    [
      [
        ['assaulter', 2],
        ['gunner', 1],
      ],
    ],
  ],
  [
    'm06Piece',
    [
      [
        ['assaulter', 3],
        ['gunner', 2],
        ['drone', 1],
      ],
    ],
  ],
  [
    'm06Formowanie',
    [
      [
        ['shielder', 2],
        ['gunner', 2],
        ['turret', 1],
      ],
    ],
  ],
  [
    'm06Rozdzielnia',
    [
      [
        ['drone', 2],
        ['assaulter', 3],
        ['gunner', 1],
      ],
    ],
  ],
  [
    'm06Straz',
    [
      [
        ['executor', 1],
        ['shielder', 1],
        ['sniper', 1],
        ['gunner', 1],
      ],
    ],
  ],
  [
    'm06Brandt',
    [[['securityChief', 1]]],
    { firstBreakS: 5, maxAlive: 1, minSpawnDistance: 0 },
  ],
]) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive: 8,
    waves: waves.map((groups) => ({
      spawnIntervalS: 0.5,
      groups: groups.map(([enemy, count]) => ({ enemy, count })),
    })),
    ...extra,
  });
  writeFileSync(
    `src/data/waves/${id}.json`,
    JSON.stringify(wave, null, 2) + '\n',
  );
}

// Dane misji: poziom liniowy zamiast sekwencji pokoi runu.
const path = 'src/data/missions/m06-odlewnia.json';
const mission = JSON.parse(readFileSync(path, 'utf8'));
const { id, ...rest } = mission;
delete rest.level;
delete rest.typeWeights;
delete rest.roomPools;
delete rest.enemies;
rest.fixedNodes = rest.fixedNodes
  .filter((node) => node.final)
  .map((node) => {
    const copy = { ...node };
    delete copy.guards;
    return copy;
  });
writeFileSync(
  path,
  JSON.stringify({ id, level: 'm06-odlewnia', ...rest }, null, 2) + '\n',
);
