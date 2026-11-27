// Wyposażenie tematyczne wszystkich 8 pomieszczeń (R1..R8) oraz 2 poziomów galerii (G1, G2)
// Elektrowni Fuzyjnej Kurogane Arms — Kompleks Tokamaka „Helios-IV” (run8):
// - Poziom Główny L0 (y = 0.0 m): R1 (Szatnia i Śluza Dekontaminacyjna), R2 (Główna Hala Reaktora),
//   R4 (Laboratorium Fizyki Plazmy i Wiązek), R5 (Magazyn Paliwa Deuter / Tryt),
//   R6 (Hala Turbin i Wymienników Ciepła), R7 (Serwerownia Diagnostyczna i Kwantowa Kontrola Cewki).
// - Poziom Galerii 1 G1 (y = +4.8 m): Galerie Techniczne G1 w R2, R3 (Sterownia Główna „Mostek Helios-IV”),
//   R8 (Biuro Kierownika Naukowego Projektu „Helios” — Dr Haruto Mori).
// - Poziom Galerii 2 G2 (y = +9.6 m): Górne pomosty inspekcyjne i bojowe G2 w R2.
import {
  MAT_CONCRETE,
  MAT_SHIELD,
  Q,
  R,
  Y_G1,
  Y_G1_CEIL,
  Y_HALL_CEIL,
  Y_L0,
  Y_R1_CEIL,
  Y_R4_CEIL,
  Y_R5_CEIL,
  Y_R6_CEIL,
  Y_R7_CEIL,
  box,
  ceilingCovePanel,
  coolantPipeArch,
  deconShowerArch,
  deco,
  highbayLightStrip,
  overheadCableTray,
} from './_run8Kit.mjs';

/**
 * Kolizja podstawy Tokamaka „Kurogane Helios-IV” w centrum Hali Reaktora R2 (§4.3 docs/maps/run8.md):
 * 1) Dolny cokół dywertora (y = 0.00..2.40 m, walkable: false): 3 krzyżujące się bloki ośmiokątnego
 *    postumentu wpisane w okrąg R = 6.0 m (`12.0 × 2.4 × 5.0 m`, `5.0 × 2.4 × 12.0 m`, `8.6 × 2.4 × 8.6 m`).
 * 2) Centralna kolumna solenoidu (y = 2.40..9.60 m, walkable: false, visible: false):
 *    pionowy rdzeń `4.8 × 7.2 × 4.8 m` na `(0, 6.0, 0)`.
 */
export function buildReactorBaseCollider(k, p) {
  p.reserve(R(-6.15, 6.15, -2.6, 2.6), Y_L0);
  p.reserve(R(-2.6, 2.6, -6.15, 6.15), Y_L0);
  p.reserve(R(-4.45, 4.45, -4.45, 4.45), Y_L0);
  box(k, 0, 1.2, 0, 12.0, 2.4, 5.0, MAT_SHIELD, { walkable: false });
  box(k, 0, 1.2, 0, 5.0, 2.4, 12.0, MAT_SHIELD, { walkable: false });
  box(k, 0, 1.2, 0, 8.6, 2.4, 8.6, MAT_CONCRETE, { walkable: false });
  // Żółto-czarne pasy ostrzegawcze wokół cokołu podstawy reaktora:
  box(k, 0, 0.12, 0, 12.24, 0.24, 5.16, 'hazard', { walkable: false });
  box(k, 0, 0.12, 0, 5.16, 0.24, 12.24, 'hazard', { walkable: false });
  box(k, 0, 0.12, 0, 8.84, 0.24, 8.84, 'hazard', { walkable: false });
  box(k, 0, 6.0, 0, 4.8, 7.2, 4.8, MAT_SHIELD, {
    visible: false,
    walkable: false,
  });
}

