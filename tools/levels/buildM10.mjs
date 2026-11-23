// M10: node tools/levels/buildM10.mjs (z katalogu repozytorium).
import { readFileSync, writeFileSync } from 'node:fs';

const ID = 'm10-archiwum';
const v = (x, y = 0, z = 0) => ({ x, y, z });
const zone = (x, length, z = 0, width = 24) => ({
  kind: 'box',
  position: v(x, 5, z),
  size: v(length, 18, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const level = {
  id: ID,
  name: 'Taras — stare archiwum Helixy',
  type: 'combat',
  theme: 'neonStreet',
  playerSpawn: v(5),
  maxAlive: 12,
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
  objectiveOrder: ['sluza', 'transfer', 'rdzen', 'exit'],
  objectivePositions: {
    sluza: v(150, 4),
    transfer: v(178, 4),
    rdzen: v(188, 4),
    exit: v(244),
  },
  objectiveAfter: {
    sluza: encounter('straz-archiwum'),
    exit: encounter('blokada-szybu'),
  },
};
const block = (x, y, z, sx, sy, sz, material = 'concrete', extra = {}) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...extra,
});
const B = (...args) => level.blocks.push(block(...args));
const prop = (model, x, y, z, yaw = 0, scale) =>
  level.decor.push({ model, position: v(x, y, z), yaw, scale });
const WHITE = '#dce8ff',
  GREEN = '#6dff4a';
const light = (x, y, z, color = WHITE, intensity = 32, range = 16, floorY) =>
  level.lights.push({ position: v(x, y, z), color, intensity, range, floorY });
function panel(texture, x, y, z, side, width = 2) {
  level.signs.push({
    kind: 'neon',
    texture,
    position: v(x, y, z),
    size: { w: width, h: width * 0.4 },
    yaw: side > 0 ? Math.PI : 0,
    tint: GREEN,
  });
}
function marking(texture, x, y, z, w, h, yaw = -Math.PI / 2, opacity) {
  level.decals.push({
    texture,
    position: v(x, y + 0.012, z),
    size: { w, h },
    yaw,
    opacity,
    surface: 'floor',
  });
}
function ramp(start, end, fromY, toY, width = 8) {
  const angle = Math.atan2(toY - fromY, end - start);
  B(
    (start + end) / 2 + Math.sin(angle) * 0.2,
    (fromY + toY) / 2 - Math.cos(angle) * 0.2,
    0,
    Math.hypot(end - start, toY - fromY),
    0.4,
    width,
    start === 96 ? 'overpass_street' : 'steel_grating',
    { rotation: v(0, 0, angle), walkable: true },
  );
}
function gate(id, x, after, y = 0, width = 24) {
  level.gates.push({
    id,
    block: block(x, y + 4, 0, 0.4, 8, width, 'hazard_stripes_worn'),
    after,
  });
}
function cover(x, y, z) {
  B(x, y + 0.55, z, 3, 1.1, 1.2, 'metal');
  prop('city_barrier', x, y, z);
}

// Dolny poziom techniczny pozostaje ciągły także pod galerią, jak w M03.
for (const [id, name, start, end, width, roof] of [
  ['winda', 'Winda towarowa', 0, 28, 10, 6],
  ['pasaz', 'Pasaż Tarasu', 28, 96, 24, 0],
  ['wieza', 'Wieża badawcza', 96, 156, 24, 13],
  ['archiwum', 'Serwerownia archiwum', 156, 204, 28, 13],
  ['szyb', 'Szyb techniczny', 204, 252, 16, 12],
]) {
  const center = (start + end) / 2;
  const promenade = id === 'pasaz' || id === 'wieza';
  level.sections.push({ id, name, zone: zone(center, end - start, 0, width) });
  for (let x = start; x < end; x += 4)
    B(x + 2, -0.5, 0, 4, 1, width, promenade ? 'overpass_street' : 'concrete');
  for (const side of [-1, 1]) {
    B(
      center,
      roof ? roof / 2 : 1,
      side * (width / 2 + 0.4),
      end - start,
      roof || 2,
      0.8,
      'metal',
      id === 'wieza' ? { visible: false } : {},
    );
    // Niewidoczna bariera krawędzi pasażu nad przepaścią.
    if (!roof)
      B(center, 5, side * (width / 2 + 0.5), end - start, 10, 0.2, 'concrete', {
        visible: false,
      });
  }
  if (roof) {
    B(
      center,
      roof + 0.25,
      0,
      end - start,
      0.5,
      width + 1,
      'metal',
      id === 'wieza' ? { visible: false } : {},
    );
    level.rainShelters.push({
      position: v(center, roof / 2),
      size: v(end - start, roof, width),
    });
  }
  for (let x = start + 6; x < end; x += 10) {
    const floorY = Math.min(
      4,
      Math.max(0, (x - 96) / 4),
      Math.max(0, (220 - x) / 4),
    );
    if (promenade) {
      const side = (x - start - 6) % 20 === 0 ? 1 : -1;
      // Po bokach wąskiej rampy posadzka techniczna nadal ma wysokość 0.
      const edgeY = x < 112 ? 0 : 4;
      prop('city_street_lamp', x, edgeY, side * 7.4, side > 0 ? Math.PI : 0);
      light(x, edgeY + 4.25, side * 7.1, WHITE, 13, 8, edgeY);
    } else light(x, floorY + 3.8, 0, WHITE, 32, 16, floorY);
    if (floorY === 0 || floorY === 4)
      marking('floor_arrow', x, floorY, 0, 2, 2);
  }
}
B(-0.5, 4, 0, 1, 8, 12, 'metal');
B(252.5, 6, 0, 1, 12, 18, 'metal');
prop('city_shutter', 0.1, 0, 0, Math.PI / 2);
prop('city_generator', 17, 0, -3.5);
prop('city_pipe_run', 12, 0, 4.5);
light(24, 4, 0, '#3d7bff', 18);

// Pasaż: przeszklone ogrody po bokach, środek to strefa alarmowa,
// cichy pas z=-8 prowadzi za osłonami aż do rampy wieży.
for (const x of [40, 58, 76]) {
  for (const side of [-1, 1]) {
    B(x, 2.4, side * 10, 10, 0.2, 3, 'glass');
    B(x - 5, 1.2, side * 10, 0.2, 2.4, 3, 'metal');
    B(x + 5, 1.2, side * 10, 0.2, 2.4, 3, 'metal');
    light(x, 2, side * 10, GREEN, 12, 7);
    prop('city_ac_unit', x, 0, side * 11);
    const yaw = side > 0 ? Math.PI : 0;
    prop('city_sign_box', x, 1.1, side * 11.95, yaw);
    panel('implants', x, 1.6, side * 11.66, side, 1.8);
    prop('city_vent_grate', x - 2, 0, side * 10);
    prop('city_ad_screen', x + 3, 0, side * 11.95, yaw);
    // Koryta ogrodowe na zewnętrznej stronie parapetu, pod przeszklonym dachem.
    B(x, 1.55, side * 13.2, 7, 1.2, 2, 'concrete_raw_cast');
    B(x, 2.16, side * 13.2, 6.6, 0.08, 1.65, 'excavation_dirt');
    // Strzyżone, schodkowe żywopłoty ponad parapetem.
    for (const dx of [-2, 0, 2]) {
      const height = dx === 0 ? 1.35 : 0.85;
      B(
        x + dx,
        2.2 + height / 2,
        side * 13.2,
        1.85,
        height,
        1.2,
        'container_olive',
      );
    }
    level.ambientFx.push({
      kind: 'steam',
      position: v(x - 2, 0.07, side * 10),
      rate: 1,
    });
  }
  cover(x, 0, -5.5);
  cover(x + 6, 0, 4.5);
}
for (const x of [32, 66, 88]) panel('arrow', x, 1.4, -11.94, -1);

// Zatoki przy obu krawędziach. Siedziska z ażurowych modułów na stalowych stopach.
for (const [i, x] of [
  32, 42, 52, 62, 72, 82, 92, 104, 116, 125, 134, 143, 152,
].entries()) {
  const y = x < 112 ? 0 : 4;
  const side = i % 2 === 0 ? -1 : 1;
  const z = side * 9;
  if (i % 3 === 0) {
    for (const dx of [-0.7, 0.7]) prop('port_bollard', x + dx, y, z, 0, 0.6);
    for (const dx of [-0.76, 0, 0.76])
      prop('city_vent_grate', x + dx, y + 0.36, z, 0, 0.76);
  } else if (i % 3 === 1) prop('city_kiosk', x, y, z, -Math.PI / 2);
  else prop('city_barrier', x, y, z);
  marking('manhole', x + 1, y, -side * 6.2, 1.1, 1.1);
  marking(
    i % 2 ? 'puddle1' : 'puddle2',
    x - 1.4,
    y,
    -side * (4.9 + (i % 3) * 0.35),
    1.5,
    3.7,
    -1.25,
    0.58,
  );
  marking('floor_hazard', x, y, side * 5.5, 0.48, 5, -Math.PI / 2, 0.52);
  if (i % 3 === 1) marking('floor_arrow', x + 3, y, side * 5.5, 1.6, 2.6);
}

// Monogram H widziany z kierunku marszu: dwa trzony i poprzeczka z farby drogowej.
for (const [x, y] of [
  [55, 0],
  [86, 0],
  [120, 4],
  [145, 4],
]) {
  for (const z of [-0.9, 0.9])
    marking('floor_hazard', x, y, z, 0.5, 3.8, -Math.PI / 2, 0.8);
  marking('floor_hazard', x, y, 0, 0.45, 2.3, 0, 0.8);
}

// Fasady stoją za kolizją ścian. Prześwity między przęsłami otwierają widok na miasto.
for (const x of [36, 61, 85, 106, 128, 148]) {
  for (const side of [-1, 1]) {
    const base = x >= 112 ? 4 : 0;
    const z = side * 14.8;
    B(x, base + 3.7, z, 9, 7.4, 2.2, 'facade');
    for (const dx of [-2.8, 0, 2.8])
      B(
        x + dx,
        base + 5.9,
        z - side * 1.12,
        2,
        1,
        0.08,
        dx === 0 ? 'neon_amber' : 'light_white',
      );
    prop(
      'city_ad_screen',
      x - 2,
      base + 2.5,
      side * 13.65,
      side > 0 ? Math.PI : 0,
      1.25,
    );
    // Zielony szyld H na licu, z dala od korytarza ruchu.
    for (const dx of [1.3, 2.5])
      B(x + dx, base + 4, side * 13.64, 0.25, 1.8, 0.12, 'neon_green');
    B(x + 1.9, base + 4, side * 13.64, 1, 0.24, 0.12, 'neon_green');
  }
}

// Dwa plany zabudowy widoczne nad niskimi parapetami pasażu.
for (const [x, z, width, top] of [
  [30, -28, 12, 16],
  [53, -37, 17, 29],
  [77, -25, 14, 19],
  [99, -33, 15, 35],
  [34, 32, 18, 24],
  [61, 24, 12, 14],
  [83, 36, 17, 30],
  [104, 26, 13, 20],
  [124, -29, 15, 24],
  [139, 32, 18, 33],
  [160, -26, 14, 28],
  [172, 25, 13, 24],
  [193, -37, 19, 39],
  [202, 38, 16, 32],
]) {
  const side = Math.sign(z);
  B(x, (top - 10) / 2, z, width, top + 10, 8, 'facade');
  B(x, top, z, width + 0.4, 0.4, 8.4, 'trim');
  prop('city_roof_hvac_unit', x, top + 0.2, z);
  if (x >= 124) {
    // Zachodnia ściana jest skierowana wprost na gracza idącego ku śluzie.
    for (let y = 7; y < top - 2; y += 5)
      B(x - width / 2, y, z, 0.12, 0.7, 5.8, 'light_white');
    B(x - width / 2, top - 1, z, 0.14, 0.28, 8, 'neon_green');
  }
  for (let y = 4; y < top - 1; y += 5)
    for (const dx of [-width / 4, width / 4])
      B(
        x + dx,
        y,
        z - side * 4,
        width / 4,
        0.6,
        0.15,
        dx < 0 ? 'glass' : 'light_white',
      );
}
// Korona wieży wyrasta ponad śluzą. Dolny znak na nadprożu widać spod samej bramy.
B(163, 20.5, 0, 14, 14, 15, 'facade');
B(163, 30, 0, 10, 5, 10, 'metal');
for (const y of [15, 18, 26.5]) B(155.94, y, 0, 0.12, 0.35, 15, 'neon_green');
for (const [x, y, scale] of [
  [155.86, 22, 1],
  [155.55, 10.6, 0.54],
]) {
  for (const side of [-1, 1])
    B(x, y, side * 1.55 * scale, 0.08, 4.5 * scale, 0.55 * scale, 'neon_green');
  B(x, y, 0, 0.08, 0.55 * scale, 2.8 * scale, 'light_white');
}

// Widoczna rama ogrodu i rynny.
for (const x of [46, 70]) {
  B(x, 7, 0, 0.3, 0.3, 24, 'metal');
  for (const z of [-11.7, 11.7]) B(x, 3.5, z, 0.3, 7, 0.3, 'metal');
  level.ambientFx.push({ kind: 'drip', position: v(x, 6.8, 11.4), rate: 3 });
}

// Wieża: obowiązkowy podjazd do galerii +4 m i piony instalacyjne.
ramp(96, 112, 0, 4);
for (let x = 112; x < 204; x += 4)
  B(
    x + 2,
    3.75,
    0,
    4,
    0.5,
    x < 156 ? 24 : 28,
    x < 156 ? 'overpass_street' : 'steel_grating',
    {
      walkable: true,
    },
  );
for (const x of [116, 132, 148]) {
  for (const z of [-10, 10]) {
    B(x, 6.5, z, 0.6, 13, 0.6, 'metal');
    prop('city_pipe_run', x, 4, z);
    const side = Math.sign(z);
    // Fragment starej ściany za ekranami mieści się w jej pierwotnej bryle.
    B(x, 4.6, side * 12.4, 7, 9.2, 0.8, 'facade');
    const yaw = side > 0 ? Math.PI : 0;
    prop('city_ad_screen', x - 2, 5, side * 11.95, yaw);
    prop('city_cable_span', x, 10, side * 11.6);
    prop('city_sign_box', x + 2, 6, side * 11.95, yaw);
    panel(
      x === 148 ? 'arrow' : 'implants',
      x + 2,
      6.5,
      side * 11.66,
      side,
      1.8,
    );
    light(x, 7.5, side * 8.5, GREEN, 14, 8, 4);
  }
}
cover(124, 4, -4.5);
cover(138, 4, 4.5);
// Śluza ma pełne przegrody na obu kondygnacjach; brama odblokowuje ją po panelu.
for (const z of [-8, 8]) B(156, 6, z, 1, 12, 8, 'metal');
// Prześwit instalacyjny 20 cm pod grodzią; za mały dla kapsuły.
B(156, 2.1, 0, 1, 3.8, 8, 'metal');
B(156, 10.5, 0, 1, 3, 8, 'metal', { visible: false });
B(156.05, 10.5, 0, 0.9, 3, 8, 'metal');
gate('gate-archiwum', 156, objective('sluza'), 4, 8);
light(150, 7, 0, '#ffae1a', 18, 12);

// Szafy archiwum: środek i krąg transferu zostają wolne, boki dają osłony.
for (const x of [164, 172, 184, 196]) {
  for (const z of [-9, 9]) {
    B(x, 5.5, z, 2.4, 3, 2, 'metal');
    const side = Math.sign(z);
    const yaw = side > 0 ? Math.PI : 0;
    // Drzwi serwisowe i panel stanu na licu istniejącej szafy.
    prop('city_shutter', x, 4, z - side * 1.02, yaw, 0.74);
    prop('city_sign_box', x, 6.12, z - side * 1.02, yaw, 0.84);
    panel('repair', x, 6.54, z - side * 1.25, side, 1.5);
    prop('city_cable_span', x, 9.5, side * 13.6);
    light(x, 7.8, z - side * 2, WHITE, 18, 12, 4);
  }
}
for (const [x, z] of [
  [170, -4.5],
  [182, 5],
  [194, -4.5],
])
  cover(x, 4, z);
// Rdzeń obok jasnego znacznika celu, żeby collider nie zasłaniał interakcji.
B(188, 6, -3, 2.2, 4, 2.2, 'metal');
prop('city_pipe_run', 188, 4, -4.3);
light(188, 7, -2, '#ffae1a', 20, 12);
gate('gate-szyb', 204, objective('rdzen'), 0, 28);

// Zejście serwisowe po rampie w otwartym pionie, potem dolny pomost wyjściowy.
ramp(204, 220, 4, 0);
for (const z of [-6.5, 6.5]) {
  B(212, 6, z, 1, 12, 1, 'metal');
  prop('city_pipe_run', 230, 0, z);
}
cover(228, 0, -4);
cover(234, 0, 4);
gate('gate-ewakuacja', 240, encounter('blokada-szybu'), 0, 16);
light(244, 4, 0, '#6dff4a', 22, 14);
prop('city_shutter', 251.8, 0, 0, -Math.PI / 2);
for (const [x, y, z, texture, w, h] of [
  [9, 0, 2, 'oil_stain', 2, 1.8],
  [25, 0, 0, 'floor_stop', 3, 1],
  [34, 0, -7, 'floor_hazard', 3, 1],
  [49, 0, 3, 'manhole', 1.4, 1.4],
  [69, 0, -4, 'crack_floor', 3, 2],
  [93, 0, 0, 'floor_hazard', 3, 1],
  [115, 4, 2, 'floor_hazard', 3, 1],
  [130, 4, -3, 'oil_stain', 2, 2],
  [153, 4, 0, 'floor_stop', 3, 1],
  [162, 4, 5, 'floor_hazard', 3, 1],
  [190, 4, -5, 'oil_stain', 2, 1.5],
  [202, 4, 0, 'floor_hazard', 3, 1],
  [225, 0, 2, 'tire_marks', 4, 2],
  [238, 0, -2, 'floor_stop', 3, 1],
])
  marking(texture, x, y, z, w, h);
for (const [kind, x, y, z] of [
  ['drip', 12, 2, 4.4],
  ['sparks', 132, 9.2, -11.6],
  ['sparks', 184, 8.7, 13.6],
  ['drip', 230, 2, -6.5],
])
  level.ambientFx.push({ kind, position: v(x, y, z), rate: 1 });

const points = (list) => list.map(([x, z]) => ({ x, z }));
const addEncounter = (id, trigger, wave, spawns, extra = {}) =>
  level.encounters.push({
    id,
    zone: trigger,
    wave,
    spawnPoints: points(spawns),
    ...extra,
  });
addEncounter('alarm-pasaz', zone(62, 54, 1, 9), 'm10Patrol', [
  [82, 2],
  [88, -2],
]);
addEncounter(
  'straz-archiwum',
  zone(130, 24),
  'm10Guard',
  [
    [142, -7],
    [144, 7],
    [146, 0],
  ],
  { spawnHeightM: 4 },
);
addEncounter(
  'transfer-1',
  zone(178, 30),
  'm10Transfer',
  [
    [160, -3],
    [160, 3],
  ],
  { spawnHeightM: 4, reinforcementFor: 'transfer:0' },
);
addEncounter(
  'transfer-2',
  zone(178, 30),
  'm10Commander',
  [
    [198, -3],
    [198, 3],
  ],
  { spawnHeightM: 4, reinforcementFor: 'transfer:1' },
);
addEncounter(
  'poscig',
  zone(186, 36),
  'm10Pursuit',
  [
    [162, -2],
    [162, 2],
  ],
  { spawnHeightM: 4, reinforcementFor: 'rdzen', after: objective('rdzen') },
);
addEncounter(
  'blokada-szybu',
  zone(228, 20, 0, 16),
  'm10Exit',
  [
    [236, -5],
    [236, 5],
  ],
  { after: objective('rdzen') },
);
level.spawnPoints = [
  { x: 82, z: 2 },
  { x: 236, z: -5 },
];
for (const [id, x, y, after] of [
  ['start', 5, 0],
  ['pasaz', 30, 0],
  ['wieza', 114, 4],
  ['archiwum', 160, 4, objective('sluza')],
  ['szyb', 222, 0, objective('rdzen')],
])
  level.checkpoints.push({
    id,
    position: v(x, y),
    yawDeg: -90,
    zone: zone(x, 4),
    ...(after ? { after } : {}),
  });

const write = (path, data) =>
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
write(`src/data/levels/${ID}.json`, level);
if (process.argv.includes('--level-only')) process.exit(0);
for (const [id, groups] of [
  [
    'm10Patrol',
    [
      ['sniper', 2],
      ['drone', 1],
    ],
  ],
  [
    'm10Guard',
    [
      ['sniper', 2],
      ['turret', 2],
    ],
  ],
  [
    'm10Transfer',
    [
      ['gunner', 2],
      ['shielder', 1],
    ],
  ],
  [
    'm10Commander',
    [
      ['executor', 1],
      ['gunner', 2],
    ],
  ],
  [
    'm10Pursuit',
    [
      ['shielder', 1],
      ['gunner', 2],
    ],
  ],
  [
    'm10Exit',
    [
      ['sniper', 2],
      ['drone', 2],
    ],
  ],
])
  write(`src/data/waves/${id}.json`, {
    id,
    firstBreakS: 1,
    breakS: 0,
    maxAlive: 6,
    minSpawnDistance: 4,
    spawnPoints: [{ x: 0, z: 0 }],
    waves: [
      {
        spawnIntervalS: 0.5,
        groups: groups.map(([enemy, count]) => ({ enemy, count })),
      },
    ],
  });

// Dialogi pozostają dosłownym wyborem ze źródła treści.
const source = readFileSync('docs/fabula/misje/misja-10-archiwum.md', 'utf8')
  .split('## Dialogi')[1]
  .split('## Nagrody')[0];
const dialogue = (heading) =>
  source
    .split(heading)[1]
    .split('### ')[0]
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\*\*(\p{L}+)(?: \([^\n]+\))?:\*\* (.+)$/u);
      return match ? [{ speaker: match[1].toLowerCase(), text: match[2] }] : [];
    });
