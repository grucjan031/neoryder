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

/**
 * Mapa tekstur szyldów i naklejek elektrowni fuzyjnej (§6.2 docs/maps/run8.md).
 *
 * TODO-tekstury (sekcja 6.2 docs/maps/run8.md — docelowe 22 tekstury `fus_*` z Etapu C):
 * Po wygenerowaniu nowych plików `.webp` w `public/assets/textures/` podmień poniższe identyfikatory
 * zastępcze (z run1 / run3 / run4 / run7) na docelowe klucze:
 *  1. `signs/fus_helios_reactor_hall.webp`   -> FUSION_TEXTURES.fus_helios_reactor_hall   (R1/R2 nad Portalem Głównym do Hali Reaktora)
 *  2. `signs/fus_main_control_room.webp`     -> FUSION_TEXTURES.fus_main_control_room     (R3 Sterownia Główna nad portalami z G1-N)
 *  3. `signs/fus_plasma_lab.webp`            -> FUSION_TEXTURES.fus_plasma_lab            (R4 Laboratorium Fizyki Plazmy)
 *  4. `signs/fus_fuel_storage_dt.webp`       -> FUSION_TEXTURES.fus_fuel_storage_dt       (R5 Magazyn Paliwa Fuzyjnego Deuter/Tryt)
 *  5. `signs/fus_turbine_exchanger_hall.webp`-> FUSION_TEXTURES.fus_turbine_exchanger_hall(R6 Hala Turbin MHD i Wymienników Ciepła)
 *  6. `signs/fus_quantum_diagnostics.webp`   -> FUSION_TEXTURES.fus_quantum_diagnostics   (R7 Serwerownia Diagnostyczna i R8 Biuro Kierownika)
 *  7. `screens/screen_fus_tokamak.webp`      -> materiał modeli `fus_diagnostic_console`, `fus_main_control_desk`, `fus_telemetry_screen_wall`, `fus_director_desk`
 *  8. `screens/screen_fus_grid.webp`         -> materiał modeli `fus_main_control_desk`, `fus_telemetry_screen_wall`
 *  9. `screens/screen_fus_tritium.webp`      -> materiał modelu `fus_decon_shower_arch`
 * 10. `screens/screen_fus_iskra_alert.webp`  -> materiał modelu `fus_telemetry_screen_wall` + FUSION_TEXTURES.screen_fus_iskra_alert (EE-10 w R3 i R7)
 * 11. `decals/fus_director_resonance_board.webp` -> FUSION_TEXTURES.fus_director_resonance_board (R8 tablica dr. Moriego: EE-08, EE-09, EE-11)
 * 12. `decals/fus_ee_run1_run2_logistics.webp`   -> FUSION_TEXTURES.fus_ee_run1_run2_logistics   (R5 manifest K-09 EE-01 + R6 blackout Atrium Nova EE-02)
 * 13. `decals/fus_ee_run3_run4_directives.webp`  -> FUSION_TEXTURES.fus_ee_run3_run4_directives  (R4 zasilanie X-51 EE-03 + R8 ponaglenie z Piętra 62 EE-04)
 * 14. `decals/fus_ee_run5_run6_coalition.webp`   -> FUSION_TEXTURES.fus_ee_run5_run6_coalition   (R1 skierowanie Helixa EE-05 + R5 kontrabanda He-3 EE-06)
 * 15. `decals/fus_ee_run7_vane_memo.webp`        -> FUSION_TEXTURES.fus_ee_run7_vane_memo        (R8 rozkaz Pułkownika Vane'a z Willi Kuroyama EE-07)
 * 16. `decals/fus_floor_magnetic_hazard.webp`    -> FUSION_TEXTURES.fus_floor_magnetic_hazard    (R2, R4, R5 oznakowanie posadzki 16 T)
 * 17. `decals/fus_dielectric_floor_mat.webp`     -> FUSION_TEXTURES.fus_dielectric_floor_mat     (R3 maty dielektryczne, R8 dywan gabinetowy jako płaski decal!)
 * 18. `labels/label_tritium_cask.webp`           -> materiał modeli `fus_tritium_cask_pallet` i `fus_director_desk` + EE-12
 * 19–22. `surfaces/fus_reactor_floor.webp`, `fus_reactor_concrete.webp`, `fus_shield_panel.webp`, `fus_control_tile.webp` (+ `komiks_fus_*.webp`) -> `_run8Kit.mjs`
 */
