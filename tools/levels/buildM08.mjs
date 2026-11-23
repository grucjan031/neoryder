// M08: node tools/levels/buildM08.mjs (z katalogu repo).
import { readFileSync, writeFileSync } from 'node:fs';

const ID = 'm08-kwarantanna';
const v = (x, y = 0, z = 0) => ({ x, y, z });
const objective = (id) => ({ kind: 'objective', id });
const encounter = (id) => ({ kind: 'encounter', id });
const zone = (x, length, width = 28) => ({
  kind: 'box',
  position: v(x, 2),
  size: v(length, 8, width),
});
const block = (x, y, z, sx, sy, sz, material = 'concrete', model) => ({
  position: v(x, y, z),
  size: v(sx, sy, sz),
  material,
  ...(model ? { model } : {}),
});
const write = (path, data) =>
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const GREEN = '#6dff4a',
  WHITE = '#fff1d6',
  AMBER = '#ffae1a';
const level = {
  id: ID,
  name: 'Bulwar — odcięty blok mieszkalny',
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
  allies: [{ id: 'szron', spawn: v(4, 0, -2) }],
  objectiveNpcs: [],
  objectiveAfter: {},
  objectiveOrder: [
    'sluza-a',
    'grupa-a',
    'sluza-b',
    'grupa-b',
    'sluza-c',
    'grupa-c',
    'ewakuacja',
    'exit',
  ],
  objectivePositions: {
    'sluza-a': v(62),
    'grupa-a': v(82),
    'sluza-b': v(122),
    'grupa-b': v(142),
    'sluza-c': v(182),
    'grupa-c': v(202),
    ewakuacja: v(222),
    exit: v(244),
  },
};
const B = (...args) => level.blocks.push(block(...args));
const light = (x, y, z, color = WHITE, intensity = 24, range = 14) =>
  level.lights.push({ position: v(x, y, z), color, intensity, range });
const prop = (model, x, y, z, yaw = 0) =>
  level.decor.push({ model, position: v(x, y, z), yaw });
const sign = (texture, x, y, z, tint, yaw = 0) =>
  level.signs.push({
    kind: 'neon',
    texture,
    position: v(x, y, z),
    size: { w: 2.5, h: 1 },
    yaw,
    tint,
  });
function gate(id, x, halfWidth, after) {
  for (const s of [-1, 1])
    B(x, 4, (s * (halfWidth + 3)) / 2, 1, 8, halfWidth - 3);
  B(x, 6, 0, 1, 4, 6);
  level.gates.push({
    id,
    block: block(x, 2, 0, 0.4, 4, 6, 'hazard_stripes_worn'),
    after,
  });
  light(x - 2, 3, 0, GREEN, 16, 9);
}

