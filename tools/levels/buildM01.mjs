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
    exit: v(312),
  },
};
let from = 0;
for (const [
  index,
  [id, name, length, width, texture, color],
] of definitions.entries()) {
  const center = from + length / 2;
  level.sections.push({
    id,
    name,
    zone: zone(center, length, width),
    ...(index === 1
      ? { radio: 'enterNode:3' }
      : index === 3
        ? { radio: 'enterNode:5' }
        : index === 5
          ? { radio: 'enterNode:7' }
          : {}),
  });
  // Komórki podłogi pozwalają odrzucać daleką statykę, bez jednej siatki na 320 m.
  for (let x = from; x < from + length; x += 4)
    level.blocks.push(block(x + 2, -0.5, 0, 4, 1, width, 'asphalt'));
  for (const side of [-1, 1]) {
    level.blocks.push(
      block(center, 6, side * (width / 2 + 1), length, 12, 2, 'facade'),
    );
    for (let x = from + 8; x < from + length; x += 12) {
      level.blocks.push(
        block(
          x,
          0.6,
          side * (width / 2 - 2),
          2,
          1.2,
          2,
          'metal',
          index === 1 ? 'city_stall' : 'city_generator',
        ),
      );
      level.decor.push({
        model: 'city_ac_unit',
        position: v(x, 4, side * (width / 2 - 0.3)),
      });
      level.decor.push({
        model: 'city_pipe_run',
        position: v(x + 3, 0, side * (width / 2 - 0.3)),
      });
    }
    level.signs.push({
      kind: 'neon',
      texture,
      position: v(center, 4, side * (width / 2 - 0.15)),
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
    level.decor.push({
      model: 'city_street_lamp',
      position: v(from + 6, 0, side * (width / 2 - 1)),
    });
  }
  if (index > 0) {
    const previousWidth = definitions[index - 1][3];
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
  if (index === 1)
    for (const x of [from + 12, from + 32])
      level.decor.push({ model: 'city_lantern_string', position: v(x, 5) });
  if (index === 4)
    for (const side of [-1, 1]) {
      level.blocks.push(block(center, 4, side * 5.5, 24, 0.5, 2, 'metal'));
      for (const x of [center - 8, center, center + 8])
        level.lights.push({
          position: v(x, 3.3, side * 5.5),
          color: '#fff1d6',
          intensity: 16,
          range: 9,
        });
      for (const x of [center - 10, center + 10])
        level.blocks.push(block(x, 2, side * 5.5, 0.5, 4, 0.5, 'metal'));
      level.decor.push({
        model: 'city_fire_escape',
        position: v(center, 0, side * 6),
      });
    }
  if (index === 5)
    level.decor.push({
      model: 'city_holo_projector',
      position: v(center, 0, 10),
    });
  level.ambientFx.push({
    kind: 'steam',
    position: v(center + 7, 0, width / 2 - 3),
    rate: 2,
  });
  from += length;
}
level.blocks.push(block(0, 6, 0, 2, 12, 12), block(320, 6, 0, 2, 12, 12));
const encounters = [
  ['patrol-wejscie', 18, 30, 'm01Approach', undefined, 38],
  ['oslona-pierwszego', 56, 82, 'm01MastOne', encounter('patrol-wejscie'), 96],
  ['patrol-tunel', 116, 127, 'm01Patrol', objective('mast-1'), 140],
  ['oslona-drugiego', 148, 169, 'm01MastTwo', encounter('patrol-tunel'), 181],
  ['patrol-rusztowania', 200, 216, 'm01Patrol', objective('helix'), 224],
  ['patrol-plac', 234, 247, 'm01Assault', encounter('patrol-rusztowania'), 255],
  ['oslona-trzeciego', 258, 272, 'm01MastThree', encounter('patrol-plac'), 282],
];
for (const [id, trigger, spawn, wave, after, gate] of encounters) {
  const spawnPoints = [
    { x: spawn, z: -3 },
    { x: spawn, z: 3 },
    { x: spawn + 4, z: -3 },
    { x: spawn + 4, z: 3 },
  ];
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
for (const [id, x] of [
  ['mast-1', 82],
  ['mast-2', 174],
  ['mast-3', 270],
])
  level.encounters.push({
    id: `reinforce-${id}`,
    zone: zone(x, 24),
    wave: 'missionPatrol',
    spawnPoints: [
      { x: x - 7, z: -3 },
      { x: x + 6, z: 3 },
    ],
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
