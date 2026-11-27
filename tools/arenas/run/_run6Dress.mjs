// Oprawa wizualna Rezydencji Pułkownika Kurogane Arms — Willa Kuroyama (run6):
// tekstury, Tablica Śledcza „Iskra”, 12 Easter Eggów, 5 zagrożeń środowiskowych,
// skrzynie, szyldy, 26 źródeł światła i 20 punktów spawnu na 3 kondygnacjach.
import {
  COLOR,
  PI,
  Q,
  R,
  Y_B,
  Y_L0,
  Y_L1,
  box,
  vec,
} from './_run6Kit.mjs';

const C = COLOR;

/*
 * Planowane pozycje dodatkowych modeli drugiej partii (obecnie nieobecnych w mapModelBounds.json).
 * Do czasu wygenerowania ich plików .glb w drugiej partii, w _run6Rooms.mjs zastępują je
 * dozwolone istniejące modele z §4.3.A oraz kompozycje bloków z materiałami res_*:
 *
 * const PENDING_MODELS = [
 *   // R1 Hol Wejściowy
 *   { model: 'res_coat_closet', room: 'R1', x: -7.6, y: Y_L0, z: 4.7, turn: 0, fallback: 'res_wardrobe_glass' },
 *   { model: 'res_coat_closet', room: 'R1', x: 7.6, y: Y_L0, z: 4.7, turn: 0, fallback: 'res_wardrobe_glass' },
 *   { model: 'res_foyer_console', room: 'R1', x: 7.6, y: Y_L0, z: 6.7, turn: 0, fallback: 'off_executive_desk' },
 *   // R2 Wielki Dwukondygnacyjny Salon
 *   { model: 'res_lounge_armchair', room: 'R2', x: 4.6, y: Y_L0, z: -5.0, turn: -1, fallback: 'off_lounge_sofa' },
 *   { model: 'res_lounge_armchair', room: 'R2', x: 4.6, y: Y_L0, z: -8.2, turn: 0, fallback: 'off_lounge_sofa' },
 *   { model: 'res_lounge_armchair', room: 'R2', x: -9.2, y: Y_L0, z: -8.2, turn: 1, fallback: 'off_lounge_sofa' },
 *   { model: 'res_whisky_bar_counter', room: 'R2', x: 9.2, y: Y_L0, z: -9.8, turn: 0, fallback: 'off_kitchenette_counter + waistDivider' },
 *   // R3 Jadalnia Reprezentacyjna
 *   { model: 'res_dining_chair', room: 'R3', x: -28.0, y: Y_L0, z: -2.8, turn: 1, fallback: 'off_office_chair (x8 wokół res_dining_table_long)' },
 *   { model: 'res_dining_credenza', room: 'R3', x: -18.6, y: Y_L0, z: -4.8, turn: 0, fallback: 'off_kitchenette_counter' },
 *   // R4 Nowoczesna Kuchnia
 *   { model: 'res_kitchen_cabinet_bank', room: 'R4', x: -27.8, y: Y_L0, z: -11.5, turn: 1, fallback: 'off_kitchenette_counter' },
 *   { model: 'res_kitchen_cabinet_bank', room: 'R4', x: -17.0, y: Y_L0, z: -8.8, turn: -1, fallback: 'off_kitchenette_counter' },
 *   // R5 Kryty Basen i Ogród Zimowy
 *   { model: 'res_zen_water_wall', room: 'R5', x: 16.55, y: Y_L0, z: -7.0, turn: 1, fallback: 'composite block res_nero_marble + canal_water' },
 *   // R6 Garaż Pancerny
 *   { model: 'res_ev_charger_pillar', room: 'R6', x: -24.2, y: Y_L0, z: 13.5, turn: 0, fallback: 'composite block machine + neon_blue + neon_amber' },
 *   // R7 Pokój Ochrony Parteru
 *   { model: 'res_security_console', room: 'R7', x: 18.0, y: Y_L0, z: 13.4, turn: 2, fallback: 'lab_security_desk + res_recording_console' },
 *   { model: 'res_tactical_gun_cabinet', room: 'R7', x: 28.8, y: Y_L0, z: 7.2, turn: -1, fallback: 'lab_prototype_weapon_rack (x3)' },
 *   { model: 'res_drone_charging_dock', room: 'R7', x: 26.8, y: Y_L0, z: 5.4, turn: 0, fallback: 'wh_weapon_case_stack' },
 *   // R8 Biuro Pułkownika & R9 Biblioteka
 *   { model: 'res_lounge_armchair', room: 'R8', x: -7.2, y: Y_L1, z: -21.3, turn: 2, fallback: 'off_lounge_sofa' },
 *   { model: 'res_lounge_armchair', room: 'R9', x: -28.2, y: Y_L1, z: -24.0, turn: 1, fallback: 'off_lounge_sofa' },
 *   // R10 Sala Trofeów
 *   { model: 'res_blade_display_pedestal', room: 'R10', x: 16.5, y: Y_L1, z: -24.0, turn: 0, fallback: 'composite plinth res_nero_marble + neon_amber' },
 *   { model: 'res_ee_x51_specimen_jar', room: 'R10', x: 25.5, y: Y_L1, z: -24.0, turn: 0, fallback: 'composite plinth res_nero_marble + neon_violet' },
 *   // R11 Sypialnia i Garderoba
 *   { model: 'res_luxury_watch_case', room: 'R11', x: -8.8, y: Y_L1, z: -35.5, turn: 1, fallback: 'mall_kurogane_display' },
 *   // R12 Prywatne Spa i Łazienka
 *   { model: 'res_freestanding_tub', room: 'R12', x: 14.0, y: Y_L1, z: -39.2, turn: 0, fallback: 'composite tub res_nero_marble + canal_water + steam' },
 *   { model: 'res_marble_vanity', room: 'R12', x: 12.0, y: Y_L1, z: -30.65, turn: 0, fallback: 'composite vanity res_nero_marble + glass_clear + light_panel' },
 *   // R13 Sala Tortur i Przesłuchań
 *   { model: 'res_interrogation_lamp', room: 'R13', x: -19.0, y: -1.54, z: 24.0, turn: 0, fallback: 'composite lamp light_panel + metal + res_recessed_led_strip' },
 *   { model: 'res_floor_drain_grate', room: 'R13', x: -19.0, y: Y_B, z: 24.0, turn: 0, fallback: 'city_vent_grate' },
 *   { model: 'res_oneway_mirror', room: 'R13', x: -27.76, y: Y_B + 1.85, z: 24.0, turn: 1, fallback: 'composite mirror glass_clear + light_panel' },
 *   // R14 Winiarnia
 *   { model: 'res_tasting_island', room: 'R14', x: 0.0, y: Y_B, z: 25.2, turn: 0, fallback: 'composite island res_dark_walnut + res_nero_marble' },
 *   { model: 'res_wine_barrel_rack', room: 'R14', x: -4.3, y: Y_B, z: 27.2, turn: 1, fallback: 'composite rack res_dark_walnut + neon_amber (x2)' },
 *   // R15 Podziemny Bunkier Ochrony
 *   { model: 'res_security_console', room: 'R15', x: 16.0, y: Y_B, z: 25.2, turn: 0, fallback: 'lab_security_desk + res_recording_console' },
 * ];
 */

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
 * 20 punktów spawnu wrogów (§5.1 docs/maps/run6.md):
 * - 10 na Parterze (`y = 0.0 m`: R2..R7),
 * - 6 na Piętrze i Antresoli Salonu (`y = 4.8 m`: R2-M, R8..R12),
 * - 4 w Piwnicy (`y = -4.8 m`: R13..R15).
 */
