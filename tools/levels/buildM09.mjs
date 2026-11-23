// M09 „Brat”: node tools/levels/buildM09.mjs (z katalogu repo).
import { readFileSync, writeFileSync } from 'node:fs';

const v = (x, y = 0, z = 0) => ({ x, y, z });
const zone = (x, length, width = 36) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const encounter = (id) => ({ kind: 'encounter', id });
const objective = (id) => ({ kind: 'objective', id });
const level = {
  id: 'm09-brat',
  name: 'Bulwar — pokaz Akordu',
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
  encounters: [],
  gates: [],
  checkpoints: [],
  allies: [{ id: 'nadia', spawn: v(4, 0, -2) }],
  objectiveOrder: ['tymon', 'opaska', 'brama', 'exit'],
  objectivePositions: {
    tymon: v(166),
    opaska: v(166),
    brama: v(216),
    exit: v(238),
  },
};
function box(x0, x1, y0, y1, z0, z1, material = 'concrete', extra = {}) {
  const block = {
    position: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    size: v(x1 - x0, y1 - y0, z1 - z0),
    material,
    ...extra,
  };
  level.blocks.push(block);
  return block;
}
function light(x, y, z, color = '#fff1d6', intensity = 24, range = 18) {
  level.lights.push({ position: v(x, y, z), color, intensity, range });
}
function prop(model, x, z, y = 0, yaw = 0) {
  level.decor.push({ model, position: v(x, y, z), yaw });
}
function sign(texture, x, z, tint, y = 5, yaw = 0) {
  level.signs.push({
    kind: 'neon',
    texture,
    position: v(x, y, z),
    size: { w: 4, h: 1.6 },
    yaw,
    tint,
  });
}
const sections = [
  ['kladki', 'Zabezpieczone kładki Bulwaru', 0, 48, 10],
  ['kontrola', 'Kontrola dostępu', 48, 96, 18],
  ['pokaz', 'Plac z hologramami', 96, 140, 28],
  ['pojedynek', 'Tymon — pole demonstracyjne', 140, 192, 32],
  ['rampa', 'Północna brama załadunkowa', 192, 248, 24],
];
for (const [id, name, start, end, width] of sections) {
  const half = width / 2;
  level.sections.push({
    id,
    name,
    zone: zone((start + end) / 2, end - start, width),
  });
  for (let x = start; x < end; x += 4)
    box(
      x,
      Math.min(x + 4, end),
      -1,
      0,
      -half,
      half,
      id === 'kladki' ? 'steel_grating' : 'asphalt',
    );
  for (const side of [-1, 1]) {
    const z = side * (half + 1);
    box(
      start,
      end,
      0,
      id === 'kladki' ? 1.3 : 12,
      z - 1,
      z + 1,
      id === 'kladki' ? 'metal' : 'facade',
    );
    if (id === 'kladki')
      box(start, end, 1.3, 10, z - 1, z + 1, 'metal', { visible: false });
    for (let x = start + 8; x < end; x += 16) {
      prop('city_street_lamp', x, side * (half - 1));
      light(x, 5, side * (half - 2), '#fff1d6', 24, 18);
      if (id !== 'kladki') {
        prop(
          'city_shutter',
          x,
          side * (half - 0.12),
          0,
          side === 1 ? Math.PI : 0,
        );
        sign(
          'arrow',
          x,
          side * (half - 0.15),
          id === 'rampa' ? '#6dff4a' : '#3d7bff',
          5,
          side === 1 ? Math.PI : 0,
        );
      }
    }
  }
  for (let x = start + 12; x < end; x += 20)
    level.decals.push({
      texture: 'floor_arrow',
      position: v(x, 0.01),
      size: { w: 3, h: 3 },
      yaw: -Math.PI / 2,
      surface: 'floor',
    });
}
box(-1, 0, 0, 10, -7, 7, 'metal');
box(248, 249, 0, 10, -14, 14, 'corrugated');
// Estakada nad trasą kolejki, bez nowych modeli i bez dostępnej drogi pod spodem.
for (const x of [8, 24, 40]) {
  box(x - 0.5, x + 0.5, -8, -1, -4.5, -3.5, 'overpass_concrete');
  box(x - 0.5, x + 0.5, -8, -1, 3.5, 4.5, 'overpass_concrete');
}
box(0, 48, -9, -8, -18, 18, 'asphalt');
// Osłony pozostawiają ciągły pas przejścia po osi oraz boczne flanki.
for (const [x, z] of [
  [24, 3],
  [66, -5],
  [80, 5],
  [110, -7],
  [126, 7],
  [153, -7],
  [177, 7],
  [207, -8],
  [228, 8],
]) {
  box(x - 3, x + 3, 0, 2.591, z - 1.219, z + 1.219, 'container_graphite', {
    model: 'port_container_20_graphite',
  });
  prop('city_crates', x + 4, z);
}
// Budki techniczne za szkłem; personel pozostaje poza grywalną trasą.
for (const z of [-7, 7]) {
  box(85, 92, 0, 3, z - 1.5, z + 1.5, 'metal');
  prop('city_ac_unit', 88, z, 3);
  light(88, 4, z, '#fff1d6', 16, 12);
}
// Projektory i zamknięta galeria nabywców nad placem.
for (const z of [-11, 11]) {
  prop('city_holo_projector', 119, z);
  box(118.5, 119.5, 0, 7, z - 0.5, z + 0.5, 'metal');
  sign('open', 119, z, '#8a5cff', 8, z > 0 ? Math.PI : 0);
  light(119, 6, z, '#8a5cff', 18, 18);
}
box(144, 188, 6, 6.5, 12, 16, 'steel_grating');
box(144, 188, 6.5, 9, 12, 12.2, 'glass');
for (const x of [150, 166, 182]) light(x, 5, 0, '#fff1d6', 30, 20);
sign('warsztat', 166, -15.8, '#3d7bff', 7);
// Zadaszona rampa transportowa; zielone wyjście i bursztynowy szlaban.
box(202, 246, 7, 7.5, -12, 12, 'roof_tar');
level.rainShelters.push({ position: v(224, 4), size: v(44, 8, 24) });
for (const x of [206, 218, 230, 242]) light(x, 5.5, 0, '#fff1d6', 30, 16);
sign('arrow', 238, -11.8, '#6dff4a');
prop('city_generator', 220, -10);
prop('city_barrier', 235, 4);
light(238, 3, 0, '#ffae1a', 18, 12);
// Transport za szlabanem: bryła z istniejących materiałów, otwarty tył przy celu exit.
box(240, 246, 0.5, 3, -1.8, 1.8, 'container_graphite');
box(238, 240, 0.5, 3, -1.8, -1.4, 'metal');
box(238, 240, 0.5, 3, 1.4, 1.8, 'metal');
box(238, 240, 2.8, 3, -1.8, 1.8, 'metal');
for (const x of [240.5, 245])
  for (const z of [-1.8, 1.8])
    box(x - 0.5, x + 0.5, 0, 1, z - 0.2, z + 0.2, 'metal');