/** R1 — Szatnia i Śluza Dekontaminacyjna (L0, X ∈ [-12, 12], Z ∈ [22, 36], y = 0.0 m). */
function buildRoomR1(k, p) {
  // 2 komory pryszniców dekontaminacyjnych `fus_decon_shower_arch` (3.4 × 2.8 × 1.6 m)
  // ustawione symetrycznie po bokach osi przejścia z playerSpawn (0, 0, 31) do Portalu Głównego R1<->R2 (X ∈ [-4, 4], Z = 22).
  // Na X = ±2.4, Z = 26.5 oba tunele są w kadrze 01-spawn, a środek X = 0 zostawia czysty widok na Tokamak!
  deconShowerArch(k, p, -2.4, Y_L0, 26.5, 0);
  deconShowerArch(k, p, 2.4, Y_L0, 26.5, 0);

  // 4 szafy z kombinezonami radiacyjnymi `fus_suit_locker_bank` (3.2 × 2.3 × 0.8 m) przy ścianie W i E.
  p.prop('fus_suit_locker_bank', -11.35, 25.5, Y_L0, 1);
  p.prop('fus_suit_locker_bank', -11.35, 32.5, Y_L0, 1);
  p.prop('fus_suit_locker_bank', 11.35, 25.5, Y_L0, -1);
  p.prop('fus_suit_locker_bank', 11.35, 32.5, Y_L0, -1);

  // Ławki szatniowe (`lab_locker_bench`), skrzynie rozdzielcze i kolektory przy ścianie południowej.
  p.prop('lab_locker_bench', -7.2, 26.5, Y_L0, 1);
  p.prop('lab_locker_bench', -7.2, 32.5, Y_L0, 1);
  p.prop('lab_locker_bench', 7.2, 26.5, Y_L0, 1);
  p.prop('lab_locker_bench', 7.2, 32.5, Y_L0, 1);
  p.prop('fus_junction_box', -5.5, 35.1, Y_L0, 2);
  p.prop('fus_junction_box', 5.5, 35.1, Y_L0, 2);
  p.prop('fus_wall_pipe_manifold', -8.5, 35.48, Y_L0, 2);
  p.prop('fus_wall_pipe_manifold', 8.5, 35.48, Y_L0, 2);

  deco(k, 'wh_wall_terminal', -5.5, Y_L0 + 1.2, 22.25, 0);
  deco(k, 'wh_wall_terminal', 5.5, Y_L0 + 1.2, 22.25, 0);
  deco(k, 'mall_security_fixture', -11.75, Y_L0 + 1.3, 29.0, Q);
  deco(k, 'mall_security_fixture', 11.75, Y_L0 + 1.3, 29.0, -Q);

  // Oprawy sufitowe i panele świetlne pod stropem Szatni R1 (y = 4.80 m).
  for (const x of [-6.0, 0, 6.0]) {
    highbayLightStrip(k, x, Y_R1_CEIL, 25.5, 0);
    highbayLightStrip(k, x, Y_R1_CEIL, 32.5, 0);
  }
  ceilingCovePanel(k, -10.8, Y_R1_CEIL, 29.0, 0.45, 11.0);
  ceilingCovePanel(k, 10.8, Y_R1_CEIL, 29.0, 0.45, 11.0);
}

