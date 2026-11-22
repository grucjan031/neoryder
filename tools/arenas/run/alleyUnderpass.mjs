// Zalana stacja metra (elite): plac przed stacją, perony po obu stronach zalanych torów (−1,4 m),
// wagon w wodzie, kładka, hala północna z antresolą (4,5 m). Wszystkie poziomy połączone rampami.
// Landmark: wieża z zegarem stacyjnym nad środkiem torów. Pogoda: rain (perony pod zadaszeniem).
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';

export default function generate() {
  const bounds = R(-34, 34, -60, 60);
  const k = createRunRoom({
    id: 'alleyUnderpass',
    name: 'Pod estakadą',
    type: 'elite',
    weather: 'rain',
    seed: 'run-underpass-v1',
    bounds,
    startX: -14,
    exitX: 22,
    wallMaterial: 'concrete',
    wallHeights: [13, 17, 15],
  });
  const { arena, p } = k;
  const bed = -1.4;
  const TRENCH = R(-12, 12, -30, 26);
  const roofY = 8;

  // Grunt na wysokości 0: plac, apron południowy, perony, hala północna. Tory w rowie (−1,4 m).
  k.ground(R(-34, 34, 36, 60), 0, 'paving');
  k.ground(R(-34, 34, 26, 36), 0, 'concrete');
  k.ground(R(-34, -12, -30, 26), 0, 'quay_concrete');
  k.ground(R(12, 34, -30, 26), 0, 'quay_concrete');
  k.ground(R(-34, 34, -60, -30), 0, 'concrete');
  k.ground(R(-12, 12, 2, 10), 0, 'steel_grating'); // kładka nad torami
  k.ground(TRENCH, bed, 'canal_water');
  k.perimeter();

  // Mury rowu z przerwami na rampy zejścia z peronów; rampy zejściowe (spadek ~0,18).
  const sideRamps = { [-12]: [12, -14], [12]: [20, -27.5] };
  for (const [xs, zs] of Object.entries(sideRamps)) {
    const x = Number(xs);
    p.wall(
      vec(x, bed, TRENCH.minZ),
      vec(x, bed, TRENCH.maxZ),
      1.4,
      0.4,
      'canal_stone_wall',
      {
        openings: zs.map((z) => ({
          at: z - TRENCH.minZ,
          width: 4.4,
          height: 1.4,
        })),
      },
    );
    for (const z of zs)
      k.ramp(vec(x, 0, z), vec(x + (x < 0 ? 8 : -8), bed, z), 4, 'concrete');
  }
  for (const z of [TRENCH.minZ, TRENCH.maxZ])
    p.wall(
      vec(TRENCH.minX, bed, z),
      vec(TRENCH.maxX, bed, z),
      1.4,
      0.4,
      'canal_stone_wall',
      {
        openings: [{ at: z === TRENCH.minZ ? 8 : 20, width: 4.4, height: 1.4 }],
      },
    );
  k.ramp(vec(-4, bed, -22), vec(-4, 0, -30), 4, 'concrete');
  k.ramp(vec(8, bed, 18), vec(8, 0, 26), 4, 'concrete');
  // Balustrady kładki.
  for (const z of [2, 10])
    p.wall(vec(-12, 0, z), vec(12, 0, z), 1.1, 0.12, 'metal');

  // Landmark: wieża z zegarem stacyjnym stoi w wodzie na środku torów (wierzch 33,6 m).
  arena.block({
    model: 'roof_clock_tower',
    size: vec(8, 35, 8),
    position: vec(0, bed + 17.5, 16),
    material: 'concrete',
    instance: true,
  });
  k.light(0, 6, 22, COLOR.warm, 60, 26);
  k.light(0, 6, 10, COLOR.warm, 40, 22);
  k.light(0, 24, 16, COLOR.amber, 60, 40);

  // Tory (dekoracje) i wagon na torze wschodnim.
  for (const z of [-24, -12, 0, 12, 24])
    for (const x of [-5, 5])
      k.deco('rail_track_straight', x, bed - 0.3, z, Math.PI / 2);
  k.prop('rail_maglev_car_open', 5, -12, {
    y: bed,
    quarter: 1,
    material: 'concrete',
  });

  // Zadaszenia peronów i hali północnej wsparte kolumnami; spód dachu na 8 m.
  const roofs = [
    R(-34, -12, -30, 26),
    R(12, 34, -30, 26),
    R(-34, 34, -60, -34),
  ];
  for (const r of roofs) {
    k.solid(r, roofY, roofY + 0.6, 'concrete');
    k.rainShelters.push({
      position: vec((r.minX + r.maxX) / 2, roofY / 2, (r.minZ + r.maxZ) / 2),
      size: vec(r.maxX - r.minX, roofY, r.maxZ - r.minZ),
    });
  }
  for (const x of [-14, 14])
    for (let z = -26; z <= 22; z += 12)
      k.solid(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), 0, roofY, 'concrete');
  for (const x of [-20, 0, 20])
    k.solid(R(x - 0.5, x + 0.5, -47.5, -46.5), 0, roofY, 'concrete');

  // Antresola hali północnej (4,5 m) z rampą od strony peronu.
  const MEZZ = R(24, 34, -56, -36);
  k.deck(MEZZ, 4.5, 'concrete');
  k.ramp(vec(11, 0, -46), vec(24, 4.5, -46), 3, 'metal');
  p.wall(vec(24, 4.5, -56), vec(24, 4.5, -36), 1.1, 0.12, 'metal', {
    openings: [{ at: 10, width: 3.4, height: 1.1 }],
  });

  // Kasy biletowe i bramki na placu: osłona przed wejściem na perony.
  const KASY = R(-26, -10, 38, 46);
  k.mass(KASY, 6, 'plaster');
  k.faceNeon(KASY, 'S', 8, 4.8, 'metro', 5, 2.5, COLOR.green, 0.15);
  k.faceNeon(KASY, 'E', 4, 3.6, 'implants', 2.2, 1.1, COLOR.blue, 0.3);
  const SHOPS = R(12, 34, 38, 48);
  k.mass(SHOPS, 8, 'plaster');
  k.faceNeon(SHOPS, 'W', 5, 5, 'ramen', 3, 1.5, COLOR.amber, 0.25);
  k.faceNeon(SHOPS, 'S', 11, 5.2, 'bar_24h', 3, 1.5, COLOR.green, 0.3);
  k.face(SHOPS, 'S', 5, 3.1, 'city_awning', 0.6);
  k.face(SHOPS, 'S', 16, 3.1, 'city_awning', 0.6);
  k.face(SHOPS, 'W', 8, 0, 'city_pipe_run', 0.3);
  k.face(KASY, 'S', 3, 0, 'city_door', 0.15);

  // Okładziny ścian: napisy kierunkowe, plakaty i instalacje.
  const wallW = R(-37, -34, -30, 26),
    wallE = R(34, 37, -30, 26),
    wallN = R(-34, 34, -63, -60);
  for (const z of [-24, -8, 8, 22]) {
    k.faceNeon(wallW, 'E', z + 30, 4.8, 'metro', 4, 2, COLOR.green, 0.15);
    k.faceNeon(wallE, 'W', z + 30, 4.8, 'arrow', 3.2, 1.6, COLOR.amber, 0.2);
  }
  for (const z of [-16, 0, 16]) {
    k.face(wallW, 'E', z + 30, 0, 'city_pipe_run', 0.3);
    k.face(wallE, 'W', z + 30, 2, 'city_ac_unit', 0.35);
    k.face(wallE, 'W', z + 34, 3, 'city_ac_unit', 0.35);
  }
  for (const x of [-24, -2, 14])
    k.face(wallN, 'S', x + 34, 0, 'city_shutter', 0.2);
  k.faceNeon(wallN, 'S', 56, 6.2, 'arrow', 4, 2, COLOR.green, 0.1);
  k.faceNeon(wallN, 'S', 12, 5.2, 'hotel', 3, 1.5, COLOR.violet, 0.3);

  // Osłony: perony, apron, plac, hala północna, antresola.
  const cover = [
    ['city_barrier', -26, 4, 0],
    ['city_vending', -32, 12, 3],
    ['city_crates', -22, -8, 0],
    ['city_dumpster', -30, -16, 1],
    ['city_generator', -18, -24, 0],
    ['city_barrier', -24, 20, 1],
    ['city_kiosk', -20, 0, 0],
    ['city_crates', -28, 24, 0],
    ['city_vending', 32, 6, 1],
    ['city_barrier', 24, -4, 0],
    ['city_crates', 18, 10, 1],
    ['city_generator', 30, -14, 0],
    ['city_dumpster', 22, -22, 1],
    ['city_kiosk', 26, 18, 0],
    ['city_barrier', 20, -26, 0],
    ['city_highway_barrier', -2, 30, 0],
    ['city_crates', 14, 31, 0],
    ['city_vending', -24, 32, 2],
    ['city_barrier', -8, 55, 0],
    ['city_car', 4, 52, 1],
    ['city_wrecked_car', -22, 54, 0],
    ['city_vending', 24, 56, 2],
    ['city_barrier', 4, 42, 0],
    ['city_dumpster', 28, 52, 1],
    ['city_crates', -2, 38, 0],
    ['city_highway_barrier', 12, 54, 0],
    ['city_crates', -16, -40, 0],
    ['city_generator', -4, -44, 0],
    ['city_barrier', 4, -38, 1],
    ['city_vending', 14, -52, 2],
    ['city_dumpster', -28, -54, 0],
    ['city_crates', -12, -54, 1],
    ['city_kiosk', 8, -40, 0],
    ['city_barrier', -22, -36, 0],
    ['city_highway_barrier', 16, -42, 0],
    ['city_generator', -32, -44, 1],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  for (const [model, x, z, quarter] of [
    ['city_crates', 28, -40, 0],
    ['city_generator', 32, -50, 1],
    ['city_barrier', 28, -54, 0],
  ])
    k.prop(model, x, z, { y: 4.5, quarter });
  for (const [x, z] of [
    [-6, -17],
    [-2, 36],
  ])
    k.deco('city_vent_grate', x, 0, z);

  // Światła: sufitowe lampy peronów (zimna biel), zielone znaki wyjścia, bursztynowe ostrzeżenia, błękit wody.
  for (const x of [-23, 23])
    for (let z = -26; z <= 22; z += 12)
      k.light(x, 7, z, z % 24 === 10 ? COLOR.green : COLOR.warm, 24, 15);
  for (const [x, z, c] of [
    [-20, -47, COLOR.warm],
    [0, -47, COLOR.green],
    [20, -47, COLOR.warm],
    [-20, -40, COLOR.amber],
    [28, -46, COLOR.violet],
  ])
    k.light(x, 7, z, c, 22, 15);
  for (const [x, z] of [
    [-6, -2],
    [6, 8],
    [-6, 20],
    [6, -26],
  ])
    k.light(x, bed + 1.2, z, COLOR.blue, 14, 10);
  for (const [x, z, c] of [
    [-24, 52, COLOR.amber],
    [10, 46, COLOR.blue],
    [26, 40, COLOR.green],
    [-8, 40, COLOR.amber],
  ])
    k.lamp(x, z, c);
  k.light(-14, 6, 30, COLOR.amber, 16, 12);
  k.light(14, 6, 30, COLOR.amber, 16, 12);

  for (const [x, y, z] of [
    [-20, 0.1, -2],
    [20, 0.1, 6],
    [-4, 0.1, -40],
    [-26, 0.1, 40],
  ])
    k.fx('steam', x, y, z, 1.2);
  for (const [x, y, z] of [
    [-16, 7.5, 10],
    [16, 7.5, -10],
    [-8, 7.5, -42],
    [10, 7.5, -50],
    [0, 7.5, 28],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-30, 2.5, -10],
    [30, 2.5, 14],
  ])
    k.fx('sparks', x, y, z);

  // Kałuże pod napięciem na peronach (hazard electric_field, jak dotychczas w tej elicie).
  for (const [id, x, z] of [
    ['underpass-puddle-a', -22, 8],
    ['underpass-puddle-b', 22, -10],
    ['underpass-puddle-c', -14, -44],
  ])
    k.hazards.push({
      kind: 'electric_field',
      id,
      position: vec(x, 0.7, z),
      size: vec(2, 1.4, 2),
      cycle: { onS: 2, offS: 3 },
    });
  for (const [tex, x, z, w] of [
    ['puddle1', -22, 8, 4],
    ['puddle2', 22, -10, 4],
    ['puddle1', -14, -44, 4],
    ['puddle2', -26, -20, 5],
    ['puddle1', 26, 12, 5],
    ['puddle2', 0, 32, 6],
    ['puddle1', -12, 54, 6],
    ['puddle2', 18, 46, 5],
    ['floor_hazard', -13, 4, 8],
    ['floor_hazard', 13, -4, 8],
    ['floor_arrow', 22, -34, 2],
    ['manhole', -6, 44, 1.6],
    ['crack_floor', 10, -48, 3],
  ])
    k.decal(
      tex,
      x,
      0.012,
      z,
      w,
      tex === 'floor_hazard' ? w * 0.12 : w * 0.7,
      tex === 'floor_hazard' ? Math.PI / 2 : 0,
    );

  k.finish({
    points: [
      ['A', 0, 0, 5],
      ['B', -24, 0, 12],
      ['C', 0, 0, -48],
    ],
    zones: [
      ['Plac przed stacją', R(-34, 34, 26, 60), 'open'],
      ['Perony zachodnie', R(-34, -12, -30, 26), 'interior'],
      ['Tory w wodzie', TRENCH, 'low'],
      ['Perony wschodnie', R(12, 34, -30, 26), 'dense'],
      ['Hala północna i antresola', R(-34, 34, -60, -30), 'high'],
    ],
    maxAlive: 11,
    minSpawnDistance: 16,
    spawnRing: { minM: 14, maxM: 90 },
  });
  for (const [x, z] of [
    [-28, 55],
    [-4, 50],
    [10, 44],
    [30, 52],
    [-14, 32],
    [22, 30],
    [-28, 8],
    [-22, -12],
    [-26, -22],
    [26, 8],
    [22, -14],
    [28, -20],
    [0, 6],
    [-20, -42],
    [-8, -50],
    [10, -46],
    [18, -56],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -14, z: 57, yaw: 0, pitch: 18 },
  { name: 'platform', x: -26, z: 20, yaw: 20, pitch: 6 },
  { name: 'tracks', x: 8, z: 22, floorY: -1.4, yaw: 0, pitch: 6 },
  { name: 'bridge', x: 0, z: 6, yaw: 270, pitch: 2 },
  { name: 'hall', x: -20, z: -38, yaw: 330, pitch: 4 },
  { name: 'mezzanine', x: 29, z: -40, floorY: 4.5, yaw: 90, pitch: -6 },
];