const briefing = dialogue('### Odprawa (kryjówka)');
const radio = dialogue('### W trakcie misji (radio)');
const debrief = dialogue('### Po misji (kryjówka)');
const message = (trigger, lines, priority = 'tactical') => ({
  trigger,
  priority,
  lines,
});
write(`src/data/missions/${ID}.json`, {
  id: ID,
  number: 10,
  title: 'Archiwum',
  act: 2,
  level: ID,
  sectorId: 'kurogane',
  summary:
    'Samotna infiltracja wieży Helixy na Tarasie: otwórz archiwum, pobierz równania potrzebne Tymonowi, zniszcz rdzeń i ucieknij szybem. Bajt prowadzi przez radio, a nagłówki danych ujawnią sekret Wolan.',
  // M09 powstaje w innym worktree; walidator wymaga istniejącej definicji.
  requires: ['m09-brat'],
  layers: 7,
  enemies: ['sniper', 'turret', 'gunner', 'shielder', 'executor', 'drone'],
  fixedNodes: [
    {
      layer: 7,
      type: 'combat',
      roomId: 'combatSubstation',
      objectives: level.objectiveOrder,
      final: true,
    },
  ],
  objectives: [
    {
      id: 'sluza',
      kind: 'interact',
      label: 'Otwórz serwerownię archiwum',
      position: level.objectivePositions.sluza,
      holdS: 2,
      unlockAfter: [],
    },
    {
      id: 'transfer',
      kind: 'defend',
      label: 'Podepnij nośnik i utrzymaj salę',
      position: level.objectivePositions.transfer,
      radiusM: 6,
      holdS: 2,
      durationS: 30,
      checkpoints: [0.5],
      waves: [
        { atProgress: 0.1, wave: 'm10Transfer' },
        { atProgress: 0.5, wave: 'm10Commander' },
      ],
    },
    {
      id: 'rdzen',
      kind: 'sabotage',
      label: 'Zniszcz rdzeń archiwum',
      position: level.objectivePositions.rdzen,
      holdS: 3,
      fuseS: 5,
      blastRadiusM: 4,
      blastDamage: 80,
      reinforcements: 'm10Pursuit',
    },
    {
      id: 'exit',
      kind: 'exit',
      label: 'Zjedź szybem technicznym',
      position: level.objectivePositions.exit,
      holdS: 3,
      unlockAfter: ['rdzen'],
    },
  ],
  briefing: [briefing[0], briefing[7], briefing[10]],
  debrief: [
    debrief[2],
    debrief[9],
    debrief[13],
    debrief[15],
    debrief[16],
    debrief[18],
  ],
  radio: [
    message('runStart', radio.slice(0, 2)),
    message('enterSection:pasaz', [...briefing.slice(1, 4)], 'story'),
    message('checkpoint:pasaz', briefing.slice(4, 7), 'story'),
    // Przekaźnik jest celem opcjonalnym poza zakresem: nie obiecujemy graczowi interakcji.
    message('encounter:alarm-pasaz:started', radio.slice(2, 3)),
    message('enterSection:wieza', briefing.slice(8, 10), 'story'),
    message('checkpoint:wieza', radio.slice(4, 6)),
    message('objective:transfer:started', radio.slice(6, 8)),
    message('objective:transfer:progress:50', radio.slice(8, 15)),
    message('objective:transfer:done', radio.slice(15, 17)),
    message('enterSection:szyb', radio.slice(17)),
  ],
  rewards: { firstClear: { data: 120, cores: 2 } },
});
console.log(
  `M10: ${level.sections.length} sekcji, ${level.encounters.length} spotkań, ${level.blocks.length} bloków, ${level.lights.length} świateł.`,
);