/** R2 — Główna Hala Reaktora Fuzyjnego „Komora Tokamaka Helios-IV” (L0 + G1 + G2, X ∈ [-22, 22], Z ∈ [-22, 22]). */
function buildRoomR2(k, p) {
  // 1. Kolizja cokołu i solenoidu Tokamaka w (0, 0, 0) wraz z pasami ostrzegawczymi.
  buildReactorBaseCollider(k, p);

  // 2. Bezpośrednie otoczenie podstawy reaktora (R = 6.4..8.5 m):
  // 4 Transformatory Impulsowe `fus_pulse_transformer` (2.4 × 2.2 × 2.0 m) przy północnej i południowej podstawie cokołu
  // (zostawiają 5.2 m czystej osi widoku X ∈ [-2.6, +2.6] ze spawnu R1 na Tokamak!)
  p.prop('fus_pulse_transformer', -3.8, -7.2, Y_L0, 0);
  p.prop('fus_pulse_transformer', 3.8, -7.2, Y_L0, 0);
  p.prop('fus_pulse_transformer', -3.8, 7.2, Y_L0, 2);
  p.prop('fus_pulse_transformer', 3.8, 7.2, Y_L0, 2);

  // 4 Pancerne Skrzynie Rozdzielcze `fus_junction_box` (1.6 × 1.15 × 0.85 m) przy zachodniej i wschodniej podstawie cokołu.
  p.prop('fus_junction_box', -6.6, -1.8, Y_L0, 1);
  p.prop('fus_junction_box', -6.6, 1.8, Y_L0, 1);
  p.prop('fus_junction_box', 6.6, -1.8, Y_L0, -1);
  p.prop('fus_junction_box', 6.6, 1.8, Y_L0, -1);

  // 3. Pierścień osłon wokół Tokamaka na Poziomie Głównym L0 (y = 0.00 m):
  // 6 Jednostek Kriopomp Helowych `fus_cryopump_unit` (2.8 × 2.6 × 1.8 m) w kwadrantach NW, NE, SW, SE
  // — poza spawnami #1 (-8,0,14), #2 (8,0,14), #5 (-8,0,-13), #6 (8,0,-13).
  p.prop('fus_cryopump_unit', -10.5, -10.5, Y_L0, 0);
  p.prop('fus_cryopump_unit', 10.5, -10.5, Y_L0, 0);
  p.prop('fus_cryopump_unit', -10.5, 10.5, Y_L0, 2);
  p.prop('fus_cryopump_unit', 10.5, 10.5, Y_L0, 2);
  p.prop('fus_cryopump_unit', -14.8, 14.8, Y_L0, 2);
  p.prop('fus_cryopump_unit', 14.8, 14.8, Y_L0, 2);

  // 6 Wysokich Łuków Rurociągów Chłodziwa `fus_coolant_pipe_arch` (1.6 × 4.4 × 4.8 m, prześwit 3.4 m >= 2.2 m)
  // łączących kriopompy i banki kondensatorów z cokołem reaktora.
  coolantPipeArch(k, p, -8.2, Y_L0, -6.5, 0);
  coolantPipeArch(k, p, 8.2, Y_L0, -6.5, 0);
  coolantPipeArch(k, p, -8.2, Y_L0, 6.5, 0);
  coolantPipeArch(k, p, 8.2, Y_L0, 6.5, 0);
  coolantPipeArch(k, p, -14.8, Y_L0, 11.8, 1);
  coolantPipeArch(k, p, 14.8, Y_L0, 11.8, 1);

  // 4 Inżektory Wiązki Neutralnej `fus_neutral_beam_injector` (4.8 × 1.85 × 1.6 m) wycelowane radialnie w reaktor!
  p.prop('fus_neutral_beam_injector', -4.2, -13.2, Y_L0, 1);
  p.prop('fus_neutral_beam_injector', 4.2, -13.2, Y_L0, -1);
  p.prop('fus_neutral_beam_injector', -4.4, 14.2, Y_L0, -1);
  p.prop('fus_neutral_beam_injector', 4.4, 14.2, Y_L0, 1);

  // 4 Pulpity Diagnostyki Polowej `fus_diagnostic_console` (2.6 × 1.25 × 1.1 m) na osiach kardynalnych:
  // Zachodni (-12.0, 0, -0.8) i Wschodni (+12.0, 0, -0.8) stoją tuż przed naukowcami C1 (-10.5, 0, 0) i C2 (10.5, 0, 0)
  // oraz poza spawnami #3 (-13, 0, 2) i #4 (13, 0, 2)!
  p.prop('fus_diagnostic_console', -12.0, -0.8, Y_L0, 1);
  p.prop('fus_diagnostic_console', 12.0, -0.8, Y_L0, -1);
  p.prop('fus_diagnostic_console', 0.0, -11.5, Y_L0, 0);
  p.prop('fus_diagnostic_console', 0.0, 11.5, Y_L0, 2);

  // 6 Banków Kondensatorów Impulsowych `fus_capacitor_bank` (3.6 × 2.8 × 1.6 m) przy filarach podgaleryjnych
  // (w tym zachodni przy Hazardzie #1 `reactor-west-capacitor-arc` na (-16.0, 1.0, -3.0)).
  p.prop('fus_capacitor_bank', -15.8, -4.2, Y_L0, 1);
  p.prop('fus_capacitor_bank', -15.8, 6.5, Y_L0, 1);
  p.prop('fus_capacitor_bank', 15.8, -4.2, Y_L0, -1);
  p.prop('fus_capacitor_bank', 15.8, 6.5, Y_L0, -1);
  p.prop('fus_capacitor_bank', -8.5, -20.2, Y_L0, 0);
  p.prop('fus_capacitor_bank', 8.5, -20.2, Y_L0, 0);

  // 3 Transformatory Impulsowe `fus_pulse_transformer` (2.4 × 2.2 × 2.0 m) w niszach SW, SE i N pod galeriami
  // (osłaniające kryjówki naukowców HS-02 (-19.5, 0, 10.5) i HS-04 (19.5, 0, 10.5))
  // oraz 2 osłony w narożnikach NW i NE przed kryjówkami HS-01 (-19.5, 0, -16.5) i HS-03 (19.5, 0, -16.5).
  p.prop('fus_pulse_transformer', -19.5, 7.2, Y_L0, 1);
  p.prop('fus_pulse_transformer', 19.5, 7.2, Y_L0, -1);
  p.prop('fus_pulse_transformer', 0.0, -20.0, Y_L0, 0);
  p.prop('fus_tritium_cask_pallet', -19.5, -19.2, Y_L0, 0);
  p.prop('fus_tritium_cask_pallet', 19.5, -19.2, Y_L0, 0);

  // Dodatkowe skrzynie rozdzielcze na posadzce głównej R2 (z zachowaniem przejść >= 1.6 m):
  p.prop('fus_junction_box', -11.2, 15.8, Y_L0, 0);
  p.prop('fus_junction_box', 11.2, 15.8, Y_L0, 0);
  p.prop('fus_junction_box', -12.2, -15.2, Y_L0, 2);
  p.prop('fus_junction_box', 12.2, -15.2, Y_L0, 2);

  // 4. Ścienne płyty ekranowania `fus_shield_wall_panel` (4.0 × 4.8 × 0.35 m),
  // kolektory rur `fus_wall_pipe_manifold` (4.0 × 3.6 × 0.55 m) i szynoprzewody `fus_wall_power_busbar` (4.0 × 4.2 × 0.45 m)
  // wzdłuż ścian Hali Reaktora R2 (poza portalami i biegami ramp!).
  p.prop('fus_wall_pipe_manifold', -21.48, 0.0, Y_L0, 1);
  p.prop('fus_wall_pipe_manifold', 21.48, -2.0, Y_L0, -1);
  p.prop('fus_wall_pipe_manifold', -13.5, -21.48, Y_L0, 0);
  p.prop('fus_wall_pipe_manifold', 13.5, -21.48, Y_L0, 0);
  p.prop('fus_wall_power_busbar', -21.52, -19.0, Y_L0, 1);
  p.prop('fus_wall_power_busbar', 21.52, -19.0, Y_L0, -1);
  p.prop('fus_wall_power_busbar', -4.5, -21.52, Y_L0, 0);
  p.prop('fus_wall_power_busbar', 4.5, -21.52, Y_L0, 0);
  p.prop('fus_wall_power_busbar', -21.52, 19.5, Y_L0, 1);
  p.prop('fus_wall_power_busbar', 21.52, 19.5, Y_L0, -1);
  p.prop('fus_shield_wall_panel', -9.0, -21.58, Y_L0, 0);
  p.prop('fus_shield_wall_panel', 0.0, -21.58, Y_L0, 0);
  p.prop('fus_shield_wall_panel', 9.0, -21.58, Y_L0, 0);
  p.prop('fus_shield_wall_panel', -21.58, 9.5, Y_L0, 1);
  p.prop('fus_shield_wall_panel', 21.58, 9.5, Y_L0, -1);

  // Słupy konstrukcyjne podtrzymujące Galerie G1 (y = 0.0..4.4 m) i G2 (y = 4.8..9.2 m).
  for (const sx of [-1, 1]) {
    for (const z of [-17.8, -6.0, 5.5]) {
      const x = sx * 18.25;
      p.reserve(R(x - 0.28, x + 0.28, z - 0.28, z + 0.28), Y_L0);
      box(k, x, 2.2, z, 0.48, 4.4, 0.48, 'metal', { walkable: false });
    }
  }
  for (const x of [-11.5, -5.5, 5.5, 11.5]) {
    p.reserve(R(x - 0.28, x + 0.28, -18.5, -17.9), Y_L0);
    box(k, x, 2.2, -18.2, 0.48, 4.4, 0.48, 'metal', { walkable: false });
  }

  // 5. Wyposażenie Galerii G1 (y = +4.80 m) oraz G2 (y = +9.60 m):
  // Skrzynie rozdzielcze `fus_junction_box`, pulpity, kolektory i szynoprzewody na ścianach G1
  // (z zachowaniem pełnego przejścia >= 2.6 m i czystych spawnów #11 (-20,4.8,0), #12 (20,4.8,0), #16..#18!).
  p.prop('fus_junction_box', -21.25, -10.0, Y_G1, 1);
  p.prop('fus_junction_box', 21.25, -10.0, Y_G1, -1);
  p.prop('fus_wall_pipe_manifold', -21.48, -14.5, Y_G1, 1);
  p.prop('fus_wall_pipe_manifold', 21.48, -14.5, Y_G1, -1);
  p.prop('fus_wall_power_busbar', -21.52, -4.5, Y_G1, 1);
  p.prop('fus_wall_power_busbar', 21.52, -4.5, Y_G1, -1);
  p.prop('fus_diagnostic_console', -7.5, -18.75, Y_G1, 2);
  p.prop('fus_junction_box', 6.0, -18.6, Y_G1, 2);

  // Podwieszane koryta kablowe `fus_overhead_cable_tray` (6.0 × 0.85 × 1.2 m) pod płytą Galerii G1 (spód y = 4.40 m -> y = 3.55 m)
  // oraz pod płytą Galerii G2 (spód y = 9.20 m -> y = 8.35 m).
  for (const x of [-7.5, 0.0, 7.5]) {
    overheadCableTray(k, x, 4.4, -20.0, 0);
  }
  for (const z of [-13.5, -6.0, 1.5]) {
    overheadCableTray(k, -20.0, 4.4, z, Q);
    overheadCableTray(k, 20.0, 4.4, z, Q);
  }
  overheadCableTray(k, -7.5, 9.2, -20.4, 0);
  overheadCableTray(k, 7.5, 9.2, -20.4, 0);
  for (const z of [-13.5, -4.5]) {
    overheadCableTray(k, -20.4, 9.2, z, Q);
    overheadCableTray(k, 20.4, 9.2, z, Q);
  }

  // Gęsta siatka opraw przemysłowych `fus_highbay_light_strip` pod sklepieniem Hali Reaktora (y = 19.20 m) oraz listwy pod galeriami.
  for (const x of [-15.0, -5.0, 5.0, 15.0]) {
    for (const z of [-15.0, -5.0, 5.0, 15.0]) {
      highbayLightStrip(k, x, Y_HALL_CEIL, z, 0);
    }
  }
  ceilingCovePanel(k, 0, 4.4, -18.2, 34.0, 0.35);
  ceilingCovePanel(k, -18.2, 4.4, -6.0, 0.35, 22.0);
  ceilingCovePanel(k, 18.2, 4.4, -6.0, 0.35, 22.0);
  ceilingCovePanel(k, 0, 9.2, -19.0, 36.0, 0.35);
  ceilingCovePanel(k, -19.0, 9.2, -6.0, 0.35, 22.0);
  ceilingCovePanel(k, 19.0, 9.2, -6.0, 0.35, 22.0);
}

