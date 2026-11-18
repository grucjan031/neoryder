import { createArena, vec } from './lib/arena.mjs';
import { createPrimitives } from './lib/prims.mjs';

const rect = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ });
const white = '#fff1d6';
const amber = '#ffae1a';
const green = '#6dff4a';
const steel = 'steel_grating';
const concrete = 'concrete_raw_cast';

function railYard(arena, p, box) {
  p.floor(rect(169, 186, 4, 112), 0.03, 'rail_ballast', { walkable: false });
  for (const x of [173, 176, 180, 183])
    box(x, 0.09, 58, 0.12, 0.12, 108, 'rust');
  // Zastępniki do wymiany na port_freight_boxcar / port_flatcar po dostarczeniu GLB.
  for (const [x, z, color] of [
    [174.5, 22, 'olive'],
    [181.5, 43, null],
    [174.5, 56, 'graphite'],
    [181.5, 77, 'navy'],
    [174.5, 93, null],
  ]) {
    box(x, 0.7, z, 3, 1.2, 14, 'metal');
    for (const dz of [-4.5, 4.5]) box(x, 0.35, z + dz, 3.1, 0.7, 1.7, 'rust');
    if (color)
      p.containerStack({
        position: vec(x, 1.3, z),
        rotationY: Math.PI / 2,
        length: 20,
        layers: 1,
        palette: [color],
      });
    else {
      box(x, 2.65, z, 3, 2.7, 14, 'corrugated');
      box(x, 4.1, z, 3.08, 0.2, 14.08, 'metal');
      box(x - 1.53, 2.54, z, 0.08, 2.4, 3.4, 'rust');
    }
  }
  p.wall(vec(168, 0, 17), vec(168, 0, 108), 2, 0.65, concrete, {
    openings: [12, 46, 77].map((at) => ({ at, width: 8, height: 2 })),
  });
}

