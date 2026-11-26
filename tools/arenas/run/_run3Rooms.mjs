// Wyposażenie tematyczne 8 pomieszczeń Tajnego Laboratorium Kurogane Arms (run3 — Sektor X-51):
// P1 (Kordon Zero), P2 (Czarne Archiwum „Strefa 51”), P3 (Biochemia), P4 (Zbrojownia Prototypów),
// P5 (Centralny Hol i Szyb Windy), B1 (Wielka Sala Testów Humanoidalnych — 16 kokonów),
// B2 (Szatnia Dekontaminacyjna), B3 (Zaplecze Serwerowe „Krypta Danych”).
import {
  H_HALL,
  H_WING,
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
  // 2 zapory tworzące szykanę (z zachowaniem gęstości osłon <= 8 m i czystego spawnu (-18, 0, 17)).
  p.prop('city_barrier', -13.5, 17.5, Y_PARTER, 0);
  p.prop('city_barrier', -22.0, 16.5, Y_PARTER, 0);
  // Oprawy sufitowe cleanroomu (mat_light_panel) + kamery i terminale ścienne.
  for (const x of [-22, -14])
    for (const z of [17.5, 24.5]) ceilingStrip(k, x, H_WING, z, 0);
  deco(k, 'mall_security_fixture', -10.2, 1.2, 24.5, -Q);
  deco(k, 'wh_wall_terminal', -10.2, 1.2, 17.8, -Q);
  deco(k, 'city_door', -25.8, 0, 22.2, Q);
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
  // Dodatkowa szafa serwerowa archiwum i terminal pamięci przy ścianach bocznych.
  p.prop('lab_cryo_server_rack', -24.8, 12.4, Y_PARTER, 1);
  p.prop('wh_server_rack', -11.4, 2.2, Y_PARTER, -1);
  // Ściana zachodnia: Tablica Korkowa Śledcza z bursztynowo-zielonymi nitkami (zero czerwieni!).
  deco(k, 'lab_corkboard_evidence', -25.8, 1.1, 7.0, Q);
  // Tablica suchościeralna przy X = -25.8, Z = 3.2 pod Easter Egg #5 (schemat Rezonans -> Zysk).
  box(k, -25.76, 1.65, 3.2, 0.06, 1.3, 2.0, 'light_panel', { walkable: false });
  box(k, -25.78, 1.65, 3.2, 0.04, 1.42, 2.12, 'trim', { walkable: false });
  // Pancerne okno obserwacyjne w ścianie północnej (Z = 0, X ∈ [-19.5, -11.5]) z widokiem na B1.
  observationWindow(k, -15.5, 1.0, 0, 0);
  // Oprawy sufitowe i wyposażenie ścienne.
  for (const x of [-22, -14])
    for (const z of [3.5, 10.5]) ceilingStrip(k, x, H_WING, z, 0);
  deco(k, 'mall_security_fixture', -10.2, 1.2, 11.2, -Q);
  deco(k, 'wh_wall_terminal', -10.2, 1.2, 3.6, -Q);
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
  // Piony rur odżywczych schodzące od dygestoriów w kierunku piwnicy B1.
  deco(k, 'city_pipe_run', 25.78, -1.2, 21.0, -Q);
  deco(k, 'city_pipe_run', 18.0, -1.2, 27.78, PI);
  deco(k, 'lab_corkboard_evidence', 10.22, 1.1, 25.2, Q);
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
  // Terminal przy wejściu z P5 (z żółtą karteczką EE-6: KOD 0451).
  deco(k, 'wh_wall_terminal', 10.2, 1.2, 9.8, Q);
  deco(k, 'mall_security_fixture', 10.2, 1.2, 3.5, Q);
  for (const x of [14, 22])
    for (const z of [3.5, 10.5]) ceilingStrip(k, x, H_WING, z, 0);
}

