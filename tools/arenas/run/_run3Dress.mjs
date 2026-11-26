// Oprawa wizualna, easter eggi, zagrożenia, skrzynie, światła i spawny mapy run3 (Sektor X-51).
import {
  COLOR,
  H_HALL,
  H_WING,
  PI,
  Q,
  R,
  Y_B1_CEIL,
  Y_B23_CEIL,
  Y_BASEMENT,
  Y_CATWALK,
  Y_PARTER,
  box,
  deco,
  vec,
} from './_run3Kit.mjs';

const C = COLOR;

/**
 * Mapa tekstur szyldów, plakatów i decali laboratorium (§4.2 docs/maps/run3.md).
 */
export const LAB_TEXTURES = {
  // --- Szyldy i tablice (public/assets/textures/signs/) ---
  lab_restricted_omega: 'lab_restricted_omega',
  lab_sector_x51: 'lab_sector_x51',
  lab_chimera_incubator: 'lab_chimera_incubator',
  lab_black_archive: 'lab_black_archive',
  lab_xenobio_lab: 'lab_xenobio_lab',
  lab_prototype_armory: 'lab_prototype_armory',
  lab_decon_lockers: 'lab_decon_lockers',
  lab_data_vault: 'lab_data_vault',
  lab_checkpoint: 'lab_checkpoint',
  lab_humanoid_tests: 'lab_humanoid_tests',
  lab_ground_floor: 'lab_ground_floor',
  lab_basement_floor: 'lab_basement_floor',

  // --- Easter Eggi i plakaty (public/assets/textures/decals/) ---
  poster_we_are_not_alone: 'poster_we_are_not_alone',
  plaque_evil_corp: 'plaque_evil_corp',
  note_object_07: 'note_object_07',
  board_resonance_profit: 'board_resonance_profit',
  sticky_code_0451: 'sticky_code_0451',
  note_intern_locker13: 'note_intern_locker13',
  cocoon_04_empty_hand: 'cocoon_04_empty_hand',

  // --- Notatki i oznakowanie BHP (public/assets/textures/decals/) ---
  lab_redacted_papers: 'lab_redacted_papers',
  lab_biohazard_warning: 'lab_biohazard_warning',
  lab_clearance_line: 'lab_clearance_line',
};

/** Pomocnik dodający naklejkę podłogową lub ścienną z `tint`. */
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
  opacity = 0.78,
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

/**
 * 16 punktów spawnu wrogów (§5.1 docs/maps/run3.md):
 * - 7 na Parterze (`y = 0.0 m`: P1..P5),
 * - 3 na Pomostach Piwnicy (`y = -1.6 m`: B1),
 * - 6 na Posadzce Piwnicy (`y = -5.2 m`: B1..B3).
 */
export const SPAWNS = [
  // Parter (7)
  [-18, 0, 17], // 1: P1 Punkt Kontrolny „Kordon Zero”
  [-15, 0, 10], // 2: P2 Czarne Archiwum — południe
  [-21, 0, 4], // 3: P2 Czarne Archiwum — przy oknie B1
  [18, 0, 17], // 4: P3 Laboratorium Biochemii
  [21, 0, 10], // 5: P4 Zbrojownia Prototypów — wschód
  [15, 0, 3], // 6: P4 Zbrojownia Prototypów — północ
  [0, 0, 5], // 7: P5 Centralny Hol — przed szybem windy
  // Pomosty B1 (3)
  [-18.5, -1.6, -16], // 8: B1 Pomost Obserwacyjny Zachodni
  [18.5, -1.6, -16], // 9: B1 Pomost Obserwacyjny Wschodni
  [0, -1.6, -22], // 10: B1 Mostek Centralny nad salą kokonów
  // Posadzka Piwnicy (6)
  [0, -5.2, -15], // 11: B1 Aleja środkowa między kokonami S
  [-26, -5.2, -18], // 12: B2 Szatnia Dekontaminacyjna
  [26, -5.2, -18], // 13: B3 Zaplecze Serwerowe „Krypta”
  [-10, -5.2, -28], // 14: B1 Gniazdo Kokonów NW
  [10, -5.2, -28], // 15: B1 Gniazdo Kokonów NE
  [0, -5.2, -39], // 16: B1 Strefa Ewakuacji przed exit
];

