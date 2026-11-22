// Uruchomienie z katalogu repo: node tools/levels/buildM04.mjs.
import { writeFileSync } from 'node:fs';
const v = (x, y = 0, z = 0) => ({ x, y, z });
const block = (x, y, z, sx, sy, sz, material = 'metal') => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
});
const zone = (x, length, width = 24) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const ID = 'm04-ladunek-klasy-k';
const level = {
  id: ID,
  name: 'Huty — bocznice klasy K',
  type: 'combat',
  theme: 'neonStreet',
  playerSpawn: v(12, 0, 4),
  blocks: [],
  spawnPoints: [],
  signs: [],
  lights: [],
  decor: [],
  decals: [],
  ambientFx: [],
  rainShelters: [],
  sections: [],
  checkpoints: [],
  encounters: [],
  gates: [],
  maxAlive: 12,
  allies: [{ id: 'szron', spawn: v(10, 0, -4) }],
  objectiveOrder: [
    'barricade',
    'laser',
    'switch-1',
    'carts',
    'switch-2',
    'executor',
    'payload',
    'exit',
  ],
  objectivePositions: {
    barricade: v(43, 0, 4),
    laser: v(68, 0, 4),
    'switch-1': v(85, 0, -4),
    carts: v(123, 0, 4),
    'switch-2': v(143, 0, -4),
    executor: v(192),
    payload: v(240),
    exit: v(249, 0, 4),
  },
  payload: {
    objective: 'payload',
    route: [v(12), v(240)],
    stops: [
      ['barricade', 'Barykada załadunkowa', 28, 'barricade'],
      ['laser', 'Rogatka laserowa', 53, 'laser'],
      ['switch-1', 'Pierwsza zwrotnica', 70, 'switch-1'],
      ['carts', 'Wózki na rozjeździe', 108, 'carts'],
      ['switch-2', 'Druga zwrotnica', 128, 'switch-2'],
      ['executor', 'Oddział Brandta', 174, 'executor'],
    ].map(([id, name, atM, unlockAfter]) => ({ id, name, atM, unlockAfter })),
  },
};
const B = (...args) => level.blocks.push(block(...args));
const decor = (model, x, z, yaw = 0, y = 0) =>
  level.decor.push({ model, position: v(x, y, z), yaw });
const light = (x, y, z, color, intensity = 18, range = 15) =>
  level.lights.push({ position: v(x, y, z), color, intensity, range });
