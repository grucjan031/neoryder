// Nocny targ pod estakadą (combat): rzędy straganów z daszkami jako niskie osłony, filary estakady,
// sznury lampionów i pasarela na 4 m z rampami. Landmark: pokład estakady nad głową (wysokość 10 m)
// z rzędem bursztynowych lamp. Pogoda: rain.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

export default function generate() {
  const bounds = R(-42, 42, -38, 38);
  const k = createRunRoom({
    id: 'alleyMarket',
    name: 'Nocny targ',
    weather: 'rain',
    seed: 'run-market-v1',
    bounds,
    startX: -18,
    exitX: 18,
    wallHeights: [14, 20, 17, 23],
  });
  const { arena, p } = k;

  k.ground(R(-42, 42, 14, 38), 0, 'asphalt');
  k.ground(R(-42, 42, -14, 14), 0, 'overpass_street');
  k.ground(R(-42, 42, -38, -14), 0, 'asphalt');
  k.perimeter();

  // Estakada: pokład od 10 m nad targiem, filary (model o wysokości 10 m) podpierają jego spód.
  k.solid(R(-42, 42, -12, 12), 10, 12.6, 'overpass_concrete');
  k.solid(R(-42, 42, -12.4, -12), 10, 13.4, 'trim');
  k.solid(R(-42, 42, 12, 12.4), 10, 13.4, 'trim');
  k.rainShelters.push({ position: vec(0, 5, 0), size: vec(84, 10, 24) });
  const PILLAR = vec(2.5, 10, 2.513);
  for (const x of [-35, -21, -7, 7, 21, 35])
    for (const z of [-8.5, 8.5]) {
      k.reserve(R(x - 1.25, x + 1.25, z - 1.25, z + 1.25));
      arena.block({
        model: 'city_overpass_pillar',
        size: { ...PILLAR },
        position: vec(x, 5, z),
        material: 'concrete',
        instance: true,
      });
    }

  // Zabudowa: magazyny po bokach targu, kamienice północy, zaplecze południa.
  const WM = R(-42, -34, -14, 14);
  const EM = R(34, 42, -14, 14);
  const N1 = R(-42, -26, -38, -22);
  const N2 = R(-12, 6, -38, -24);
  const N3 = R(30, 42, -38, -24);
  const S1 = R(-42, -30, 22, 38);
  const S2 = R(28, 42, 24, 38);
  k.mass(WM, 18);
  k.mass(EM, 20);
  k.mass(N1, 20);
  k.mass(N2, 16, 'plaster');
  k.mass(N3, 22);
  k.mass(S1, 12, 'plaster');
  k.mass(S2, 10, 'corrugated');

  // Pasarela nad północnym brzegiem targu (4 m) z rampami na ulicę północną.
  const GALLERY = R(-24, 24, -16, -11);
  p.floor(GALLERY, 4, 'steel_grating', { thickness: 0.4 });
  p.wall(vec(-24, 4, -16), vec(24, 4, -16), 1.1, 0.12, 'metal', {
    openings: [
      { at: 2, width: 3.4, height: 1.1 },
      { at: 46, width: 3.4, height: 1.1 },
    ],
  });
  p.wall(vec(-24, 4, -11), vec(24, 4, -11), 1.1, 0.12, 'metal');
  for (let x = -24; x <= 24; x += 8)
    for (const z of [-15.6, -11.4]) {
      if (Math.abs(x) === 24 && z < -15) continue;
      arena.block({
        size: vec(0.6, 3.6, 0.6),
        position: vec(x === -24 ? -23.7 : x === 24 ? 23.7 : x, 1.8, z),
        material: 'metal',
      });
    }
  k.ramp(vec(-22, 4, -16), vec(-22, 0, -27.6), 3, 'metal');
  k.ramp(vec(22, 4, -16), vec(22, 0, -27.6), 3, 'metal');
  // Poręcze rampy ograniczają boczne zejście.
  k.light(0, 3.4, -13.5, COLOR.amber, 14, 10);
  k.light(-14, 7, -13.5, COLOR.warm, 14, 10);
  k.light(14, 7, -13.5, COLOR.warm, 14, 10);

  // Rzędy straganów pod estakadą (niskie osłony z daszkami); środkowy pas z=0 zostaje wolny.
  const rowA = [-31, -26.5, -22, -13, -8.5, -4, 4.5, 9, 13.5, 22.5, 27, 31];
  rowA.forEach((x, i) => {
    k.prop(
      i % 3 === 1
        ? 'city_market_stall_canopy_violet'
        : 'city_market_stall_canopy',
      x,
      -5,
      { quarter: 0 },
    );
    k.prop(
      i % 4 === 2
        ? 'city_market_stall_canopy_violet'
        : 'city_market_stall_canopy',
      x,
      5,
      { quarter: 2 },
    );
  });
  for (const [model, x, z, quarter] of [
    ['city_stall', -17.5, -5, 0],
    ['city_stall', 18, 5, 2],
    ['city_crates', -34 + 12, 1.8, 0],
    ['city_vending', 11.5, 2, 2],
    ['city_barrier', 16, -1.5, 0],
    ['city_generator', 25, 1.5, 1],
    ['city_crates', -11, 2, 0],
    ['city_dumpster', -30, 1, 0],
    ['city_dumpster', 30, -1, 1],
    // dojście południowe
    ['city_car', -26, 28, 1],
    ['city_vending', -8, 30, 2],
    ['city_barrier', 0, 27, 0],
    ['city_car', 12, 31, 0],
    ['city_crates', 22, 28, 0],
    ['city_kiosk', 4, 36, 0],
    ['city_dumpster', -14, 24, 1],
    ['city_generator', 20, 22, 0],
    ['city_barrier', -3, 18, 0],
    ['city_wrecked_car', -12, 21, 1],
    ['city_kiosk', -7, 17, 0],
    ['city_wrecked_car', -5.5, 12, 1],
    ['city_wrecked_car', 8, -21, 1],
    ['city_barrier', 10, 17, 1],
    ['city_crates', 32, 20, 1],
    ['city_dumpster', -33, 18, 1],
    // ulica północna
    ['city_car', -18, -30, 0],
    ['city_dumpster', -19, -27, 1],
    ['city_crates', 12, -30, 0],
    ['city_barrier', 22, -29, 0],
    ['city_vending', 26, -35, 2],
    ['city_generator', 9, -36, 0],
    ['city_crates', -22, -36, 1],
    ['city_wrecked_car', 33, -20, 1],
    ['city_kiosk', 12, -20, 0],
    ['city_dumpster', -14, -18, 0],
    ['city_barrier', -28, -17, 0],
  ])
    k.prop(model, x, z, { quarter });
  // Elewacje, neony i sznury lampionów.
  const row = (rect, side, model, ys, alongs, offset) =>
    ys.forEach((y, i) =>
      k.face(rect, side, alongs[i % alongs.length], y, model, offset),
    );
  row(WM, 'E', 'city_pipe_run', [0], [3, 12], 0.3);
  row(WM, 'E', 'city_ac_unit', [5, 8], [6, 20], 0.35);
  row(EM, 'W', 'city_fire_escape', [3.4, 9.5], [8], 0.6);
  row(EM, 'W', 'city_pipe_run', [0], [3, 20], 0.3);
  row(N1, 'E', 'city_fire_escape', [3.4, 9.5, 15.6], [8], 0.6);
  row(N2, 'S', 'city_shutter', [0], [4, 12], 0.2);
  row(N2, 'S', 'city_awning', [3.1], [8], 0.6);
  row(N3, 'W', 'city_fire_escape', [3.4, 9.5], [6], 0.6);
  row(N3, 'S', 'city_shutter', [0], [4, 8], 0.2);
  row(S1, 'E', 'city_door', [0], [8], 0.15);
  row(S1, 'N', 'city_ac_unit', [4, 7], [3, 7], 0.35);
  row(S2, 'W', 'city_pipe_run', [0], [4, 10], 0.3);
  k.faceNeon(WM, 'E', 7, 6.5, 'noodles', 3, 1.5, COLOR.amber, 0.2);
  k.faceNeon(EM, 'W', 7, 6.5, 'sake', 3, 1.5, COLOR.violet, 0.3);
  k.faceNeon(N1, 'E', 12, 6, 'bar_24h', 3, 1.5, COLOR.green, 0.3);
  k.faceNeon(N2, 'S', 10, 5.4, 'kebab', 2.6, 1.3, COLOR.amber, 0.25);
  k.faceNeon(N3, 'W', 13, 6, 'tattoo', 2.4, 1.2, COLOR.blue, 0.35);
  k.faceNeon(S1, 'E', 12, 5.5, 'karaoke', 2.8, 1.4, COLOR.violet, 0.3);
  k.faceNeon(S2, 'W', 8, 5, 'beer', 2.4, 1.2, COLOR.green, 0.3);
  // Neony na pokładzie estakady: landmark widoczny z całego targu.
  for (const x of [-24, 0, 24]) {
    k.neon('open', x, 11.3, 12.55, 12, 2.2, 0, COLOR.amber, 0.12);
    k.neon('noodles', x + 12, 11.3, -12.55, 10, 2.2, Math.PI, COLOR.warm, 0.2);
  }
  for (let x = -36; x <= 36; x += 12) {
    arena.light(vec(x, 9, 0), COLOR.amber, 22, 15);
    arena.light(vec(x + 6, 9, -7), COLOR.warm, 14, 12);
    arena.light(vec(x + 6, 9, 7), COLOR.warm, 14, 12);
  }
  for (const x of [-36, -26, -16, -6, 4, 14, 24, 34])
    k.deco('city_lantern_string', x - 5, 4.6, 0, 0);
  for (const z of [-4, 4])
    for (const x of [-33, 0, 33])
      k.deco('city_lantern_string', x - 5, 4.2, z, 0);
  for (const [x, z, c] of [
    [-24, 24, COLOR.amber],
    [2, 22, COLOR.blue],
    [26, 30, COLOR.green],
    [-34, 22, COLOR.violet],
    [-12, -22, COLOR.amber],
    [10, -25, COLOR.green],
    [28, -34, COLOR.violet],
    [-30, -28, COLOR.blue],
  ])
    k.lamp(x, z, c);
  k.light(-22, 5, 18, COLOR.green, 16, 12);
  k.light(34, 5, 24, COLOR.violet, 16, 12);

  for (const [x, z] of [
    [-20, 1],
    [14, -1],
    [-8, -26],
    [22, 22],
  ])
    k.fx('steam', x, 0.1, z, 1.2);
  for (const [x, y, z] of [
    [-14, 9.5, 6],
    [14, 9.5, -6],
    [0, 9.5, 10],
    [-28, 9.5, -4],
  ])
    k.fx('drip', x, y, z);
  k.fx('sparks', 31, 4, -10);

  for (const [tex, x, z, w] of [
    ['puddle1', -14, 12, 5],
    ['puddle2', 4, -3, 5],
    ['puddle1', 18, 8, 5],
    ['puddle2', -26, -2, 5],
    ['puddle1', -2, 28, 6],
    ['puddle2', 16, -26, 5],
    ['puddle1', -20, -24, 5],
    ['oil_stain', 8, 30, 3],
    ['oil_stain', -8, 12, 3],
    ['manhole', 0, 14.5, 1.6],
    ['manhole', 4, -18, 1.6],
    ['tire_marks', -14, 34, 5],
    ['floor_arrow', 18, -22, 2],
    ['floor_stop', -18, 30, 3],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -14, 0, 28],
      ['C', 18, 0, -30],
    ],
    zones: [
      ['Dojście południowe', R(-42, 42, 14, 38), 'open'],
      ['Targ pod estakadą', R(-34, 34, -9, 14), 'dense'],
      ['Pasarela', GALLERY, 'high'],
      ['Magazyny zachodnie', R(-42, -34, -14, 14), 'interior'],
      ['Ulica północna', R(-42, 42, -38, -14), 'low'],
    ],
    maxAlive: 9,
    minSpawnDistance: 12,
  });
  for (const [x, z] of [
    [-26, 34],
    [-6, 33],
    [16, 26],
    [34, 22],
    [-30, 10],
    [-16, 0],
    [0, 0],
    [16, 0],
    [30, 7],
    [-2, 9],
    [-16, -20],
    [-19, -33],
    [14, -33],
    [26, -26],
    [36, -18],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -18, z: 35, yaw: 5, pitch: 6 },
  { name: 'market', x: -30, z: 1, yaw: 270, pitch: 6 },
  { name: 'deck', x: 20, z: -2, yaw: 120, pitch: 22 },
  { name: 'gallery', x: -20, z: -11, floorY: 4, yaw: 270, pitch: -8 },
  { name: 'north', x: 0, z: -22, yaw: 180, pitch: 6 },
  { name: 'exit', x: 4, z: -4, yaw: 0, pitch: 4 },
];
