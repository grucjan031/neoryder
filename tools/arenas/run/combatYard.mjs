// Złomowisko dronów i aut (combat): hałdy wraków, prasa hydrauliczna pod dachem i dwie hałdy-szczyty
// (3,2 m i 4,8 m) z rampami. Środek (0, 0) i (10, 0) zostaje wolny: cele misji M01 (maszt 3 i właz).
// Landmark: dźwig złomowy (65 m) z wysięgnikiem nad wschodnią hałdą. Pogoda: ashfall.
import { COLOR, R, createRunRoom, vec } from './_runKit.mjs';
import { dressPerimeter, scatter, spawns, track } from './_runKitC.mjs';

export default function generate() {
  const bounds = R(-45, 45, -40, 40);
  const k = createRunRoom({
    id: 'combatYard',
    name: 'Złomowisko',
    weather: 'ashfall',
    seed: 'run-yard-v1',
    bounds,
    startX: -26,
    exitX: 26,
    wallMaterial: 'corrugated',
    wallHeights: [12, 15, 13, 17],
  });
  track(k);
  const { arena } = k;

  // Grunt: ubita ziemia, asfalt przy bramie i drodze, płyta pod prasą. Szwy na liczbach całkowitych.
  k.ground(R(-45, 45, 28, 40), 0, 'asphalt');
  k.ground(R(-45, 45, -6, 28), 0, 'excavation_dirt');
  k.ground(R(-45, 45, -40, -6), 0, 'excavation_dirt');
  k.perimeter();
  k.ground(R(-4, 10, -26, -19), 0.02, 'hazard_stripes_worn', {
    thickness: 0.04,
  });

  // Hałdy-szczyty: pokłady żużla i złomu; dojście rampami (wrogowie nie wchodzą po schodach).
  const H1 = R(-44, -24, -30, -10);
  const H2 = R(26, 44, -16, 6);
  k.deck(H1, 3.2, 'rust');
  k.deck(H2, 4.8, 'rust');
  k.ramp(vec(-24, 3.2, -20), vec(-12, 0, -20), 3, 'rust');
  k.ramp(vec(-34, 3.2, -10), vec(-34, 0, 2), 3, 'rust');
  k.ramp(vec(35, 4.8, 6), vec(35, 0, 20), 3, 'rust');
  arena.decor('power_slag_heap', vec(-34, 3.2, -20), 0, { scale: 0.7 });
  arena.decor('power_slag_heap', vec(35, 4.8, -5), 0, { scale: 0.7 });

  // Landmark: dźwig złomowy w północno-wschodnim narożniku, wysięgnik 50 m w stronę południa.
  arena.decor('build_tower_crane', vec(38, 0, -34), 0);
  k.solid(R(35, 41, -37, -31), 0, 6, 'metal', { visible: false });
  k.reserve(R(35, 41, -37, -31));
  k.light(38, 40, -30, COLOR.amber, 90, 60);
  k.light(38, 12, -24, COLOR.warm, 50, 36);
  k.light(38, 8, -2, COLOR.amber, 40, 30);

  // Prasa hydrauliczna: dach 14 × 7 m na sześciu kolumnach (spód 7 m), płyta pod nim.
  for (const x of [-4, 3, 9]) {
    for (const z of [-26, -20]) {
      k.solid(R(x, x + 1, z, z + 1), 0, 7, 'metal');
      k.reserve(R(x, x + 1, z, z + 1));
    }
  }
  k.solid(R(-4, 10, -26, -19), 7, 8.2, 'rust');
  k.solid(R(0, 6, -24, -21), 3.4, 7, 'hazard', {});
  k.faceNeon(
    R(-4, 10, -26, -19),
    'S',
    7,
    7.6,
    'warsztat',
    4,
    2,
    COLOR.amber,
    0.3,
  );
  k.light(3, 6, -22, COLOR.amber, 40, 18);
  k.light(3, 2, -16, COLOR.warm, 20, 12);

  // Hałdy wraków: stosy z trzech warstw (wraki, auta, skrzynie, kontenery).
  const pile = (cx, cz, flip = false) => {
    const q = flip ? 1 : 0;
    const bx = flip ? 0 : 2.3;
    const bz = flip ? 2.3 : 0;
    k.prop('city_wrecked_car', cx - bx, cz - bz, { quarter: q });
    k.prop('city_wrecked_car', cx + bx, cz + bz, { quarter: q });
    k.prop('city_car', cx, cz, { quarter: q + 1, y: 0 });
    k.prop('city_wrecked_car', cx - (flip ? 0 : 1.15), cz - (flip ? 1.15 : 0), {
      quarter: q,
      y: 1.58,
    });
    k.prop('city_crates', cx + (flip ? 0 : 1.15), cz + (flip ? 1.15 : 0), {
      y: 1.58,
    });
  };
  for (const [x, z, f] of [
    [-14, 22, false],
    [14, 22, true],
    [-38, 18, true],
    [-18, -14, true],
    [20, -12, false],
    [-6, -34, false],
    [14, -34, true],
    [38, 24, false],
  ])
    pile(x, z, f);

  // Wraki, beczki, kontenery i maszyny rozsiane po placu; środek i wyjście M01 wolne.
  const open = R(-8, 18, -8, 8);
  scatter(
    k,
    [
      'city_wrecked_car',
      'city_car',
      'city_dumpster',
      'city_crates',
      'city_generator',
      'city_barrier',
      'build_pipe_stack',
      'build_rebar_bundle',
      'port_container_20_ochre',
      'port_container_20_graphite',
      'port_container_20_olive',
      'build_precast_stack',
      'hw_camp_shack',
    ],
    R(-44, 44, -39, 39),
    { count: 56, clear: 3.2, avoid: [open, R(-30, -22, 30, 40)] },
  );
  // Rekwizyty na hałdach (osłony na szczytach).
  for (const [model, x, z, y, quarter] of [
    ['city_wrecked_car', -36, -24, 3.2, 0],
    ['city_wrecked_car', -30, -14, 3.2, 1],
    ['city_crates', -40, -18, 3.2, 0],
    ['city_dumpster', -28, -26, 3.2, 1],
    ['port_container_20_navy', -40, -28, 3.2, 0],
    ['city_wrecked_car', 40, -12, 4.8, 0],
    ['city_wrecked_car', 30, 0, 4.8, 1],
    ['city_crates', 31, -8, 4.8, 0],
    ['city_generator', 40, 2, 4.8, 1],
    ['port_container_20_ochre', 31, -13, 4.8, 0],
  ])
    k.prop(model, x, z, { y, quarter });

  // Okładzina murów: blacha, wrota, rury, tablice, graffiti i ostrzeżenia.
  dressPerimeter(k, {
    startX: -26,
    exitX: 26,
    step: 6,
    height: 12,
    sets: [
      [
        { face: 'city_shutter', y: 0, off: 0.2 },
        { neon: 'repair', y: 6, w: 2.6, h: 1.3, c: COLOR.amber, fl: 0.3 },
      ],
      [
        { face: 'city_pipe_run', y: 0, off: 0.3 },
        { decal: 'graffiti_tag3', y: 2.6, w: 3, h: 2, dx: 1.5 },
        { face: 'city_ac_unit', y: 6.5, off: 0.35 },
      ],
      [
        { face: 'city_door', y: 0, off: 0.15 },
        { neon: 'arrow', y: 4.4, w: 2.2, h: 1.1, c: COLOR.green, fl: 0.2 },
        { decal: 'poster_torn3', y: 2.4, w: 1.8, h: 2.4, dx: 3.4 },
      ],
      [
        { face: 'city_sign_box', y: 5, off: 0.15 },
        { face: 'city_pipe_run', y: 0, off: 0.3, dx: -2.2 },
        { decal: 'sticker_cluster', y: 3, w: 1.6, h: 1.6, dx: 2 },
      ],
      [
        { face: 'city_shutter', y: 0, off: 0.2 },
        { face: 'city_ac_unit', y: 5, off: 0.35, dx: 3.6 },
        { decal: 'graffiti_piece', y: 3.2, w: 3.2, h: 2.2, dx: -3 },
      ],
    ],
  });

  // Ogniska z beczek i lampy: bursztyn i ciepła biel, akcenty zieleni przy bramie.
  for (const [x, z] of [
    [-20, 30],
    [-2, 38],
    [18, 30],
    [-10, 12],
    [22, 14],
    [-28, -4],
    [-4, -12],
    [14, -14],
    [-22, -34],
    [8, -36],
    [28, -26],
  ])
    k.prop('hw_fire_barrel', x, z, {});
  for (const [x, z, col] of [
    [-40, 36, COLOR.amber],
    [-14, 36, COLOR.green],
    [10, 36, COLOR.amber],
    [40, 34, COLOR.warm],
    [-40, 8, COLOR.warm],
    [-16, 2, COLOR.amber],
    [20, 2, COLOR.amber],
    [-14, -22, COLOR.warm],
    [24, -24, COLOR.green],
    [-30, -36, COLOR.amber],
    [8, -32, COLOR.warm],
  ])
    k.lamp(x, z, col);
  for (const [x, y, z, col] of [
    [-34, 6, -20, COLOR.amber],
    [35, 8, -2, COLOR.warm],
    [-30, 5, 8, COLOR.green],
    [0, 6, 20, COLOR.warm],
    [28, 5, 30, COLOR.amber],
    [-8, 5, -8, COLOR.amber],
    [14, 5, 6, COLOR.amber],
    [-24, 5, 20, COLOR.blue],
    [10, 5, -30, COLOR.violet],
  ])
    k.light(x, y, z, col, 22, 16);
  for (const [x, z] of [
    [-10, 12],
    [22, 14],
    [-4, -12],
    [14, -14],
    [-28, -4],
  ])
    k.fx('sparks', x, 1.6, z, 0.5);
  for (const [x, z] of [
    [-30, 20],
    [20, 30],
    [-8, -30],
    [30, -26],
  ])
    k.fx('steam', x, 0.1, z, 1.1);
  for (const [x, y, z] of [
    [3, 6.8, -22],
    [-34, 3, -20],
  ])
    k.fx('drip', x, y, z);

  // Zagrożenia: elektryczny płot przy prasie i beczki paliwa przy hałdach.
  k.hazards.push(
    {
      kind: 'electric_field',
      id: 'yard-wall',
      position: vec(-10, 0.7, -22),
      size: vec(1.5, 1.4, 4),
      cycle: { onS: 2.5, offS: 3.5 },
    },
    {
      kind: 'explosive_barrel',
      id: 'yard-barrel',
      position: vec(5, 0, -6),
    },
    {
      kind: 'explosive_barrel',
      id: 'yard-barrel-west',
      position: vec(-24, 0, 6),
    },
    {
      kind: 'explosive_barrel',
      id: 'yard-barrel-gate',
      position: vec(12, 0, 24),
    },
  );
  for (const [tex, x, z, w] of [
    ['oil_stain', -2, 14, 4],
    ['oil_stain', 16, -26, 4],
    ['oil_stain', -20, 4, 3],
    ['crack_floor', 8, 14, 3],
    ['crack_floor', -14, -30, 3],
    ['tire_marks', -22, 22, 5],
    ['tire_marks', 8, 32, 5],
    ['floor_stop', -26, 34, 3],
    ['floor_arrow', 26, -34, 2],
    ['puddle1', -6, -2, 5],
    ['puddle2', 20, 8, 5],
    ['puddle1', -34, 12, 5],
    ['puddle2', 6, -14, 5],
    ['leak_streak', 22, -4, 3],
    ['manhole', 0, 22, 1.6],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 0],
      ['B', -26, 0, 34],
      ['C', 26, 0, -34],
    ],
    zones: [
      ['Brama i parking wraków', R(-45, 45, 20, 40), 'open'],
      ['Hałdy wraków', R(-45, 45, -6, 20), 'dense'],
      ['Hałda zachodnia', H1, 'high'],
      ['Prasa i dźwig', R(-12, 45, -40, -6), 'interior'],
    ],
    maxAlive: 9,
    minSpawnDistance: 12,
  });
  spawns(k, [
    [-34, 34],
    [-10, 32],
    [6, 34],
    [30, 32],
    [-36, 22],
    [-16, 16],
    [4, 16],
    [24, 18],
    [-30, 2],
    [-20, -2],
    [20, -2],
    [14, -10],
    [-18, -32],
    [-2, -32],
    [22, -34],
    [-4, -12],
  ]);
  return arena;
}

export const shots = [
  { name: 'start', x: -26, z: 37, yaw: 0, pitch: 10 },
  { name: 'piles', x: -10, z: 24, yaw: 20, pitch: 6 },
  { name: 'center', x: 0, z: 10, yaw: 0, pitch: 10 },
  { name: 'press', x: 3, z: -10, yaw: 0, pitch: 8 },
  { name: 'hillWest', x: -30, z: -14, floorY: 3.2, yaw: 90, pitch: -6 },
  { name: 'crane', x: 34, z: 14, yaw: 340, pitch: 28 },
];