// Pięć różniących się szerokością odcinków, ciągła podłoga na poziomie gracza.
for (const [id, name, start, end, half, roof] of [
  ['kordon', 'Kordon kwarantanny', 0, 40, 7, false],
  ['skrzydlo-a', 'Skrzydło A — pralnia i szyb serwisowy', 40, 100, 10, true],
  [
    'skrzydlo-b',
    'Skrzydło B — studnia podwórza i galerie',
    100,
    160,
    12,
    false,
  ],
  ['dziedziniec', 'Dziedziniec rozładunkowy', 160, 212, 14, false],
  ['winda', 'Punkt ewakuacji — winda towarowa', 212, 252, 10, true],
]) {
  const center = (start + end) / 2;
  level.sections.push({ id, name, zone: zone(center, end - start, half * 2) });
  for (let x = start; x < end; x += 4)
    B(x + 2, -0.5, 0, 4, 1, half * 2, roof ? 'concrete' : 'asphalt');
  for (const s of [-1, 1]) {
    B(center, 6, s * (half + 0.5), end - start, 12, 1, 'facade');
    // Zamknięte mieszkania, okna i przewody nad trasą; dekor poza torem ruchu.
    for (let x = start + 6; x < end - 3; x += 12) {
      prop('city_shutter', x, 0, s * (half - 0.1), s > 0 ? Math.PI : 0);
      B(x, 6, s * (half - 0.1), 3, 1.5, 0.1, 'light_white');
      const yaw = s > 0 ? Math.PI : 0;
      prop('city_ac_unit', x + 3, 3.1, s * (half - 0.25), yaw);
      // Pod stropem pralni widać również niższy rząd okien nad drzwiami.
      B(x - 2, 4.1, s * (half + 0.04), 1.8, 0.85, 0.1, 'glass');
      prop('city_sign_box', x - 2, 2.6, s * (half - 0.03), yaw);
      light(x - 2, 3.1, s * (half - 2), WHITE, 24, 14);
    }
  }
  if (roof) {
    B(center, 5.5, 0, end - start, 0.5, half * 2, 'concrete');
    level.rainShelters.push({
      position: v(center, 3),
      size: v(end - start, 6, half * 2),
    });
  }
  const laundry = id === 'skrzydlo-a';
  for (let x = start + 4; x < end; x += 12)
    light(x, 3.8, laundry ? -3 : 0, WHITE, laundry ? 16 : 24, 15);
  for (let x = start + 4; x < end; x += 8) {
    // Zachowaj bryły opraw; na podejściu i w pralni usuń emisję z osi widoku.
    const fixture = block(
      x,
      4.8,
      0,
      2,
      0.12,
      0.25,
      laundry ? 'trim' : 'light_white',
    );
    if (!roof) fixture.visible = false;
    level.blocks.push(fixture);
  }
  sign('arrow', end - 6, 3, -half + 0.15, GREEN);
  sign('pharmacy', start + 13, 3.5, half - 0.15, GREEN, Math.PI);
  sign(roof ? 'repair' : 'arrow', start + 22, 3.4, -half + 0.15, AMBER);
  for (const [offset, z, texture, w, h] of [
    [5, 2, 'crack_floor', 2, 2],
    [13, half - 3, 'manhole', 1.4, 1.4],
    [21, -4, 'floor_arrow', 2.5, 2.5],
    [end - start - 3, 0, 'floor_stop', 3, 1],
  ])
    level.decals.push({
      texture,
      position: v(start + offset, 0.012, z),
      size: { w, h },
      yaw: -Math.PI / 2,
      surface: 'floor',
    });
  level.ambientFx.push({
    kind: 'drip',
    position: v(start + 9, 3.1, -half + 0.6),
    rate: 1,
  });
  level.decals.push({
    texture: 'puddle1',
    position: v(center, 0.01, -2),
    size: { w: 4, h: 2 },
    surface: 'floor',
    yaw: 0,
  });
  level.ambientFx.push({
    kind: 'steam',
    position: v(end - 8, 0, half - 2),
    rate: 2,
  });
}
B(-0.5, 6, 0, 1, 12, 16);
B(252.5, 6, 0, 1, 12, 22);
// Zamknięcie uskoku szerokości przed windą.
for (const s of [-1, 1]) B(212, 6, s * 12, 1, 12, 4);
gate('gate-kordon', 39, 7, encounter('kordon'));
sign('implants', 16, 4, -6.8, '#3d7bff');
sign('metro', 28, 4, 6.8, '#8a5cff', Math.PI);
prop('city_wrecked_car', 24, 0, 4);
light(20, 3, 4, AMBER, 20, 12);
B(24, 0.8, 4, 2.2, 1.6, 4, 'metal');

