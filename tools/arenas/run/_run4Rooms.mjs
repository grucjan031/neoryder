// Wyposażenie tematyczne 10 pomieszczeń i Atrium Wieżowca Korporacyjnego Kurogane Arms (run4 — Piętra 60–62):
// L0 (y = 0.0 m): R1 (Recepcja i Lobby), R2 (Wielki Openspace), R3 (Korytarz Panoramowy), A0 (Centralne Atrium)
// L1 (y = 4.8 m): R4 (Sala Konf. „Aegis”), R5 (Sala Konf. „Vanguard”), R6 (Kuchnia „Sky Lounge”), R7 (Serwerownia & Druk)
// L2 (y = 9.6 m): R8 (Szklane Gabinety W), R9 (Foyer Zarządu + Szklane Gabinety E), R10 (Gabinet Zarządu „Penthouse”).
import {
  MAT_CARPET,
  MAT_GRANITE,
  MAT_INLAY,
  MAT_WOOD_SLAT,
  PI,
  Q,
  R,
  Y_ATRIUM_CEIL,
  Y_L0,
  Y_L0_CEIL,
  Y_L1,
  Y_L1_CEIL,
  Y_L2,
  Y_L2_CEIL,
  Y_R10_CEIL,
  box,
  ceilingCovePanel,
  ceilingLightPanel,
  coffeeTable,
  deco,
  linearBaffleLight,
  planterTree,
  securityTurnstile,
  solid,
  waistDivider,
} from './_run4Kit.mjs';

/** R1 — Recepcja i Lobby Główne Kurogane Arms (L0, X ∈ [-10, 10], Z ∈ [10, 30], y = 0.0 m). */
function buildRoomR1(k, p) {
  // Kordon 3 bramek optycznych VIP w poprzek Lobby (Z = 21.5) połączonych niskimi ściankami osłonowymi.
  securityTurnstile(k, p, 0, Y_L0, 21.5, 0);
  securityTurnstile(k, p, -5.8, Y_L0, 21.5, 0);
  securityTurnstile(k, p, 5.8, Y_L0, 21.5, 0);
  waistDivider(k, p, -2.9, Y_L0, 21.5, 2.0, 0.34);
  waistDivider(k, p, 2.9, Y_L0, 21.5, 2.0, 0.34);

  // Południowe strefy oczekiwania VIP po bokach startu (0, 0, 26): sofy wokół niskich stolików i donice.
  // Strefa Zachodnia (X = -5.6, Z = 25.8)
  box(k, -5.8, Y_L0 - 0.014, 25.8, 5.2, 0.04, 5.0, MAT_CARPET, {
    walkable: false,
  });
  coffeeTable(k, p, -5.6, Y_L0, 25.8, 2.0, 1.0);
  p.prop('off_lounge_sofa', -5.6, 24.0, Y_L0, 0);
  p.prop('off_lounge_sofa', -5.6, 27.6, Y_L0, 2);
  p.prop('off_lounge_sofa', -8.2, 25.8, Y_L0, 1);
  p.prop('off_office_planter', -2.8, 25.8, Y_L0, 1);
  p.prop('off_office_planter', -8.2, 28.8, Y_L0, 0);

  // Strefa Wschodnia (X = +5.6, Z = 26.8 — odsunięta od bramy do R3 na Z ∈ [22, 26])
  box(k, 5.8, Y_L0 - 0.014, 26.8, 5.2, 0.04, 4.6, MAT_CARPET, {
    walkable: false,
  });
  coffeeTable(k, p, 5.6, Y_L0, 26.8, 2.0, 1.0);
  p.prop('off_lounge_sofa', 5.6, 25.0, Y_L0, 0);
  p.prop('off_lounge_sofa', 5.6, 28.6, Y_L0, 2);
  p.prop('off_office_planter', 2.8, 26.8, Y_L0, -1);
  p.prop('off_office_planter', 8.4, 28.6, Y_L0, 0);

  // Północne strefy oczekiwania przed recepcją (Z = 17.2, z wolnym dojściem do bramy R2 na Z = 20).
  for (const sx of [-1, 1]) {
    box(k, sx * 5.8, Y_L0 - 0.014, 17.2, 4.8, 0.04, 3.8, MAT_CARPET, {
      walkable: false,
    });
    coffeeTable(k, p, sx * 5.8, Y_L0, 17.2, 1.8, 0.9);
    p.prop('off_lounge_sofa', sx * 5.8, 18.8, Y_L0, 2);
    p.prop('mall_bench', sx * 3.4, 17.2, Y_L0, 1);
  }
  p.prop('off_lounge_sofa', 8.2, 17.2, Y_L0, -1);
  p.prop('off_office_planter', -8.4, 15.8, Y_L0, 1);
  p.prop('off_office_planter', 8.4, 19.8, Y_L0, -1);

  // Dwie monumentalne Lady Recepcyjne + Ścianki Reprezentacyjne z Logo Kurogane Arms za recepcją (Z = 11.0).
  // Środkowy prześwit portalu X ∈ [-2.8, +2.8] (5.6 m) zostawia czystą oś widoku 01-spawn na Atrium i windę!
  p.prop('off_reception_desk', -5.2, 13.8, Y_L0, 0);
  p.prop('off_reception_desk', 5.2, 13.8, Y_L0, 0);
  for (const x of [-6.2, -4.2, 4.2, 6.2])
    p.prop('off_office_chair', x, 12.3, Y_L0, 0);

  for (const sx of [-1, 1]) {
    const wx = sx * 5.2;
    p.reserve(R(wx - 2.25, wx + 2.25, 10.8, 11.25), Y_L0);
    box(k, wx, Y_L0 + 1.5, 11.0, 4.4, 3.0, 0.34, MAT_WOOD_SLAT, {
      walkable: false,
    });
    box(k, wx, Y_L0 + 1.5, 11.19, 3.4, 2.2, 0.04, MAT_GRANITE, {
      walkable: false,
    });
    box(k, wx, Y_L0 + 2.96, 11.0, 4.48, 0.08, 0.4, 'light_panel', {
      walkable: false,
    });
    deco(k, 'off_acoustic_wall_panel', wx, Y_L0 + 0.3, 10.82, PI);
  }
  p.prop('mall_directory', -2.1, 13.8, Y_L0, 0);
  p.prop('mall_directory', 2.1, 13.8, Y_L0, 0);
  p.prop('off_filing_cabinet', -8.6, 11.0, Y_L0, 0);
  p.prop('off_filing_cabinet', 8.6, 11.0, Y_L0, 0);

  // Detal architektoniczny ścian R1: pilastry (poza bramami Z ∈ [18,22] na W i Z ∈ [22,26] na E!), ciepłe listwy light_panel.
  for (const sx of [-1, 1]) {
    const xWall = sx * 9.8;
    const yaw = sx > 0 ? -Q : Q;
    for (const z of [12.5, 16.0, sx > 0 ? 20.0 : 24.0, 28.0]) {
      box(k, sx * 9.72, 2.4, z, 0.16, Y_L0_CEIL, 0.32, 'trim', {
        walkable: false,
      });
    }
    box(k, sx * 9.74, 3.65, 20.0, 0.08, 0.08, 18.8, 'light_panel', {
      walkable: false,
    });
    deco(k, 'off_acoustic_wall_panel', xWall, 1.1, 14.2, yaw);
    deco(k, 'city_ad_screen', xWall, 1.2, 26.2, yaw);
    deco(k, 'wh_wall_terminal', xWall, 1.2, 17.0, yaw);
    deco(k, 'mall_security_fixture', xWall, 1.25, 11.4, yaw);
  }
  // Gęste oświetlenie sufitu i narożników R1 (bez stożków i bez rozbłysków bloomu).
  for (const x of [-6.4, 0, 6.4])
    for (const z of [12.5, 17.5, 22.5, 27.5])
      ceilingLightPanel(k, x, Y_L0_CEIL, z, 0);
  for (const sx of [-1, 1]) {
    ceilingCovePanel(k, sx * 8.8, Y_L0_CEIL, 20.0, 0.45, 18.4);
    ceilingCovePanel(k, sx * 5.2, Y_L0_CEIL, 29.0, 6.4, 0.45);
    ceilingCovePanel(k, sx * 5.2, Y_L0_CEIL, 10.8, 6.4, 0.45);
  }
}

