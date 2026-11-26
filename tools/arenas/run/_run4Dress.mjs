// Oprawa wizualna, tekstury z przełącznikiem PENDING_TEXTURES, easter eggi, zagrożenia, skrzynie,
// szyldy, światła i 18 punktów spawnu mapy run4 (Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62).
import {
  COLOR,
  PI,
  Q,
  R,
  Y_L0,
  Y_L1,
  Y_L2,
  box,
  vec,
} from './_run4Kit.mjs';

const C = COLOR;

/**
 * Przełącznik tekstur oczekujących z §4.2 docs/maps/run4.md (Etap C).
 * Domyślnie WYŁĄCZONY (`false`), aby `run4.json` ładował się bez brakujących plików `.webp`
 * i korzystał z pasujących do biura istniejących tekstur/szyldów z innych map.
 */
export const USE_PENDING_TEXTURES = false;

/**
 * Zbiorczy rejestr wszystkich tekstur z §4.2 docs/maps/run4.md wraz z istniejącymi zamiennikami.
 */
export const PENDING_TEXTURES = {
  // --- Szyldy neonowe (public/assets/textures/signs/) ---
  off_kurogane_hq: { pending: 'off_kurogane_hq', fallback: 'mall_kurogane' },
  off_floor_60: { pending: 'off_floor_60', fallback: 'floor_l0' },
  off_floor_61: { pending: 'off_floor_61', fallback: 'floor_l1' },
  off_floor_62: { pending: 'off_floor_62', fallback: 'floor_l2' },
  off_conf_aegis: { pending: 'off_conf_aegis', fallback: 'lab_sector_x51' },
  off_conf_vanguard: {
    pending: 'off_conf_vanguard',
    fallback: 'lab_prototype_armory',
  },
  off_sky_lounge: { pending: 'off_sky_lounge', fallback: 'cat_cafe' },
  off_it_repro: { pending: 'off_it_repro', fallback: 'lab_data_vault' },
  off_boardroom: { pending: 'off_boardroom', fallback: 'lab_restricted_omega' },
  off_elevator_sign: { pending: 'off_elevator_sign', fallback: 'floor_l0' },

  // --- Decale i humor korporacyjny (public/assets/textures/decals/) ---
  off_kurogane_floor_crest: {
    pending: 'off_kurogane_floor_crest',
    fallback: 'plaque_evil_corp',
  },
  off_elevator_floor_zone: {
    pending: 'off_elevator_floor_zone',
    fallback: 'lab_clearance_line',
  },
  off_scattered_contracts: {
    pending: 'off_scattered_contracts',
    fallback: 'lab_redacted_papers',
  },
  off_kpi_poster: {
    pending: 'off_kpi_poster',
    fallback: 'board_resonance_profit',
  },
  off_printer_error_note: {
    pending: 'off_printer_error_note',
    fallback: 'sticky_code_0451',
  },
  off_coffee_rules: {
    pending: 'off_coffee_rules',
    fallback: 'note_object_07',
  },
  off_glass_frost_stripe: {
    pending: 'off_glass_frost_stripe',
    fallback: 'mall_tactile_strip',
  },
  off_rain_streaks_glass: {
    pending: 'off_rain_streaks_glass',
    fallback: 'leak_streak',
  },

  // --- Ekrany i etykiety UV (public/assets/textures/screens/, labels/) ---
  screen_office_analytics: {
    pending: 'screen_office_analytics',
    fallback: 'screen_news',
  },
  screen_elevator_panel: {
    pending: 'screen_elevator_panel',
    fallback: 'screen_status',
  },
  label_office_mug: {
    pending: 'label_office_mug',
    fallback: 'label_lab_mug',
  },
};

/** Aktywne identyfikatory tekstur biurowca (zależnie od flagi `USE_PENDING_TEXTURES`). */
export const OFFICE_TEXTURES = Object.fromEntries(
  Object.entries(PENDING_TEXTURES).map(([key, { pending, fallback }]) => [
    key,
    USE_PENDING_TEXTURES ? pending : fallback,
  ]),
);

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
  opacity = 0.8,
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
 * 18 punktów spawnu wrogów (§5.1 docs/maps/run4.md):
 * - 7 na Piętrze 60 (`y = 0.0 m`: R2, R3, A0),
 * - 6 na Piętrze 61 (`y = 4.8 m`: R4, R5, R6, R7),
 * - 5 na Piętrze 62 (`y = 9.6 m`: R8, R9, R10).
 */