/** Skrzynie zniszczalne `crate` i dynamiczne `crate_small` (do Chwytu Rezonansem) na wszystkich poziomach. */
function crates(k, p) {
  // Ograniczona, celowa pula skrzyń interaktywnych obok ciemnych osłon (bez białych pudeł na osi 01-spawn!).
  const big = [
    // Parter: P1, P2, P3, P4 (przy stanowiskach bocznych)
    [-12.2, Y_PARTER, 22.8],
    [-18.0, Y_PARTER, 11.8],
    [18.0, Y_PARTER, 25.0],
    [18.0, Y_PARTER, 11.5],
    // Piwnica B1..B3
    [-10.0, Y_BASEMENT, -16.25],
    [10.0, Y_BASEMENT, -16.25],
    [-3.8, Y_BASEMENT, -41.0],
    [3.8, Y_BASEMENT, -41.0],
    [30.3, Y_BASEMENT, -24.2], // B3: częściowo zasłania tabliczkę EE-2 EVIL CORP w narożniku NE
  ];
  for (const [x, y, z] of big) {
    p.reserve(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), y);
    k.arena.block({
      position: vec(x, y + 0.5, z),
      size: vec(1, 1, 1),
      model: 'crate',
    });
  }

  const small = [
    // Parter
    [-16.8, Y_PARTER, 23.5],
    [-19.2, Y_PARTER, 11.8],
    [16.8, Y_PARTER, 25.0],
    [19.2, Y_PARTER, 11.5],
    // Pomosty B1 (przy murze zewnętrznym / w zatoce konsoli, >= 2.1 m wolnego przejścia!)
    [-19.5, Y_CATWALK, -12.0],
    [19.5, Y_CATWALK, -12.0],
    [-2.6, Y_CATWALK, -19.5],
    [2.6, Y_CATWALK, -19.5],
    // Piwnica B1..B3
    [-2.2, Y_BASEMENT, -9.5],
    [2.2, Y_BASEMENT, -9.5],
    [-2.8, Y_BASEMENT, -24.5],
    [2.8, Y_BASEMENT, -24.5],
    [-2.6, Y_BASEMENT, -36.5],
    [2.6, Y_BASEMENT, -35.0],
    [-23.0, Y_BASEMENT, -13.5],
    [23.0, Y_BASEMENT, -18.0],
  ];
  for (const [x, y, z] of small) {
    p.reserve(R(x - 0.25, x + 0.25, z - 0.25, z + 0.25), y);
    k.arena.block({
      position: vec(x, y + 0.25, z),
      size: vec(0.5, 0.5, 0.5),
      model: 'crate_small',
    });
  }
}

