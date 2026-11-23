// Terminal maglevu (combat): hala dworcowa, dwa perony (1,4 m) z zadaszeniem, cztery tory z wagonami
// maglev jako osłonami, kładka na 5 m nad torami i peronami (rampy w pasach serwisowych).
// Landmark: wieża kontroli ze szyldem i zadaszenia peronów. Pogoda: clearNight.
// Środek pola torów (|x| ≤ 7, z −15…13) zostaje wolny: stary Szturm (assault.json, roomId) ma tam stacje.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import { KITS, dressWall } from './_wallKit.mjs';

export default function generate() {
  const bounds = R(-40, 40, -46, 46);
  const k = createRunRoom({
    id: 'combatCorridor',
    name: 'Terminal maglevu',
    weather: 'clearNight',
    seed: 'run-terminal-v1',
    bounds,
    startX: -14,
    exitX: 22,
    wallMaterial: 'concrete',
    wallHeights: [14, 18, 16, 22],
  });
  const { arena, p } = k;
  const TRACKS = [-15, -5, 5, 15];

  // Grunt: hala (bruk), pasy serwisowe, podsypka torów, północny pas zajezdni.
  k.ground(R(-40, 40, 17, 46), 0, 'paving');
  k.ground(R(-40, -31, -46, 17), 0, 'concrete');
  k.ground(R(31, 40, -46, 17), 0, 'concrete');
  k.ground(R(-31, 31, -43, 17), 0, 'rail_ballast');
  k.ground(R(-31, 31, -46, -43), 0, 'concrete');
  k.perimeter();

  // Perony 1,4 m z rampami na obu końcach.
  const PW = R(-31, -21, -30, 16);
  const PE = R(21, 31, -30, 16);
  k.deck(PW, 1.4, 'quay_concrete');
  k.deck(PE, 1.4, 'quay_concrete');
  for (const x of [-26, 26]) {
    k.ramp(vec(x, 1.4, 16), vec(x, 0, 23), 4, 'concrete');
    k.ramp(vec(x, 1.4, -30), vec(x, 0, -37), 4, 'concrete');
  }

  // Kładka 5 m na całą szerokość; rampy w pasach serwisowych (zachód od południa, wschód od północy).
  const BRIDGE = R(-38, 38, -8, -3);
  p.floor(BRIDGE, 5, 'steel_grating', { thickness: 0.4 });
  p.wall(vec(-38, 5, -8), vec(38, 5, -8), 1.1, 0.12, 'metal', {
    openings: [{ at: 73, width: 3.4, height: 1.1 }],
  });
  p.wall(vec(-38, 5, -3), vec(38, 5, -3), 1.1, 0.12, 'metal', {
    openings: [{ at: 3, width: 3.4, height: 1.1 }],
  });
  k.ramp(vec(-35, 0, 12), vec(-35, 5, -3), 3, 'metal');
  k.ramp(vec(35, 0, -23), vec(35, 5, -8), 3, 'metal');
  for (const x of [-37, -28, -19, -10, 0, 10, 19, 28, 37]) {
    const r = R(x - 0.4, x + 0.4, -7.9, -7.1);
    k.reserve(r, x === -28 || x === 28 ? 1.4 : 0);
    k.solid(r, 0, 4.6, 'metal');
  }
  k.light(-20, 4.2, -5.5, COLOR.blue, 18, 12);
  k.light(0, 4.2, -5.5, COLOR.warm, 22, 14);
  k.light(20, 4.2, -5.5, COLOR.blue, 18, 12);
  k.neon('metro', -12, 6.6, -3.05, 6, 3, 0, COLOR.green, 0.12);
  k.neon('arrow', 14, 6.6, -3.05, 4, 2, 0, COLOR.amber, 0.2);
  k.neon('metro', 12, 6.6, -7.95, 6, 3, Math.PI, COLOR.green, 0.12);
  k.neon('arrow', -14, 6.6, -7.95, 4, 2, Math.PI, COLOR.amber, 0.2);

  // Tory (dekoracje), kozły oporowe, słupy sieci trakcyjnej z kolizją.
  for (const x of TRACKS)
    for (const z of [-37, -25, -13, -1, 11])
      k.deco('rail_track_straight', x, 0, z, Math.PI / 2);
  for (const x of TRACKS) {
    k.deco('rail_track_buffer', x, 0, 19, -Math.PI / 2);
    k.deco('rail_track_buffer', x, 0, -45, Math.PI / 2);
  }
  for (const x of [-10, 10])
    for (const z of [-38, -22, -6, 10]) {
      k.deco('rail_catenary_mast', x, 0, z, x < 0 ? -Math.PI / 2 : Math.PI / 2);
      const r = R(x - 0.35, x + 0.35, z - 0.35, z + 0.35);
      k.reserve(r);
      k.solid(r, 0, 8, 'metal', { visible: false });
    }

  // Wagony maglev: długie osłony na torach; pas środkowy (|x| ≤ 7, z −15…13) bez wagonów.
  for (const [model, x, z] of [
    ['rail_maglev_car_open', -15, -12],
    ['rail_maglev_car', -5, -30],
    ['rail_maglev_car_open', 5, -28],
    ['rail_maglev_car', 15, -30],
    ['rail_maglev_car_open', 15, 3],
  ])
    k.prop(model, x, z, { quarter: 1, material: 'concrete' });

  // Zadaszenia peronów (landmark) i lampy: moduły omijają pas kładki.
  for (const x of [-26, 26])
    for (const z of [-26, -14, 4]) {
      k.deco('rail_platform_canopy', x, 1.4, z, Math.PI / 2);
      k.light(x, 6.2, z, z === -14 ? COLOR.green : COLOR.warm, 24, 14);
    }
  for (const x of [-17, 17])
    for (const z of [-30, -6, 14]) k.light(x, 2.4, z, COLOR.blue, 14, 10);

  // Hala dworcowa: dach 9 m na kolumnach, kasy i sklepy po bokach.
  k.solid(R(-40, 40, 30, 46), 9, 9.6, 'concrete');
  for (let x = -36; x <= 36; x += 12)
    for (const z of [32.5, 42.5]) {
      const r = R(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
      k.reserve(r);
      k.solid(r, 0, 9, 'concrete');
    }
  for (let x = -30; x <= 30; x += 12)
    for (const z of [34, 42])
      k.light(x, 8.4, z, z === 34 ? COLOR.warm : COLOR.blue, 22, 14);
  k.neon('metro', 0, 7.6, 45.9, 10, 5, Math.PI, COLOR.green, 0.1);
  const KASY = R(-40, -30, 18, 34);
  const SHOPS = R(30, 40, 20, 36);
  k.mass(KASY, 8, 'plaster');
  k.mass(SHOPS, 8, 'facade');
  k.faceNeon(KASY, 'E', 8, 5.2, 'implants', 3, 1.5, COLOR.blue, 0.3);
  k.faceNeon(KASY, 'S', 5, 5.2, 'hotel', 3, 1.5, COLOR.amber, 0.25);
  k.faceNeon(KASY, 'E', 13, 3.6, 'open', 2.2, 1.1, COLOR.green, 0.2);
  k.faceNeon(SHOPS, 'W', 8, 5.2, 'ramen', 3, 1.5, COLOR.amber, 0.25);
  k.faceNeon(SHOPS, 'W', 14, 3.8, 'pharmacy', 2.4, 1.2, COLOR.green, 0.2);
  k.face(KASY, 'E', 4, 3.1, 'city_awning', 0.6);
  k.face(SHOPS, 'W', 4, 3.1, 'city_awning', 0.6);
  k.face(SHOPS, 'W', 11, 3.1, 'city_awning', 0.6);
  k.face(KASY, 'E', 15, 0, 'city_door', 0.15);

  // Zajezdnia przy północnej ścianie.
  const DW = R(-40, -32, -46, -36);
  const DE = R(32, 40, -46, -36);
  k.mass(DW, 7, 'corrugated');
  k.mass(DE, 8, 'plaster');
  k.faceNeon(DW, 'E', 4, 4.4, 'warsztat', 3, 1.5, COLOR.amber, 0.3);
  k.faceNeon(DE, 'W', 4, 4.4, 'repair', 3, 1.5, COLOR.green, 0.3);
  k.face(DW, 'E', 8, 0, 'city_shutter', 0.2);
  k.face(DE, 'W', 8, 0, 'city_shutter', 0.2);
  k.face(DW, 'S', 3, 0, 'city_pipe_run', 0.3);

  // Wieża kontroli (landmark): schody po −X odwrócone ku ścianie wschodniej.
  const TOWER = R(31.8, 40.2, 5.8, 14.2);
  k.reserve(TOWER);
  k.deco('rail_control_tower', 36, 0, 10, Math.PI);
  k.solid(TOWER, 0, 14, 'concrete', { visible: false });
  k.light(36, 15, 10, COLOR.amber, 40, 24);
  k.light(30, 11, 10, COLOR.warm, 28, 16);
  k.neon('metro', 31.7, 8, 10, 6, 3, -Math.PI / 2, COLOR.green, 0.1);

  // Oprawa ścian: dekoracje co kilka metrów.
  const wallW = R(-43, -40, -46, 46),
    wallE = R(40, 43, -46, 46),
    wallS = R(-40, 40, 46, 49),
    wallN = R(-40, 40, -49, -46);
  dressWall(k, wallW, 'E', 17, 46, {
    step: 5,
    kit: KITS.street,
    neons: [
      ['karaoke', 5.4, 2.8, 1.4, COLOR.violet],
      ['noodles', 6.2, 3, 1.5, COLOR.amber],
    ],
  });
  dressWall(k, wallW, 'E', 0, 17, {
    step: 6,
    kit: KITS.industrial,
    salt: 2,
    neons: [['arrow', 4.6, 2.6, 1.3, COLOR.green, 0.15]],
  });
  dressWall(k, wallE, 'W', 36, 46, {
    step: 5,
    kit: KITS.street,
    salt: 3,
    neons: [['sake', 5.6, 2.6, 1.3, COLOR.violet]],
  });
  dressWall(k, wallE, 'W', 14, 30, {
    step: 5,
    kit: KITS.street,
    salt: 1,
    neons: [['bar_24h', 5.4, 2.6, 1.3, COLOR.green]],
  });
  dressWall(k, wallE, 'W', 0, 5, { step: 5, kit: KITS.industrial });
  dressWall(k, wallS, 'N', 0, 80, {
    step: 5,
    kit: KITS.street,
    salt: 4,
    neons: [
      ['cocktail', 5.6, 2.6, 1.3, COLOR.violet, 0.3],
      ['hotel', 6.4, 3, 1.5, COLOR.amber, 0.2],
      ['beer', 5.4, 2.4, 1.2, COLOR.green, 0.3],
    ],
  });
  dressWall(k, wallN, 'S', 0, 80, {
    step: 5,
    kit: KITS.industrial,
    salt: 1,
    neons: [
      ['warsztat', 5.6, 3, 1.5, COLOR.amber],
      ['arrow', 6, 3, 1.5, COLOR.blue, 0.1],
    ],
  });
  for (const [x, z, yaw] of [
    [-39.5, -20, Math.PI / 2],
    [39.5, -24, -Math.PI / 2],
  ])
    k.deco('city_cable_span', x, 7, z, yaw);

  // Osłony: hala, pas torów, pasy serwisowe, zajezdnia, perony.
  const cover = [
    ['city_barrier', -22, 40, 0],
    ['city_vending', -34, 38, 1],
    ['city_kiosk', -4, 38, 0],
    ['city_crates', 10, 40, 1],
    ['city_vending', 28, 44, 2],
    ['city_generator', 22, 36, 0],
    ['city_barrier', -12, 28, 1],
    ['city_kiosk', 8, 26, 0],
    ['city_barrier', 20, 26, 0],
    ['city_crates', -22, 21, 0],
    ['city_highway_barrier', 2, 21, 0],
    ['city_vending', -28, 28, 2],
    ['city_highway_barrier', -10, 3, 1],
    ['city_highway_barrier', 10, -13, 1],
    ['city_generator', -10, -30, 0],
    ['city_crates', 0, -38, 1],
    ['city_barrier', 10, -33, 0],
    ['city_crates', -19, 6, 0],
    ['city_generator', -19, -4, 1],
    ['city_barrier', 19, -2, 0],
    ['city_crates', 19, -19, 1],
    ['city_highway_barrier', -19, -34, 1],
    ['city_vending', 19, 14, 2],
    ['city_barrier', -10, 14, 1],
    ['city_dumpster', 10, 12, 1],
    ['city_dumpster', -38, -14, 0],
    ['city_generator', -35, -28, 0],
    ['city_crates', -36, -16, 0],
    ['city_generator', 35, 17.5, 1],
    ['city_crates', 35, -32, 0],
    ['city_barrier', 24, -40, 0],
    ['city_dumpster', 14, -44, 0],
    ['city_vending', -28, -40, 2],
    ['city_kiosk', 20, -39, 0],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  for (const [model, x, z, quarter] of [
    ['city_crates', -29, -27, 0],
    ['city_vending', -23, -22, 0],
    ['city_kiosk', -29, -11, 0],
    ['city_barrier', -23, -15, 1],
    ['city_generator', -29, 8, 0],
    ['city_crates', -23, 10, 1],
    ['city_barrier', 29, -26, 1],
    ['city_crates', 23, -22, 0],
    ['city_vending', 29, -13, 1],
    ['city_kiosk', 23, -12, 0],
    ['city_generator', 23, 8, 0],
    ['city_barrier', 29, 11, 1],
  ])
    k.prop(model, x, z, { y: 1.4, quarter });
  for (const [x, z] of [
    [-12, 40],
    [16, 31],
    [-34, 30],
  ])
    k.deco('city_traffic_cone', x, 0, z);

  for (const [x, z, c] of [
    [-6, 20, COLOR.amber],
    [20, 24, COLOR.blue],
    [-30, 20, COLOR.green],
    [32, -42, COLOR.amber],
    [-33, -42, COLOR.green],
  ])
    k.lamp(x, z, c);
  for (const [x, y, z] of [
    [-10, 0.1, 2],
    [10, 0.1, -14],
    [-35, 0.1, -10],
    [0, 0.1, 24],
  ])
    k.fx('steam', x, y, z, 1.2);
  for (const [x, y, z] of [
    [-26, 5.5, -2],
    [26, 5.5, 0],
    [-8, 8.5, 38],
  ])
    k.fx('sparks', x, y, z);

  for (const [tex, x, z, w] of [
    ['floor_arrow', -14, 36, 3],
    ['floor_arrow', 22, -36, 2.4],
    ['floor_stop', -26, 20, 3],
    ['oil_stain', -8, 26, 3],
    ['oil_stain', 12, -4, 3],
    ['crack_floor', 4, 36, 3],
    ['manhole', -2, 22, 1.6],
    ['manhole', 26, 40, 1.6],
    ['tire_marks', 0, -41, 4],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);
  for (const [x, z] of [
    [-18, 10],
    [18, -24],
  ])
    k.decal('floor_hazard', x, 0.012, z, 7, 0.9, Math.PI / 2);
  for (const z of [-26, -14, 4])
    for (const x of [-22, 22])
      k.decal('floor_hazard', x, 1.412, z, 8, 0.7, Math.PI / 2);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -14, 0, 40],
      ['C', 22, 0, -40],
    ],
    zones: [
      ['Hala dworcowa', R(-40, 40, 17, 46), 'open'],
      ['Perony zachodnie', R(-40, -17, -43, 17), 'interior'],
      ['Tory maglev', R(-17, 17, -43, 17), 'dense'],
      ['Perony wschodnie', R(17, 40, -43, 17), 'high'],
      ['Zajezdnia północna', R(-40, 40, -46, -43), 'low'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
    spawnRing: { minM: 12, maxM: 95 },
  });
  for (const [x, z] of [
    [-34, 42],
    [-2, 43],
    [30, 41],
    [-20, 25],
    [6, 30],
    [28, 28],
    [-38.5, 6],
    [-19, -14],
    [-10, -3],
    [0, -20],
    [10, 4],
    [19, -26],
    [-19, -40],
    [0, -43],
    [38.5, -30],
    [-28, -44],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -14, z: 43, yaw: 0, pitch: 8 },
  { name: 'hall', x: 0, z: 36, yaw: 200, pitch: 6 },
  { name: 'tracks', x: -8, z: 16, yaw: 0, pitch: 4 },
  { name: 'platform', x: -26, z: 12, floorY: 1.4, yaw: 0, pitch: 4 },
  { name: 'bridge', x: -30, z: -5.5, floorY: 5, yaw: 270, pitch: -4 },
  { name: 'north', x: 0, z: -18, yaw: 20, pitch: 4 },
  { name: 'tower', x: 20, z: 0, yaw: 270, pitch: 14 },
];