const groups = [
  ['a', 62, 82, 10, 3],
  ['b', 122, 142, 12, 3],
  ['c', 182, 202, 14, 4],
];
for (const [key, lock, safe, half, count] of groups) {
  const fight = `oslona-${key}`;
  level.objectiveAfter[`sluza-${key}`] = encounter(fight);
  gate(`gate-sluza-${key}`, lock + 4, half, objective(`sluza-${key}`));
  gate(`gate-grupa-${key}`, safe + 8, half, objective(`grupa-${key}`));
  // Punkt zborny oznacza wejście grupy do bezpiecznego szybu, poza linią ognia.
  sign('arrow', safe, 3, -half + 0.2, GREEN);
  light(safe, 2.8, -half + 3, GREEN, 18, 10);
  light(lock + 10, 3, -half + 2.5, WHITE, 22, 11);
  light(lock - 1, 3, 1.5, AMBER, 18, 10);
  for (let n = 0; n < count; n++)
    level.objectiveNpcs.push({
      objective: `grupa-${key}`,
      spawn: v(lock + 8 + n * 1.4, 0, -half + 2),
      yawDeg: 0,
    });
  for (const [x, z] of [
    [lock - 10, 4],
    [lock - 3, -4],
    [safe, 5],
  ])
    B(x, 0.795, z, 1.212, 1.59, 1.256, 'metal', 'city_crates');
  prop('city_generator', safe + 4, 0, half - 2);
  B(safe + 4, 0.7, half - 2, 1.6, 1.4, 1.1, 'metal');
}
// Pralnia: rząd urządzeń i ławy, pozostawiający szerokie przejście do śluzy.
for (const x of [46, 50, 54]) {
  B(x, 0.9, -8, 2, 1.8, 1.6, 'trim');
  B(x, 1, -7.15, 1.2, 0.8, 0.1, 'metal');
}
// Galerie studni podwórza: górne balkony są scenografią, bez fałszywej trasy.
for (const s of [-1, 1]) {
  B(128, 4.2, s * 10, 48, 0.4, 3.5, 'concrete');
  B(128, 4.9, s * 8.3, 48, 1.1, 0.15, 'metal');
  prop('city_cable_span', 128, 8, s * 10);
}
// Rampa: rolety magazynu, kontenery i boczna bariera laserowa, omijalna środkiem.
B(174, 1.3, 9, 6.058, 2.6, 2.438, 'container_olive', 'port_container_20_olive');
level.hazards.push({
  id: 'bariera-rampy',
  kind: 'laser_gate',
  from: v(172, 1, -13),
  to: v(172, 1, -6),
  cycle: { onS: 2, offS: 2, offsetS: 0 },
});
// Winda: obrona przed kratą, wyjście dostępne dopiero po pełnym odliczaniu.
gate('gate-winda', 236, 10, objective('ewakuacja'));
for (const s of [-1, 1]) {
  B(245, 3, s * 5, 1, 6, 0.5, 'metal');
  B(220, 0.6, s * 5, 3, 1.2, 1, 'trim');
}
B(245, 6, 0, 1, 0.5, 10, 'metal');
light(244, 3, 0, GREEN, 20, 12);
sign('arrow', 251.9, 3, 0, GREEN, -Math.PI / 2);

for (const [id, x, wave, after] of [
  ['kordon', 16, 'm08Kordon'],
  ['oslona-a', 48, 'm08Skrzydlo', encounter('kordon')],
  ['oslona-b', 108, 'm08Skrzydlo', objective('grupa-a')],
  ['oslona-c', 168, 'm08Rampa', objective('grupa-b')],
])
  level.encounters.push({
    id,
    zone: zone(x + 7, 28),
    wave,
    spawnPoints: [
      { x: x + 10, z: -3 },
      { x: x + 13, z: 3 },
      { x: x + 8, z: 0 },
    ],
    ...(after ? { after } : {}),
  });
for (let index = 0; index < 2; index++)
  level.encounters.push({
    id: `ewakuacja-${index + 1}`,
    zone: zone(222, 20),
    wave: index ? 'm08Rozstrojeni' : 'm08Rampa',
    reinforcementFor: `ewakuacja:${index}`,
    spawnPoints: [
      { x: 212, z: -6 },
      { x: 212, z: 6 },
      { x: 209, z: 0 },
    ],
  });
level.spawnPoints = level.encounters.flatMap((item) => item.spawnPoints);
for (const [id, x, after] of [
  ['start', 5],
  ['skrzydlo-a', 43, encounter('kordon')],
  ['skrzydlo-b', 103, objective('grupa-a')],
  ['dziedziniec', 163, objective('grupa-b')],
  ['winda', 214, objective('grupa-c')],
])
  level.checkpoints.push({
    id,
    position: v(x),
    yawDeg: -90,
    zone: zone(x, 4),
    ...(after ? { after } : {}),
  });
write(`src/data/levels/${ID}.json`, level);

for (const [id, groups] of [
  [
    'm08Kordon',
    [
      ['gunner', 2],
      ['shielder', 1],
    ],
  ],
  [
    'm08Skrzydlo',
    [
      ['gunner', 2],
      ['rozstrojony', 3],
    ],
  ],
  [
    'm08Rampa',
    [
      ['shielder', 1],
      ['gunner', 2],
      ['rozstrojony', 2],
    ],
  ],
  ['m08Rozstrojeni', [['rozstrojony', 4]]],
]) {
  const wave = JSON.parse(
    readFileSync('src/data/waves/missionPatrol.json', 'utf8'),
  );
  Object.assign(wave, {
    id,
    maxAlive: 6,
    waves: [
      {
        spawnIntervalS: 0.6,
        groups: groups.map(([enemy, count]) => ({ enemy, count })),
      },
    ],
  });
  write(`src/data/waves/${id}.json`, wave);
}
const enemy = JSON.parse(
  readFileSync('src/data/enemies/assaulter.json', 'utf8'),
);
Object.assign(enemy, {
  id: 'rozstrojony',
  moveSpeed: 5.4,
  maxHealth: 45,
  telegraphS: 0.32,
  cooldownS: 0.7,
  flankDistanceM: 2,
});
write('src/data/enemies/rozstrojony.json', enemy);