const sections = [
  ['nastawnia', 'Nastawnia rozrządowa', 0, 56, 20],
  ['rogatka', 'Brama towarowa i rogatka', 56, 104, 24],
  ['wschodni', 'Rozjazd wschodni', 104, 164, 28],
  ['rozjazd', 'Rozjazd zjazdowy', 164, 220, 28],
  ['tunel', 'Tunel techniczny Niecki', 220, 260, 14],
];
for (const [id, name, from, to, width] of sections) {
  level.sections.push({
    id,
    name,
    zone: zone((from + to) / 2, to - from, width),
  });
  for (let x = from; x < to; x += 4) B(x + 2, -0.5, 0, 4, 1, width, 'asphalt');
  for (const s of [-1, 1]) {
    B((from + to) / 2, 5, s * (width / 2 + 1), to - from, 10, 2, 'concrete');
    for (let x = from + 10; x < to - 4; x += 16) {
      decor('city_pipe_run', x, s * (width / 2 - 0.3), s > 0 ? Math.PI : 0);
      light(x, 5, s * (width / 2 - 1), '#fff1d6');
      if (id !== 'tunel') {
        B(x, 0.6, s * 7, 3, 1.2, 1.5, 'trim');
        decor('city_crates', x + 5, s * 8);
      }
    }
  }
  if (id === 'tunel' || id === 'nastawnia') {
    const length = id === 'tunel' ? to - from : 24;
    const center = from + length / 2;
    B(center, 6.5, 0, length, 1, width, 'concrete');
    level.rainShelters.push({
      position: v(center, 3),
      size: v(length, 6, width),
    });
    for (let x = from + 4; x < from + length; x += 8)
      light(x, 5.5, 0, '#fff1d6', 28, 12);
  }
}
B(-1, 5, 0, 2, 10, 24, 'concrete');
B(261, 5, 0, 2, 10, 18, 'concrete');
// Szyny i podkłady poniżej progu kapsuły; wolna droga serwisowa po obu stronach.
for (let x = 2; x < 260; x += 4) {
  B(x, 0.025, 0, 0.3, 0.05, 3.5, 'rust');
  for (const s of [-1, 1]) B(x, 0.07, s * 1.1, 4, 0.08, 0.12, 'metal');
}
for (const x of [36, 62, 104, 156, 178, 220]) {
  decor('rail_signal_gantry', x, 0);
  light(x, 5, 0, '#ffae1a', 14, 12);
}
for (const x of [88, 146]) {
  decor('city_generator', x, -7);
  light(x, 2, -6, '#6dff4a', 8, 8);
  // Odgałęzienie bocznicy: tylko dekoracyjna geometria poza torem głównym.
  for (const z of [5.5, 7.7]) B(x + 5, 0.07, z, 20, 0.08, 0.12, 'metal');
}
for (const x of [30, 114, 170, 208]) {
  decor('city_vent_grate', x, -5);
  level.ambientFx.push({ kind: 'steam', position: v(x, 0.05, -5), rate: 4 });
  level.decals.push({
    texture: 'puddle2',
    position: v(x, 0.01, 4),
    size: { w: 4, h: 2 },
    surface: 'floor',
    yaw: 0,
  });
  light(x, 6, -9, '#3d7bff', 10, 12);
}
for (const [id, x, material] of [
  ['barricade', 50, 'hazard_stripes_worn'],
  ['laser', 75, 'neon_amber'],
  ['switch-1', 92, 'hazard_stripes_worn'],
  ['carts', 130, 'metal'],
  ['switch-2', 150, 'hazard_stripes_worn'],
  ['executor', 204, 'hazard_stripes_worn'],
  ['payload', 246, 'hazard_stripes_worn'],
]) {
  const width = sections.find(([, , from, to]) => x >= from && x < to)[4];
  // Przegroda zamyka całą szerokość, w osi pozostaje 12 m na wagon i eskortę.
  for (const s of [-1, 1])
    B(x, 4, s * (6 + (width / 2 - 6) / 2), 1, 8, width / 2 - 6, 'concrete');
  level.gates.push({
    id: `gate-${id}`,
    block: block(x, 2.5, 0, 0.4, 5, 12, material),
    after: objective(id),
  });
}
const encounters = [
  [
    'patrol',
    27,
    18,
    'm04Patrol',
    [
      ['assaulter', 2],
      ['gunner', 1],
    ],
  ],
  [
    'rogatka',
    61,
    12,
    'm04Gate',
    [
      ['shielder', 1],
      ['gunner', 2],
      ['turret', 1],
    ],
    'barricade',
  ],
  [
    'wschodni',
    112,
    16,
    'm04Junction',
    [
      ['assaulter', 2],
      ['shielder', 1],
      ['drone', 2],
    ],
    'switch-1',
  ],
  [
    'executor',
    178,
    20,
    'm04Executor',
    [
      ['executor', 1],
      ['gunner', 2],
      ['drone', 1],
    ],
    'switch-2',
  ],
];
for (const [id, x, length, wave, groups, after] of encounters) {
  const spawnPoints = [
    { x: x + 12, z: -5 },
    { x: x + 16, z: 5 },
    { x: x + 20, z: -4 },
  ];
  level.encounters.push({
    id,
    zone: zone(x, length, 28),
    wave,
    spawnPoints,
    ...(after ? { after: objective(after) } : {}),
    ...(id === 'executor' ? { bossFor: 'executor' } : {}),
  });
  level.spawnPoints.push(...spawnPoints);
  writeFileSync(
    `src/data/waves/${wave}.json`,
    JSON.stringify(
      {
        id: wave,
        firstBreakS: 1,
        breakS: 1,
        maxAlive: 6,
        minSpawnDistance: 0,
        spawnPoints,
        waves: [
          {
            spawnIntervalS: 0.8,
            groups: groups.map(([enemy, count]) => ({ enemy, count })),
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );
}
for (const [id, x, distance, after] of [
  ['start', 12, 0],
  ['za-rogatka', 100, 84, 'switch-1'],
  ['przed-rozjazdem', 160, 144, 'switch-2'],
  ['tunel', 224, 208, 'executor'],
])
  level.checkpoints.push({
    id,
    position: v(x, 0, 4),
    yawDeg: -90,
    zone: zone(x, 6, 28),
    payloadDistanceM: distance,
    ...(after ? { after: objective(after) } : {}),
  });
writeFileSync(
  `src/data/levels/${ID}.json`,
  JSON.stringify(level, null, 2) + '\n',
);
console.log(
  `M04: ${level.sections.length} sekcji, ${level.encounters.length} spotkania, ${level.blocks.length} bloków.`,
);