export const SPAWNS = [
  // Piętro 60 (7)
  [-15, Y_L0, 21], // 1: R2 Openspace — południe
  [-25, Y_L0, 14], // 2: R2 Openspace — przy fasadzie W
  [-18, Y_L0, 1], // 3: R2 Openspace — północ
  [16, Y_L0, 21], // 4: R3 Korytarz Panoramowy — południe
  [25, Y_L0, 7], // 5: R3 Korytarz Panoramowy — przy oknie E
  [-4, Y_L0, -6], // 6: A0 Atrium — przed szybem windy L0 (lewa)
  [4, Y_L0, -6], // 7: A0 Atrium — prawa strona szybu windy L0
  // Piętro 61 (6)
  [-18, Y_L1, 4], // 8: R4 Sala Konferencyjna „Aegis” — S
  [-24, Y_L1, -8], // 9: R4 Sala Konferencyjna „Aegis” — N
  [18, Y_L1, 4], // 10: R5 Sala Konferencyjna „Vanguard” — S
  [24, Y_L1, -8], // 11: R5 Sala Konferencyjna „Vanguard” — N
  [-20, Y_L1, -18], // 12: R6 Kuchnia i Strefa Socjalna „Sky Lounge”
  [16, Y_L1, -18], // 13: R7 Serwerownia Biurowa i Drukarnia
  // Piętro 62 (5)
  [-16, Y_L2, -22], // 14: R8 Szklane Gabinety Kierownictwa W
  [0, Y_L2, -20], // 15: R9 Foyer Zarządu przed windą L2
  [16, Y_L2, -22], // 16: R9 Szklane Gabinety Kierownictwa E
  [-12, Y_L2, -35], // 17: R10 Gabinet Zarządu — zachód
  [6, Y_L2, -38], // 18: R10 Gabinet Zarządu — przed exit
];