export default function generate() {
  const arena = createArena({
    id: 'arenaPowerPlant',
    name: 'Elektrownia',
    weather: 'ashfall',
    bounds: rect(-190, 190, -150, 150),
  });
  const p = createPrimitives(arena);
  const box = (x, y, z, w, h, d, material = concrete, opts = {}) =>
    arena.block({
      position: vec(x, y, z),
      size: vec(w, h, d),
      material,
      ...opts,
    });
  const hidden = { visible: false };
  const slab = (x, y, z, w, d, opts = {}) =>
    p.floor(rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y, steel, opts);
  const ramp = (x1, y1, x2, y2, z, width, material = steel) =>
    p.ramp({ from: vec(x1, y1, z), to: vec(x2, y2, z), width, material });
  const flight = (x1, y1, x2, y2, z, width = 2.8) =>
    p.stairs({
      from: vec(x1, y1, z),
      to: vec(x2, y2, z),
      width,
      stepRise: 0.28,
      stepDepth: 0.28,
      walkable: false,
      material: steel,
    });
  const cover = (model, x, z, w, h, d, y = 0) => {
    arena.decor(model, vec(x, y, z));
    box(x, y + h / 2, z, w, h, d, concrete, hidden);
  };
  const wall = (x1, z1, x2, z2, h, mat, opts, y = 0) =>
    p.wall(vec(x1, y, z1), vec(x2, y, z2), h, 0.5, mat, opts);
  const lit = (color, y, locations, range = 29) => {
    for (const [x, z] of locations) arena.light(vec(x, y, z), color, 78, range);
  };

  // Płyty parteru omijają nieckę chłodni, halę i obniżone nabrzeże.
  for (const [r, mat] of [
    [rect(-190, -118, -150, -128), 'asphalt'],
    [rect(-72, 190, -150, -128), 'asphalt'],
    [rect(-190, 190, -128, -45), 'asphalt'],
    [rect(-190, -20, -45, -5), 'asphalt'],
    [rect(-20, 70, -45, -5), 'turbine_hall_floor'],
    [rect(70, 190, -45, -5), 'asphalt'],
    [rect(-190, -127, -5, 80), 'concrete'],
    [rect(-127, 60, -5, 80), 'asphalt'],
    [rect(60, 190, -5, 15), 'asphalt'],
    [rect(60, 169, 15, 115), 'slag_heap'],
    [rect(169, 190, 15, 106), 'slag_heap'],
    [rect(-190, 32, 80, 115), 'quay_concrete'],
    [rect(60, 92, 115, 131), 'slag_heap'],
    [rect(92, 136, 115, 140), 'slag_heap'],
    [rect(136, 169, 115, 131), 'slag_heap'],
    [rect(52, 60, 80, 115), 'asphalt'],
    [rect(32, 52, 80, 90), 'concrete'],
    [rect(32, 52, 110, 115), 'concrete'],
  ])
    p.floor(r, r.minZ === 80 && r.minX === -190 ? -3 : 0, mat);
  // Wcięcie nabrzeża mieści szeroką rampę i osobne schody.
  ramp(32, -3, 52, 0, 96, 12, 'quay_concrete');
  flight(32, -3, 52, 0, 106, 4);
  wall(32, 80, 52, 80, 3, 'canal_stone_wall', undefined, -3);
  wall(32, 115, 52, 115, 3, 'canal_stone_wall', undefined, -3);
  wall(-190, 80, 32, 80, 3, 'canal_stone_wall', undefined, -3);
  wall(-190, 115, 60, 115, 3.7, 'canal_stone_wall', undefined, -6);
  // Rampa zachodnia wzdłuż nabrzeża ma własny nasyp i nie przecina płyty placu.
  ramp(-186, -3, -166, 0, 89, 5, 'quay_concrete');
  p.floor(rect(-166, -160, 79, 92), 0, steel);
  wall(-166, 92, -160, 92, 1.1, 'metal');
  wall(-160, 92, -160, 80, 1.1, 'metal');
  box(0, -6.4, 132.5, 380, 0.4, 35, 'canal_water');
  p.safetyBoundary(
    [
      vec(-190, -6, -150),
      vec(-118, -6, -150),
      vec(-118, -6, -128),
      vec(-72, -6, -128),
      vec(-72, -6, -150),
      vec(190, -6, -150),
      vec(190, -6, 106),
      vec(169, -6, 106),
      vec(169, -6, 131),
      vec(136, -6, 131),
      vec(136, -6, 140),
      vec(92, -6, 140),
      vec(92, -6, 131),
      vec(60, -6, 131),
      vec(60, -6, 115),
      vec(-190, -6, 115),
    ],
    26,
  );
  wall(-190, -149, -118.7, -149, 2.5, 'corrugated');
  wall(-71.3, -149, 190, -149, 2.5, 'corrugated');
  wall(-118.7, -149, -118.7, -127.25, 3.4, concrete);
  wall(-118.7, -127.25, -71.3, -127.25, 3.4, concrete);
  wall(-71.3, -127.25, -71.3, -149, 3.4, concrete);
  for (const [x, color] of [
    [-108, 'navy'],
    [-97, 'olive'],
    [-85, 'graphite'],
  ])
    arena.decor(`port_container_20_${color}`, vec(x, 0, -138));
  wall(-189, -149, -189, 78, 3.2, concrete);
  wall(-189, 80, -189, 115, 2.5, 'canal_stone_wall', undefined, -3);
  wall(189, -148, 189, 107, 3, 'rail_ballast');
  ramp(185, 0, 189, 3, -21, 254, 'rail_ballast').blocks[0].walkable = false;
  wall(168, 107, 168, 131, 2.1, concrete);
  for (const [x1, x2, z] of [
    [60, 92, 130],
    [92, 136, 139],
    [136, 168, 130],
  ])
    wall(x1, z, x2, z, 1.3, 'slag_heap');
  for (const [x, z] of [
    [-155, -164],
    [-98, -169],
    [-38, -176],
    [23, -181],
    [83, -187],
    [142, -198],
    [199, -214],
  ]) {
    arena.decor('power_hv_pylon', vec(x, 0, z));
    if (x < 190)
      arena.decor('city_cable_span', vec(x + 28, 24, z - 4), 0.1, {
        scale: 5.7,
      });
  }
  for (const [x, z, scale] of [
    [-213, -102, 2.6],
    [-212, 12, 3],
    [-216, 73, 2.2],
    [210, -77, 3.5],
    [207, -10, 2.2],
    [221, 63, 2.7],
    [103, 160, 2.4],
    [167, 164, 2],
    [198, 141, 2.6],
  ]) {
    arena.decor('power_slag_heap', vec(x, -1, z), 0, { scale });
  }

  arena.zone('Chłodnie kominowe', rect(-161, -91, -97, 43), 'dense');
  arena.zone('Hala turbin', rect(-20, 70, -45, -5), 'interior');
  arena.zone('Kotłownia i komin', rect(20, 83, -142, -95), 'high');
  arena.zone('Rozdzielnia', rect(90, 175, -115, -20), 'open');
  arena.zone('Skład żużlu i węgla', rect(60, 185, 15, 140), 'dense');
  arena.zone('Ujęcie wody', rect(-190, 40, 80, 115), 'low');

  for (const [z, breached] of [
    [-70, false],
    [15, true],
  ]) {
    arena.decor(
      breached ? 'power_cooling_tower_breach' : 'power_cooling_tower',
      vec(-120, -0.02, z),
      breached ? Math.PI / 2 : 0,
    );
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16;
      if (breached && (i === 31 || i <= 1)) continue;
      box(
        -120 + 24.55 * Math.cos(a),
        4.5,
        z + 24.55 * Math.sin(a),
        0.95,
        9,
        4.87,
        'cooling_tower_concrete',
        { ...hidden, rotation: vec(0, -a, 0) },
      );
    }
  }
  // Niecka na posadzce GLB: dno na 0 m, niski kołnierz i zejścia po obu stronach.
  p.floor(rect(-140, -125, -2, -0.3), 0.8, 'cooling_tower_concrete', {
    thickness: 0.8,
  });
  p.floor(rect(-140, -125, 5, 6.7), 0.8, 'cooling_tower_concrete', {
    thickness: 0.8,
  });
  p.floor(rect(-140, -137, -0.3, 5), 0.8, 'cooling_tower_concrete', {
    thickness: 0.8,
  });
  p.floor(rect(-128, -125, -0.3, 5), 0.8, 'cooling_tower_concrete', {
    thickness: 0.8,
  });
  ramp(-143, 0, -140, 0.8, 2, 3.6, 'turbine_hall_floor').blocks[0].walkable =
    false;
  ramp(-137, 0.8, -134, 0, 2, 3.6, 'turbine_hall_floor').blocks[0].walkable =
    false;
  ramp(-131, 0, -128, 0.8, 2, 3.6, 'turbine_hall_floor').blocks[0].walkable =
    false;
  ramp(-125, 0.8, -122, 0, 2, 3.6, 'turbine_hall_floor').blocks[0].walkable =
    false;
  for (const [x, z] of [
    [-130, 24],
    [-136, 12],
    [-113, 29],
    [-142, 22],
    [-150, -32],
    [-94, -55],
    [-103, 45],
  ]) {
    cover('build_pipe_stack', x, z, 3.02, 2.79, 3);
  }
  for (const [x, z] of [
    [-107, 23],
    [-132, 32],
    [-112, -7],
    [-150, -8],
    [-96, 40],
    [-68, 16],
  ]) {
    const a = arena.rng() * 0.8 - 0.4;
    box(x, 0.65, z, 4.2, 1.3, 1.8, concrete, { rotation: vec(0, a, 0) });
    box(x + 1.5, 0.3, z + 1.6, 2.1, 0.6, 1.2, 'cooling_tower_concrete');
  }
  lit(amber, 5, [
    [-120, -92],
    [-139, 13],
    [-103, 16],
    [-160, -117],
    [-96, -18],
  ]);
  lit(white, 4, [
    [-119, 20],
    [-100, 10],
  ]);

  const gate = [{ at: 45, width: 12, height: 7 }];
  for (const z of [-45, -5]) {
    wall(-20, z, 70, z, 6, concrete, { openings: [{ ...gate[0], height: 6 }] });
    wall(
      -20,
      z,
      70,
      z,
      12,
      'corrugated',
      { openings: [{ ...gate[0], height: 1 }] },
      6,
    );
  }
  for (const x of [-20, 70])
    wall(x, -45, x, -5, 18, 'corrugated', {
      openings: [
        { at: 20, width: 4.5, height: 3.8 },
        { at: 20, width: 4.5, bottom: 5.8, height: 3.2 },
      ],
    });
  p.floor(rect(-20, 70, -45, -5), 18, 'corrugated', { walkable: false });
  for (const x of [-1, 25, 51]) {
    arena.decor('power_turbine_housing', vec(x, 0, -13));
    box(x, 2.86, -13, 19.6, 5.72, 5.6, 'turbine_hall_floor', hidden);
    slab(x, 6, -13, 19.6, 5.6, hidden);
    for (const z of [-15.9, -10.1])
      box(x, 6.55, z, 19.6, 1.1, 0.18, 'metal', hidden);
  }
  for (const x of [12, 38])
    p.bridge({
      from: vec(x - 3.2, 6, -13),
      to: vec(x + 3.2, 6, -13),
      y: 6,
      width: 2.8,
      material: steel,
    });
  ramp(-19.5, 0, -10.8, 6, -13, 2.6).blocks[0].walkable = false;
  ramp(69.5, 0, 60.8, 6, -13, 2.6).blocks[0].walkable = false;
  // Antresola niezależna od bramy północnej, z wejściem z obu końców.
  p.floor(rect(-3, 53, -43, -35), 8, steel);
  flight(-16, 4, -3, 8, -39);
  flight(-3, 0, -16, 4, -42);
  slab(-17.2, 4, -40.5, 2.6, 6);
  flight(66, 4, 53, 8, -39);
  flight(53, 0, 66, 4, -42);
  slab(67.2, 4, -40.5, 2.6, 6);
  for (const z of [-43, -35])
    wall(
      -3,
      z,
      53,
      z,
      3,
      'metal',
      {
        openings: [9, 21, 35, 47].map((at) => ({
          at,
          width: 8,
          bottom: 0.9,
          height: 1.65,
        })),
      },
      8,
    );
  for (const x of [6, 44]) {
    box(x, 12.4, -25, 2, 0.8, 40, 'metal');
    box(x, 11.4, -20, 3, 1.2, 3, 'hazard');
  }
  for (const [x, z] of [
    [-38, -9],
    [-4, 18],
    [31, 25],
    [66, 19],
    [67, -62],
    [3, -61],
  ]) {
    cover('build_precast_stack', x, z, 6, 1.6, 2.4);
  }
  lit(white, 7, [
    [-10, -25],
    [10, -25],
    [30, -25],
    [51, -25],
    [64, -24],
    [22, -38],
  ]);
  lit(
    green,
    8.8,
    [
      [7, -38],
      [45, -38],
    ],
    18,
  );

  p.building({
    rect: rect(20, 60, -125, -95),
    height: 14,
    interior: true,
    roofAccessible: true,
    wallMaterial: concrete,
    roofMaterial: 'roof_tar',
    doors: [
      { side: 'south', at: 13, width: 6, height: 5 },
      { side: 'east', at: 14, width: 4, height: 4 },
    ],
    windows: [{ side: 'south', at: 28, width: 8, bottom: 8, height: 3 }],
  });
  arena.decor('power_chimney', vec(45, 0, -135));
  box(45, 60, -135, 9.8, 120, 9.8, concrete, hidden);
  // Dwa naprzemienne biegi na kondygnację; ostatni spocznik łączy wieżę z dachem.
  for (let i = 0; i < 4; i++) {
    const forward = i % 2 === 0,
      a = forward ? 64 : 76,
      b = forward ? 76 : 64;
    flight(a, i * 3.5, b, (i + 1) * 3.5, -119 + i * 3, 2.4);
    slab(b + (forward ? 1.3 : -1.3), (i + 1) * 3.5, -117.5 + i * 3, 2.8, 6);
  }
  slab(61.5, 14, -109, 5, 4);
  for (const x of [61.5, 78.4]) {
    for (const z of [-120.3, -106.7]) box(x, 6.8, z, 0.48, 13.6, 0.48, 'metal');
    box(x, 13.8, -113.5, 0.5, 0.4, 14.2, 'metal');
  }
  wall(20, -125, 60, -125, 1, 'metal', undefined, 14);
  wall(20, -95, 60, -95, 1, 'metal', undefined, 14);
  lit(
    amber,
    8,
    [
      [38, -124],
      [43, -139],
      [75, -110],
      [35, -91],
    ],
    35,
  );
  lit(white, 5, [
    [33, -108],
    [54, -109],
  ]);

  function racks(first, count, z) {
    const last = first + count * 12;
    const lane = z + 1.25;
    for (let i = 0; i < count; i++) {
      const x = first + 6 + i * 12;
      arena.decor('power_pipe_rack', vec(x, 0, z));
    }
    slab((first + last) / 2, 6.2, lane, last - first, 1.4, {
      ...hidden,
      walkable: false,
    });
    for (const dz of [-0.78, 0.78])
      box(
        (first + last) / 2,
        6.75,
        lane + dz,
        last - first,
        1.1,
        0.14,
        'metal',
        hidden,
      );
    for (let i = 0; i <= count * 2; i++)
      for (const dz of [-1.78, 1.84])
        box(first + i * 6, 3, z + dz, 0.32, 6, 0.32, 'metal', hidden);
  }
  racks(-92, 6, -25.5);
  racks(70, 2, -25.5);
  slab(-94.5, 6.2, -24.25, 5, 2.8, { walkable: false });
  flight(-109, 0, -97, 6.2, -24.25, 1.7);
  slab(96, 6.2, -24.25, 4, 2.8, { walkable: false });
  flight(110, 0, 98, 6.2, -24.25, 1.7);
  slab(25, 6.2, -24.25, 90, 1.8, { walkable: false });
  wall(
    -20,
    -25.25,
    70,
    -25.25,
    1.1,
    'metal',
    {
      openings: [35.5, 63.5].map((at) => ({ at, width: 3, height: 1.1 })),
    },
    6.2,
  );
  wall(-20, -23.25, 70, -23.25, 1.1, 'metal', undefined, 6.2);
  flight(1, 0, 14, 6.2, -27.1, 1.7);
  slab(15.5, 6.2, -25.4, 3, 3.6, { walkable: false });
  flight(58, 0, 45, 6.2, -27.1, 1.7);
  slab(43.5, 6.2, -25.4, 3, 3.6, { walkable: false });
  // Pomost serwisowy C–D. Klatki przy końcach zostawiają niezależną drogę pod spodem.
  function gantryWalk(x, z1, z2) {
    p.floor(rect(x - 1, x + 1, z1, z2), 6.2, steel, { thickness: 0.3 });
    for (const dx of [-1.08, 1.08])
      box(x + dx, 6.75, (z1 + z2) / 2, 0.16, 1.1, z2 - z1, 'metal');
    for (let z = z1 + 3; z < z2; z += 18)
      box(x, 2.95, z, 0.65, 5.9, 0.65, 'metal');
  }
  gantryWalk(135, -40, 70);
  for (const [z, direction] of [
    [-42, 1],
    [72, -1],
  ]) {
    slab(134.4, 6.2, z, 3.2, 4);
    const edge = direction > 0 ? 132.8 : 136;
    flight(edge - direction * 13, 0, edge, 6.2, z, 1.75);
  }
  lit(amber, 7, [
    [-82, -25],
    [-57, -25],
    [-31, -25],
    [86, -25],
  ]);

  for (const x of [103, 115, 147, 158])
    for (const z of [-102, -81, -51])
      box(x, 2.5, z, 6, 5, 4, concrete, {
        model: 'power_transformer',
        instance: true,
      });
  for (const [x, z] of [
    [112, -109],
    [150, -109],
    [110, -39],
    [154, -40],
  ]) {
    arena.decor('city_highway_sign_gantry', vec(x, 0, z));
    for (const dx of [-6.6, 6.6])
      box(x + dx, 3, z, 0.6, 6, 1.1, concrete, hidden);
  }
  for (const z of [-114, -33])
    wall(90, z, 175, z, 1.25, 'steel_grating', {
      openings: [8, 38, 68].map((at) => ({ at, width: 8, height: 1.25 })),
    });
  wall(174, -115, 174, -33, 1.25, steel, {
    openings: [{ at: 42, width: 9, height: 1.25 }],
  });
  arena.roomMeta({
    hazards: [
      {
        kind: 'electric_field',
        id: 'westBus',
        position: vec(111, 0.5, -65),
        size: vec(6, 1, 9),
        cycle: { onS: 3, offS: 2 },
      },
      {
        kind: 'electric_field',
        id: 'eastBus',
        position: vec(150, 0.5, -68),
        size: vec(7, 1, 9),
        cycle: { onS: 4, offS: 2, offsetS: 1 },
      },
    ],
  });
  for (const [x, z] of [
    [111, -65],
    [150, -68],
  ])
    for (const sign of [-1, 1])
      box(x, 0.045, z + sign * 5, 8, 0.09, 0.8, 'hazard_stripes_worn');
  lit(
    green,
    4,
    [
      [104, -99],
      [122, -80],
      [141, -55],
      [163, -90],
    ],
    25,
  );
  lit(white, 6, [
    [109, -109],
    [152, -106],
    [130, -65],
    [156, -37],
  ]);

  const heaps = [
    [82, 44],
    [112, 27],
    [147, 48],
    [143, 102],
    [103, 122],
  ];
  for (const [x, z] of heaps) {
    arena.decor('power_slag_heap', vec(x, 0, z));
    box(x, 0.17, z, 20, 0.34, 20, 'slag_heap', hidden);
    box(x, 0.54, z, 17, 0.4, 17, 'slag_heap', hidden);
    // Równoległe pasy X odwzorowują stok bez przecinających się brył na podejściu.
    // Główny pas ma pełny bieg 13 m i wznios 7 m, zgodnie z profilem assetu.
    const stripWidth = 1.6;
    const thickness = 0.26;
    for (let i = -7; i <= 7; i++) {
      const offset = i * stripWidth;
      const run = Math.sqrt(13 ** 2 - offset ** 2);
      const top = 7 * (1 - Math.abs(offset) / 13);
      for (const side of [-1, 1]) {
        const angle = -side * Math.atan2(top, run);
        box(
          x + (side * run) / 2 + (Math.sin(angle) * thickness) / 2,
          top / 2 - (Math.cos(angle) * thickness) / 2,
          z + offset,
          Math.hypot(top, run),
          thickness,
          stripWidth,
          'slag_heap',
          { ...hidden, rotation: vec(0, 0, angle) },
        );
      }
    }
    box(x, 6.77, z, 1.15, 0.3, 1.15, 'slag_heap', hidden);
  }
  racks(72, 5, 69);
  box(102, 6.25, 68.45, 60, 0.38, 0.9, 'metal');
  box(102, 6.46, 68.45, 60, 0.06, 0.72, 'rubber');
  slab(70, 6.2, 70.25, 4, 2.8);
  flight(55, 0, 68, 6.2, 70.25, 1.75);
  slab(134, 6.2, 70.25, 4, 2.8);
  flight(149, 0, 136, 6.2, 70.25, 1.75);
  for (const [x, z] of [
    [81, 93],
    [103, 52],
    [133, 17],
    [151, 84],
    [68, 57],
    [55, 50],
  ]) {
    box(x, 1, z, 10, 2, 0.75, concrete);
    cover('build_rebar_bundle', x, z + 3, 6, 0.59, 1.02);
  }
  railYard(arena, p, box);
  lit(
    amber,
    7,
    [
      [83, 40],
      [112, 30],
      [143, 49],
      [106, 110],
      [151, 94],
    ],
    33,
  );
  lit(white, 6, [
    [119, 79],
    [171, 58],
    [172, 98],
    [75, 92],
  ]);

  gantryWalk(-72, 43, 79);
  slab(-73, 6.2, 41, 4, 4);
  flight(-88, 0, -75, 6.2, 41, 1.75);
  slab(-71, 6.2, 81, 4, 4);
  flight(-49, -3, -69, 6.2, 83, 1.75);
  slab(-70.2, 6.2, 82.3, 2.4, 4.2);
  p.building({
    rect: rect(-136, -106, 92, 112),
    y: -3,
    height: 7,
    interior: true,
    wallMaterial: 'canal_stone_wall',
    roofMaterial: 'corrugated',
    doors: [
      { side: 'east', at: 8, width: 5 },
      { side: 'west', at: 12, width: 5 },
    ],
  });
  for (const [x, z] of [
    [-121, 98],
    [-88, 101],
    [-34, 103],
    [21, 106],
    [-153, 103],
  ]) {
    cover('city_generator', x, z, 1.6, 1.4, 1.005, -3);
    arena.decor('city_vent_grate', vec(x + 2, -2.98, z + 1));
  }
  for (const x of [-128, -114, -78, -28, 15]) {
    arena.decor('city_pipe_run', vec(x, -4.6, 114.8));
    arena.decor('port_bollard', vec(x, -3, 113.7));
  }
  for (const z of [119, 127, 135])
    arena.decor('city_roof_bridge', vec(-99, -2.5, z));
  arena.decor('city_roof_water_tank', vec(-99, -6, 143), 0, { scale: 1.7 });
  for (const [x, z] of [
    [-165, 109],
    [-91, 108],
    [-72, 90],
    [-46, 111],
    [-12, 96],
    [17, 91],
  ])
    cover('city_highway_barrier', x, z, 4, 1.09, 0.81, -3);
  for (const [x, z] of [
    [-170, 57],
    [-142, 67],
    [-109, 64],
    [-77, 68],
    [-48, 59],
    [-18, 69],
    [14, 65],
    [-156, -109],
    [-129, -118],
    [-91, -111],
    [-64, -98],
    [-33, -111],
    [-6, -84],
    [76, -77],
    [96, 5],
    [119, 7],
    [153, -14],
  ]) {
    box(x, 1.4, z, 8, 2.8, 1.1, concrete);
    arena.decor(z < 0 ? 'city_crates' : 'city_generator', vec(x + 2, 0, z + 2));
  }
  lit(white, 1, [
    [-161, 104],
    [-118, 102],
    [-86, 102],
    [-60, 100],
    [-28, 104],
    [10, 98],
    [42, 98],
  ]);
  lit(
    green,
    0,
    [
      [-131, 101],
      [-102, 102],
      [-98, 114],
    ],
    18,
  );

  // Zaplecze pomiędzy strefami. Place rozdzielają drogi, budynki i ogrodzenia
  // z przerwami w osiach przejazdu. Wnętrza korzystają z istniejącej płyty.
  for (const { bounds, height, facade, doors, windows } of [
    {
      bounds: rect(-176, -154, -122, -100),
      height: 4.5,
      facade: 'corrugated',
      doors: [{ side: 'east', at: 11, width: 5 }],
      windows: [{ side: 'south', at: 9, width: 6, height: 1.4, bottom: 1.2 }],
    },
    {
      bounds: rect(-65, -39, -141, -119),
      height: 8,
      facade: concrete,
      doors: [
        { side: 'south', at: 13, width: 7 },
        { side: 'east', at: 10, width: 5 },
      ],
      windows: [{ side: 'west', at: 9, width: 7, height: 1.5, bottom: 1.3 }],
    },
    {
      bounds: rect(-59, -34, 7, 25),
      height: 5.4,
      facade: 'corrugated',
      doors: [
        { side: 'east', at: 9, width: 5 },
        { side: 'north', at: 13, width: 7 },
      ],
      windows: [],
    },
    {
      bounds: rect(-6, 16, 30, 48),
      height: 5.2,
      facade: concrete,
      doors: [
        { side: 'west', at: 8, width: 5 },
        { side: 'east', at: 8, width: 5 },
      ],
      windows: [{ side: 'south', at: 12, width: 9, height: 1.6, bottom: 1.2 }],
    },
    {
      bounds: rect(84, 103, 13, 24),
      height: 4.2,
      facade: 'corrugated',
      doors: [{ side: 'east', at: 5.5, width: 4 }],
      windows: [{ side: 'south', at: 9, width: 6, height: 1.4, bottom: 1.15 }],
    },
  ]) {
    p.building({
      rect: bounds,
      height,
      wallMaterial: facade,
      roofMaterial: 'roof_tar',
      doors,
      windows,
    });
    const x = (bounds.maxX + bounds.minX) / 2,
      z = (bounds.maxZ + bounds.minZ) / 2;
    cover('city_roof_hvac_unit', x + 3, z, 4, 1.98, 2.05, height);
    arena.decor(
      'city_pipe_run',
      vec(bounds.maxX - 2, 0, bounds.maxZ + 0.26),
      0,
      { scale: 0.68 },
    );
    cover('city_crates', bounds.minX + 2.8, z + 2, 2.4, 1.25, 1.6);
    lit(white, 3.2, [[x + 3, z]]);
    lit(amber, 3.6, [[x, bounds.maxZ + 1.5]]);
  }

  // Zbiorniki na wspólnym podeście, z obejściem przy gruncie.
  for (const x of [-106, -94, -82]) {
    arena.decor('city_roof_water_tank', vec(x, 0, -96), 0, { scale: 2.4 });
    box(x, 5.1, -96, 6.4, 10.2, 6.4, 'metal', hidden);
  }
  p.floor(rect(-117, -71, -103, -100), 3, steel);
  wall(-117, -103.15, -71, -103.15, 1, 'metal', undefined, 3);
  wall(-117, -99.85, -71, -99.85, 1, 'metal', undefined, 3);
  for (const x of [-115, -103, -91, -79])
    box(x, 1.35, -101.5, 0.62, 2.7, 0.62, 'metal');
  flight(-124, 0, -117, 3, -101.5, 2.1);
  flight(-64, 0, -71, 3, -101.5, 2.1);
  lit(amber, 6, [
    [-108, -101],
    [-82, -98],
  ]);

  const markings = [];
  function serviceRoad(from, to, width) {
    const eastWest = from.z === to.z;
    const length = eastWest ? to.x - from.x : to.z - from.z;
    for (let at = 8; at < length - 4; at += 12)
      markings.push({
        texture: 'floor_arrow',
        position: vec(
          from.x + (eastWest ? at : 0),
          0.012,
          from.z + (eastWest ? 0 : at),
        ),
        size: { w: 2, h: 3.4 },
        yaw: eastWest ? Math.PI / 2 : 0,
        surface: 'floor',
        opacity: 0.65,
      });
    for (const sign of [-1, 1])
      for (let at = 10; at < length - 5; at += 20) {
        const offset = (sign * width) / 2;
        box(
          from.x + (eastWest ? at : offset),
          0.04,
          from.z + (eastWest ? offset : at),
          eastWest ? 10 : 0.35,
          0.08,
          eastWest ? 0.35 : 10,
          'paving',
        );
      }
  }
  serviceRoad(vec(-180, 0, -134), vec(-125, 0, -134), 8);
  serviceRoad(vec(-66, 0, -111), vec(20, 0, -111), 10);
  serviceRoad(vec(-57, 0, 54), vec(56, 0, 54), 10);
  serviceRoad(vec(71, 0, -20), vec(71, 0, 52), 9);
  arena.roomMeta({ decals: markings });

  for (const [x1, z1, x2, z2, gaps] of [
    [-176, -94, -146, -94, [18]],
    [-62, -84, 14, -84, [17, 52]],
    [-60, 42, -13, 42, [12, 34]],
    [19, 48, 63, 48, [19]],
    [111, -17, 111, 37, [15, 39]],
  ])
    wall(x1, z1, x2, z2, 1.85, 'corrugated', {
      openings: gaps.map((at) => ({ at, width: 8, height: 1.85 })),
    });

  for (const [model, x, z, w, h, d] of [
    ['city_car', -164, -130, 4.42, 1.46, 1.94],
    ['build_mixer_truck', -140, -109, 2.51, 3.55, 9.02],
    ['city_wrecked_car', -32, -75, 2.15, 1.58, 3.95],
    ['city_car', -21, -101, 4.42, 1.46, 1.94],
    ['build_mixer_truck', 42, 37, 2.51, 3.55, 9.02],
    ['city_wrecked_car', 61, 12, 2.15, 1.58, 3.95],
    ['city_car', -27, 49, 4.42, 1.46, 1.94],
  ])
    cover(model, x, z, w, h, d);

  for (const [x, z] of [
    [-151, -87],
    [-47, -116],
    [7, -68],
    [-53, 34],
    [45, 66],
    [106, 3],
  ]) {
    cover('port_light_tower', x, z, 3.39, 20.12, 3.39);
    lit(white, 17, [[x, z]], 36);
  }
  for (const [x, z, layers, color] of [
    [-173, -57, 2, 'navy'],
    [-145, -57, 1, 'olive'],
    [-87, -122, 1, 'graphite'],
    [-3, -130, 2, 'navy'],
    [-17, -57, 1, 'olive'],
    [-21, 61, 2, 'graphite'],
    [48, 18, 1, 'navy'],
    [91, -7, 2, 'olive'],
    [91, 59, 1, 'graphite'],
    [-80, 19, 2, 'navy'],
    [-166, 28, 2, 'olive'],
    [64, -115, 1, 'graphite'],
    [109, -136, 2, 'navy'],
    [153, -133, 2, 'olive'],
    [177, -10, 1, 'graphite'],
  ])
    p.containerStack({
      position: vec(x, 0, z),
      rotationY: layers === 1 ? Math.PI / 2 : 0,
      length: layers === 1 ? 20 : 40,
      layers,
      palette: [color],
    });

  // Niskie kioski i rurociągi na wspornikach domykają osie widoku.
  for (const [x, z] of [
    [-74, -72],
    [-20, -126],
    [9, -100],
    [-73, 51],
    [21, 17],
    [53, 55],
    [83, -27],
    [108, 30],
    [-99, 51],
  ]) {
    box(x, 1.45, z, 5, 2.9, 3.4, concrete);
    box(x, 3.05, z, 5.25, 0.3, 3.65, 'corrugated');
    arena.decor('city_pipe_run', vec(x + 1.6, 0, z + 1.72), 0, { scale: 0.48 });
    lit(green, 2, [[x - 1.2, z + 2]], 9);
  }
  for (const [x, z] of [
    [-165, -78],
    [-57, -63],
    [-41, 34],
    [29, 62],
    [103, 47],
  ]) {
    for (const dx of [-5, 5]) box(x + dx, 0.63, z, 0.65, 1.26, 1.1, concrete);
    box(x, 1.48, z, 14, 0.44, 0.65, 'rust');
    box(x, 1.29, z - 0.52, 14, 0.36, 0.36, 'metal');
  }

  // Osłony na obrzeżach placów i pomiędzy odnogami dróg.
  for (const [x, z, width, depth, y = 0] of [
    [-51, -36, 14, 4],
    [-71, -12, 12, 3],
    [8, -52, 9, 3],
    [126, 53, 8, 4],
    [-41, -10, 5, 8],
    [36, -67, 10, 5],
    [45, -33, 8, 2],
    [144, 29, 10, 3],
    [149, 114, 8, 3],
    [27, -90, 8, 3],
    [-58, 77, 7, 3],
    [-8, 75, 8, 3],
    [-23, 29, 8, 3],
    [-169, 70, 8, 3],
    [68, 101, 7, 4],
    [137, 86, 9, 3],
    [111, 107, 7, 4],
    [155, 74, 7, 3],
    [-60, 108, 5, 2, -3],
    [-8, 104, 6, 3, -3],
    [-176, 100, 7, 3, -3],
  ]) {
    box(x, y + 0.8, z, width, 1.6, depth, concrete);
    box(x, y + 1.72, z, width - 0.4, 0.24, depth - 0.4, 'corrugated');
  }

  const start = vec(-180, 0, -140);
  arena.roomMeta({
    playerSpawn: start,
    maxAlive: 12,
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-183, 0, -145),
        size: vec(3, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(151, 0, 123),
        size: vec(3, 3, 1),
      },
    ],
    rainShelters: [
      ...(arena.toRoom().rainShelters ?? []),
      { position: vec(25, 9, -25), size: vec(90, 18, 40) },
    ],
  });
  const groundSpawns = [
    [-147, -132],
    [-174, -73],
    [-166, -26],
    [-82, -62],
    [-62, -49],
    [-101, 15],
    [-91, 36],
    [-49, 31],
    [-7, -26],
    [56, -26],
    [31, -76],
    [30, -113],
    [72, -120],
    [81, -95],
    [95, -93],
    [160, -93],
    [166, -63],
    [125, -46],
    [150, -9],
    [73, 30],
    [108, 87],
    [157, 68],
    [151, 120],
    [-132, 63],
    [-37, 66],
    [24, 59],
  ].map(([x, z]) => vec(x, 0, z));
  for (const spawn of groundSpawns) arena.spawn(spawn);
  arena.arenaMeta({
    maxAlive: 12,
    enemyTickets: 200,
    spawnRing: { minM: 25, maxM: 100 },
    navigationCellM: 2,
    spawnPoints: [
      ...groundSpawns,
      vec(-148, -3, 98),
      vec(-119, -3, 105),
      vec(-28, -3, 99),
      vec(16, -3, 109),
    ],
  });
  for (const [id, x, y, z] of [
    ['A', -120, 0, 15],
    ['B', 25, 0, -25],
    ['C', 130, 0, -65],
    ['D', 120, 0, 80],
    ['E', -60, -3, 100],
  ])
    arena.point(id, vec(x, y, z), 5);
  return arena;
}