// Kwestie ze scenariusza; bez parafrazowania i bez nowych postaci.
const source = readFileSync('docs/fabula/misje/misja-08-kwarantanna.md', 'utf8')
  .split('## Dialogi')[1]
  .split('## Nagrody')[0];
const lines = (heading) =>
  source
    .split(heading)[1]
    .split('### ')[0]
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/^\*\*(\p{L}+):\*\* (.+)$/u);
      return match ? [{ speaker: match[1].toLowerCase(), text: match[2] }] : [];
    });
const briefing = lines('### Odprawa (kryjówka)');
const radio = lines('### W trakcie misji (radio)');
const debrief = lines('### Po misji (kryjówka)');
const objectives = groups.flatMap(([key]) => [
  {
    id: `sluza-${key}`,
    kind: 'interact',
    label: `Otwórz drogę grupie ${key.toUpperCase()}`,
    position: level.objectivePositions[`sluza-${key}`],
    holdS: 2,
    unlockAfter: key === 'a' ? [] : [`grupa-${key === 'b' ? 'a' : 'b'}`],
  },
  {
    id: `grupa-${key}`,
    kind: 'reach',
    label: `Przeprowadź grupę ${key.toUpperCase()} do bezpiecznego szybu`,
    position: level.objectivePositions[`grupa-${key}`],
    radiusM: 2.5,
    timeLimitS: 60,
  },
]);
objectives.push(
  {
    id: 'ewakuacja',
    kind: 'defend',
    label: 'Osłaniaj ewakuację trzech grup przy windzie',
    position: level.objectivePositions.ewakuacja,
    holdS: 2,
    radiusM: 6,
    durationS: 25,
    waves: [
      { atProgress: 0.2, wave: 'm08Rampa' },
      { atProgress: 0.6, wave: 'm08Rozstrojeni' },
    ],
  },
  {
    id: 'exit',
    kind: 'exit',
    label: 'Zjedź z ostatnim kursem windy',
    position: level.objectivePositions.exit,
    holdS: 2,
    unlockAfter: ['grupa-a', 'grupa-b', 'grupa-c', 'ewakuacja'],
  },
);
const event = (trigger, lines, priority) => ({
  trigger,
  lines,
  ...(priority ? { priority } : {}),
});
write(`src/data/missions/${ID}.json`, {
  id: ID,
  level: ID,
  number: 8,
  title: 'Kwarantanna',
  act: 2,
  summary:
    'Helixa odcięła blok na Bulwarze po rozstrojeniu całej partii Akordu. Otwórz drogi trzem grupom cywilów i osłoń ich ewakuację windą towarową. Szron idzie z tobą.',
  sectorId: 'kurogane',
  requires: ['m07-nocny-dyzur'],
  layers: 7,
  enemies: ['gunner', 'shielder', 'rozstrojony'],
  fixedNodes: [
    {
      layer: 7,
      type: 'combat',
      roomId: 'combatYard',
      objectives: level.objectiveOrder,
      final: true,
    },
  ],
  objectives,
  briefing: [briefing[1], briefing[4], briefing[8]],
  debrief: [
    debrief[0],
    debrief[2],
    debrief[3],
    debrief[4],
    debrief[7],
    debrief[12],
  ],
  radio: [
    event('runStart', radio.slice(0, 2)),
    event(
      'enterSection:kordon',
      [briefing[0], briefing[2], briefing[3]],
      'story',
    ),
    event('encounter:kordon:started', radio.slice(2, 5)),
    event(
      'encounter:kordon:done',
      [briefing[5], briefing[6], briefing[7]],
      'story',
    ),
    event('enterSection:skrzydlo-a', radio.slice(5, 8)),
    event('objective:sluza-a:done', [briefing[9], briefing[10]], 'story'),
    event('objective:grupa-a:done', [briefing[11]], 'story'),
    event('enterSection:skrzydlo-b', radio.slice(8, 11)),
    event('enterSection:dziedziniec', radio.slice(11, 12)),
    event('objective:grupa-c:done', radio.slice(12, 13)),
    event('objective:ewakuacja:done', radio.slice(13)),
  ],
  rewards: { firstClear: { data: 100, cores: 1 } },
});
console.log(
  `M08: ${level.sections.length} sekcji, ${level.encounters.length} spotkań, ${level.blocks.length} bloków.`,
);
