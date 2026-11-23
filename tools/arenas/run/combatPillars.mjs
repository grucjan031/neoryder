// Parking piętrowy (combat): dwa poziomy (grunt i pokład 4,6 m) pod wspólnym dachem, gęsty las
// filarów co 6 m, zaparkowane auta, rampy wjazdowa (południe) i zjazdowa (północ).
// Landmark: wieża windy w środku z neonowym „P” (bloki neon_green) ponad dachem. Pogoda: drizzleWind.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import { KITS, dressWall } from './_wallKit.mjs';

export default function generate() {
  const bounds = R(-36, 36, -46, 46);
  const k = createRunRoom({
    id: 'combatPillars',
    name: 'Parking piętrowy',
    weather: 'drizzleWind',
    seed: 'run-garage-v1',
    bounds,
    startX: -14,
    exitX: 14,
    wallMaterial: 'concrete',
    wallHeights: [14, 18, 16, 21],
  });
  const { arena, p } = k;
  const G = R(-28, 28, -26, 20);
  const DECK = 4.6;
  const ROOF = 8.8;

  k.ground(R(-36, 36, 20, 46), 0, 'asphalt');
  k.ground(R(-36, 36, -26, 20), 0, 'concrete');
  k.ground(R(-36, 36, -46, -26), 0, 'asphalt');
  k.perimeter();

  // Pokład i dach garażu; rampy po zewnętrznej stronie (południe w górę, północ w dół).
  p.floor(G, DECK, 'concrete', { thickness: 0.4 });
  k.solid(R(-28, 28, -26, 20), ROOF, ROOF + 0.6, 'concrete');
  k.ramp(vec(-21, 0, 34), vec(-21, DECK, 20), 3, 'concrete');
  k.ramp(vec(21, DECK, -26), vec(21, 0, -40), 3, 'concrete');
  p.wall(vec(-28, DECK, 20), vec(28, DECK, 20), 1.1, 0.2, 'concrete', {
    openings: [{ at: 7, width: 3.6, height: 1.1 }],
  });
  p.wall(vec(-28, DECK, -26), vec(28, DECK, -26), 1.1, 0.2, 'concrete', {
    openings: [{ at: 49, width: 3.6, height: 1.1 }],
  });
  p.wall(vec(-28, DECK, -26), vec(-28, DECK, 20), 1.1, 0.2, 'concrete');
  p.wall(vec(28, DECK, -26), vec(28, DECK, 20), 1.1, 0.2, 'concrete');
  k.rainShelters.push(
    { position: vec(0, 2.1, -3), size: vec(56, 4.2, 46) },
    { position: vec(0, 6.7, -3), size: vec(56, 4.2, 46) },
  );

  // Rdzeń windy (landmark): wieża szklano-betonowa; filary i rdzeń nie nakładają się.
  const CORE = R(-5, 5, -7, 3);
  k.reserve(CORE);
  k.reserve(CORE, DECK);
  k.solid(CORE, 0, 24, 'glass');
  k.solid(R(-5.2, 5.2, -7.2, 3.2), 0, 1.2, 'concrete');
  k.solid(R(-5.2, 5.2, -7.2, 3.2), 22.4, 24.6, 'trim');
  // Neon „P” z bloków neon_green: S, N, E i W (bryły 0,3 m przed ścianą rdzenia).
  const letter = (face) => {
    const bars = [
      // [dużo wzdłuż, szerokość, y0, y1]: pionowy trzon, górna i środkowa belka, prawy łuk.
      [-2.2, -1.2, 11, 20],
      [-2.2, 2, 20, 21],
      [-2.2, 2, 15.5, 16.5],
      [1, 2, 15.5, 20],
    ];
    for (const [a, b, y0, y1] of bars) {
      const rect =
        face === 'S' || face === 'N'
          ? face === 'S'
            ? R(a, b, 3.05, 3.35)
            : R(-b, -a, -7.35, -7.05)
          : face === 'E'
            ? R(5.05, 5.35, -2 + a, -2 + b)
            : R(-5.35, -5.05, -2 - b, -2 - a);
      k.solid(rect, y0, y1, 'neon_green');
    }
  };
  for (const face of ['S', 'N', 'E', 'W']) letter(face);
  k.light(0, 12, 8, COLOR.green, 70, 34);
  k.light(0, 18, -12, COLOR.green, 50, 30);
  k.light(-10, 12, -2, COLOR.green, 40, 24);
  k.light(10, 12, -2, COLOR.green, 40, 24);

  // Las filarów: dwa poziomy; omija rdzeń i pasy ramp.
  const pillarXs = [-24, -18, -12, -6, 0, 6, 12, 18, 24];
  const pillarZs = [-20, -14, -8, -2, 4, 10, 16];
  const nearCore = (x, z) => Math.abs(x) < 7 && z > -9 && z < 5;
  for (const x of pillarXs)
    for (const z of pillarZs) {
      if (nearCore(x, z)) continue;
      const r = R(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
      k.reserve(r);
      k.reserve(r, DECK);
      k.solid(r, 0, DECK - 0.4, 'concrete');
      k.solid(r, DECK, ROOF, 'concrete');
    }

  // Oświetlenie garażu: świetlówki co 12 m na obu poziomach (zimna biel, fiolet, błękit).
  for (let x = -24; x <= 24; x += 12)
    for (const z of [-17, -5, 7, 17]) {
      if (nearCore(x, z) || (Math.abs(x) < 7 && Math.abs(z + 2) < 8)) continue;
      const c = (x + z) % 3 === 0 ? COLOR.violet : COLOR.warm;
      k.light(x, 3.7, z, c, 14, 9);
      k.light(x, ROOF - 0.5, z, (x - z) % 4 === 0 ? COLOR.blue : COLOR.warm, 14, 9);
    }

  // Zaparkowane auta w polach między filarami (pasy ramp x = ±21 zostają wolne).
  const cells = [];
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 6; j++) {
      const x = -21 + i * 6,
        z = -17 + j * 6;
      if (Math.abs(x) === 21) continue;
      if (Math.abs(x) < 8 && z > -10 && z < 6) continue;
      cells.push([i, j, x, z]);
    }
  for (const [i, j, x, z] of cells) {
    if ((i * 7 + j * 3) % 3 === 0)
      k.prop(i % 2 ? 'city_car' : 'city_wrecked_car', x, z, {
        quarter: i % 2 ? 1 : 0,
      });
    if ((i + j * 2) % 3 === 1)
      k.prop(j % 2 ? 'city_wrecked_car' : 'city_car', x, z, {
        y: DECK,
        quarter: j % 2 ? 0 : 1,
      });
  }
  for (const [model, x, z, q, y] of [
    ['city_barrier', -21, -2, 1, 0],
    ['city_crates', 21, 12, 0, 0],
    ['city_vending', -26, 6, 1, 0],
    ['city_generator', 26, -10, 0, 0],
    ['city_kiosk', 9, 8, 0, 0],
    ['city_crates', -9, -22, 0, 0],
    ['city_barrier', 9, -17, 1, 0],
    ['city_dumpster', -26, -22, 0, 0],
    ['city_vending', 26, 17, 3, 0],
    ['city_barrier', -15, 6, 0, DECK],
    ['city_generator', -26, 14, 1, DECK],
    ['city_vending', 26, -22, 1, DECK],
    ['city_highway_barrier', 8, 14, 0, DECK],
    ['city_highway_barrier', -9, -16, 0, DECK],
    ['city_kiosk', 0, 17, 0, DECK],
  ])
    k.prop(model, x, z, { quarter: q, y });

  // Dekoracje garażu: znaki kierunkowe, rury, skrzynki; neony na filarach i belkach.
  for (const [tex, x, z, tint] of [
    ['arrow', -21, 19.7, COLOR.amber],
    ['arrow', 21, -25.7, COLOR.amber],
    ['open', 0, 19.7, COLOR.green],
  ])
    k.neon(tex, x, 3, z, 3, 1.5, z > 0 ? 0 : Math.PI, tint, 0.2);
  for (const [tex, x, z, tint] of [
    ['arrow', -12, -2, COLOR.blue],
    ['bar_24h', 12, 7, COLOR.violet],
    ['arcade', -18, -11, COLOR.violet],
    ['sake', 18, -14, COLOR.amber],
  ])
    k.neon(tex, x, 3.3, z, 2.4, 1.2, 0, tint, 0.3);
  for (const [tex, x, z, yaw, tint] of [
    ['hotel', -26, 0, Math.PI / 2, COLOR.violet],
    ['beer', 26, -6, -Math.PI / 2, COLOR.green],
  ])
    k.neon(tex, x, DECK + 2.4, z, 2.6, 1.3, yaw, tint, 0.25);

  // Zabudowa placów: kasa, biuro, magazyn.
  const KASA = R(-6, 2, 36, 42);
  const BIURO = R(-36, -26, -44, -32);
  const MAG = R(26, 36, -44, -32);
  const SKLEP = R(26, 36, 24, 38);
  k.mass(KASA, 4, 'plaster');
  k.mass(BIURO, 8, 'facade');
  k.mass(MAG, 7, 'corrugated');
  k.mass(SKLEP, 9, 'plaster');
  k.faceNeon(KASA, 'S', 4, 3.2, 'open', 2.4, 1.2, COLOR.green, 0.2);
  k.faceNeon(BIURO, 'E', 6, 5, 'hotel', 3, 1.5, COLOR.violet, 0.25);
  k.faceNeon(MAG, 'W', 6, 4.4, 'warsztat', 3, 1.5, COLOR.amber, 0.3);
  k.faceNeon(SKLEP, 'W', 7, 6, 'ramen', 3.2, 1.6, COLOR.amber, 0.25);
  k.faceNeon(SKLEP, 'W', 11, 3.8, 'pharmacy', 2.4, 1.2, COLOR.blue, 0.2);
  k.face(KASA, 'S', 6, 0, 'city_door', 0.15);
  k.face(BIURO, 'E', 4, 3.1, 'city_awning', 0.6);
  k.face(BIURO, 'E', 10, 0, 'city_pipe_run', 0.3);
  k.face(BIURO, 'E', 6, 6.4, 'city_ac_unit', 0.35);
  k.face(MAG, 'W', 4, 0, 'city_shutter', 0.2);
  k.face(MAG, 'W', 10, 0, 'city_shutter', 0.2);
  k.face(MAG, 'S', 4, 4.6, 'city_ac_unit', 0.35);
  k.face(SKLEP, 'W', 3, 3.1, 'city_awning', 0.6);
  k.face(SKLEP, 'W', 7, 0, 'city_door', 0.15);

  const wallW = R(-39, -36, -46, 46),
    wallE = R(36, 39, -46, 46),
    wallS = R(-36, 36, 46, 49),
    wallN = R(-36, 36, -49, -46);
  dressWall(k, wallW, 'E', 20, 46, {
    step: 5,
    kit: KITS.street,
    neons: [
      ['noodles', 5.8, 3, 1.5, COLOR.amber],
      ['karaoke', 6.8, 2.8, 1.4, COLOR.violet],
    ],
  });
  dressWall(k, wallW, 'E', 0, 4, { kit: [] });
  dressWall(k, wallW, 'E', 46, 70, {
    step: 6,
    kit: KITS.industrial,
    salt: 2,
    neons: [['arrow', 5, 2.6, 1.3, COLOR.blue, 0.15]],
  });
  dressWall(k, wallE, 'W', 0, 36, {
    step: 5,
    kit: KITS.street,
    salt: 1,
    neons: [
      ['beer', 5.8, 2.6, 1.3, COLOR.green],
      ['sake', 6.8, 2.6, 1.3, COLOR.violet],
    ],
  });
  dressWall(k, wallE, 'W', 46, 70, {
    step: 6,
    kit: KITS.industrial,
    salt: 3,
  });
  dressWall(k, wallS, 'N', 0, 72, {
    step: 5,
    kit: KITS.street,
    salt: 4,
    neons: [
      ['cocktail', 5.6, 2.6, 1.3, COLOR.violet, 0.3],
      ['hotel', 6.4, 3, 1.5, COLOR.amber, 0.2],
    ],
  });
  dressWall(k, wallN, 'S', 0, 72, {
    step: 5,
    kit: KITS.industrial,
    salt: 1,
    neons: [['repair', 5.6, 3, 1.5, COLOR.green]],
  });
  k.deco('city_cable_span', -35.5, 8, -10, Math.PI / 2);
  k.deco('city_cable_span', 35.5, 8, 30, -Math.PI / 2);

  // Place: osłony i oświetlenie.
  const yard = [
    ['city_car', -26, 40, 0],
    ['city_wrecked_car', 12, 38, 1],
    ['city_car', 20, 30, 1],
    ['city_barrier', -14, 38, 0],
    ['city_barrier', -14, 30, 0],
    ['city_crates', -30, 28, 0],
    ['city_vending', 8, 44, 2],
    ['city_dumpster', 30, 43, 1],
    ['city_highway_barrier', 4, 28, 0],
    ['city_generator', -32, 22, 0],
    ['city_kiosk', 16, 22, 0],
    ['city_car', -10, 24, 1],
    ['city_car', -22, -35, 1],
    ['city_wrecked_car', -12, -30, 0],
    ['city_barrier', 4, -32, 0],
    ['city_crates', 12, -44, 0],
    ['city_highway_barrier', 24, -34, 1],
    ['city_vending', -14, -44, 2],
    ['city_generator', 0, -42, 0],
    ['city_dumpster', 28, -28, 0],
    ['city_car', 30, 8, 1],
    ['city_barrier', -32, -8, 1],
    ['city_crates', 33, -14, 0],
    ['city_kiosk', -32, 10, 0],
    ['city_wrecked_car', -32, -16, 1],
  ];
  for (const [model, x, z, quarter] of yard) k.prop(model, x, z, { quarter });
  for (const [x, z, c] of [
    [-30, 44, COLOR.amber],
    [4, 34, COLOR.violet],
    [24, 40, COLOR.blue],
    [-18, 22, COLOR.green],
    [-22, -40, COLOR.amber],
    [8, -38, COLOR.violet],
    [30, -22, COLOR.blue],
    [33, 4, COLOR.amber],
    [-33, 2, COLOR.green],
  ])
    k.lamp(x, z, c);
  k.light(-14, 6, 30, COLOR.warm, 20, 14);
  k.light(14, 6, -36, COLOR.warm, 20, 14);
  for (const [x, z] of [
    [-18, 34],
    [26, 20],
    [-8, -34],
    [30, -40],
  ])
    k.fx('steam', x, 0.1, z, 1.1);
  for (const [x, y, z] of [
    [-14, 4, 12],
    [14, 4, -12],
    [-20, 8, -10],
    [20, 8, 8],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-27, 3, -14],
    [27, 3, 14],
  ])
    k.fx('sparks', x, y, z);
  for (const [x, z] of [
    [-24, 31],
    [-4, 26],
    [22, 36],
    [-20, -36],
    [18, -30],
    [34, 0],
  ])
    k.deco('city_traffic_cone', x, 0, z);

  for (const [tex, x, z, w] of [
    ['oil_stain', -8, 6, 3],
    ['oil_stain', 14, -6, 3],
    ['tire_marks', 0, 28, 5],
    ['floor_arrow', -21, 26, 2.4],
    ['floor_arrow', 21, -32, 2.4],
    ['floor_stop', -14, 34, 3],
    ['puddle1', -4, 40, 5],
    ['puddle2', 20, 26, 5],
    ['puddle1', -24, -38, 5],
    ['puddle2', 10, -40, 5],
    ['manhole', 6, 32, 1.6],
    ['crack_floor', -10, 14, 3],
    ['crack_floor', 16, -20, 3],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);
  for (const x of [-30, -24, -18, 18, 24, 30])
    k.decal('floor_hazard', x, 0.012, 20.4, 5, 0.6, 0);

  k.finish({
    points: [
      ['A', 0, 0, 14],
      ['B', -14, 0, 40],
      ['C', 14, 0, -40],
    ],
    zones: [
      ['Wjazd i plac', R(-36, 36, 20, 46), 'open'],
      ['Poziom 0 — las filarów', G, 'dense'],
      ['Pokład i dach', G, 'high'],
      ['Rdzeń windy', CORE, 'interior'],
      ['Plac północny', R(-36, 36, -46, -26), 'low'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
    spawnRing: { minM: 12, maxM: 95 },
  });
  for (const [x, z] of [
    [-34, 42],
    [-6, 44],
    [14, 34],
    [34, 42],
    [-30, 24],
    [-24, 14],
    [-9, 13],
    [12, 13],
    [21, 7],
    [-24, -6],
    [0, -16],
    [18, -22],
    [-30, -30],
    [-4, -38],
    [20, -42],
    [34, -30],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -14, z: 43, yaw: 0, pitch: 10 },
  { name: 'entry', x: -20, z: 30, yaw: 0, pitch: 6 },
  { name: 'level0', x: -21, z: 12, yaw: 350, pitch: 3 },
  { name: 'deck', x: -15, z: 12, floorY: 4.6, yaw: 340, pitch: 3 },
  { name: 'core', x: 12, z: 12, yaw: 330, pitch: 8 },
  { name: 'north', x: 14, z: -34, yaw: 160, pitch: 6 },
];
