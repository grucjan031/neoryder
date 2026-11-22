// M02 „Punkt kontrolny”: uruchom z katalogu repo: node tools/levels/buildM02.mjs.
import { readFileSync, writeFileSync } from 'node:fs';

const v = (x, y = 0, z = 0) => ({ x, y, z });
const zone = (x, length, width = 28) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const block = (x, y, z, sx, sy, sz, material = 'concrete', model) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...(model ? { model } : {}),
});
const AMBER = '#ffae1a',
  GREEN = '#6dff4a',
  WHITE = '#fff1d6';
const BLUE = '#3d7bff',
  VIOLET = '#8a5cff';
const level = {
  id: 'm02-punkt-kontrolny',
  name: 'Niecka — Punkt kontrolny',
  type: 'combat',
  theme: 'neonStreet',
  playerSpawn: v(215),
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
  objectiveOrder: ['cell-1', 'cell-2', 'cell-3', 'executor', 'exit'],
  objectivePositions: {
    'cell-1': v(116, 0, -7),
    'cell-2': v(94, 0, 7),
    'cell-3': v(61, 0, -7),
    executor: v(48),
    exit: v(8),
  },
  allies: [{ id: 'nadia', spawn: v(92, 0, 7), joinAfter: objective('cell-2') }],
};
const B = (...args) => level.blocks.push(block(...args));
const prop = (model, x, y, z, yaw = 0) =>
  level.decor.push({ model, position: v(x, y, z), yaw });
const light = (x, y, z, color, intensity = 18, range = 22) =>
  level.lights.push({ position: v(x, y, z), color, intensity, range });
const decal = (texture, x, z, w, h, yaw = 0) =>
  level.decals.push({
    texture,
    position: v(x, 0.01, z),
    size: { w, h },
    yaw,
    surface: 'floor',
  });
const sign = (texture, x, y, z, tint) =>
  level.signs.push({
    kind: 'neon',
    texture,
    position: v(x, y, z),
    size: { w: 3, h: 1.2 },
    yaw: 0,
    tint,
  });
const crate = (x, z) =>
  B(x, 0.795, z, 1.212, 1.59, 1.256, 'metal', 'city_crates');
const container = (x, z, color = 'graphite') =>
  B(
    x,
    1.2955,
    z,
    6.058,
    2.591,
    2.438,
    `container_${color}`,
    `port_container_20_${color}`,
  );

// Zachód to -X: gracz przechodzi od nasypu przez rampę i place do kanału.
const sections = [
  ['kordon', 'Kordon pod nasypem', 170, 220, 8],
  ['bocznica', 'Bocznica — rampa selekcji', 130, 170, 12],
  ['cele', 'Plac kontenerów — skaner Helixa', 80, 130, 14],
  ['dowodztwo', 'Suwnica — punkt dowodzenia', 30, 80, 14],
  ['ewakuacja', 'Brama zachodnia — kanał powrotny', 0, 30, 8],
];
for (const [id, name, from, to, halfWidth] of sections) {
  level.sections.push({
    id,
    name,
    zone: zone((from + to) / 2, to - from, halfWidth * 2),
  });
  for (let x = from; x < to; x += 4)
    B(
      x + Math.min(4, to - x) / 2,
      -0.5,
      0,
      Math.min(4, to - x),
      1,
      halfWidth * 2,
      'quay_concrete',
    );
  for (const side of [-1, 1])
    B((from + to) / 2, 5, side * (halfWidth + 0.5), to - from, 10, 1, 'facade');
  for (let x = from + 8; x < to; x += 16) {
    light(x, 5, -halfWidth + 2, AMBER);
    light(x, 4, halfWidth - 2, WHITE, 14, 20);
    decal('puddle1', x, -2.5, 4, 2);
    decal('oil_stain', x + 4, 3, 2, 2);
  }
  sign('arrow', from + 5, 3.5, -halfWidth + 0.1, GREEN);
  decal('floor_arrow', from + 7, 0, 3, 3, Math.PI / 2);
}
B(220.5, 5, 0, 1, 10, 17, 'overpass_concrete');
B(-0.5, 5, 0, 1, 10, 17, 'overpass_concrete');
// Przepust pod ceglanym nasypem i kanał ewakuacyjny.
for (const [x, length] of [
  [207, 26],
  [12, 24],
]) {
  B(x, 6, 0, length, 1, 17, 'overpass_concrete');
  level.rainShelters.push({ position: v(x, 3), size: v(length, 6, 17) });
  light(x, 3.8, 0, WHITE, 24, 18);
  level.ambientFx.push({ kind: 'steam', position: v(x, 0, 6), rate: 2 });
}
// Każde przejście ma ramę do wysokości ścian — nie można ominąć bramy bokiem.
function gate(id, x, halfWidth, after) {
  for (const side of [-1, 1])
    B(x, 5, (side * (halfWidth + 2)) / 2, 1, 10, halfWidth - 2, 'corrugated');
  B(x, 7, 0, 1, 6, 4, 'metal');
  level.gates.push({ id, block: block(x, 2, 0, 1, 4, 4, 'hazard'), after });
  light(x + 3, 3.4, 0, GREEN, 12, 12);
}
gate('gate-kordon', 170, 12, encounter('patrol-kordon'));
gate('gate-plac', 130, 14, encounter('rampa'));
gate('gate-sluza', 80, 14, objective('cell-2'));
gate('gate-zachod', 30, 14, objective('executor'));