/** R2 — Wielki Openspace Operacyjny „Dywizja Kontraktów” (L0, X ∈ [-30, -10], Z ∈ [-2, 30], y = 0.0 m). */
function buildRoomR2(k, p) {
  // 12 czteroosobowych Wysp Biurek `off_desk_pod` (48 stanowisk!) w 3 kolumnach × 5 rzędach
  // z kompletem 48 foteli `off_office_chair` (z zachowaniem czystych spawnów (-15,0,21), (-25,0,14), (-18,0,1)).
  const deskPods = [
    // Rząd 1 (południe, Z = 26.2): pełne 3 kolumny
    [-26.2, 26.2],
    [-20.2, 26.2],
    [-14.2, 26.2],
    // Rząd 2 (Z = 20.5): kolumna W i środkowa (na X = -15, Z = 21 jest spawn #1 i wejście Z = 20)
    [-26.2, 20.5],
    [-20.2, 20.5],
    // Rząd 3 (Z = 14.5): kolumna środkowa i E (na X = -25, Z = 14 jest spawn #2)
    [-20.2, 14.5],
    [-14.2, 14.5],
    // Rząd 4 (Z = 8.5): pełne 3 kolumny
    [-26.2, 8.5],
    [-20.2, 8.5],
    [-14.2, 8.5],
    // Rząd 5 (północ, Z = 2.5): kolumna W i E (na X = -18, Z = 1 jest spawn #3)
    [-26.2, 2.5],
    [-13.8, 2.5],
  ];
  for (const [x, z] of deskPods) {
    p.prop('off_desk_pod', x, z, Y_L0, 0);
    for (const dx of [-0.9, 0.9]) {
      p.prop('off_office_chair', x + dx, z - 1.25, Y_L0, 0);
      p.prop('off_office_chair', x + dx, z + 1.25, Y_L0, 2);
    }
  }

  // Niskie ścianki akustyczne na wysokości pasa wydzielające sektory w osi kolumn biurek
  // (aleje północ-południe X ∈ [-24, -22] oraz X ∈ [-18, -16] pozostają w 100% drożne na siatce 1 m!).
  waistDivider(k, p, -14.2, Y_L0, 23.4, 2.8, 0.32);
  waistDivider(k, p, -26.2, Y_L0, 17.5, 2.8, 0.32);
  waistDivider(k, p, -26.2, Y_L0, 11.4, 2.8, 0.32);
  waistDivider(k, p, -20.2, Y_L0, 5.4, 2.8, 0.32);

  // Wyspy reprografii, ekspresy do kawy, donice akustyczne i kosze w osiach kolumn R2.
  p.prop('off_office_printer', -14.2, 17.5, Y_L0, 0);
  p.prop('off_office_printer', -20.2, 11.4, Y_L0, 0);
  p.prop('off_office_printer', -14.2, 5.4, Y_L0, 0);
  p.prop('off_coffee_machine', -20.2, 29.0, Y_L0, 2);
  p.prop('off_coffee_machine', -14.2, 29.0, Y_L0, 2);
  p.prop('mall_trash_bin', -22.2, 29.0, Y_L0, 2);
  p.prop('mall_trash_bin', -17.8, 29.0, Y_L0, 2);
  p.prop('off_office_planter', -21.8, -0.8, Y_L0, 0);
  p.prop('off_office_planter', -26.2, 5.4, Y_L0, 0);
  p.prop('off_office_planter', -20.2, 23.4, Y_L0, 0);

  // Przy zachodniej szklanej fasadzie (X = -28.8) i ścianie wschodniej (X = -10.8): donice i szafy na akta.
  for (const z of [-0.6, 5.5, 11.4, 17.5, 23.4, 28.4])
    p.prop('off_office_planter', -28.8, z, Y_L0, 1);
  for (const z of [5.5, 8.5, 11.5, 14.5, 16.8, 24.5, 27.8])
    p.prop('off_filing_cabinet', -10.8, z, Y_L0, -1);

  // Tablice szklane i panele akustyczne na wschodniej ścianie działowej R2 (X = -10.2).
  deco(k, 'off_whiteboard_wall', -10.2, 1.05, 7.0, -Q);
  deco(k, 'off_whiteboard_wall', -10.2, 1.05, 14.5, -Q);
  deco(k, 'off_acoustic_wall_panel', -10.2, 1.0, 11.0, -Q);
  deco(k, 'off_acoustic_wall_panel', -10.2, 1.0, 25.0, -Q);
  deco(k, 'wh_wall_terminal', -10.2, 1.2, 3.8, -Q);
  deco(k, 'mall_security_fixture', -10.2, 1.25, 22.8, -Q);
  box(k, -10.26, 3.65, 14.0, 0.08, 0.08, 30.8, 'light_panel', {
    walkable: false,
  });

  // Oprawy sufitowe i doświetlenie narożników R2: pod stropem południowym (y = 4.8 m, Z > 8) i pod L1 (y = 4.4 m, Z <= 8).
  for (const x of [-27.5, -22.5, -17.5, -12.5]) {
    for (const z of [11.0, 16.0, 21.5, 27.0])
      ceilingLightPanel(k, x, Y_L0_CEIL, z, 0);
    for (const z of [0.2, 5.2]) ceilingLightPanel(k, x, 4.4, z, 0);
  }
  ceilingCovePanel(k, -28.8, Y_L0_CEIL, 19.0, 0.45, 20.0);
  ceilingCovePanel(k, -11.2, Y_L0_CEIL, 19.0, 0.45, 20.0);
  ceilingCovePanel(k, -20.0, Y_L0_CEIL, 29.0, 18.0, 0.45);
  ceilingCovePanel(k, -28.8, 4.4, 3.0, 0.45, 8.8);
  ceilingCovePanel(k, -11.2, 4.4, 3.0, 0.45, 8.8);
  ceilingCovePanel(k, -20.0, 4.4, -1.0, 18.0, 0.45);
}

