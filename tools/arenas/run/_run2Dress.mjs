// Wyposażenie pasaży, atrium, wejścia i wyjścia galerii „Atrium Nova” (run2): osłony, światła, szyldy,
// decale, zagrożenia, skrzynie i spawny. Wszystko poza sklepami (patrz _run2Shops.mjs).
import {
  COLOR,
  LEVELS,
  Q,
  R,
  ROOF,
  SLAB,
  STORY,
  box,
  deco,
  prop,
  solid,
  vec,
} from './_run2Kit.mjs';

const C = COLOR;
const PI = Math.PI;

/** Naklejka podłogowa lub ścienna z kolorem. */
function mark(
  k,
  texture,
  x,
  y,
  z,
  w,
  h,
  yaw = 0,
  tint = C.warm,
  opacity = 0.7,
  surface = 'floor',
) {
  k.decals.push({
    texture,
    surface,
    position: vec(x, y, z),
    yaw,
    size: { w, h },
    tint,
    opacity,
  });
}

/** Stojak promocyjny: dekoracja z niewidocznym kolliderem (blok modelu ma inny wymiar niż pomiar). */
function promo(k, p, x, z) {
  p.reserve(R(x - 0.4, x + 0.4, z - 0.4, z + 0.4), 0);
  deco(k, 'mall_promo_stand', x, 0, z, 0);
  k.arena.block({
    size: vec(0.8, 1.354, 0.8),
    position: vec(x, 0.677, z),
    material: 'metal',
    visible: false,
  });
}

