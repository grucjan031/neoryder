// Wyposażenie tematyczne 8 pomieszczeń Tajnego Laboratorium Kurogane Arms (run3 — Sektor X-51):
// P1 (Kordon Zero), P2 (Czarne Archiwum „Strefa 51”), P3 (Biochemia), P4 (Zbrojownia Prototypów),
// P5 (Centralny Hol i Szyb Windy), B1 (Wielka Sala Testów Humanoidalnych — 16 kokonów),
// B2 (Szatnia Dekontaminacyjna), B3 (Zaplecze Serwerowe „Krypta Danych”).
import {
  H_HALL,
  H_WING,
  MAT_BUNKER,
  MAT_CLEAN,
  PI,
  Q,
  R,
  Y_B1_CEIL,
  Y_B23_CEIL,
  Y_BASEMENT,
  Y_CATWALK,
  Y_PARTER,
  bioScannerGate,
  box,
  ceilingStrip,
  deconShower,
  deco,
  observationWindow,
  solid,
} from './_run3Kit.mjs';

/**
 * 16 wielkich kokonów humanoidalnych w 4 gniazdach badawczych w B1 (`y = -5.20 m`):
 * - Gniazdo SW (Bio-Inkubacja Alfa): K-01..K-03 `lab_cocoon_tall` + K-04 `lab_cocoon_breached` (EE-8!)
 * - Gniazdo SE (Krio-Staza Beta): K-05..K-08 `lab_cocoon_tall_cryo`
 * - Gniazdo NW (Bio-Inkubacja Gamma): K-09..K-12 `lab_cocoon_tall`
 * - Gniazdo NE (Synteza Rezonansu Delta): K-13..K-16 `lab_cocoon_tall_cryo`
 */
export const COCOON_CLUSTERS = [
  {
    id: 'SW',
    manifoldPos: [-10, -0.8, -16.25],
    cocoons: [
      { id: 'K-01', model: 'lab_cocoon_tall', x: -12.5, z: -14.0, turn: 0 },
      { id: 'K-02', model: 'lab_cocoon_tall', x: -7.5, z: -14.0, turn: 0 },
      { id: 'K-03', model: 'lab_cocoon_tall', x: -12.5, z: -18.5, turn: 2 },
      {
        id: 'K-04',
        model: 'lab_cocoon_breached',
        x: -7.5,
        z: -18.5,
        turn: 1,
      },
    ],
  },
  {
    id: 'SE',
    manifoldPos: [10, -0.8, -16.25],
    cocoons: [
      { id: 'K-05', model: 'lab_cocoon_tall_cryo', x: 7.5, z: -14.0, turn: 0 },
      { id: 'K-06', model: 'lab_cocoon_tall_cryo', x: 12.5, z: -14.0, turn: 0 },
      { id: 'K-07', model: 'lab_cocoon_tall_cryo', x: 7.5, z: -18.5, turn: 2 },
      { id: 'K-08', model: 'lab_cocoon_tall_cryo', x: 12.5, z: -18.5, turn: 2 },
    ],
  },
  {
    id: 'NW',
    manifoldPos: [-10, -0.8, -28.25],
    cocoons: [
      { id: 'K-09', model: 'lab_cocoon_tall', x: -12.5, z: -26.0, turn: 0 },
      { id: 'K-10', model: 'lab_cocoon_tall', x: -7.5, z: -26.0, turn: 0 },
      { id: 'K-11', model: 'lab_cocoon_tall', x: -12.5, z: -30.5, turn: 2 },
      { id: 'K-12', model: 'lab_cocoon_tall', x: -7.5, z: -30.5, turn: 2 },
    ],
  },
  {
    id: 'NE',
    manifoldPos: [10, -0.8, -28.25],
    cocoons: [
      { id: 'K-13', model: 'lab_cocoon_tall_cryo', x: 7.5, z: -26.0, turn: 0 },
      { id: 'K-14', model: 'lab_cocoon_tall_cryo', x: 12.5, z: -26.0, turn: 0 },
      { id: 'K-15', model: 'lab_cocoon_tall_cryo', x: 7.5, z: -30.5, turn: 2 },
      { id: 'K-16', model: 'lab_cocoon_tall_cryo', x: 12.5, z: -30.5, turn: 2 },
    ],
  },
];

