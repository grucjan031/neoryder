// Dachy z wentylatorami (combat): cztery dachy na 3,4 / 6,8 / 10,2 / 3,4 m nad dachem bazowym,
// połączone rampami-kładkami i płaską kładką; aleja pośrodku. Landmark: gigantyczny szyld dachowy
// na najwyższym dachu (ponad wszystkimi budynkami). Pogoda: storm.
import { COLOR, R, SIZE, createRunRoom, vec } from './_runKit.mjs';
import { KITS, dressWall } from './_wallKit.mjs';

Object.assign(SIZE, {
  roof_stairwell_hut: vec(3.2, 3, 4.5),
  roof_chimney_stack: vec(2, 3, 1),
  city_satellite_cluster: vec(3, 3.4, 2),
});

const BUILDING_KIT = [
  { model: 'city_shutter', y: 0, offset: 0.2 },
  { model: 'city_pipe_run', y: 0, offset: 0.3 },
  { model: 'city_ac_unit', y: 1.6, offset: 0.35, h: 1.4 },
  { model: 'city_door', y: 0, offset: 0.15 },
  { model: 'city_fire_escape', y: 0, offset: 0.6, h: 3.4 },
  { model: 'city_ad_screen', y: 0.8, offset: 0.2, h: 2.3 },
  { model: 'city_sign_box', y: 2, offset: 0.15, h: 1 },
];