/** Rekwizyty parteru: fontanna, ławki, kioski, ekspozycja samochodu, wyspy wypoczynkowe. */
function groundFloor(k, p) {
  p.prop('mall_fountain', 0, 0);
  p.prop('mall_bench', 0, -5.2);
  p.prop('mall_bench', 0, 5.2);
  p.prop('mall_bench', 5.2, 0, 0, 1);
  p.prop('mall_bench', -5.2, 0, 0, 1);
  p.prop('mall_kiosk', -7.5, 9.5);
  p.prop('mall_kiosk', 8.5, -10.5);
  p.prop('mall_kiosk', 8.5, 2);
  // Ekspozycja promocyjna: samochód na podeście z neonowym obrysem i słupkami z taśmą.
  const cx = -10.5,
    cz = -5.2;
  p.reserve(R(cx - 3.2, cx + 3.2, cz - 1.9, cz + 1.9), 0);
  box(k, cx, 0.15, cz, 6.4, 0.3, 3.8, 'mall_terrazzo_inlay', {
    walkable: false,
  });
  prop(k, 'mall_showcar', cx, cz, 0.3, 0, { material: 'metal' });
  for (const [x, z, w, d] of [
    [cx, cz - 1.75, 6.1, 0.08],
    [cx, cz + 1.75, 6.1, 0.08],
    [cx - 2.95, cz, 0.08, 3.5],
    [cx + 2.95, cz, 0.08, 3.5],
  ])
    box(k, x, 0.34, z, w, 0.08, d, 'neon_amber', { walkable: false });
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      box(k, cx + sx * 3.35, 0.5, cz + sz * 2.15, 0.12, 1.0, 0.12, 'trim');
    }
  for (const sz of [-1, 1])
    box(k, cx, 0.85, cz + sz * 2.15, 6.7, 0.04, 0.04, 'hivis');
  for (const sx of [-1, 1])
    box(k, cx + sx * 3.35, 0.85, cz, 0.04, 0.04, 4.3, 'hivis');
  // Wyspy wypoczynkowe: donica i dwie ławki.
  for (const [x, z] of [
    [-8.5, 15],
    [9, -15],
  ]) {
    p.prop('mall_planter', x, z);
    p.prop('mall_bench', x, z - 1.9);
    p.prop('mall_bench', x, z + 1.9);
  }
  // Trzecia wyspa i planter przy ESC-1 przełamują wschodnią część atrium.
  p.prop('mall_planter', 9.6, 9.6);
  p.prop('mall_bench', 9.6, 11.5);
  p.prop('mall_planter', 9.8, 15.5, 0, 1);
  p.prop('mall_planter', -9.5, -14.6);
  p.prop('mall_bench', -9.5, -12.7);
  p.prop('mall_bench', -9.5, -16.5);
  p.prop('mall_directory', -2.5, -10.5);
  p.prop('mall_directory', 2, 11.5);
  // Mniejsze wyspy na środku przecinają puste pole widoczne z pasażu wschodniego.
  p.prop('mall_planter', 1.8, -8.5);
  p.prop('mall_bench', 1.8, -10.4);
  p.prop('mall_trash_bin', 5.6, -5.2);
  p.prop('mall_planter', -1.6, 8.4);
  p.prop('mall_trash_bin', -1.6, 10.1);
  // Przycinane drzewka w donicach: pień i trzy zwarte piętra korony, bez nowego GLB.
  for (const [x, z] of [
    [1.8, -8.5],
    [-1.6, 8.4],
  ]) {
    box(k, x, 1.65, z, 0.16, 1.7, 0.16, 'wood', { walkable: false });
    for (const [y, w, d] of [
      [2.15, 1.7, 1.15],
      [2.65, 1.35, 1.0],
      [3.1, 0.85, 0.7],
    ])
      box(k, x, y, z, w, 0.65, d, 'container_olive', { walkable: false });
  }
  promo(k, p, 6.5, 5.1);
  promo(k, p, -6.6, -3.0);
  for (const [x, z] of [
    [6.5, 5.1],
    [-6.6, -3.0],
  ])
    for (const yaw of [0, PI])
      k.neon(
        'mall_sale',
        x,
        0.85,
        z + (yaw ? -0.16 : 0.16),
        0.48,
        0.72,
        yaw,
        C.warm,
        0,
      );
  // Pasaże boczne.
  for (const [z, kind] of [
    [-14, 'mall_planter'],
    [-8, 'mall_bench'],
    [-2, 'mall_planter'],
    [4, 'mall_bench'],
    [10, 'mall_planter'],
    [15.5, 'mall_bench'],
  ])
    p.prop(kind, -15, z, 0, 1);
  for (const [z, kind] of [
    [-14, 'mall_bench'],
    [-8, 'mall_planter'],
    [-2, 'mall_bench'],
    [4, 'mall_planter'],
    [10, 'mall_bench'],
    [16, 'mall_planter'],
  ])
    p.prop(kind, 15, z, 0, 1);
  // Północ: dojście do wyjścia.
  for (const s of [-1, 1]) {
    p.prop('mall_planter', s * 7, -21.5);
    p.prop('mall_bench', s * 10.5, -23.5);
    p.prop('mall_trash_bin', s * 4.5, -24.3);
    p.prop('mall_directory', s * 3.6, -19.4);
    p.prop('mall_bench', s * 4.3, -22.3, 0, 1);
  }
  // Południe: start, informatory, ławki, kosze.
  p.prop('mall_planter', -3.5, 19.5);
  for (const s of [-1, 1]) {
    p.prop('mall_directory', s * 6.5, 20.5);
    p.prop('mall_bench', s * 11, 23.4);
    p.prop('mall_trash_bin', s * 3.6, 24.4);
    promo(k, p, s * 3.5, 22.2);
  }
}