/** P1 — Punkt Kontrolny i Śluza Bezpieczeństwa „Kordon Zero” (X ∈ [-26, -10], Z ∈ [14, 28], y = 0). */
function buildRoomP1(k, p) {
  // Centralna bramka skanera biometrycznego (wolny środek przejścia na X = -18).
  bioScannerGate(k, p, -18, Y_PARTER, 21, 0);
  // Pancerna lada dyżurki ochrony z monitorami CCTV.
  p.prop('lab_security_desk', -22.5, 24.2, Y_PARTER, 0);
  // 2 szafy depozytowe przy ścianie zachodniej oraz automat z napojami w narożniku SW.
  p.prop('lab_classified_cabinet', -25.1, 17.5, Y_PARTER, 1);
  p.prop('lab_classified_cabinet', -25.1, 19.6, Y_PARTER, 1);
  p.prop('city_vending', -24.9, 26.8, Y_PARTER, 0);
  // Stojak z kombinezonami awaryjnymi przy ścianie południowej i skrzynie Kurogane.
  p.prop('lab_hazmat_suit_rack', -15.5, 27.2, Y_PARTER, 2);
  p.prop('wh_weapon_case_stack', -12.2, 25.8, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', -15.2, 23.5, Y_PARTER, 0);
  p.prop('lab_cocoon_incubator', -21.8, 20.5, Y_PARTER, 0);
  // 2 zapory tworzące szykanę (z zachowaniem gęstości osłon <= 8 m i czystego spawnu (-18, 0, 17)).
  p.prop('city_barrier', -13.5, 17.5, Y_PARTER, 0);
  p.prop('city_barrier', -22.0, 16.5, Y_PARTER, 0);
  // Detal architektoniczny ścian P1: pilastry, listwa techniczna, ekrany, tablice i rury.
  for (const z of [15.5, 21.0, 25.5])
    box(k, -25.72, 2.4, z, 0.16, H_WING, 0.32, 'trim', { walkable: false });
  for (const x of [-23.5, -18.5, -13.5])
    box(k, x, 2.4, 27.72, 0.32, H_WING, 0.16, 'trim', { walkable: false });
  box(k, -18.0, 3.6, 27.74, 14.8, 0.08, 0.08, 'neon_amber', { walkable: false });
  box(k, -25.74, 3.6, 21.0, 0.08, 0.08, 12.8, 'neon_amber', { walkable: false });
  for (const z of [17.5, 21.0, 24.5])
    box(k, -18.0, 4.68, z, 15.6, 0.22, 0.28, 'machine', {
      ceiling: true,
      walkable: false,
    });
  for (const x of [-22, -14])
    for (const z of [17.5, 24.5]) ceilingStrip(k, x, H_WING, z, 0);
  deco(k, 'mall_security_fixture', -10.2, 1.2, 24.5, -Q);
  deco(k, 'wh_wall_terminal', -10.2, 1.2, 17.8, -Q);
  deco(k, 'city_door', -25.8, 0, 22.8, Q);
  deco(k, 'city_ad_screen', -19.5, 1.2, 27.78, PI);
  deco(k, 'city_ad_screen', -23.0, 1.2, 14.22, 0);
  deco(k, 'lab_corkboard_evidence', -13.0, 1.1, 14.22, 0);
  deco(k, 'city_pipe_run', -25.78, -1.2, 14.8, Q);
}

/** P2 — Czarne Archiwum i Sala Odpraw „Strefa 51” (X ∈ [-26, -10], Z ∈ [0, 14], y = 0). */
function buildRoomP2(k, p) {
  // Centrum: Stół Odpraw Taktycznych z podświetlaną mapą i teczkami ŚCIŚLE TAJNE.
  p.prop('lab_briefing_holotable', -18, 7, Y_PARTER, 0);
  // Dwa rzędy pancernych szaf kartotekowych tworzących osłony (poza komórkami spawnów (-15,10) i (-21,4)).
  p.prop('lab_classified_cabinet', -23.6, 2.2, Y_PARTER, 0);
  p.prop('lab_classified_cabinet', -23.6, 10.5, Y_PARTER, 2);
  p.prop('lab_classified_cabinet', -12.5, 12.2, Y_PARTER, 2);
  p.prop('lab_classified_cabinet', -14.2, 2.2, Y_PARTER, 0);
  // Stanowisko obserwacyjne przy oknie na salę kokonów B1 + szafy pamięci archiwum.
  p.prop('lab_security_desk', -18.0, 2.0, Y_PARTER, 2);
  p.prop('lab_cryo_server_rack', -24.8, 12.4, Y_PARTER, 1);
  p.prop('wh_server_rack', -11.4, 2.2, Y_PARTER, -1);
  // Ściana zachodnia: Tablica Korkowa Śledcza z bursztynowo-zielonymi nitkami (zero czerwieni!).
  deco(k, 'lab_corkboard_evidence', -25.8, 1.1, 7.0, Q);
  // Tablica suchościeralna przy X = -25.8, Z = 3.2 pod Easter Egg #5 (schemat Rezonans -> Zysk).
  box(k, -25.76, 1.65, 3.2, 0.06, 1.3, 2.0, 'light_panel', { walkable: false });
  box(k, -25.78, 1.65, 3.2, 0.04, 1.42, 2.12, 'trim', { walkable: false });
  // Pancerne okno obserwacyjne w ścianie północnej (Z = 0, X ∈ [-19.5, -11.5]) z widokiem na B1.
  observationWindow(k, -15.5, 1.0, 0, 0);
  // Detal architektoniczny ścian P2: pilastry, listwy, ekrany i rury.
  for (const z of [1.2, 5.0, 9.2, 13.0])
    box(k, -25.72, 2.4, z, 0.16, H_WING, 0.28, 'trim', { walkable: false });
  box(k, -25.74, 3.6, 7.0, 0.08, 0.08, 12.8, 'neon_amber', { walkable: false });
  box(k, -10.26, 3.6, 7.0, 0.08, 0.08, 12.8, 'light_panel', { walkable: false });
  for (const z of [3.5, 7.0, 10.5])
    box(k, -18.0, 4.68, z, 15.6, 0.22, 0.28, 'machine', {
      ceiling: true,
      walkable: false,
    });
  for (const x of [-22, -14])
    for (const z of [3.5, 10.5]) ceilingStrip(k, x, H_WING, z, 0);
  deco(k, 'mall_security_fixture', -10.2, 1.2, 11.2, -Q);
  deco(k, 'wh_wall_terminal', -10.2, 1.2, 3.6, -Q);
  deco(k, 'city_ad_screen', -23.0, 1.2, 13.78, PI);
  deco(k, 'city_ad_screen', -13.0, 1.2, 13.78, PI);
  deco(k, 'city_pipe_run', -23.0, -1.2, 0.22, 0);
}

/** P3 — Laboratorium Biochemii i Ksenobiologii (X ∈ [10, 26], Z ∈ [14, 28], y = 0). */
function buildRoomP3(k, p) {
  // 2 wyspowe stoły z wirówkami i mikroskopami (osłony po obu stronach spawnu (18, 0, 17)).
  p.prop('lab_centrifuge_bench', 14.8, 21.5, Y_PARTER, 1);
  p.prop('lab_centrifuge_bench', 21.2, 21.5, Y_PARTER, -1);
  // 2 przeszklone komory dygestoriów przy ścianie wschodniej.
  p.prop('lab_chem_fume_hood', 24.8, 18.0, Y_PARTER, -1);
  p.prop('lab_chem_fume_hood', 24.8, 24.0, Y_PARTER, -1);
  // 2 mniejsze inkubatory próbek tkankowych przy ścianie południowej + osłona północna.
  p.prop('lab_cocoon_incubator', 14.0, 26.5, Y_PARTER, 2);
  p.prop('lab_cocoon_incubator', 22.0, 26.5, Y_PARTER, 2);
  p.prop('lab_cocoon_incubator', 13.2, 16.2, Y_PARTER, 0);
  p.prop('city_barrier', 22.2, 16.0, Y_PARTER, 0);
  // Detal architektoniczny ścian P3: pilastry, listwy bio-hazard, ekrany, klimatyzatory i rury.
  for (const z of [15.2, 21.0, 26.8])
    box(k, 25.72, 2.4, z, 0.16, H_WING, 0.32, 'trim', { walkable: false });
  for (const x of [12.0, 16.5, 19.5, 24.0])
    box(k, x, 2.4, 27.72, 0.32, H_WING, 0.16, 'trim', { walkable: false });
  box(k, 25.74, 3.6, 21.0, 0.08, 0.08, 12.8, 'neon_green', { walkable: false });
  box(k, 18.0, 3.6, 27.74, 14.8, 0.08, 0.08, 'neon_blue', { walkable: false });
  for (const z of [17.5, 21.0, 24.5])
    box(k, 18.0, 4.68, z, 15.6, 0.22, 0.28, 'machine', {
      ceiling: true,
      walkable: false,
    });
  deco(k, 'city_pipe_run', 25.78, -1.2, 21.0, -Q);
  deco(k, 'city_pipe_run', 18.0, -1.2, 27.78, PI);
  deco(k, 'lab_corkboard_evidence', 10.22, 1.1, 25.2, Q);
  deco(k, 'city_ad_screen', 13.0, 1.2, 14.22, 0);
  deco(k, 'city_ad_screen', 23.0, 1.2, 14.22, 0);
  deco(k, 'wh_wall_terminal', 20.5, 1.2, 27.78, PI);
  deco(k, 'city_ac_unit', 15.5, 3.2, 27.78, PI);
  for (const [x, z] of [
    [14.8, 24.5],
    [21.2, 17.5],
  ]) {
    deco(k, 'city_vent_grate', x, Y_PARTER, z);
    k.fx('steam', x, 0.06, z, 0.55);
  }
  for (const x of [14, 22])
    for (const z of [17.5, 24.5]) ceilingStrip(k, x, H_WING, z, 0);
  deco(k, 'mall_security_fixture', 10.2, 1.2, 16.8, Q);
}

/** P4 — Zbrojownia Prototypów i Komora Testów Anomalii (X ∈ [10, 26], Z ∈ [0, 14], y = 0). */
function buildRoomP4(k, p) {
  // W centrum: Komora Przechowywania Anomalii (klatka Faradaya z lewitującym rdzeniem).
  p.prop('lab_anomaly_containment_pod', 18.0, 7.0, Y_PARTER, 0);
  // 3 pancerne stojaki z prototypami broni + stół rusznikarski i skrzynie na broń.
  p.prop('lab_prototype_weapon_rack', 25.0, 5.0, Y_PARTER, -1);
  p.prop('lab_prototype_weapon_rack', 25.0, 10.0, Y_PARTER, -1);
  p.prop('lab_prototype_weapon_rack', 13.8, 13.0, Y_PARTER, 2);
  p.prop('wh_workbench_weapons', 22.2, 13.0, Y_PARTER, 2);
  p.prop('wh_weapon_case_stack', 21.2, 3.2, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', 12.4, 3.2, Y_PARTER, 0);
  // Pylony emitera bramki laserowej `prototype-test-beam` (od X=12.5 do X=16.2 na Z=7.0).
  for (const x of [12.3, 16.35]) {
    p.reserve(R(x - 0.2, x + 0.2, 6.8, 7.2), Y_PARTER);
    box(k, x, 0.6, 7.0, 0.22, 1.2, 0.22, 'machine', { walkable: false });
    box(k, x, 1.26, 7.0, 0.26, 0.12, 0.26, 'neon_violet', { walkable: false });
  }
  // Pancerne okno obserwacyjne w ścianie północnej (Z = 0, X ∈ [11.5, 19.5]) z widokiem na B1.
  observationWindow(k, 15.5, 1.0, 0, 0);
  // Detal architektoniczny ścian P4: pilastry, listwy fioletowe, ekrany, tablica i rury.
  for (const z of [1.2, 7.5, 12.8])
    box(k, 25.72, 2.4, z, 0.16, H_WING, 0.32, 'trim', { walkable: false });
  box(k, 25.74, 3.6, 7.0, 0.08, 0.08, 12.8, 'neon_violet', { walkable: false });
  box(k, 10.26, 3.6, 7.0, 0.08, 0.08, 12.8, 'neon_amber', { walkable: false });
  for (const z of [3.5, 7.0, 10.5])
    box(k, 18.0, 4.68, z, 15.6, 0.22, 0.28, 'machine', {
      ceiling: true,
      walkable: false,
    });
  deco(k, 'wh_wall_terminal', 10.2, 1.2, 9.8, Q);
  deco(k, 'mall_security_fixture', 10.2, 1.2, 3.5, Q);
  deco(k, 'city_ad_screen', 10.22, 1.2, 1.8, Q);
  deco(k, 'lab_corkboard_evidence', 22.8, 1.1, 0.22, 0);
  deco(k, 'city_pipe_run', 25.78, -1.2, 2.2, -Q);
  for (const x of [14, 22])
    for (const z of [3.5, 10.5]) ceilingStrip(k, x, H_WING, z, 0);
}

/** P5 — Centralny Hol Badawczy i Szyb Windy Towarowej (X ∈ [-10, 10], Z ∈ [0, 28], y = 0). */
function buildRoomP5(k, p) {
  // Oś startu (0, 0, 25) -> północ: bramka skanera biometrycznego na (0, 0, 18.5).
  bioScannerGate(k, p, 0, Y_PARTER, 18.5, 0);
  // Tematyczne, ciemne zapory bezpieczeństwa i stanowiska ochrony (zamiast białych skrzyń magazynowych!).
  p.prop('city_barrier', -3.6, 22.5, Y_PARTER, 0);
  p.prop('city_barrier', 3.6, 22.5, Y_PARTER, 0);
  p.prop('lab_security_desk', -5.6, 18.5, Y_PARTER, 0);
  p.prop('lab_security_desk', 5.6, 18.5, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', -5.6, 24.2, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', 5.6, 24.2, Y_PARTER, 0);
  p.prop('city_barrier', -3.6, 14.5, Y_PARTER, 0);
  p.prop('city_barrier', 3.6, 14.5, Y_PARTER, 0);
  p.prop('city_barrier', -5.6, 10.5, Y_PARTER, 0);
  p.prop('city_barrier', 5.6, 10.5, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', -3.6, 3.5, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', 3.6, 3.5, Y_PARTER, 0);
  p.prop('lab_cocoon_incubator', -8.2, 3.0, Y_PARTER, 0);
  p.prop('lab_cocoon_incubator', 8.2, 3.0, Y_PARTER, 0);
  // Ławki dla personelu oczekującego na autoryzację przy ścianach bocznych Holu.
  p.prop('lab_locker_bench', -8.8, 14.0, Y_PARTER, 1);
  p.prop('lab_locker_bench', 8.8, 14.0, Y_PARTER, 1);
  p.prop('lab_locker_bench', -8.8, 25.5, Y_PARTER, 1);
  p.prop('lab_locker_bench', 8.8, 25.5, Y_PARTER, 1);
  // 4 filary konstrukcyjne podtrzymujące strop Holu (H = 6.40 m), między bramami bocznymi.
  for (const sx of [-1, 1])
    for (const z of [12.0, 16.0]) {
      const x = sx * 8.2;
      p.reserve(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), Y_PARTER);
      box(k, x, H_HALL / 2, z, 1.0, H_HALL, 1.0, MAT_CLEAN, {
        walkable: false,
      });
      box(k, x - sx * 0.52, H_HALL / 2, z, 0.06, H_HALL - 0.8, 0.14, 'neon_blue', {
        walkable: false,
      });
      deco(
        k,
        'mall_security_fixture',
        x - sx * 0.5,
        1.25,
        z,
        sx > 0 ? -Q : Q,
      );
    }
  // Wyspa Głównej Konsoli Nadzoru Ośrodka (0, 0, 9.5) z kubkiem EE-4 i bocznymi modułami sprzętowymi.
  p.prop('lab_mainframe_console', 0, 9.5, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', -2.6, 9.5, Y_PARTER, 1);
  p.prop('wh_weapon_case_stack', 2.6, 9.5, Y_PARTER, 1);

  // Rytm architektoniczny ścian P5: pilastry co ~3.5 m, poziome listwy świetlne, drzwi serwisowe, ekrany i rury.
  for (const sx of [-1, 1]) {
    const xWall = sx * 9.72;
    const xLed = sx * 9.63;
    const yaw = sx > 0 ? -Q : Q;
    for (const [i, z] of [1.2, 4.4, 9.6, 12.5, 15.5, 18.4, 23.6, 26.8].entries()) {
      box(k, xWall, H_HALL / 2, z, 0.18, H_HALL, 0.36, 'trim', {
        walkable: false,
      });
      box(
        k,
        xLed,
        3.4,
        z,
        0.04,
        3.6,
        0.08,
        i % 2 === 0 ? 'neon_blue' : 'neon_amber',
        { walkable: false },
      );
    }
    // Ciągły gzyms techniczny nad bramami (y = 3.55..3.75 m) oraz fryz podstropowy (y = 5.35..5.55 m)
    box(k, sx * 9.74, 3.65, 14.0, 0.14, 0.2, 27.4, 'machine', { walkable: false });
    box(k, sx * 9.66, 3.53, 14.0, 0.04, 0.05, 27.2, 'neon_blue', { walkable: false });
    box(k, sx * 9.74, 5.45, 14.0, 0.16, 0.22, 27.4, 'trim', { walkable: false });
    box(k, sx * 9.65, 5.32, 14.0, 0.04, 0.05, 27.2, 'light_panel', { walkable: false });
    // Poziome odbojnice cokołowe między bramami (y = 1.05 m)
    for (const [z0, z1] of [
      [0.4, 4.2],
      [9.8, 18.2],
      [23.8, 27.6],
    ]) {
      box(
        k,
        sx * 9.75,
        1.05,
        (z0 + z1) / 2,
        0.1,
        0.14,
        z1 - z0,
        'machine',
        { walkable: false },
      );
      box(
        k,
        sx * 9.69,
        1.14,
        (z0 + z1) / 2,
        0.04,
        0.04,
        z1 - z0 - 0.2,
        'neon_amber',
        { walkable: false },
      );
    }
    // Wyposażenie ścian bocznych Holu: rury, ekrany informacyjne i terminale
    deco(k, 'city_pipe_run', sx * 9.78, 0, 2.8, yaw);
    deco(k, 'city_pipe_run', sx * 9.78, 0, 14.0, yaw);
    deco(k, 'city_ad_screen', sx * 9.78, 1.35, 11.0, yaw);
    deco(k, 'city_ad_screen', sx * 9.78, 1.35, 17.0, yaw);
    deco(k, 'wh_wall_terminal', sx * 9.78, 1.2, 24.4, yaw);
  }
  // Ściana południowa Holu (Z = 27.78): tablice informacyjne i drzwi techniczne po bokach wejścia
  for (const sx of [-1, 1]) {
    deco(k, 'lab_corkboard_evidence', sx * 4.5, 1.15, 27.78, PI);
    deco(k, 'city_door', sx * 7.5, 0, 27.78, PI);
  }
  // Dźwigary sufitowe, koryta kablowe i przewieszenia kabli pod stropem Holu (y = 6.40 m)
  for (const z of [2.0, 6.5, 11.0, 16.0, 21.0, 25.5])
    box(k, 0, 6.22, z, 19.4, 0.32, 0.35, 'machine', {
      ceiling: true,
      walkable: false,
    });
  for (const sx of [-1, 1])
    box(k, sx * 4.5, 6.18, 14.0, 0.45, 0.18, 27.4, 'trim', {
      ceiling: true,
      walkable: false,
    });
  for (const z of [4.2, 14.0, 23.8])
    deco(k, 'city_cable_span', 0, 5.95, z, 0, 1.96);
  for (const [x, z] of [
    [-4.5, 16.5],
    [4.5, 16.5],
    [-4.5, 6.5],
    [4.5, 6.5],
  ]) {
    deco(k, 'city_vent_grate', x, Y_PARTER, z);
    k.fx('steam', x, 0.06, z, 0.45);
  }

  // Północna krawędź Holu (X = 0, Z = -1.6, Y = -5.2..+6.4 m): Szyb Windy Towarowej.
  deco(k, 'lab_freight_elevator', 0, Y_BASEMENT, -1.6, 0);
  p.reserve(R(-2.4, 2.4, -3.6, 0.4), Y_PARTER);
  p.reserve(R(-2.4, 2.4, -3.6, 0.4), Y_CATWALK);
  p.reserve(R(-2.4, 2.4, -3.6, 0.4), Y_BASEMENT);
  box(k, 0, 0.6, -1.6, 4.8, 11.6, 4.0, 'metal', {
    visible: false,
    walkable: false,
  });
  // Oprawy sufitowe pod stropem Holu (y = 6.40 m).
  for (const x of [-4.5, 0, 4.5])
    for (const z of [4.0, 11.0, 18.5, 24.5])
      ceilingStrip(k, x, H_HALL, z, 0);
}

/** B1 — Wielka Sala Testów Humanoidalnych „Inkubator Chimera” (X ∈ [-20, 20], Z ∈ [-44, 0]). */
function buildRoomB1(k, p) {
  // 4 gniazda po 4 wielkie szklane kokony + podstropowe kolektory rur `lab_ceiling_manifold`.
  for (const cluster of COCOON_CLUSTERS) {
    const [mx, my, mz] = cluster.manifoldPos;
    deco(k, 'lab_ceiling_manifold', mx, my, mz, 0);
    for (const c of cluster.cocoons) {
      p.prop(c.model, c.x, c.z, Y_BASEMENT, c.turn);
    }
  }
  // Mostek Centralny B1 (y = -1.60 m): konsola sterowania inkubatorami na podeście centralnym
  // (X = 0, Z = -19.75), dzięki czemu punkt B i spawn #10 na (0, -1.6, -22) oraz pas Z ∈ [-23.5, -20.5] są wolne.
  p.prop('lab_mainframe_console', 0, -19.75, Y_CATWALK, 2);
  // Stanowiska obserwacyjne na bocznych skrzydłach Galerii Południowej (y = -1.60 m, widoczne w 03-east i 05-west!).
  p.prop('lab_centrifuge_bench', -10.5, -2.2, Y_CATWALK, 0);
  p.prop('lab_centrifuge_bench', 10.5, -2.2, Y_CATWALK, 0);
  p.prop('wh_weapon_case_stack', -14.2, -3.5, Y_CATWALK, 0);
  p.prop('wh_weapon_case_stack', 14.2, -3.5, Y_CATWALK, 0);
  p.prop('lab_cocoon_incubator', -17.8, -2.2, Y_CATWALK, 0);
  p.prop('lab_cocoon_incubator', 17.8, -2.2, Y_CATWALK, 0);

  // Słupy podtrzymujące pomosty obserwacyjne i Mostek Centralny (pod spodem y = -5.2..-2.0 m).
  for (const sx of [-1, 1]) {
    for (const z of [-9.0, -17.5, -26.0, -33.5]) {
      const x = sx * 17.3;
      p.reserve(R(x - 0.3, x + 0.3, z - 0.3, z + 0.3), Y_BASEMENT);
      box(k, x, -3.6, z, 0.5, 3.2, 0.5, 'metal', { walkable: false });
    }
    for (const x of [-5.5, 5.5]) {
      const z = sx < 0 ? -23.3 : -20.7;
      p.reserve(R(x - 0.25, x + 0.25, z - 0.25, z + 0.25), Y_BASEMENT);
      box(k, x, -3.6, z, 0.4, 3.2, 0.4, 'metal', { walkable: false });
    }
    // Podpory konstrukcyjne pod środkami biegów Ramp Dolnych i Ramp Pomostowych Północnych.
    box(k, sx * 4.6, -4.3, -9.5, 0.6, 1.8, 0.6, 'metal', { walkable: false });
    box(k, sx * 18.5, -4.4, -37.0, 0.6, 1.6, 0.6, 'metal', { walkable: false });
  }

  // Rytm architektoniczny żelbetowych ścian B1 (widocznych w 06-corner-nw, 03-east, 05-west):
  // pilastry bunkrowe, poziome koryta kablowe, rury i dźwigary podstropowe.
  for (const sx of [-1, 1]) {
    const xPil = sx * 19.65;
    const xLed = sx * 19.48;
    const ledColor = sx < 0 ? 'neon_green' : 'neon_blue';
    // Pilastry od posadzki piwnicy do stropu na odcinku południowym i środkowym (poza bramami B2/B3)
    for (const z of [-2.0, -6.0, -10.2, -17.2, -18.8, -25.2, -29.2, -33.0]) {
      box(k, xPil, -0.4, z, 0.3, 9.6, 0.48, MAT_BUNKER, { walkable: false });
      box(k, xLed, 1.4, z, 0.06, 5.2, 0.12, 'trim', { walkable: false });
      box(k, sx * 19.44, 1.4, z, 0.04, 4.4, 0.06, ledColor, { walkable: false });
    }
    // Górne pilastry nad Rampami Pomostowymi Północnymi (y = -0.8..+4.4 m, pełny prześwit na rampie)
    for (const z of [-37.0, -41.0]) {
      box(k, xPil, 1.8, z, 0.3, 5.2, 0.48, MAT_BUNKER, { walkable: false });
      box(k, sx * 19.44, 1.8, z, 0.04, 4.2, 0.06, ledColor, { walkable: false });
    }
    // Poziome koryta kablowe i gzymsy techniczne wzdłuż ścian bocznych B1 (y = +1.0 m oraz y = +3.6 m)
    box(k, sx * 19.68, 1.0, -22.0, 0.24, 0.26, 43.2, 'machine', { walkable: false });
    box(k, sx * 19.54, 1.0, -22.0, 0.04, 0.06, 43.0, ledColor, { walkable: false });
    box(k, sx * 19.68, 3.6, -22.0, 0.26, 0.3, 43.2, 'trim', { walkable: false });
    box(k, sx * 19.53, 3.6, -22.0, 0.04, 0.06, 43.0, 'light_panel', {
      walkable: false,
    });
  }
  // Pilastry i magistrale kablowe na ścianie północnej B1 (Z = -43.65) oraz południowej (Z = -0.35)
  for (const x of [-15.5, -10.5, -4.5, 4.5, 10.5, 15.5]) {
    box(k, x, -0.4, -43.65, 0.48, 9.6, 0.3, MAT_BUNKER, { walkable: false });
    box(
      k,
      x,
      0.8,
      -43.48,
      0.08,
      5.6,
      0.04,
      x < 0 ? 'neon_green' : 'neon_blue',
      { walkable: false },
    );
  }
  box(k, 0, 1.0, -43.68, 39.2, 0.26, 0.24, 'machine', { walkable: false });
  box(k, 0, 3.6, -43.68, 39.2, 0.3, 0.26, 'trim', { walkable: false });
  for (const sx of [-1, 1]) {
    deco(k, 'city_ad_screen', sx * 6.2, Y_BASEMENT + 1.35, -43.78, 0);
    deco(k, 'wh_wall_terminal', sx * 3.2, Y_BASEMENT + 1.2, -43.78, 0);
    deco(k, 'mall_security_fixture', sx * 14.0, Y_BASEMENT + 1.25, -43.78, 0);
  }
  // Dźwigary podstropowe i wzdłużne koryta kablowe na stropie B1 (y = +4.40 m, ceiling: true)
  for (const z of [-4.0, -10.5, -22.0, -33.5, -40.0])
    box(k, 0, 4.2, z, 39.4, 0.36, 0.4, 'machine', {
      ceiling: true,
      walkable: false,
    });
  for (const sx of [-1, 1])
    box(k, sx * 10.0, 4.22, -22.0, 0.6, 0.28, 43.2, 'trim', {
      ceiling: true,
      walkable: false,
    });

  // Osłony w alei środkowej, pod spocznikiem oraz w północnej strefie ewakuacji (gęstość <= 7 m, ciemne materiały!).
  p.prop('lab_mainframe_console', 0, -9.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', 0, -12.2, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -7.8, -8.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 7.8, -8.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -16.0, -4.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 16.0, -4.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -11.5, -3.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 11.5, -3.5, Y_BASEMENT, 0);
  p.prop('city_barrier', -4.5, -3.5, Y_BASEMENT, 0);
  p.prop('city_barrier', 4.5, -3.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', 3.6, -18.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -10.0, -22.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 10.0, -22.0, Y_BASEMENT, 0);
  p.prop('lab_centrifuge_bench', -3.8, -24.5, Y_BASEMENT, 1);
  p.prop('lab_centrifuge_bench', 3.8, -24.5, Y_BASEMENT, -1);
  p.prop('lab_mainframe_console', 0, -33.0, Y_BASEMENT, 2);
  p.prop('city_barrier', -4.2, -36.5, Y_BASEMENT, 0);
  p.prop('city_barrier', 4.2, -35.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -7.5, -37.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 7.5, -37.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', -13.0, -37.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', 13.0, -37.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -11.5, -41.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 11.5, -41.5, Y_BASEMENT, 0);
  p.prop('city_barrier', -11.5, -8.0, Y_BASEMENT, 0);
  p.prop('city_barrier', 11.5, -8.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -15.2, -18.0, Y_BASEMENT, 1);
  p.prop('wh_weapon_case_stack', 15.2, -18.0, Y_BASEMENT, 1);
  p.prop('wh_weapon_case_stack', -15.2, -28.0, Y_BASEMENT, 1);
  p.prop('wh_weapon_case_stack', 15.2, -28.0, Y_BASEMENT, 1);
  p.prop('city_barrier', -3.5, -29.5, Y_BASEMENT, 0);
  p.prop('city_barrier', 3.5, -29.5, Y_BASEMENT, 0);

  // Piony rur i kratki wentylacyjne (w tym kratka przy K-04, dokąd uciekł Obiekt 04!).
  for (const [x, z] of [
    [-7.5, -21.2],
    [7.5, -21.2],
    [-10.0, -35.0],
    [10.0, -35.0],
  ]) {
    deco(k, 'city_vent_grate', x, Y_BASEMENT, z);
    k.fx('steam', x, Y_BASEMENT + 0.06, z, 0.7);
  }
  for (const x of [-12.5, -8.5, 8.5, 12.5]) {
    deco(k, 'city_pipe_run', x, Y_BASEMENT, -43.78, 0);
  }
  for (const z of [-12, -26]) {
    deco(k, 'city_pipe_run', -19.78, Y_CATWALK, z, Q);
    deco(k, 'city_pipe_run', 19.78, Y_CATWALK, z, -Q);
  }

  // Oprawy sufitowe na stropie Wielkiej Sali (y = +4.40 m) oraz listwy light_panel pod pomostami.
  for (const x of [-15, -5, 5, 15])
    for (const z of [-8, -16, -22, -28, -37])
      ceilingStrip(k, x, Y_B1_CEIL, z, 0);
  for (const sx of [-1, 1])
    solid(
      k,
      R(sx * 17.05 - 0.06, sx * 17.05 + 0.06, -34, -6.6),
      Y_CATWALK - 0.42,
      Y_CATWALK - 0.36,
      'light_panel',
      { walkable: false },
    );
  for (const z of [-23.45, -20.55])
    solid(
      k,
      R(-17, 17, z - 0.05, z + 0.05),
      Y_CATWALK - 0.42,
      Y_CATWALK - 0.36,
      'light_panel',
      { walkable: false },
    );
}

/** B2 — Szatnia Dekontaminacyjna i Śluza Personelu (X ∈ [-32, -20], Z ∈ [-26, -10], y = -5.2 m). */
function buildRoomB2(k, p) {
  // 4 moduły szafek pracowniczych (wzdłuż ściany zachodniej oraz jako środkowa przegroda wokół (-26, -5.2, -18)).
  p.prop('lab_locker_bank', -31.2, -14.0, Y_BASEMENT, 1);
  p.prop('lab_locker_bank', -31.2, -22.0, Y_BASEMENT, 1);
  p.prop('lab_locker_bank', -26.0, -16.4, Y_BASEMENT, 0);
  p.prop('lab_locker_bank', -26.0, -19.6, Y_BASEMENT, 2);
  // 3 ławki szatniowe między szafkami (z wolnym miejscem na spawn #12: (-26, -5.2, -18)).
  p.prop('lab_locker_bench', -28.8, -14.0, Y_BASEMENT, 1);
  p.prop('lab_locker_bench', -28.8, -22.0, Y_BASEMENT, 1);
  p.prop('lab_locker_bench', -23.0, -18.0, Y_BASEMENT, 1);
  // 2 stojaki z żółtymi kombinezonami ochronnymi HAZMAT przy ścianie południowej.
  p.prop('lab_hazmat_suit_rack', -28.2, -10.8, Y_BASEMENT, 0);
  p.prop('lab_hazmat_suit_rack', -23.8, -10.8, Y_BASEMENT, 0);
  // 2 przeszklone kabiny pryszniców dekontaminacyjnych przy ścianie północnej + para.
  deconShower(k, p, -28.5, Y_BASEMENT, -24.9, 0);
  deconShower(k, p, -23.5, Y_BASEMENT, -24.9, 0);
  k.fx('steam', -28.5, Y_BASEMENT + 1.8, -24.9, 0.9);
  k.fx('steam', -23.5, Y_BASEMENT + 1.8, -24.9, 0.9);
  for (const x of [-28.5, -23.5])
    deco(k, 'city_vent_grate', x, Y_BASEMENT, -23.0);
  // Detal architektoniczny ścian B2: pilastry, listwy, ekrany, terminale, rury.
  for (const z of [-11.5, -16.5, -19.5, -24.5])
    box(k, -31.72, -3.0, z, 0.16, 4.4, 0.28, 'trim', { walkable: false });
  box(k, -31.74, Y_BASEMENT + 3.4, -18.0, 0.08, 0.08, 14.8, 'neon_green', {
    walkable: false,
  });
  for (const x of [-29, -23])
    for (const z of [-14, -22]) ceilingStrip(k, x, Y_B23_CEIL, z, 0);
  deco(k, 'mall_security_fixture', -20.22, Y_BASEMENT + 1.2, -18.0, -Q);
  deco(k, 'city_ad_screen', -31.78, Y_BASEMENT + 1.2, -11.2, Q);
  deco(k, 'wh_wall_terminal', -26.0, Y_BASEMENT + 1.2, -10.22, PI);
  deco(k, 'city_pipe_run', -26.0, Y_BASEMENT - 1.2, -25.78, 0);
  deco(k, 'city_ac_unit', -31.78, Y_BASEMENT + 2.8, -18.0, Q);
}

/** B3 — Podziemne Zaplecze Serwerowe „Krypta Danych” (X ∈ [20, 32], Z ∈ [-26, -10], y = -5.2 m). */
function buildRoomB3(k, p) {
  // 4 szafy serwerowe chłodzone cieczą `lab_cryo_server_rack` w dwie wyspy na środku
  // (symetrycznie wokół spawnu #13: (26, -5.2, -18)).
  p.prop('lab_cryo_server_rack', 24.5, -14.5, Y_BASEMENT, 0);
  p.prop('lab_cryo_server_rack', 27.5, -14.5, Y_BASEMENT, 0);
  p.prop('lab_cryo_server_rack', 24.5, -21.5, Y_BASEMENT, 2);
  p.prop('lab_cryo_server_rack', 27.5, -21.5, Y_BASEMENT, 2);
  // 2 szafy `wh_server_rack` przy ścianie wschodniej + konsola diagnostyczna.
  p.prop('wh_server_rack', 30.8, -14.0, Y_BASEMENT, -1);
  p.prop('wh_server_rack', 30.8, -22.0, Y_BASEMENT, -1);
  p.prop('lab_mainframe_console', 29.8, -18.0, Y_BASEMENT, -1);
  // 2 przemysłowe agregaty chłodnicze (chillery) przy ścianie północnej i południowej.
  p.prop('city_roof_hvac_unit', 26.0, -24.5, Y_BASEMENT, 0);
  p.prop('city_roof_hvac_unit', 26.0, -11.5, Y_BASEMENT, 2);
  // Detal architektoniczny ścian B3: pilastry, listwy błękitno-fioletowe, ekrany, rury i przewieszenia kabli.
  for (const z of [-11.5, -16.5, -19.5, -23.0])
    box(k, 31.72, -3.0, z, 0.16, 4.4, 0.28, 'trim', { walkable: false });
  box(k, 31.74, Y_BASEMENT + 3.4, -18.0, 0.08, 0.08, 14.8, 'neon_blue', {
    walkable: false,
  });
  deco(k, 'city_pipe_run', 31.78, Y_BASEMENT, -16.0, -Q);
  deco(k, 'city_pipe_run', 31.78, Y_BASEMENT, -20.0, -Q);
  deco(k, 'city_ac_unit', 31.78, Y_BASEMENT + 2.4, -19.5, -Q);
  deco(k, 'city_ad_screen', 22.2, Y_BASEMENT + 1.2, -10.22, PI);
  deco(k, 'city_ad_screen', 22.2, Y_BASEMENT + 1.2, -25.78, 0);
  deco(k, 'mall_security_fixture', 31.78, Y_BASEMENT + 1.2, -11.5, -Q);
  deco(k, 'city_cable_span', 26.0, Y_B23_CEIL - 0.1, -17.0, 0, 1.2);
  deco(k, 'city_cable_span', 26.0, Y_B23_CEIL - 0.1, -19.2, 0, 1.2);
  // Oprawy sufitowe pod stropem B3 (y = -0.80 m).
  for (const x of [23, 29])
    for (const z of [-14, -22]) ceilingStrip(k, x, Y_B23_CEIL, z, 0);
  deco(k, 'wh_wall_terminal', 20.2, Y_BASEMENT + 1.2, -18.0, Q);
}

export function buildRooms(k, placer) {
  buildRoomP1(k, placer);
  buildRoomP2(k, placer);
  buildRoomP3(k, placer);
  buildRoomP4(k, placer);
  buildRoomP5(k, placer);
  buildRoomB1(k, placer);
  buildRoomB2(k, placer);
  buildRoomB3(k, placer);
}