// Osłony kordonu i porzucony transport. Środek pozostaje drożny dla kapsuły.
B(188, 0.55, -4, 4, 1.1, 0.8, 'concrete', 'city_highway_barrier');
crate(182, 4);
crate(179, 5.5);
prop('city_wrecked_car', 193, 0, 5);
prop('city_traffic_cone', 176, 0, -2.8);
// Tory po bokach, wagony osłaniają rampę. Szyny nie podnoszą poziomu podłogi.
for (const z of [-8, 8]) {
  for (const offset of [-0.7, 0.7])
    B(150, 0.025, z + offset, 34, 0.05, 0.08, 'metal');
  for (let x = 134; x <= 166; x += 2) B(x, 0.02, z, 0.25, 0.04, 2.1, 'metal');
  B(150, 2.1, z, 14, 4.2, 3, 'metal', 'port_freight_boxcar');
}
crate(141, -4);
crate(158, 4);
prop('port_light_tower', 148, 0, 15);
prop('city_traffic_cone', 137, 0, 3);
decal('floor_stop', 164, 0, 3, 1);

// Cele: kontener, jasny rygiel przed wrotami i przejście przy punkcie interakcji.
for (const [id, x, z, color] of [
  ['cell-1', 116, -7, 'ochre'],
  ['cell-2', 94, 7, 'olive'],
  ['cell-3', 61, -7, 'navy'],
]) {
  const side = Math.sign(z);
  container(x, z + side * 3, color);
  B(x + 1.8, 1, z + side * 1.5, 0.45, 0.7, 0.35, 'metal');
  light(x, 2.4, z, WHITE, 12, 9);
  decal('floor_hazard', x, z + side, 3, 1);
  // Wrota znikają po otwarciu rygla; korpus kontenera zostaje istniejącym modelem.
  level.gates.push({
    id: `gate-${id}`,
    block: block(x, 1.2, z + side * 1.6, 2.2, 2.4, 0.2, 'metal'),
    after: objective(id),
  });
}
// Biała konsola Helixa pod wiatą, budka wagi i punkt zborny.
B(105, 3.5, 10, 10, 0.3, 6, 'corrugated');
level.rainShelters.push({ position: v(105, 1.75, 10), size: v(10, 3.5, 6) });
for (const x of [100.5, 109.5]) B(x, 1.7, 12.5, 0.2, 3.4, 0.2, 'metal');
prop('city_holo_projector', 105, 0, 10);
B(105, 0.6, 10, 2.4, 1.2, 1, 'concrete');
light(105, 2.7, 9, WHITE, 18, 12);
B(84, 2, 10.5, 5, 4, 5, 'facade');
prop('city_door', 84, 0, 7.9, Math.PI);
light(84, 3, 7, BLUE, 12, 12);
light(87, 3, 12, VIOLET, 12, 12);
sign('open', 85, 4.5, 7.8, WHITE);
B(86, 0.55, 4, 4, 1.1, 0.8, 'concrete', 'city_highway_barrier');
crate(110, -3.5);
crate(101, 3.5);
container(120, 10, 'graphite');
// Suwnica i osłony finału; Egzekutor schodzi po uwolnieniu ostatniej grupy.
prop('port_gantry_crane', 54, 0, 0, Math.PI / 2);
for (const z of [-12, 12]) B(54, 1.3, z, 9, 2.6, 1.4, 'metal');
container(71, 10, 'graphite');
crate(67, 3.5);
crate(43, -5);
crate(39, 5);
B(49, 0.55, 6, 4, 1.1, 0.8, 'concrete', 'city_highway_barrier');
light(54, 7, -8, AMBER, 24, 24);
light(38, 5, 8, BLUE, 14, 18);
prop('city_generator', 35, 0, -10);
decal('tire_marks', 52, 0, 6, 2.5);
decal('floor_stop', 33, 0, 3, 1);