/** R3 — Sterownia Główna Reaktora „Mostek Helios-IV” (G1, X ∈ [-22, 6], Z ∈ [-36, -22], y = +4.80 m). */
function buildRoomR3(k, p) {
  // 2 amfiteatralne rzędy Konsol Sterowania Reaktorem `fus_main_control_desk` (3.8 × 1.25 × 1.4 m × 4)
  // przed 15-metrowym oknem obserwacyjnym na Tokamak (Z = -22, X ∈ [-15, 0]):
  // - Rząd pierwszy (Z = -24.8): przy konsolach pracują naukowcy C5 (-11, 4.8, -26.5) i C6 (-3, 4.8, -26.5),
  //   a między konsolami i parapetem okna leżą kryjówki HS-06 (-13.5, 4.8, -23.2) i HS-07 (-2.5, 4.8, -23.2).
  p.prop('fus_main_control_desk', -11.0, -24.8, Y_G1, 0);
  p.prop('fus_diagnostic_console', -7.5, -24.8, Y_G1, 0);
  p.prop('fus_main_control_desk', -4.0, -24.8, Y_G1, 0);
  // - Rząd drugi (Z = -32.2): za spawnami #13 (-14, 4.8, -30) i #14 (-2, 4.8, -30) oraz punktem C (-8, 4.8, -29).
  p.prop('fus_main_control_desk', -14.0, -32.2, Y_G1, 0);
  p.prop('fus_main_control_desk', -2.0, -32.2, Y_G1, 0);

  // Boczne szafy telemetrii `fus_quantum_server_rack` (2.8 × 2.4 × 1.1 m), szynoprzewód i skrzynie rozdzielcze
  // osłaniające kryjówki HS-05 (-20.5, 4.8, -34.5) w narożniku NW oraz HS-08 (4.5, 4.8, -34.5) w narożniku NE.
  p.prop('fus_quantum_server_rack', -20.8, -31.2, Y_G1, 1);
  p.prop('fus_quantum_server_rack', 3.6, -32.2, Y_G1, 0);
  p.prop('fus_junction_box', -16.5, -34.8, Y_G1, 0);
  p.prop('fus_junction_box', -1.5, -34.8, Y_G1, 0);
  p.prop('fus_wall_power_busbar', 5.52, -33.2, Y_G1, -1);

  // Wielka Ściana Telemetrii i Schematu Cewki `fus_telemetry_screen_wall` (4.8 × 2.6 × 0.28 m)
  // na ścianie północnej (Z = -35.66, X = -15.5, na zachód od śluzy exit X ∈ [-10, -6]).
  deco(k, 'fus_telemetry_screen_wall', -15.5, Y_G1 + 1.1, -35.66, 0);
  deco(k, 'fus_telemetry_screen_wall', -1.0, Y_G1 + 1.1, -35.66, 0);

  // Oprawy sufitowe pod stropem Sterowni R3 (y = 9.60 m).
  for (const x of [-16.0, -8.0, 0.0]) {
    highbayLightStrip(k, x, Y_G1_CEIL, -25.5, 0);
    highbayLightStrip(k, x, Y_G1_CEIL, -32.5, 0);
  }
  ceilingCovePanel(k, -8.0, Y_G1_CEIL, -34.8, 24.0, 0.45);
}