/** Rekwizyty pięter: donice, ławki, kosze, informatory, osłony na mostkach. */
function upperFloors(k, p) {
  const sets = {
    1: {
      W: [
        [-14, 'mall_planter'],
        [-8, 'mall_bench'],
        [-1, 'mall_directory'],
        [9, 'mall_planter'],
        [15, 'mall_bench'],
      ],
      E: [
        [-14, 'mall_bench'],
        [-8, 'mall_planter'],
        [-1, 'mall_trash_bin'],
        [9, 'mall_bench'],
        [15, 'mall_planter'],
      ],
      N: [
        [-8, -21.8, 'mall_planter'],
        [6, -22.5, 'mall_bench'],
        [10.5, -23.5, 'mall_trash_bin'],
        [0, -19.6, 'mall_directory'],
      ],
      S: [
        [-8, 21.5, 'mall_planter'],
        [8, 21.5, 'mall_planter'],
        [0, 19.6, 'mall_directory'],
        [11, 24.4, 'mall_trash_bin'],
        [-11, 24.4, 'mall_trash_bin'],
      ],
    },
    2: {
      W: [
        [-14, 'mall_planter'],
        [-9.5, 'mall_bench'],
        [1, 'mall_planter'],
        [9, 'mall_bench'],
        [15, 'mall_planter'],
      ],
      E: [
        [-14, 'mall_bench'],
        [-9.5, 'mall_planter'],
        [1, 'mall_bench'],
        [9, 'mall_planter'],
        [15, 'mall_bench'],
      ],
      N: [
        [8, -21.8, 'mall_planter'],
        [-6, -22.5, 'mall_bench'],
        [-10.5, -23.5, 'mall_trash_bin'],
        [0, -19.6, 'mall_directory'],
      ],
      S: [
        [8, 21.5, 'mall_planter'],
        [-8, 22.5, 'mall_bench'],
        [0, 19.6, 'mall_directory'],
        [11, 24.4, 'mall_trash_bin'],
        [-11, 24.4, 'mall_trash_bin'],
      ],
    },
  };
  for (const level of [1, 2]) {
    const y = LEVELS[level];
    for (const [z, kind] of sets[level].W) p.prop(kind, -15, z, y, 1);
    for (const [z, kind] of sets[level].E) p.prop(kind, 15, z, y, 1);
    for (const [x, z, kind] of sets[level].N) p.prop(kind, x, z, y, 0);
    for (const [x, z, kind] of sets[level].S) p.prop(kind, x, z, y, 0);
  }
  // Mostki: ławki przy przeciwległych balustradach (środek zostaje wolny).
  p.prop('mall_bench', -8.5, 3.6, LEVELS[1]);
  p.prop('mall_bench', 8.5, 5.4, LEVELS[1]);
  p.prop('mall_bench', -8.5, -5.4, LEVELS[2]);
  p.prop('mall_bench', 8.5, -3.6, LEVELS[2]);
  p.prop('mall_trash_bin', -11, 3.55, LEVELS[1]);
  p.prop('mall_trash_bin', 11, -3.55, LEVELS[2]);
  void k;
}

/** Skrzynie: 10 dużych przy kratach i 12 małych (chwytane Rezonansem) przy kioskach i na mostkach. */
function crates(k, p) {
  const big = [
    [-17, 12, 0],
    [-17, -12, 0],
    [17, 12, 0],
    [17, -12, 0],
    [-17, -12, 1],
    [17, -12, 1],
    [17, 12, 1],
    [-6, -24, 1],
    [-17, 12, 2],
    [17, -12, 2],
  ];
  for (const [x, z, level] of big) {
    const y = LEVELS[level];
    p.reserve(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), y);
    k.arena.block({
      position: vec(x, y + 0.5, z),
      size: vec(1, 1, 1),
      model: 'crate',
    });
  }
  const small = [
    [-5, 10, 0],
    [-9.9, 9, 0],
    [10.9, -10, 0],
    [6.4, -9, 0],
    [11, 2, 0],
    [6.3, 2, 0],
    [-9.5, -19.4, 1],
    [9.5, -19.4, 1],
    [-9.5, -19.4, 2],
    [9.5, -19.4, 2],
    [-3, 14, 0],
    [3, -16.6, 0],
  ];
  for (const [x, z, level] of small) {
    const y = LEVELS[level];
    p.reserve(R(x - 0.25, x + 0.25, z - 0.25, z + 0.25), y);
    k.arena.block({
      position: vec(x, y + 0.25, z),
      size: vec(0.5, 0.5, 0.5),
      model: 'crate_small',
    });
  }
}