/** R3 — Korytarz Panoramowy i Strefa Analityków Rynku (L0, X ∈ [10, 30], Z ∈ [-2, 30], y = 0.0 m). */
function buildRoomR3(k, p) {
  // Zabudowa pod wyższą częścią Klatki Schodowej #2 (X ∈ [10.4, 13.6], Z ∈ [7.2, 14.8], wys. 2.0 m):
  // mieści się całkowicie poniżej spocznika M01-E (y = 2.0..2.4 m) i biegu górnego (y = 2.4..4.8 m).
  p.reserve(R(10.2, 13.8, 7.0, 15.0), Y_L0);
  solid(k, R(10.4, 13.6, 7.2, 14.8), Y_L0, 2.0, MAT_WOOD_SLAT, {
    walkable: false,
  });

  // Pylony emitera bramki laserowej `panorama-security-laser` (Z = 14.0, X: 15.0 -> 22.0).
  for (const x of [14.8, 22.2]) {
    p.reserve(R(x - 0.25, x + 0.25, 13.75, 14.25), Y_L0);
    box(k, x, 0.6, 14.0, 0.24, 1.2, 0.24, 'machine', { walkable: false });
    box(k, x, 1.26, 14.0, 0.28, 0.12, 0.28, 'neon_amber', { walkable: false });
  }

  // 6 wysp analityków giełdowych `off_desk_pod` (24 stanowiska) z fotelami (poza spawnami (16,0,21) i (25,0,7)).
  for (const [x, z] of [
    [19.0, 2.5],
    [25.0, 2.5],
    [19.0, 9.5],
    [20.5, 17.2],
    [20.5, 23.2],
    [20.5, 28.0],
  ]) {
    p.prop('off_desk_pod', x, z, Y_L0, 0);
    for (const dx of [-0.9, 0.9]) {
      p.prop('off_office_chair', x + dx, z - 1.25, Y_L0, 0);
      p.prop('off_office_chair', x + dx, z + 1.25, Y_L0, 2);
    }
  }

  // Ścianki akustyczne na wysokości pasa, gabloty Kurogane, sofy, ławki i donice wzdłuż okna panoramicznego
  // (aleje X ∈ [15, 18] oraz X ∈ [23, 26] są w 100% drożne na siatce 1 m!).
  waistDivider(k, p, 20.5, Y_L0, 20.2, 2.6, 0.32);
  waistDivider(k, p, 25.0, Y_L0, 11.2, 2.4, 0.32);
  p.prop('off_lounge_sofa', 14.5, 24.8, Y_L0, 0);
  p.prop('off_office_planter', 14.5, 17.8, Y_L0, 1);
  p.prop('mall_kurogane_display', 28.2, -0.4, Y_L0, -1);
  p.prop('mall_kurogane_display', 28.2, 20.5, Y_L0, -1);
  p.prop('off_lounge_sofa', 28.0, 11.5, Y_L0, -1);
  p.prop('off_lounge_sofa', 28.0, 16.5, Y_L0, -1);
  p.prop('off_lounge_sofa', 28.0, 26.5, Y_L0, -1);
  p.prop('mall_bench', 25.8, 17.2, Y_L0, 1);
  p.prop('mall_bench', 25.8, 24.5, Y_L0, 1);
  p.prop('off_office_planter', 25.8, 14.0, Y_L0, 0);
  p.prop('off_office_planter', 25.8, 28.4, Y_L0, 0);
  p.prop('off_office_planter', 14.2, 3.5, Y_L0, 0);
  p.prop('off_office_planter', 14.2, -0.6, Y_L0, 0);
  p.prop('off_filing_cabinet', 11.2, 27.8, Y_L0, 1);
  p.prop('off_filing_cabinet', 14.8, 11.5, Y_L0, 0);
  p.prop('off_office_printer', 14.8, 6.2, Y_L0, 0);

  // Ściana wideo notowań giełdowych i panele na ścianie zachodniej R3 (X = +10.2).
  deco(k, 'off_conf_screen_wall', 10.2, 0.9, 4.0, Q);
  deco(k, 'off_whiteboard_wall', 10.2, 1.05, 27.5, Q);
  deco(k, 'city_ad_screen', 10.2, 1.2, 20.8, Q);
  deco(k, 'wh_wall_terminal', 10.2, 1.2, -0.8, Q);
  box(k, 10.26, 3.65, 14.0, 0.08, 0.08, 30.8, 'light_panel', {
    walkable: false,
  });

  // Oprawy sufitowe i doświetlenie narożników w R3 (poza szybem Klatki #2 X ∈ [10, 14], Z ∈ [8, 20.4]).
  for (const x of [16.5, 22.0, 27.5]) {
    for (const z of [11.0, 16.5, 22.0, 27.5])
      ceilingLightPanel(k, x, Y_L0_CEIL, z, 0);
    for (const z of [0.2, 5.2]) ceilingLightPanel(k, x, 4.4, z, 0);
  }
  ceilingLightPanel(k, 12.0, Y_L0_CEIL, 27.5, 0);
  ceilingCovePanel(k, 28.8, Y_L0_CEIL, 19.0, 0.45, 20.0);
  ceilingCovePanel(k, 20.0, Y_L0_CEIL, 29.0, 18.0, 0.45);
  ceilingCovePanel(k, 28.8, 4.4, 3.0, 0.45, 8.8);
  ceilingCovePanel(k, 11.2, 4.4, 3.0, 0.45, 8.8);
  ceilingCovePanel(k, 20.0, 4.4, -1.0, 18.0, 0.45);
}

