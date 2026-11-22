// Generator poziomu M03 „List przewozowy”. Uruchom z katalogu repo:
//   node <ten plik>
import { writeFileSync, readFileSync } from 'node:fs';

const r = (n) => Math.round(n * 1000) / 1000;
const v = (x, y = 0, z = 0) => ({ x: r(x), y: r(y), z: r(z) });
const AMBER = '#ffae1a';
const GREEN = '#6dff4a';
const VIOLET = '#8a5cff';
const BLUE = '#3d7bff';
const WHITE = '#fff1d6';
const WATER_Y = -1.6;

const level = {
  id: 'm03-list-przewozowy',
  name: 'Huty — Magazyn 9',
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
  objectiveOrder: ['terminal', 'exit'],
  objectivePositions: { terminal: v(201), exit: v(244, 0, -12.6) },
};

// Bryła z zakresów; extra: model, visible, walkable.
function box(x0, x1, y0, y1, z0, z1, material = 'concrete', extra = {}) {
  const b = {
    position: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    size: v(x1 - x0, y1 - y0, z1 - z0),
    material,
    ...extra,
  };
  level.blocks.push(b);
  return b;
}
const hidden = (x0, x1, y0, y1, z0, z1) =>
  box(x0, x1, y0, y1, z0, z1, 'concrete', { visible: false });
function floor(x0, x1, z0, z1, material) {
  for (let x = x0; x < x1; x += 4)
    box(x, Math.min(x + 4, x1), -1, 0, z0, z1, material);
}
function prop(model, x, y, z, yaw, scale) {
  level.decor.push({
    model,
    position: v(x, y, z),
    ...(yaw ? { yaw: r(yaw) } : {}),
    ...(scale ? { scale } : {}),
  });
}
const DIMS = {
  c20: [6.058, 2.591, 2.438],
  c40: [12.192, 2.591, 2.438],
  city_crates: [1.212, 1.59, 1.256],
  city_generator: [1.6, 1.4, 1.005],
  city_barrier: [2, 0.929, 0.51],
  city_highway_barrier: [4, 1.093, 0.808],
  city_dumpster: [1.97, 1.33, 1.08],
  city_wrecked_car: [2.15, 1.58, 3.95],
  port_reach_stacker: [6.06, 5.756, 11.105],
  port_freight_boxcar: [14, 4.2, 3],
};
// Przeszkoda z modelem: wzdłuż X jako blok z modelem, obrócona o 90° jako
// dekor + niewidoczny collider (walidacja układu liczy nieobrócony obrys).
function cover(
  model,
  x,
  z,
  { turned = false, material = 'metal', y = 0 } = {},
) {
  const key = model.startsWith('port_container_20')
    ? 'c20'
    : model.startsWith('port_container_40')
      ? 'c40'
      : model;
  const [sx, sy, sz] = DIMS[key];
  if (!turned) {
    box(x - sx / 2, x + sx / 2, y, y + sy, z - sz / 2, z + sz / 2, material, {
      model,
    });
    return;
  }
  hidden(x - sz / 2, x + sz / 2, y, y + sy, z - sx / 2, z + sx / 2);
  prop(model, x, y, z, Math.PI / 2);
}
const COLORS = ['navy', 'olive', 'ochre', 'graphite'];
const container = (len, color, x, z, opts = {}) =>
  cover(`port_container_${len}_${color}`, x, z, {
    ...opts,
    material: `container_${color}`,
  });
