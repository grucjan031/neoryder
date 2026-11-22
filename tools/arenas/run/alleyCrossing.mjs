// Skrzyżowanie pod hologramem (combat): plac z kioskami i wrakami, otwarte zejście do przejścia
// podziemnego (−3,2 m, dwie rampy) oraz taras kawiarni na 3,4 m. Landmark: maszt z czterema
// hologramami nad środkiem placu. Pogoda: drizzleWind.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

export default function generate() {
  const bounds = R(-44, 44, -40, 40);
  const k = createRunRoom({
    id: 'alleyCrossing',
    name: 'Skrzyżowanie Kurogane',
    weather: 'drizzleWind',
    seed: 'run-crossing-v1',
    bounds,
    startX: -26,
    exitX: 26,
    wallHeights: [16, 22, 18, 26],
  });
  const { arena, p } = k;
  const TUNNEL = R(-20, 20, -5, 5);
  const OPEN_W = R(-20, -8, -5, 5);
  const OPEN_E = R(8, 20, -5, 5);
  const trenchY = -3.2;

  // Grunt: ulice z asfaltu, plac z bruku z otworami nad odkrytymi odcinkami przejścia.
  for (const [rect, material] of [
    [R(-44, 44, 22, 40), 'asphalt'],
    [R(-44, 44, -40, -22), 'asphalt'],
    [R(-44, -26, -22, 22), 'asphalt'],
    [R(26, 44, -22, 22), 'asphalt'],
  ])
    k.ground(rect, 0, material);
  p.slab({
    rect: R(-26, 26, -22, 22),
    y: 0,
    holes: [OPEN_W, OPEN_E],
    material: 'paving',
  });
  k.perimeter();

  // Przejście podziemne: dno, boczne mury, ściany szczytowe z otworami na rampy.
  k.ground(TUNNEL, trenchY, 'concrete');
  for (const z of [TUNNEL.minZ, TUNNEL.maxZ])
    p.wall(
      vec(TUNNEL.minX, trenchY, z),
      vec(TUNNEL.maxX, trenchY, z),
      3.2,
      0.4,
      'concrete',
    );
  for (const x of [TUNNEL.minX, TUNNEL.maxX])
    p.wall(
      vec(x, trenchY, TUNNEL.minZ),
      vec(x, trenchY, TUNNEL.maxZ),
      3.2,
      0.4,
      'concrete',
      {
        openings: [{ at: 5, width: 4.4, height: 3.2 }],
      },
    );
  k.ramp(vec(-10, trenchY, 0), vec(-20, 0, 0), 4, 'concrete');
  k.ramp(vec(10, trenchY, 0), vec(20, 0, 0), 4, 'concrete');
  // Balustrady nad odkrytymi odcinkami (poza rampami).
  for (const open of [OPEN_W, OPEN_E])
    for (const z of [open.minZ - 0.2, open.maxZ + 0.2])
      p.wall(vec(open.minX, 0, z), vec(open.maxX, 0, z), 1.1, 0.15, 'metal');

  // Zabudowa: zachodnie kamienice, wschodnia kamienica i taras kawiarni (3,4 m) z rampą.
  const W1 = R(-44, -26, -20, -2);
  const W2 = R(-44, -26, 4, 20);
  const E1 = R(26, 44, -20, -4);
  const E2 = R(26, 44, 6, 20);
  const NW = R(-44, -34, -40, -30);
  const NM = R(-14, 6, -40, -30);
  const NE = R(34, 44, -40, -30);
  const S1 = R(-44, -34, 28, 40);
  const S2 = R(32, 44, 30, 40);
  k.mass(W1, 18);
  k.mass(W2, 14, 'plaster');
  k.mass(E1, 22);
  k.deck(E2, 3.4, 'concrete');
  k.mass(NW, 20);
  k.mass(NM, 16, 'plaster');
  k.mass(NE, 22);
  k.mass(S1, 12, 'plaster');
  k.mass(S2, 10, 'corrugated');
  k.ramp(vec(14, 0, 13), vec(26, 3.4, 13), 3, 'metal');

  // Wyspa pod hologramem na północ od przejścia: cokół, maszt nośny i cztery hologramy (15 m).
  // Środek areny (0, 0) zostaje wolny: misja m01 stawia tam maszt do zniszczenia (strefa 1,6 m,
  // strażnicy w promieniu 3 m), więc nic nie może zajmować okręgu o promieniu ~3 m wokół niego.
  const IZ = -14;
  k.mass(R(-5, 5, IZ - 5, IZ + 5), 0.4, 'trim');
  k.mass(R(-2, 2, IZ - 2, IZ + 2), 16, 'metal');
  for (const [x, z] of [
    [-3.6, IZ - 3.6],
    [3.6, IZ - 3.6],
    [-3.6, IZ + 3.6],
    [3.6, IZ + 3.6],
  ])
    k.deco('city_holo_projector', x, 0.4, z);
  k.holo('holo_kurogane', 0, 15.5, IZ + 2.5, 13, 7.5, 0, COLOR.warm);
  k.holo('holo_koi', 2.5, 15.5, IZ, 13, 7.5, Math.PI / 2, COLOR.blue);
  k.holo('holo_jellyfish', 0, 15.5, IZ - 2.5, 13, 7.5, Math.PI, COLOR.violet);
  k.holo('holo_drink', -2.5, 15.5, IZ, 13, 7.5, -Math.PI / 2, COLOR.green);
  k.light(0, 11, IZ, COLOR.violet, 70, 30);
  k.light(0, 18, IZ, COLOR.blue, 60, 34);
  k.light(0, 3, IZ + 7, COLOR.warm, 28, 18);
  k.light(0, 3, IZ - 7, COLOR.warm, 28, 18);

  // Elewacje i szyldy.
  const row = (rect, side, model, ys, alongs, offset) =>
    ys.forEach((y, i) =>
      k.face(rect, side, alongs[i % alongs.length], y, model, offset),
    );
  row(W1, 'E', 'city_awning', [3.1], [4, 12], 0.6);
  row(W1, 'E', 'city_ac_unit', [6, 9, 12], [3, 8, 14], 0.35);
  row(W1, 'S', 'city_fire_escape', [3.4, 9.5], [10], 0.6);
  row(W2, 'E', 'city_awning', [3.1], [5, 12], 0.6);
  row(W2, 'E', 'city_shutter', [0], [9], 0.2);
  row(E1, 'W', 'city_awning', [3.1], [4, 12], 0.6);
  row(E1, 'W', 'city_pipe_run', [0], [2, 14], 0.3);
  row(E1, 'W', 'city_ac_unit', [6, 9, 12], [5, 9, 13], 0.35);
  row(E1, 'N', 'city_fire_escape', [3.4, 9.5, 15.6], [9], 0.6);
  row(E2, 'W', 'city_shutter', [0], [4, 10], 0.2);
  row(E2, 'N', 'city_awning', [3.1], [8], 0.6);
  row(NM, 'S', 'city_shutter', [0], [4, 12], 0.2);
  row(NM, 'S', 'city_sign_box', [3.6], [8], 0.15);
  row(NW, 'E', 'city_pipe_run', [0], [3, 8], 0.3);
  row(NE, 'W', 'city_fire_escape', [3.4, 9.5], [4], 0.6);
  row(S1, 'E', 'city_door', [0], [4], 0.15);
  row(S1, 'N', 'city_ac_unit', [4, 7], [3, 6], 0.35);
  row(S2, 'W', 'city_pipe_run', [0], [3, 7], 0.3);
  k.faceNeon(W1, 'E', 8, 7, 'metro', 4, 2, COLOR.green, 0.15);
  k.faceNeon(W1, 'E', 14, 5.2, 'bar_24h', 2.6, 1.3, COLOR.amber, 0.25);
  k.faceNeon(W2, 'E', 9, 5, 'cat_cafe', 2.6, 1.3, COLOR.violet, 0.3);
  k.faceNeon(E1, 'W', 9, 7, 'metro', 4, 2, COLOR.green, 0.15);
  k.faceNeon(E1, 'W', 5, 5.2, 'hotel', 2.6, 1.3, COLOR.blue, 0.2);
  k.faceNeon(E1, 'W', 13, 5.2, 'sake', 2.2, 1.1, COLOR.amber, 0.3);
  k.faceNeon(E2, 'W', 7, 4.6, 'cocktail', 2.4, 1.2, COLOR.violet, 0.3);
  k.faceNeon(E2, 'N', 12, 4.6, 'karaoke', 2.4, 1.2, COLOR.blue, 0.35);
  k.faceNeon(NM, 'S', 6, 5.2, 'implants', 2.4, 1.2, COLOR.green, 0.25);
  k.faceNeon(NW, 'E', 5, 5.2, 'repair', 2.4, 1.2, COLOR.amber, 0.3);
  k.faceNeon(NE, 'W', 7, 5.2, 'pharmacy', 2.2, 1.1, COLOR.green, 0.3);
  k.faceNeon(S1, 'E', 8, 5, 'arcade', 2.6, 1.3, COLOR.violet, 0.35);
  k.faceNeon(S2, 'W', 6, 4.5, 'kebab', 2.4, 1.2, COLOR.amber, 0.3);

  // Osłony: kioski, wraki, bariery. Plac ma gęste centrum i otwarte krawędzie.
  const cover = [
    ['city_kiosk', -14, -12, 0],
    ['city_kiosk', 14, -14, 0],
    ['city_kiosk', -16, 9, 0],
    ['city_kiosk', 8, 17, 0],
    ['city_kiosk', 0, 20, 0],
    ['city_wrecked_car', -11, 13, 0],
    ['city_wrecked_car', 10, -9, 1],
    ['city_wrecked_car', 19, -9, 0],
    ['city_wrecked_car', -20, 6, 1],
    ['city_wrecked_car', -12, -21, 0],
    ['city_wrecked_car', -6.2, 8, 1],
    ['city_car', -6, 14, 1],
    ['city_car', 4, 12, 0],
    ['city_car', -18, -14, 1],
    ['city_barrier', 8, -6.5, 0],
    ['city_barrier', -11, 5, 0],
    ['city_barrier', 15, 6, 1],
    ['city_vending', -22, -10, 2],
    ['city_vending', 22, -10, 2],
    ['city_stall', -11, -16, 0],
    ['city_stall', 18, 17, 0],
    ['city_crates', -22, 12, 0],
    // ulica południowa
    ['city_car', -12, 30, 1],
    ['city_dumpster', -30, 34, 1],
    ['city_barrier', 0, 28, 0],
    ['city_crates', 12, 33, 0],
    ['city_wrecked_car', 20, 26, 1],
    ['city_vending', 26, 38, 2],
    ['city_generator', -22, 25, 0],
    ['city_kiosk', 0, 36, 0],
    // ulica północna
    ['city_car', -24, -26, 0],
    ['city_dumpster', -8, -27, 0],
    ['city_barrier', 12, -26, 0],
    ['city_crates', 20, -34, 0],
    ['city_wrecked_car', 19.5, -29.5, 1],
    ['city_wrecked_car', 30, -28, 1],
    ['city_generator', -26, -36, 0],
    ['city_vending', 12, -38, 2],
    // boczne przejścia przy zachodnich i wschodnim bloku
    ['city_dumpster', -34, 1, 1],
    ['city_crates', 34, -1, 0],
    ['city_dumpster', 36, 1, 0],
    // przy rampie tarasu i ścianie wschodniej
    ['city_crates', 40, -1, 0],
    ['city_wrecked_car', -18, 27, 1],
    ['city_stall', 5.2, -7.5, 0],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  // Taras kawiarni (3,4 m).
  for (const [model, x, z, y, quarter] of [
    ['city_stall', 32, 11, 3.4, 0],
    ['city_crates', 38, 9, 3.4, 0],
    ['city_vending', 41, 16, 3.4, 2],
    ['city_barrier', 33, 17, 3.4, 0],
    ['city_generator', 40, 12, 3.4, 1],
  ])
    k.prop(model, x, z, { y, quarter });

  // Lampy.
  const lamps = [
    [-22, 38, COLOR.amber],
    [10, 36, COLOR.blue],
    [34, 24, COLOR.green],
    [-24, 14, COLOR.amber],
    [-24, -14, COLOR.violet],
    [24, -14, COLOR.amber],
    [-12, -3, COLOR.blue],
    [12, 3, COLOR.blue],
    [0, 14, COLOR.warm],
    [0, -14, COLOR.warm],
    [-38, 0, COLOR.green],
    [38, 0, COLOR.amber],
    [-14, -34, COLOR.amber],
    [14, -33, COLOR.green],
    [36, -26, COLOR.violet],
    [-36, -24, COLOR.blue],
  ];
  for (const [x, z, c] of lamps) k.lamp(x, z, c);
  // Oświetlenie przejścia podziemnego (zimne zielono-białe).
  for (const [x, z, c] of [
    [-18, 0, COLOR.green],
    [-8, -3, COLOR.warm],
    [0, 3, COLOR.warm],
    [8, -3, COLOR.warm],
    [18, 0, COLOR.green],
  ])
    k.light(x, trenchY + 2.2, z, c, 18, 12);
  k.light(36, 6, 13, COLOR.amber, 22, 14);

  for (const [x, z] of [
    [-6, 1],
    [30, 2],
    [-30, 24],
    [22, -30],
  ])
    k.fx('steam', x, 0.1, z, 1.2);
  for (const [x, y, z] of [
    [-34, 6, 8],
    [34, 6, -10],
    [-34, 6, -12],
    [0, 6, -34],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-20, trenchY + 2.5, 0],
    [0, 4, -17],
  ])
    k.fx('sparks', x, y, z);

  for (const [tex, x, z, w] of [
    ['puddle1', -10, -4, 5],
    ['puddle2', 12, 8, 5],
    ['puddle1', 0, 26, 6],
    ['puddle2', -24, 32, 5],
    ['puddle1', 18, -26, 6],
    ['puddle2', -6, -26, 5],
    ['oil_stain', 16, -8, 3],
    ['oil_stain', -14, 16, 3],
    ['tire_marks', 0, 32, 5],
    ['tire_marks', -30, 0, 5],
    ['crack_floor', 8, 10, 3],
    ['manhole', 6, -8, 1.6],
    ['manhole', -12, 24, 1.6],
    ['floor_stop', -26, 30, 3],
    ['floor_arrow', 26, -32, 2],
    ['floor_hazard', -20, trenchY + 0.012, 5],
    ['floor_hazard', 20, trenchY + 0.012, 5],
  ])
    k.decal(
      tex,
      x,
      tex === 'floor_hazard' ? trenchY + 0.012 : 0.012,
      z,
      w,
      w * 0.6,
    );

  k.finish({
    points: [
      ['A', 0, 0, 30],
      ['B', 0, 0, 14],
      ['C', 0, trenchY, 0],
    ],
    zones: [
      ['Ulica południowa', R(-44, 44, 22, 40), 'open'],
      ['Plac pod hologramem', R(-26, 26, -22, 22), 'dense'],
      ['Przejście podziemne', TUNNEL, 'low'],
      ['Zachodnie kamienice', R(-44, -26, -22, 22), 'interior'],
      ['Taras kawiarni', R(26, 44, 6, 20), 'high'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
  });
  for (const [x, z] of [
    [-14, 36],
    [8, 32],
    [26, 32],
    [-26, 24],
    [-30, 1],
    [32, 1],
    [-18, 16],
    [-18, -8],
    [12, 19],
    [10, -18],
    [-3, 3],
    [-4, -8],
    [-20, -30],
    [0, -26],
    [14, -31],
    [28, -33],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -26, z: 37, yaw: 20, pitch: 6 },
  { name: 'plaza', x: -20, z: 20, yaw: 325, pitch: 14 },
  { name: 'holo', x: 0, z: 8, yaw: 0, pitch: 30 },
  { name: 'tunnel', x: -4, z: 0, floorY: -3.2, yaw: 90, pitch: 4 },
  { name: 'terrace', x: 40, z: 8, floorY: 3.4, yaw: 90, pitch: -3 },
  { name: 'north', x: -16, z: -26, yaw: 270, pitch: 4 },
];