for (const [id, x, after, width] of [
  ['kladki', 48, encounter('kordon'), 18],
  ['kontrola', 96, encounter('kontrola'), 28],
  ['arena', 140, encounter('oslona'), 32],
  ['rampa', 192, objective('opaska'), 32],
  ['transport', 234, objective('brama'), 24],
]) {
  box(x - 0.5, x + 0.5, 0, 12, -width / 2, -3, 'corrugated');
  box(x - 0.5, x + 0.5, 0, 12, 3, width / 2, 'corrugated');
  box(x - 0.5, x + 0.5, 5, 12, -3, 3, 'corrugated');
  level.gates.push({
    id: `gate-${id}`,
    block: { position: v(x, 2.5), size: v(1, 5, 6), material: 'hazard' },
    after,
    ...(id === 'arena' ? { closedDuring: 'tymon' } : {}),
  });
}
for (const [id, x, wave, after, points] of [
  [
    'kordon',
    16,
    'm09Kordon',
    undefined,
    [
      [32, -2],
      [38, 2],
    ],
  ],
  [
    'kontrola',
    58,
    'm09Kontrola',
    encounter('kordon'),
    [
      [74, -3],
      [82, 0],
    ],
  ],
  [
    'oslona',
    104,
    'm09Oslona',
    encounter('kontrola'),
    [
      [124, -3],
      [130, 3],
    ],
  ],
  ['tymon', 148, 'm09Tymon', encounter('oslona'), [[166, 0]]],
  [
    'poscig',
    202,
    'm09Poscig',
    objective('opaska'),
    [
      [198, -7],
      [198, 7],
    ],
  ],
])
  level.encounters.push({
    id,
    zone: zone(x, 12),
    wave,
    spawnPoints: points.map(([x, z]) => ({ x, z })),
    ...(after ? { after } : {}),
    ...(id === 'tymon' ? { bossFor: 'tymon' } : {}),
  });
for (let i = 0; i < 3; i++)
  level.encounters.push({
    id: `obrona-${i + 1}`,
    zone: zone(216, 48),
    wave: i === 1 ? 'missionDockShields' : 'm09Poscig',
    reinforcementFor: `brama:${i}`,
    spawnPoints: [
      { x: 198, z: -7 },
      { x: 228, z: -6 },
    ],
  });
for (const item of level.encounters)
  level.spawnPoints.push(...item.spawnPoints);
for (const [id, x, after] of [
  ['start', 5],
  ['kontrola', 52, encounter('kordon')],
  ['pokaz', 100, encounter('kontrola')],
  ['przed-tymonem', 136, encounter('oslona')],
  ['rampa', 198, objective('opaska')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 5),
    ...(after ? { after } : {}),
  });
writeFileSync(
  'src/data/levels/m09-brat.json',
  JSON.stringify(level, null, 2) + '\n',
);
for (const [id, groups] of Object.entries({
  m09Kordon: [
    ['assaulter', 2],
    ['gunner', 1],
  ],
  m09Kontrola: [
    ['shielder', 1],
    ['gunner', 2],
    ['drone', 1],
  ],
  m09Oslona: [
    ['assaulter', 3],
    ['hacker', 1],
  ],
  m09Tymon: [['securityChief', 1]],
  m09Poscig: [
    ['assaulter', 2],
    ['gunner', 2],
  ],
})) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    firstBreakS: 1,
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
console.log(
  `M09: ${level.sections.length} sekcji, ${level.encounters.length} spotkań`,
);