/** Zagrożenia parteru: bramka laserowa kordonu, pole elektryczne przy fontannie, dwie beczki. */
function hazards(k, p) {
  k.hazards.push(
    {
      kind: 'laser_gate',
      id: 'south-security-cordon',
      from: vec(-4.5, 0.85, 16.5),
      to: vec(4.5, 0.85, 16.5),
      cycle: { onS: 2.6, offS: 1.8 },
    },
    {
      kind: 'electric_field',
      id: 'fountain-short-circuit',
      position: vec(-7.5, 1, -0.8),
      size: vec(2.2, 2, 3),
      cycle: { onS: 3, offS: 2.4 },
    },
    {
      kind: 'explosive_barrel',
      id: 'atrium-lift-cell',
      position: vec(9.5, 0, 7),
    },
    {
      kind: 'explosive_barrel',
      id: 'elevator-ups-cell',
      position: vec(-2.9, 0, -15.5),
    },
  );
  for (const x of [-5, 5]) {
    box(k, x, 0.6, 16.5, 0.2, 1.2, 0.2, 'machine', { walkable: false });
    box(k, x, 1.26, 16.5, 0.24, 0.12, 0.24, 'neon_amber', { walkable: false });
    p.reserve(R(x - 0.2, x + 0.2, 16.3, 16.7), 0);
  }
  for (const x of [-8.85, -6.15]) {
    box(k, x, 0.6, -0.8, 0.2, 1.2, 0.2, 'machine', { walkable: false });
    box(k, x, 1.26, -0.8, 0.24, 0.12, 0.24, 'neon_violet', { walkable: false });
  }
  k.light(-8.85, 1.45, -0.8, C.violet, 18, 8, {
    groundGlow: false,
    flicker: { pattern: 'buzz', strength: 0.3 },
  });
  k.fx('sparks', -7.5, 0.9, -0.8, 1.2);
  mark(k, 'floor_hazard', -7.5, 0.01, -0.8, 3.0, 3.8, 0, C.amber, 0.6);
  mark(k, 'floor_hazard', 0, 0.01, 16.5, 10.6, 0.9, 0, C.amber, 0.6);
}

/** Wejście główne za startem i wyjście ewakuacyjne na północy. */
function gates(k) {
  deco(k, 'mall_entrance_doors', 0, 0, 25.5, 0);
  k.arena.block({
    size: vec(4.8, 3, 0.3),
    position: vec(0, 1.5, 25.5),
    material: 'metal',
    visible: false,
  });
  k.neon('bar_24h', -2.35, 2.5, 27.6, 1.8, 0.9, Q, C.amber, 0.2);
  k.neon('sake', 2.35, 2.6, 28.4, 1.6, 0.8, -Q, C.violet, 0.2);
  k.neon('hotel', -2.35, 1.6, 29, 1.4, 0.7, Q, C.green, 0.3);
  k.light(0, 3.5, 27.5, C.violet, 14, 7, { floorY: 0, groundGlow: false });
  box(k, 0, 3.6, 27.5, 1.4, 0.1, 0.5, 'light_panel', { walkable: false });
  for (const [x, z] of [
    [-1, 25.1],
    [1.4, 24.2],
    [-0.4, 23.2],
    [0.9, 22.5],
  ])
    mark(k, 'puddle1', x, 0.01, z, 1.6, 1.2, x * 3, '#8fa5c8', 0.55);
  mark(k, 'puddle2', 0, 0.01, 27.5, 3.6, 2.4, 0, '#8fa5c8', 0.7);
  mark(k, 'mall_wet_footprints', -1.6, 0.01, 23.8, 1.2, 2.6, 0.4, C.warm, 0.48);
  mark(k, 'mall_wet_footprints', 1.8, 0.01, 22.6, 1.2, 2.4, -0.3, C.warm, 0.48);
  // Wyjście: zielony portal nad otworem i strzałki drogi ewakuacyjnej.
  k.neon('arrow', 0, 3.9, -24.9, 2.6, 1.0, 0, C.green, 0);
  box(k, 0, 3.55, -25.4, 5.0, 0.12, 0.3, 'neon_green', { walkable: false });
  k.light(0, 3.3, -25.6, C.green, 28, 13, { floorY: 0 });
  deco(k, 'mall_security_fixture', -3.2, 1.1, -25, Q * 0);
  for (const z of [-21, -17.5, 8, 13.5, 19])
    mark(k, 'floor_arrow', 0, 0.01, z, 1.4, 1.6, PI, C.green, 0.55);
  mark(k, 'mall_exit_stencil', 0, 0.01, -24.2, 2.2, 2.2, 0, C.warm, 0.85);
}