/** R4 — Laboratorium Fizyki Plazmy i Wiązek (L0, X ∈ [-38, -22], Z ∈ [-22, 0], y = 0.0 m). */
function buildRoomR4(k, p) {
  // 2 długie Ławy Inżektora Wiązki Neutralnej `fus_neutral_beam_injector` (4.8 × 1.85 × 1.6 m) w osi pokoju
  // — poza naukowcem C3 (-29, 0, -15) i spawnem #7 (-28, 0, -11).
  p.prop('fus_neutral_beam_injector', -29.0, -17.5, Y_L0, 0);
  p.prop('fus_neutral_beam_injector', -28.5, -7.5, Y_L0, 0);

  // 3 Komory Próżniowe Próbników Plazmy `fus_plasma_test_chamber` (2.4 × 2.3 × 1.4 m) przy ścianie zachodniej i północnej,
  // dające osłonę dla kryjówek HS-09 (-36.5, 0, -20.5), HS-11 (-36.5, 0, -2.0) oraz HS-12 (-23.5, 0, -20.5).
  p.prop('fus_plasma_test_chamber', -35.2, -17.5, Y_L0, 1);
  p.prop('fus_plasma_test_chamber', -35.2, -4.2, Y_L0, 1);
  p.prop('fus_plasma_test_chamber', -25.8, -20.6, Y_L0, 0);

  // Stół laboratoryjny z oscyloskopami `lab_centrifuge_bench` (3.2 × 1.45 × 1.1 m) osłaniający kryjówkę HS-10 (-36.5, 0, -11.0),
  // pulpit diagnostyczny `fus_diagnostic_console`, konsola `lab_mainframe_console` i dygestorium `lab_chem_fume_hood`.
  p.prop('lab_centrifuge_bench', -34.8, -11.0, Y_L0, 1);
  p.prop('fus_diagnostic_console', -25.0, -18.4, Y_L0, 0);
  p.prop('lab_mainframe_console', -25.2, -2.0, Y_L0, 2);
  p.prop('lab_chem_fume_hood', -34.2, -0.95, Y_L0, 2);
  p.prop('fus_junction_box', -23.2, -11.0, Y_L0, -1);

  // Instalacje ścienne w Laboratorium R4 (w tym na ścianie północno-wschodniej widocznej w ujęciu 06-corner-nw!):
  p.prop('fus_wall_power_busbar', -22.45, -18.8, Y_L0, -1);
  p.prop('fus_wall_pipe_manifold', -33.5, -21.48, Y_L0, 0);
  p.prop('fus_wall_pipe_manifold', -25.0, -0.48, Y_L0, 2);
  p.prop('fus_shield_wall_panel', -37.58, -11.0, Y_L0, 1);

  // Podświetlana Tablica z Równaniami Magnetohydrodynamiki `fus_whiteboard_equations` (3.2 × 1.75 × 0.18 m)
  // na ścianie zachodniej (X = -37.71, Z = -6.0 — tuż przy naukowcu C4 (-34, 0, -6)) oraz na ścianie północnej.
  deco(k, 'fus_whiteboard_equations', -37.71, Y_L0 + 1.05, -6.0, Q);
  deco(k, 'fus_whiteboard_equations', -29.5, Y_L0 + 1.05, -21.71, 0);

  // Koryta kablowe i oprawy sufitowe pod stropem Laboratorium R4 (y = 5.60 m).
  for (const z of [-17.5, -11.0, -4.5]) {
    overheadCableTray(k, -30.0, Y_R4_CEIL, z, 0);
    highbayLightStrip(k, -33.5, Y_R4_CEIL, z, 0);
    highbayLightStrip(k, -26.5, Y_R4_CEIL, z, 0);
  }
  ceilingCovePanel(k, -36.8, Y_R4_CEIL, -11.0, 0.45, 18.0);
  ceilingCovePanel(k, -23.2, Y_R4_CEIL, -11.0, 0.45, 18.0);
}

