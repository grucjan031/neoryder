// Oprawa wizualna biurowca: tekstury, zagro?enia, skrzynie,
// szyldy, światła i 18 punktów spawnu mapy run4 (Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62).
import { COLOR, PI, Q, R, Y_L0, Y_L1, Y_L2, box, vec } from './_run4Kit.mjs';

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
}

function decals(k) {
  for (const [x, y, z, size] of [
    [0, Y_L0, 24.5, 3.0],
    [0, Y_L0, 15.7, 2.4],
    [0, Y_L0, 2.0, 2.6],
    [0, Y_L0, -7.0, 2.6],
    [0, Y_L2, -20.5, 2.6],
    [0, Y_L2, -35.0, 2.6],
  ]) {
    mark(
      k,
      'off_kurogane_floor_crest',
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

  for (const [y, z, yaw] of [
    [Y_L0, -11.35, 0],
    [Y_L1, -11.35, 0],
    [Y_L2, -16.8, PI],
  ]) {
    mark(
      k,
      'off_elevator_floor_zone',
      0,
      y + 0.012,
      z,
      2.8,
      1.4,
      yaw,
      '#ffffff',
      0.94,
    );
  }

  for (const [x, y, z, size, yaw] of [
    [-19.2, Y_L0, 15.2, 0.95, 0.3],
    [-16.8, Y_L0, 7.2, 0.95, -0.4],
    [15.5, Y_L1, -21.2, 1.05, 0.2],
    [14.2, Y_L1, -15.6, 0.95, -0.5],
    [-18.9, Y_L2 + 0.776, -18.19, 0.34, 0.24],
    [-20.5, Y_L2, -24.4, 0.85, 0.15],
    [18.9, Y_L2 + 0.776, -18.19, 0.34, -0.22],
    [20.5, Y_L2, -24.4, 0.85, -0.25],
    [-17.9, Y_L2 + 0.776, -34.69, 0.34, 0.18],
  ]) {
    mark(
      k,
      'off_scattered_contracts',
      x,
      y + 0.012,
      z,
      size,
      size,
      yaw,
      '#ffffff',
      0.94,
    );
  }

  // Ekrany analityczne i nadruki kubk?w korzystaj? z UV modeli off_desk_pod,
  // off_conf_screen_wall, off_executive_desk i off_coffee_machine.
  for (const [texture, x, y, z, w, h, yaw] of [
    ['off_kpi_poster', -10.22, Y_L0 + 2.4, 16.5, 0.9, 1.35, -Q],
    ['off_kpi_poster', -14.5, Y_L1 + 1.75, -12.22, 0.9, 1.35, PI],
    ['off_printer_error_note', 10.22, Y_L1 + 1.65, -21.5, 0.65, 0.65, Q],
    ['off_coffee_rules', -10.22, Y_L1 + 1.6, -15.0, 0.82, 0.82, -Q],
  ]) {
    mark(k, texture, x, y, z, w, h, yaw, '#ffffff', 0.96, 'wall');
  }

  // Sta?e skrzyd?a szklanych portali. Ka?dy pas ma osobny blok no?ny.
  for (const [x, y, z, alongX, facing] of [
    [-10, Y_L0, 1, false, 1],
    [10, Y_L0, 1, false, -1],
    [-10, Y_L1, 2, false, 1],
    [10, Y_L1, 2, false, -1],
    [-20, Y_L1, -12, true, 1],
    [20, Y_L1, -12, true, 1],
    [-10, Y_L2, -22, false, 1],
    [10, Y_L2, -22, false, -1],
  ]) {
    for (const offset of [-1.6, 1.6]) {
      const px = x + (alongX ? offset : facing * 0.14);
      const pz = z + (alongX ? facing * 0.14 : offset);
      mark(
        k,
        'off_glass_frost_stripe',
        px,
        y + 1.3,
        pz,
        0.72,
        0.36,
        alongX ? 0 : facing * Q,
        '#ffffff',
        0.8,
        'wall',
      );
    }
  }

  for (const [x, y, z, yaw] of [
    [-29.9, Y_L0 + 2.2, 14.0, Q],
    [29.9, Y_L0 + 2.2, 14.0, -Q],
    [-29.9, Y_L1 + 2.2, -18.0, Q],
    [29.9, Y_L1 + 2.2, -5.0, -Q],
    [-23.9, Y_L2 + 2.4, -35.0, Q],
    [23.9, Y_L2 + 2.4, -35.0, -Q],
  ]) {
    mark(
      k,
      'off_rain_streaks_glass',
      x,
      y,
      z,
      2.6,
      2.6,
      yaw,
      '#ffffff',
      0.66,
      'wall',
    );
  }

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
  const neon = (texture, x, y, z, w, yaw) =>
    k.neon(texture, x, y, z, w, w / 2, yaw, '#ffffff', 0);

  // R1: oznakowanie za ladami i mniejszy szyld nad przej?ciem do atrium.
  for (const x of [-5.2, 5.2])
    neon('off_kurogane_hq', x, Y_L0 + 1.96, 11.24, 3.14, 0);
  neon('off_kurogane_hq', 0, Y_L0 + 4.4, 10.23, 1.46, 0);

  // Szyby i doj?cia do schod?w. Wysokie szyldy windy pozostawiaj? widoczne
  // drzwi, a tablice pi?ter wisz? obok nich.
  for (const [y, z, yaw, floor] of [
    [Y_L0, -12.05, 0, 'off_floor_60'],
    [Y_L1, -12.05, 0, 'off_floor_61'],
    [Y_L2, -15.95, PI, 'off_floor_62'],
  ]) {
    neon('off_elevator_sign', 0, y + 4.02, z, 2.4, yaw);
    neon(floor, Math.cos(yaw) * -2.95, y + 4.02, z, 2.05, yaw);
  }

  neon('off_floor_60', -9.77, Y_L0 + 2.55, 4.8, 2.1, Q);
  neon('off_floor_60', 10.23, Y_L0 + 2.55, 21.0, 1.75, Q);
  neon('off_floor_61', -9.79, Y_L1 + 3.92, -3.0, 2.15, Q);
  neon('off_floor_61', 9.79, Y_L1 + 3.92, -3.0, 2.15, -Q);
  for (const x of [-7.8, 7.8])
    neon('off_floor_62', x, Y_L2 + 4.2, -16.12, 2.0, PI);

  neon('off_conf_aegis', -9.77, Y_L1 + 3.98, 2.0, 2.8, Q);
  neon('off_conf_vanguard', 9.77, Y_L1 + 3.98, 2.0, 2.8, -Q);
  neon('off_sky_lounge', -20.0, Y_L1 + 4.0, -11.77, 2.6, 0);
  neon('off_it_repro', 20.0, Y_L1 + 4.0, -11.77, 2.6, 0);
  neon('off_sky_lounge', -9.77, Y_L1 + 4.0, -19.0, 2.6, Q);
  neon('off_it_repro', 9.77, Y_L1 + 4.0, -19.0, 2.6, -Q);
  neon('off_boardroom', 0, Y_L2 + 4.18, -27.77, 3.1, 0);
  neon('off_boardroom', 0, Y_L2 + 4.18, -28.23, 3.1, PI);

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
  decals(k);
  signage(k);
  lights(k);
}
