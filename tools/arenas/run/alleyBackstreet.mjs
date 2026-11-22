// Zaplecze knajp (combat): ciasne zaułki, garaże z dachami i taras restauracji połączone rampami.
// Landmark: wieża z wielkim szyldem makaronu (widoczna ponad dachami z całej areny). Pogoda: rain.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

export default function generate() {
  const bounds = R(-34, 34, -44, 44);
  const k = createRunRoom({
    id: 'alleyBackstreet',
    name: 'Zaplecza kamienic',
    weather: 'rain',
    seed: 'run-backstreet-v1',
    bounds,
    startX: -22,
    exitX: 22,
    wallHeights: [15, 19, 23, 17],
  });
  const { arena } = k;

  // Grunt: asfalt na dziedzińcu, bruk w zaułkach. Szwy na liczbach całkowitych (siatka 1 m).
  k.ground(R(-34, 34, 20, 44), 0, 'asphalt');
  k.ground(R(-34, 34, -44, 20), 0, 'paving');
  k.perimeter();

  // Rząd 1 (z 8…20): knajpy zachodnie, garaż G1 (dach 3,2 m), taras restauracji (6,4 m).
  const A1 = R(-34, -20, 8, 20);
  const G1 = R(-12, 6, 10, 20);
  const E1 = R(18, 34, 8, 20);
  k.mass(A1, 15);
  k.deck(G1, 3.2, 'concrete');
  k.deck(E1, 6.4, 'concrete');
  // Rząd 2 (z −14…2): zachodni mur, garaż G2, wieża z szyldem, wschodni narożnik.
  const A2 = R(-34, -28, -14, 2);
  const G2 = R(-16, -2, -14, 2);
  const TOWER = R(8, 22, -14, 2);
  const E2 = R(28, 34, -14, 2);
  k.mass(A2, 19);
  k.deck(G2, 3.2, 'concrete');
  k.mass(TOWER, 34);
  k.mass(E2, 16);
  // Rząd 3 (z −38…−20): północne kamienice.
  const A3 = R(-34, -22, -38, -20);
  const B3 = R(-14, -4, -38, -20);
  const C3 = R(4, 16, -38, -20);
  const D3 = R(24, 34, -38, -20);
  k.mass(A3, 22);
  k.mass(B3, 14);
  k.mass(C3, 18);
  k.mass(D3, 20);
  // Zaplecze kuchni przy południowym murze (osłona wejścia).
  const ANNEX = R(-34, -26, 28, 38);
  const SHED = R(26, 34, 26, 36);
  k.mass(ANNEX, 9, 'plaster');
  k.mass(SHED, 8, 'corrugated');

  // Rampy: pożarówki na dachy garaży i taras (wrogowie wchodzą tylko rampami).
  k.ramp(vec(-4, 0, 32), vec(-4, 3.2, 20), 3, 'metal');
  k.ramp(vec(-27.5, 0, -6), vec(-16, 3.2, -6), 3, 'metal');
  k.ramp(vec(6, 3.2, 15), vec(18, 6.4, 15), 3, 'metal');
  // Kładka między dachami garaży nad zaułkiem (trasa flankująca, widok na dziedziniec).
  p_bridge(k, vec(-8, 3.2, 10), vec(-8, 3.2, 2));

  // Dodatki elewacji: klimatyzatory, schody pożarowe, rury, markizy, szyldy.
  const row = (rect, side, model, ys, alongs, offset) =>
    ys.forEach((y, i) =>
      k.face(rect, side, alongs[i % alongs.length], y, model, offset),
    );
  row(A1, 'E', 'city_fire_escape', [3.4, 9.5], [4], 0.6);
  row(A1, 'S', 'city_ac_unit', [4, 7.5, 11], [3, 8, 12], 0.35);
  row(A1, 'S', 'city_awning', [3.1], [7], 0.6);
  row(A2, 'E', 'city_fire_escape', [3.4, 9.6], [8], 0.6);
  row(A2, 'E', 'city_pipe_run', [0], [3, 13], 0.3);
  row(TOWER, 'S', 'city_awning', [3.1], [4, 10], 0.6);
  row(TOWER, 'W', 'city_pipe_run', [0], [3, 10], 0.3);
  row(TOWER, 'W', 'city_fire_escape', [3.4, 10.5, 17.6], [6], 0.6);
  row(E2, 'W', 'city_fire_escape', [3.4, 9.6], [5], 0.6);
  row(E2, 'W', 'city_ac_unit', [5, 8], [10], 0.35);
  row(A3, 'E', 'city_fire_escape', [3.4, 9.5, 15.6], [12], 0.6);
  row(A3, 'S', 'city_shutter', [0], [3, 8], 0.2);
  row(B3, 'S', 'city_shutter', [0], [3], 0.2);
  row(B3, 'W', 'city_ac_unit', [4.5, 8], [9], 0.35);
  row(C3, 'W', 'city_fire_escape', [3.4, 9.6], [5], 0.6);
  row(C3, 'S', 'city_door', [0], [6], 0.15);
  row(D3, 'W', 'city_pipe_run', [0], [3, 13], 0.3);
  row(D3, 'S', 'city_sign_box', [3.4], [5], 0.15);
  row(E1, 'W', 'city_sign_box', [5], [8], 0.15);
  row(E1, 'S', 'city_awning', [3.1], [4, 12], 0.6);
  row(G1, 'S', 'city_shutter', [0], [3, 9, 15], 0.2);
  row(G2, 'S', 'city_shutter', [0], [3, 7, 11], 0.2);
  row(G2, 'N', 'city_shutter', [0], [3, 10], 0.2);
  row(ANNEX, 'E', 'city_ac_unit', [3, 6], [4, 7], 0.35);
  row(SHED, 'W', 'city_pipe_run', [0], [4], 0.3);

  // Landmark: szyldy makaronu na wieży, od strony dziedzińca, zaułków i wyjścia.
  k.faceNeon(TOWER, 'S', 7, 27, 'ramen', 14, 7, COLOR.amber, 0.12);
  k.faceNeon(TOWER, 'S', 7, 18, 'noodles', 9, 4.5, COLOR.warm, 0.2);
  k.faceNeon(TOWER, 'W', 7, 26, 'noodles', 11, 5.5, COLOR.amber, 0.15);
  k.faceNeon(TOWER, 'E', 7, 26, 'ramen', 11, 5.5, COLOR.amber, 0.15);
  k.faceNeon(TOWER, 'N', 7, 26, 'ramen', 12, 6, COLOR.amber, 0.15);
  for (const [x, y, z, c] of [
    [15, 31, 4, COLOR.amber],
    [15, 22, 4.5, COLOR.warm],
    [6, 27, -6, COLOR.amber],
    [24, 27, -6, COLOR.amber],
  ])
    k.light(x, y, z, c, 60, 30);
  // Pozostałe neony knajp w różnych kolorach.
  k.faceNeon(A1, 'S', 4, 5.2, 'bar_24h', 2.6, 1.3, COLOR.green);
  k.faceNeon(A1, 'S', 10, 5.2, 'sake', 2.2, 1.1, COLOR.violet, 0.35);
  k.faceNeon(A1, 'E', 10, 5.2, 'karaoke', 2.4, 1.2, COLOR.blue);
  k.faceNeon(E1, 'S', 8, 4.8, 'kebab', 2.6, 1.3, COLOR.amber, 0.3);
  k.faceNeon(E1, 'W', 10, 5.2, 'beer', 2.2, 1.1, COLOR.green);
  k.faceNeon(G1, 'S', 9, 3.0, 'arcade', 2.8, 1.4, COLOR.violet, 0.4);
  k.faceNeon(A3, 'E', 6, 5.0, 'tattoo', 2.2, 1.1, COLOR.blue);
  k.faceNeon(D3, 'W', 9, 5.0, 'cocktail', 2.4, 1.2, COLOR.violet, 0.3);
  k.faceNeon(C3, 'E', 12, 5.0, 'noodles', 2.6, 1.3, COLOR.amber);
  k.faceNeon(B3, 'S', 5, 5.0, 'warsztat', 2.4, 1.2, COLOR.green, 0.4);
  k.faceNeon(E2, 'S', 3, 4.5, 'pharmacy', 2.0, 1.0, COLOR.green, 0.3);

  // Osłony na gruncie: dziedziniec, zaułki, północne przejścia. Wysokie (kiosk, automat) i niskie.
  const cover = [
    ['city_car', -26, 24, 0],
    ['city_dumpster', -30, 22, 0],
    ['city_crates', -17, 30, 1],
    ['city_vending', -9, 26, 2],
    ['city_generator', 8, 30, 0],
    ['city_car', 15, 27, 1],
    ['city_dumpster', 22, 23, 2],
    ['city_kiosk', 20, 33, 0],
    ['city_barrier', -14, 38, 0],
    ['city_crates', 4, 38, 0],
    ['city_dumpster', -22, 33, 1],
    ['city_vending', 30, 40, 2],
    ['city_barrier', 12, 22, 0],
    // zaułek z 8…10 (pomiędzy garażem a tarasem) i boczne przejścia
    ['city_dumpster', 10, 11, 0],
    ['city_crates', -17, 14, 0],
    ['city_dumpster', -24, 4, 1],
    ['city_generator', 4, 5, 0],
    ['city_vending', 14, 5, 2],
    ['city_barrier', 26, 5, 0],
    ['city_crates', 25, -4, 1],
    ['city_dumpster', 3, -10, 0],
    ['city_generator', 25, -11, 1],
    ['city_car', 3, -4, 1],
    // zaułek AL2 (z −20…−14)
    ['city_dumpster', -20, -17, 0],
    ['city_crates', -8, -17, 0],
    ['city_barrier', 8, -17, 1],
    ['city_vending', 20, -17, 2],
    ['city_generator', 30, -17, 0],
    // północne przejścia i pas przy wyjściu
    ['city_crates', -18, -28, 1],
    ['city_dumpster', 0, -26, 1],
    ['city_vending', 20, -26, 0],
    ['city_barrier', -26, -41, 0],
    ['city_crates', -8, -41, 0],
    ['city_dumpster', 6, -41, 0],
    ['city_generator', 16, -41, 0],
    ['city_kiosk', -30, -42, 0],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  // Osłony na dachach garaży i tarasie.
  for (const [model, x, z, y, quarter] of [
    ['city_crates', -2, 15, 3.2, 0],
    ['city_generator', -9, 12, 3.2, 1],
    ['city_vending', 3, 18, 3.2, 0],
    ['city_barrier', -6, -4, 3.2, 1],
    ['city_generator', -12, -10, 3.2, 0],
    ['city_crates', 26, 12, 6.4, 0],
    ['city_barrier', 22, 17, 6.4, 1],
    ['city_generator', 30, 17, 6.4, 0],
    ['city_vending', 24, 9.5, 6.4, 2],
  ])
    k.prop(model, x, z, { y, quarter });
  // Wysoki ogrodzony taras: klimatyzatory na dachu E1 jako dekoracje.
  k.deco('city_roof_hvac_unit', 32, 6.4, 14, -Math.PI / 2);
  k.deco('city_antenna', 20, 6.4, 18, 0);
  k.deco('city_antenna', -13, 3.2, -12, 0);

  // Lampy i światła zaułków (bursztyn/zieleń/fiolet/błękit).
  const lamps = [
    [-30, 26, COLOR.amber],
    [-8, 30, COLOR.green],
    [18, 24, COLOR.amber],
    [30, 34, COLOR.violet],
    [-10, 6, COLOR.blue],
    [8, 6, COLOR.amber],
    [30, 3, COLOR.green],
    [-22, -4, COLOR.amber],
    [-26, 2, COLOR.violet],
    [3, -8, COLOR.blue],
    [25, -10, COLOR.amber],
    [-18, -17, COLOR.green],
    [12, -17, COLOR.amber],
    [-18, -30, COLOR.blue],
    [0, -30, COLOR.amber],
    [20, -30, COLOR.violet],
    [-14, -41, COLOR.amber],
    [10, -41, COLOR.green],
  ];
  for (const [x, z, c] of lamps) k.lamp(x, z, c);
  for (const [x, y, z, c] of [
    [-3, 5, 14, COLOR.warm],
    [-8, 5, -6, COLOR.green],
    [26, 8, 14, COLOR.amber],
    [22, 3.5, -41, COLOR.green],
    [-22, 3.5, 42, COLOR.amber],
  ])
    k.light(x, y, z, c, 16, 14);

  // Para z kratek, kapanie z rynien, iskry z przewodów.
  for (const [x, z] of [
    [-12, 4],
    [10, -17],
    [-26, -29],
    [14, 30],
    [26, -29],
  ])
    k.fx('steam', x, 0.1, z, 1.2);
  for (const [x, y, z] of [
    [-24, 6, 4],
    [12, 6, 5],
    [-9, 6, -17],
    [18, 6, -29],
    [-18, 6, -29],
    [3, 5, 22],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-22, 4, 6],
    [26, 5, -17],
    [-3, 3.5, -12],
  ])
    k.fx('sparks', x, y, z);

  // Kałuże, plamy i oznakowanie.
  for (const [tex, x, z, w] of [
    ['puddle1', -20, 30, 5],
    ['puddle2', 6, 34, 6],
    ['puddle1', 24, 28, 5],
    ['puddle2', -8, 14, 4],
    ['puddle1', 3, 5, 5],
    ['puddle2', -22, -17, 5],
    ['puddle1', 14, -17, 5],
    ['puddle2', 0, -30, 4],
    ['puddle1', 20, -30, 4],
    ['oil_stain', -10, 36, 3],
    ['oil_stain', 12, 8, 3],
    ['manhole', -6, 4, 1.6],
    ['manhole', 20, 40, 1.6],
    ['manhole', 22, -41, 1.6],
    ['floor_arrow', 22, -32, 1.8],
    ['crack_floor', -12, -30, 3],
    ['tire_marks', -22, 38, 4],
    ['floor_hazard', -14, 20.5, 6],
  ])
    k.decal(tex, x, 0.012, z, w, w * (tex === 'floor_hazard' ? 0.25 : 0.7));

  k.finish({
    points: [
      ['A', 0, 0, 30],
      ['B', -22, 0, -17],
      ['C', 20, 0, -30],
    ],
    zones: [
      ['Dziedziniec zaplecza', R(-34, 34, 20, 44), 'open'],
      ['Zaułki knajp', R(-34, 34, 2, 20), 'dense'],
      ['Dachy i taras', R(-16, 34, 2, 20), 'high'],
      ['Wieża z szyldem', R(-34, 34, -14, 2), 'interior'],
      ['Północne przejścia', R(-34, 34, -44, -14), 'low'],
    ],
    maxAlive: 10,
    minSpawnDistance: 12,
  });
  for (const [x, z] of [
    [-12, 38],
    [8, 40],
    [20, 38],
    [-18, 26],
    [-2, 6],
    [16, 5],
    [32, 5],
    [-24, 6],
    [-22, -11],
    [26, -8],
    [3, -12],
    [-10, -17],
    [16, -17],
    [-18, -33],
    [0, -29],
    [20, -29],
    [-6, -41],
    [4, -41],
  ])
    k.spawn(x, z);
  return arena;
}

function p_bridge(k, from, to) {
  return k.p.bridge({ from, to, width: 3, y: from.y, material: 'metal' });
}

/** Widoki kontrolne dla `_shots.mjs`. */
export const shots = [
  { name: 'start', x: -22, z: 41, yaw: 0, pitch: 5 },
  { name: 'yard', x: 20, z: 36, yaw: 30, pitch: 8 },
  { name: 'alley', x: 0, z: 5, yaw: 270, pitch: 3 },
  { name: 'garageroof', x: -10, z: 12, floorY: 3.2, yaw: 330, pitch: -2 },
  { name: 'terrace', x: 30, z: 12, floorY: 6.4, yaw: 120, pitch: -4 },
  { name: 'north', x: -18, z: -17, yaw: 270, pitch: 3 },
];