/** 4 zagrożenia środowiskowe (§5.2 docs/maps/run3.md) na Parterze i w Piwnicy. */
function hazards(k, p) {
  k.hazards.push(
    // 1. Bramka laserowa w P4 Zbrojowni Prototypów (y = 0.0 m)
    {
      kind: 'laser_gate',
      id: 'prototype-test-beam',
      from: vec(12.5, 0.85, 7.0),
      to: vec(16.2, 0.85, 7.0),
      cycle: { onS: 2.5, offS: 1.8 },
    },
    // 2. Przeciążone ogniwo plazmowe w P4 Zbrojowni Prototypów (y = 0.0 m)
    {
      kind: 'explosive_barrel',
      id: 'armory-plasma-cell',
      position: vec(23.5, 0.0, 3.0),
    },
    // 3. Rozlany elektrolit pod napięciem z pękniętego Kokonu 04 w B1 (spód na y = -5.2 m)
    {
      kind: 'electric_field',
      id: 'breached-cocoon-electrolyte',
      position: vec(-4.5, -4.2, -18.5),
      size: vec(3.0, 2.0, 3.6),
      cycle: { onS: 3.0, offS: 2.2 },
    },
    // 4. Zbiornik kriogeniczny przy północnym doku ewakuacyjnym w B1 (y = -5.2 m)
    {
      kind: 'explosive_barrel',
      id: 'cryo-tank-north',
      position: vec(4.5, -5.2, -37.5),
    },
  );
  p.reserve(R(23.0, 24.0, 2.5, 3.5), Y_PARTER);
  p.reserve(R(4.0, 5.0, -38.0, -37.0), Y_BASEMENT);
  // Słupki wyładowań i efekt iskier przy rozlanym elektrolicie Kokonu 04.
  for (const x of [-5.8, -3.2]) {
    p.reserve(R(x - 0.2, x + 0.2, -18.7, -18.3), Y_BASEMENT);
    box(k, x, Y_BASEMENT + 0.6, -18.5, 0.22, 1.2, 0.22, 'machine', {
      walkable: false,
    });
    box(k, x, Y_BASEMENT + 1.26, -18.5, 0.26, 0.12, 0.26, 'neon_violet', {
      walkable: false,
    });
  }
  k.fx('sparks', -4.5, Y_BASEMENT + 0.8, -18.5, 1.3);
  k.fx('sparks', 12.5, 0.85, 7.0, 0.9);
  mark(
    k,
    'floor_hazard',
    14.35,
    Y_PARTER + 0.01,
    7.0,
    4.2,
    0.8,
    0,
    C.amber,
    0.75,
  );
  mark(
    k,
    'puddle2',
    -4.5,
    Y_BASEMENT + 0.01,
    -18.5,
    3.6,
    4.0,
    0.2,
    C.green,
    0.7,
  );
  mark(
    k,
    LAB_TEXTURES.lab_biohazard_warning,
    -4.5,
    Y_BASEMENT + 0.015,
    -18.5,
    3.2,
    3.6,
    0,
    C.amber,
    0.65,
  );
}

/**
 * 8 Easter Eggów (§3.5 i §4.2 docs/maps/run3.md) oraz oznakowanie poziome i ścienne.
 * Wszystkie decale ścienne przylegają bezpośrednio do płaszczyzn bloków ścian (`gap <= 0.05 m`).
 */
function easterEggsAndDecals(k) {
  // EE-1 (P2, ściana zachodnia X = -25.8 przy biurku analityka): plakat UFO „WE ARE NOT ALONE”
  mark(
    k,
    LAB_TEXTURES.poster_we_are_not_alone,
    -25.78,
    1.85,
    11.0,
    1.2,
    1.8,
    Q,
    C.green,
    0.92,
    'wall',
  );
  // EE-2 (B3, północno-wschodni narożnik X = +31.78, Z = -24.6 za szafą serwerową):
  // zakurzona tabliczka „HEADQUARTERS OF EVIL CORP”
  mark(
    k,
    LAB_TEXTURES.plaque_evil_corp,
    31.78,
    Y_BASEMENT + 0.95,
    -24.6,
    1.5,
    0.75,
    -Q,
    C.amber,
    0.88,
    'wall',
  );
  // EE-3 (P3, na pierwszym stole z wirówkami i na posadzce obok): „OBIEKT NR 7 — NIE KAWIĆ PO PÓŁNOCY”
  mark(
    k,
    LAB_TEXTURES.note_object_07,
    15.2,
    Y_PARTER + 0.015,
    19.2,
    1.1,
    1.1,
    0,
    C.amber,
    0.9,
    'floor',
  );
  // EE-4: kubek „NAJLEPSZY LABORANT ROKU (POZOSTALI ZAGINĘLI)” jest wbudowany w model
  // `lab_mainframe_console` (materiał UV `mat_label_lab_mug`) na (0, 0, 9.5) + rozsypane akta obok.
  mark(
    k,
    LAB_TEXTURES.lab_redacted_papers,
    1.2,
    Y_PARTER + 0.012,
    10.4,
    1.2,
    1.2,
    0.3,
    C.warm,
    0.85,
    'floor',
  );
  // EE-5 (P2, tablica suchościeralna na ścianie zachodniej X = -25.73, Z = 3.2):
  // schemat „SKĄD SIĘ BIORĄ REZONANCI? -> ??? -> ZYSK KWARTALNY”
  mark(
    k,
    LAB_TEXTURES.board_resonance_profit,
    -25.72,
    1.65,
    3.2,
    1.8,
    1.15,
    Q,
    C.amber,
    0.92,
    'wall',
  );
  // EE-6 (P4, przy terminalu wejściowym X = 10.22, Z = 10.8, na pełnym segmencie ściany Z ∈ [9, 19]):
  // żółta karteczka „KOD: 0451”
  mark(
    k,
    LAB_TEXTURES.sticky_code_0451,
    10.22,
    1.35,
    10.8,
    0.55,
    0.55,
    Q,
    C.amber,
    0.95,
    'wall',
  );
  // EE-7 (B2, Szafka nr 13 przy ścianie zachodniej X = -31.78, Z = -18.0):
  // dziennik stażysty Kowalskiego o szeptach z kokonu nr 9
  mark(
    k,
    LAB_TEXTURES.note_intern_locker13,
    -31.78,
    Y_BASEMENT + 1.45,
    -18.0,
    0.95,
    0.95,
    Q,
    C.warm,
    0.9,
    'wall',
  );
  // EE-8 (B1, przy rozbitym Kokonie K-04 na (-7.5, -5.2, -18.5)):
  // tabliczka „ZBIORNIK 04 — STAN: PUSTY (SPRAWDZIĆ WENTYLACJĘ)” + mokre ślady stóp ku kratce wentylacyjnej!
  mark(
    k,
    LAB_TEXTURES.cocoon_04_empty_hand,
    -7.5,
    Y_BASEMENT + 0.015,
    -20.1,
    1.5,
    1.5,
    0,
    C.green,
    0.92,
    'floor',
  );
  mark(
    k,
    'mall_wet_footprints',
    -7.5,
    Y_BASEMENT + 0.018,
    -20.6,
    1.1,
    2.2,
    PI,
    C.green,
    0.85,
    'floor',
  );

  // Porozrzucane zaczernione akta ŚCIŚLE TAJNE w P2, P3, P5.
  for (const [x, z, yaw] of [
    [-19.8, 7.2, 0.4],
    [-16.2, 6.5, -0.5],
    [-21.5, 9.2, 0.2],
    [18.0, 21.0, -0.3],
    [-1.4, 8.6, 0.15],
  ]) {
    mark(
      k,
      LAB_TEXTURES.lab_redacted_papers,
      x,
      Y_PARTER + 0.012,
      z,
      1.3,
      1.3,
      yaw,
      C.warm,
      0.8,
      'floor',
    );
  }

  // Oznakowanie stref BIO-HAZARD i linii korytarzy komunikacyjnych na Parterze i w Piwnicy.
  for (const [x, y, z] of [
    [-18.0, Y_PARTER, 23.0],
    [18.0, Y_PARTER, 19.0],
    [-10.0, Y_BASEMENT, -11.5],
    [10.0, Y_BASEMENT, -11.5],
    [-10.0, Y_BASEMENT, -33.0],
    [10.0, Y_BASEMENT, -33.0],
  ]) {
    mark(
      k,
      LAB_TEXTURES.lab_biohazard_warning,
      x,
      y + 0.012,
      z,
      2.6,
      1.4,
      0,
      C.amber,
      0.75,
      'floor',
    );
  }

  // Linie prowadzące z Centralnego Holu P5 przez rampy do Sali Testów B1 i śluzy EXIT.
  for (const x of [-4.6, 4.6]) {
    for (const z of [4.0, 12.0, 20.0])
      mark(
        k,
        LAB_TEXTURES.lab_clearance_line,
        x,
        Y_PARTER + 0.01,
        z,
        6.5,
        0.42,
        Q,
        C.amber,
        0.85,
      );
    for (const z of [-18.0, -28.0, -37.0])
      mark(
        k,
        LAB_TEXTURES.lab_clearance_line,
        x,
        Y_BASEMENT + 0.01,
        z,
        6.5,
        0.42,
        Q,
        C.green,
        0.8,
      );
  }
  // Pasy ostrzegawcze i strefy autoryzacji na posadzce Centralnego Holu P5 oraz Galerii B1.
  for (const [z, w, h, tint] of [
    [22.5, 9.6, 0.75, C.amber],
    [18.5, 3.8, 1.4, C.amber],
    [14.5, 9.6, 0.75, C.blue],
    [9.5, 7.6, 2.2, C.amber],
    [0.6, 13.4, 0.85, C.amber],
  ])
    mark(k, 'floor_hazard', 0, Y_PARTER + 0.011, z, w, h, 0, tint, 0.72);
  for (const sx of [-1, 1]) {
    mark(k, 'floor_stop', sx * 4.6, Y_PARTER + 0.012, 1.2, 3.2, 0.8, PI, C.amber, 0.82);
    mark(
      k,
      LAB_TEXTURES.lab_clearance_line,
      sx * 12.5,
      Y_CATWALK + 0.01,
      -4.8,
      9.0,
      0.4,
      0,
      C.amber,
      0.85,
    );
    mark(k, 'floor_hazard', sx * 4.6, Y_CATWALK + 0.011, -6.1, 3.2, 0.75, 0, C.amber, 0.8);
    mark(k, 'floor_arrow', sx * 7.5, Y_PARTER + 0.01, 21.0, 1.4, 1.5, sx < 0 ? Q : -Q, C.amber, 0.55);
    mark(k, 'floor_arrow', sx * 7.5, Y_PARTER + 0.01, 7.0, 1.4, 1.5, sx < 0 ? Q : -Q, C.blue, 0.55);
  }
  for (const z of [23.8, 16.2, 12.2, 6.2, 2.8])
    mark(k, 'floor_arrow', 0, Y_PARTER + 0.01, z, 1.5, 1.7, PI, C.blue, 0.6);
  for (const z of [-11.5, -21.0, -30.5, -40.5])
    mark(
      k,
      'floor_arrow',
      0,
      Y_BASEMENT + 0.01,
      z,
      1.6,
      1.8,
      PI,
      C.green,
      0.58,
    );
  mark(
    k,
    'mall_exit_stencil',
    0,
    Y_BASEMENT + 0.012,
    -42.4,
    2.2,
    2.2,
    0,
    C.warm,
    0.85,
  );
}

/** Szyldy neonowe (`kind: "neon"`, zero stożków `holo` w osiach widoku!) nad portalami 8 pomieszczeń. */
function signage(k) {
  const neon = (texture, x, y, z, w, h, yaw, tint, flicker = 0) => {
    const width = Math.min(w, h * 2);
    k.neon(texture, x, y, z, width, width / 2, yaw, tint, flicker);
  };
  // P5 Centralny Hol: nad wejściem głównym, nad szybem windy i przed zejściem do B1.
  neon(LAB_TEXTURES.lab_sector_x51, 0, 4.3, 27.75, 3.6, 1.2, PI, C.blue, 0);
  neon(
    LAB_TEXTURES.lab_restricted_omega,
    0,
    5.2,
    0.25,
    3.8,
    1.1,
    0,
    C.amber,
    0.15,
  );
  // Nad bramami z Holu P5 do P1, P2, P3, P4 (na wysokości nadproża y = 3.85 m, przy ścianach X = ±10).
  neon(LAB_TEXTURES.lab_checkpoint, -9.75, 3.85, 21.0, 2.8, 0.9, Q, C.amber, 0);
  neon(
    LAB_TEXTURES.lab_black_archive,
    -9.75,
    3.85,
    7.0,
    2.8,
    0.9,
    Q,
    C.amber,
    0,
  );
  neon(
    LAB_TEXTURES.lab_xenobio_lab,
    9.75,
    3.85,
    21.0,
    2.8,
    0.9,
    -Q,
    C.green,
    0,
  );
  neon(
    LAB_TEXTURES.lab_prototype_armory,
    9.75,
    3.85,
    7.0,
    2.8,
    0.9,
    -Q,
    C.violet,
    0,
  );
  // Wewnątrz P1..P4 nad grodziami między skrzydłami (Z = 14).
  neon(
    LAB_TEXTURES.lab_black_archive,
    -18.0,
    3.85,
    14.25,
    2.6,
    0.85,
    0,
    C.warm,
    0,
  );
  neon(
    LAB_TEXTURES.lab_prototype_armory,
    18.0,
    3.85,
    14.25,
    2.6,
    0.85,
    0,
    C.violet,
    0,
  );
  // B1 Wielka Sala Testów Humanoidalnych: główny szyld Projektu Chimera, bramy B2/B3 oraz portal EXIT.
  neon(
    LAB_TEXTURES.lab_chimera_incubator,
    0,
    2.4,
    -3.65,
    4.0,
    1.2,
    PI,
    C.green,
    0,
  );
  neon(
    LAB_TEXTURES.lab_ground_floor,
    -8.2,
    2.2,
    -0.25,
    2.8,
    0.9,
    PI,
    C.blue,
    0,
  );
  neon(LAB_TEXTURES.lab_ground_floor, 8.2, 2.2, -0.25, 2.8, 0.9, PI, C.blue, 0);
  neon(
    LAB_TEXTURES.lab_basement_floor,
    -19.75,
    -0.3,
    -38.8,
    2.4,
    1.2,
    Q,
    C.warm,
  );
  neon(
    LAB_TEXTURES.lab_basement_floor,
    19.75,
    -0.3,
    -38.8,
    2.4,
    1.2,
    -Q,
    C.warm,
  );
  neon(LAB_TEXTURES.lab_humanoid_tests, 0, 0.4, -0.25, 4.8, 1.6, PI, C.warm);
  // Lico zachodniego muru B1 przy północnej rampie (prawa strona corner-nw).
  mark(
    k,
    LAB_TEXTURES.lab_clearance_line,
    -19.79,
    -0.15,
    -35,
    2.4,
    1.2,
    Q,
    C.warm,
    0.95,
    'wall',
  );
  // Oznaczenia sektorów (numery gniazd kokonów) na ścianach bocznych B1 oraz na Mostku Centralnym.
  for (const [x, z, yaw, tint] of [
    [-19.45, -16.25, Q, C.green],
    [19.45, -16.25, -Q, C.blue],
    [-19.45, -28.25, Q, C.green],
    [19.45, -28.25, -Q, C.blue],
  ])
    neon(LAB_TEXTURES.lab_chimera_incubator, x, 0.2, z, 2.8, 0.9, yaw, tint, 0);
  for (const sx of [-1, 1]) {
    neon(
      LAB_TEXTURES.lab_restricted_omega,
      sx * 9.5,
      Y_CATWALK - 0.2,
      -20.42,
      2.4,
      0.7,
      0,
      C.amber,
      0,
    );
    neon(
      LAB_TEXTURES.lab_chimera_incubator,
      sx * 9.5,
      Y_CATWALK - 0.2,
      -23.58,
      2.4,
      0.7,
      PI,
      sx < 0 ? C.green : C.blue,
      0,
    );
  }
  neon(
    LAB_TEXTURES.lab_decon_lockers,
    -19.75,
    Y_BASEMENT + 3.45,
    -14.0,
    2.4,
    0.75,
    Q,
    C.green,
    0,
  );
  neon(
    LAB_TEXTURES.lab_decon_lockers,
    -19.75,
    Y_BASEMENT + 3.45,
    -22.0,
    2.4,
    0.75,
    Q,
    C.amber,
    0,
  );
  neon(
    LAB_TEXTURES.lab_data_vault,
    19.75,
    Y_BASEMENT + 3.45,
    -14.0,
    2.4,
    0.75,
    -Q,
    C.blue,
    0,
  );
  neon(
    LAB_TEXTURES.lab_data_vault,
    19.75,
    Y_BASEMENT + 3.45,
    -22.0,
    2.4,
    0.75,
    -Q,
    C.violet,
    0,
  );
  // Portal wyjścia ewakuacyjnego EXIT na północnej ścianie B1 (Z = -43.75).
  k.neon('arrow', 0, Y_BASEMENT + 3.8, -43.75, 2.8, 1.0, 0, C.green, 0);
  box(k, 0, Y_BASEMENT + 3.35, -43.8, 4.6, 0.14, 0.25, 'neon_green', {
    walkable: false,
  });
}

/**
 * 22 źródła światła `lights[]` (§5.3 docs/maps/run3.md):
 * - 10 na Parterze (`floorY: 0`),
 * - 12 w Piwnicy (`floorY: -5.2` lub `-1.6`),
 * - 100% bez `cone: true` (0 smug wolumetrycznych!).
 */
function lights(k) {
  // --- PARTER (10 źródeł) ---
  // P5 Centralny Hol (3)
  k.light(0, 5.95, 18.5, C.warm, 30, 14, { floorY: Y_PARTER });
  k.light(0, 5.95, 9.5, C.blue, 28, 14, { floorY: Y_PARTER });
  k.light(0, 4.2, -1.2, C.amber, 26, 13, {
    floorY: Y_PARTER,
    flicker: { pattern: 'pulse', periodS: 2.2 },
  });
  // P1 Kordon Zero (2)
  k.light(-18, 4.35, 21.0, C.amber, 26, 12, { floorY: Y_PARTER });
  k.light(-22, 4.35, 24.0, C.warm, 22, 10, { floorY: Y_PARTER });
  // P2 Czarne Archiwum (2)
  k.light(-18, 4.35, 7.0, C.warm, 28, 12, { floorY: Y_PARTER });
  k.light(-24.5, 3.2, 7.0, C.amber, 18, 8, {
    floorY: Y_PARTER,
    groundGlow: false,
  });
  // P3 Lab. Biochemii (2)
  k.light(18, 4.35, 21.0, C.green, 26, 12, { floorY: Y_PARTER });
  k.light(23.5, 4.35, 21.0, C.blue, 22, 10, { floorY: Y_PARTER });
  // P4 Zbrojownia Prototypów (1)
  k.light(18, 4.35, 7.0, C.violet, 32, 13, {
    floorY: Y_PARTER,
    flicker: { pattern: 'buzz', strength: 0.25 },
  });

  // --- PIWNICA (12 źródeł) ---
  // B1 Sala Testów Humanoidalnych (8):
  // 4 główne źródła w centrach 4 gniazd kokonów pod kolektorami `lab_ceiling_manifold`
  k.light(-10, -0.9, -16.2, C.green, 38, 16, { floorY: Y_BASEMENT });
  k.light(10, -0.9, -16.2, C.blue, 38, 16, { floorY: Y_BASEMENT });
  k.light(-10, -0.9, -28.2, C.green, 38, 16, { floorY: Y_BASEMENT });
  k.light(10, -0.9, -28.2, C.blue, 38, 16, { floorY: Y_BASEMENT });
  // 1 źródło nad Mostkiem Centralnym
  k.light(0, 3.95, -22.0, C.amber, 26, 14, { floorY: Y_CATWALK });
  // 1 źródło nad spocznikiem pośrednim ramp
  k.light(0, 3.95, -5.0, C.warm, 24, 13, { floorY: Y_CATWALK });
  // 1 źródło fioletowe przy rozlanym elektrolicie Kokonu 04
  k.light(-4.5, -3.5, -18.5, C.violet, 20, 9, {
    floorY: Y_BASEMENT,
    groundGlow: false,
    flicker: { pattern: 'buzz', strength: 0.35 },
  });
  // 1 zielony portal nad śluzą wyjściową exit
  k.light(0, -1.6, -43.5, C.green, 34, 15, { floorY: Y_BASEMENT });

  // B2 Szatnia Dekontaminacyjna (2)
  k.light(-26, -1.25, -18.0, C.warm, 24, 11, { floorY: Y_BASEMENT });
  k.light(-26, -1.25, -24.2, C.green, 18, 9, { floorY: Y_BASEMENT });

  // B3 Zaplecze Serwerowe (2)
  k.light(26, -1.25, -14.5, C.blue, 24, 11, { floorY: Y_BASEMENT });
  k.light(26, -1.25, -21.5, C.violet, 24, 11, { floorY: Y_BASEMENT });
}

export function dress(k, placer) {
  crates(k, placer);
  hazards(k, placer);
  easterEggsAndDecals(k);
  signage(k);
  lights(k);
  // Cały kompleks podziemny jest osłonięty przed opadami.
  k.rainShelters.push({
    position: vec(0, 0.5, -8),
    size: vec(68, 16, 76),
  });
  k.arena.roomMeta({ weatherFloorY: 8.0 });
  void deco;
  void H_HALL;
  void H_WING;
  void Y_B1_CEIL;
  void Y_B23_CEIL;
}