/** R5 — Magazyn Paliwa Fuzyjnego: Deuter / Tryt (L0, X ∈ [-38, -22], Z ∈ [0, 22], y = 0.0 m). */
function buildRoomR5(k, p) {
  // 2 Suwnice Magazynu Paliwa `fus_fuel_gantry_crane` (14.0 × 1.4 × 3.2 m) pod stropem (y = 7.2 - 1.4 = 5.80 m).
  deco(k, 'fus_fuel_gantry_crane', -30.0, Y_R5_CEIL - 1.4, 6.5, 0);
  deco(k, 'fus_fuel_gantry_crane', -30.0, Y_R5_CEIL - 1.4, 16.5, 0);

  // 4 Palety Beczek Izotopowych Deuter / Tryt `fus_tritium_cask_pallet` (2.2 × 1.45 × 2.2 m)
  // — poza spawnem #8 (-28, 0, 16) oraz wiązką lasera `fuel-vault-isotope-laser` (Z = 11.0, X ∈ [-36.5, -29.5]).
  p.prop('fus_tritium_cask_pallet', -34.0, 6.0, Y_L0, 0);
  p.prop('fus_tritium_cask_pallet', -26.5, 8.5, Y_L0, 0);
  p.prop('fus_tritium_cask_pallet', -34.0, 14.8, Y_L0, 0);
  p.prop('fus_tritium_cask_pallet', -25.5, 19.2, Y_L0, 0);

  // 2 wysokie Kriogeniczne Zbiorniki Deuteru `fus_deuterium_cryo_tank` (2.8 × 3.6 × 2.8 m) z parą `steam`.
  p.prop('fus_deuterium_cryo_tank', -34.5, 19.0, Y_L0, 0);
  p.prop('fus_deuterium_cryo_tank', -35.0, 2.5, Y_L0, 0);
  k.fx('steam', -34.5, Y_L0 + 1.2, 19.0, 0.7);
  k.fx('steam', -35.0, Y_L0 + 1.2, 2.5, 0.7);

  // Dodatkowa aparatura kriogeniczna, transformator, pulpit diagnostyczny, kolektory ścienne i szynoprzewód.
  p.prop('fus_cryopump_unit', -25.5, 2.2, Y_L0, 0);
  p.prop('fus_pulse_transformer', -29.8, 20.2, Y_L0, 2);
  p.prop('fus_diagnostic_console', -25.8, 11.5, Y_L0, -1);
  p.prop('fus_junction_box', -23.0, 10.0, Y_L0, -1);
  p.prop('fus_wall_pipe_manifold', -37.48, 15.0, Y_L0, 1);
  p.prop('fus_wall_pipe_manifold', -25.5, 21.48, Y_L0, 2);
  p.prop('fus_wall_power_busbar', -22.48, 19.5, Y_L0, -1);
  p.prop('fus_shield_wall_panel', -37.58, 8.5, Y_L0, 1);

  // Pylony emitera bramki laserowej Hazard #2 `fuel-vault-isotope-laser` (Z = 11.0, X: -36.5 -> -29.5).
  for (const x of [-36.75, -29.25]) {
    p.reserve(R(x - 0.25, x + 0.25, 10.75, 11.25), Y_L0);
    box(k, x, Y_L0 + 0.6, 11.0, 0.24, 1.2, 0.24, 'machine', {
      walkable: false,
    });
    box(k, x, Y_L0 + 1.26, 11.0, 0.28, 0.12, 0.28, 'neon_amber', {
      walkable: false,
    });
  }

  overheadCableTray(k, -30.0, Y_R5_CEIL, 2.5, 0);
  overheadCableTray(k, -30.0, Y_R5_CEIL, 19.5, 0);
  for (const z of [4.0, 11.5, 18.5]) {
    highbayLightStrip(k, -33.5, Y_R5_CEIL, z, 0);
    highbayLightStrip(k, -26.5, Y_R5_CEIL, z, 0);
  }
  ceilingCovePanel(k, -36.8, Y_R5_CEIL, 11.0, 0.45, 18.0);
  ceilingCovePanel(k, -23.2, Y_R5_CEIL, 11.0, 0.45, 18.0);
}

