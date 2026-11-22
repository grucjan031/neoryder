import { writeFileSync, readFileSync } from 'node:fs';
const v = (x, y = 0, z = 0) => ({ x, y, z });
const block = (x, y, z, sx, sy, sz, material = 'concrete', model) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...(model ? { model } : {}),
});
const zone = (x, length = 12, width = 36) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const definitions = [
  ['sluza', 'Śluza pod estakadą', 44, 12, 'warsztat', '#ffae1a'],
  ['targ', 'Nocny targ', 48, 22, 'ramen', '#fff1d6'],
  ['tunel', 'Zalane przejście', 44, 10, 'metro', '#3d7bff'],
  ['dziedziniec', 'Podwórze nadajników', 48, 26, 'repair', '#6dff4a'],
  ['zaplecze', 'Zaplecze rusztowań', 44, 14, 'warsztat', '#8a5cff'],
  ['plac', 'Plac Helixa', 52, 28, 'pharmacy', '#fff1d6'],
  ['kanal', 'Kanał zrzutowy', 40, 12, 'metro', '#6dff4a'],
];
const dressing = [
  {
    facade: 10,
    signY: [3.5, 5],
    covers: [
      block(12, 0.55, -4, 3, 1.1, 1, 'concrete', 'city_barrier'),
      block(26, 0.65, 4.5, 2, 1.3, 2, 'metal', 'city_crates'),
    ],
    props: [
      ['city_cable_span', 8, 5.5, 0],
      ['city_overpass_pillar', 21, 0, -5.6, 0.5],
      ['city_traffic_cone', 34, 0, 4.6],
    ],
    decals: [['floor_stop', 35, 0, 3, 1]],
  },
  {
    facade: 14,
    signY: [5.5, 4],
    covers: [
      block(58, 1.25, -5, 3, 2.5, 12, 'market_tarp'),
      block(74, 1.25, 5, 3, 2.5, 12, 'market_tarp'),
      block(55.5, 1.25, -3.5, 2, 2.5, 3, 'metal', 'city_stall'),
      block(71.5, 0.65, 4, 2, 1.3, 2, 'metal', 'city_crates'),
      block(76.5, 1.25, 7, 2, 2.5, 3, 'metal', 'city_stall'),
    ],
    props: [
      ['city_lantern_string', 56, 5, 0],
      ['city_lantern_string', 76, 5.7, 0],
      ['city_trash_bags', 65, 0, -10],
      ['city_awning', 85, 3.5, 10.7],
      ['city_vending', 80, 0, -10],
    ],
    decals: [
      ['puddle1', 63, 6, 4, 2],
      ['floor_hazard', 69, -5, 3, 1],
    ],
  },
  {
    facade: 12,
    signY: [3.8, 5.2],
    covers: [
      block(111, 0.65, -4.3, 5, 1.3, 1.4, 'metal', 'city_pipe_run'),
      block(134, 0.8, 4.4, 3, 1.6, 1.2, 'metal'),
    ],
    props: [
      ['city_vent_grate', 102, 0, -3.6],
      ['city_shutter', 112, 0, 4.9],
      ['city_pipe_run', 121, 2.2, -4.8],
      ['city_ac_unit', 132, 2.5, 4.7],
    ],
    decals: [
      ['puddle2', 113, 0, 4, 2.5],
      ['manhole', 124, 1.8, 1.5, 1.5],
    ],
  },
  {
    facade: 16,
    signY: [6.5, 4.7],
    covers: [
      block(152, 1.45, -6, 2, 2.9, 14, 'corrugated'),
      block(166, 1.45, 6, 2, 2.9, 14, 'corrugated'),
      block(149, 0.85, -5, 4, 1.7, 2.5, 'metal', 'city_wrecked_car'),
      block(163, 0.55, 5, 3, 1.1, 1, 'concrete', 'city_barrier'),
      block(158, 0.8, 10.5, 2.5, 1.6, 2, 'metal', 'city_dumpster'),
    ],
    props: [
      ['city_antenna', 146, 0, -11.5],
      ['city_satellite_cluster', 155, 5, 12.2],
      ['city_sign_box', 170, 3.3, -12.7],
      ['city_ac_unit', 179, 4.5, 12.5],
    ],
    decals: [
      ['tire_marks', 144, -3, 5, 2],
      ['puddle2', 171, -5, 3, 2],
    ],
  },
  {
    facade: 11,
    signY: [4.5, 7],
    covers: [
      block(207, 1.25, -3, 2, 2.5, 8, 'corrugated'),
      block(203, 0.7, 5.4, 2.5, 1.4, 2, 'metal', 'city_generator'),
      block(211, 0.65, -5.5, 2, 1.3, 2, 'metal', 'city_crates'),
    ],
    props: [
      ['build_rebar_bundle', 201, 0, -6.4, 0.65],
      ['build_scaffold_bay', 209, 4.25, -6.3, 0.45],
      ['build_pipe_stack', 213, 0, 6, 0.6],
      ['city_neon_sign_frame', 220, 6, 6.6],
    ],
    decals: [
      ['floor_hazard', 192, 0, 3, 1],
      ['oil_stain', 213, 4.2, 2, 2],
    ],
  },
  {
    facade: 15,
    signY: [7, 5.8],
    covers: [
      block(242, 1.3, -6.5, 2.45, 2.6, 15, 'container_navy'),
      block(260, 1.3, 6.5, 2.45, 2.6, 15, 'container_graphite'),
      block(
        239,
        1.3,
        -6,
        2.45,
        2.6,
        6.06,
        'container_navy',
        'port_container_20_navy',
      ),
      block(257, 1.4, 6, 2.8, 2.8, 3, 'metal', 'city_kiosk'),
      block(265, 0.6, 7, 3, 1.2, 1.4, 'concrete', 'city_barrier'),
    ],
    props: [
      ['city_holo_projector', 254, 0, 10],
      ['city_street_lamp', 237, 0, -12.5],
      ['city_ad_screen', 249, 4, 13.5],
      ['port_bollard', 273, 0, 11],
    ],
    decals: [
      ['floor_arrow', 235, 1.5, 3, 3],
      ['puddle1', 252, -4, 5, 2],
      ['floor_stop', 275, 0, 3, 1],
    ],
  },
  {
    facade: 12,
    signY: [4, 5.5],
    covers: [
      block(297, 0.8, 4.6, 2.5, 1.6, 2, 'metal', 'city_dumpster'),
      block(305, 0.65, -4.5, 4, 1.3, 1.3, 'concrete', 'city_highway_barrier'),
      // „Transformator” z radia: zasłania właz przy wschodnim murze.
      block(311.5, 0.7, 0, 2.5, 1.4, 2, 'metal', 'city_generator'),
    ],
    props: [
      ['city_door', 291, 0, -5.9],
      ['city_vent_grate', 295, 0, 3.5],
      ['city_trash_bags', 310, 0, 5.3],
      ['city_street_lamp', 314, 0, -5.3],
    ],
    decals: [
      ['puddle2', 300, -3, 4, 2],
      ['manhole', 307, 2.6, 1.5, 1.5],
    ],
  },
];