const points = (pairs) => pairs.map(([x, z]) => ({ x, z }));
function fight(id, x, length, wave, pairs, extra = {}) {
  level.encounters.push({
    id,
    zone: zone(x, length),
    wave,
    spawnPoints: points(pairs),
    ...extra,
  });
}
fight('patrol-kordon', 190, 30, 'm02Patrol', [
  [181, -4],
  [177, 4],
  [184, 2],
]);
fight(
  'rampa',
  150,
  32,
  'm02Ramp',
  [
    [139, -4],
    [138, 4],
    [135, 0],
  ],
  { after: encounter('patrol-kordon') },
);
fight(
  'straz-cel',
  108,
  40,
  'm02Guards',
  [
    [101, -5],
    [96, -3],
    [90, 4],
  ],
  { after: encounter('rampa') },
);
fight(
  'poscig-1',
  105,
  50,
  'm02Pursuit',
  [
    [126, -4],
    [125, 4],
  ],
  { after: objective('cell-1') },
);
fight(
  'poscig-2',
  105,
  50,
  'm02Pursuit',
  [
    [124, -5],
    [123, 5],
  ],
  { after: objective('cell-2') },
);
fight(
  'oslona-suwnicy',
  56,
  42,
  'm02Ramp',
  [
    [44, -7],
    [41, 4],
    [36, 0],
  ],
  { after: objective('cell-2') },
);
fight(
  'egzekutor',
  55,
  50,
  'm02Executor',
  [
    [45, 0],
    [39, -6],
    [39, 6],
  ],
  { after: objective('cell-3'), bossFor: 'executor' },
);
fight(
  'poscig-3',
  55,
  50,
  'm02Pursuit',
  [
    [75, -3],
    [75, 3],
  ],
  { after: objective('cell-3') },
);
for (const item of level.encounters)
  level.spawnPoints.push(...item.spawnPoints);
for (const [id, x, after] of [
  ['start', 215],
  ['bocznica', 166, encounter('patrol-kordon')],
  ['plac', 126, encounter('rampa')],
  ['zbiorka', 76, objective('cell-2')],
  ['ewakuacja', 26, objective('executor')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: 90,
    zone: zone(x, 5),
    ...(after ? { after } : {}),
  });

writeFileSync(
  'src/data/levels/m02-punkt-kontrolny.json',
  JSON.stringify(level, null, 2) + '\n',
);
for (const [id, groups] of Object.entries({
  m02Patrol: [
    ['assaulter', 2],
    ['gunner', 1],
  ],
  m02Ramp: [
    ['gunner', 2],
    ['turret', 1],
  ],
  m02Guards: [
    ['assaulter', 2],
    ['gunner', 2],
  ],
  m02Pursuit: [['assaulter', 2]],
  m02Executor: [
    ['executor', 1],
    ['gunner', 2],
  ],
})) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive: 6,
    minSpawnDistance: 2,
    firstBreakS: id === 'm02Executor' ? 3 : 0,
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
console.log(
  `M02: ${level.sections.length} sekcji, ${level.encounters.length} spotkań, ${level.blocks.length} bloków.`,
);