/** Pierścienie świetlne, listwy i oznaczenia posadzki. */
function floorMarks(k) {
  // Ośmioboczna rozeta z kamiennym środkiem: cienkie wkładki nad płytą fundamentu.
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    box(
      k,
      Math.sin(a) * 4.25,
      -0.014,
      Math.cos(a) * 4.25,
      3.6,
      0.04,
      0.85,
      'mall_terrazzo_inlay',
      {
        rotation: vec(0, a, 0),
        walkable: false,
      },
    );
  }
  // Mokre ślady i rozproszone kałuże pod świetlikiem, poza basenem fontanny.
  for (const [x, z, yaw] of [
    [-3.2, 13, 0.2],
    [2.5, 8, -0.3],
    [-2, -7, 0.5],
    [6.8, -11, -0.4],
  ]) {
    mark(k, 'puddle2', x, 0.01, z, 3.2, 1.8, yaw, '#8fa5c8', 0.48);
    mark(
      k,
      'mall_wet_footprints',
      x + 0.6,
      0.018,
      z + 1.7,
      1.1,
      2.6,
      yaw,
      C.warm,
      0.62,
    );
  }
  for (const s of [-1, 1]) {
    for (const z of [-12, -4, 4, 12])
      mark(k, 'mall_tactile_strip', s * 12.5, 0.01, z, 6, 0.4, Q, C.warm, 0.85);
    mark(k, 'mall_tactile_strip', s * 16.5, 0.01, 21, 5, 0.4, 0, C.warm, 0.85);
  }
  for (const level of [0, 1, 2]) {
    const y = LEVELS[level] + 0.01;
    for (const z of [-10, -2, 6, 14])
      for (const s of [-1, 1])
        mark(k, 'mall_tactile_strip', s * 17.2, y, z, 6, 0.3, Q, C.warm, 0.75);
  }
  // Pasy ostrzegawcze przed grzebieniami ruchomych schodów (zatrzymane: przejście jest wolne).
  const combs = [
    [4.8, 0, 17.0],
    [-4.8, 0, -6.8],
    [-4.8, 5.2, 5.6],
    [4.8, 5.2, -18.6],
    [4.8, 5.2, 5.4],
    [-4.8, 5.2, -18.4],
    [-4.8, 10.4, 17.2],
    [4.8, 10.4, -6.8],
  ];
  for (const [x, y, z] of combs) {
    mark(k, 'mall_escalator_comb', x, y + 0.01, z, 2.2, 0.8, 0, C.warm, 0.9);
    mark(k, 'mall_tactile_strip', x, y + 0.015, z, 2.2, 0.45, 0, C.warm, 0.9);
    for (const s of [-1, 1])
      box(k, x + s * 1.3, y + 0.5, z, 0.08, 1.0, 0.08, 'hivis', {
        walkable: false,
      });
  }
  for (const x of [-17, 17])
    for (const y of LEVELS)
      mark(
        k,
        'mall_tactile_strip',
        x,
        y + 0.01,
        -17.6,
        1.8,
        0.5,
        0,
        C.warm,
        0.9,
      );
}

/** Kasetony spodów balkonów i mostków: jasne pola otoczone ciemnym rusztem. */
function soffits(k) {
  const tile = (x, y, z, w, d) => {
    box(k, x, y, z, w, 0.04, d, 'mall_acoustic_ceiling', { walkable: false });
  };
  for (const level of [1, 2]) {
    const y = LEVELS[level] - 0.52;
    for (const s of [-1, 1]) {
      for (const x of [13.5, 16.5])
        for (const z of [
          -16.5, -13.5, -10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5, 13.5,
          16.5, 19.5, 22.5,
        ])
          tile(s * x, y, z, 2.85, 2.85);
    }
    for (const z of [-23.3, -20.3, 19.5, 22.5])
      for (const x of [-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5])
        tile(x, y, z, 2.85, 2.85);
    // Narożniki przy otworach klatek: wąski pas nie przecina biegów schodów.
    for (const s of [-1, 1])
      for (const z of [-23.3, -20.3]) {
        tile(s * 13, y, z, 1.85, 2.85);
        deco(k, 'mall_ceiling_panel', s * 13, y - 0.45, z, Q);
      }
    const z = level === 1 ? 4.5 : -4.5;
    for (const x of [-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5])
      tile(x, y, z, 2.85, 2.75);
    for (const x of [-7.5, 7.5])
      box(k, x, y - 0.03, z, 2, 0.02, 0.8, 'light_panel', {
        walkable: false,
      });
    for (const edge of [-1, 1])
      box(k, 0, y - 0.025, z + edge * 1.32, 23.5, 0.025, 0.06, 'light_panel', {
        walkable: false,
      });
  }
  // Sufit nad klatkami, bez zamykania otworów między kondygnacjami.
  for (const s of [-1, 1]) {
    for (const x of [15, 17])
      for (const z of [-23.3, -20.3]) tile(s * x, ROOF - 0.12, z, 1.85, 2.85);
    for (const y of [2.6, 7.8]) {
      tile(s * 16, y - SLAB - 0.08, -24.1, 3.85, 1.65);
      box(k, s * 16, y - SLAB - 0.11, -24.1, 1.4, 0.02, 0.65, 'light_panel', {
        walkable: false,
      });
    }
    for (const z of [-23.3, -20.3]) {
      deco(k, 'mall_ceiling_panel', s * 16, ROOF - 0.45, z, 0);
    }
  }
  // Podwieszane kasetony w obu przedsionkach.
  for (const [z, y, length] of [
    [28.25, 3.52, 4.5],
    [-27.75, 3.32, 5.5],
  ]) {
    for (const s of [-1, 1]) tile(s * 1.2, y, z, 2.25, length - 0.15);
    deco(k, 'mall_ceiling_panel', 0, y - 0.45, z, Q);
  }
}