function ramp(start, end, startY, endY, z) {
  const angle = Math.atan2(endY - startY, end - start);
  const thickness = 0.4;
  // Końce górnej powierzchni stykają się z asfaltem i krawędzią kładki.
  return {
    ...block(
      (start + end) / 2 + (Math.sin(angle) * thickness) / 2,
      (startY + endY) / 2 - (Math.cos(angle) * thickness) / 2,
      z,
      Math.hypot(end - start, endY - startY),
      thickness,
      2.5,
      'steel_grating',
    ),
    rotation: v(0, 0, angle),
    walkable: true,
  };
}
const level = {
  id: 'm01-maszty',
  name: 'Niecka — Maszty',
  type: 'combat',
  theme: 'neonStreet',
  playerSpawn: v(5),
  blocks: [],
  spawnPoints: [],
  signs: [],
  lights: [],
  decor: [],
  decals: [],
  ambientFx: [],
  rainShelters: [],
  hazards: [],
  sections: [],
  checkpoints: [],
  encounters: [],
  gates: [],
  maxAlive: 12,
  objectiveOrder: ['mast-1', 'mast-2', 'helix', 'mast-3', 'exit'],
  objectivePositions: {
    'mast-1': v(82),
    'mast-2': v(174),
    helix: v(175.5),
    'mast-3': v(270),
    exit: v(316),
  },
};
let from = 0;
for (const [
  index,
  [id, name, length, width, texture, color],
] of definitions.entries()) {
  const center = from + length / 2;
  const { facade, signY, covers, props, decals } = dressing[index];
  level.blocks.push(...covers);
  for (const [model, x, y, z, scale] of props)
    level.decor.push({
      model,
      position: v(x, y, z),
      ...(scale ? { scale } : {}),
    });
  for (const [texture, x, z, w, h] of decals)
    level.decals.push({
      texture,
      position: v(x, 0.01, z),
      size: { w, h },
      yaw: texture === 'floor_arrow' ? -Math.PI / 2 : 0,
      surface: 'floor',
    });
  // Radio misji reaguje na `enterSection:<id>`; pole `radio` sekcji nie jest potrzebne.
  level.sections.push({ id, name, zone: zone(center, length, width) });
  // Komórki podłogi pozwalają odrzucać daleką statykę, bez jednej siatki na 320 m.
  for (let x = from; x < from + length; x += 4)
    level.blocks.push(block(x + 2, -0.5, 0, 4, 1, width, 'asphalt'));
  for (const side of [-1, 1]) {
    level.blocks.push(
      block(
        center,
        facade / 2,
        side * (width / 2 + 1),
        length,
        facade,
        2,
        'facade',
      ),
    );
    level.signs.push({
      kind: 'neon',
      texture,
      position: v(
        center,
        signY[side === -1 ? 0 : 1],
        side * (width / 2 - 0.15),
      ),
      size: { w: 5, h: 2 },
      yaw: side === 1 ? Math.PI : 0,
      tint: color,
    });
    level.lights.push({
      position: v(center, 4, side * (width / 2 - 2)),
      color,
      intensity: 14,
      range: 18,
    });
  }
  if (index > 0) {
    const previousWidth = definitions[index - 1][3];
    level.signs.push({
      kind: 'neon',
      texture: 'arrow',
      position: v(
        from - 2.25,
        index === 2 ? 3.6 : 4.8,
        -previousWidth / 2 + 0.15,
      ),
      size: { w: 2, h: 1 },
      yaw: 0,
      tint: '#fff1d6',
    });
    if (previousWidth !== width)
      for (const side of [-1, 1])
        level.blocks.push(
          block(
            from,
            6,
            side *
              (Math.min(previousWidth, width) / 2 +
                Math.abs(previousWidth - width) / 4),
            2,
            12,
            Math.abs(previousWidth - width) / 2,
            'concrete',
          ),
        );
  }
  if (index === 0 || index === 2) {
    level.blocks.push(block(center, 7, 0, length, 1, width, 'concrete'));
    for (let x = from + 2; x < from + length; x += 8)
      level.lights.push({
        position: v(x, 5.8),
        color: '#fff1d6',
        intensity: 40,
        range: 14,
      });
    level.rainShelters.push({
      position: v(center, 3),
      size: v(length, 8, width),
    });
    level.ambientFx.push({ kind: 'drip', position: v(center, 6, 2), rate: 5 });
  }
  if (index === 4)
    for (const side of [-1, 1]) {
      const z = side * 5.5;
      level.blocks.push(
        {
          ...block(center, 4, z, 24, 0.5, 2.5, 'steel_grating'),
          walkable: true,
        },
        ramp(189, 194, 0, 4.25, z),
        ramp(218, 223.4, 4.25, 0, z),
      );
      for (const railZ of [z - 1.2, z + 1.2])
        level.blocks.push(block(center, 4.7, railZ, 24, 0.9, 0.1, 'metal'));
      for (const x of [center - 8, center, center + 8])
        level.lights.push({
          position: v(x, 3.3, side * 5.5),
          color: '#fff1d6',
          intensity: 16,
          range: 9,
        });
      for (const x of [center - 10, center + 10])
        level.blocks.push(block(x, 2, side * 5.5, 0.5, 4, 0.5, 'metal'));
    }
  if (index === 1 || index === 3 || index === 5) {
    // Otwarte place nie mają stropu: bez tych plam asfalt i osłony zlewają się z nocą.
    for (const [offset, side] of [
      [0.2, -1],
      [0.5, 1],
    ])
      level.lights.push({
        position: v(from + length * offset, 5, (side * width) / 5),
        color: '#fff1d6',
        intensity: 26,
        range: 18,
      });
    const mast = level.objectivePositions[`mast-${(index + 1) / 2}`];
    level.lights.push({
      position: v(mast.x - 2, 4.5, 0),
      color: '#ffae1a',
      intensity: 30,
      range: 14,
    });
  }
  level.ambientFx.push({
    kind: 'steam',
    position: v(center + 7, 0, width / 2 - 3),
    rate: 2,
  });
  from += length;
}
level.blocks.push(block(0, 6, 0, 2, 12, 12), block(320, 6, 0, 2, 12, 12));
const encounters = [
  // Strefy zaczynają się za bramą poprzedniego spotkania: kolejna walka nie rusza
  // w miejscu, w którym gracz dobił poprzednią, i jest chwila ciszy na radio.
  ['patrol-wejscie', 26, 32, 'm01Approach', undefined, 38],
  ['oslona-pierwszego', 56, 82, 'm01MastOne', encounter('patrol-wejscie'), 96],
  ['patrol-tunel', 116, 127, 'm01Patrol', objective('mast-1'), 140],
  ['oslona-drugiego', 152, 169, 'm01MastTwo', encounter('patrol-tunel'), 181],
  ['patrol-rusztowania', 200, 216, 'm01Patrol', objective('helix'), 224],
  ['patrol-plac', 236, 247, 'm01Assault', encounter('patrol-rusztowania'), 255],
  ['oslona-trzeciego', 266, 272, 'm01MastThree', encounter('patrol-plac'), 282],
];
const encounterSpawns = {
  'oslona-pierwszego': [
    [78, -7],
    [81, 8],
    [85, -4],
    [88, 5],
  ],
  'oslona-drugiego': [
    [161, -8],
    [169, 8],
    [173, -9],
    [177, 5],
  ],
  'patrol-rusztowania': [
    [209, 2.5],
    [214, -3.5],
    [216, 3],
    [220, -2.5],
  ],
  'patrol-plac': [
    [239, 8],
    [247, -9],
    [251, 7],
    [253, -5],
  ],
  'oslona-trzeciego': [
    [256, -8],
    [263, 9],
    [269, -7],
    [274, 5],
  ],
};
for (const [id, trigger, spawn, wave, after, gate] of encounters) {
  const spawnPoints = (
    encounterSpawns[id] ?? [
      [spawn, -3],
      [spawn, 3],
      [spawn + 4, -3],
      [spawn + 4, 3],
    ]
  ).map(([x, z]) => ({ x, z }));
  level.encounters.push({
    id,
    zone: zone(trigger, 20),
    wave,
    spawnPoints,
    ...(after ? { after } : {}),
  });
  const section = level.sections.find(
    (s) =>
      gate >= s.zone.position.x - s.zone.size.x / 2 &&
      gate <= s.zone.position.x + s.zone.size.x / 2,
  );
  level.gates.push({
    id: `gate-${id}`,
    block: block(gate, 6, 0, 1, 12, section.zone.size.z, 'metal'),
    after: encounter(id),
  });
  level.spawnPoints.push(...spawnPoints);
}
for (const [id, x, width] of [
  ['mast-1', 100, 10],
  ['mast-2', 184, 14],
  ['helix', 188, 14],
  ['mast-3', 288, 12],
])
  level.gates.push({
    id: `gate-${id}`,
    block: block(x, 6, 0, 1, 12, width, 'metal'),
    after: objective(id),
  });