export const SPAWNS = [
  // Parter L0 (10)
  [-9, Y_L0, -4], // 1: R2 Wielki Salon — zachód (za narożną sofą)
  [8, Y_L0, -5], // 2: R2 Wielki Salon — wschód (za kominkiem kolumnowym)
  [-10, Y_L0, -15], // 3: R2 Wielki Salon — przy szybie północnej obok fortepianu holo
  [9, Y_L0, -14], // 4: R2 Wielki Salon — północny wschód
  [-23, Y_L0, -1], // 5: R3 Jadalnia Reprezentacyjna
  [-23, Y_L0, -14], // 6: R4 Nowoczesna Kuchnia
  [23, Y_L0, -12], // 7: R5 Kryty Basen i Ogród Zimowy — N
  [23, Y_L0, 1], // 8: R5 Kryty Basen i Ogród Zimowy — S
  [-20, Y_L0, 13], // 9: R6 Garaż Pancerny — za cyber-limuzyną Pułkownika
  [18, Y_L0, 10], // 10: R7 Pokój Ochrony Parteru
  // Piętro i Antresola L1 (6)
  [-14.4, Y_L1, -1], // 11: R2-M Antresola Salonu — zachód
  [14.4, Y_L1, -1], // 12: R2-M Antresola Salonu — wschód
  [0, Y_L1, -22], // 13: R8 Biuro Pułkownika Vane'a — przed biurkiem i Tablicą „Iskra”
  [-21, Y_L1, -24], // 14: R9 Biblioteka i Archiwum
  [21, Y_L1, -27], // 15: R10 Sala Trofeów
  [-14, Y_L1, -39], // 16: R11 / R12 Sypialnia Pułkownika i Prywatne Spa
  // Piwnica B (4)
  [-22, Y_B, 24], // 17: R13 Sala Tortur i Przesłuchań
  [0, Y_B, 21], // 18: R14 Prywatna Winiarnia — przed przystankiem #0 windy
  [16, Y_B, 21], // 19: R15 Podziemny Bunkier Ochrony — N
  [19, Y_B, 29], // 20: R15 Podziemny Bunkier Ochrony — przed śluzą exit
];