/** Światła: świetlik, fontanna, winda, mostki, klucz. Każde światło ma widoczną oprawę. */
function lights(k) {
  // Fontanna: dwa niebieskie światła w basenie i bursztynowy rdzeń rzeźby (oprawy w modelu).
  k.light(-1.8, 0.8, 0, C.blue, 28, 14, { floorY: 0 });
  k.light(1.8, 0.8, 0, C.blue, 28, 14, { floorY: 0 });
  k.light(0, 2.8, 0, C.amber, 24, 12, { groundGlow: false });
  // Świetlik: dwa chłodne źródła w kratownicy.
  k.light(0, 16.4, -8, C.blue, 36, 22, { groundGlow: false });
  k.light(0, 16.4, 8, C.blue, 36, 22, { groundGlow: false });
  // Winda panoramiczna: kabina i szyb.
  k.light(0, 6.8, -16, C.blue, 26, 14, { floorY: 5.2 });
  k.light(0, 13.5, -16, C.amber, 20, 12, { groundGlow: false });
  // Mostki: słupki-latarnie na balustradzie.
  for (const [x, y, z] of [
    [-9, LEVELS[1], 3.2],
    [9, LEVELS[2], -3.2],
  ]) {
    box(k, x, y + 1.25, z, 0.12, 2.5, 0.12, 'metal', { walkable: false });
    box(k, x, y + 2.55, z, 0.5, 0.12, 0.5, 'light_panel', { walkable: false });
    k.light(x, y + 2.45, z, C.warm, 20, 12, { floorY: y });
  }
  // Pasaże: kasetony sufitowe (decor) w trzech rzędach na każdej kondygnacji, wybrane świecą.
  for (const level of [0, 1, 2]) {
    const y0 = LEVELS[level];
    const top = level === 2 ? ROOF : y0 + STORY - 0.06;
    const yaw = (a) => a;
    const panel = (x, z, rot) => {
      deco(k, 'mall_ceiling_panel', x, top - 0.45, z, yaw(rot));
      box(
        k,
        x,
        top - 0.46,
        z,
        rot ? 0.8 : 2.0,
        0.025,
        rot ? 2.0 : 0.8,
        'light_panel',
        { walkable: false },
      );
    };
    for (const s of [-1, 1])
      for (const z of [-15, -9, -3, 3, 9, 15, 21]) panel(s * 15, z, Q);
    for (const s of [-1, 1])
      for (const x of [-8, -2, 4, 10]) panel(x, s * 21.5, 0);
    // Listwy na spodach balkonów podkreślają krawędzie i oświetlają wizualnie stropy.
    if (level < 2) {
      for (const s of [-1, 1])
        box(k, s * 12.65, top - 0.12, 0, 0.1, 0.035, 35.6, 'light_panel', {
          walkable: false,
        });
      for (const z of [-18.65, 18.65])
        box(k, 0, top - 0.12, z, 22.5, 0.035, 0.1, 'light_panel', {
          walkable: false,
        });
    }
  }
  for (const [x, level, z, color, flicker] of [
    [-15, 0, -3, C.warm],
    [15, 0, 9, C.warm],
    [6, 0, 21.5, C.warm],
    [-6, 0, 21.5, C.warm],
    [-15, 1, 9, C.warm],
    [15, 1, -3, C.amber, { pattern: 'pulse', periodS: 2.4 }],
    [-15, 2, -3, C.warm],
    [15, 2, 9, C.amber, { pattern: 'pulse', periodS: 2.4 }],
  ]) {
    const y0 = LEVELS[level];
    const top = level === 2 ? ROOF : y0 + STORY - 0.06;
    k.light(x, top - 0.5, z, color, 32, 13, {
      floorY: y0,
      ...(flicker ? { flicker } : {}),
    });
  }
}