/** Skrzynie zniszczalne `crate` i dynamiczne `crate_small` (do Chwytu Rezonansem) na wszystkich 3 piętrach. */
function crates(k, p) {
  const big = [
    // Piętro 60 (L0): R1, R2, R3
    [-8.6, Y_L0, 14.0],
    [8.6, Y_L0, 14.0],
    [-23.2, Y_L0, 17.5],
    [15.0, Y_L0, 9.2],
    // Piętro 61 (L1): R4, R5, R6, R7
    [-21.2, Y_L1, 5.8],
    [21.2, Y_L1, 5.8],
    [-20.0, Y_L1, -14.2],
    [17.5, Y_L1, -14.2],
    // Piętro 62 (L2): R8, R9, R10
    [-13.5, Y_L2, -25.0],
    [13.5, Y_L2, -25.0],
    [-14.5, Y_L2, -35.0],
    [13.8, Y_L2, -38.5],
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
    // Piętro 60 (L0)
    [-8.4, Y_L0, 21.5],
    [8.4, Y_L0, 21.5],
    [-23.2, Y_L0, 16.2],
    [16.0, Y_L0, 9.2],
    [-1.8, Y_L0, -4.8],
    [1.8, Y_L0, -4.8],
    // Piętro 61 (L1)
    [-28.2, Y_L1, 0.0],
    [28.2, Y_L1, 0.0],
    [-18.0, Y_L1, -20.5],
    [16.0, Y_L1, -14.2],
    // Piętro 62 (L2)
    [-4.2, Y_L2, -23.8],
    [4.2, Y_L2, -23.8],
    [-14.5, Y_L2, -33.2],
    [13.8, Y_L2, -36.8],
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

/** 4 zagrożenia środowiskowe (§5.2 docs/maps/run4.md) na Piętrach 60, 61 i 62. */
function hazards(k, p) {
  k.hazards.push(
    // 1. Bramka laserowa w R3 Korytarzu Panoramowym (y = 0.0 m)
    {
      kind: 'laser_gate',
      id: 'panorama-security-laser',
      from: vec(15.0, Y_L0 + 0.85, 14.0),
      to: vec(22.0, Y_L0 + 0.85, 14.0),
      cycle: { onS: 2.6, offS: 1.8 },
    },
    // 2. Przeciążona sekcja zasilania UPS w R7 Serwerowni Biurowej (spód na y = 4.8 m)
    {
      kind: 'electric_field',
      id: 'office-ups-overload',
      position: vec(23.5, Y_L1 + 1.0, -18.0),
      size: vec(2.8, 2.0, 3.0),
      cycle: { onS: 3.0, offS: 2.2 },
    },
    // 3. Zbiornik ciśnieniowy chłodziwa/halonu w R7 Serwerowni i Drukarni (y = 4.8 m)
    {
      kind: 'explosive_barrel',
      id: 'toner-coolant-cylinder',
      position: vec(27.5, Y_L1, -14.0),
    },
    // 4. Bramka laserowa przed sejfem w R10 Gabinecie Zarządu (y = 9.6 m)
    {
      kind: 'laser_gate',
      id: 'boardroom-vault-laser',
      from: vec(16.5, Y_L2 + 0.85, -39.0),
      to: vec(16.5, Y_L2 + 0.85, -32.0),
      cycle: { onS: 2.4, offS: 1.8 },
    },
  );
  p.reserve(R(27.0, 28.0, -14.5, -13.5), Y_L1);
  k.fx('sparks', 23.5, Y_L1 + 0.8, -18.0, 1.2);
  k.fx('sparks', 16.5, Y_L2 + 0.85, -35.5, 0.9);
  mark(k, 'floor_hazard', 18.5, Y_L0 + 0.01, 14.0, 7.2, 0.8, 0, C.amber, 0.75);
  mark(k, 'floor_hazard', 23.5, Y_L1 + 0.01, -18.0, 3.0, 3.2, 0, C.blue, 0.75);
  mark(k, 'floor_hazard', 16.5, Y_L2 + 0.01, -35.5, 7.2, 0.8, Q, C.violet, 0.75);
}

/** Oznakowanie poziome, ścieżki w granicie, herby Kurogane Arms, ślady stóp i easter eggi (§4.2). */
function decalsAndEasterEggs(k) {
  // Herby podłogowe Kurogane Arms w granicie Lobby R1, Atrium A0, Foyer Zarządu R9 i Gabinetu R10.
  for (const [x, y, z, w, h] of [
    [0, Y_L0, 24.5, 3.4, 1.7],
    [0, Y_L0, 15.2, 3.6, 1.8],
    [0, Y_L0, 2.0, 3.8, 1.9],
    [0, Y_L0, -7.2, 3.2, 1.6],
    [0, Y_L2, -20.0, 3.2, 1.6],
    [0, Y_L2, -35.0, 3.6, 1.8],
  ]) {
    mark(
      k,
      OFFICE_TEXTURES.off_kurogane_floor_crest,
      x,
      y + 0.012,
      z,
      w,
      h,
      0,
      C.amber,
      0.88,
    );
  }

  // Oznaczenia progów przed 3 przystankami działającej windy (L0, L1, L2) oraz przed kordonem bramek R1.
  mark(
    k,
    OFFICE_TEXTURES.off_elevator_floor_zone,
    0,
    Y_L0 + 0.012,
    -11.5,
    3.2,
    1.2,
    0,
    C.amber,
    0.88,
  );
  mark(
    k,
    OFFICE_TEXTURES.off_elevator_floor_zone,
    0,
    Y_L1 + 0.012,
    -11.2,
    3.2,
    1.2,
    0,
    C.amber,
    0.88,
  );
  mark(
    k,
    OFFICE_TEXTURES.off_elevator_floor_zone,
    0,
    Y_L2 + 0.012,
    -16.8,
    3.2,
    1.2,
    PI,
    C.amber,
    0.88,
  );
  mark(k, 'floor_hazard', 0, Y_L0 + 0.011, 21.5, 13.6, 0.75, 0, C.amber, 0.72);
  mark(k, 'floor_hazard', 0, Y_L0 + 0.011, 10.0, 11.4, 0.65, 0, C.amber, 0.7);
  mark(k, 'floor_stop', 0, Y_L0 + 0.012, 22.8, 3.2, 0.8, PI, C.amber, 0.8);

  // Ścieżki prowadzące w granicie (wzorem run3): z Lobby R1 przez Atrium A0 do windy, schodów i skrzydeł R2/R3.
  for (const sx of [-1, 1]) {
    for (const z of [25.5, 16.5, 11.5, 4.5, -3.5, -9.5]) {
      mark(
        k,
        OFFICE_TEXTURES.off_elevator_floor_zone,
        sx * 2.8,
        Y_L0 + 0.01,
        z,
        5.2,
        0.38,
        Q,
        C.amber,
        0.82,
      );
    }
    // Poprzeczne ścieżki do skrzydeł bocznych R2 (X = -10) i R3 (X = +10) oraz w Openspace R2.
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      sx * 6.5,
      Y_L0 + 0.01,
      sx < 0 ? 20.0 : 24.0,
      5.4,
      0.38,
      0,
      C.blue,
      0.8,
    );
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      sx * 6.5,
      Y_L0 + 0.01,
      1.0,
      5.4,
      0.38,
      0,
      C.blue,
      0.8,
    );
    mark(
      k,
      'floor_arrow',
      sx * 7.8,
      Y_L0 + 0.01,
      sx < 0 ? 20.0 : 24.0,
      1.4,
      1.5,
      sx < 0 ? Q : -Q,
      C.amber,
      0.58,
    );
    mark(
      k,
      'floor_arrow',
      sx * 7.8,
      Y_L0 + 0.01,
      1.0,
      1.4,
      1.5,
      sx < 0 ? Q : -Q,
      C.blue,
      0.58,
    );
  }
  // Linie komunikacyjne w alejach Openspace R2 (X = -17.2 i -23.2) oraz Korytarza Panoramowego R3 (X = 16.5).
  for (const z of [5.5, 14.5, 23.5]) {
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      -17.2,
      Y_L0 + 0.01,
      z,
      6.0,
      0.36,
      Q,
      C.blue,
      0.75,
    );
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      16.5,
      Y_L0 + 0.01,
      z,
      5.6,
      0.36,
      Q,
      C.amber,
      0.75,
    );
  }
  // Linie prowadzące na Mostku L1, w Galerii Północnej L1 oraz w Foyer Zarządu L2 i Penthouse R10.
  for (const sx of [-1, 1]) {
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      sx * 4.5,
      Y_L1 + 0.01,
      -19.0,
      7.0,
      0.38,
      0,
      C.amber,
      0.82,
    );
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      sx * 3.0,
      Y_L2 + 0.01,
      -22.0,
      7.0,
      0.38,
      Q,
      C.amber,
      0.82,
    );
    mark(
      k,
      OFFICE_TEXTURES.off_elevator_floor_zone,
      sx * 1.8,
      Y_L2 + 0.01,
      -35.0,
      9.0,
      0.38,
      Q,
      C.green,
      0.82,
    );
  }

  // Mokre ślady obuwia (`mall_wet_footprints`) i naniesione kałuże przy wejściu do Lobby R1 oraz w Atrium i kuchni R6.
  for (const [x, z, yaw] of [
    [-0.9, 28.4, 0.15],
    [1.1, 27.2, -0.2],
    [-0.6, 24.8, 0.1],
    [1.4, 19.8, -0.25],
    [-2.2, 8.8, 0.3],
    [2.4, -4.5, -0.2],
  ]) {
    mark(k, 'puddle1', x, Y_L0 + 0.01, z, 1.5, 1.1, yaw, '#8fa5c8', 0.48);
    mark(
      k,
      'mall_wet_footprints',
      x + 0.3,
      Y_L0 + 0.015,
      z - 1.1,
      1.1,
      2.4,
      PI + yaw * 0.5,
      C.warm,
      0.55,
    );
  }
  mark(
    k,
    'mall_wet_footprints',
    -17.2,
    Y_L1 + 0.015,
    -20.5,
    1.1,
    2.4,
    0.4,
    C.warm,
    0.58,
  );

  // Porozrzucane poufne kontrakty zbrojeniowe przy drukarkach w R7, w R2, R3 i w R9.
  for (const [x, y, z, yaw] of [
    [-19.2, Y_L0, 15.2, 0.3],
    [-16.8, Y_L0, 7.2, -0.4],
    [-22.8, Y_L0, 12.2, 0.2],
    [15.8, Y_L0, 6.2, -0.35],
    [-3.2, Y_L0, 12.8, 0.25],
    [15.5, Y_L1, -21.2, 0.2],
    [14.2, Y_L1, -15.6, -0.5],
    [7.2, Y_L2, -25.8, 0.15],
  ]) {
    mark(
      k,
      OFFICE_TEXTURES.off_scattered_contracts,
      x,
      y + 0.012,
      z,
      1.3,
      1.3,
      yaw,
      C.warm,
      0.85,
    );
  }

  // Plakaty motywacyjne KPI, kartka o zacinającej drukarce nr 4 i regulamin synt-kofeiny
  // (każda naklejka ścienna leży w 100% wewnątrz pojedynczego ciągłego bloku ściany!).
  mark(
    k,
    OFFICE_TEXTURES.off_kpi_poster,
    -10.18,
    Y_L0 + 1.65,
    14.0,
    1.6,
    1.1,
    -Q,
    C.amber,
    0.92,
    'wall',
  );
  // Na Z = -12 (R4/R6) otwór drzwiowy to X ∈ [-22, -18]; ciągły blok ściany to X ∈ [-18, -10], środek X = -14.5.
  mark(
    k,
    OFFICE_TEXTURES.off_kpi_poster,
    -14.5,
    Y_L1 + 1.65,
    -12.18,
    1.6,
    1.1,
    PI,
    C.blue,
    0.92,
    'wall',
  );
  // Na Z = -12 (R5/R7) otwór drzwiowy to X ∈ [18, 22]; ciągły blok ściany to X ∈ [10, 18], środek X = 16.0.
  mark(
    k,
    OFFICE_TEXTURES.off_printer_error_note,
    16.0,
    Y_L1 + 1.4,
    -12.18,
    0.65,
    0.65,
    PI,
    C.amber,
    0.95,
    'wall',
  );
  // Na X = -10 (R6/A0) otwór drzwiowy to Z ∈ [-21, -17]; ciągły blok ściany to Z ∈ [-17, -12], środek Z = -15.0.
  mark(
    k,
    OFFICE_TEXTURES.off_coffee_rules,
    -10.18,
    Y_L1 + 1.45,
    -15.0,
    0.95,
    0.95,
    -Q,
    C.green,
    0.92,
    'wall',
  );

  // Pasy ostrzegawcze na szklanych ściankach i krople deszczu na zewnętrznych fasadach
  // (na Z = -42 w R10 omijamy otwór exit X ∈ [-2, 2], umieszczając pasy na pełnych blokach X = ±12).
  for (const [x, y, z, yaw] of [
    [-20.0, Y_L0 + 1.3, 29.9, PI],
    [20.0, Y_L0 + 1.3, 29.9, PI],
    [-20.0, Y_L1 + 1.3, 7.9, PI],
    [20.0, Y_L1 + 1.3, 7.9, PI],
    [-12.0, Y_L2 + 1.3, -41.9, 0],
    [12.0, Y_L2 + 1.3, -41.9, 0],
  ]) {
    mark(
      k,
      OFFICE_TEXTURES.off_glass_frost_stripe,
      x,
      y,
      z,
      3.6,
      0.24,
      yaw,
      C.amber,
      0.7,
      'wall',
    );
  }
  for (const [x, y, z, yaw] of [
    [-29.9, Y_L0 + 2.2, 14.0, Q],
    [29.9, Y_L0 + 2.2, 14.0, -Q],
    [-23.9, Y_L2 + 2.4, -35.0, Q],
    [23.9, Y_L2 + 2.4, -35.0, -Q],
  ]) {
    mark(
      k,
      OFFICE_TEXTURES.off_rain_streaks_glass,
      x,
      y,
      z,
      1.8,
      2.2,
      yaw,
      C.blue,
      0.55,
      'wall',
    );
  }

  // Strzałki kierunkowe i oznaczenie śluzy ewakuacyjnej EXIT na Piętrze 62.
  for (const z of [27.0, 19.0, 12.0, 4.5, -5.0, -9.8])
    mark(k, 'floor_arrow', 0, Y_L0 + 0.01, z, 1.5, 1.7, PI, C.amber, 0.62);
  for (const z of [-19.0, -25.8, -31.5, -38.5])
    mark(k, 'floor_arrow', 0, Y_L2 + 0.01, z, 1.5, 1.7, PI, C.green, 0.6);
  mark(
    k,
    'mall_exit_stencil',
    0,
    Y_L2 + 0.012,
    -40.2,
    2.2,
    2.2,
    0,
    C.green,
    0.88,
  );
}