/** Skrzynie zniszczalne `crate` i dynamiczne `crate_small` (do Chwytu Rezonansem) na wszystkich 3 kondygnacjach. */
function crates(k, p) {
  const big = [
    // Parter (L0)
    [-5.5, Y_L0, 6.4],
    [-10.8, Y_L0, -1.2],
    [10.8, Y_L0, -1.2],
    [-28.2, Y_L0, -14.8],
    [-26.2, Y_L0, 14.2],
    [11.4, Y_L0, 14.6],
    // Piętro (L1)
    [-6.8, Y_L1, -28.6],
    [-18.2, Y_L1, -19.4],
    [13.4, Y_L1, -28.4],
    [-19.5, Y_L1, -31.6],
    // Piwnica (B)
    [-26.2, Y_B, 20.2],
    [-2.6, Y_B, 29.2],
    [12.5, Y_B, 21.2],
    [13.5, Y_B, 27.2],
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
    // Parter (L0)
    [-2.2, Y_L0, 6.2],
    [2.2, Y_L0, 6.2],
    [-5.2, Y_L0, -11.0],
    [1.8, Y_L0, -11.0],
    [-19.5, Y_L0, -3.2],
    [18.2, Y_L0, -12.0],
    [-16.0, Y_L0, 13.0],
    [21.2, Y_L0, 8.0],
    // Piętro (L1)
    [-8.2, Y_L1, -15.6],
    [8.2, Y_L1, -15.6],
    [3.8, Y_L1, -23.5],
    [-18.2, Y_L1, -27.2],
    [18.0, Y_L1, -21.2],
    [9.5, Y_L1, -35.5],
    // Piwnica (B)
    [-15.0, Y_B, 21.5],
    [-2.6, Y_B, 20.5],
    [2.6, Y_B, 20.5],
    [18.0, Y_B, 23.0],
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

/** 5 zagrożeń środowiskowych (§5.2 docs/maps/run6.md) na Parterze, Piętrze i w Piwnicy. */
function hazards(k, p) {
  k.hazards.push(
    // 1. Ogniwo paliwowe w R6 Garażu Pancernym (y = 0.0 m)
    {
      kind: 'explosive_barrel',
      id: 'garage-fuel-cell',
      position: vec(-27.5, Y_L0, 6.5),
    },
    // 2. Bramka laserowa przed zbrojownią w R7 Pokoju Ochrony Parteru (y = 0.0 m)
    {
      kind: 'laser_gate',
      id: 'guardroom-armory-laser',
      from: vec(24.0, Y_L0 + 0.85, 6.0),
      to: vec(24.0, Y_L0 + 0.85, 14.0),
      cycle: { onS: 2.5, offS: 1.8 },
    },
    // 3. Bramka laserowa chroniąca stojak pancerza i gabloty w R10 Sali Trofeów (y = 4.8 m)
    {
      kind: 'laser_gate',
      id: 'trophy-room-security-laser',
      from: vec(18.5, Y_L1 + 0.85, -24.0),
      to: vec(23.5, Y_L1 + 0.85, -24.0),
      cycle: { onS: 2.2, offS: 1.6 },
    },
    // 4. Przeciążona sekcja zasilania UPS w R15 Podziemnym Bunkrze Ochrony (spód na y = -4.8 m)
    {
      kind: 'electric_field',
      id: 'bunker-ups-discharge',
      position: vec(23.5, Y_B + 1.0, 25.0),
      size: vec(2.8, 2.0, 3.0),
      cycle: { onS: 3.0, offS: 2.2 },
    },
    // 5. Zbiornik chłodziwa w R15 Podziemnym Bunkrze Ochrony (y = -4.8 m)
    {
      kind: 'explosive_barrel',
      id: 'bunker-coolant-cell',
      position: vec(14.0, Y_B, 29.5),
    },
  );
  p.reserve(R(-28.0, -27.0, 6.0, 7.0), Y_L0);
  p.reserve(R(13.5, 14.5, 29.0, 30.0), Y_B);
  k.fx('sparks', 24.0, Y_L0 + 0.85, 10.0, 0.9);
  k.fx('sparks', 21.0, Y_L1 + 0.85, -24.0, 0.9);
  k.fx('sparks', 23.5, Y_B + 0.8, 25.0, 1.2);
}

/** Tablica Śledcza „Operacja Iskra”, 12 Easter Eggów i naklejki rezydencji (§4.2 docs/maps/run6.md). */
function decalsAndEasterEggs(k) {
  // Monogramy podłogowe `res_kurogane_villa_crest` w Holu R1, Salonie R2, Biurze R8 i Winiarni R14.
  for (const [x, y, z, size] of [
    [0, Y_L0, 10.8, 2.6],
    [-2.0, Y_L0, -11.5, 2.8],
    [0, Y_L1, -22.2, 2.4],
    [0, Y_B, 21.0, 2.4],
  ]) {
    mark(
      k,
      'res_kurogane_villa_crest',
      x,
      y + 0.012,
      z,
      size,
      size,
      0,
      '#ffffff',
      0.92,
    );
  }

  // Ciemny ślad wokół odpływu pod fotelem przesłuchań w Sali Tortur R13 (zero czerwieni!).
  mark(
    k,
    'res_drain_stain',
    -19.0,
    Y_B + 0.012,
    24.0,
    2.2,
    2.2,
    0,
    '#ffffff',
    0.88,
  );

  // 1. GŁÓWNA TABLICA ŚLEDCZA „OPERACJA ISKRA” w R8 Biurze Pułkownika (na ścianie północnej Z = -30, X ∈ [-2, 6]).
  mark(
    k,
    'res_iskra_investigation_board',
    0,
    Y_L1 + 1.95,
    -29.78,
    3.0,
    1.5,
    0,
    '#ffffff',
    0.98,
    'wall',
  );

  // 2. Easter Egg #1 (run1 Magazyn): raport o wózkach AGV na ścianie północnej Garażu R6 (Z = +4, X ∈ [-21, -14]).
  mark(
    k,
    'res_ee_run1_forklift_memo',
    -19.5,
    Y_L0 + 1.8,
    4.22,
    1.1,
    1.1,
    0,
    '#ffffff',
    0.96,
    'wall',
  );

  // 3. Easter Egg #2 (run2 Galeria Atrium Nova): certyfikat zegarka VIP na ściance garderoby w R11 (X = +1.5, Z = -36.0).
  mark(
    k,
    'res_ee_run2_atrium_vip',
    1.3,
    Y_L1 + 1.5,
    -36.0,
    1.1,
    1.1,
    -Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // 4. Easter Egg #3 (run3 Sektor X-51): alert Zbiornika nr 04 na wschodnim postumencie w Sali Trofeów R10 (25.5, Y_L1 + 1.1, -24.0).
  mark(
    k,
    'res_ee_run3_cocoon04_alert',
    25.5,
    Y_L1 + 1.112,
    -24.0,
    0.76,
    0.76,
    -Q,
    '#ffffff',
    0.96,
  );

  // 5. Easter Egg #4 (run4 Piętro 62): faktura i dopisek Prezesa na biurku Pułkownika `res_colonel_desk` w R8 (0, Y_L1 + 1.15, -25.4).
  mark(
    k,
    'res_ee_run4_penthouse_invoice',
    0.55,
    Y_L1 + 1.162,
    -25.2,
    0.54,
    0.54,
    0.18,
    '#ffffff',
    0.96,
  );

  // 6. Easter Egg #5 (bulwar1 / Helixa Dynamics): teczka projektu „Akord” na wózku `res_instrument_trolley` w R13 (-16.2, Y_B + 1.05, 24.0).
  mark(
    k,
    'res_ee_helixa_akord_dossier',
    -16.2,
    Y_B + 1.062,
    24.0,
    0.52,
    0.52,
    -0.2,
    '#ffffff',
    0.96,
  );

  // 7. Easter Egg #6 (Orbis Grid & Bajt): alert o synthwave w windach na ścianie wschodniej Bunkra R15 (X = +28, Z = +26.5).
  mark(
    k,
    'res_ee_orbis_grid_firewall',
    27.78,
    Y_B + 1.8,
    26.5,
    1.1,
    1.1,
    -Q,
    '#ffffff',
    0.96,
    'wall',
  );

  // 8. Easter Egg #7 (Winiarnia Koalicji): karta degustacyjna „Château Kurogane 2048” na stole w R14 (0, Y_B + 1.1, 26.2).
  mark(
    k,
    'res_ee_vintage_2048_wine',
    0,
    Y_B + 1.112,
    26.2,
    0.62,
    0.62,
    0,
    '#ffffff',
    0.96,
  );

  // 9. Easter Egg #8 (Kod 0451 i synt-kofeina): lista na drzwiach lodówki `res_smart_fridge` w Kuchni R4 (-19.2, Y_L0, -16.8).
  mark(
    k,
    'res_ee_kitchen_notes',
    -19.2,
    Y_L0 + 1.35,
    -16.305,
    0.58,
    0.58,
    0,
    '#ffffff',
    0.96,
    'wall',
  );

  // 10. Easter Egg #9 (Biblioteka Egzekutora): tytuły ksiąg na stoliku czytelniczym `res_coffee_table_marble` w R9 (-25.0, Y_L1 + 0.55, -21.2).
  mark(
    k,
    'res_ee_colonel_book_titles',
    -25.0,
    Y_L1 + 0.562,
    -21.2,
    0.64,
    0.64,
    0.22,
    '#ffffff',
    0.96,
  );

  // 11. Easter Egg #10 (Ostrze z warsztatu Miry): tabliczka na zachodnim postumencie w Sali Trofeów R10 (16.5, Y_L1 + 1.1, -24.0).
  mark(
    k,
    'res_ee_mira_blade_trophy',
    16.5,
    Y_L1 + 1.112,
    -24.0,
    0.76,
    0.38,
    Q,
    '#ffffff',
    0.96,
  );

  // 12. Easter Egg #11 (Sztuka Korporacyjna): mosiężna tabliczka pod tryptykiem na południowej ścianie Salonu R2 (Z = +4, X = -7.5).
  mark(
    k,
    'res_ee_art_plaque',
    -7.5,
    Y_L0 + 1.05,
    3.78,
    0.96,
    0.48,
    PI,
    '#ffffff',
    0.96,
    'wall',
  );

  // Oznaczenie wyjścia ewakuacyjnego EXIT w Podziemnym Bunkrze Ochrony R15 (X = +19.0, Z = +30.6).
  mark(
    k,
    'mall_exit_stencil',
    19.0,
    Y_B + 0.012,
    30.6,
    2.2,
    2.2,
    PI,
    C.green,
    0.88,
  );
}

/** Szyldy neonowe i podświetlane obrazy (`kind: "neon"`, 0 stożków `holo`!) na 3 kondygnacjach (§4.2). */
function signage(k) {
  const neon = (texture, x, y, z, w, yaw) =>
    k.neon(texture, x, y, z, w, w / 2, yaw, '#ffffff', 0);

  // R1 Hol Wejściowy i R2 Wielki Salon
  neon('res_villa_kuroyama', 0, Y_L0 + 4.35, 4.23, 3.2, 0);
  neon('res_villa_kuroyama', 0, Y_L0 + 4.35, 3.77, 3.2, PI);
  neon('res_art_neon_forest', -7.5, Y_L0 + 2.45, 3.68, 2.8, PI);
  neon('res_art_neon_forest', 7.5, Y_L0 + 2.45, 3.68, 2.8, PI);
  neon('res_art_neon_forest', -16.3, Y_L0 + 2.4, -3.5, 2.6, -Q);

  // R5 Kryty Basen, R6 Garaż Pancerny, R7 Pokój Ochrony Parteru
  neon('res_winter_pool', 15.77, Y_L0 + 4.0, 1.0, 2.6, -Q);
  neon('res_winter_pool', 23.0, Y_L0 + 4.0, 3.77, 2.8, PI);
  neon('res_armored_garage', -9.77, Y_L0 + 4.0, 10.0, 2.6, Q);
  neon('res_armored_garage', -12.0, Y_L0 + 4.0, 4.23, 2.6, 0);
  neon('res_guard_post', 9.77, Y_L0 + 4.0, 10.0, 2.6, -Q);
  neon('res_guard_post', 12.0, Y_L0 + 4.0, 4.23, 2.6, 0);

  // Piętro L1: R8 Biuro Pułkownika i R10 Sala Trofeów
  neon('res_colonel_office', 0, Y_L1 + 4.1, -17.77, 3.0, 0);
  neon('res_colonel_office', 0, Y_L1 + 4.1, -18.23, 3.0, PI);
  neon('res_trophy_sanctuary', 11.77, Y_L1 + 4.0, -24.0, 2.6, -Q);
  neon('res_trophy_sanctuary', 14.0, Y_L1 + 4.0, -17.77, 2.6, 0);

  // Piwnica B i Winda: R14 Winiarnia, R13 Sala Tortur, R15 Podziemny Bunkier Ochrony
  neon('res_wine_cellar', 0, Y_L0 + 3.95, 13.38, 2.4, PI);
  neon('res_wine_cellar', 0, Y_B + 3.95, 16.62, 2.4, 0);
  neon('res_interrogation_zone', -9.77, Y_B + 4.0, 18.4, 2.6, Q);
  neon('res_interrogation_zone', -20.0, Y_B + 3.85, 28.6, 2.8, PI);
  neon('res_bunker_exit', 9.77, Y_B + 4.0, 18.4, 2.6, -Q);
  neon('res_bunker_exit', 19.0, Y_B + 4.1, 31.77, 2.8, PI);

  // Portal wyjścia ewakuacyjnego EXIT na południowej ścianie Bunkra R15 (X = +19.0, Z = +31.85).
  k.neon('arrow', 19.0, Y_B + 3.45, 31.85, 2.6, 0.9, PI, C.green, 0);
  box(k, 19.0, Y_B + 3.25, 31.88, 4.4, 0.12, 0.2, 'light_panel', {
    walkable: false,
  });
}

/**
 * 26 źródeł światła `lights[]` (§5.3 docs/maps/run6.md):
 * - 12 na Parterze (`floorY: 0.0`),
 * - 8 na Piętrze (`floorY: 4.8`),
 * - 6 w Piwnicy (`floorY: -4.8`),
 * - 100% bez `cone: true` (0 smug wolumetrycznych!).
 */
function lights(k) {
  // --- PARTER (L0, 12 źródeł, floorY: 0.0) ---
  // R1 Hol Wejściowy (2)
  k.light(-4.0, Y_L0 + 2.5, 11.0, C.warm, 18, 13, { floorY: Y_L0 });
  k.light(0.0, Y_L0 + 2.5, 13.0, C.amber, 16, 12, { floorY: Y_L0 });
  // R2 Wielki Dwukondygnacyjny Salon (4)
  k.light(4.5, Y_L0 + 3.2, -11.5, C.amber, 24, 16, { floorY: Y_L0 });
  k.light(-2.0, Y_L0 + 4.6, -5.0, C.warm, 22, 16, { floorY: Y_L0 });
  k.light(-9.5, Y_L0 + 3.0, -13.0, C.amber, 18, 13, { floorY: Y_L0 });
  k.light(0.0, Y_L0 + 3.2, -16.5, C.blue, 18, 14, { floorY: Y_L0 });
  // R3 Jadalnia Reprezentacyjna (1)
  k.light(-23.0, Y_L0 + 2.5, -1.0, C.warm, 18, 13, { floorY: Y_L0 });
  // R4 Nowoczesna Kuchnia (1)
  k.light(-23.0, Y_L0 + 2.5, -12.0, C.warm, 18, 13, { floorY: Y_L0 });
  // R5 Kryty Basen i Ogród Zimowy (2)
  k.light(23.0, Y_L0 + 2.5, -7.0, C.blue, 22, 15, { floorY: Y_L0 });
  k.light(23.0, Y_L0 + 2.5, -15.0, C.green, 16, 12, { floorY: Y_L0 });
  // R6 Garaż Pancerny (1)
  k.light(-20.0, Y_L0 + 2.5, 10.0, C.amber, 18, 13, { floorY: Y_L0 });
  // R7 Pokój Ochrony Parteru (1)
  k.light(20.0, Y_L0 + 2.5, 10.0, C.green, 18, 12, { floorY: Y_L0 });

  // --- PIĘTRO (L1, 8 źródeł, floorY: 4.8) ---
  // R8 Biuro Pułkownika (2 — nad biurkiem i przed Tablicą Śledczą „Iskra”)
  k.light(0.0, Y_L1 + 2.5, -23.5, C.warm, 20, 13, { floorY: Y_L1 });
  k.light(0.0, Y_L1 + 2.4, -28.5, C.amber, 20, 11, { floorY: Y_L1 });
  // R9 Biblioteka i Archiwum (1)
  k.light(-21.0, Y_L1 + 2.5, -24.0, C.amber, 18, 13, { floorY: Y_L1 });
  // R10 Sala Trofeów (2)
  k.light(21.0, Y_L1 + 2.5, -24.0, C.violet, 20, 13, { floorY: Y_L1 });
  k.light(16.5, Y_L1 + 2.4, -24.0, C.amber, 16, 10, { floorY: Y_L1 });
  // R11 Sypialnia i Garderoba (2)
  k.light(-14.0, Y_L1 + 2.5, -36.0, C.violet, 18, 13, { floorY: Y_L1 });
  k.light(0.0, Y_L1 + 2.5, -36.0, C.warm, 16, 11, { floorY: Y_L1 });
  // R12 Prywatne Spa i Sauna (1)
  k.light(14.0, Y_L1 + 2.5, -36.0, C.blue, 18, 13, { floorY: Y_L1 });

  // --- PIWNICA (B, 6 źródeł, floorY: -4.8) ---
  // R13 Sala Tortur i Przesłuchań (2 — zimno-biała lampa nad fotelem i zielona poświata przy celi)
  k.light(-19.0, Y_B + 2.8, 24.0, C.warm, 22, 12, { floorY: Y_B });
  k.light(-23.0, Y_B + 2.4, 28.0, C.green, 15, 10, {
    floorY: Y_B,
    flicker: { pattern: 'buzz', strength: 0.2 },
  });
  // R14 Prywatna Winiarnia (2)
  k.light(0.0, Y_B + 2.5, 24.5, C.amber, 20, 13, { floorY: Y_B });
  k.light(0.0, Y_B + 2.5, 18.0, C.warm, 16, 11, { floorY: Y_B });
  // R15 Podziemny Bunkier Ochrony (2)
  k.light(20.0, Y_B + 2.5, 22.0, C.blue, 18, 12, { floorY: Y_B });
  k.light(19.0, Y_B + 2.4, 31.0, C.green, 22, 13, { floorY: Y_B });
}

export function dress(k, placer) {
  crates(k, placer);
  hazards(k, placer);
  decalsAndEasterEggs(k);
  signage(k);
  lights(k);
}