// Ściana z kontenerów wzdłuż X: lista [długość 20|40], poziomy, pominięcia na górze.
function containerWall(x0, z, pattern, levels, seed, skipTop = []) {
  let x = x0;
  pattern.forEach((len, index) => {
    const length = len === 40 ? 12.192 : 6.058;
    for (let lv = 0; lv < levels; lv++) {
      if (lv === levels - 1 && skipTop.includes(index)) continue;
      container(
        len,
        COLORS[(seed + index * 3 + lv * 5) % 4],
        x + length / 2,
        z,
        {
          y: lv * 2.591,
        },
      );
    }
    x += length;
  });
  return x;
}
function light(x, y, z, color, intensity = 14, range = 18, flicker) {
  level.lights.push({
    position: v(x, y, z),
    color,
    intensity,
    range,
    ...(flicker ? { flicker } : {}),
  });
}
function sign(texture, x, y, z, w, h, yaw, tint, kind = 'neon') {
  level.signs.push({
    kind,
    texture,
    position: v(x, y, z),
    size: { w, h },
    yaw: r(yaw),
    tint,
  });
}
function decal(texture, x, z, w, h, yaw = 0) {
  level.decals.push({
    texture,
    position: v(x, 0.01, z),
    size: { w, h },
    yaw: r(yaw),
    surface: 'floor',
  });
}
// Cyfra siedmiosegmentowa z zielonych neonów; face: '-x' (patrzymy w +X) lub '-z' (patrzymy w +Z).
const SEGMENTS = { 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function digit(n, face, cx, cy, cz, h, w, t = 0.26) {
  const half = h / 2;
  const shape = {
    a: [0, half, w, t],
    g: [0, 0, w, t],
    d: [0, -half, w, t],
    f: [-w / 2, half / 2, t, half],
    b: [w / 2, half / 2, t, half],
    e: [-w / 2, -half / 2, t, half],
    c: [w / 2, -half / 2, t, half],
  };
  for (const key of SEGMENTS[n]) {
    const [u, dy, su, sy] = shape[key];
    if (face === '-x')
      box(
        cx - 0.06,
        cx + 0.06,
        cy + dy - sy / 2,
        cy + dy + sy / 2,
        cz + u - su / 2,
        cz + u + su / 2,
        'neon_green',
      );
    else
      box(
        cx - u - su / 2,
        cx - u + su / 2,
        cy + dy - sy / 2,
        cy + dy + sy / 2,
        cz - 0.06,
        cz + 0.06,
        'neon_green',
      );
  }
}
const zone = (x, length, width = 36) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const points = (list) => list.map(([x, z]) => ({ x, z }));

// ---------------------------------------------------------------- 1. kanał kablowy
floor(0, 28, -4, 4, 'concrete');
box(-2, 0, 0, 6, -6, 6, 'canal_stone_wall');
box(0, 28, 0, 6, 4, 6, 'canal_stone_wall');
box(0, 28, 0, 6, -6, -4, 'canal_stone_wall');
box(0, 28, 5, 6, -6, 6, 'overpass_concrete');
for (const x of [4, 12, 20]) light(x, 4.3, 0, WHITE, 40, 14);
level.rainShelters.push({ position: v(14, 3), size: v(28, 8, 12) });
level.ambientFx.push(
  { kind: 'drip', position: v(9, 4.9, 1.5), rate: 5 },
  { kind: 'drip', position: v(19, 4.9, -2), rate: 4 },
  { kind: 'steam', position: v(23, 0, -2.6), rate: 2 },
);
cover('city_crates', 15, 2.9);
cover('city_crates', 16.4, 2.8);
prop('city_pipe_run', 8, 0, -3.85);
prop('city_pipe_run', 21, 0, 3.85, Math.PI);
prop('city_vent_grate', 23, 0, -2.6);
prop('city_trash_bags', 11, 0, -3.2);
decal('puddle2', 10, 0.5, 4, 2.5);
decal('puddle1', 20, -1, 3.5, 2);
decal('manhole', 4, 1.6, 1.5, 1.5);
decal('floor_arrow', 25, 0, 3, 3, -Math.PI / 2);

// ---------------------------------------------------------------- 2. nabrzeże
floor(28, 84, -14, 14, 'quay_concrete');
// Portal kanału.
box(27, 29, 0, 9, 4, 14.2, 'overpass_concrete');
box(27, 29, 0, 9, -14.3, -4, 'overpass_concrete');
box(27, 29, 5, 9, -4, 4, 'overpass_concrete');
box(26.8, 27, 4.4, 5, -4, 4, 'hazard');
// Krawędź wody (południe): niewidoczna bariera, moduły nabrzeża, pachołki.
hidden(28, 84, 0, 8, -14.3, -14);
for (let x = 30; x <= 82; x += 4) prop('port_quay_edge', x, -2, -14.8, Math.PI);
for (let x = 34; x <= 82; x += 8)
  prop(x % 16 === 2 ? 'port_bollard_rope' : 'port_bollard', x, 0, -13.2);
// Zamknięta stołówka portowa (ciepła biel).
box(29, 41, 0, 9, 14, 20, 'facade');
sign('bar_mleczny', 35, 5.4, 13.85, 5, 2, Math.PI, WHITE);
prop('city_shutter', 34, 0, 13.87, Math.PI);
prop('city_door', 38.6, 0, 13.87, Math.PI);
prop('city_awning', 34, 3.2, 13.4);
prop('city_trash_bags', 31, 0, 13.2);
prop('city_vending', 40.2, 0, 13.5, Math.PI);
light(35, 4, 11.5, WHITE, 16, 18);
// Ściana kontenerów od północy.
containerWall(41, 15.219, [40, 40, 40, 20], 3, 0, [1, 3]);
box(83.25, 83.5, 0, 7, 14, 16.5, 'corrugated');
// Tablica doku 7.
box(57.5, 60.5, 4.3, 7.7, 13.86, 14.02, 'metal');
digit(7, '-z', 59, 6, 13.8, 2.2, 1.3);
light(59, 5, 11.5, GREEN, 12, 14);
// Suwnica bramowa w poprzek nabrzeża i jej wózki.
prop('port_gantry_crane', 58, 0, 0, Math.PI / 2);
hidden(53.6, 62.4, 0, 2.6, 11.3, 12.7);
hidden(53.6, 62.4, 0, 2.6, -12.7, -11.3);
light(58, 7, -9, AMBER, 18, 20, { pattern: 'pulse', periodS: 1.6 });
light(58, 7, 9, AMBER, 18, 20, { pattern: 'pulse', periodS: 1.6 });
// Osłony: zakosy między kontenerami, wózek kontenerowy od północy.
container(20, 'navy', 42, 5);
container(20, 'ochre', 50.5, -6);
cover('city_crates', 46.4, -1.2);
cover('city_crates', 47.8, -1);
container(40, 'graphite', 70, -4.5);
container(20, 'olive', 67, -4.5, { y: 2.591 });
cover('port_reach_stacker', 68, 7);
cover('city_generator', 62.6, 8.4);
cover('city_barrier', 79, 1, { turned: true, material: 'concrete' });
cover('city_barrier', 79, 3.1, { turned: true, material: 'concrete' });
cover('city_crates', 60, -9);
cover('city_dumpster', 33, -11.5);
prop('port_light_tower', 46, 0, 19.5);
prop('city_traffic_cone', 37, 0, -2);
prop('city_traffic_cone', 77, 0, -9);
decal('tire_marks', 45, 0, 6, 2.5);
decal('puddle1', 56, 3, 5, 2.5);
decal('oil_stain', 66, 0, 2.5, 2.5);
decal('floor_hazard', 58, -9, 3, 1);
decal('puddle2', 74, 10, 4, 2);
decal('floor_arrow', 80, -3, 3, 3, -Math.PI / 2);
level.ambientFx.push({ kind: 'steam', position: v(52, 0, 11), rate: 2 });
// Woda kanału portowego i kontenerowiec przy nabrzeżu.
box(28, 152, WATER_Y - 1, WATER_Y, -62, -14, 'canal_water');
prop('port_ship_stern', 47, -3, -34);
prop('port_ship_mid', 77, -3, -34);
prop('port_ship_mid', 107, -3, -34);
prop('port_ship_bow', 136, -3, -34);
prop('dock_mooring_post', 31, -2.8, -16.6);
prop('dock_mooring_post', 83, -2.8, -16.6);

// Brama celna x=84.
box(83.5, 84.5, 0, 7, -14.3, -4, 'corrugated');
box(83.5, 84.5, 0, 7, 4, 14, 'corrugated');
box(83.4, 84.6, 7, 7.7, -14.3, 14, 'metal');
box(83.3, 83.5, 5.6, 6.6, -4, 4, 'hazard');
light(80.5, 4.6, 0, AMBER, 14, 14);

// ---------------------------------------------------------------- 3. plac celny
floor(84, 132, -12, 12, 'quay_concrete');
let end = containerWall(84.5, -13.219, [40, 40, 40, 20], 3, 1, [0, 2]);
box(end, 131.5, 0, 6, -14.44, -12, 'corrugated');
sign('arrow', 90, 4.3, -11.9, 2, 1, 0, GREEN);
// Biura dyspozytorskie: błękit i fiolet.
box(84.5, 110, 0, 11, 12, 18, 'facade');
sign('warsztat', 92, 6, 11.85, 5, 2, Math.PI, BLUE);
sign('open', 104, 5.4, 11.85, 4, 1.6, Math.PI, VIOLET);
light(92, 4.4, 10.4, BLUE, 14, 18);
light(104, 4.4, 10.4, VIOLET, 14, 18);
prop('city_door', 97, 0, 11.87, Math.PI);
prop('city_shutter', 88, 0, 11.87, Math.PI);
prop('city_ac_unit', 100.5, 3.1, 11.75, Math.PI);
prop('city_ac_unit', 107, 6.5, 11.75, Math.PI);
end = containerWall(110, 13.219, [40, 20], 3, 2, [1]);
box(end, 131.5, 0, 6, 12, 14.44, 'corrugated');
// Tablica doku 8.
box(116.5, 119.5, 4.3, 7.7, 11.84, 11.98, 'metal');
digit(8, '-z', 118, 6, 11.78, 2.2, 1.3);
light(118, 5, 9.5, GREEN, 12, 14);
prop('port_light_tower', 124, 0, 18.5);
// Wyspa kontenerów z przesmykiem i dwie zapory laserowe.
container(40, 'navy', 100.1, 0);
container(20, 'ochre', 97.1, 0, { y: 2.591 });
container(40, 'olive', 115.9, 0);
container(20, 'graphite', 118.9, 0, { y: 2.591 });
level.hazards.push(
  {
    id: 'laser-cel-poludnie',
    kind: 'laser_gate',
    from: v(100, 0.7, -11.6),
    to: v(100, 0.7, -1.5),
    cycle: { onS: 2.5, offS: 2 },
  },
  {
    id: 'laser-cel-polnoc',
    kind: 'laser_gate',
    from: v(116, 0.7, 1.5),
    to: v(116, 0.7, 11.6),
    cycle: { onS: 2.5, offS: 2, offsetS: 1.2 },
  },
);
box(99.8, 100.2, 0, 1.4, -11.95, -11.65, 'hazard');
box(115.8, 116.2, 0, 1.4, 11.65, 11.95, 'hazard');
cover('city_crates', 90, 6.5);
cover('city_crates', 91.4, 6.3);
cover('city_barrier', 92, -6, { turned: true, material: 'concrete' });
cover('city_generator', 108, -8.6);
cover('city_highway_barrier', 126, 6, { material: 'concrete' });
cover('city_crates', 126.6, -5.4);
cover('city_dumpster', 110.5, 10.6);
prop('city_traffic_cone', 106.4, 0, -2.2);
prop('city_traffic_cone', 109.6, 0, 2.2);
prop('city_holo_projector', 88.5, 0, -9.5);
decal('floor_stop', 87, 0, 3, 1);
decal('floor_hazard', 100, -6.5, 3, 1, Math.PI / 2);
decal('floor_hazard', 116, 6.5, 3, 1, Math.PI / 2);
decal('floor_arrow', 108, 0, 3, 3, 0);
decal('puddle1', 104, 7, 5, 2.5);
decal('oil_stain', 121, -6, 2.5, 2.5);
decal('crack_floor', 113, -5, 3, 3);
level.ambientFx.push(
  { kind: 'sparks', position: v(100, 1.4, -11.8), rate: 1 },
  { kind: 'steam', position: v(127, 0, 9), rate: 2 },
);

// Brama placu x=132.
box(131.5, 132.5, 0, 7, -15.2, -4, 'corrugated');
box(131.5, 132.5, 0, 7, 4, 15.2, 'corrugated');
box(131.4, 132.6, 7, 7.7, -15.2, 15.2, 'metal');
box(131.3, 131.5, 5.6, 6.6, -4, 4, 'hazard');
light(128.5, 4.6, 0, AMBER, 14, 14);

// ---------------------------------------------------------------- 4. przedpole Magazynu 9
floor(132, 176, -15, 15, 'quay_concrete');
end = containerWall(132.5, -16.219, [40, 40, 40, 20], 3, 3, [0, 3]);
box(end, 176, 0, 7.7, -17.44, -15, 'corrugated');
sign('arrow', 137, 4.3, -14.9, 2, 1, 0, GREEN);
box(132.5, 150, 0, 12, 15, 21, 'facade');
sign('repair', 141, 6.2, 14.85, 5, 2, Math.PI, VIOLET);
light(141, 4.6, 13, VIOLET, 14, 18);
prop('city_shutter', 138, 0, 14.87, Math.PI);
prop('city_door', 146, 0, 14.87, Math.PI);
prop('city_ac_unit', 143, 3.2, 14.75, Math.PI);
end = containerWall(150, 16.219, [40, 40], 3, 1, [1]);
box(end, 176, 0, 7.7, 15, 17.44, 'corrugated');
cover('port_freight_boxcar', 161, 12.6);
container(20, 'graphite', 146, -7, { turned: true });
container(20, 'ochre', 156, 6, { turned: true });
cover('city_wrecked_car', 140, -9.5);
cover('city_crates', 150, 2.5);
cover('city_crates', 151.3, 3.2);
cover('city_generator', 139.5, 10.5);
cover('city_crates', 161, -5);
cover('city_barrier', 166, -6.2, { turned: true, material: 'concrete' });
cover('city_barrier', 166, -4.1, { turned: true, material: 'concrete' });
cover('city_barrier', 166, 4.1, { turned: true, material: 'concrete' });
cover('city_barrier', 166, 6.2, { turned: true, material: 'concrete' });
cover('city_dumpster', 172, -12.5);
prop('port_light_tower', 158, 0, -20.5);
prop('port_bollard', 171, 0, -4.2);
prop('port_bollard', 171, 0, 4.2);
light(152, 5, -12, AMBER, 14, 18, { pattern: 'pulse', periodS: 2.2 });
light(166, 4.5, 0, WHITE, 16, 16);
decal('tire_marks', 152, -1, 6, 2.5);
decal('floor_stop', 170, 0, 3, 1);
decal('puddle2', 144, 3, 4.5, 2.5);
decal('puddle1', 162, -10, 5, 2.5);
decal('oil_stain', 157, -2, 2.5, 2.5);
decal('floor_hazard', 173.5, 0, 3, 1);
level.ambientFx.push({ kind: 'steam', position: v(169, 0, 12), rate: 2 });

// ---------------------------------------------------------------- 5. Magazyn 9
const HX0 = 176;
const HX1 = 226;
const TX = 201;
floor(HX0, HX1, -16, 16, 'turbine_hall_floor');
// Ściany czołowe z otworami wrót 6 × 4,5 m; blacha to panele GLB.
for (const [x0, x1, yaw, px] of [
  [HX0, HX0 + 1, -Math.PI / 2, HX0 + 1],
  [HX1 - 1, HX1, Math.PI / 2, HX1 - 1],
]) {
  hidden(x0, x1, 0, 10, -16, -3);
  hidden(x0, x1, 0, 10, 3, 16);
  for (const z of [-12, -6, 6, 12])
    prop('port_warehouse_shell_panel', px, 0, z, yaw);
  // Rama i nadproże wrót.
  const out = yaw < 0 ? x0 - 0.7 : x0;
  box(out, out + 1.7, 4.5, 10, -3, 3, 'corrugated');
  box(out, out + 1.7, 0, 4.5, -3.5, -3, 'metal');
  box(out, out + 1.7, 0, 4.5, 3, 3.5, 'metal');
  box(x0, x1, 10, 13.3, -16, 16, 'corrugated');
}
for (const side of [-1, 1]) {
  hidden(HX0, HX1, 0, 10, side === 1 ? 15 : -16, side === 1 ? 16 : -15);
  for (let x = HX0 + 4; x < HX1; x += 6)
    prop(
      'port_warehouse_shell_panel',
      x,
      0,
      side * 15,
      side === 1 ? 0 : Math.PI,
    );
  box(
    HX0,
    HX1,
    10,
    13.3,
    side === 1 ? 15 : -16,
    side === 1 ? 16 : -15,
    'corrugated',
  );
  // Tło za panelami, żeby świetliki nie pokazywały pustki.
  box(
    HX0,
    HX1,
    0,
    10,
    side === 1 ? 15.76 : -16.8,
    side === 1 ? 16.8 : -15.76,
    'corrugated',
  );
}
box(HX0, HX1, 13.3, 13.8, -16.8, 16.8, 'roof_tar');
for (let x = HX0 + 4; x < HX1; x += 6)
  prop('port_warehouse_roof_truss', x, 10, 0, Math.PI / 2);
level.rainShelters.push({ position: v(TX, 7), size: v(50, 14, 33.6) });
// Zielona dziewiątka nad wrotami.
digit(9, '-x', HX0 - 0.78, 7.3, 0, 3, 1.7, 0.3);
light(HX0 - 4, 6.4, 0, GREEN, 16, 16);
// Galerie boczne z rampami.
function ramp(start, endX, startY, endY, z) {
  const angle = Math.atan2(endY - startY, endX - start);
  const thickness = 0.4;
  level.blocks.push({
    position: v(
      (start + endX) / 2 + (Math.sin(angle) * thickness) / 2,
      (startY + endY) / 2 - (Math.cos(angle) * thickness) / 2,
      z,
    ),
    size: v(Math.hypot(endX - start, endY - startY), thickness, 2.5),
    material: 'steel_grating',
    rotation: { x: 0, y: 0, z: angle },
    walkable: true,
  });
}
for (const side of [-1, 1]) {
  const z = side * 12.5;
  box(TX - 12, TX + 12, 3.75, 4.25, z - 1.25, z + 1.25, 'steel_grating', {
    walkable: true,
  });
  ramp(TX - 17, TX - 12, 0, 4.25, z);
  ramp(TX + 12, TX + 17.4, 4.25, 0, z);
  for (const railZ of [z - 1.2, z + 1.2])
    box(TX - 12, TX + 12, 4.25, 5.15, railZ - 0.05, railZ + 0.05, 'metal');
  for (const x of [TX - 10, TX + 10])
    box(x - 0.25, x + 0.25, 0, 4, z - 0.25, z + 0.25, 'metal');
  for (const x of [TX - 8, TX, TX + 8]) light(x, 3.3, z, WHITE, 16, 9);
  // Składowane kontenery przy rampach.
  container(20, side === 1 ? 'navy' : 'ochre', TX - 14, side * 7.5);
  container(20, side === 1 ? 'graphite' : 'olive', TX + 14, side * 7.5);
}
// Osłony: poza kręgiem 6 m pełne, w kręgu tylko dwie skrzynki.
container(20, 'olive', TX - 8.5, 6.5);
container(20, 'graphite', TX + 8.5, -6.5);
cover('city_crates', TX - 6, -5.5);
cover('city_crates', TX - 7.3, -5.2);
cover('city_crates', TX + 6, 5.5);
cover('city_crates', TX + 7.3, 5.2);
cover('city_barrier', TX - 6.9, 0, { turned: true, material: 'concrete' });
cover('city_barrier', TX + 6.9, 0, { turned: true, material: 'concrete' });
for (const [x, z] of [
  [TX - 2.6, -2.7],
  [TX + 2.6, 2.7],
])
  level.blocks.push({
    position: v(x, 0.5, z),
    size: v(1, 1, 1),
    model: 'crate',
  });
cover('city_generator', HX0 + 3, -13.5);
cover('city_generator', HX1 - 3, 13.5);
cover('city_dumpster', HX1 - 4, -13.6);
light(TX - 2, 3, 1.6, BLUE, 18, 12);
light(TX + 2, 3, -1.6, BLUE, 18, 12);
for (const x of [TX - 13, TX, TX + 13]) light(x, 9, 0, WHITE, 40, 22);
light(HX0 + 4, 4.4, 0, WHITE, 18, 14);
light(HX0 + 5, 5, -11, VIOLET, 14, 18);
light(HX1 - 5, 5, 11, VIOLET, 14, 18);
light(HX1 - 4, 4.4, 0, AMBER, 18, 14, { pattern: 'pulse', periodS: 1.6 });
decal('floor_hazard', TX, 6.6, 3, 1);
decal('floor_hazard', TX, -6.6, 3, 1);
decal('floor_arrow', HX1 - 7, 0, 3, 3, -Math.PI / 2);
decal('floor_stop', HX1 - 3.5, 0, 3, 1);
decal('oil_stain', TX - 14, 3, 2.5, 2.5);
decal('tire_marks', HX0 + 8, -2, 6, 2.5);
decal('crack_floor', TX + 10, 2, 3, 3);
level.ambientFx.push({
  kind: 'sparks',
  position: v(TX + 15, 4, -14.5),
  rate: 1,
});

// ---------------------------------------------------------------- 6. dok i barka
const BX = 244;
const BZ = -15.8;
floor(HX1, 262, -10, 10, 'quay_concrete');
containerWall(HX1 + 0.1, 11.219, [40, 40, 40], 3, 2, [1]);
// Wschodni koniec: murek, za nim przepompownia.
box(262, 263, 0, 2.4, -10.3, 12.5, 'concrete');
hidden(262, 262.5, 2.4, 9, -10.3, 12.5);
box(263, 286, -1, 0, -10, 16, 'concrete');
prop('dock_pump_house', 273, 0, 3);
// Krawędź doku z przerwą na trap.
hidden(HX1, BX - 1.8, 0, 8, -10.3, -10);
hidden(BX + 1.8, 262.5, 0, 8, -10.3, -10);
for (let x = 228; x <= 260; x += 4)
  if (x !== BX) prop('port_quay_edge', x, -2, -10.8, Math.PI);
for (const x of [231, 238, 250, 257]) prop('port_bollard', x, 0, -9.3);
box(BX - 1.8, BX + 1.8, -0.2, 0, -12, -10, 'steel_grating');
hidden(BX - 2, BX - 1.8, 0, 8, -12, -10);
hidden(BX + 1.8, BX + 2, 0, 8, -12, -10);
// Barka: pokład GLB na y=0, niewidoczna podłoga i nadburcia.
prop('dock_barge', BX, -2.6, BZ);
hidden(BX - 14.6, BX + 14.6, -0.5, 0, BZ - 3.8, -12);
hidden(BX - 15, BX - 1.6, 0, 8, -12.1, -11.85);
hidden(BX + 1.6, BX + 15, 0, 8, -12.1, -11.85);
hidden(BX - 15, BX + 15, 0, 8, BZ - 4.05, BZ - 3.8);
hidden(BX - 15, BX - 14.6, 0, 8, BZ - 4.05, -11.85);
hidden(BX + 14.6, BX + 15, 0, 8, BZ - 4.05, -11.85);
hidden(BX + 11.2, BX + 14.4, 0, 4, BZ - 1.8, BZ + 1.8);
box(HX1, 300, WATER_Y - 1, WATER_Y, -46, -10, 'canal_water');
box(263, 300, WATER_Y - 1, WATER_Y, -10, -9.9, 'canal_water');
// Drugi brzeg kanału.
box(HX1 - 20, 300, -4, 2.5, -48, -46, 'canal_stone_wall');
box(HX1 - 20, 240, 2.5, 16, -60, -48, 'facade');
box(240, 268, 2.5, 22, -62, -48, 'facade');
box(268, 300, 2.5, 13, -60, -48, 'facade');
sign('hotel', 254, 12, -47.85, 9, 3.6, 0, VIOLET);
sign('bar_24h', 228, 8, -47.85, 7, 2.8, 0, AMBER);
prop('dock_mooring_post', 228, -2.8, -21.5);
prop('dock_mooring_post', 261, -2.8, -21.5);
prop('dock_skiff', 269, -1.9, -14.5);
// Rekwizyty doku.
cover('port_reach_stacker', 254, 3.5);
cover('city_crates', 234, 4);
cover('city_crates', 235.4, 4.3);
cover('city_highway_barrier', 238, -5, { material: 'concrete' });
cover('city_generator', 249, -7.4);
container(20, 'navy', 232, 7.6);
prop('port_light_tower', 240, 0, 15.5);
prop('city_traffic_cone', 241.6, 0, -9.2);
prop('city_traffic_cone', 246.4, 0, -9.2);
light(232, 5, 0, WHITE, 16, 18);
light(BX, 3.2, -8.5, AMBER, 18, 16, { pattern: 'pulse', periodS: 1.2 });
light(BX, 3, -14.5, GREEN, 16, 14);
light(256, 5, -6, BLUE, 12, 16);
decal('floor_arrow', 240, -5.5, 3, 3, 0);
decal('floor_hazard', BX, -8.6, 3, 1);
decal('puddle1', 248, 2, 5, 2.5);
decal('tire_marks', 240, 5, 6, 2.5);
decal('oil_stain', 252, -4, 2.5, 2.5);
level.ambientFx.push({ kind: 'steam', position: v(259, 0, 8), rate: 2 });

// ---------------------------------------------------------------- logika poziomu
level.sections.push(
  { id: 'nabrzeze', name: 'Nabrzeże towarowe', zone: zone(42, 84) },
  {
    id: 'plac-celny',
    name: 'Plac celny',
    zone: zone(108, 48),
    radio: 'enterNode:3',
  },
  {
    id: 'przedpole',
    name: 'Przedpole Magazynu 9',
    zone: zone(154, 44),
    radio: 'enterNode:6',
  },
  {
    id: 'magazyn',
    name: 'Magazyn 9 — terminal spedycji',
    zone: zone(201, 50),
    radio: 'enterNode:7',
  },
  { id: 'dok', name: 'Dok załadunkowy', zone: zone(244, 36, 44) },
);
const hall = zone(TX, 48, 30);
level.encounters.push(
  {
    id: 'patrol-nabrzeze',
    zone: zone(40, 16),
    wave: 'm03Quay',
    spawnPoints: points([
      [62, -8],
      [63, 3],
      [74, 10],
      [77, -9],
    ]),
  },
  {
    id: 'oslona-celna',
    zone: zone(92, 14),
    wave: 'm03Customs',
    spawnPoints: points([
      [124, -8],
      [127, 9],
      [128, -2],
      [123.5, 4],
    ]),
    after: encounter('patrol-nabrzeze'),
  },
  {
    id: 'posterunek-magazynu',
    zone: zone(141, 16),
    wave: 'm03Forecourt',
    spawnPoints: points([
      [169, -9],
      [169, 9],
      [162, -2.5],
      [162, 2.5],
      [171, -2],
      [171, 2],
    ]),
    after: encounter('oslona-celna'),
  },
  {
    id: 'pierwsza-zmiana',
    zone: { kind: 'sphere', position: v(TX, 1), radiusM: 9 },
    wave: 'missionPatrol',
    spawnPoints: points([
      [TX - 6, -9.6],
      [TX, -10],
      [TX + 6, -9.6],
    ]),
    after: encounter('posterunek-magazynu'),
  },
  {
    id: 'transfer-1',
    zone: hall,
    wave: 'missionPatrol',
    spawnPoints: points([
      [HX0 + 4, -8],
      [HX0 + 4, 8],
      [HX0 + 7, 0],
    ]),
    reinforcementFor: 'terminal:0',
  },
  {
    id: 'transfer-2',
    zone: hall,
    wave: 'missionDockShields',
    spawnPoints: points([
      [TX - 18.5, -12.5],
      [TX - 18.5, 12.5],
      [TX + 19, -12.5],
      [TX + 19, 12.5],
    ]),
    reinforcementFor: 'terminal:1',
  },
  {
    id: 'transfer-3',
    zone: hall,
    wave: 'missionPatrol',
    spawnPoints: points([
      [HX1 - 5, -7],
      [HX1 - 5, 7],
      [HX1 - 8, 0],
    ]),
    reinforcementFor: 'terminal:2',
  },
  {
    id: 'poscig',
    zone: hall,
    wave: 'm03Pursuit',
    spawnPoints: points([
      [HX0 + 3, -5],
      [HX0 + 3, 5],
      [HX0 + 6, -10],
      [HX0 + 6, 10],
    ]),
    after: objective('terminal'),
  },
);
for (const item of level.encounters)
  level.spawnPoints.push(...item.spawnPoints);
level.gates.push(
  {
    id: 'gate-patrol-nabrzeze',
    block: {
      position: v(84, 3.5, 0),
      size: v(1, 7, 8),
      material: 'metal',
    },
    after: encounter('patrol-nabrzeze'),
  },
  {
    id: 'gate-oslona-celna',
    block: {
      position: v(132, 3.5, 0),
      size: v(1, 7, 8),
      material: 'metal',
    },
    after: encounter('oslona-celna'),
  },
  {
    id: 'gate-magazyn',
    block: {
      position: v(HX0 + 0.5, 2.25, 0),
      size: v(1, 4.5, 6),
      material: 'corrugated',
    },
    after: encounter('posterunek-magazynu'),
  },
  {
    id: 'gate-dok',
    block: {
      position: v(HX1 - 0.5, 2.25, 0),
      size: v(1, 4.5, 6),
      material: 'corrugated',
    },
    after: objective('terminal'),
  },
);
for (const [id, x, after] of [
  ['start', 5],
  ['plac-celny', 88, encounter('patrol-nabrzeze')],
  ['przedpole', 136, encounter('oslona-celna')],
  ['magazyn', 180, encounter('posterunek-magazynu')],
  ['dok', 230, objective('terminal')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 6),
    ...(after ? { after } : {}),
  });

writeFileSync(
  'src/data/levels/m03-list-przewozowy.json',
  JSON.stringify(level, null, 2) + '\n',
);
for (const [id, groups] of Object.entries({
  m03Quay: [
    ['assaulter', 2],
    ['gunner', 1],
  ],
  m03Customs: [
    ['shielder', 1],
    ['drone', 2],
    ['turret', 1],
  ],
  m03Forecourt: [
    ['shielder', 2],
    ['gunner', 2],
    ['turret', 2],
  ],
  m03Pursuit: [
    ['assaulter', 3],
    ['gunner', 2],
  ],
})) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive: 8,
    waves: [
      {
        spawnIntervalS: 0.5,
        groups: groups.map(([enemy, count]) => ({ enemy, count })),
      },
    ],
  });
  writeFileSync(
    `src/data/waves/${id}.json`,
    JSON.stringify(wave, null, 2) + '\n',
  );
}
console.log(
  'bloki',
  level.blocks.length,
  'dekor',
  level.decor.length,
  'światła',
  level.lights.length,
);