/** R6 — Hala Turbin i Wymienników Ciepła (L0, X ∈ [22, 38], Z ∈ [-4, 22], y = 0.0 m). */
function buildRoomR6(k, p) {
  // 2 monumentalne Turbozespoły Parowo-MHD `fus_steam_turbine_generator` (3.8 × 2.8 × 7.2 m)
  // wzdłuż osi N–S, rozdzielone wybuchową beczką chłodziwa Hazard #4 na (29.5, 0.0, 9.0)
  // i odsunięte od spawnu #9 (26, 0, 15).
  p.prop('fus_steam_turbine_generator', 29.5, 3.2, Y_L0, 0);
  p.prop('fus_steam_turbine_generator', 30.5, 15.2, Y_L0, 0);

  // 3 pionowe Wymienniki Ciepła Obiegu Pierwotnego `fus_heat_exchanger_tower` (2.4 × 4.6 × 2.4 m) przy ścianie E.
  p.prop('fus_heat_exchanger_tower', 35.8, 1.5, Y_L0, -1);
  p.prop('fus_heat_exchanger_tower', 35.8, 9.0, Y_L0, -1);
  p.prop('fus_heat_exchanger_tower', 35.8, 16.5, Y_L0, -1);

  // Aparatura i osłony wypełniające zachodnią oraz północno-wschodnią część Hali Turbin (widoczną w 07-corner-se!):
  p.prop('fus_pulse_transformer', 25.2, 20.0, Y_L0, 2);
  p.prop('fus_cryopump_unit', 34.5, -1.8, Y_L0, 0);
  p.prop('fus_diagnostic_console', 25.6, 10.2, Y_L0, 1);
  p.prop('fus_junction_box', 23.0, 19.5, Y_L0, 1);
  p.prop('fus_junction_box', 34.8, 20.4, Y_L0, 2);

  // Szynoprzewód i kolektory rurowe na ścianie zachodniej, południowej i wschodniej R6.
  p.prop('fus_wall_power_busbar', 22.45, 9.0, Y_L0, 1);
  p.prop('fus_wall_pipe_manifold', 22.48, -1.5, Y_L0, 1);
  p.prop('fus_wall_pipe_manifold', 37.48, 5.2, Y_L0, -1);
  p.prop('fus_wall_pipe_manifold', 30.0, 21.48, Y_L0, 2);
  p.prop('fus_shield_wall_panel', 37.58, -1.5, Y_L0, -1);
  p.prop('fus_shield_wall_panel', 37.58, 19.5, Y_L0, -1);

  k.fx('steam', 35.8, Y_L0 + 1.5, 9.0, 0.85);
  k.fx('steam', 29.5, Y_L0 + 1.5, 3.2, 0.65);

  overheadCableTray(k, 26.0, Y_R6_CEIL, 3.0, Q);
  overheadCableTray(k, 26.0, Y_R6_CEIL, 15.0, Q);
  for (const z of [1.0, 9.0, 17.0]) {
    highbayLightStrip(k, 26.0, Y_R6_CEIL, z, 0);
    highbayLightStrip(k, 33.0, Y_R6_CEIL, z, 0);
  }
  ceilingCovePanel(k, 36.8, Y_R6_CEIL, 9.0, 0.45, 22.0);
  ceilingCovePanel(k, 23.2, Y_R6_CEIL, 9.0, 0.45, 22.0);
}

/** R7 — Serwerownia Diagnostyczna i Kwantowa Kontrola Cewki (L0, X ∈ [22, 38], Z ∈ [-22, -4], y = 0.0 m). */
function buildRoomR7(k, p) {
  // 3 rzędy Szaf Kwantowych Sterowania Cewką `fus_quantum_server_rack` (2.8 × 2.4 × 1.1 m × 6)
  // — poza spawnem #10 (26, 0, -18), naukowcem C7 (31.0, 0, -16.5), kryjówkami HS-13..HS-16
  //   oraz wiązką lasera Hazard #3 `server-coil-control-laser` (Z = -13.0, X ∈ [24.0, 30.0]).
  p.prop('fus_quantum_server_rack', 29.5, -19.2, Y_L0, 0);
  p.prop('fus_quantum_server_rack', 33.2, -19.2, Y_L0, 0);
  p.prop('fus_quantum_server_rack', 27.2, -14.4, Y_L0, 0);
  p.prop('fus_quantum_server_rack', 33.2, -14.4, Y_L0, 0);
  p.prop('fus_quantum_server_rack', 27.2, -8.5, Y_L0, 2);
  p.prop('fus_quantum_server_rack', 33.2, -8.5, Y_L0, 2);

  // Agregaty chłodzenia cieczowego (`lab_cryo_server_rack`), pulpit diagnostyczny, skrzynia rozdzielcza i szynoprzewody.
  p.prop('lab_cryo_server_rack', 35.0, -17.5, Y_L0, -1);
  p.prop('lab_cryo_server_rack', 35.2, -7.2, Y_L0, -1);
  p.prop('fus_diagnostic_console', 24.8, -6.2, Y_L0, 2);
  p.prop('fus_junction_box', 23.0, -18.2, Y_L0, 1);
  p.prop('fus_wall_power_busbar', 30.0, -21.52, Y_L0, 0);
  p.prop('fus_wall_pipe_manifold', 35.0, -4.48, Y_L0, 2);
  p.prop('fus_shield_wall_panel', 25.5, -21.58, Y_L0, 0);
  deco(k, 'fus_telemetry_screen_wall', 37.66, Y_L0 + 1.1, -14.5, -Q);
  deco(k, 'fus_telemetry_screen_wall', 25.0, Y_L0 + 1.1, -4.34, Math.PI);

  // Pylony emitera bramki laserowej Hazard #3 `server-coil-control-laser` (Z = -13.0, X: 24.0 -> 30.0).
  for (const x of [23.75, 30.25]) {
    p.reserve(R(x - 0.25, x + 0.25, -13.25, -12.75), Y_L0);
    box(k, x, Y_L0 + 0.6, -13.0, 0.24, 1.2, 0.24, 'machine', {
      walkable: false,
    });
    box(k, x, Y_L0 + 1.26, -13.0, 0.28, 0.12, 0.28, 'neon_blue', {
      walkable: false,
    });
  }

  overheadCableTray(k, 30.0, Y_R7_CEIL, -11.5, 0);
  for (const z of [-18.0, -8.5]) {
    highbayLightStrip(k, 26.5, Y_R7_CEIL, z, 0);
    highbayLightStrip(k, 33.5, Y_R7_CEIL, z, 0);
  }
  ceilingCovePanel(k, 36.8, Y_R7_CEIL, -13.0, 0.45, 14.0);
  ceilingCovePanel(k, 23.2, Y_R7_CEIL, -13.0, 0.45, 14.0);
}