/** Szyldy i hologramy atrium; szyldy sklepów dodaje _run2Shops.mjs. */
function signage(k) {
  // Płaskie, dwustronne banery zastępują nieczytelne stożki projektorów w atrium.
  for (const [x, z, texture] of [
    [-8, -1, 'mall_new_collection'],
    [8, -1, 'mall_sale'],
  ]) {
    box(k, x, 9.0, z, 1.3, 1.95, 0.08, 'lacquer', { walkable: false });
    for (const dx of [-0.5, 0.5])
      box(k, x + dx, 12.8, z, 0.025, 5.6, 0.025, 'metal', { walkable: false });
    for (const yaw of [0, PI])
      k.neon(
        texture,
        x,
        9.0,
        z + (yaw ? -0.05 : 0.05),
        1.2,
        1.8,
        yaw,
        '#867d6c',
        0,
      );
  }
  for (const level of [0, 1, 2]) {
    const y = LEVELS[level];
    for (const s of [-1, 1]) {
      k.neon(
        `floor_l${level}`,
        s * 11.43,
        y + 2.5,
        9,
        1.8,
        0.9,
        -s * Q,
        C.warm,
        0,
      );
      k.neon(
        `floor_l${level}`,
        s * 14.5,
        y + 2.6,
        24.92,
        2.0,
        1.0,
        PI,
        C.warm,
        0,
      );
    }
    if (level)
      for (const x of [-8, 8])
        k.neon(
          'mall_new_collection',
          x,
          y + 0.6,
          18.0,
          0.7,
          1.05,
          PI,
          C.warm,
          0,
        );
  }
  // Oznaczenia klatek schodowych (zielone strzałki), na ścianie przy wejściach.
  k.neon('arrow', -17.9, 2.6, -21.5, 1.8, 0.8, Q, C.green, 0);
  k.neon('arrow', 17.9, 2.6, -21.5, 1.8, 0.8, -Q, C.green, 0);
}

/** Spawny: 6 na parterze, 5 na L1, 5 na L2 (z wysokością kondygnacji). */
export const SPAWNS = [
  [-16.8, 0, 8],
  [16.8, 0, 9],
  [-10.5, 0, 5],
  [10.5, 0, -4],
  [-10, 0, -20.5],
  [10.5, 0, -20.5],
  [-16.8, 5.2, 9],
  [16.8, 5.2, -9],
  [0, 5.2, 4.5],
  [0, 5.2, -21.5],
  [0, 5.2, 22],
  [-16.8, 10.4, 10],
  [16.8, 10.4, 10],
  [0, 10.4, -4.5],
  [-16.8, 10.4, -5],
  [3, 10.4, -21.5],
];

export function dress(k, placer) {
  groundFloor(k, placer);
  upperFloors(k, placer);
  crates(k, placer);
  hazards(k, placer);
  gates(k);
  floorMarks(k);
  soffits(k);
  lights(k);
  signage(k);
  // Słupy: szafki bezpieczeństwa (gaśnica, przycisk, kamera) na trzech kondygnacjach.
  for (const level of [0, 1, 2])
    for (const [x, z] of [
      [-12, -9],
      [-12, 9],
      [12, -9],
      [12, 9],
    ]) {
      const s = Math.sign(x);
      deco(
        k,
        'mall_security_fixture',
        x - s * 0.5,
        LEVELS[level] + 1.1,
        z,
        -s * Q,
      );
    }
  // Deszcz tylko nad świetlikiem: wnętrze galerii osłonięte do 15,8 m.
  k.rainShelters.push({ position: vec(0, 7.4, -3), size: vec(54, 18.4, 70) });
  k.arena.roomMeta({ weatherFloorY: 17.3 });
  void solid;
}