/** Szyldy neonowe (`kind: "neon"`, 0 stożków `holo`!) nad portalami, za recepcją i na szybie windy na 3 piętrach. */
function signage(k) {
  const neon = (texture, x, y, z, w, h, yaw, tint, flicker = 0) => {
    const width = Math.min(w, h * 2);
    k.neon(texture, x, y, z, width, width / 2, yaw, tint, flicker);
  };

  // --- PIĘTRO 60 (L0) ---
  // R1 Lobby: logo Kurogane na dwóch ściankach reprezentacyjnych za recepcją (Z = 11.24, y = 1.85 m),
  // nad głównym portalem do Atrium (Z = 10.22, obniżone do y = 3.55 m z dala od stropu!) oraz nad entry.
  neon(OFFICE_TEXTURES.off_kurogane_hq, -5.2, Y_L0 + 1.85, 11.24, 2.6, 0.9, 0, C.amber);
  neon(OFFICE_TEXTURES.off_kurogane_hq, 5.2, Y_L0 + 1.85, 11.24, 2.6, 0.9, 0, C.amber);
  neon(OFFICE_TEXTURES.off_kurogane_hq, 0, Y_L0 + 3.55, 10.22, 3.4, 1.0, 0, C.amber);
  neon(OFFICE_TEXTURES.off_floor_60, 0, Y_L0 + 3.5, 29.85, 3.0, 0.95, PI, C.blue);
  // Nad bramami bocznymi z R1/A0 do R2 (X = -9.78) i R3 (X = +9.78).
  neon(OFFICE_TEXTURES.off_floor_60, -9.78, Y_L0 + 3.6, 20.0, 2.6, 0.85, Q, C.blue);
  neon(OFFICE_TEXTURES.off_kurogane_hq, 9.78, Y_L0 + 3.6, 24.0, 2.6, 0.85, -Q, C.amber);
  neon(OFFICE_TEXTURES.off_floor_60, -9.78, Y_L0 + 3.6, 1.0, 2.6, 0.85, Q, C.blue);
  neon(OFFICE_TEXTURES.off_floor_60, 9.78, Y_L0 + 3.6, 1.0, 2.6, 0.85, -Q, C.amber);
  // Szyb windy w Atrium na poziomie L0 (Z = -12.05): szyld z numerem piętra L0 (docelowo off_elevator_sign).
  neon(
    USE_PENDING_TEXTURES
      ? OFFICE_TEXTURES.off_elevator_sign
      : OFFICE_TEXTURES.off_floor_60,
    0,
    Y_L0 + 3.5,
    -12.05,
    2.8,
    0.9,
    0,
    C.amber,
  );

  // --- PIĘTRO 61 (L1) ---
  // Szyb windy na poziomie L1 (Z = -12.05): szyld z numerem piętra L1 oraz wejścia do Sal Konferencyjnych R4/R5 (Z = 2.0).
  neon(
    USE_PENDING_TEXTURES
      ? OFFICE_TEXTURES.off_elevator_sign
      : OFFICE_TEXTURES.off_floor_61,
    0,
    Y_L1 + 3.5,
    -12.05,
    2.8,
    0.9,
    0,
    C.amber,
  );
  neon(OFFICE_TEXTURES.off_floor_61, 0, Y_L1 + 3.65, 7.85, 3.0, 0.95, PI, C.amber);
  neon(OFFICE_TEXTURES.off_conf_aegis, -9.85, Y_L1 + 3.75, 2.0, 2.8, 0.9, Q, C.blue);
  neon(
    OFFICE_TEXTURES.off_conf_vanguard,
    9.85,
    Y_L1 + 3.75,
    2.0,
    2.8,
    0.9,
    -Q,
    C.violet,
  );
  // Wejścia do Kuchni „Sky Lounge” R6 i Serwerowni R7 (Z = -11.78 oraz X = ±9.78).
  neon(OFFICE_TEXTURES.off_sky_lounge, -20.0, Y_L1 + 3.65, -11.78, 2.6, 0.85, 0, C.green);
  neon(OFFICE_TEXTURES.off_it_repro, 20.0, Y_L1 + 3.65, -11.78, 2.6, 0.85, 0, C.blue);
  neon(OFFICE_TEXTURES.off_sky_lounge, -9.78, Y_L1 + 3.65, -19.0, 2.6, 0.85, Q, C.green);
  neon(OFFICE_TEXTURES.off_it_repro, 9.78, Y_L1 + 3.65, -19.0, 2.6, 0.85, -Q, C.blue);

  // --- PIĘTRO 62 (L2) ---
  // Szyb windy na poziomie L2 (od strony Foyer Zarządu, Z = -15.95): szyld z numerem piętra L2, Foyer R9 i Gabinet R10.
  neon(
    USE_PENDING_TEXTURES
      ? OFFICE_TEXTURES.off_elevator_sign
      : OFFICE_TEXTURES.off_floor_62,
    0,
    Y_L2 + 3.5,
    -15.95,
    2.8,
    0.9,
    PI,
    C.amber,
  );
  neon(OFFICE_TEXTURES.off_floor_62, -9.85, Y_L2 + 3.75, -22.0, 2.6, 0.85, Q, C.amber);
  neon(OFFICE_TEXTURES.off_floor_62, 9.85, Y_L2 + 3.75, -22.0, 2.6, 0.85, -Q, C.violet);
  neon(OFFICE_TEXTURES.off_boardroom, 0, Y_L2 + 3.65, -27.78, 3.4, 1.0, 0, C.amber);
  neon(OFFICE_TEXTURES.off_kurogane_hq, 0, Y_L2 + 3.65, -28.22, 3.4, 1.0, PI, C.amber);

  // Portal wyjścia ewakuacyjnego EXIT na północnej fasadzie R10 (Z = -41.85).
  k.neon('arrow', 0, Y_L2 + 3.6, -41.85, 2.6, 0.9, 0, C.green, 0);
  box(k, 0, Y_L2 + 3.25, -41.88, 4.4, 0.12, 0.2, 'light_panel', {
    walkable: false,
  });
}