/** R8 — Biuro Kierownika Naukowego Projektu „Helios” — Dr Haruto Mori (G1, X ∈ [6, 22], Z ∈ [-36, -22], y = +4.80 m). */
function buildRoomR8(k, p) {
  // 1. Reprezentacyjne Biurko Kierownika Naukowego `fus_director_desk` (2.8 × 1.15 × 1.3 m)
  // na (14.0, 4.8, -29.5) — przed nim stoi dr Haruto Mori C8 (14.0, 4.8, -28.0),
  // a bezpośrednio za nim znajduje się kryjówka HS-17 (14.0, 4.8, -31.2)!
  p.prop('fus_director_desk', 14.0, -29.5, Y_G1, 0);

  // 2. Komora Próżniowa z prototypem sztucznego implantu Rezonansu `fus_plasma_test_chamber` (2.4 × 2.3 × 1.4 m)
  // (Easter Egg #11) na (17.5, 4.8, -34.2) oraz pulpit diagnostyczny `fus_diagnostic_console` przy ścianie N.
  p.prop('fus_plasma_test_chamber', 17.5, -34.2, Y_G1, 0);
  p.prop('fus_diagnostic_console', 14.5, -34.4, Y_G1, 0);

  // 3. Regał archiwalny (`res_bookshelf_wall`), szafa pancerna (`lab_classified_cabinet`),
  // globus holograficzny (`res_holo_globe_stand`), skrzynia rozdzielcza i strefa wypoczynkowa
  // (`off_lounge_sofa`, `res_coffee_table_marble`, `res_ficus_planter`) osłaniające kryjówki HS-18, HS-19 i HS-20
  // i zostawiające pełny promień wokół spawnu #15 (11, 4.8, -26).
  p.prop('res_bookshelf_wall', 11.5, -35.2, Y_G1, 0);
  p.prop('lab_classified_cabinet', 8.2, -32.2, Y_G1, 0);
  p.prop('res_holo_globe_stand', 10.5, -32.2, Y_G1, 0);
  p.prop('fus_junction_box', 6.85, -34.0, Y_G1, 1);
  p.prop('off_lounge_sofa', 20.0, -26.2, Y_G1, -1);
  p.prop('res_coffee_table_marble', 17.8, -26.2, Y_G1, 1);
  p.prop('res_ficus_planter', 7.4, -23.5, Y_G1, 0);

  // 4. Tablica Schematu Zasilania Sztucznych Implantów Rezonansu `fus_whiteboard_equations` (3.2 × 1.75 × 0.18 m)
  // na ścianie wschodniej (X = +21.71, Y = 4.8 + 1.05 = 5.85, Z = -29.5) oraz ekran telemetrii na ścianie północnej.
  deco(k, 'fus_whiteboard_equations', 21.71, Y_G1 + 1.05, -29.5, -Q);
  deco(k, 'fus_telemetry_screen_wall', 14.5, Y_G1 + 1.1, -35.66, 0);
  box(k, 21.72, Y_G1 + 2.95, -29.5, 0.18, 0.08, 3.4, 'light_panel', {
    walkable: false,
  });

  // Oprawy sufitowe pod stropem Biura R8 (y = 9.60 m).
  for (const x of [10.5, 17.5]) {
    highbayLightStrip(k, x, Y_G1_CEIL, -26.0, 0);
    highbayLightStrip(k, x, Y_G1_CEIL, -32.5, 0);
  }
  ceilingCovePanel(k, 14.0, Y_G1_CEIL, -34.8, 13.0, 0.45);
}

export function buildRooms(k, placer) {
  buildRoomR1(k, placer);
  buildRoomR2(k, placer);
  buildRoomR3(k, placer);
  buildRoomR4(k, placer);
  buildRoomR5(k, placer);
  buildRoomR6(k, placer);
  buildRoomR7(k, placer);
  buildRoomR8(k, placer);
}
