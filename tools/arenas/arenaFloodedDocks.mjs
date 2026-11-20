import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const bounds = rect(-150, 150, -140, 140);
const brick = 'flood_brick_algae';
const stone = 'canal_stone_wall';
const timber = 'boardwalk_planks';
const bed = -1.2;
const water = -0.4;
const deck = 1.2;
const amber = '#ffae1a';
const blue = '#3d7bff';
const green = '#6dff4a';
const violet = '#8a5cff';
const white = '#fff1d6';
const props = {
  city_stall: [3, 2.622, 2.043],
  city_car: [4.42, 1.46, 1.94],
  city_dumpster: [1.97, 1.33, 1.08],
  city_crates: [1.212, 1.59, 1.256],
  city_generator: [1.6, 1.4, 1.005],
  city_kiosk: [0.8, 2.235, 0.624],
  city_vending: [1.014, 2, 0.816],
  city_barrier: [2, 0.929, 0.51],
  city_market_stall_canopy: [3.024, 2.612, 2],
  city_market_stall_canopy_violet: [3.024, 2.612, 2],
  dock_half_sunken_car: [2.123, 2.489, 4.215],
  dock_skiff: [6.2, 1.72, 2.04],
  dock_pontoon: [6, 0.5, 2.4],
};

export default function generate() {
  const arena = createArena({
    id: 'arenaFloodedDocks',
    name: 'Zalane Doki',
    bounds,
    seed: 'doki-0011',
    weather: 'rain',
  });
  const p = createPrimitives(arena);
  const start = vec(-140, 0, 130);
  arena.roomMeta({
    playerSpawn: start,
    maxAlive: 12,
    doors: [
      { id: 'entry', role: 'entry', position: start, size: vec(3, 3, 1) },
      {
        id: 'exit',
        role: 'exit',
        position: vec(136, 0, -128),
        size: vec(3, 3, 1),
      },
    ],
  });
  arena.arenaMeta({
    navigationCellM: 1.5,
    spawnRing: { minM: 25, maxM: 90 },
    maxAlive: 12,
    enemyTickets: 190,
    water: { shoreZ: -140, y: water, color: '#23394b' },
  });
  const solid = (x, bottom, z, sx, sy, sz, material, visible = true) =>
    arena.block({
      size: vec(sx, sy, sz),
      position: vec(x, bottom + sy / 2, z),
      material,
      visible,
    });
  const slab = (r, y, material, opts = {}) => p.floor(r, y, material, opts);
  const cover = (model, x, z, y = 0, yaw = 0) => {
    const [sx, sy, sz] = props[model];
    return arena.block({
      model,
      size: vec(sx, sy, sz),
      position: vec(x, y + sy / 2, z),
      instance: true,
      ...(yaw ? { rotation: vec(0, yaw, 0) } : {}),
      ...(model === 'dock_pontoon' ? { walkable: true, material: timber } : {}),
    });
  };

  // Sześć wysp; południowo-wschodnie nabrzeże cofa się dwukrotnie przed zatoką.
  const islands = [
    [rect(-150, -7, -140, -68), 'quay_lines'],
    [rect(7, 150, -140, -64), 'paving'],
    [rect(-150, -7, -52, 42), 'asphalt'],
    [rect(7, 150, -50, 42), 'quay_concrete'],
    [rect(-150, -7, 58, 140), 'paving'],
    [rect(7, 95, 58, 88), 'quay_concrete'],
    [rect(7, 64, 88, 112), 'quay_concrete'],
    [rect(7, 38, 112, 140), 'quay_concrete'],
  ];
  for (const [r, material] of islands) {
    let surfaces = [r];
    if (r.minZ === 58 && r.minX === -150)
      surfaces = [
        rect(-150, -94, 58, 140),
        rect(-85, -7, 58, 140),
        rect(-94, -85, 58, 73),
        rect(-94, -85, 88, 140),
      ];
    if (r.minZ === -52)
      surfaces = [
        rect(-150, -22, -52, 42),
        rect(-22, -7, -52, -6),
        rect(-22, -7, 6, 42),
      ];
    if (r.minZ === -50)
      surfaces = [
        rect(22, 150, -50, 42),
        rect(7, 22, -50, -6),
        rect(7, 22, 6, 42),
      ];
    for (const surface of surfaces)
      slab(surface, 0, material, { thickness: 0.45 });
    // Pionowa okładzina widoczna w korycie. Korona nie wystaje z jezdni.
    for (const x of [r.minX, r.maxX])
      p.wall(vec(x, bed, r.minZ), vec(x, bed, r.maxZ), 0.18, 0.36, stone);
    for (const z of [r.minZ, r.maxZ])
      p.wall(vec(r.minX, bed, z), vec(r.maxX, bed, z), 0.18, 0.36, stone);
  }
  slab(rect(-7, 7, -140, 140), bed, stone);
  // Kieszenie cumownicze tworzą poprzeczną odnogę przy C.
  for (const side of [-1, 1]) {
    slab(
      rect(Math.min(side * 7, side * 22), Math.max(side * 7, side * 22), -6, 6),
      bed,
      stone,
    );
    p.ramp({
      from: vec(side * 12, bed, 0),
      to: vec(side * 21.9, 0, 0),
      width: 5,
      material: stone,
    });
  }
  for (const channel of [
    rect(-150, -7, -68, -52),
    rect(7, 150, -64, -50),
    rect(-150, -7, 42, 58),
    rect(7, 150, 42, 58),
  ])
    slab(channel, bed, stone);

  const steps = (from, to, width) => {
    const flight = p.stairs({
      from,
      to,
      width,
      stepRise: 0.21,
      stepDepth: 2,
      material: stone,
    });
    for (const block of flight.blocks) block.walkable = false;
  };
  slab(rect(-94, -85, 73, 88), bed, stone);
  steps(vec(-89.5, bed, 76), vec(-89.5, 0, 88), 5);

  for (const x of [-94, -85])
    p.wall(vec(x, bed, 73), vec(x, bed, 88), 0.85, 0.2, stone);
  for (const [x, north, south] of [
    [-124, -68, -52],
    [-80, -68, -52],
    [-28, -68, -52],
    [32, -64, -50],
    [74, -64, -50],
    [126, -64, -50],
    [-126, 42, 58],
    [-79, 42, 58],
    [-30, 42, 58],
    [25, 42, 58],
    [83, 42, 58],
  ]) {
    // Rozsuń zejścia na przeciwległych brzegach, żeby nie blokowały dna.
    p.ramp({
      from: vec(x - 4, bed, north + 11),
      to: vec(x - 4, 0, north + 0.08),
      width: 5,
      material: stone,
    });
    p.ramp({
      from: vec(x + 4, bed, south - 11),
      to: vec(x + 4, 0, south - 0.08),
      width: 5,
      material: stone,
    });
  }
  steps(vec(-145, bed, -56), vec(-145, 0, -68), 3);
  steps(vec(-141, bed, 54), vec(-141, 0, 42), 4);
  steps(vec(138, bed, -62), vec(138, 0, -50), 4);
  steps(vec(-17, bed, 46), vec(-17, 0, 58), 4);
  for (const [z, side] of [
    [-118, -1],
    [-99, 1],
    [-86, -1],
    [-76, 1],
    [-38, -1],
    [-25, 1],
    [-12, -1],
    [12, 1],
    [25, -1],
    [34, 1],
    [69, -1],
    [78, 1],
    [93, -1],
    [100, 1],
    [128, -1],
    [132, 1],
  ])
    p.ramp({
      from: vec(-side * 1.15, bed, z),
      to: vec(side * 6.85, 0, z),
      width: 5,
      material: stone,
    });

  for (const [x, z0, z1, material] of [
    [-102, -69, -51, stone],
    [-52, -69, -51, timber],
    [46, -65, -49, stone],
    [110, -65, -49, timber],
    [-105, 41, 59, timber],
    [-51, 41, 59, stone],
    [19, 41, 59, timber],
  ])
    p.bridge({
      from: vec(x, 0, z0),
      to: vec(x, 0, z1),
      width: 5,
      y: 0,
      material,
    });
  for (const [z, y, material] of [
    [-106, 0, stone],
    [-31, 0, timber],
    [20, 0, stone],
    [79, 0, timber],
  ]) {
    p.bridge({ from: vec(-8, y, z), to: vec(8, y, z), width: 5, y, material });
  }
  for (const [x0, x1, z0, z1] of [
    [-143, -122, -69.5, -68],
    [-74, -61, -68, -65.5],
    [94, 106, -50, -48],
    [-114, -108, 42, 44],
    [27, 44, 56, 58],
    [113, 138, 40, 42],
  ])
    slab(rect(x0, x1, z0, z1), 0, timber, { thickness: 0.25 });
  // Pełny prześwit przy C pozostaje w środkowym kanale.
  for (const [x, z] of [
    [-2.4, -19],
    [2.5, 37],
    [-135, 49],
    [131, -57],
    [121, 47],
  ]) {
    const model = z === 37 || z === -57 ? 'dock_half_sunken_car' : 'dock_skiff';
    cover(model, x, z, bed, model === 'dock_skiff' && x < 0 ? Math.PI : 0);
  }

  arena.decor('dock_pump_house', vec(-110, 0, -100));
  slab(rect(-117.9, -102.1, -104.3, -95.7), 0.1, stone, { visible: false });
  for (const x of [-117.65, -102.35]) {
    solid(x, 0, -104, 0.5, 10, 2, brick, false);
    solid(x, 0, -97.5, 0.5, 10, 5, brick, false);
    solid(x, 3.1, -101.5, 0.5, 6.9, 3, brick, false);
  }
  for (const z of [-104.75, -95.25])
    solid(-110, 0, z, 15.8, 10, 0.5, brick, false);
  solid(-110, 0.1, -97.4, 12, 1.8, 2.4, stone, false);
  solid(-110, 10, -100, 16, 0.5, 10, brick, false);
  for (const x of [-113, -107]) {
    p.wall(vec(x, 0, -90), vec(x, 0, -86), 1.15, 1.5, 'metal');
    p.wall(vec(x, bed, -69), vec(x, bed, -65), 1.2, 1.5, 'metal');
  }

  // Barka: poziom pochodzi z linii wodnej GLB. Boczne dobudówki podpierają
  // pełne koło B; rzeczywiste trapy trafiają w otwory w nadburciach.
  arena.decor('dock_barge', vec(60, water - 1, 50));
  slab(rect(45, 75, 44, 56), deck, timber, { thickness: 0.32, visible: false });
  for (const [a, b] of [
    [44, 46],
    [54, 56],
  ]) {
    slab(rect(45, 75, a, b), deck, timber, { walkable: false, thickness: 0.3 });
    const railZ = a === 44 ? a : b;
    for (const [x0, x1] of [
      [52, 57.6],
      [62.4, 67],
    ])
      p.wall(vec(x0, deck, railZ), vec(x1, deck, railZ), 0.9, 0.18, 'metal');
  }
  solid(60, bed, 50, 29, 2.05, 7.7, timber, false);
  solid(72.8, deck, 50, 3.2, 4, 3.6, timber, false);
  for (const z of [46.12, 53.88])
    for (const [x0, x1] of [
      [45, 54],
      [66, 75],
    ])
      solid((x0 + x1) / 2, deck, z, x1 - x0, 0.9, 0.25, timber, false);
  for (const [z, bank, barge] of [
    [39, 41, 44],
    [62, 60, 56],
  ]) {
    p.ramp({
      from: vec(76, 0, z),
      to: vec(64.1, deck, z),
      width: 4,
      material: timber,
    });
    slab(rect(57, 64.1, z - 2, z + 2), deck, timber, { thickness: 0.25 });
    p.bridge({
      from: vec(60, deck, bank),
      to: vec(60, deck, barge),
      width: 4,
      y: deck,
      material: timber,
    });
  }
  for (const [model, x] of [
    ['city_market_stall_canopy', 49],
    ['city_market_stall_canopy_violet', 68],
  ])
    cover(model, x, 50, deck);
  arena.roomMeta({
    signs: [
      {
        kind: 'neon',
        texture: 'open',
        position: vec(72.8, 4, 52),
        size: { w: 3, h: 1.5 },
        yaw: 0,
        tint: violet,
      },
      {
        kind: 'neon',
        texture: 'open',
        position: vec(72.8, 4, 48),
        size: { w: 3, h: 1.5 },
        yaw: Math.PI,
        tint: violet,
      },
    ],
  });

  for (const [x, z, bank] of [
    [-133, -66.8, -68],
    [-119, 43.2, 42],
    [100, -51.2, -50],
    [35, 56.8, 58],
  ]) {
    cover('dock_pontoon', x, z);
    // Pomost osadzony na kamiennej stopie; dwa niskie stopnie od ulicy.
    solid(x, bed, z, 5.6, 1.2, 1.7, stone);
    const dir = Math.sign(bank - z);
    const landing = z + dir * 1.2;
    slab(
      rect(
        x - 2.8,
        x + 2.8,
        Math.min(landing, landing + dir * 2),
        Math.max(landing, landing + dir * 2),
      ),
      0.25,
      timber,
    );
  }
  for (const [x, z] of [
    [-141, -66],
    [-126, -66],
    [-130, 45],
    [-117, 45],
    [52, 54.4],
    [68, 45.4],
    [32, 55],
    [40, 55],
  ])
    arena.decor('dock_mooring_post', vec(x, bed, z));

  arena.decor('dock_lock_gate', vec(0, 0, 110));
  solid(0, bed, 110, 12, 6 + 0.9, 2.4, stone, false);
  slab(rect(-7, 7, 109.3, 110.7), 6, timber, {
    thickness: 0.3,
    visible: false,
  });
  for (const z of [109.22, 110.78])
    solid(0, 6, z, 12, 1.05, 0.14, 'metal', false);
  for (const side of [-1, 1]) {
    p.ramp({
      from: vec(side * 43, 0, 110),
      to: vec(side * 7, 6, 110),
      width: 4,
      material: timber,
    });
    slab(rect(side < 0 ? -7 : 5, side < 0 ? -5 : 7, 107.5, 112.5), 6, stone);
  }

  // Kwartały uzupełniają główne osie. Każdy ma dwa wejścia w parterze.
  const blocks = [
    [-143, -124, -130, -113, 15],
    [-103, -75, -130, -111, 18],
    [-64, -37, -137, -117, 21],
    [-33, -13, -105, -88, 13],
    [-89, -60, -106, -89, 12],
    [-67, -39, -86, -73, 15],
    [13, 39, -136, -113, 18],
    [51, 78, -134, -115, 16],
    [109, 141, -132, -112, 20],
    [112, 138, -99, -79, 13],
    [30, 54, -100, -81, 12],
    [-145, -116, -38, -17, 22],
    [-102, -75, -42, -24, 15],
    [-61, -34, -41, -20, 17],
    [-49, -28, -10, 14, 12],
    [-109, -80, -10, 12, 13],
    [-143, -120, 14, 33, 16],
    [-72, -44, 13, 31, 14],
    [-34, -14, 26, 36, 11],
    [14, 39, -42, -22, 15],
    [53, 77, -43, -23, 17],
    [95, 124, -39, -18, 20],
    [123, 143, -9, 13, 16],
    [71, 100, -7, 13, 10],
    [25, 42, -6, 11, 14],
    [25, 48, 23, 36, 11],
    [83, 109, 24, 36, 13],
    [122, 145, 23, 35, 13],
    [-145, -118, 67, 87, 19],
    [-110, -95, 71, 91, 15],
    [-70, -45, 69, 88, 16],
    [-46, -18, 83, 101, 11],
    [-115, -91, 104, 124, 14],
    [-76, -49, 106, 129, 17],
    [-42, -20, 121, 137, 10],
    [40, 64, 64, 76, 9],
    [74, 91, 67, 81, 11],
    [38, 59, 90, 101, 10],
    [13, 29, 122, 135, 10],
  ];
  for (const [x0, x1, z0, z1, height] of blocks) {
    const mid = (x0 + x1) / 2;
    p.building({
      rect: rect(x0, x1, z0, z1),
      y: bed,
      height: height - bed,
      wallMaterial: brick,
      doors: ['north', 'south'].map((side) => ({
        side,
        at: (x1 - x0) / 2,
        width: 5,
        height: 4.8,
      })),
    });
    slab(rect(x0, x1, z0, z1), 3.9, 'concrete', { walkable: false });
    solid(mid + 6, 0, (z0 + z1) / 2, 3, 1.7, 3, stone);
    arena.decor(
      height % 2 ? 'city_awning' : 'city_sign_box',
      vec(mid, 3.25, z1 + 0.6),
    );
    arena.decor(
      height > 15 ? 'city_fire_escape' : 'city_ac_unit',
      vec(x1 - 3, 4.5, z1 + 0.28),
    );
    if (height > 13) arena.decor('city_pipe_run', vec(x0 + 3, 0, z1 + 0.27));
  }
  arena.roomMeta({
    decals: [
      [-57, -73, 12],
      [-113, -83, 8],
      [84, -75, 10],
      [111, -46, 11],
      [-111, 36, 9],
      [110, 38, 10],
      [-127, 63, 10],
      [-38, 62, 12],
      [22, 85, 7],
      [-16, 121, 9],
    ].map(([x, z, width]) => ({
      texture: 'floor_hazard',
      surface: 'floor',
      position: vec(x, 0.012, z),
      yaw: 0,
      size: { w: width, h: 1.6 },
      opacity: 0.65,
    })),
  });

  const themes = [
    {
      positions: [
        [-133, -101],
        [-127, -83],
        [-91, -81],
        [-71, -112],
        [-50, -99],
        [-42, -79],
        [-18, -123],
      ],
      models: [
        'city_generator',
        'city_crates',
        'city_barrier',
        'city_dumpster',
        'city_car',
        'city_kiosk',
        'city_vending',
      ],
      color: amber,
    },
    {
      positions: [
        [23, -121],
        [67, -104],
        [89, -121],
        [101, -91],
        [123, -106],
        [62, -76],
        [105, -73],
        [142, -68],
        [80, -76],
      ],
      models: [
        'city_market_stall_canopy',
        'city_kiosk',
        'city_car',
        'city_market_stall_canopy_violet',
        'city_barrier',
        'city_vending',
        'city_stall',
        'city_crates',
      ],
      color: white,
    },
    {
      positions: [
        [-132, -6],
        [-113, 3],
        [-93, 23],
        [-80, -15],
        [-64, -6],
        [-47, 1],
        [-42, 37],
        [-130, 39],
        [-31, -32],
      ],
      models: [
        'city_dumpster',
        'city_car',
        'city_crates',
        'city_vending',
        'city_generator',
        'city_kiosk',
        'city_barrier',
      ],
      color: green,
    },
    {
      positions: [
        [14, -15],
        [47, -21],
        [45, 13],
        [58, 24],
        [76, 35],
        [103, -5],
        [115, 15],
        [145, 1],
        [102, 38],
        [126, 38],
      ],
      models: [
        'city_barrier',
        'city_car',
        'city_generator',
        'city_crates',
        'city_vending',
        'city_dumpster',
        'city_kiosk',
      ],
      color: blue,
    },
    {
      positions: [
        [-128, 96],
        [-130, 116],
        [-104, 97],
        [-92, 67],
        [-91, 90],
        [-68, 98],
        [-56, 136],
        [-54, 63],
        [-35, 76],
        [-15, 125],
      ],
      models: [
        'city_crates',
        'city_car',
        'city_dumpster',
        'city_vending',
        'city_barrier',
        'city_generator',
        'city_stall',
        'city_kiosk',
      ],
      color: amber,
    },
    {
      positions: [
        [22, 68],
        [33, 80],
        [53, 81],
        [75, 84],
        [42, 104],
        [31, 94],
        [12, 115],
      ],
      models: [
        'city_crates',
        'city_generator',
        'city_market_stall_canopy',
        'city_market_stall_canopy_violet',
        'city_barrier',
        'city_dumpster',
        'city_kiosk',
      ],
      color: violet,
    },
  ];
  for (const { positions, models, color } of themes) {
    for (const [index, [x, z]] of positions.entries()) {
      cover(
        models[index % models.length],
        x,
        z,
        0,
        index % 3 === 1 ? Math.PI / 2 : 0,
      );
      if (index % 2 === 0) {
        arena.decor('city_street_lamp', vec(x - 2, 0, z + 2));
        arena.light(
          vec(x - 2, 4.25, z + 2.45),
          index % 4 === 0 ? amber : color,
          64,
          24,
        );
      } else {
        arena.decor(
          index % 3 === 0 ? 'city_trash_bags' : 'city_vent_grate',
          vec(x + 2, 0, z + 1.4),
        );
      }
    }
  }
  // Parami w kom?rkach, ?eby ma?e grupy skrzy? i stragan?w wsp??dzieli?y siatki.
  for (const [model, x, z] of [
    ['city_crates', -130, -101],
    ['city_crates', -126, -101],
    ['city_generator', -101, -85],
    ['city_generator', -104, -85],
    ['city_market_stall_canopy', 94, -87],
    ['city_market_stall_canopy', 98, -87],
    ['city_market_stall_canopy_violet', 134, -70],
    ['city_market_stall_canopy_violet', 138, -70],
    ['city_crates', -90, 96],
    ['city_crates', -93, 96],
    ['city_barrier', 132, 8],
    ['city_barrier', 136, 8],
    ['city_dumpster', 114, 48],
    ['city_dumpster', 117, 48],
  ])
    cover(model, x, z, z === 48 ? bed : 0);

  for (const [x, z] of [
    [-115, -20],
    [-35, -12],
    [48, -14],
    [119, 18],
    [-86, 103],
    [-18, 83],
  ])
    arena.decor('city_cable_span', vec(x, 6, z));
  for (const [x, y, z, color] of [
    [-110, 4, -80, amber],
    [-110, 9, -92, white],
    [60, 4.5, 50, violet],
    [57, 3, 45, blue],
    [0, 1.5, 0, blue],
    [-3, 1, -19, green],
    [3, 1, 19, green],
    [90, 4, -70, amber],
    [-80, 3, 80, amber],
    [0, 7, 110, green],
    [0, 2, 68, blue],
    [23, 4, 130, amber],
    [-102, 3, -60, amber],
    [46, 3, -57, amber],
    [-79, 2.5, 50, blue],
    [25, 3, 50, green],
    [-140, 3, 127, amber],
    [138, 3, -120, amber],
  ])
    arena.light(vec(x, y, z), color, 64, 24);

  const west = -150,
    east = 150,
    north = -140,
    south = 140;
  for (let x = -147; x < 147; x += 22)
    solid(x + 8, -2, north, 22, 20 + ((x % 5) + 5) * 0.8, 4, brick);
  for (let z = -132; z < 140; z += 22)
    solid(west, -2, z + 8, 4, 18 + ((z % 6) + 6) * 0.8, 22, brick);
  for (let z = -132; z < 43; z += 22)
    solid(east, -2, z + 8, 4, 17 + ((z % 7) + 7) * 0.8, 22, brick);
  for (let x = -145; x < 30; x += 22)
    solid(x + 8, -2, south, 22, 17 + ((x % 8) + 8) * 0.7, 4, brick);
  // Południowo-wschodnie załamania kei są nad głęboką wodą zatoki.
  const shore = [
    [150, 58],
    [95, 58],
    [95, 88],
    [64, 88],
    [64, 112],
    [38, 112],
    [38, 140],
  ];
  for (let i = 1; i < shore.length; i++) {
    const [x0, z0] = shore[i - 1],
      [x1, z1] = shore[i];
    p.wall(vec(x0, -2, z0), vec(x1, -2, z1), 3.05, 0.7, stone);
  }
  p.wall(vec(150, bed, 42), vec(150, bed, 58), 2.35, 0.7, stone);
  p.safetyBoundary(
    [
      vec(-150, -3, -140),
      vec(150, -3, -140),
      vec(150, -3, 58),
      ...shore.slice(1).map(([x, z]) => vec(x, -3, z)),
      vec(-150, -3, 140),
    ],
    22,
  );
  for (const [x, z, scale] of [
    [-172, -126, 2.5],
    [-177, -74, 2.5],
    [-165, 22, 2.5],
    [-176, 78, 2.7],
    [-132, -166, 2.7],
    [-56, -172, 2.7],
    [32, -171, 2.8],
    [114, -170, 2.6],
    [174, -95, 2.6],
    [171, -21, 2.8],
    [-96, 168, 2.6],
    [-25, 173, 2.8],
  ])
    arena.decor('dock_pump_house', vec(x, -1, z), Math.PI, { scale });

  for (const [name, r, kind] of [
    ['Plac przepompowni', rect(-149, -8, -138, -69), 'open'],
    ['Targ na wyspie', rect(8, 149, -138, -64), 'dense'],
    ['Kamienice nad kanałem', rect(-149, -8, -51, 41), 'interior'],
    ['Brodzenie i warsztaty', rect(-7, 149, -48, 40), 'low'],
    ['Zalane podwórza', rect(-149, -8, 59, 139), 'interior'],
    ['Barka i śluza', rect(-7, 94, 42, 116), 'high'],
  ])
    arena.zone(name, r, kind);

  for (const [id, x, y, z] of [
    ['A', -110, 0, -80],
    ['B', 60, deck, 50],
    ['C', 0, bed, 0],
    ['D', 90, 0, -70],
    ['E', -80, 0, 80],
  ])
    arena.point(id, vec(x, y, z), 5);
  for (const [x, z] of [
    [-139, -93],
    [-95, -118],
    [-78, -77],
    [-24, -116],
    [18, -108],
    [85, -118],
    [119, -67],
    [140, -108],
    [-132, -44],
    [-112, -13],
    [-63, -14],
    [-23, 21],
    [17, -20],
    [47, -9],
    [108, 17],
    [137, -16],
    [-132, 92],
    [-88, 111],
    [-80, 95],
    [-40, 65],
    [17, 75],
    [48, 85],
    [20, 100],
    [29, 116],
  ])
    arena.spawn(vec(x, 0, z));
  // Układ Szturmu (ADR 0011 D4): front przesuwa się przez trzy sektory.
  arena.arenaMeta({
    assault: {
      sectors: [
        {
          playerSpawn: { x: -140, y: 0, z: 130 },
          stations: [
            { x: -80, y: 0, z: 80 },
            { x: -40, y: 0, z: 65 },
          ],
          spawnPoints: [
            { x: -88, y: 0, z: 111 },
            { x: -23, y: 0, z: 21 },
            { x: -132, y: 0, z: 92 },
            { x: 17, y: 0, z: 75 },
            { x: 20, y: 0, z: 100 },
            { x: -63, y: 0, z: -14 },
          ],
        },
        {
          playerSpawn: { x: -40, y: 0, z: 65 },
          stations: [
            { x: 0, y: -1.2, z: 0 },
            { x: -63, y: 0, z: -14 },
          ],
          spawnPoints: [
            { x: 17, y: 0, z: -20 },
            { x: -23, y: 0, z: 21 },
            { x: 47, y: 0, z: -9 },
            { x: -112, y: 0, z: -13 },
            { x: -78, y: 0, z: -77 },
            { x: -132, y: 0, z: -44 },
          ],
        },
        {
          playerSpawn: { x: -63, y: 0, z: -14 },
          stations: [
            { x: -78, y: 0, z: -77 },
            { x: -24, y: 0, z: -116 },
          ],
          spawnPoints: [
            { x: 18, y: 0, z: -108 },
            { x: -95, y: 0, z: -118 },
            { x: -139, y: 0, z: -93 },
            { x: -132, y: 0, z: -44 },
            { x: -112, y: 0, z: -13 },
          ],
        },
      ],
    },
  });
  return arena;
}
