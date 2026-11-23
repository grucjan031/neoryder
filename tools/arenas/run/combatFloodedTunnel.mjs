// Kanał burzowy (combat): szeroki kanał z płytką wodą (−1,2 m) między dwoma brzegami, pompownia na
// wyspie pośrodku, dwie kładki na 3,2 m z rampami, śluza z bramą na północy. Kałuże pod napięciem
// w kanale (hazard). Landmark: brama śluzy (podwójna skala) nad północnym końcem kanału. Pogoda: storm.
import { COLOR, R, SIZE, createRunRoom, vec } from './_runKit.mjs';
import { KITS, dressWall } from './_wallKit.mjs';

Object.assign(SIZE, {
  build_pipe_stack: vec(3.02, 2.793, 3),
  port_container_20_olive: vec(6.058, 2.591, 2.438),
  port_container_20_graphite: vec(6.058, 2.591, 2.438),
  port_container_20_ochre: vec(6.058, 2.591, 2.438),
  port_container_20_navy: vec(6.058, 2.591, 2.438),
  hw_storm_culvert: vec(9.7, 5.8, 8),
});

export default function generate() {
  const bounds = R(-36, 36, -48, 48);
  const k = createRunRoom({
    id: 'combatFloodedTunnel',
    name: 'Kanał burzowy',
    weather: 'storm',
    seed: 'run-storm-canal-v1',
    bounds,
    startX: -22,
    exitX: 22,
    wallMaterial: 'concrete',
    wallHeights: [13, 17, 15, 20],
  });
  const { arena, p } = k;
  const bed = -1.2;
  const TRENCH = R(-12, 12, -34, 22);

  k.ground(R(-36, 36, 22, 48), 0, 'asphalt');
  k.ground(R(-36, -12, -34, 22), 0, 'concrete');
  k.ground(R(12, 36, -34, 22), 0, 'concrete');
  k.ground(R(-36, 36, -48, -34), 0, 'concrete');
  k.ground(TRENCH, bed, 'canal_water');
  k.perimeter();

  // Mury kanału z przerwami na rampy zejścia; rampy 1,2 m na 6 m.
  const wallOpenings = { [-12]: [-8, 12], [12]: [-26, 4] };
  for (const [xs, zs] of Object.entries(wallOpenings)) {
    const x = Number(xs);
    p.wall(
      vec(x, bed, TRENCH.minZ),
      vec(x, bed, TRENCH.maxZ),
      1.2,
      0.4,
      'canal_stone_wall',
      {
        openings: zs.map((z) => ({
          at: z - TRENCH.minZ,
          width: 4.4,
          height: 1.2,
        })),
      },
    );
    for (const z of zs)
      k.ramp(vec(x, 0, z), vec(x + (x < 0 ? 6 : -6), bed, z), 4, 'concrete');
  }
  p.wall(vec(-12, bed, 22), vec(12, bed, 22), 1.2, 0.4, 'canal_stone_wall', {
    openings: [{ at: 12, width: 4.4, height: 1.2 }],
  });
  k.ramp(vec(0, 0, 28), vec(0, bed, 22), 4, 'concrete');
  p.wall(vec(-12, bed, -34), vec(12, bed, -34), 1.2, 0.4, 'canal_stone_wall');

  // Pompownia na wyspie pośrodku kanału: bryła z kolizją, rury w +Z, pasy wody po bokach (4 m).
  const PUMP = R(-8, 8, -5, 5);
  k.reserve(PUMP, bed);
  k.solid(PUMP, bed, 11.2, 'concrete', { visible: false });
  k.deco('dock_pump_house', 0, bed, 0, 0);
  k.light(0, 6, 9, COLOR.green, 40, 22);
  k.light(-10, 3, 0, COLOR.amber, 22, 14);
  k.light(10, 3, 0, COLOR.amber, 22, 14);
  k.light(0, 9, -7, COLOR.warm, 26, 16);

  // Brama śluzy (landmark): model w podwójnej skali, kolizja pełna na całą szerokość kanału.
  const GATE = R(-12, 12, -35.4, -30.6);
  k.reserve(GATE, bed);
  k.solid(GATE, bed, bed + 14.9, 'concrete', { visible: false });
  k.deco('dock_lock_gate', 0, bed, -33, 0, 2);
  k.light(-8, 12, -29, COLOR.green, 50, 26);
  k.light(8, 12, -29, COLOR.green, 50, 26);
  k.light(0, 14, -31, COLOR.amber, 46, 28);
  k.neon('arrow', 0, 11.5, -30.5, 8, 4, 0, COLOR.amber, 0.12);

  // Kładki 3,2 m nad kanałem z rampami na obu brzegach; podpory w wodzie.
  for (const z of [-20, 14]) {
    p.floor(R(-12, 12, z - 2.5, z + 2.5), 3.2, 'steel_grating', {
      thickness: 0.4,
    });
    for (const s of [-1, 1]) {
      p.wall(
        vec(-12, 3.2, z + s * 2.5),
        vec(12, 3.2, z + s * 2.5),
        1.1,
        0.12,
        'metal',
      );
    }
    k.ramp(vec(-24, 0, z), vec(-12, 3.2, z), 3, 'metal');
    k.ramp(vec(12, 3.2, z), vec(24, 0, z), 3, 'metal');
    for (const x of [-6, 0, 6]) {
      const r = R(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
      k.reserve(r, bed);
      k.solid(r, bed, 2.8, 'metal');
    }
    k.light(0, 2.4, z, COLOR.blue, 18, 12);
  }
  k.neon('metro', 0, 5.4, -22.55, 5, 2.5, 0, COLOR.green, 0.15);
  k.neon('arrow', 0, 5.4, 11.45, 4, 2, Math.PI, COLOR.amber, 0.2);

  // Kałuże pod napięciem (hazard) przy brzegach i na placach; schemat wymaga podłogi na poziomie startu.
  for (const [id, x, z, w, d, off] of [
    ['canal-field-w', -20, -12, 6, 8, 0],
    ['canal-field-e', 20, 4, 8, 6, 2],
    ['plaza-field', -8, 40, 6, 4, 4],
    ['terrace-field', 20, -32, 6, 6, 1],
  ])
    k.hazards.push({
      kind: 'electric_field',
      id,
      position: vec(x, 0.7, z),
      size: vec(w, 1.4, d),
      cycle: { onS: 2, offS: 4, offsetS: off },
    });
  for (const [x, z, w, d] of [
    [-20, -12, 6, 8],
    [20, 4, 8, 6],
    [-8, 40, 6, 4],
    [20, -32, 6, 6],
  ])
    k.decal('puddle1', x, 0.013, z, w, d);
  for (const [x, z, yaw] of [
    [-6, -10, 0.6],
    [7, 8, 2.4],
  ])
    k.deco('dock_half_sunken_car', x, bed, z, yaw);
  for (const [x, z, yaw] of [
    [-7, 16, 0.2],
    [6, -28, 3],
    [-3, -14, 1.5],
  ])
    k.deco('dock_skiff', x, bed, z, yaw);
  for (const [x, z] of [
    [-10, 6],
    [10, -8],
    [9, 20],
    [-9, -30],
  ])
    k.deco('dock_mooring_post', x, bed, z);
  for (const [tex, x, z, w] of [
    ['puddle1', -4, 18, 5],
    ['puddle2', 3, -8, 5],
    ['oil_stain', 8, -22, 4],
    ['puddle1', -8, -24, 4],
  ])
    k.decal(tex, x, bed + 0.02, z, w, w * 0.6);

  // Wiata serwisowa na brzegu wschodnim (strefa bez deszczu): dach 4,2 m na kolumnach.
  const CANOPY = R(14, 34, -14, -2);
  k.rainShelters.push({ position: vec(24, 2.1, -8), size: vec(20, 4.2, 12) });
  k.solid(CANOPY, 4.2, 4.8, 'metal');
  for (const x of [15, 24, 33])
    for (const z of [-13, -3]) {
      const r = R(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
      k.reserve(r);
      k.solid(r, 0, 4.2, 'metal');
    }
  k.light(19, 3.8, -8, COLOR.warm, 26, 14);
  k.light(29, 3.8, -8, COLOR.amber, 26, 14);
  k.neon('repair', 24, 3.4, -2.05, 4, 2, 0, COLOR.amber, 0.25);

  // Zabudowa: magazyn zachodni, biuro śluzy na terasie północnej, hangar południowo-wschodni.
  const WH = R(-36, -26, -34, -24);
  const OFFICE = R(-8, 4, -46, -38);
  const HANGAR = R(24, 36, 26, 38);
  k.mass(WH, 7, 'corrugated');
  k.mass(OFFICE, 6, 'plaster');
  k.mass(HANGAR, 9, 'concrete');
  k.faceNeon(WH, 'S', 4, 4.4, 'warsztat', 3, 1.5, COLOR.amber, 0.3);
  k.faceNeon(OFFICE, 'S', 6, 4.2, 'open', 2.4, 1.2, COLOR.green, 0.2);
  k.faceNeon(HANGAR, 'W', 6, 6, 'repair', 3.2, 1.6, COLOR.blue, 0.3);
  k.face(WH, 'E', 5, 0, 'city_shutter', 0.2);
  k.face(WH, 'S', 7, 0, 'city_door', 0.15);
  k.face(OFFICE, 'S', 3, 0, 'city_door', 0.15);
  k.face(OFFICE, 'E', 4, 3.1, 'city_awning', 0.6);
  k.face(OFFICE, 'W', 4, 0, 'city_pipe_run', 0.3);
  k.face(HANGAR, 'W', 3, 0, 'city_shutter', 0.2);
  k.face(HANGAR, 'N', 5, 0, 'city_pipe_run', 0.3);
  k.face(HANGAR, 'N', 9, 5, 'city_ac_unit', 0.35);
  k.face(HANGAR, 'W', 9, 3.2, 'city_sign_box', 0.15);

  // Oprawa ścian z wylotami kanałów (modele przepustów w licu muru).
  const wallW = R(-39, -36, -48, 48),
    wallE = R(36, 39, -48, 48),
    wallS = R(-36, 36, 48, 51),
    wallN = R(-36, 36, -51, -48);
  dressWall(k, wallW, 'E', 0, 96, {
    step: 6,
    kit: KITS.industrial,
    neons: [
      ['arrow', 5, 2.6, 1.3, COLOR.green, 0.15],
      ['warsztat', 6.2, 3, 1.5, COLOR.amber],
    ],
  });
  dressWall(k, wallE, 'W', 0, 96, {
    step: 6,
    kit: KITS.industrial,
    salt: 3,
    neons: [
      ['repair', 5.4, 2.8, 1.4, COLOR.blue],
      ['arrow', 6.4, 2.6, 1.3, COLOR.amber, 0.15],
    ],
  });
  dressWall(k, wallS, 'N', 0, 72, {
    step: 5,
    kit: KITS.industrial,
    salt: 2,
    neons: [
      ['open', 5, 2.6, 1.3, COLOR.green],
      ['hotel', 6, 3, 1.5, COLOR.violet],
    ],
  });
  dressWall(k, wallN, 'S', 0, 72, {
    step: 5,
    kit: KITS.street,
    salt: 1,
    neons: [['noodles', 5.6, 3, 1.5, COLOR.amber]],
  });
  for (const [x, z, yaw] of [
    [-35.4, -14, Math.PI / 2],
    [-35.4, 8, Math.PI / 2],
    [35.4, -26, -Math.PI / 2],
    [35.4, 14, -Math.PI / 2],
  ])
    k.deco('hw_storm_culvert', x, 0, z, yaw);

  // Osłony: wylot południowy, brzegi, taras śluzy.
  const cover = [
    ['port_container_20_olive', -28, 38, 0],
    ['port_container_20_graphite', -10, 34, 0],
    ['port_container_20_ochre', 12, 40, 0],
    ['build_pipe_stack', -16, 44, 0],
    ['build_pipe_stack', 6, 31, 1],
    ['build_pipe_stack', 22, 32, 0],
    ['city_barrier', -22, 36, 1],
    ['city_crates', -4, 42, 0],
    ['city_generator', 30, 44, 0],
    ['city_wrecked_car', -34, 30, 1],
    ['city_dumpster', 16, 28, 0],
    ['city_vending', -34, 44, 1],
    ['city_highway_barrier', -18, 28, 0],
    ['city_kiosk', 4, 46, 0],
    ['hw_storm_culvert', -30, -2, 1],
    ['hw_storm_culvert', 30, 8, 1],
    ['city_barrier', -20, 2, 0],
    ['city_crates', -30, 16, 0],
    ['city_generator', -20, -28, 1],
    ['city_dumpster', -32, -12, 0],
    ['city_vending', -16, -12, 2],
    ['build_pipe_stack', -24, 8, 0],
    ['city_highway_barrier', -16, 18, 1],
    ['city_crates', 18, 18, 0],
    ['city_barrier', 34, -24, 1],
    ['city_generator', 24, -24, 0],
    ['city_highway_barrier', 30, -18, 0],
    ['port_container_20_navy', 30, -30, 0],
    ['city_dumpster', 16, 8, 1],
    ['city_crates', 30, 2, 0],
    ['city_barrier', 28, 20, 1],
    ['build_pipe_stack', -14, -30, 0],
    ['port_container_20_ochre', -22, -42, 0],
    ['city_crates', 12, -44, 1],
    ['city_generator', 28, -42, 0],
    ['city_kiosk', 14, -38, 0],
    ['city_barrier', -14, -40, 0],
    ['city_vending', 34, -44, 2],
    ['city_highway_barrier', 6, -36, 0],
    ['city_wrecked_car', -32, -42, 0],
  ];
  for (const [model, x, z, quarter] of cover) k.prop(model, x, z, { quarter });
  for (const [x, z] of [
    [-14, 38],
    [8, 36],
    [26, 38],
    [-26, 24],
    [14, -40],
  ])
    k.deco('city_traffic_cone', x, 0, z);
  for (const [x, z] of [
    [-12, 40],
    [20, 36],
    [-26, 4],
    [32, -6],
  ])
    k.deco('hw_fire_barrel', x, 0, z);

  for (const [x, z, c] of [
    [-30, 42, COLOR.amber],
    [-4, 38, COLOR.green],
    [26, 40, COLOR.blue],
    [-30, 4, COLOR.amber],
    [-18, -20, COLOR.green],
    [18, -22, COLOR.amber],
    [30, 6, COLOR.violet],
    [-24, -38, COLOR.amber],
    [20, -42, COLOR.green],
  ])
    k.lamp(x, z, c);
  k.light(-18, 6, 30, COLOR.violet, 20, 14);
  k.light(14, 6, 28, COLOR.blue, 20, 14);
  for (const [x, z] of [
    [-6, 26],
    [-24, -6],
    [6, -34],
    [22, 6],
  ])
    k.fx('steam', x, 0.1, z, 1.1);
  for (const [x, y, z] of [
    [-30, 5.8, -2],
    [30, 5.8, 8],
    [-6, 6, 33],
    [12, 6, -38],
    [0, 5, -20],
  ])
    k.fx('drip', x, y, z);
  for (const [x, y, z] of [
    [-12, 3, -12],
    [18, 3, 26],
  ])
    k.fx('sparks', x, y, z);

  for (const [tex, x, z, w] of [
    ['puddle1', -14, 34, 6],
    ['puddle2', 4, 40, 5],
    ['puddle1', 24, 24, 5],
    ['puddle2', -28, 10, 5],
    ['puddle1', -18, -22, 5],
    ['puddle2', 26, -20, 5],
    ['oil_stain', -6, 28, 3],
    ['oil_stain', 20, -40, 3],
    ['manhole', -22, 24, 1.6],
    ['manhole', 8, -42, 1.6],
    ['crack_floor', -26, -36, 3],
    ['floor_arrow', 22, -38, 2.4],
    ['floor_stop', -22, 41, 3],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 30],
      ['B', -22, 0, 0],
      ['C', 22, 0, -40],
    ],
    zones: [
      ['Wylot południowy', R(-36, 36, 22, 48), 'open'],
      ['Brzeg zachodni', R(-36, -12, -34, 22), 'dense'],
      ['Kanał', R(-12, 12, -34, 22), 'low'],
      ['Brzeg wschodni', R(12, 36, -34, 22), 'interior'],
      ['Taras śluzy', R(-36, 36, -48, -34), 'high'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
    spawnRing: { minM: 12, maxM: 95 },
  });
  for (const [x, z] of [
    [-34, 41],
    [-20, 40],
    [0, 38],
    [18, 34],
    [32, 23],
    [-28, 20],
    [-24, -6],
    [-16, 0],
    [-30, -20],
    [-18, -34],
    [20, 9],
    [26, -2],
    [34, -8],
    [18, -25],
    [-14, -44],
    [30, -38],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -22, z: 45, yaw: 0, pitch: 8 },
  { name: 'plaza', x: 0, z: 40, yaw: 20, pitch: 6 },
  { name: 'bank', x: -26, z: 18, yaw: 340, pitch: 4 },
  { name: 'bridge', x: -6, z: -20, floorY: 3.2, yaw: 270, pitch: -4 },
  { name: 'canal', x: 0, z: 20, floorY: -1.2, yaw: 0, pitch: 6 },
  { name: 'gate', x: 20, z: -26, yaw: 330, pitch: 12 },
  { name: 'terrace', x: 10, z: -42, yaw: 180, pitch: 4 },
];