/** A0 — Centralne Trzykondygnacyjne Atrium, Szyb Windy i Galerie (X ∈ [-10, 10], Z ∈ [-16, 10]). */
function buildAtriumA0(k, p) {
  // 4 narożne słupy stalowe przeszklonego szybu windy na X = ±1.80, Z = -14.0 ± 1.80
  // (poza obrysem szybu X ∈ [-1.6, 1.6], Z ∈ [-15.6, -12.4], wysokość do stropu Atrium 15.20 m).
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 1.8;
      const z = -14.0 + sz * 1.8;
      p.reserve(R(x - 0.2, x + 0.2, z - 0.2, z + 0.2), Y_L0);
      p.reserve(R(x - 0.2, x + 0.2, z - 0.2, z + 0.2), Y_L1);
      p.reserve(R(x - 0.2, x + 0.2, z - 0.2, z + 0.2), Y_L2);
      box(k, x, Y_ATRIUM_CEIL / 2, z, 0.3, Y_ATRIUM_CEIL, 0.3, 'metal', {
        walkable: false,
      });
      box(
        k,
        x + sx * 0.16,
        Y_ATRIUM_CEIL / 2,
        z,
        0.04,
        Y_ATRIUM_CEIL - 0.8,
        0.08,
        'light_panel',
        { walkable: false },
      );
    }
  }
  // Belki nadprożowe szybu windy na poszczególnych piętrach (oparcie dla szyldów pięter).
  for (const y of [3.5, Y_L1 + 3.5]) {
    box(k, 0, y, -12.2, 3.9, 0.28, 0.24, 'trim', { walkable: false });
  }
  box(k, 0, Y_L2 + 3.5, -15.8, 3.9, 0.28, 0.24, 'trim', { walkable: false });

  // Zabudowa pod niższym biegiem Klatki Schodowej #1 w Atrium (X ∈ [-5.6, -2.4], Z ∈ [-2.8, 2.0], wys. 1.8 m),
  // całkowicie poniżej spocznika M01-W (y = 2.0..2.4 m) i z dala od spawnu #6 (-4, 0, -6).
  p.reserve(R(-5.7, -2.3, -2.9, 2.1), Y_L0);
  solid(k, R(-5.6, -2.4, -2.8, 2.0), Y_L0, 1.8, MAT_WOOD_SLAT, {
    walkable: false,
  });

  // --- CENTRALNA RZEŹBA / INSTALACJA KORPORACYJNA KUROGANE ARMS (0, 0, -2.2) ---
  // Stoi w sercu Atrium między Punktem A (0, 0, 2.0) a spawnami (±4, 0, -6); stanowi też osłonę do walki!
  p.reserve(R(-1.25, 1.25, -3.45, -0.95), Y_L0);
  box(k, 0, Y_L0 + 0.14, -2.2, 2.4, 0.28, 2.4, MAT_INLAY, { walkable: false });
  box(k, 0, Y_L0 + 0.68, -2.2, 1.65, 0.8, 1.65, MAT_GRANITE, {
    walkable: false,
  });
  box(k, 0, Y_L0 + 1.12, -2.2, 1.72, 0.08, 1.72, 'light_panel', {
    walkable: false,
  });
  // Trzy strzeliste skrzydła monolitu ze stali i orzecha z bursztynowym rdzeniem.
  box(k, -0.38, Y_L0 + 2.45, -2.2, 0.22, 2.6, 0.78, 'trim', {
    rotation: { x: 0, y: 0.35, z: 0 },
    walkable: false,
  });
  box(k, 0.38, Y_L0 + 2.65, -2.2, 0.22, 3.0, 0.78, 'trim', {
    rotation: { x: 0, y: -0.35, z: 0 },
    walkable: false,
  });
  box(k, 0, Y_L0 + 2.85, -2.2, 0.32, 3.4, 0.32, MAT_WOOD_SLAT, {
    rotation: { x: 0, y: PI / 4, z: 0 },
    walkable: false,
  });
  box(k, 0, Y_L0 + 2.85, -2.2, 0.14, 3.1, 0.42, 'neon_amber', {
    rotation: { x: 0, y: PI / 4, z: 0 },
    walkable: false,
  });
  p.prop('mall_bench', 0, -4.1, Y_L0, 0);
  p.prop('mall_bench', 0, -0.3, Y_L0, 0);

  // --- WYSPY Z ROŚLINAMI, DRZEWKAMI, ŁAWKAMI I OSŁONAMI NA WYSOKOŚCI PASA CO ~5-6 M ---
  // 1. Wyspa Południowo-Centralna (0, 0, 6.4 — między portalem Lobby Z = 10 a Punktem A Z = 2):
  box(k, 0, Y_L0 - 0.014, 6.4, 3.8, 0.04, 4.4, MAT_INLAY, {
    walkable: false,
  });
  p.prop('mall_planter', 0, 6.4, Y_L0, 0);
  planterTree(k, 0, Y_L0, 6.4);
  p.prop('mall_bench', 0, 4.6, Y_L0, 0);
  p.prop('mall_bench', 0, 8.2, Y_L0, 0);

  // 2. Wyspy Południowo-Zachodnia (-8.2, 0, 7.3) i Południowo-Wschodnia (+8.2, 0, 7.3):
  for (const sx of [-1, 1]) {
    const ix = sx * 8.2;
    box(k, ix, Y_L0 - 0.014, 7.3, 2.2, 0.04, 4.6, MAT_INLAY, {
      walkable: false,
    });
    p.prop('off_office_planter', ix, 7.3, Y_L0, 1);
    planterTree(k, ix, Y_L0, 7.3);
    p.prop('mall_bench', ix, 5.2, Y_L0, 0);
  }
  waistDivider(k, p, -8.4, Y_L0, 3.0, 0.32, 2.2);

  // 3. Wyspa Wschodnia Wypoczynkowa (+6.2, 0, 2.0 — naprzeciw Klatki Schodowej #1, z wolną aleją X ∈ [1.2, 3.5]):
  box(k, 6.2, Y_L0 - 0.014, 2.0, 4.4, 0.04, 5.2, MAT_CARPET, {
    walkable: false,
  });
  coffeeTable(k, p, 6.2, Y_L0, 2.0, 2.0, 1.0);
  p.prop('off_lounge_sofa', 6.2, 3.8, Y_L0, 0);
  p.prop('off_lounge_sofa', 6.2, 0.2, Y_L0, 2);
  p.prop('off_office_planter', 8.4, 2.0, Y_L0, 1);
  p.prop('mall_bench', 4.0, 2.0, Y_L0, 1);

  // 4. Wyspy Północne i Osłony Taktyczne przed Szybem Windy (Z = -6.0..-14.2, poza spawnami (±4, 0, -6)):
  p.prop('mall_directory', -2.0, -9.2, Y_L0, 0);
  p.prop('mall_directory', 2.0, -9.2, Y_L0, 0);
  waistDivider(k, p, -4.6, Y_L0, -9.2, 2.2, 0.32);
  waistDivider(k, p, 4.6, Y_L0, -9.2, 2.2, 0.32);
  for (const sx of [-1, 1]) {
    box(k, sx * 7.8, Y_L0 - 0.014, -6.5, 2.6, 0.04, 5.8, MAT_INLAY, {
      walkable: false,
    });
    p.prop('off_office_planter', sx * 7.8, -5.2, Y_L0, sx > 0 ? -1 : 1);
    planterTree(k, sx * 7.8, Y_L0, -5.2);
    p.prop('mall_bench', sx * 7.8, -8.2, Y_L0, 1);
    p.prop('off_office_planter', sx * 6.2, -11.5, Y_L0, 0);
    p.prop('off_lounge_sofa', sx * 6.2, -14.2, Y_L0, 0);
  }
  p.prop('off_filing_cabinet', -8.2, -1.2, Y_L0, 1);
  p.prop('off_filing_cabinet', 8.2, -2.2, Y_L0, -1);

  // Poziom L1 Atrium (y = 4.8 m): donice i ławki na Mostkach L1 oraz strefa wypoczynkowa w Północnej Galerii L1.
  p.prop('off_office_planter', -3.6, 6.5, Y_L1, 0);
  p.prop('off_office_planter', 3.6, 6.5, Y_L1, 0);
  p.prop('mall_bench', 0, 6.5, Y_L1, 0);
  p.prop('off_office_planter', 0, -22.5, Y_L1, 0);
  coffeeTable(k, p, -5.2, Y_L1, -20.2, 1.8, 0.9);
  coffeeTable(k, p, 5.2, Y_L1, -20.2, 1.8, 0.9);
  p.prop('off_lounge_sofa', -5.2, -22.2, Y_L1, 0);
  p.prop('off_lounge_sofa', 5.2, -22.2, Y_L1, 0);
  p.prop('mall_bench', -5.2, -18.2, Y_L1, 0);
  p.prop('mall_bench', 5.2, -18.2, Y_L1, 0);

  // Świetlik i dźwigary pod stropem Atrium (y = 15.20 m, ceiling: true).
  for (const z of [-12.0, -6.0, 0.0, 6.0]) {
    box(k, 0, Y_ATRIUM_CEIL - 0.18, z, 19.6, 0.35, 0.4, 'machine', {
      ceiling: true,
      walkable: false,
    });
    linearBaffleLight(k, -4.5, Y_ATRIUM_CEIL, z, 0);
    linearBaffleLight(k, 4.5, Y_ATRIUM_CEIL, z, 0);
  }
  // Ciepłe panele light_panel na spodach mostków L1 (y = 4.40 m) oraz nad Północną Galerią L1 (y = 9.20 m).
  for (const x of [-6.0, 0, 6.0]) ceilingCovePanel(k, x, 4.4, 6.5, 3.6, 0.8);
  for (const x of [-3.2, 0, 3.2]) ceilingCovePanel(k, x, 4.4, -10.2, 2.2, 0.8);
  ceilingCovePanel(k, 4.0, 4.4, -1.5, 0.8, 10.0);
  ceilingCovePanel(k, -8.2, 4.4, 1.0, 0.8, 6.5);
  ceilingCovePanel(k, 8.2, 4.4, 1.0, 0.8, 6.5);
  for (const x of [-6.5, 0, 6.5]) {
    ceilingLightPanel(k, x, 9.2, -18.5, 0);
    ceilingLightPanel(k, x, 9.2, -22.0, 0);
  }
  ceilingCovePanel(k, 0, 9.2, -23.2, 16.0, 0.45);
}