export const FUSION_TEXTURES = {
  // --- Szyldy (public/assets/textures/signs/) ---
  fus_helios_reactor_hall: 'lab_restricted_omega',
  fus_main_control_room: 'off_kurogane_hq',
  fus_plasma_lab: 'lab_sector_x51',
  fus_fuel_storage_dt: 'lab_decon_lockers',
  fus_turbine_exchanger_hall: 'lab_prototype_armory',
  fus_quantum_diagnostics: 'lab_data_vault',

  // --- Dekale, Easter Eggi i maty podłogowe (public/assets/textures/decals/) ---
  fus_director_resonance_board: 'res_iskra_investigation_board',
  fus_ee_run1_run2_logistics: 'res_ee_run1_forklift_memo',
  fus_ee_run2_blackout: 'res_ee_run2_atrium_vip',
  fus_ee_run3_run4_directives: 'res_ee_run3_cocoon04_alert',
  fus_ee_run4_directive: 'res_ee_run4_penthouse_invoice',
  fus_ee_run5_run6_coalition: 'res_ee_helixa_akord_dossier',
  fus_ee_run7_vane_memo: 'res_ee_orbis_grid_firewall',
  screen_fus_iskra_alert: 'res_ee_orbis_grid_firewall',
  fus_ee_code_0451: 'sticky_code_0451',
  fus_ee_prototype_plaque: 'res_ee_mira_blade_trophy',
  fus_floor_magnetic_hazard: 'floor_hazard',
  fus_dielectric_floor_mat: 'off_kurogane_floor_crest',
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
  opacity = 0.85,
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
    [-32.5, Y_L0, -11.0],
    [-30.5, Y_L0, 4.0],
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
 * Wszystkie naklejki ścienne (`surface: "wall"`) leżą dokładnie `0.03 m <= 0.10 m` od lica ściany nośnej (nauczka #3).
 * Dywan w R8 oraz maty dielektryczne w R3 są płaskimi `decals` (`surface: "floor"`), więc żaden spawn nie jest w bloku (nauczka #5).
 */
function decalsAndEasterEggs(k) {
  // 1. Płaskie maty dielektryczne w Sterowni Głównej R3 i dywan gabinetowy w Biurze Kierownika R8 (`surface: "floor"`).
  mark(
    k,
    FUSION_TEXTURES.fus_dielectric_floor_mat,
    -8.0,
    Y_G1 + 0.012,
    -28.5,
    3.2,
    3.2,
    0,
    '#ffffff',
    0.88,
  );
  mark(
    k,
    FUSION_TEXTURES.fus_dielectric_floor_mat,
    14.0,
    Y_G1 + 0.012,
    -26.5,
    3.0,
    3.0,
    0,
    '#ffffff',
    0.9,
  );
  mark(
    k,
    FUSION_TEXTURES.fus_dielectric_floor_mat,
    0.0,
    Y_L0 + 0.012,
    29.0,
    2.6,
    2.6,
    0,
    '#ffffff',
    0.88,
  );

  // 2. Oznakowanie posadzkowe strefy silnego pola magnetycznego 16 T wokół Tokamaka w R2 oraz w R4 i R5.
  for (const [x, z, yaw] of [
    [0, 15.5, 0],
    [0, -15.5, PI],
    [-15.5, 0, Q],
    [15.5, 0, -Q],
    [-30.0, -11.0, 0],
    [-30.0, 11.0, 0],
  ]) {
    mark(
      k,
      FUSION_TEXTURES.fus_floor_magnetic_hazard,
      x,
      Y_L0 + 0.012,
      z,
      3.6,
      0.85,
      yaw,
      C.amber,
      0.8,
    );
  }

  // EE-01 (`run1` Magazyn K-09): manifest dostawy cewek w R5 Magazynie Paliwa (0.03 m od ściany S Z = +21.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run1_run2_logistics,
    -30.0,
    Y_L0 + 1.55,
    21.77,
    1.1,
    1.1,
    PI,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-02 (`run2` Galeria Atrium Nova): wykres zrzutu mocy 400 MW w R6 Hali Turbin (0.03 m od ściany E X = +37.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run2_blackout,
    37.77,
    Y_L0 + 1.6,
    13.0,
    1.1,
    1.1,
    -Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-03 (`run3` Sektor X-51): pilny telegram o zasilaniu Komory Kokonów nr 04 w R4 Lab Plazmy (0.03 m od ściany W X = -37.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run3_run4_directives,
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
    FUSION_TEXTURES.fus_ee_run4_directive,
    13.2,
    Y_G1 + 1.162,
    -29.4,
    0.52,
    0.52,
    0.15,
    '#ffffff',
    0.96,
  );

  // EE-05 (`run5` Klinika Helixa): skierowanie na kalibrację Akordu w R1 Szatni-Dekontaminacji (0.03 m od ściany W X = -11.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run5_run6_coalition,
    -11.77,
    Y_L0 + 1.6,
    29.0,
    1.1,
    1.1,
    Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-06 (`run6` Nocny Targ): protokół konfiskaty Helu-3 i zupy rybnej w R5 Magazynie Paliwa (0.03 m od ściany W X = -37.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run5_run6_coalition,
    -37.77,
    Y_L0 + 1.55,
    6.0,
    1.1,
    1.1,
    Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-07 (`run7` Rezydencja Pułkownika Vane'a „Willa Kuroyama”): osobisty rozkaz Pułkownika Vane'a na biurku dr. Moriego w R8.
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run7_vane_memo,
    14.8,
    Y_G1 + 1.162,
    -29.4,
    0.52,
    0.52,
    -0.18,
    '#ffffff',
    0.96,
  );

  // EE-08 & EE-09 (Główna tablica fabularna dr. Moriego w R8: sygnatura „Kuriera” + anomalia poboru mocy na stacji metra „Kamienna”,
  // 0.03 m od ściany E X = +21.8).
  mark(
    k,
    FUSION_TEXTURES.fus_director_resonance_board,
    21.77,
    Y_G1 + 1.9,
    -29.5,
    3.0,
    1.5,
    -Q,
    '#ffffff',
    0.98,
    'wall',
  );
  mark(
    k,
    FUSION_TEXTURES.fus_ee_run3_run4_directives,
    21.77,
    Y_G1 + 1.6,
    -33.2,
    1.1,
    1.1,
    -Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-10 (Sabotaż Bajta, Miry, Doktor Wolan i Szrona): alerty Orbis Grid w R3 Sterowni Głównej (0.03 m od ściany N Z = -35.8)
  // oraz w R7 Serwerowni Diagnostycznej (0.03 m od ściany E X = +37.8).
  mark(
    k,
    FUSION_TEXTURES.screen_fus_iskra_alert,
    -15.5,
    Y_G1 + 1.7,
    -35.77,
    1.2,
    1.2,
    0,
    '#ffffff',
    0.96,
    'wall',
  );
  mark(
    k,
    FUSION_TEXTURES.screen_fus_iskra_alert,
    37.77,
    Y_L0 + 1.65,
    -13.0,
    1.1,
    1.1,
    -Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-11 (Projekt Sztucznych Implantów Rezonansu — tabliczka przy komorze `fus_plasma_test_chamber` w R8, 0.03 m od ściany N Z = -35.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_prototype_plaque,
    17.5,
    Y_G1 + 1.6,
    -35.77,
    1.0,
    0.5,
    0,
    '#ffffff',
    0.96,
    'wall',
  );

  // EE-12 (Kod awaryjnego zrzutu plazmy `0451` — karteczka w R3 Sterowni Głównej, 0.03 m od ściany W X = -21.8).
  mark(
    k,
    FUSION_TEXTURES.fus_ee_code_0451,
    -21.77,
    Y_G1 + 1.45,
    -26.5,
    0.55,
    0.55,
    Q,
    C.amber,
    0.96,
    'wall',
  );

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
  const neon = (texture, x, y, z, w, yaw, tint = '#ffffff') =>
    k.neon(texture, x, y, z, w, w / 2, yaw, tint, 0);

  // R1 / R2: nad Portalem Głównym do Hali Reaktora (Z = +22, X = 0)
  neon(FUSION_TEXTURES.fus_helios_reactor_hall, 0, Y_L0 + 4.25, 22.24, 3.4, 0, C.amber);
  neon(FUSION_TEXTURES.fus_helios_reactor_hall, 0, Y_L0 + 4.25, 21.76, 3.4, PI, C.amber);

  // R3 Sterownia Główna (nad portalami z Galerii Północnej G1-N, Z = -22, y = +4.8 m)
  neon(FUSION_TEXTURES.fus_main_control_room, -18.0, Y_G1 + 4.15, -21.76, 2.8, 0, C.blue);
  neon(FUSION_TEXTURES.fus_main_control_room, 3.0, Y_G1 + 4.15, -21.76, 2.8, 0, C.blue);

  // R4 Laboratorium Fizyki Plazmy (X = -22, nad portalami Z = -14 i Z = -3)
  neon(FUSION_TEXTURES.fus_plasma_lab, -21.76, Y_L0 + 4.2, -14.0, 2.8, Q, C.violet);
  neon(FUSION_TEXTURES.fus_plasma_lab, -21.76, Y_L0 + 4.2, -3.0, 2.8, Q, C.violet);

  // R5 Magazyn Paliwa Fuzyjnego Deuter / Tryt (X = -22, nad portalami Z = +5 i Z = +15)
  neon(FUSION_TEXTURES.fus_fuel_storage_dt, -21.76, Y_L0 + 4.2, 5.0, 2.8, Q, C.amber);
  neon(FUSION_TEXTURES.fus_fuel_storage_dt, -21.76, Y_L0 + 4.2, 15.0, 2.8, Q, C.green);

  // R6 Hala Turbin i Wymienników Ciepła (X = +22, nad portalami Z = +3 i Z = +15)
  neon(FUSION_TEXTURES.fus_turbine_exchanger_hall, 21.76, Y_L0 + 4.2, 3.0, 2.8, -Q, C.amber);
  neon(FUSION_TEXTURES.fus_turbine_exchanger_hall, 21.76, Y_L0 + 4.2, 15.0, 2.8, -Q, C.warm);

  // R7 Serwerownia Diagnostyczna (X = +22, nad portalem Z = -14) oraz R8 Biuro Kierownika Naukowego (Z = -22, X = +17)
  neon(FUSION_TEXTURES.fus_quantum_diagnostics, 21.76, Y_L0 + 4.2, -14.0, 2.8, -Q, C.blue);
  neon(FUSION_TEXTURES.fus_quantum_diagnostics, 17.0, Y_G1 + 4.15, -21.76, 2.8, 0, C.amber);

  // Portal wyjścia ewakuacyjnego EXIT na północnej ścianie Sterowni Głównej R3 (X = -8.0, Y = +8.25, Z = -35.76).
  k.neon('arrow', -8.0, Y_G1 + 3.55, -35.76, 2.6, 0.9, 0, C.green, 0);
  box(k, -8.0, Y_G1 + 3.3, -35.8, 4.4, 0.12, 0.2, 'light_panel', {
    walkable: false,
  });
}

/**
 * 24 źródła światła `lights[]` (§7.3 docs/maps/run8.md):
 * - 100% bez `cone: true` (0 smug wolumetrycznych!),
 * - każde z jawnym `floorY` (`0.0`, `4.8` lub `9.6 m`).
 */
function lights(k) {
  // --- GŁÓWNA HALA REAKTORA (R2, 10 źródeł) ---
  // 4 główne źródła wokół Tokamaka (floorY: 0.0)
  k.light(0.0, 5.5, -8.5, C.warm, 36, 18, { floorY: Y_L0 });
  k.light(0.0, 5.5, 8.5, C.amber, 36, 18, { floorY: Y_L0 });
  k.light(-8.5, 5.5, 0.0, C.violet, 32, 17, { floorY: Y_L0 });
  k.light(8.5, 5.5, 0.0, C.amber, 32, 17, { floorY: Y_L0 });
  // 2 źródła narożne na poziomie głównym (floorY: 0.0)
  k.light(-15.5, 4.0, -3.0, C.violet, 24, 13, { floorY: Y_L0 });
  k.light(15.5, 4.0, 6.0, C.blue, 24, 13, { floorY: Y_L0 });
  // 2 źródła na poziomie Galerii G1 (floorY: 4.8)
  k.light(-20.0, 8.5, 0.0, C.amber, 24, 13, { floorY: Y_G1 });
  k.light(20.0, 8.5, 0.0, C.amber, 24, 13, { floorY: Y_G1 });
  // 2 źródła na poziomie Galerii Górnej G2 i korony suwnicy (floorY: 9.6 / 0.0)
  k.light(0.0, 13.8, -20.4, C.warm, 26, 14, { floorY: Y_G2 });
  k.light(0.0, 15.0, 0.0, C.amber, 30, 18, { floorY: Y_L0 });

  // --- SZATNIA I ŚLUZA DEKONTAMINACYJNA (R1, 2 źródła, floorY: 0.0) ---
  k.light(0.0, 4.3, 29.0, C.green, 26, 13, { floorY: Y_L0 });
  k.light(0.0, 4.3, 23.5, C.amber, 28, 13, { floorY: Y_L0 });

  // --- STEROWNIA GŁÓWNA REAKTORA (R3, 3 źródła, floorY: 4.8) ---
  k.light(-13.0, 9.1, -28.0, C.blue, 28, 14, { floorY: Y_G1 });
  k.light(-3.0, 9.1, -28.0, C.warm, 28, 14, { floorY: Y_G1 });
  k.light(-8.0, 8.5, -35.0, C.green, 30, 12, { floorY: Y_G1 });

  // --- LABORATORIUM FIZYKI PLAZMY (R4, 2 źródła, floorY: 0.0) ---
  k.light(-30.0, 5.1, -15.0, C.violet, 28, 14, { floorY: Y_L0 });
  k.light(-30.0, 5.1, -6.0, C.blue, 26, 13, { floorY: Y_L0 });

  // --- MAGAZYN PALIWA — DEUTER/TRYT (R5, 2 źródła, floorY: 0.0) ---
  k.light(-30.0, 6.4, 6.0, C.green, 26, 14, { floorY: Y_L0 });
  k.light(-30.0, 6.4, 16.0, C.amber, 28, 14, { floorY: Y_L0 });

  // --- HALA TURBIN I WYMIENNIKÓW CIEPŁA (R6, 2 źródła, floorY: 0.0) ---
  k.light(30.0, 7.2, 3.0, C.amber, 30, 15, { floorY: Y_L0 });
  k.light(30.0, 7.2, 15.0, C.warm, 28, 15, { floorY: Y_L0 });

  // --- SERWEROWNIA DIAGNOSTYCZNA (R7, 1 źródło, floorY: 0.0) ---
  k.light(30.0, 5.1, -13.0, C.blue, 28, 14, { floorY: Y_L0 });

  // --- BIURO KIEROWNIKA NAUKOWEGO (R8, 2 źródła, floorY: 4.8) ---
  k.light(14.0, 9.1, -29.0, C.warm, 28, 13, { floorY: Y_G1 });
  k.light(19.5, 8.8, -29.0, C.amber, 24, 11, { floorY: Y_G1 });
}

export function dress(k, placer) {
  crates(k, placer);
  hazards(k, placer);
  decalsAndEasterEggs(k);
  signage(k);
  lights(k);
}
