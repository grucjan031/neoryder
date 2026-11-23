// Generator poziomu M07 „Nocny dyżur”. Uruchom z katalogu repo:
//   node tools/levels/buildM07.mjs
// Trasa liniowa wzdłuż +X: Bulwar → kuchnia budki z makaronem → pomost za przychodnią →
// hala i magazyn przychodni → serwerownia → nocny targ i winda towarowa.
import { writeFileSync, readFileSync } from 'node:fs';

const r = (n) => Math.round(n * 1000) / 1000;
const v = (x, y = 0, z = 0) => ({ x: r(x), y: r(y), z: r(z) });
const AMBER = '#ffae1a';
const GREEN = '#6dff4a';
const VIOLET = '#8a5cff';
const BLUE = '#3d7bff';
const WHITE = '#fff1d6';
const ID = 'm07-nocny-dyzur';

const level = {
  id: ID,
  name: 'Bulwar — przychodnia Helixy',
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
  allies: [{ id: 'nadia', spawn: v(4, 0, -3) }],
  objectiveOrder: ['krata', 'kapsula', 'serwer', 'exit'],
  objectivePositions: {
    krata: v(63.5),
    kapsula: v(198, 0, -7.6),
    serwer: v(241),
    exit: v(326),
  },
};

function box(ax0, ax1, ay0, ay1, az0, az1, material = 'concrete', extra = {}) {
  const [x0, x1] = [Math.min(ax0, ax1), Math.max(ax0, ax1)];
  const [y0, y1] = [Math.min(ay0, ay1), Math.max(ay0, ay1)];
  const [z0, z1] = [Math.min(az0, az1), Math.max(az0, az1)];
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
  city_crates: [1.212, 1.59, 1.256],
  city_generator: [1.6, 1.4, 1.005],
  city_barrier: [2, 0.929, 0.51],
  city_highway_barrier: [4, 1.093, 0.808],
  city_dumpster: [1.97, 1.33, 1.08],
  city_wrecked_car: [2.15, 1.58, 3.95],
};
// Przeszkoda z modelem (wzdłuż X) albo obrócona o 90°: dekor + niewidoczny collider.
function cover(
  model,
  x,
  z,
  { turned = false, material = 'metal', y = 0 } = {},
) {
  const [sx, sy, sz] = DIMS[model];
  if (!turned) {
    box(x - sx / 2, x + sx / 2, y, y + sy, z - sz / 2, z + sz / 2, material, {
      model,
    });
    return;
  }
  hidden(x - sz / 2, x + sz / 2, y, y + sy, z - sx / 2, z + sx / 2);
  prop(model, x, y, z, Math.PI / 2);
}
function light(x, y, z, color, intensity = 24, range = 18, flicker) {
  level.lights.push({
    position: v(x, y, z),
    color,
    intensity: r(intensity * 2.3),
    range: r(range * 1.25),
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
function wallDecal(texture, x, y, z, w, h, yaw) {
  level.decals.push({
    texture,
    position: v(x, y, z),
    size: { w, h },
    yaw: r(yaw),
    surface: 'wall',
  });
}
const zone = (x, length, width = 36) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const points = (list) => list.map(([x, z]) => ({ x, z }));
const fx = (kind, x, y, z, rate) =>
  level.ambientFx.push({ kind, position: v(x, y, z), rate });

// Ściana poprzeczna z przejściem: x środek, zh połowa szerokości, gap połowa przejścia.
function crossWall(x, zh, h, gap, material = 'plaster', door = 4.2, t = 0.4) {
  box(x - t, x + t, 0, h, -zh, -gap, material);
  box(x - t, x + t, 0, h, gap, zh, material);
  box(x - t, x + t, door, h, -gap, gap, material);
}
// Ściany boczne i opcjonalny strop pomieszczenia.
function shell(x0, x1, zh, h, wallMat, ceilMat) {
  box(x0, x1, 0, h, -zh - 1, -zh, wallMat);
  box(x0, x1, 0, h, zh, zh + 1, wallMat);
  if (ceilMat) {
    box(x0, x1, h, h + 0.6, -zh - 1, zh + 1, ceilMat);
    level.rainShelters.push({
      position: v((x0 + x1) / 2, h / 2),
      size: v(x1 - x0, h + 2, 2 * zh + 2),
    });
  }
}
// Pas świateł wzdłuż osi X.
function lampRow(x0, x1, step, z, y, colors, intensity = 26, range = 16) {
  let i = 0;
  for (let x = x0; x <= x1; x += step)
    light(x, y, z, colors[i++ % colors.length], intensity, range);
}

// ================================================================ 1. Bulwar nocą (0–44)
floor(0, 44, -9, -6, 'paving');
floor(0, 44, -6, 6, 'asphalt');
floor(0, 44, 6, 9, 'paving');
box(-1, 0, 0, 9, -9, 9, 'concrete');
// Fasady: północ (sklepy), południe (zaplecza i kable).
box(0, 44, 0, 14, 9, 15, 'facade');
box(0, 44, 0, 14, -15, -9, 'smog_soot_wall');
// Zadaszenie od strony windy z Niecki; dalej otwarta ulica w deszczu.
box(0, 14, 8, 9.2, -9, 9, 'overpass_concrete');
level.rainShelters.push({ position: v(7, 4), size: v(14, 8, 18) });
box(13.8, 14.2, 6.8, 8, -9, 9, 'hazard');
decal('floor_arrow', 18, 0, 3, 3, -Math.PI / 2);
sign('metro', 1.2, 4.6, -4, 4, 1.6, Math.PI / 2, BLUE);
prop('city_ad_screen', 3, 0, 8.6, Math.PI);
// Północna pierzeja: zamknięte na noc lokale z neonami.
sign('pharmacy', 8, 5.2, 8.85, 4, 1.6, Math.PI, GREEN);
sign('karaoke', 18, 5.6, 8.85, 4.5, 1.8, Math.PI, VIOLET);
sign('implants', 29, 5.4, 8.85, 4, 1.6, Math.PI, BLUE);
sign('open', 37, 5, 8.85, 3, 1.2, Math.PI, AMBER);
for (const x of [8, 18, 29, 37]) {
  prop('city_shutter', x - 1.2, 0, 8.87, Math.PI);
  prop('city_awning', x + 2.6, 3.4, 8.4, Math.PI);
}
prop('city_door', 13, 0, 8.87, Math.PI);
prop('city_door', 33, 0, 8.87, Math.PI);
light(8, 4.4, 6.4, GREEN, 22, 14);
light(18, 4.6, 6.4, VIOLET, 22, 14);
light(29, 4.4, 6.4, BLUE, 22, 14);
// Południowa pierzeja.
sign('sake', 12, 5.6, -8.85, 4, 1.6, 0, AMBER);
sign('tattoo', 27, 5.2, -8.85, 3.6, 1.5, 0, VIOLET);
sign('arrow', 38, 4, -8.85, 2.4, 1.2, 0, GREEN);
for (const x of [6, 20, 33]) prop('city_pipe_run', x, 0, -8.7);
prop('city_ac_unit', 24, 4, -8.7);
// Latarnie i światło: bursztyn na ulicy, ciepła biel pod zadaszeniem.
for (const [x, side] of [
  [6, -1],
  [16, 1],
  [26, -1],
  [36, 1],
]) {
  prop('city_street_lamp', x, 0, side * 7.6, side > 0 ? Math.PI : 0);
  light(x, 4.6, side * 6, AMBER, 34, 18);
}
light(4, 6.6, 0, WHITE, 40, 14);
light(14, 6.6, 0, WHITE, 40, 14);
light(22, 4.4, 0, WHITE, 36, 14);
// Osłony i rekwizyty.
cover('city_dumpster', 11, -7.4);
cover('city_crates', 20, 7.3);
cover('city_crates', 21.4, 7.1);
cover('city_wrecked_car', 25, -6.2, { turned: true, material: 'metal' });
cover('city_barrier', 31, 3.2, { turned: true, material: 'concrete' });
cover('city_generator', 35, -7.6);
prop('city_vending', 9.6, 0, 8.3, Math.PI);
prop('city_trash_bags', 15, 0, -8.2);
prop('city_trash_bags', 39, 0, 8.2);
prop('city_traffic_cone', 28, 0, 4.4);
prop('city_traffic_cone', 29.4, 0, 4.9);
prop('city_cable_span', 24, 7.2, -8.4);
prop('city_cable_span', 33, 7.8, 8.4);
decal('puddle2', 12, 2, 4.5, 2.5);
decal('puddle1', 27, -3, 4, 2);
decal('oil_stain', 33, 1, 2.5, 2.5);
decal('manhole', 8, -2, 1.5, 1.5);
wallDecal('poster_torn1', 0.1, 2.2, 6, 2, 2.8, Math.PI / 2);
fx('steam', 24, 0, -2.6, 3);
fx('drip', 12, 7.6, 3, 4);
fx('drip', 31, 7, -5, 3);

// ================================================================ 2. Kuchnia budki z makaronem (44–66)
const KX0 = 44;
const KX1 = 66;
floor(KX0, KX1, -6, 6, 'gas_station_tiles');
shell(KX0, KX1, 6, 4.2, 'facade', 'facade');
// Czoło budki od strony ulicy z szerokim wejściem (rolety do połowy).
crossWall(KX0 + 0.4, 9, 7, 3.2, 'facade', 4.2);
sign('ramen', KX0 - 0.1, 5.6, 0, 5, 2, -Math.PI / 2, AMBER);
sign('noodles', KX0 - 0.1, 5.8, -6.2, 3.4, 1.4, -Math.PI / 2, WHITE);
sign('noodles', KX0 - 0.1, 5.8, 6.2, 3.4, 1.4, -Math.PI / 2, VIOLET);
prop('city_shutter', KX0 - 0.7, 3.2, -4.6, Math.PI / 2);
prop('city_awning', KX0 - 1.2, 3.6, 4.4, Math.PI / 2);
// Tył: krata (cel „krata”), zamknięta do czasu przecięcia zamka.
crossWall(KX1 - 0.4, 9, 7, 3.2, 'facade', 4.2);
level.gates.push({
  id: 'gate-krata',
  block: {
    position: v(KX1 - 0.4, 2.1, 0),
    size: v(0.3, 4.2, 6.4),
    material: 'steel_grating',
  },
  after: objective('krata'),
});
box(KX1 - 0.9, KX1 - 0.6, 4.2, 4.9, -3.2, 3.2, 'hazard');
// Wyposażenie kuchni: lada, piec, zlewy, kartony.
box(KX0 + 2, KX0 + 14, 0, 0.95, 4.2, 5.6, 'metal');
box(KX0 + 2, KX0 + 14, 0.95, 1.05, 4.1, 5.7, 'trim');
box(KX0 + 4, KX0 + 11, 0, 1.2, -5.6, -4.3, 'rust');
box(KX0 + 5, KX0 + 8, 1.2, 2.4, -5.6, -4.8, 'metal');
cover('city_crates', KX0 + 16.5, -4.9);
cover('city_crates', KX0 + 17.8, -4.7);
cover('city_crates', KX0 + 16.7, -3.6, { y: 0 });
cover('city_generator', KX0 + 19, 5);
prop('city_vent_grate', KX0 + 8, 0, 0.5);
prop('city_trash_bags', KX0 + 20.5, 0, -5);
prop('city_pipe_run', KX0 + 12.5, 0, -5.7, 0);
prop('city_pipe_run', KX0 + 6, 0, 5.7, Math.PI);
box(KX0 + 12.4, KX0 + 14, 0, 2.2, -1.2, 1.2, 'metal');
hidden(KX0 + 12.4, KX0 + 14, 2.2, 3.4, -1.2, 1.2);
decal('oil_stain', KX0 + 10, -1, 3, 3);
decal('puddle1', KX0 + 3, 0, 3, 2);
decal('floor_hazard', KX1 - 3, 0, 3, 1);
for (const x of [KX0 + 5, KX0 + 11, KX0 + 17]) {
  light(x, 2.8, 0, AMBER, 26, 11);
}
box(KX0 + 3, KX1 - 3, 3.95, 4.2, -0.15, 0.15, 'neon_amber');
light(KX0 + 7, 2.8, 0, WHITE, 22, 10, { pattern: 'buzz', strength: 0.5 });
light(KX1 - 3, 3.2, 0, GREEN, 18, 9);
fx('sparks', KX0 + 8, 3.7, -2, 2);
fx('steam', KX0 + 7, 1.3, -4.8, 3);
fx('steam', KX0 + 17, 0, 5, 2);

// ================================================================ 3. Pomost za przychodnią (66–118)
const PX0 = 66;
const PX1 = 118;
floor(PX0, PX1, -4, 4, 'overpass_concrete');
// Tył przychodni z oknami gabinetów.
box(PX0, PX1, 0, 11, 4, 10, 'plaster');
box(PX0, PX1, 11, 11.6, 3.8, 10.2, 'trim');
for (let x = 74; x <= 110; x += 9) {
  box(x - 1.3, x + 1.3, 2.4, 4, 3.93, 4.05, 'light_white');
  box(x - 1.45, x + 1.45, 2.3, 4.1, 3.9, 3.95, 'trim');
  light(x, 3.2, 2.2, WHITE, 16, 10);
}
prop('city_door', 96, 0, 3.92, Math.PI);
light(96, 3.4, 2, AMBER, 22, 10);
prop('city_ac_unit', 80, 4.7, 3.7, Math.PI);
prop('city_ac_unit', 104, 4.9, 3.7, Math.PI);
prop('city_pipe_run', 88, 0, 3.6, Math.PI);
prop('city_pipe_run', 112, 0, 3.6, Math.PI);
sign('pharmacy', 92, 8, 3.85, 6, 2.4, Math.PI, WHITE);
// Balustrada od strony Niecki: niewidoczna bariera i widoczna poręcz na słupkach.
hidden(PX0, PX1, 0, 8, -4.6, -4.3);
box(PX0, PX1, 0.95, 1.1, -4.3, -4.15, 'metal');
for (let x = PX0 + 1; x <= PX1; x += 3)
  box(x - 0.06, x + 0.06, 0, 1.1, -4.3, -4.15, 'metal');
// Przepaść i dalsze zabudowania Bulwaru (tylko widok).
box(PX0, PX1, -12, -10, -14, -4.6, 'concrete');
box(PX0 - 2, PX1 + 2, -12, 16, -34, -14, 'smog_soot_wall');
sign('hotel', 80, 9, -13.8, 8, 3.2, 0, VIOLET);
sign('bar_24h', 104, 7, -13.8, 6, 2.4, 0, AMBER);
sign('kebab', 92, 11, -13.8, 5, 2, 0, BLUE);
for (const x of [78, 100]) {
  box(x - 1.1, x + 1.1, -12, 4, -6.6, -4.8, 'overpass_concrete');
}
// Osłony na pomoście: zwężenia i skrzynie.
cover('city_crates', 74, -2.4);
cover('city_crates', 75.3, -2.2);
cover('city_generator', 84, 2.5);
cover('city_dumpster', 91, -2.3);
cover('city_highway_barrier', 100, 2.2, { material: 'concrete' });
cover('city_crates', 107, -2.5);
cover('city_crates', 108.3, -2.7);
prop('city_trash_bags', 86, 0, -3.4);
prop('city_traffic_cone', 114, 0, -3.2);
prop('city_vent_grate', 116, 0, 0);
decal('puddle2', 78, 0.5, 4.5, 2.5);
decal('puddle1', 97, -1, 4, 2);
wallDecal('leak_streak', 100.8, 2.2, 3.97, 2, 3.5, Math.PI);
decal('floor_arrow', 70, 0, 3, 3, -Math.PI / 2);
decal('floor_arrow', 112, 0, 3, 3, -Math.PI / 2);
lampRow(72, 112, 10, 0, 3.4, [AMBER, BLUE], 30, 14);
light(116, 3.4, 0, WHITE, 28, 10);
fx('steam', 116, 0, 0, 3);
fx('drip', 85, 5.5, 0, 3);
fx('drip', 103, 5.5, -3, 3);
fx('sparks', 87, 3.6, 3.4, 1);
// Wejście do hali przez właz wentylacyjny: rama.
box(PX1 - 0.4, PX1 + 0.4, 4.2, 5.2, -3.2, 3.2, 'hazard');

// ================================================================ 4. Hala przychodni (118–172)
const HX0 = 118;
const HX1 = 172;
const HH = 5;
floor(HX0, HX1, -12, 12, 'gas_station_tiles');
shell(HX0, HX1, 12, HH, 'plaster', 'plaster');
// Czoło z wejściem (rama wejścia przy pomoście jest wyżej) i ściana magazynu.
crossWall(HX0 + 0.4, 12, HH, 3.2, 'plaster', 4.2);
crossWall(HX1 - 0.4, 12, HH, 3.2, 'plaster', 4.2);
box(HX1 - 0.9, HX1 - 0.6, 4.2, 4.9, -3.2, 3.2, 'hazard');
// Recepcja w lobby: lada i ciepła biel nad wejściem.
box(122, 124, 0, 1.1, 5.2, 9.4, 'trim');
box(121.9, 124.1, 1.1, 1.2, 5.1, 9.5, 'light_white');
sign('implants', HX0 + 0.9, 3.8, 8.6, 3, 1.2, Math.PI / 2, WHITE);
sign('arrow', HX0 + 0.9, 3.4, -7, 2, 1, Math.PI / 2, GREEN);
cover('city_crates', 123, -9.4);
prop('city_vending', 120.6, 0, -4.6, Math.PI / 2);
light(124, 3.4, 0, WHITE, 40, 16);
light(124, 3.4, 8, WHITE, 28, 12);
light(124, 3.4, -8, WHITE, 28, 12);
// Przegrody wzdłuż korytarza środkowego (|z| ≈ 3,4): szkło na cokole, bez przejść.
const AZ0 = 128;
const AZ1 = 164;
for (const s of [-1, 1]) {
  box(AZ0, AZ1, 0, 1, s * 3.4 - 0.2, s * 3.4 + 0.2, 'plaster');
  box(AZ0, AZ1, 1, 3.8, s * 3.4 - 0.1, s * 3.4 + 0.1, 'glass');
  box(AZ0, AZ1, 3.8, HH, s * 3.4 - 0.2, s * 3.4 + 0.2, 'plaster');
  // Przeszklone boksy zabiegowe: ścianki prostopadłe, pas 3,8 m przy ścianie zewnętrznej.
  for (const x of [134, 146, 158]) {
    box(x - 0.1, x + 0.1, 0, 3.8, s * 3.6, s * 7.8, 'glass');
    box(x - 0.15, x + 0.15, 0, 1, s * 3.6, s * 7.8, 'plaster');
  }
  for (const x of [128, 140, 152]) {
    // Łóżko zabiegowe i wózek w boksie.
    box(x + 2.2, x + 4.6, 0.3, 0.9, s * 4.5, s * 5.7, 'trim');
    box(x + 2.2, x + 4.6, 0.9, 1.0, s * 4.5, s * 5.7, 'light_white');
    box(x + 2.5, x + 3, 0, 0.3, s * 4.7, s * 5.5, 'metal');
  }
  // Osłony w pasie bocznym.
  cover('city_crates', 137, s * 11.2);
  cover('city_crates', 138.3, s * 11.1);
  cover('city_barrier', 151, s * 11, { turned: true, material: 'concrete' });
  cover('city_generator', 161, s * 11);
  box(141, 143.5, 0, 0.8, s * 11.3, s * 11.9, 'trim');
  // Okna i oznakowanie ewakuacyjne.
  for (const x of [133, 147, 161]) {
    sign('arrow', x, 3.4, s * 11.88, 2, 1, s > 0 ? Math.PI : 0, GREEN);
  }
}
// Korytarz środkowy: czujniki ruchu (bursztynowe wiązki na wysokości pasa) i oznaczenie strefy.
for (const [id, x, off] of [
  ['czujnik-1', 132, 0],
  ['czujnik-2', 146, 1.2],
  ['czujnik-3', 158, 0.4],
]) {
  level.hazards.push({
    id,
    kind: 'laser_gate',
    from: v(x, 1, -3.1),
    to: v(x, 1, 3.1),
    cycle: { onS: 1.8, offS: 2.4, offsetS: off },
  });
  box(x - 0.15, x + 0.15, 0, 1.6, -3.3, -3.0, 'hazard');
  box(x - 0.15, x + 0.15, 0, 1.6, 3.0, 3.3, 'hazard');
}
for (let x = 130; x <= 162; x += 8) {
  decal('floor_hazard', x, 0, 3, 1, Math.PI / 2);
  light(x, 3.4, 0, AMBER, 10, 10);
}
box(AZ0, AZ1, 4.85, 5, -0.15, 0.15, 'neon_amber');
// Ciepła biel w pasach bocznych.
for (const s of [-1, 1])
  for (let x = 130; x <= 166; x += 9) {
    light(x, 3.4, s * 8.6, WHITE, 9, 12);
  }
for (const s of [-1, 1])
  box(130, 166, 4.85, 5, s * 8.6 - 0.2, s * 8.6 + 0.2, 'light_white');
light(166, 3.4, 0, WHITE, 12, 12);
light(166, 3.4, 7, WHITE, 8, 10);
light(166, 3.4, -7, WHITE, 8, 10);
decal('puddle1', 126, 3, 3, 2);
decal('floor_stop', 166, 0, 3, 1, -Math.PI / 2);
decal('crack_floor', 150, 8, 3, 3);
fx('steam', 168, 0, -9, 2);
fx('sparks', 144, 4.6, 0, 1);

// ================================================================ 5. Magazyn implantów (172–206)
const MX0 = 172;
const MX1 = 206;
const MH = 5.5;
floor(MX0, MX1, -10, 10, 'concrete_raw_cast');
shell(MX0, MX1, 10, MH, 'plaster', 'plaster');
crossWall(MX1 - 0.4, 10, MH, 3.2, 'plaster', 4.2);
// Regały z lodówkami i skrzyniami: aleja środkowa i boczne co najmniej 3 m.
for (const s of [-1, 1])
  for (const [x0, x1] of [
    [177, 187],
    [191, 201],
  ]) {
    box(x0, x1, 0, 2.4, s * 5 - 0.45, s * 5 + 0.45, 'metal');
    box(x0, x1, 1.2, 1.35, s * 5 - 0.5, s * 5 + 0.5, 'trim');
  }
// Chłodziarki wzdłuż ścian; jasne panele i niebieski blask.
for (const x of [180, 184, 188, 192]) {
  box(x - 1.4, x + 1.4, 0, 2.5, 9, 10, 'metal');
  box(x - 1.2, x + 1.2, 0.3, 2.3, 8.9, 9, 'light_white');
}
// Chłodziarka z próbką Akordu (cel `kapsula`): rząd po stronie południowej.
box(196.4, 199.6, 0, 2.6, -10, -8.8, 'metal');
box(196.7, 199.3, 0.35, 2.3, -8.8, -8.7, 'light_white');
box(197.3, 198.7, 1.0, 1.6, -8.7, -8.6, 'neon_green');
light(198, 2.4, -6.8, GREEN, 18, 9);
for (const x of [178, 183, 188, 202]) {
  box(x - 1.2, x + 1.2, 0, 2.5, -10, -9, 'metal');
  box(x - 1, x + 1, 0.3, 2.3, -9, -8.9, 'light_white');
}
// Wejście: zamknięte skrzydła, wieżyczka nad drzwiami (spotkanie), panel obok.
box(MX0, MX0 + 0.2, 1.2, 2.2, 3.7, 4.3, 'neon_green');
sign('arrow', MX0 + 0.15, 3.6, -5, 2, 1, Math.PI / 2, GREEN);
box(MX0 + 0.2, MX0 + 2.2, 4.1, 5.5, -1.2, 1.2, 'metal');
cover('city_crates', 180.4, -2.8);
cover('city_crates', 181.7, -2.6);
cover('city_crates', 195, 2.7);
cover('city_crates', 196.3, 2.5);
box(188, 190.4, 0, 1, 2, 4, 'metal');
// Oświetlenie: zimne, techniczne, bez bursztynu poza sygnalizacją.
for (let x = 178; x <= 202; x += 8) {
  light(x, 3.8, 0, BLUE, 18, 14);
  light(x, 3.8, 7.4, WHITE, 16, 11);
  light(x, 3.8, -7.4, WHITE, 16, 11);
}
box(176, 204, 5.3, 5.5, -0.2, 0.2, 'light_white');
light(184, 3.8, 0, WHITE, 13, 10, { pattern: 'fail', strength: 0.4 });
decal('floor_hazard', 190, 0, 3, 1);
decal('puddle1', 193, -2, 3, 2);
decal('floor_arrow', 202, 0, 3, 3, 0);
fx('steam', 192, 0, 8.6, 3);
fx('drip', 186, 5.3, 0, 3);

// ================================================================ 6. Serwerownia rejestrów (206–248)
const SX0 = 206;
const SX1 = 248;
// Korytarz z szafami.
floor(SX0, 232, -4.5, 4.5, 'gas_station_tiles');
shell(SX0, 232, 4.5, 4.2, 'plaster', 'plaster');
for (const s of [-1, 1])
  for (let x = 209; x <= 227; x += 6) {
    box(x - 1.5, x + 1.5, 0, 2.6, s * 3.7, s * 4.5, 'metal');
    box(x - 1.3, x + 1.3, 1.9, 2.05, s * 3.62, s * 3.7, 'neon_green');
    box(x - 1.3, x + 1.3, 0.9, 1.05, s * 3.62, s * 3.7, 'light_white');
  }
level.gates.push({
  id: 'gate-serwerownia',
  block: {
    position: v(MX1 - 0.4, 2.1, 0),
    size: v(0.3, 4.2, 6.4),
    material: 'metal',
  },
  after: objective('kapsula'),
});
for (let x = 210; x <= 228; x += 6) {
  light(x, 2.8, 0, BLUE, 28, 9);
}
box(208, 230, 3.95, 4.2, -0.2, 0.2, 'light_white');
sign('arrow', 214, 3.5, 4.4, 2, 1, Math.PI, GREEN);
decal('floor_arrow', 215, 0, 3, 3, -Math.PI / 2);
decal('floor_hazard', 222, 0, 3, 1);
fx('steam', 229, 0, 0, 2);
// Pomieszczenie administratora: szklana ściana, serwer z bazą pacjentów.
floor(232, SX1, -8, 8, 'gas_station_tiles');
shell(232, SX1, 8, 4.8, 'plaster', 'plaster');
for (const s of [-1, 1]) {
  box(231.8, 232.2, 0, 1, s * 3.2, s * 8, 'plaster');
  box(231.8, 232.2, 1, 4, s * 3.2, s * 8, 'glass');
}
box(231.8, 232.2, 4, 4.8, -8, 8, 'plaster');
box(244, 246.4, 0, 2.7, -1.5, 1.5, 'metal');
box(243.9, 244, 0.5, 2.3, -1.2, 1.2, 'neon_green');
box(244.3, 246.1, 2.7, 2.9, -1.3, 1.3, 'light_white');
cover('city_crates', 240, -6.2);
cover('city_crates', 241.3, -6.4);
box(236, 239, 0, 0.9, 5.8, 7.2, 'trim');
box(236.4, 238.6, 0.9, 1, 5.9, 7.1, 'light_white');
box(235, 236.4, 0, 0.5, -5.4, -4.2, 'metal');
box(240, 242.5, 0, 0.9, 5.8, 7.2, 'trim');
light(241, 3.2, 0, BLUE, 40, 14);
light(244, 3.2, 0, GREEN, 26, 8);
light(236, 3.2, 6, WHITE, 28, 10);
light(236, 3.2, -6, WHITE, 28, 10);
// Wyjście technicznym szybem na targ: brama zamknięta do końca transferu.
crossWall(SX1 - 0.4, 8, 4.8, 3.2, 'plaster', 4.2);
box(SX1 - 0.8, SX1, 0, 14, 8, 16, 'concrete');
box(SX1 - 0.8, SX1, 0, 14, -16, -8, 'concrete');
level.gates.push({
  id: 'gate-targ',
  block: {
    position: v(SX1 - 0.4, 2.1, 0),
    size: v(0.3, 4.2, 6.4),
    material: 'metal',
  },
  after: objective('serwer'),
});
box(SX1 - 0.9, SX1 - 0.6, 4.2, 4.8, -3.2, 3.2, 'hazard');
decal('puddle2', 238, -3, 3, 2);
decal('floor_stop', SX1 - 3, 0, 3, 1);
fx('sparks', 245, 3, 0, 1);

// ================================================================ 7. Nocny targ i winda (248–332)
const TX0 = 248;
const TX1 = 316;
const TH = 9;
floor(TX0, TX1, -7, 7, 'asphalt');
floor(TX0, TX1, -14, -7, 'paving');
floor(TX0, TX1, 7, 14, 'paving');
// Estakada nad targiem, filary i fasady z rolet.
for (const s of [-1, 1]) {
  box(TX0, TX1, TH, TH + 1.2, s * 8.6, s * 15, 'overpass_concrete');
  level.rainShelters.push({ position: v(282, 4), size: v(68, 10, 6.4) });
  level.rainShelters.at(-1).position = v(282, 4, s * 11.8);
}
box(TX0, TX1, 0, 14, -16, -14, 'smog_soot_wall');
box(TX0, TX1, 0, 14, 14, 16, 'facade');
for (let x = 256; x <= 312; x += 14)
  for (const s of [-1, 1]) {
    box(
      x - 0.9,
      x + 0.9,
      0,
      TH,
      s * 13 - 0.9,
      s * 13 + 0.9,
      'overpass_concrete',
    );
    box(x - 0.95, x + 0.95, 0, 0.35, s * 13 - 0.95, s * 13 + 0.95, 'hazard');
  }
for (let x = 254; x <= 310; x += 8) {
  prop('city_shutter', x, 0, 13.87, Math.PI);
  prop('city_shutter', x + 2, 0, -13.87, 0);
}
// Neony targu: fiolet i błękit na wygaszonych szyldach.
sign('karaoke', 258, 5.4, 13.8, 5, 2, Math.PI, VIOLET);
sign('beer', 276, 5.2, 13.8, 4, 1.7, Math.PI, BLUE);
sign('cocktail', 294, 5.4, 13.8, 4, 1.7, Math.PI, VIOLET);
sign('ramen', 308, 5.2, 13.8, 4.5, 1.8, Math.PI, AMBER);
sign('arcade', 262, 5.4, -13.8, 4.5, 1.8, 0, BLUE);
sign('iskra', 280, 5.4, -13.8, 3.5, 1.5, 0, GREEN);
sign('cat_cafe', 296, 5.4, -13.8, 4.5, 1.8, 0, VIOLET);
sign('sign_bar', 309, 5.2, -13.8, 3.5, 1.5, 0, BLUE);
// Stragany: kolider w rzędach po obu stronach, szeroka aleja środkowa.
const STALLS = [
  [258, -7.2],
  [268, 7.4],
  [274, -7.2],
  [284, 7.4],
  [290, -7.2],
  [299, 7.4],
  [304, -7.2],
];
for (const [x, z] of STALLS) {
  box(x - 1.5, x + 1.5, 0, 1.1, z - 0.9, z + 0.9, 'market_tarp');
  hidden(x - 1.5, x + 1.5, 1.1, 2.4, z - 0.9, z + 0.9);
  prop(
    x % 2 === 0
      ? 'city_market_stall_canopy'
      : 'city_market_stall_canopy_violet',
    x,
    0,
    z,
    0,
  );
  light(x, 2.8, z + (z > 0 ? -1.6 : 1.6), x % 2 === 0 ? VIOLET : BLUE, 22, 9);
}
cover('city_crates', 263, 6.4);
cover('city_crates', 264.3, 6.1);
cover('city_dumpster', 279, 11.5);
cover('city_generator', 287, -11.6);
cover('city_highway_barrier', 296, -2.4, { material: 'concrete' });
cover('city_barrier', 270, 2.2, { turned: true, material: 'concrete' });
cover('city_crates', 306, 2.8);
cover('city_crates', 307.3, 2.6);
prop('city_vending', 254.6, 0, 13.3, Math.PI);
prop('city_kiosk', 281.5, 0, -12.8);
prop('city_trash_bags', 266, 0, -12.8);
prop('city_trash_bags', 292, 0, 12.8);
prop('city_traffic_cone', 252, 0, 3.2);
prop('city_traffic_cone', 252, 0, -3.2);
for (let x = 258; x <= 306; x += 16) prop('city_lantern_string', x + 5, 6, 0);
prop('city_cable_span', 270, 8, 12);
prop('city_cable_span', 300, 8, -12);
// Światło: ciepła biel i bursztyn na osi, fiolet i błękit w rzędach.
lampRow(254, 310, 8, 0, 6.2, [WHITE, AMBER], 46, 16);
lampRow(254, 310, 14, -10.5, 5, [BLUE, VIOLET], 24, 13);
lampRow(261, 310, 14, 10.5, 5, [VIOLET, BLUE], 24, 13);
for (const x of [264, 282, 300]) {
  prop('city_street_lamp', x, 0, 9, Math.PI);
  prop('city_street_lamp', x + 9, 0, -9, 0);
}
decal('puddle2', 256, 1, 5, 2.5);
decal('puddle1', 272, -2, 5, 2.5);
decal('puddle2', 288, 2, 5, 2.5);
decal('oil_stain', 302, -1, 2.5, 2.5);
decal('tire_marks', 278, 1, 6, 2.5);
decal('floor_arrow', 266, 0, 3, 3, -Math.PI / 2);
decal('floor_arrow', 296, 0, 3, 3, -Math.PI / 2);
decal('crack_floor', 284, -3, 3, 3);
fx('steam', 270, 0, -11, 3);
fx('steam', 294, 0, 11, 3);
fx('drip', 262, 8.8, 4, 4);
fx('drip', 290, 8.8, -4, 4);
fx('sparks', 304, 3, -11, 1);
// Winda towarowa: peron, rama szybu i krata zjazdowa (blokada ochrony przed nią).
const LX0 = TX1;
const LX1 = 332;
floor(LX0, LX1, -8, 8, 'steel_grating');
box(LX0, LX1, 0, 11, -9, -8, 'concrete');
box(LX0, LX1, 0, 11, 8, 9, 'concrete');
box(LX0 - 0.8, LX0, 0, 11, 9, 16, 'concrete');
box(LX0 - 0.8, LX0, 0, 11, -16, -9, 'concrete');
box(LX1, LX1 + 1, 0, 11, -9, 9, 'concrete');
box(LX0, LX1, 7, 8, -8, 8, 'metal');
crossWall(LX0 + 0.4, 9, 11, 5, 'concrete', 4.6);
for (const s of [-1, 1]) {
  box(LX1 - 8, LX1 - 6, 0, 7, s * 4 - 0.2, s * 4 + 0.2, 'metal');
  box(LX1 - 8, LX1 - 6, 0, 0.4, s * 4 - 0.4, s * 4 + 0.4, 'hazard');
}
box(LX1 - 8, LX1 - 6, 6.6, 7, -4, 4, 'metal');
box(LX1 - 7.4, LX1 - 6.6, 6.2, 6.5, -3.8, 3.8, 'neon_green');
sign('arrow', LX1 - 0.15, 3.6, 0, 3, 1.4, -Math.PI / 2, GREEN);
sign('metro', LX1 - 0.15, 5.6, -5.4, 3.5, 1.4, -Math.PI / 2, BLUE);
light(324, 4.8, 0, WHITE, 60, 16);
light(306, 3.4, 0, WHITE, 50, 14);
light(312, 3.4, 5, AMBER, 36, 12);
light(312, 3.4, -5, AMBER, 36, 12);
box(LX0 + 1, LX0 + 1.4, 4.7, 4.9, -4.8, 4.8, 'light_white');
light(324, 1.4, 0, GREEN, 24, 8);
light(LX0 + 3, 4.4, 5.5, AMBER, 26, 10, { pattern: 'pulse', periodS: 1.4 });
light(LX0 + 3, 4.4, -5.5, AMBER, 26, 10, { pattern: 'pulse', periodS: 1.4 });
cover('city_crates', 320, 6.6);
cover('city_crates', 321.3, 6.4);
cover('city_generator', 321, -6.6);
decal('floor_hazard', 324, 0, 3, 1, Math.PI / 2);
decal('floor_arrow', 319, 0, 3, 3, -Math.PI / 2);
level.rainShelters.push({ position: v(324, 5), size: v(16, 10, 18) });
// Blokada przed windą: otwiera się po rozbiciu ochrony.
level.gates.push({
  id: 'gate-winda',
  block: {
    position: v(LX0 + 0.4, 2.3, 0),
    size: v(0.3, 4.6, 10.4),
    material: 'hazard_stripes_worn',
  },
  after: encounter('blokada-windy'),
});

// ================================================================ logika poziomu
level.sections.push(
  {
    id: 'bulwar',
    name: 'Bulwar i zaplecze budki z makaronem',
    zone: zone(33, 66, 30),
  },
  { id: 'estakada', name: 'Pomost za przychodnią', zone: zone(92, 52, 14) },
  { id: 'przychodnia', name: 'Przychodnia Helixy', zone: zone(162, 88, 28) },
  { id: 'serwerownia', name: 'Serwerownia rejestrów', zone: zone(227, 42, 20) },
  { id: 'targ', name: 'Nocny targ i winda towarowa', zone: zone(290, 84, 32) },
);
// Hala: wejście w oświetlony korytarz środkowy to wykrycie i alarm; boksy boczne są ciche.
level.encounters.push(
  {
    id: 'alarm-hala',
    zone: {
      kind: 'box',
      position: v((AZ0 + AZ1) / 2, 2),
      size: v(AZ1 - AZ0, 8, 6.4),
    },
    wave: 'm07Hala',
    spawnPoints: points([
      [163, -9],
      [163, 9],
      [167, -5],
      [167, 5],
    ]),
  },
  {
    id: 'wieza-magazynu',
    zone: { kind: 'box', position: v(183, 2), size: v(22, 8, 20) },
    wave: 'm07Magazyn',
    spawnPoints: points([
      [184, 7.8],
      [196, -3.2],
      [184, -7.2],
    ]),
  },
  {
    id: 'czujnik-serwera',
    zone: zone(241, 14, 18),
    wave: 'm07Serwer',
    spawnPoints: points([
      [224, -1.5],
      [224, 1.5],
      [218, 0],
    ]),
    reinforcementFor: 'serwer:0',
  },
  {
    id: 'alarm-serwerownia',
    zone: { kind: 'box', position: v(240, 2), size: v(16, 8, 16) },
    wave: 'm07Alarm',
    spawnPoints: points([
      [222, -1.5],
      [222, 1.5],
      [227, 0],
    ]),
    after: objective('serwer'),
  },
  {
    id: 'poscig-targ-1',
    zone: { kind: 'box', position: v(264, 2), size: v(18, 8, 30) },
    wave: 'm07Poscig1',
    spawnPoints: points([
      [279, -2],
      [281, 3],
      [284, 0],
      [277, -9],
    ]),
    after: objective('serwer'),
  },
  {
    id: 'poscig-targ-2',
    zone: { kind: 'box', position: v(288, 2), size: v(20, 8, 30) },
    wave: 'm07Poscig2',
    spawnPoints: points([
      [302, -2],
      [303, 3],
      [305, -10.5],
      [298, 9],
    ]),
    after: encounter('poscig-targ-1'),
  },
  {
    id: 'blokada-windy',
    zone: { kind: 'box', position: v(307, 2), size: v(18, 8, 30) },
    wave: 'm07Blokada',
    spawnPoints: points([
      [312, -6],
      [312, 6],
      [314, 0],
      [311, 11],
    ]),
    after: encounter('poscig-targ-2'),
  },
);
for (const item of level.encounters)
  level.spawnPoints.push(...item.spawnPoints);
// Rolety przy wejściu do hali opadają na czas alarmu: wycofanie jest niemożliwe.
level.gates.push({
  id: 'gate-rolety',
  block: {
    position: v(HX0 + 8.2, 2.5, 0),
    size: v(0.3, 5, 24),
    material: 'hazard_stripes_worn',
  },
  after: objective('krata'),
  closedDuring: 'alarm-hala',
});
for (const [id, x, after, width = 28] of [
  ['start', 5],
  ['ulica', 22],
  ['kuchnia', 50, undefined, 14],
  ['pomost', 72, objective('krata'), 8],
  ['hala', 122],
  ['magazyn', 176],
  ['serwerownia', 210, objective('kapsula'), 8],
  ['targ', 254, objective('serwer')],
  ['winda', 322, encounter('blokada-windy'), 16],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 6, width),
    ...(after ? { after } : {}),
  });

writeFileSync(
  `src/data/levels/${ID}.json`,
  JSON.stringify(level, null, 2) + '\n',
);
for (const [id, groups, maxAlive] of [
  [
    'm07Hala',
    [
      ['shielder', 1],
      ['gunner', 2],
    ],
    6,
  ],
  [
    'm07Magazyn',
    [
      ['turret', 1],
      ['drone', 1],
    ],
    4,
  ],
  [
    'm07Serwer',
    [
      ['assaulter', 2],
      ['gunner', 1],
    ],
    5,
  ],
  [
    'm07Alarm',
    [
      ['shielder', 1],
      ['assaulter', 2],
      ['gunner', 1],
    ],
    6,
  ],
  [
    'm07Poscig1',
    [
      ['assaulter', 2],
      ['drone', 2],
    ],
    6,
  ],
  [
    'm07Poscig2',
    [
      ['shielder', 1],
      ['gunner', 2],
      ['hacker', 1],
    ],
    6,
  ],
  [
    'm07Blokada',
    [
      ['shielder', 2],
      ['gunner', 1],
      ['turret', 1],
    ],
    6,
  ],
]) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive,
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