/** P5 — Centralny Hol Badawczy i Szyb Windy Towarowej (X ∈ [-10, 10], Z ∈ [0, 28], y = 0). */
function buildRoomP5(k, p) {
  // Oś startu (0, 0, 25) -> północ: bramka skanera biometrycznego na (0, 0, 18.5).
  bioScannerGate(k, p, 0, Y_PARTER, 18.5, 0);
  // Boczne stanowiska ochrony i osłony w południowej oraz środkowej części Holu.
  p.prop('lab_security_desk', -5.6, 18.5, Y_PARTER, 0);
  p.prop('lab_security_desk', 5.6, 18.5, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', -5.6, 24.2, Y_PARTER, 0);
  p.prop('wh_weapon_case_stack', 5.6, 24.2, Y_PARTER, 0);
  p.prop('city_barrier', -5.6, 10.5, Y_PARTER, 0);
  p.prop('city_barrier', 5.6, 10.5, Y_PARTER, 0);
  p.prop('lab_cocoon_incubator', -8.2, 3.0, Y_PARTER, 0);
  p.prop('lab_cocoon_incubator', 8.2, 3.0, Y_PARTER, 0);
  // 4 filary konstrukcyjne podtrzymujące strop Holu (H = 6.40 m), między bramami bocznymi.
  for (const sx of [-1, 1])
    for (const z of [12.0, 16.0]) {
      const x = sx * 8.2;
      p.reserve(R(x - 0.5, x + 0.5, z - 0.5, z + 0.5), Y_PARTER);
      box(k, x, H_HALL / 2, z, 1.0, H_HALL, 1.0, MAT_CLEAN, {
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
  // Centrum Holu (0, 0, 9.5): Główna Konsola Nadzoru Ośrodka z kubkiem EE-4.
  p.prop('lab_mainframe_console', 0, 9.5, Y_PARTER, 0);
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
  // Osłony na bocznych skrzydłach południowej galerii (y = -1.60 m), poza wąskimi pomostami 3.0 m.
  p.prop('wh_weapon_case_stack', -13.5, -3.3, Y_CATWALK, 0);
  p.prop('wh_weapon_case_stack', 13.5, -3.3, Y_CATWALK, 0);

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

  // Osłony w alei środkowej, pod spocznikiem oraz w północnej strefie ewakuacji (gęstość <= 7 m).
  p.prop('lab_mainframe_console', 0, -9.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', 0, -12.2, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -7.8, -8.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 7.8, -8.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -16.0, -4.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 16.0, -4.0, Y_BASEMENT, 0);
  p.prop('lab_centrifuge_bench', -3.8, -24.5, Y_BASEMENT, 1);
  p.prop('lab_centrifuge_bench', 3.8, -24.5, Y_BASEMENT, -1);
  p.prop('lab_mainframe_console', 0, -33.0, Y_BASEMENT, 2);
  p.prop('city_barrier', -4.2, -36.5, Y_BASEMENT, 0);
  p.prop('city_barrier', 4.2, -35.0, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', -7.5, -37.5, Y_BASEMENT, 0);
  p.prop('wh_weapon_case_stack', 7.5, -37.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', -13.0, -37.5, Y_BASEMENT, 0);
  p.prop('lab_cocoon_incubator', 13.0, -37.5, Y_BASEMENT, 0);
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
  // Oprawy sufitowe pod stropem B2 (y = -0.80 m).
  for (const x of [-29, -23])
    for (const z of [-14, -22]) ceilingStrip(k, x, Y_B23_CEIL, z, 0);
  deco(k, 'mall_security_fixture', -31.8, Y_BASEMENT + 1.2, -18.0, Q);
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
  // Rury chłodnicze, wymienniki i przewieszenie kabli pod stropem (zakotwiczone w ścianach X=20 i X=32).
  deco(k, 'city_pipe_run', 31.78, Y_BASEMENT, -16.0, -Q);
  deco(k, 'city_pipe_run', 31.78, Y_BASEMENT, -20.0, -Q);
  deco(k, 'city_ac_unit', 31.78, Y_BASEMENT + 2.4, -19.5, -Q);
  deco(k, 'city_cable_span', 26.0, Y_B23_CEIL - 0.1, -17.0, 0, 1.2);
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