export default function generate() {
  const bounds = R(-36, 36, -46, 46);
  const k = createRunRoom({
    id: 'combatPlatforms',
    name: 'Dachy z wentylatorami',
    weather: 'storm',
    seed: 'run-rooftops-v1',
    bounds,
    startX: -14,
    exitX: 18,
    wallMaterial: 'facade',
    wallHeights: [15, 21, 17, 24],
  });
  const { arena, p } = k;

  k.ground(R(-36, 36, -46, 46), 0, 'roof_tar');
  k.perimeter();

  // Dachy: bryły z chodzącym wierzchem. B1 3,4 m (południowy zachód), B2 6,8 m (południowy wschód),
  // B3 10,2 m (północny wschód), B4 3,4 m (północny zachód).
  const B1 = R(-32, -6, 8, 30);
  const B2 = R(8, 34, 8, 30);
  const B3 = R(8, 34, -30, -4);
  const B4 = R(-32, -8, -26, -4);
  const roofs = [
    [B1, 3.4, 'roof_hvac_metal'],
    [B2, 6.8, 'roof_tar'],
    [B3, 10.2, 'roof_hvac_metal'],
    [B4, 3.4, 'roof_tar'],
  ];
  for (const [r, h, m] of roofs) {
    k.deck(r, h, m);
    // Spód bryły elewacją: ciemna ściana (bryła pełna, wierzch chodzący).
  }

  // Parapety 1,1 m po obrysie dachów z przerwami na rampy i kładki.
  const parapet = (r, y, openings) => {
    const edges = {
      N: [vec(r.minX, y, r.minZ), vec(r.maxX, y, r.minZ)],
      S: [vec(r.minX, y, r.maxZ), vec(r.maxX, y, r.maxZ)],
      W: [vec(r.minX, y, r.minZ), vec(r.minX, y, r.maxZ)],
      E: [vec(r.maxX, y, r.minZ), vec(r.maxX, y, r.maxZ)],
    };
    for (const [side, [from, to]] of Object.entries(edges))
      p.wall(from, to, 1.1, 0.2, 'metal', {
        openings: (openings[side] ?? []).map((at) => ({
          at,
          width: 3.6,
          height: 1.1,
        })),
      });
  };
  parapet(B1, 3.4, { S: [18], E: [11], N: [12] });
  parapet(B2, 6.8, { W: [11], N: [12] });
  parapet(B3, 10.2, { S: [12] });
  parapet(B4, 3.4, { S: [12], N: [12] });

  // Rampy i kładki.
  k.ramp(vec(-14, 0, 41), vec(-14, 3.4, 30), 3, 'metal'); // plac → B1
  k.ramp(vec(-6, 3.4, 19), vec(8, 6.8, 19), 4, 'metal'); // B1 → B2 nad aleją
  k.ramp(vec(20, 6.8, 8), vec(20, 10.2, -4), 4, 'metal'); // B2 → B3
  k.ramp(vec(-20, 3.4, -26), vec(-20, 0, -37), 3, 'metal'); // B4 → plac północny
  p.floor(R(-22, -18, -4, 8), 3.4, 'steel_grating', { thickness: 0.4 }); // B1 ↔ B4
  p.wall(vec(-22, 3.4, -4), vec(-22, 3.4, 8), 1.1, 0.12, 'metal');
  p.wall(vec(-18, 3.4, -4), vec(-18, 3.4, 8), 1.1, 0.12, 'metal');
  {
    const r = R(-20.4, -19.6, 1.6, 2.4);
    k.reserve(r);
    k.solid(r, 0, 3, 'metal');
  }
  k.light(-20, 2.8, 2, COLOR.blue, 18, 12);
  k.light(0, 4.8, 19, COLOR.violet, 20, 12);
  k.light(20, 8.6, 2, COLOR.amber, 20, 12);

  // Landmark: gigantyczny szyld na B3 (panele ku południowi).
  const SIGN = R(12, 32, -29, -23.5);
  k.reserve(SIGN, 10.2);
  k.solid(SIGN, 10.2, 22.9, 'metal', { visible: false });
  k.deco('roof_giant_sign', 22, 10.2, -26.25, 0);
  k.light(22, 20, -18, COLOR.amber, 90, 40);
  k.light(14, 14, -20, COLOR.violet, 50, 28);
  k.light(30, 14, -20, COLOR.violet, 50, 28);

  // Wyposażenie dachów: wentylatory (HVAC), zbiorniki, nadbudówki, anteny.
  const rooftop = (y, items) =>
    items.forEach(([model, x, z, q = 0]) => k.prop(model, x, z, { y, quarter: q }));
  rooftop(3.4, [
    ['city_roof_hvac_unit', -27, 12, 0],
    ['city_roof_hvac_unit', -27, 17, 0],
    ['city_roof_water_tank', -12, 12, 0],
    ['roof_stairwell_hut', -22, 24, 0],
    ['city_roof_hvac_unit', -12, 24, 1],
    ['city_crates', -17, 14, 0],
    ['city_barrier', -9, 25, 1],
    ['roof_chimney_stack', -28, 27, 0],
    ['city_generator', -20, 11, 0],
  ]);
  rooftop(6.8, [
    ['city_roof_hvac_unit', 14, 13, 0],
    ['city_roof_hvac_unit', 22, 13, 0],
    ['city_roof_water_tank', 30, 14, 0],
    ['city_roof_water_tank', 30, 26, 0],
    ['roof_stairwell_hut', 14, 26, 0],
    ['city_roof_hvac_unit', 24, 23, 1],
    ['city_barrier', 18, 19, 1],
    ['city_crates', 12, 20, 0],
    ['roof_chimney_stack', 28, 19, 0],
  ]);
  rooftop(10.2, [
    ['city_roof_hvac_unit', 14, -8, 0],
    ['city_roof_hvac_unit', 28, -9, 0],
    ['city_roof_water_tank', 30, -17, 0],
    ['city_roof_water_tank', 12, -16, 0],
    ['roof_stairwell_hut', 21, -14, 0],
    ['city_crates', 26, -14, 1],
    ['city_barrier', 16, -20, 0],
    ['city_generator', 28, -21, 0],
  ]);
  rooftop(3.4, [
    ['city_roof_hvac_unit', -28, -10, 0],
    ['city_roof_water_tank', -12, -9, 0],
    ['city_roof_hvac_unit', -26, -20, 1],
    ['roof_stairwell_hut', -13, -21, 0],
    ['city_crates', -18, -14, 0],
    ['city_barrier', -24, -15, 1],
  ]);
  for (const [model, x, y, z, yaw] of [
    ['city_antenna', -10, 3.4, 9.5, 0],
    ['city_satellite_cluster', -29, 3.4, 22, 1],
    ['city_antenna', 32, 6.8, 10, 0],
    ['city_satellite_cluster', 10, 6.8, 22, 3],
    ['city_antenna', 32, 10.2, -6, 0],
    ['city_satellite_cluster', -10, 3.4, -6, 2],
    ['city_antenna', -30, 3.4, -24, 1],
  ])
    k.deco(model, x, y, z, yaw);
  for (const [x, y, z] of [
    [-27, 5.4, 12],
    [14, 8.8, 13],
    [14, 12.2, -8],
    [-28, 5.4, -10],
    [28, 12.2, -9],
  ])
    k.fx('steam', x, y, z, 1.3);
  for (const [x, y, z] of [
    [-20, 3.8, -12],
    [26, 7.2, 24],
    [20, 10.6, -12],
    [0, 0.5, 20],
  ])
    k.fx('sparks', x, y, z);

  // Elewacje budynków (odsłonięte ściany nad dachem bazowym).
  const dressBuilding = (r, h, sides, salt) =>
    sides.forEach((side, i) => {
      const len = side === 'N' || side === 'S' ? r.maxX - r.minX : r.maxZ - r.minZ;
      dressWall(k, r, side, 0, len, {
        step: 5,
        kit: BUILDING_KIT,
        salt: salt + i,
        maxY: h - 0.2,
        neons: [
          ['karaoke', h - 1.6, 2.4, 1.2, COLOR.violet],
          ['noodles', h - 1.6, 2.6, 1.3, COLOR.amber],
          ['hotel', h - 1.6, 2.4, 1.2, COLOR.blue],
          ['arcade', h - 1.6, 2.4, 1.2, COLOR.green],
        ],
        neonEvery: 2,
      });
    });
  dressBuilding(B1, 3.4, ['S', 'E', 'N', 'W'], 0);
  dressBuilding(B2, 6.8, ['S', 'W', 'N', 'E'], 1);
  dressBuilding(B3, 10.2, ['S', 'W', 'N', 'E'], 2);
  dressBuilding(B4, 3.4, ['S', 'E', 'N', 'W'], 3);

  // Ściany obwodu.
  const wallW = R(-39, -36, -46, 46),
    wallE = R(36, 39, -46, 46),
    wallS = R(-36, 36, 46, 49),
    wallN = R(-36, 36, -49, -46);
  dressWall(k, wallW, 'E', 0, 92, {
    step: 5,
    kit: KITS.street,
    neons: [
      ['ramen', 6.2, 3, 1.5, COLOR.amber],
      ['bar_24h', 7.4, 2.6, 1.3, COLOR.green],
    ],
  });
  dressWall(k, wallE, 'W', 0, 92, {
    step: 5,
    kit: KITS.street,
    salt: 2,
    neons: [
      ['sake', 6.4, 2.6, 1.3, COLOR.violet],
      ['cocktail', 7.4, 2.6, 1.3, COLOR.blue],
    ],
  });
  dressWall(k, wallS, 'N', 0, 72, {
    step: 5,
    kit: KITS.street,
    salt: 3,
    neons: [['hotel', 6.4, 3, 1.5, COLOR.amber]],
  });
  dressWall(k, wallN, 'S', 0, 72, {
    step: 5,
    kit: KITS.industrial,
    salt: 1,
    neons: [['repair', 5.6, 3, 1.5, COLOR.green]],
  });
  k.deco('city_cable_span', -35.5, 9, 2, Math.PI / 2);
  k.deco('city_cable_span', 35.5, 9, -14, -Math.PI / 2);

  // Poziom bazowy: plac południowy, aleja, plac północny.
  const base = [
    ['city_roof_hvac_unit', -30, 40, 0],
    ['city_roof_water_tank', -24, 36, 0],
    ['city_barrier', -4, 36, 0],
    ['city_crates', 8, 42, 1],
    ['city_generator', 24, 38, 0],
    ['city_vending', 32, 44, 1],
    ['city_dumpster', -32, 32, 0],
    ['city_roof_hvac_unit', 16, 33, 1],
    ['roof_stairwell_hut', -2, 44, 0],
    ['city_highway_barrier', -22, 44, 0],
    ['city_kiosk', 28, 33, 0],
    ['city_crates', -2, 26, 0],
    ['city_barrier', 3, 24, 1],
    ['city_generator', -3, 14, 0],
    ['roof_chimney_stack', 4, 28, 0],
    ['city_dumpster', 3, 10, 1],
    ['city_roof_water_tank', -2, 3, 0],
    ['city_barrier', 26, 4, 0],
    ['city_roof_hvac_unit', -30, 2, 0],
    ['city_crates', 30, 1, 1],
    ['city_vending', -12, 4, 2],
    ['city_roof_hvac_unit', 0, -12, 0],
    ['city_crates', -4, -22, 0],
    ['city_barrier', 4, -16, 1],
    ['city_roof_water_tank', 3, -26, 0],
    ['city_generator', -34, -8, 1],
    ['city_roof_hvac_unit', -26, -40, 0],
    ['city_roof_water_tank', -10, -42, 0],
    ['city_crates', 4, -40, 1],
    ['city_barrier', 12, -36, 0],
    ['city_vending', 30, -40, 2],
    ['city_dumpster', 24, -34, 0],
    ['roof_stairwell_hut', 32, -34, 0],
    ['city_kiosk', -16, -34, 0],
    ['city_highway_barrier', 18, -42, 0],
  ];
  for (const [model, x, z, q] of base) k.prop(model, x, z, { quarter: q });
  for (const [x, z, c] of [
    [-28, 44, COLOR.amber],
    [6, 40, COLOR.violet],
    [26, 40, COLOR.blue],
    [0, 24, COLOR.green],
    [0, 6, COLOR.amber],
    [-4, -8, COLOR.violet],
    [2, -22, COLOR.blue],
    [-30, -38, COLOR.amber],
    [30, -42, COLOR.green],
  ])
    k.lamp(x, z, c);
  k.light(-14, 6, 36, COLOR.warm, 20, 14);
  k.light(18, 6, -40, COLOR.warm, 20, 14);
  for (const [tex, x, z, w] of [
    ['puddle1', -8, 40, 6],
    ['puddle2', 20, 36, 5],
    ['puddle1', 2, 16, 5],
    ['puddle2', -2, -2, 5],
    ['puddle1', 2, -30, 5],
    ['puddle2', -20, -42, 5],
    ['oil_stain', 12, -42, 3],
    ['crack_floor', 6, 32, 3],
    ['floor_arrow', 0, 28, 2.4],
    ['floor_arrow', 18, -38, 2.4],
    ['manhole', -30, 38, 1.6],
  ])
    k.decal(tex, x, 0.012, z, w, w * 0.6);
  for (const [tex, x, y, z, w] of [
    ['oil_stain', -16, 3.412, 20, 3],
    ['puddle1', 20, 6.812, 16, 5],
    ['puddle2', 18, 10.212, -12, 4],
    ['crack_floor', -16, 3.412, -16, 3],
  ])
    k.decal(tex, x, y, z, w, w * 0.6);

  k.finish({
    points: [
      ['A', 0, 0, 12],
      ['B', -14, 0, 40],
      ['C', 18, 0, -40],
    ],
    zones: [
      ['Plac dojazdowy', R(-36, 36, 30, 46), 'open'],
      ['Dachy zachodnie', R(-36, -6, -26, 30), 'dense'],
      ['Aleja', R(-6, 8, -30, 30), 'low'],
      ['Dachy wschodnie', R(8, 36, -30, 30), 'high'],
      ['Plac północny', R(-36, 36, -46, -30), 'interior'],
    ],
    maxAlive: 10,
    minSpawnDistance: 14,
    spawnRing: { minM: 12, maxM: 95 },
  });
  for (const [x, z] of [
    [-34, 40],
    [-18, 36],
    [0, 40],
    [18, 42],
    [34, 38],
    [-1, 22],
    [-3, 32],
    [6, 14],
    [-32, 6],
    [-14, 1],
    [14, 0],
    [34, 4],
    [-3, -20],
    [-30, -32],
    [-8, -38],
    [8, -44],
    [26, -40],
  ])
    k.spawn(x, z);
  return arena;
}

export const shots = [
  { name: 'start', x: -14, z: 43, yaw: 0, pitch: 10 },
  { name: 'alley', x: 0, z: 36, yaw: 0, pitch: 4 },
  { name: 'roof1', x: -20, z: 14, floorY: 3.4, yaw: 20, pitch: 2 },
  { name: 'roof2', x: 14, z: 16, floorY: 6.8, yaw: 20, pitch: 4 },
  { name: 'roof3', x: 18, z: -8, floorY: 10.2, yaw: 340, pitch: 14 },
  { name: 'north', x: 0, z: -32, yaw: 180, pitch: 6 },
];