/** R4 — Wielka Sala Konferencyjna „Aegis” (L1 W, X ∈ [-30, -10], Z ∈ [-12, 8], y = 4.80 m). */
function buildRoomR4(k, p) {
  // 1. Główny Stół Konferencyjny przy przeszklonej ścianie Atrium (X = -15.2, Z = -4.6),
  // otoczony z 4 stron 10 fotelami `off_office_chair` — doskonale widoczny z Atrium!
  p.prop('off_conference_table', -15.2, -4.6, Y_L1, 1);
  for (const z of [-6.5, -5.2, -4.0, -2.7]) {
    p.prop('off_office_chair', -16.75, z, Y_L1, 1);
    p.prop('off_office_chair', -13.65, z, Y_L1, -1);
  }
  p.prop('off_office_chair', -15.2, -7.9, Y_L1, 0);
  p.prop('off_office_chair', -15.2, -1.3, Y_L1, 2);

  // 2. Ścianka multimedialna za głównym stołem (X = -19.5, Z ∈ [-8.2, -1.0]) z wielkim ekranem
  // `off_conf_screen_wall` i tablicą `off_whiteboard_wall` skierowanymi bezpośrednio w stronę Atrium (+X)!
  p.reserve(R(-19.75, -19.25, -8.3, -0.9), Y_L1);
  box(k, -19.5, Y_L1 + 1.5, -4.6, 0.36, 3.0, 7.2, MAT_WOOD_SLAT, {
    walkable: false,
  });
  box(k, -19.5, Y_L1 + 2.96, -4.6, 0.42, 0.08, 7.28, 'light_panel', {
    walkable: false,
  });
  deco(k, 'off_conf_screen_wall', -19.3, Y_L1 + 0.45, -5.9, Q);
  deco(k, 'off_whiteboard_wall', -19.3, Y_L1 + 0.85, -2.3, Q);
  deco(k, 'off_whiteboard_wall', -19.7, Y_L1 + 0.85, -5.9, -Q);
  deco(k, 'off_acoustic_wall_panel', -19.7, Y_L1 + 0.45, -2.6, -Q);

  // 3. Drugi Stół Konferencyjny w głębi sali (X = -24.5, Z = -1.5, poza spawnami (-18,4.8,4) i (-24,4.8,-8))
  // otoczony 8 fotelami `off_office_chair`.
  p.prop('off_conference_table', -24.5, -1.5, Y_L1, 1);
  for (const z of [-3.4, -1.5, 0.4]) {
    p.prop('off_office_chair', -26.05, z, Y_L1, 1);
    p.prop('off_office_chair', -22.95, z, Y_L1, -1);
  }
  p.prop('off_office_chair', -24.5, -4.8, Y_L1, 0);
  p.prop('off_office_chair', -24.5, 1.8, Y_L1, 2);

  // Obwód sali: sofy przy zachodniej fasadzie, kredensy, donice oraz ekran i whiteboard na ścianie północnej.
  p.prop('off_lounge_sofa', -28.0, -3.5, Y_L1, 1);
  p.prop('off_lounge_sofa', -28.0, 3.5, Y_L1, 1);
  p.prop('off_office_planter', -26.5, 6.4, Y_L1, 0);
  p.prop('off_office_planter', -13.5, 6.4, Y_L1, 0);
  p.prop('off_office_planter', -11.8, -5.5, Y_L1, 1);
  p.prop('off_filing_cabinet', -13.5, -10.8, Y_L1, 0);
  p.prop('off_filing_cabinet', -26.8, -10.8, Y_L1, 0);

  deco(k, 'off_conf_screen_wall', -15.5, Y_L1 + 0.9, -11.8, 0);
  deco(k, 'off_whiteboard_wall', -25.0, Y_L1 + 1.05, -11.8, 0);
  deco(k, 'off_acoustic_wall_panel', -11.8, Y_L1 + 1.0, -11.8, 0);
  deco(k, 'wh_wall_terminal', -18.5, Y_L1 + 1.2, -11.8, 0);

  // Reprezentacyjne oprawy lamelowe i panele narożne pod stropem R4 (y = 9.60 m).
  for (const x of [-26, -20, -14])
    for (const z of [-8.0, -2.5, 3.5]) linearBaffleLight(k, x, Y_L1_CEIL, z, 0);
  ceilingCovePanel(k, -28.8, Y_L1_CEIL, -2.0, 0.45, 18.0);
  ceilingCovePanel(k, -11.2, Y_L1_CEIL, -2.0, 0.45, 18.0);
  ceilingCovePanel(k, -20.0, Y_L1_CEIL, 6.8, 16.0, 0.45);
  ceilingCovePanel(k, -20.0, Y_L1_CEIL, -10.8, 16.0, 0.45);
}

/** R5 — Wielka Sala Konferencyjna „Vanguard” (L1 E, X ∈ [10, 30], Z ∈ [-12, 8], y = 4.80 m). */
function buildRoomR5(k, p) {
  // 1. Główny Stół Konferencyjny przy przeszklonej ścianie Atrium (X = +15.2, Z = -4.6),
  // otoczony z 4 stron 10 fotelami `off_office_chair` — doskonale widoczny z Atrium!
  p.prop('off_conference_table', 15.2, -4.6, Y_L1, 1);
  for (const z of [-6.5, -5.2, -4.0, -2.7]) {
    p.prop('off_office_chair', 13.65, z, Y_L1, 1);
    p.prop('off_office_chair', 16.75, z, Y_L1, -1);
  }
  p.prop('off_office_chair', 15.2, -7.9, Y_L1, 0);
  p.prop('off_office_chair', 15.2, -1.3, Y_L1, 2);

  // 2. Ścianka multimedialna za głównym stołem (X = +19.5, Z ∈ [-8.2, -1.0]) z wielkim ekranem
  // `off_conf_screen_wall` i tablicą `off_whiteboard_wall` skierowanymi bezpośrednio w stronę Atrium (-X)!
  p.reserve(R(19.25, 19.75, -8.3, -0.9), Y_L1);
  box(k, 19.5, Y_L1 + 1.5, -4.6, 0.36, 3.0, 7.2, MAT_WOOD_SLAT, {
    walkable: false,
  });
  box(k, 19.5, Y_L1 + 2.96, -4.6, 0.42, 0.08, 7.28, 'light_panel', {
    walkable: false,
  });
  deco(k, 'off_conf_screen_wall', 19.3, Y_L1 + 0.45, -5.9, -Q);
  deco(k, 'off_whiteboard_wall', 19.3, Y_L1 + 0.85, -2.3, -Q);
  deco(k, 'off_whiteboard_wall', 19.7, Y_L1 + 0.85, -5.9, Q);
  deco(k, 'off_acoustic_wall_panel', 19.7, Y_L1 + 0.45, -2.6, Q);

  // 3. Drugi Stół Konferencyjny w głębi sali (X = +24.5, Z = -1.5, poza spawnami (18,4.8,4) i (24,4.8,-8))
  // otoczony 8 fotelami `off_office_chair`.
  p.prop('off_conference_table', 24.5, -1.5, Y_L1, 1);
  for (const z of [-3.4, -1.5, 0.4]) {
    p.prop('off_office_chair', 22.95, z, Y_L1, 1);
    p.prop('off_office_chair', 26.05, z, Y_L1, -1);
  }
  p.prop('off_office_chair', 24.5, -4.8, Y_L1, 0);
  p.prop('off_office_chair', 24.5, 1.8, Y_L1, 2);

  // Obwód sali: sofy przy wschodniej fasadzie, donice, szafy oraz ekran i whiteboard na ścianie północnej.
  p.prop('off_lounge_sofa', 28.0, -3.5, Y_L1, -1);
  p.prop('off_lounge_sofa', 28.0, 3.5, Y_L1, -1);
  p.prop('off_office_planter', 23.5, 6.2, Y_L1, 0);
  p.prop('off_office_planter', 15.8, 6.2, Y_L1, 0);
  p.prop('off_office_planter', 11.8, -5.5, Y_L1, -1);
  p.prop('off_filing_cabinet', 13.5, -10.8, Y_L1, 0);
  p.prop('off_filing_cabinet', 26.8, -10.8, Y_L1, 0);

  deco(k, 'off_conf_screen_wall', 15.5, Y_L1 + 0.9, -11.8, 0);
  deco(k, 'off_whiteboard_wall', 25.0, Y_L1 + 1.05, -11.8, 0);
  deco(k, 'off_acoustic_wall_panel', 28.2, Y_L1 + 1.0, -11.8, 0);
  deco(k, 'wh_wall_terminal', 18.5, Y_L1 + 1.2, -11.8, 0);

  // Oprawy lamelowe i panele narożne pod stropem R5 (y = 9.60 m).
  for (const x of [14, 20, 26])
    for (const z of [-8.0, -2.5, 3.5]) linearBaffleLight(k, x, Y_L1_CEIL, z, 0);
  ceilingCovePanel(k, 28.8, Y_L1_CEIL, -2.0, 0.45, 18.0);
  ceilingCovePanel(k, 11.2, Y_L1_CEIL, -3.0, 0.45, 16.0);
  ceilingCovePanel(k, 22.0, Y_L1_CEIL, 6.8, 12.0, 0.45);
  ceilingCovePanel(k, 20.0, Y_L1_CEIL, -10.8, 16.0, 0.45);
}

/** R6 — Kuchnia Korporacyjna i Strefa Socjalna „Sky Lounge” (L1 NW, X ∈ [-30, -10], Z ∈ [-24, -12], y = 4.80 m). */
function buildRoomR6(k, p) {
  // Dwa moduły Aneksu Kuchennego, ekspresy ciśnieniowe i automaty z napojami (poza spawnem (-20, 4.8, -18)).
  p.prop('off_kitchenette_counter', -14.5, -22.8, Y_L1, 0);
  p.prop('off_kitchenette_counter', -20.0, -22.8, Y_L1, 0);
  p.prop('city_vending', -25.0, -23.0, Y_L1, 0);
  p.prop('city_vending', -26.5, -23.0, Y_L1, 0);
  p.prop('off_coffee_machine', -15.5, -18.0, Y_L1, 0);
  p.prop('off_coffee_machine', -15.5, -14.5, Y_L1, 2);
  p.prop('mall_trash_bin', -11.8, -22.8, Y_L1, 0);
  p.prop('mall_trash_bin', -11.8, -13.5, Y_L1, 2);

  // Strefa widokowa „Sky Lounge” (X ∈ [-28.5, -22]): sofy wokół stolików kawowych i donice z roślinnością.
  coffeeTable(k, p, -26.8, Y_L1, -17.5, 1.8, 0.9);
  coffeeTable(k, p, -23.2, Y_L1, -17.7, 1.8, 0.9);
  p.prop('off_lounge_sofa', -26.8, -19.8, Y_L1, 0);
  p.prop('off_lounge_sofa', -26.8, -15.2, Y_L1, 2);
  p.prop('off_lounge_sofa', -23.2, -15.2, Y_L1, 2);
  p.prop('off_lounge_sofa', -23.2, -20.2, Y_L1, 0);
  p.prop('off_office_planter', -28.4, -17.5, Y_L1, 1);
  p.prop('off_office_planter', -15.5, -16.2, Y_L1, 0);

  deco(k, 'off_whiteboard_wall', -14.5, Y_L1 + 1.05, -12.2, PI);
  deco(k, 'off_acoustic_wall_panel', -25.0, Y_L1 + 1.0, -12.2, PI);
  deco(k, 'wh_wall_terminal', -10.2, Y_L1 + 1.2, -14.5, -Q);

  // Kasetony sufitowe i doświetlenie narożników: pod stropem zewnętrznym (y = 9.6 m, Z = -15 oraz X < -24) i pod płytą L2 (y = 9.2 m, Z = -21).
  for (const x of [-27.0, -21.0, -14.5])
    ceilingLightPanel(k, x, Y_L1_CEIL, -14.5, 0);
  ceilingLightPanel(k, -27.0, Y_L1_CEIL, -21.0, 0);
  ceilingLightPanel(k, -21.0, 9.2, -21.0, 0);
  ceilingLightPanel(k, -14.5, 9.2, -21.0, 0);
  ceilingCovePanel(k, -28.8, Y_L1_CEIL, -18.0, 0.45, 10.0);
  ceilingCovePanel(k, -20.0, Y_L1_CEIL, -13.0, 16.0, 0.45);
  ceilingCovePanel(k, -17.0, 9.2, -23.0, 12.0, 0.45);
}

/** R7 — Serwerownia Biurowa i Centrum Reprografii „Węzeł IT & Druk” (L1 NE, X ∈ [10, 30], Z ∈ [-24, -12], y = 4.80 m). */
function buildRoomR7(k, p) {
  // Wschodnia sekcja serwerowa (X ∈ [20, 29]): dwa rzędy po 3 szafy `off_office_server_rack`
  // wokół pola wyładowań UPS `office-ups-overload` (23.5, 5.8, -18.0).
  for (const x of [21.5, 23.5, 25.5]) {
    p.prop('off_office_server_rack', x, -21.5, Y_L1, 0);
    p.prop('off_office_server_rack', x, -14.5, Y_L1, 2);
  }
  p.prop('off_office_server_rack', 28.2, -21.0, Y_L1, -1);
  p.prop('off_office_server_rack', 28.2, -17.5, Y_L1, -1);

  // Zachodnia sekcja reprografii i druku (X ∈ [11.5, 19], poza spawnem (16, 4.8, -18)).
  p.prop('off_office_printer', 14.0, -22.5, Y_L1, 0);
  p.prop('off_office_printer', 17.5, -22.5, Y_L1, 0);
  p.prop('off_office_printer', 14.0, -14.0, Y_L1, 2);
  p.prop('off_filing_cabinet', 11.8, -22.8, Y_L1, 0);
  p.prop('off_filing_cabinet', 11.8, -13.2, Y_L1, 2);
  p.prop('lab_classified_cabinet', 19.2, -22.8, Y_L1, 0);
  waistDivider(k, p, 19.0, Y_L1, -17.5, 0.32, 2.6);

  // Klimatyzatory precyzyjne i kratki wentylacyjne wyłącznie w Serwerowni R7 (§4.3.A).
  deco(k, 'city_ac_unit', 14.5, Y_L1 + 2.8, -12.2, PI);
  deco(k, 'city_ac_unit', 24.5, Y_L1 + 2.8, -12.2, PI);
  deco(k, 'wh_wall_terminal', 10.2, Y_L1 + 1.2, -14.5, Q);
  deco(k, 'mall_security_fixture', 10.2, Y_L1 + 1.25, -22.2, Q);
  for (const [x, z] of [
    [22.0, -18.0],
    [25.0, -18.0],
  ]) {
    deco(k, 'city_vent_grate', x, Y_L1, z);
  }

  for (const x of [14.5, 21.0, 27.0])
    ceilingLightPanel(k, x, Y_L1_CEIL, -14.5, 0);
  ceilingLightPanel(k, 14.5, 9.2, -21.0, 0);
  ceilingLightPanel(k, 21.0, 9.2, -21.0, 0);
  ceilingLightPanel(k, 27.0, Y_L1_CEIL, -21.0, 0);
  ceilingCovePanel(k, 28.8, Y_L1_CEIL, -18.0, 0.45, 10.0);
  ceilingCovePanel(k, 20.0, Y_L1_CEIL, -13.0, 16.0, 0.45);
  ceilingCovePanel(k, 17.0, 9.2, -23.0, 12.0, 0.45);
}

/** R8 — Szklane Gabinety Kierownictwa — Skrzydło Zachodnie (L2 W, X ∈ [-24, -10], Z ∈ [-28, -16], y = 9.60 m). */
function buildRoomR8(k, p) {
  // Gabinet Południowy (Dyrektor Finansowy CFO) i Północny (Dyrektor B+R) wokół spawnu (-16, 9.6, -22).
  p.prop('off_executive_desk', -19.5, -18.5, Y_L2, 0);
  p.prop('off_office_chair', -19.5, -17.2, Y_L2, 2);
  p.prop('off_lounge_sofa', -13.8, -18.0, Y_L2, 0);
  coffeeTable(k, p, -13.8, Y_L2, -19.6, 1.6, 0.8);
  p.prop('off_filing_cabinet', -22.8, -18.5, Y_L2, 1);

  p.prop('off_executive_desk', -20.5, -25.5, Y_L2, 2);
  p.prop('off_office_chair', -20.5, -26.8, Y_L2, 0);
  p.prop('off_office_planter', -12.5, -26.2, Y_L2, 0);
  p.prop('off_office_planter', -22.2, -22.0, Y_L2, 1);

  deco(k, 'off_whiteboard_wall', -21.0, Y_L2 + 1.05, -27.8, 0);
  deco(k, 'off_acoustic_wall_panel', -12.2, Y_L2 + 1.0, -27.8, 0);
  for (const x of [-20.5, -14.0])
    for (const z of [-25.0, -19.0]) ceilingLightPanel(k, x, Y_L2_CEIL, z, 0);
  ceilingCovePanel(k, -22.8, Y_L2_CEIL, -22.0, 0.45, 10.0);
  ceilingCovePanel(k, -17.0, Y_L2_CEIL, -27.0, 11.0, 0.45);
}

/** R9 — Foyer Zarządu (X ∈ [-10, 10]) i Szklane Gabinety Kierownictwa Wschód (X ∈ [10, 24], Z ∈ [-28, -16], y = 9.60 m). */
function buildRoomR9(k, p) {
  // 1. Foyer Zarządu (X ∈ [-10, 10], Z ∈ [-28, -16]):
  // Przystanek #2 windy na (0, 9.6, -15.6) oraz spawn #15 na (0, 9.6, -20.0) mają czyste przedpole;
  // lada sekretariatu Zarządu stoi na (0, 9.6, -23.8) przed portalem do Gabinetu Zarządu R10.
  p.prop('off_reception_desk', 0, -23.8, Y_L2, 0);
  p.prop('off_office_chair', -1.2, -25.2, Y_L2, 0);
  p.prop('off_office_chair', 1.2, -25.2, Y_L2, 0);
  coffeeTable(k, p, -5.0, Y_L2, -22.0, 1.6, 0.8);
  coffeeTable(k, p, 5.0, Y_L2, -22.0, 1.6, 0.8);
  p.prop('off_lounge_sofa', -6.8, -22.0, Y_L2, 1);
  p.prop('off_lounge_sofa', 6.8, -22.0, Y_L2, -1);
  p.prop('off_office_planter', -6.5, -26.2, Y_L2, 0);
  p.prop('off_office_planter', 6.5, -26.2, Y_L2, 0);
  p.prop('off_coffee_machine', -8.6, -26.8, Y_L2, 0);
  p.prop('off_office_printer', 8.6, -26.8, Y_L2, 0);

  deco(k, 'wh_wall_terminal', -4.2, Y_L2 + 1.2, -27.8, 0);
  deco(k, 'wh_wall_terminal', 4.2, Y_L2 + 1.2, -27.8, 0);
  for (const x of [-5.5, 0, 5.5])
    for (const z of [-25.0, -19.0]) ceilingLightPanel(k, x, Y_L2_CEIL, z, 0);
  ceilingCovePanel(k, 0, Y_L2_CEIL, -27.0, 16.0, 0.45);

  // 2. Szklane Gabinety Kierownictwa — Wschód (X ∈ [10, 24], Z ∈ [-28, -16], wokół spawnu (16, 9.6, -22)):
  p.prop('off_executive_desk', 19.5, -18.5, Y_L2, 0);
  p.prop('off_office_chair', 19.5, -17.2, Y_L2, 2);
  p.prop('off_lounge_sofa', 13.8, -18.0, Y_L2, 0);
  coffeeTable(k, p, 13.8, Y_L2, -19.6, 1.6, 0.8);
  p.prop('off_filing_cabinet', 22.8, -18.5, Y_L2, -1);

  p.prop('off_executive_desk', 20.5, -25.5, Y_L2, 2);
  p.prop('off_office_chair', 20.5, -26.8, Y_L2, 0);
  p.prop('off_office_planter', 12.5, -26.2, Y_L2, 0);
  p.prop('off_office_planter', 22.2, -22.0, Y_L2, -1);

  deco(k, 'off_whiteboard_wall', 21.0, Y_L2 + 1.05, -27.8, 0);
  deco(k, 'off_acoustic_wall_panel', 12.2, Y_L2 + 1.0, -27.8, 0);
  for (const x of [14.0, 20.5])
    for (const z of [-25.0, -19.0]) ceilingLightPanel(k, x, Y_L2_CEIL, z, 0);
  ceilingCovePanel(k, 22.8, Y_L2_CEIL, -22.0, 0.45, 10.0);
  ceilingCovePanel(k, 17.0, Y_L2_CEIL, -27.0, 11.0, 0.45);
}

/** R10 — Gabinet Zarządu Kurogane Arms „Penthouse Prezesa” (L2 N, X ∈ [-24, 24], Z ∈ [-42, -28], y = 9.60 m). */
function buildRoomR10(k, p) {
  // Centrum: dwa moduły Stołu Posiedzeń Zarządu `off_conference_table` po obu stronach osi centralnej
  // (dzięki czemu punkt C (0, 9.6, -35) oraz oś portalu R9 -> EXIT są w 100% drożne!).
  p.prop('off_conference_table', -4.8, -35.0, Y_L2, 0);
  p.prop('off_conference_table', 4.8, -35.0, Y_L2, 0);
  for (const x of [-6.4, -4.8, -3.2, 3.2, 4.8, 6.4]) {
    p.prop('off_office_chair', x, -33.3, Y_L2, 2);
  }
  for (const x of [-6.4, -4.8, -3.2, 3.2]) {
    p.prop('off_office_chair', x, -36.7, Y_L2, 0);
  }

  // Skrzydło Zachodnie (Strefa Prezesa Zarządu, X ∈ [-24, -10], poza spawnem #17 (-12, 9.6, -35)):
  p.prop('off_executive_desk', -18.5, -35.0, Y_L2, 0);
  p.prop('off_office_chair', -18.5, -33.6, Y_L2, 2);
  coffeeTable(k, p, -15.0, Y_L2, -37.8, 1.8, 0.9);
  p.prop('off_lounge_sofa', -15.0, -39.5, Y_L2, 0);
  p.prop('off_lounge_sofa', -15.0, -30.5, Y_L2, 2);
  p.prop('mall_kurogane_display', -22.2, -35.0, Y_L2, 1);
  p.prop('lab_classified_cabinet', -11.2, -29.2, Y_L2, 2);
  p.prop('off_office_planter', -9.2, -39.5, Y_L2, 0);
  p.prop('off_office_planter', -9.2, -30.5, Y_L2, 0);
  p.prop('off_office_planter', -21.2, -39.8, Y_L2, 0);
  p.prop('off_office_planter', -21.2, -30.2, Y_L2, 0);

  // Skrzydło Wschodnie (Strefa Sejfu Zarządu i Prototypów, X ∈ [10, 24], poza spawnem #18 (6, 9.6, -38)):
  // Pylony emitera bramki laserowej `boardroom-vault-laser` (X = 16.5, Z: -39.0 -> -32.0).
  for (const z of [-39.2, -31.8]) {
    p.reserve(R(16.25, 16.75, z - 0.25, z + 0.25), Y_L2);
    box(k, 16.5, Y_L2 + 0.6, z, 0.24, 1.2, 0.24, 'machine', {
      walkable: false,
    });
    box(k, 16.5, Y_L2 + 1.26, z, 0.28, 0.12, 0.28, 'neon_violet', {
      walkable: false,
    });
  }
  p.prop('off_lounge_sofa', 12.5, -35.0, Y_L2, -1);
  p.prop('off_lounge_sofa', 12.5, -30.5, Y_L2, 2);
  p.prop('off_office_planter', 11.2, -39.5, Y_L2, 0);
  p.prop('off_office_planter', 9.2, -30.5, Y_L2, 0);
  p.prop('lab_prototype_weapon_rack', 22.4, -33.0, Y_L2, -1);
  p.prop('lab_prototype_weapon_rack', 22.4, -37.0, Y_L2, -1);
  p.prop('mall_kurogane_display', 19.5, -40.2, Y_L2, 0);
  p.prop('mall_kurogane_display', 19.5, -29.8, Y_L2, 2);
  p.prop('lab_classified_cabinet', 22.2, -40.2, Y_L2, 0);

  // Wielkoformatowe ekrany strategiczne i panele akustyczne na południowej ścianie R10 (Z = -28.2).
  deco(k, 'off_conf_screen_wall', -8.5, Y_L2 + 0.9, -28.2, PI);
  deco(k, 'off_conf_screen_wall', 8.5, Y_L2 + 0.9, -28.2, PI);
  deco(k, 'off_acoustic_wall_panel', -20.5, Y_L2 + 1.0, -28.2, PI);
  deco(k, 'off_acoustic_wall_panel', 20.5, Y_L2 + 1.0, -28.2, PI);
  box(k, 0, Y_L2 + 4.1, -28.24, 46.8, 0.08, 0.08, 'light_panel', {
    walkable: false,
  });

  // Reprezentacyjne oprawy lamelowe i panele narożne pod stropem Penthouse'u (y = 14.80 m).
  for (const x of [-18, -10, 0, 10, 18])
    for (const z of [-38.5, -35.0, -31.5])
      linearBaffleLight(k, x, Y_R10_CEIL, z, 0);
  ceilingCovePanel(k, -22.8, Y_R10_CEIL, -35.0, 0.45, 12.0);
  ceilingCovePanel(k, 22.8, Y_R10_CEIL, -35.0, 0.45, 12.0);
  ceilingCovePanel(k, -13.0, Y_R10_CEIL, -40.8, 18.0, 0.45);
  ceilingCovePanel(k, 13.0, Y_R10_CEIL, -40.8, 18.0, 0.45);
}

export function buildRooms(k, placer) {
  buildRoomR1(k, placer);
  buildRoomR2(k, placer);
  buildRoomR3(k, placer);
  buildAtriumA0(k, placer);
  buildRoomR4(k, placer);
  buildRoomR5(k, placer);
  buildRoomR6(k, placer);
  buildRoomR7(k, placer);
  buildRoomR8(k, placer);
  buildRoomR9(k, placer);
  buildRoomR10(k, placer);
}