/**
 * 24 źródła światła `lights[]` (§5.3 docs/maps/run4.md):
 * - 9 na Piętrze 60 (`floorY: 0.0`),
 * - 9 na Piętrze 61 (`floorY: 4.8`),
 * - 6 na Piętrze 62 (`floorY: 9.6`),
 * - 100% bez `cone: true` (0 smug wolumetrycznych!)
 * - Wszystkie źródła punktowe są odsunięte o >= 2.0–2.4 m poniżej płyt stropowych i opraw sufitowych
 *   (`y = floorY + 2.4 m`) oraz mają obniżoną intensywność (`14..18`), co całkowicie eliminuje
 *   kule/łzy bloomu pod stropem w `01-spawn` i `07-corner-se`!
 */
function lights(k) {
  // --- PIĘTRO 60 (L0, 9 źródeł, y = 2.4 m — 2.4 m poniżej stropu 4.8 m) ---
  // R1 Lobby Główne (2 — odsunięte na boki stref oczekiwania, poza centralną osią strzałki!)
  k.light(-5.0, Y_L0 + 2.4, 20.5, C.warm, 15, 15, { floorY: Y_L0 });
  k.light(5.0, Y_L0 + 2.4, 15.0, C.amber, 15, 15, { floorY: Y_L0 });
  // R2 Wielki Openspace (3)
  k.light(-20.0, Y_L0 + 2.4, 23.0, C.warm, 16, 15, { floorY: Y_L0 });
  k.light(-20.0, Y_L0 + 2.4, 13.0, C.blue, 16, 15, { floorY: Y_L0 });
  k.light(-20.0, Y_L0 + 2.2, 3.0, C.warm, 15, 14, { floorY: Y_L0 });
  // R3 Korytarz Panoramowy (2 — obniżone z 4.35 do 2.4 m i stłumione do 15, zero kuli bloomu w 07-corner-se!)
  k.light(20.0, Y_L0 + 2.4, 21.0, C.warm, 15, 15, { floorY: Y_L0 });
  k.light(20.0, Y_L0 + 2.2, 7.0, C.blue, 15, 14, { floorY: Y_L0 });
  // A0 Atrium Parter (2)
  k.light(0, Y_L0 + 2.6, 2.0, C.warm, 18, 16, { floorY: Y_L0 });
  k.light(0, Y_L0 + 2.3, -10.0, C.amber, 15, 14, { floorY: Y_L0 });

  // --- PIĘTRO 61 (L1, 9 źródeł, y = Y_L1 + 2.4 m = 7.2 m — 2.0..2.4 m poniżej stropu) ---
  // R4 Sala Konferencyjna „Aegis” (2)
  k.light(-16.0, Y_L1 + 2.4, -3.5, C.warm, 16, 15, { floorY: Y_L1 });
  k.light(-24.0, Y_L1 + 2.4, -2.0, C.blue, 15, 14, { floorY: Y_L1 });
  // R5 Sala Konferencyjna „Vanguard” (2)
  k.light(16.0, Y_L1 + 2.4, -3.5, C.warm, 16, 15, { floorY: Y_L1 });
  k.light(24.0, Y_L1 + 2.4, -2.0, C.violet, 15, 14, { floorY: Y_L1 });
  // R6 Kuchnia „Sky Lounge” (2)
  k.light(-17.0, Y_L1 + 2.2, -18.0, C.amber, 15, 13, { floorY: Y_L1 });
  k.light(-25.0, Y_L1 + 2.2, -18.0, C.green, 14, 12, { floorY: Y_L1 });
  // R7 Serwerownia i Drukarnia (2)
  k.light(15.0, Y_L1 + 2.2, -18.0, C.warm, 15, 13, { floorY: Y_L1 });
  k.light(24.0, Y_L1 + 2.2, -18.0, C.blue, 16, 13, {
    floorY: Y_L1,
    flicker: { pattern: 'buzz', strength: 0.2 },
  });
  // A0 Mostek Windy L1 (1)
  k.light(0, Y_L1 + 2.4, -10.0, C.amber, 15, 14, { floorY: Y_L1 });

  // --- PIĘTRO 62 (L2, 6 źródeł, y = Y_L2 + 2.4 m = 12.0 m — 2.4..2.8 m poniżej stropu) ---
  // R8 Szklane Gabinety W (1)
  k.light(-17.0, Y_L2 + 2.4, -22.0, C.amber, 15, 13, { floorY: Y_L2 });
  // R9 Foyer Zarządu i Szklane Gabinety E (2)
  k.light(0, Y_L2 + 2.4, -20.0, C.warm, 16, 14, { floorY: Y_L2 });
  k.light(17.0, Y_L2 + 2.4, -22.0, C.violet, 15, 13, { floorY: Y_L2 });
  // R10 Gabinet Zarządu „Penthouse” (3)
  k.light(0, Y_L2 + 2.5, -35.0, C.amber, 18, 16, { floorY: Y_L2 });
  k.light(-16.0, Y_L2 + 2.5, -35.0, C.warm, 16, 14, { floorY: Y_L2 });
  k.light(0, Y_L2 + 2.3, -40.5, C.green, 16, 14, { floorY: Y_L2 });
}

export function dress(k, placer) {
  crates(k, placer);
  hazards(k, placer);
  decalsAndEasterEggs(k);
  signage(k);
  lights(k);
}