// Fala posiłków musi być tą samą, którą wskazuje `reinforcements` celu w danych misji.
for (const [id, x, positions, wave = 'missionPatrol'] of [
  [
    'mast-1',
    82,
    [
      [76, -6],
      [88, 7],
    ],
  ],
  [
    'mast-2',
    174,
    [
      [167.5, -7],
      [179, 8],
    ],
  ],
  [
    'mast-3',
    270,
    [
      [263, -8],
      [276, 9],
      [258, -5],
      [277, -3],
    ],
    'm01Assault',
  ],
])
  level.encounters.push({
    id: `reinforce-${id}`,
    zone: zone(x, 24),
    wave,
    spawnPoints: positions.map(([x, z]) => ({ x, z })),
    after: objective(id),
    reinforcementFor: id,
  });
for (const [id, x, after] of [
  ['start', 5],
  ['po-maszcie-1', 104, objective('mast-1')],
  ['po-helixie', 192, objective('helix')],
  ['ewakuacja', 292, objective('mast-3')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 6),
    ...(after ? { after } : {}),
  });
writeFileSync(
  'src/data/levels/m01-maszty.json',
  JSON.stringify(level, null, 2) + '\n',
);
// Fale zachowują istniejący format; posiłki masztów nadal używają missionPatrol.
for (const [id, groups] of Object.entries({
  m01Approach: [['assaulter', 2]],
  m01MastOne: [
    ['assaulter', 2],
    ['gunner', 1],
    ['turret', 1],
  ],
  m01Patrol: [
    ['assaulter', 3],
    ['gunner', 2],
  ],
  m01MastTwo: [
    ['assaulter', 3],
    ['gunner', 2],
    ['turret', 1],
  ],
  m01Assault: [
    ['assaulter', 4],
    ['gunner', 3],
  ],
  m01MastThree: [
    ['assaulter', 4],
    ['gunner', 3],
    ['turret', 2],
  ],
})) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive: 8,
    waves: [
      {
        spawnIntervalS: 0.5,
        groups: groups.map(([enemy, count]) => ({ enemy, count })),
      },
    ],
  });
  writeFileSync(
    `src/data/waves/${id}.json`,
    JSON.stringify(wave, null, 2) + '\n',
  );
}
