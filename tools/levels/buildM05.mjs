// Generator M05 „Adiutant”; uruchom: node tools/levels/buildM05.mjs.
import { writeFileSync } from 'node:fs';

const v = (x, y = 0, z = 0) => ({ x, y, z });
const block = (x, y, z, sx, sy, sz, material = 'metal', extra = {}) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...extra,
});
const zone = (x, length, width = 24, z = 0) => ({
  kind: 'box',
  position: v(x, 3, z),
  size: v(length, 12, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const AMBER = '#ffae1a',
  GREEN = '#6dff4a',
  WHITE = '#fff1d6';
const level = {
  id: 'm05-adiutant',
  name: 'Huty — dachy i górne estakady',
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
  allies: [],
  maxAlive: 12,
  objectiveOrder: ['estakada', 'suwnice', 'ladowisko', 'karta', 'exit'],
  objectivePositions: {
    estakada: v(92),
    suwnice: v(180),
    ladowisko: v(206),
    karta: v(240, 0, 0),
    exit: v(248, 0, -7),
  },
  objectiveAfter: { karta: encounter('oslona-ladowiska') },
  objectiveNpcs: [{ objective: 'karta', spawn: v(242, 0, 0), yawDeg: -90 }],
};
const B = (...args) => level.blocks.push(block(...args));
const prop = (model, x, y, z, yaw = 0, scale = 1) =>
  level.decor.push({ model, position: v(x, y, z), yaw, scale });
const light = (x, y, z, color, intensity = 18, range = 14) =>
  level.lights.push({ position: v(x, y, z), color, intensity, range });
const sign = (x, y, z, tint = GREEN) =>
  level.signs.push({
    kind: 'neon',
    texture: 'arrow',
    position: v(x, y, z),
    size: { w: 2.4, h: 1.2 },
    yaw: -Math.PI / 2,
    tint,
  });
function floor(from, to, width, material = 'roof_tar', z = 0) {
  for (let x = from; x < to; x += 4) {
    const length = Math.min(4, to - x);
    B(x + length / 2, -0.5, z, length, 1, width, material);
  }
}
function roof(from, to, width) {
  floor(from, to, width);
  // Hale poniżej poziomu gry podkreślają wysokość bez panoramy w osi trasy.
  B((from + to) / 2, -10, 0, to - from, 18, width, 'smog_soot_wall');
  for (const s of [-1, 1]) {
    B(
      (from + to) / 2,
      0.45,
      s * (width / 2 - 0.2),
      to - from,
      0.9,
      0.4,
      'concrete',
    );
    for (let x = from + 4; x < to; x += 12) {
      light(x, 1.4, s * (width / 2 - 1), AMBER, 9, 10);
      B(x, 1.05, s * (width / 2 - 0.5), 0.25, 0.2, 0.25, 'neon_amber');
    }
  }
}
function section(id, name, from, to) {
  level.sections.push({ id, name, zone: zone((from + to) / 2, to - from, 32) });
}
function gate(id, x, after, width = 4, height = 4, z = 0) {
  level.gates.push({
    id,
    block: block(x, height / 2, z, 0.6, height, width, 'hazard_stripes_worn'),
    after,
  });
}
function ramp(from, to, y0, y1, z, width = 3) {
  const angle = Math.atan2(y1 - y0, to - from);
  B(
    (from + to) / 2 + Math.sin(angle) * 0.2,
    (y0 + y1) / 2 - Math.cos(angle) * 0.2,
    z,
    Math.hypot(to - from, y1 - y0),
    0.4,
    width,
    'steel_grating',
    { rotation: v(0, 0, angle), walkable: true },
  );
}

section('dachy', 'Dach walcowni', 0, 40);
roof(0, 40, 20);
B(-0.5, 2.5, 0, 1, 5, 20, 'concrete');
B(8, 4.5, 0, 16, 1, 8, 'corrugated');
level.rainShelters.push({ position: v(8, 2, 0), size: v(16, 4, 8) });
for (const x of [4, 12]) light(x, 3.4, 0, WHITE, 24, 12);
for (const [x, z] of [
  [22, -5],
  [30, 5],
]) {
  B(x, 1, z, 5, 2, 3, 'roof_hvac_metal');
  prop('city_ac_unit', x, 2, z);
  prop('city_vent_grate', x + 3, 0, z);
  level.ambientFx.push({ kind: 'steam', position: v(x + 3, 0.1, z), rate: 5 });
}
sign(36, 3, -4);

section('estakada', 'Estakada załadunkowa', 40, 96);
floor(40, 96, 16, 'steel_grating');
for (const s of [-1, 1]) {
  B(68, 0.45, s * 7.8, 56, 0.9, 0.3);
  for (const x of [44, 60, 80, 92]) {
    B(x, -9, s * 6, 1.2, 18, 1.2, 'crane_paint');
    light(x, 4, s * 6.5, WHITE);
  }
}
// Główna gródź po tylnej straży; skrót pod boczną roletą działa bez walki.
gate('grodz-estakada', 70, encounter('tylna-straz'));
B(70, 2.5, 5, 0.8, 5, 6, 'corrugated');
B(70, 2.5, -3.5, 0.8, 5, 3, 'corrugated');
B(70, 3.075, -6.5, 0.8, 3.85, 3, 'corrugated'); // prześwit 1,15 m
// Górne obejście na kanałach wentylacyjnych: skok na 1,6 m, drugi na 3,2 m.
B(58, 0.8, 5.5, 4, 1.6, 3, 'roof_hvac_metal');
B(63, 1.6, 5.5, 4, 3.2, 3, 'roof_hvac_metal');
B(70, 5.2, 5.5, 10, 0.4, 3, 'steel_grating', { walkable: true });
ramp(75, 84, 5.4, 0, 5.5);
sign(67, 2, -6.5);
prop('city_generator', 52, 0, 5.8);
light(69, 1, -6.5, GREEN, 9, 8);
gate('gate-estakada', 96, objective('estakada'), 16, 7);

section('maszynownia', 'Maszynownia windy dachowej', 96, 120);
roof(96, 120, 20);
for (const s of [-1, 1]) {
  B(108, 3, s * 8, 24, 6, 1, 'corrugated');
  prop('city_pipe_run', 108, 0, s * 7.4, s > 0 ? Math.PI : 0);
  B(108, 1.1, s * 5, 4, 2.2, 2, 'roof_hvac_metal');
}
B(108, 6.5, 0, 24, 1, 17, 'corrugated');
level.rainShelters.push({ position: v(108, 3, 0), size: v(24, 6, 16) });
for (const x of [100, 108, 116]) light(x, 5, 0, WHITE, 26, 12);
sign(116, 3, -4);

section('suwnice', 'Węzeł suwnic nad odlewnią', 120, 184);
// Dolny szlak z tarczownikami jest ciągły. Górne belki mają dwie luki do dasha.
floor(120, 184, 4, 'steel_grating');
for (const [from, to] of [
  [120, 132],
  [141, 151],
  [159, 184],
])
  floor(from, to, 16, 'steel_grating');
for (const x of [124, 145, 164, 180]) {
  for (const s of [-1, 1]) {
    B(x, -6, s * 7, 1, 24, 1, 'crane_paint');
    light(x, 5, s * 6, AMBER, 24, 18);
  }
  B(x, 6.5, 0, 1.2, 1, 16, 'crane_paint');
  prop('city_pipe_run', x, -4, 10);
}
ramp(121, 128, 0, 3.2, -5.5);
for (const [from, to] of [
  [128, 132],
  [141, 151],
  [159, 170],
])
  B((from + to) / 2, 3, -5.5, to - from, 0.4, 2.5, 'crane_paint', {
    walkable: true,
  });
ramp(170, 180, 3.2, 0, -5.5);
gate('grodz-suwnice', 148, encounter('tarcze-suwnic'), 4, 2.5);
sign(127, 4.5, -5.5, AMBER);
sign(175, 3, 2);
gate('gate-suwnice', 184, objective('suwnice'), 16, 7);

section('ladowisko', 'Lądowisko sektorowe', 184, 254);
roof(184, 254, 32);
for (const [x, z] of [
  [192, -5],
  [202, 6],
  [216, -6],
  [224, 6],
]) {
  B(x, 1.4, z, 3, 2.8, 3, 'roof_hvac_metal');
  prop('city_vent_grate', x, 2.8, z);
  level.ambientFx.push({ kind: 'steam', position: v(x, 3, z), rate: 4 });
}
// Gzymsy nad lądowiskiem; wejścia rampami również dla ruchu gracza.
for (const s of [-1, 1]) {
  B(220, 3.75, s * 12, 20, 0.5, 4, 'concrete', { walkable: true });
  ramp(200, 210, 0, 4, s * 12, 4);
  ramp(230, 240, 4, 0, s * 12, 4);
  light(221, 5.5, s * 11, WHITE, 30, 18);
}
// Oznaczenie H na płycie — ciepła biel, bez zarezerwowanych barw.
for (const z of [-3, 3]) B(220, 0.03, z, 8, 0.03, 0.35, 'light_white');
B(220, 0.03, 0, 0.35, 0.03, 6, 'light_white');
level.signs.push({
  kind: 'holo',
  texture: 'holo_kurogane',
  position: v(246, 7, 14),
  size: { w: 8, h: 4 },
  yaw: Math.PI,
  tint: '#3d7bff',
});
light(246, 5, -13, '#8a5cff', 18, 16);
// Reling poddania i oznaczona droga do szybu ewakuacyjnego.
B(244, 0.6, 1.5, 5, 1.2, 0.2, 'metal');
sign(245, 2.8, -5);
prop('city_shutter', 252.8, 0, -7, -Math.PI / 2);
light(248, 3, -7, GREEN, 14, 10);
B(254.5, 3, 0, 1, 6, 32, 'concrete');
gate('gate-ewakuacja', 246, objective('karta'), 4, 4, -7);

for (const [id, x, after] of [
  ['start', 5],
  ['maszynownia', 92, objective('estakada')],
  ['podejscie', 180, objective('suwnice')],
  ['ladowisko', 206, objective('ladowisko')],
  ['karta', 240, objective('karta')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 8, 32),
    ...(after ? { after } : {}),
  });

for (const [id, x, length, wave, points, after] of [
  [
    'tylna-straz',
    50,
    18,
    'm05RearGuard',
    [
      [60, 0],
      [64, 2],
      [66, -2],
    ],
  ],
  [
    'tarcze-suwnic',
    134,
    24,
    'm05Shields',
    [
      [145, 0],
      [149, 0],
      [164, 4],
    ],
    objective('estakada'),
  ],
  [
    'snajperzy',
    210,
    24,
    'm05Snipers',
    [
      [218, -12],
      [224, 12],
    ],
    objective('suwnice'),
  ],
  [
    'oslona-ladowiska',
    218,
    72,
    'm05Escort',
    [
      [222, -3],
      [226, 3],
      [232, 0],
    ],
    encounter('snajperzy'),
  ],
])
  level.encounters.push({
    id,
    zone: zone(x, length, 32),
    wave,
    spawnPoints: points.map(([px, z]) => ({ x: px, z })),
    ...(id === 'snajperzy' ? { spawnHeightM: 4 } : {}),
    ...(after ? { after } : {}),
  });

writeFileSync(
  'src/data/levels/m05-adiutant.json',
  JSON.stringify(level, null, 2) + '\n',
);
for (const [id, groups] of [
  [
    'm05RearGuard',
    [
      ['assaulter', 2],
      ['gunner', 1],
      ['turret', 1],
    ],
  ],
  [
    'm05Shields',
    [
      ['shielder', 2],
      ['drone', 2],
    ],
  ],
  ['m05Snipers', [['sniper', 2]]],
  [
    'm05Escort',
    [
      ['assaulter', 3],
      ['gunner', 2],
    ],
  ],
])
  writeFileSync(
    `src/data/waves/${id}.json`,
    JSON.stringify(
      {
        id,
        firstBreakS: 0,
        breakS: 0,
        maxAlive: 8,
        minSpawnDistance: 3,
        spawnPoints: [{ x: 0, z: 0 }],
        waves: [
          {
            spawnIntervalS: 0.4,
            groups: groups.map(([enemy, count]) => ({ enemy, count })),
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );
