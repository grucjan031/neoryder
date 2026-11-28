// Oprawa wizualna Elektrowni Fuzyjnej Kurogane Arms — Kompleks Helios-IV (run8):
// - Proceduralny Set Piece Reaktora Fuzyjnego (`setPieces: [{ kind: 'fusionReactor' }]`),
// - 8 naukowców Kurogane Arms (`civilians[]`) i 20 punktów ucieczki (`hideSpots[]`),
// - 18 punktów spawnu wrogów na 3 poziomach wysokości (`y = 0.0, +4.8, +9.6 m`),
// - 4 zagrożenia środowiskowe (`hazards[]`),
// - 12 Easter Eggów (`EE-01..EE-12`), szyldy (`signs[]`), skrzynie (`crate`/`crate_small`) i 24 źródła światła (`lights[]`).
import {
  COLOR,
  PI,
  Q,
  R,
  Y_G1,
  Y_G2,
  Y_L0,
  box,
  vec,
} from './_run8Kit.mjs';

const C = COLOR;

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
  opacity = 0.85,
  surface = 'floor',
  textureFolder,
  textureBand,
) {
  k.decals.push({
    texture,
    surface,
    ...(textureFolder && { textureFolder }),
    ...(textureBand && { textureBand }),
    position: vec(x, y, z),
    yaw,
    size: { w, h },
    tint,
    opacity,
  });
}

/**
 * Proceduralny Set Piece Reaktora Fuzyjnego (Tokamak „Kurogane Helios-IV”) w sercu Hali R2 (§4.1 docs/maps/run8.md).
 */
export const SET_PIECES = [
  {
    kind: 'fusionReactor',
    position: vec(0, 0, 0),
    yaw: 0,
    scale: 1,
  },
];

/**
 * 8 naukowców Kurogane Arms (§5.2 docs/maps/run8.md) w pomieszczeniach R2, R3, R4, R7, R8.
 */
export const CIVILIANS = [
  // C1: R2 Hala Reaktora — Zachód (y = 0.00 m)
  { id: 'scientist', position: vec(-10.5, Y_L0, 0.0), yaw: 0.0 },
  // C2: R2 Hala Reaktora — Wschód (y = 0.00 m)
  { id: 'scientist', position: vec(10.5, Y_L0, 0.0), yaw: 3.14 },
  // C3: R4 Laboratorium Plazmy — N (y = 0.00 m)
  { id: 'scientist', position: vec(-29.0, Y_L0, -15.0), yaw: 1.57 },
  // C4: R4 Laboratorium Plazmy — S (y = 0.00 m)
  { id: 'scientist', position: vec(-34.0, Y_L0, -6.0), yaw: -1.57 },
  // C5: R3 Sterownia Główna — W (y = +4.80 m)
  { id: 'scientist', position: vec(-11.0, Y_G1, -26.5), yaw: 0.0 },
  // C6: R3 Sterownia Główna — E (y = +4.80 m)
  { id: 'scientist', position: vec(-3.0, Y_G1, -26.5), yaw: 0.0 },
  // C7: R7 Serwerownia Diagnostyczna (y = 0.00 m)
  { id: 'scientist', position: vec(31.0, Y_L0, -16.5), yaw: 3.14 },
  // C8: R8 Biuro Kierownika Naukowego — Dr Haruto Mori (y = +4.80 m)
  { id: 'scientist', position: vec(14.0, Y_G1, -28.0), yaw: 0.0 },
];

/**
 * 20 kryjówek naukowców `hideSpots[]` (§5.3 docs/maps/run8.md — po 4 na każde z 5 pomieszczeń z naukowcami).
 */
export const HIDE_SPOTS = [
  // R2 — Główna Hala Reaktora (y = 0.00 m, 4 kryjówki dla C1, C2)
  vec(-19.5, Y_L0, -16.5), // HS-01: narożnik NW pod Galerią G1-W za bankiem kondensatorów
  vec(-19.5, Y_L0, 10.5), // HS-02: nisza SW pod Galerią G1-W za transformatorem impulsowym
  vec(19.5, Y_L0, -16.5), // HS-03: narożnik NE pod Galerią G1-E za kolektorem chłodziwa
  vec(19.5, Y_L0, 10.5), // HS-04: nisza SE pod Galerią G1-E za wschodnim transformatorem
  // R3 — Sterownia Główna Reaktora (y = +4.80 m, 4 kryjówki dla C5, C6)
  vec(-20.5, Y_G1, -34.5), // HS-05: narożnik NW za zachodnią szafą telemetrii
  vec(-13.5, Y_G1, -23.2), // HS-06: za pełnym parapetem pod oknem obserwacyjnym Sterowni
  vec(-2.5, Y_G1, -23.2), // HS-07: za wschodnim segmentem konsoli pod oknem obserwacyjnym
  vec(4.5, Y_G1, -34.5), // HS-08: narożnik NE Sterowni za szafą zasilania awaryjnego
  // R4 — Laboratorium Fizyki Plazmy (y = 0.00 m, 4 kryjówki dla C3, C4)
  vec(-36.5, Y_L0, -20.5), // HS-09: narożnik NW za północną komorą próżniową
  vec(-36.5, Y_L0, -11.0), // HS-10: za stołem z oscyloskopami przy ścianie zachodniej
  vec(-36.5, Y_L0, -2.0), // HS-11: narożnik SW za południową aparaturą próżniową
  vec(-23.5, Y_L0, -20.5), // HS-12: narożnik NE za szafą sterowników wiązki
  // R7 — Serwerownia Diagnostyczna (y = 0.00 m, 4 kryjówki dla C7)
  vec(36.5, Y_L0, -20.5), // HS-13: narożnik NE za agregatem chłodzenia cieczowego
  vec(36.5, Y_L0, -11.0), // HS-14: wnęka wschodnia za środkowym rzędem szaf kwantowych
  vec(36.5, Y_L0, -5.5), // HS-15: narożnik SE przy ścianie działowej z Halą Turbin
  vec(23.5, Y_L0, -20.5), // HS-16: narożnik NW za konsolą diagnostyczną
  // R8 — Biuro Kierownika Naukowego (y = +4.80 m, 4 kryjówki dla C8)
  vec(14.0, Y_G1, -31.2), // HS-17: bezpośrednio za masywnym korpusem biurka fus_director_desk
  vec(20.5, Y_G1, -34.5), // HS-18: narożnik NE za regałem archiwalnym i komorą plazmy
  vec(8.0, Y_G1, -34.5), // HS-19: narożnik NW za szafą pancerną z dokumentami
  vec(20.5, Y_G1, -23.5), // HS-20: narożnik SE za sofą gabinetową
];

/**
 * 18 punktów spawnu wrogów Kurogane (`spawnPoints` na 3 poziomach wysokości — §7.1 docs/maps/run8.md):
 * - 10 na Poziomie Głównym (`y = 0.0 m`: R2, R4, R5, R6, R7),
 * - 5 na Poziomie Galerii G1 (`y = +4.8 m`: R2-G1W, R2-G1E, R3, R8),
 * - 3 na Poziomie Galerii Górnej G2 (`y = +9.6 m`: R2-G2W, R2-G2N, R2-G2E).
 */
export const SPAWNS = [
  // Poziom Główny L0 (10)
  [-8, Y_L0, 14], // 1: R2 Hala Reaktora — SW (za południowo-zachodnią kriopompą)
  [8, Y_L0, 14], // 2: R2 Hala Reaktora — SE (za południowo-wschodnią kriopompą)
  [-13, Y_L0, 2], // 3: R2 Hala Reaktora — W (zachodni łuk obejścia Tokamaka)
  [13, Y_L0, 2], // 4: R2 Hala Reaktora — E (wschodni łuk obejścia Tokamaka)
  [-8, Y_L0, -13], // 5: R2 Hala Reaktora — NW (przed Rampą #3 L0 -> G1)
  [8, Y_L0, -13], // 6: R2 Hala Reaktora — NE (przed Rampą #4 L0 -> G1)
  [-28, Y_L0, -11], // 7: R4 Laboratorium Fizyki Plazmy (między ławami inżektorów)
  [-28, Y_L0, 16], // 8: R5 Magazyn Paliwa — Deuter/Tryt (pod suwnicą)
  [26, Y_L0, 15], // 9: R6 Hala Turbin i Wymienników Ciepła
  [26, Y_L0, -18], // 10: R7 Serwerownia Diagnostyczna
  // Poziom Galerii G1 (5)
  [-20, Y_G1, 0], // 11: R2-G1W Galeria Techniczna Zachodnia
  [20, Y_G1, 0], // 12: R2-G1E Galeria Techniczna Wschodnia
  [-14, Y_G1, -30], // 13: R3 Sterownia Główna — zachód
  [-2, Y_G1, -30], // 14: R3 Sterownia Główna — wschód
  [11, Y_G1, -26], // 15: R8 Biuro Kierownika Naukowego
  // Poziom Galerii Górnej G2 (3)
  [-20.4, Y_G2, -6], // 16: R2-G2W Galeria Górna Zachodnia
  [0, Y_G2, -20.4], // 17: R2-G2N Galeria Górna Północna (nad oknem Sterowni R3)
  [20.4, Y_G2, -6], // 18: R2-G2E Galeria Górna Wschodnia
];

/** Skrzynie interaktywne `crate` i `crate_small` do Chwytu Rezonansem (§3.5.1, §7.4). */
function crates(k, p) {
  const big = [
    [-25.5, Y_L0, 14.5], // R5 Magazyn Paliwa
    [25.2, Y_L0, 5.5], // R6 Hala Turbin
    [-19.5, Y_L0, 2.5], // R2 Hala Reaktora — pod Galerią Zachodnią
    [19.5, Y_L0, 2.5], // R2 Hala Reaktora — pod Galerią Wschodnią
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
    // R1 Szatnia i Śluza Dekontaminacyjna (3 skrzynie gotowe do Chwytu Rezonansem wg §3.5.1)
    [-9.2, Y_L0, 29.5],
    [9.2, Y_L0, 29.5],
    [-9.2, Y_L0, 24.0],
    // R2, R4, R5, R6, R7
    [-13.5, Y_L0, -9.5],
    [13.5, Y_L0, -9.5],
    [-33.0, Y_L0, -11.0],
    [-30.5, Y_L0, 3.5],
    [33.5, Y_L0, 9.0],
    [33.5, Y_L0, -11.5],
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

/** 4 zagrożenia środowiskowe (§7.2 docs/maps/run8.md). */
function hazards(k, p) {
  k.hazards.push(
    // 1. Przeciążona sekcja kondensatorów po zachodniej stronie Hali Reaktora R2 (y = 0.0 m)
    {
      kind: 'electric_field',
      id: 'reactor-west-capacitor-arc',
      position: vec(-16.0, Y_L0 + 1.0, -3.0),
      size: vec(2.8, 2.0, 3.2),
      cycle: { onS: 2.8, offS: 2.0 },
    },
    // 2. Bramka laserowa grodząca zachodni sektor składowania trytu w R5 Magazynie Paliwa (y = 0.0 m)
    {
      kind: 'laser_gate',
      id: 'fuel-vault-isotope-laser',
      from: vec(-36.5, Y_L0 + 0.85, 11.0),
      to: vec(-29.5, Y_L0 + 0.85, 11.0),
      cycle: { onS: 2.6, offS: 1.8 },
    },
    // 3. Bramka laserowa zabezpieczająca północny rząd szaf kwantowych w R7 Serwerowni (y = 0.0 m)
    {
      kind: 'laser_gate',
      id: 'server-coil-control-laser',
      from: vec(24.0, Y_L0 + 0.85, -13.0),
      to: vec(30.0, Y_L0 + 0.85, -13.0),
      cycle: { onS: 2.2, offS: 1.6 },
    },
    // 4. Nadciśnieniowy zbiornik chłodziwa między turbinami w R6 Hali Turbin (y = 0.0 m)
    {
      kind: 'explosive_barrel',
      id: 'turbine-hall-coolant-barrel',
      position: vec(29.5, Y_L0, 9.0),
    },
  );
  p.reserve(R(29.0, 30.0, 8.5, 9.5), Y_L0);

  // Efekty iskier i pary wokół Tokamaka oraz zagrożeń (§4.2, §7.2).
  k.fx('sparks', -16.0, Y_L0 + 0.9, -3.0, 1.2);
  k.fx('sparks', -33.0, Y_L0 + 0.85, 11.0, 0.9);
  k.fx('sparks', 27.0, Y_L0 + 0.85, -13.0, 0.9);
  for (const [x, z] of [
    [-5.8, -5.8],
    [5.8, -5.8],
    [-5.8, 5.8],
    [5.8, 5.8],
  ]) {
    k.fx('steam', x, Y_L0 + 0.25, z, 0.85);
  }
}

/**
 * 12 Easter Eggów (`EE-01..EE-12`, §6.3 docs/maps/run8.md) oraz oznakowanie posadzkowe i maty dielektryczne.
 * Wszystkie naklejki ścienne (`surface: "wall"`) leżą najwyżej 0,10 m od lica ściany nośnej (nauczka #3).
 * Dywan w R8 oraz maty dielektryczne w R3 są płaskimi `decals` (`surface: "floor"`), więc żaden spawn nie jest w bloku (nauczka #5).
 */
function decalsAndEasterEggs(k) {
  // Maty podłogowe w sterowni i gabinecie.
  mark(
    k,
    'fus_dielectric_floor_mat',
    -8.0,
    Y_G1 + 0.012,
    -28.5,
    2.4,
    2.4,
    0,
    '#ffffff',
    0.72,
  );
  mark(
    k,
    'fus_dielectric_floor_mat',
    14.0,
    Y_G1 + 0.012,
    -26.5,
    2.2,
    2.2,
    0,
    '#ffffff',
    0.75,
  );
  // 2. Żółto-czarne pasy ostrzegawcze wokół podstawy Tokamaka (R = 9.7 m oraz R = 15.5 m) w Hali Reaktora R2 oraz w R4, R5 i R6.
  for (let i = 0; i < 8; i++) {
    const a = (i * PI) / 4;
    const r = 9.75;
    mark(
      k,
      'fus_floor_magnetic_hazard',
      Math.round(r * Math.sin(a) * 100) / 100,
      Y_L0 + 0.012,
      Math.round(r * Math.cos(a) * 100) / 100,
      1.8,
      1.8,
      a,
      '#ffffff',
      0.92,
    );
  }
  for (const [x, z, yaw] of [
    [0, 15.5, 0],
    [0, -15.5, PI],
    [-15.5, 0, Q],
    [15.5, 0, -Q],
    [-30.0, -11.0, 0],
    [-30.0, 11.0, 0],
    [26.5, 9.0, Q],
  ]) {
    mark(
      k,
      'fus_floor_magnetic_hazard',
      x,
      Y_L0 + 0.012,
      z,
      1.6,
      1.6,
      yaw,
      '#ffffff',
      0.86,
    );
  }

  // EE-01 (`run1` Magazyn K-09): manifest dostawy cewek w R5 Magazynie Paliwa (0.03 m od ściany S Z = +21.8).
  mark(
    k,
    'fus_ee_run1_run2_logistics',
    -30.0,
    Y_L0 + 3.05,
    21.77,
    1.45,
    0.91,
    PI,
    '#ffffff',
    0.96,
    'wall',
    undefined,
    [0, 0.625],
  );

  // EE-02 (`run2` Galeria Atrium Nova): wykres zrzutu mocy 400 MW w R6 Hali Turbin (0.03 m od ściany E X = +37.8).
  mark(
    k,
    'fus_ee_run1_run2_logistics',
    37.77,
    Y_L0 + 1.6,
    13.0,
    1.45,
    0.545,
    -Q,
    '#ffffff',
    0.96,
    'wall',
    undefined,
    [0.625, 1],
  );

  // EE-03 (`run3` Sektor X-51): pilny telegram o zasilaniu Komory Kokonów nr 04 w R4 Lab Plazmy (0.03 m od ściany W X = -37.8).
  mark(
    k,
    'fus_ee_run3_run4_directives',
    -37.77,
    Y_L0 + 1.65,
    -15.0,
    1.1,
    1.1,
    Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-04 (`run4` Piętro 62 Kurogane Tower): okólnik Zarządu na biurku `fus_director_desk` w R8 (14.0, 4.8, -29.5).
  mark(
    k,
    'fus_ee_run3_run4_directives',
    13.55,
    Y_G1 + 0.866,
    -29.24,
    0.52,
    0.52,
    0.15,
    '#ffffff',
    0.96,
  );

  // EE-05 (`run5` Klinika Helixa): skierowanie na kalibrację Akordu w R1 Szatni-Dekontaminacji (0.03 m od ściany W X = -11.8).
  mark(
    k,
    'fus_ee_run5_run6_coalition',
    -11.77,
    Y_L0 + 1.6,
    23.45,
    1.3,
    0.675,
    Q,
    '#ffffff',
    0.96,
    'wall',
    undefined,
    [0, 0.52],
  );

  // EE-06 (`run6` Nocny Targ): protokół konfiskaty Helu-3 i zupy rybnej w R5 Magazynie Paliwa (0.03 m od ściany W X = -37.8).
  mark(
    k,
    'fus_ee_run5_run6_coalition',
    -37.77,
    Y_L0 + 1.55,
    6.0,
    1.3,
    0.62,
    Q,
    '#ffffff',
    0.96,
    'wall',
    undefined,
    [0.52, 1],
  );

  // EE-07 (`run7` Rezydencja Pułkownika Vane'a „Willa Kuroyama”): osobisty rozkaz Pułkownika Vane'a na biurku dr. Moriego w R8.
  mark(
    k,
    'fus_ee_run7_vane_memo',
    14.20,
    Y_G1 + 0.866,
    -29.24,
    0.52,
    0.52,
    -0.18,
    '#ffffff',
    0.96,
  );

  // EE-08, 09 i 11: Kurier, stacja Kamienna i rdzeń Akord-Helios na tablicy Moriego.
  // Po odsunięciu przez DecalRenderer naklejka leży nad kreskami tablicy.
  mark(k, 'fus_director_resonance_board', 21.72, Y_G1 + 1.93, -29.5,
    3.0, 1.5, -Q, '#ffffff', 1, 'wall');

  // EE-10 wyświetlają modele ścian telemetrii w R3, R7 i R8.
  mark(k, 'screen_fus_grid', 37.77, Y_L0 + 1.75, 11.8,
    0.95, 0.95, -Q, '#ffffff', 1, 'wall', 'screens');
  mark(k, 'screen_fus_tritium', -37.77, Y_L0 + 1.75, 11.5,
    1.0, 1.0, Q, '#ffffff', 1, 'wall', 'screens');

  // EE-11: podpis prototypu nad komorą, z dolnego wiersza tablicy Moriego.
  mark(k, 'fus_director_resonance_board', 17.8, Y_G1 + 2.68, -35.77,
    1.9, 0.15, 0, '#ffffff', 1, 'wall', undefined, [0.79, 0.94]);

  // EE-12: kod 0451 przy zachodniej konsoli sterowni.
  mark(k, 'label_tritium_cask', -21.77, Y_G1 + 1.55, -28.8,
    1.15, 0.21, Q, '#ffffff', 1, 'wall', 'labels', [0.73, 0.91]);

  // Oznaczenie wyjścia ewakuacyjnego EXIT przed północną śluzą w Sterowni Głównej R3 (X = -8.0, Z = -34.4).
  mark(
    k,
    'mall_exit_stencil',
    -8.0,
    Y_G1 + 0.012,
    -34.4,
    2.2,
    2.2,
    0,
    C.green,
    0.88,
  );
}

/** Szyldy neonowe stref technologicznych (`kind: "neon"`, 0 stożków `holo`!) na kondygnacjach L0 i G1 (§6.2). */
function signage(k) {
  const neon = (texture, x, y, z, w, yaw) =>
    k.neon(texture, x, y, z, w, w / 2, yaw, '#ffffff', 0);

  // R1 / R2: nad Portalem Głównym do Hali Reaktora (Z = +22, X = 0)
  neon('fus_helios_reactor_hall', 0, Y_L0 + 4.25, 22.24, 3.4, 0);
  neon('fus_helios_reactor_hall', 0, Y_L0 + 4.25, 21.76, 3.4, PI);

  // R3 Sterownia Główna (nad portalami z Galerii Północnej G1-N, Z = -22, y = +4.8 m)
  neon('fus_main_control_room', -18.0, Y_G1 + 4.15, -21.76, 2.8, 0);
  neon('fus_main_control_room', 3.0, Y_G1 + 4.15, -21.76, 2.8, 0);

  // R4 Laboratorium Fizyki Plazmy (X = -22, nad portalami Z = -14 i Z = -3)
  neon('fus_plasma_lab', -21.76, Y_L0 + 4.2, -14.0, 2.8, Q);
  neon('fus_plasma_lab', -21.76, Y_L0 + 4.2, -3.0, 2.8, Q);

  // R5 Magazyn Paliwa Fuzyjnego Deuter / Tryt (X = -22, nad portalami Z = +5 i Z = +15)
  neon('fus_fuel_storage_dt', -21.76, Y_L0 + 4.2, 5.0, 2.8, Q);
  neon('fus_fuel_storage_dt', -21.76, Y_L0 + 4.2, 15.0, 2.8, Q);

  // R6 Hala Turbin i Wymienników Ciepła (X = +22, nad portalami Z = +3 i Z = +15)
  neon('fus_turbine_exchanger_hall', 21.76, Y_L0 + 4.2, 3.0, 2.8, -Q);
  neon('fus_turbine_exchanger_hall', 21.76, Y_L0 + 4.2, 15.0, 2.8, -Q);

  // R7 Serwerownia Diagnostyczna (X = +22, nad portalem Z = -14) oraz R8 Biuro Kierownika Naukowego (Z = -22, X = +17)
  neon('fus_quantum_diagnostics', 21.76, Y_L0 + 4.2, -14.0, 2.8, -Q);
  neon('fus_quantum_diagnostics', 17.0, Y_G1 + 4.15, -21.76, 2.8, 0);

  // Portal wyjścia ewakuacyjnego EXIT na północnej ścianie Sterowni Głównej R3 (X = -8.0, Y = +8.25, Z = -35.76).
  k.neon('arrow', -8.0, Y_G1 + 3.55, -35.76, 2.6, 0.9, 0, C.green, 0);
  box(k, -8.0, Y_G1 + 3.3, -35.8, 4.4, 0.12, 0.2, 'light_panel', {
    walkable: false,
  });
}

/**
 * Źródła światła `lights[]` (§7.3 docs/maps/run8.md):
 * - 100% bez `cone: true` (0 smug wolumetrycznych!),
 * - każde z jawnym `floorY` (`0.0`, `4.8` lub `9.6 m`).
 */
function lights(k) {
  // --- GŁÓWNA HALA REAKTORA (R2, 12 źródeł: jaśniejsze światło ogólne high-bay + poświata wokół Tokamaka i obwodu pod galeriami) ---
  // 4 główne źródła wokół Tokamaka (floorY: 0.0)
  k.light(0.0, 5.8, -8.5, C.warm, 48, 23, { floorY: Y_L0 });
  k.light(0.0, 5.8, 8.5, C.amber, 48, 23, { floorY: Y_L0 });
  k.light(-8.5, 5.8, 0.0, C.violet, 44, 22, { floorY: Y_L0 });
  k.light(8.5, 5.8, 0.0, C.amber, 44, 22, { floorY: Y_L0 });
  // 4 źródła strefowe posadzki hali i podcieni galerii (SW, SE, NW, NE — floorY: 0.0)
  k.light(-15.5, 4.2, -10.5, C.warm, 42, 21, { floorY: Y_L0 });
  k.light(15.5, 4.2, -10.5, C.amber, 42, 21, { floorY: Y_L0 });
  k.light(-15.5, 4.2, 11.5, C.amber, 44, 21, { floorY: Y_L0 });
  k.light(15.5, 4.2, 11.5, C.warm, 44, 21, { floorY: Y_L0 });
  // 2 źródła na poziomie Galerii G1 (floorY: 4.8)
  k.light(-20.0, 8.5, -2.0, C.amber, 36, 17, { floorY: Y_G1 });
  k.light(20.0, 8.5, -2.0, C.amber, 36, 17, { floorY: Y_G1 });
  // 2 źródła high-bay pod stropem i na poziomie Galerii Górnej G2 (floorY: 9.6 / 0.0)
  k.light(0.0, 13.8, -20.4, C.warm, 38, 18, { floorY: Y_G2 });
  k.light(0.0, 15.5, 0.0, C.warm, 50, 26, { floorY: Y_L0 });

  // --- SZATNIA I ŚLUZA DEKONTAMINACYJNA (R1, 2 źródła: stonowane ciepłobiałe i bursztynowe, floorY: 0.0) ---
  k.light(0.0, 4.3, 29.5, C.warm, 26, 14, {
    floorY: Y_L0,
    groundGlow: false,
  });
  k.light(0.0, 4.3, 23.5, C.amber, 28, 14, { floorY: Y_L0 });

  // --- STEROWNIA GŁÓWNA REAKTORA (R3, 2 główne światła: ciepłobiałe sufitowe + akcent zielony/bursztynowy, floorY: 4.8) ---
  k.light(-11.0, 9.1, -27.5, C.warm, 42, 18, { floorY: Y_G1 });
  k.light(-3.5, 9.1, -29.0, C.amber, 38, 17, { floorY: Y_G1 });
  k.light(-8.0, 8.5, -35.0, C.green, 32, 14, { floorY: Y_G1 });

  // --- LABORATORIUM FIZYKI PLAZMY (R4, 2 mocne światła sufitowe ciepłobiałe + akcent fioletowy plazmy, floorY: 0.0) ---
  k.light(-27.5, 5.1, -16.5, C.warm, 44, 18, { floorY: Y_L0 });
  k.light(-31.0, 5.1, -12.5, C.violet, 40, 17, { floorY: Y_L0 });
  k.light(-28.0, 5.1, -4.5, C.warm, 38, 16, { floorY: Y_L0 });

  // --- MAGAZYN PALIWA — DEUTER/TRYT (R5, 2 mocne światła: sufitowe ciepłobiałe + akcent zielony/bursztynowy, floorY: 0.0) ---
  k.light(-29.0, 6.4, 6.0, C.green, 38, 17, { floorY: Y_L0 });
  k.light(-29.0, 6.4, 15.5, C.warm, 44, 18, { floorY: Y_L0 });

  // --- HALA TURBIN I WYMIENNIKÓW CIEPŁA (R6, 2 mocne światła sufitowe ciepłobiałe + akcent bursztynowy, floorY: 0.0) ---
  k.light(28.5, 7.2, 3.5, C.amber, 42, 18, { floorY: Y_L0 });
  k.light(27.0, 7.2, 15.5, C.warm, 46, 19, { floorY: Y_L0 });
  k.light(29.0, 7.2, 19.2, C.amber, 40, 16, { floorY: Y_L0 });

  // --- SERWEROWNIA DIAGNOSTYCZNA (R7, 2 mocne światła: sufitowe ciepłobiałe + akcent zielony, floorY: 0.0) ---
  k.light(29.0, 5.1, -16.5, C.warm, 42, 17, { floorY: Y_L0 });
  k.light(30.5, 5.1, -9.0, C.green, 38, 16, { floorY: Y_L0 });

  // --- BIURO KIEROWNIKA NAUKOWEGO (R8, 2 mocne światła: ciepłobiałe nad biurkiem + bursztynowy akcent na tablicę Rezonansu, floorY: 4.8) ---
  k.light(13.5, 9.1, -28.5, C.warm, 42, 17, { floorY: Y_G1 });
  k.light(19.2, 8.8, -29.5, C.amber, 38, 15, { floorY: Y_G1 });
}

export function dress(k, placer) {
  crates(k, placer);
  hazards(k, placer);
  decalsAndEasterEggs(k);
  signage(k);
  lights(k);
}
