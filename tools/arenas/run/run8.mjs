// Elektrownia Fuzyjna Kurogane Arms — Kompleks Tokamaka „Helios-IV” (run8):
// 1 Duża Hala Reaktora (R2: 44 × 44 m, H = 19.2 m, 2 poziomy galerii G1 y = +4.8 m i G2 y = +9.6 m,
// w centrum proceduralny Tokamak `fusionReactor`) + 7 średnich i małych pomieszczeń specjalistycznych
// (R1 Szatnia-Dekontaminacja, R3 Sterownia Główna z 15-metrową szybą na reaktor, R4 Lab Plazmy,
// R5 Magazyn Paliwa Deuter/Tryt, R6 Hala Turbin, R7 Serwerownia Diagnostyczna, R8 Biuro Kierownika dr. Moriego),
// 6 biegów ramp stalowych (25.64°), 8 naukowców (`civilians`), 20 kryjówek (`hideSpots`) i 18 spawnów.
// Projekt: docs/maps/run8.md. Generator jest w pełni deterministyczny.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom } from './_runKit.mjs';
import { buildRooms } from './_run8Rooms.mjs';
import {
  CIVILIANS,
  HIDE_SPOTS,
  SET_PIECES,
  SPAWNS,
  dress,
} from './_run8Dress.mjs';
import {
  MAT_CEIL,
  MAT_CONCRETE,
  MAT_FLOOR,
  MAT_GLASS,
  MAT_GRATING,
  MAT_SHIELD,
  MAT_TILE,
  R,
  ROOMS,
  SLAB,
  Y_G1,
  Y_G1_CEIL,
  Y_G2,
  Y_HALL_CEIL,
  Y_L0,
  Y_R1_CEIL,
  Y_R4_CEIL,
  Y_R5_CEIL,
  Y_R6_CEIL,
  Y_R7_CEIL,
  blastDoorFrame,
  catwalkRailing,
  cofferedCeilingSlab,
  controlWindowWall,
  createPlacer,
  deck,
  prop,
  rampFlightWithRails,
  segmentedWall,
  solid,
  vec,
} from './_run8Kit.mjs';

// --- Konstrukcja: monolityczne posadzki R1..R8, galerie G1 i G2, kasetonowe stropy i ściany ------

function structure(k, placer) {
  // 1. Posadzki Poziomu Głównego (L0, y = 0.00 m, płyta -0.60..0.00 m) — dokładnie 1 blok na pokój (nauczka #1 z run7):
  deck(k, ROOMS.R1, Y_L0, MAT_FLOOR, 0.6);
  deck(k, ROOMS.R2, Y_L0, MAT_FLOOR, 0.6);
  deck(k, ROOMS.R4, Y_L0, MAT_FLOOR, 0.6);
  deck(k, ROOMS.R5, Y_L0, MAT_FLOOR, 0.6);
  deck(k, ROOMS.R6, Y_L0, MAT_CONCRETE, 0.6);
  deck(k, ROOMS.R7, Y_L0, MAT_TILE, 0.6);
  // Próg wnęki drzwi wejściowych entry (południe R1: X ∈ [-2, 2], Z ∈ [36, 37]).
  deck(k, R(-2, 2, 36, 37), Y_L0, MAT_FLOOR, 0.6);

  // 2. Posadzki Poziomu Galerii 1 (G1, y = +4.80 m, płyta +4.40..+4.80 m):
  // Pomieszczenia na poziomie G1 — dokładnie 1 monolityczny blok posadzki na pokój (R3 i R8):
  deck(k, ROOMS.R3, Y_G1, MAT_TILE, SLAB);
  deck(k, ROOMS.R8, Y_G1, MAT_TILE, SLAB);
  // Próg wnęki drzwi wyjściowych exit (północ R3: X ∈ [-10, -6], Z ∈ [-37, -36]).
  deck(k, R(-10, -6, -37, -36), Y_G1, MAT_TILE, SLAB);

  // Podbudowa konstrukcyjna i kanały kablowe pod R3 i R8 (§3.3.A: Z ∈ [-36, -22], y = -0.60..+4.40 m).
  solid(k, R(-22, 22, -36, -22), -0.6, Y_G1 - SLAB, MAT_CONCRETE, {
    walkable: false,
  });

  // Galerie obwodowe Poziomu 1 (G1, y = +4.80 m, szer. 4.0 m) w Hali Reaktora R2:
  // Narożniki NW i NE używają modelu pomostu `fus_catwalk_deck` (4.0 × 0.4 × 4.0 m, walkable: true).
  prop(k, 'fus_catwalk_deck', -20, -20, Y_G1 - SLAB, 0, { walkable: true });
  prop(k, 'fus_catwalk_deck', 20, -20, Y_G1 - SLAB, 0, { walkable: true });
  deck(k, ROOMS.G1_N, Y_G1, MAT_GRATING, SLAB);
  deck(k, ROOMS.G1_W, Y_G1, MAT_GRATING, SLAB);
  deck(k, ROOMS.G1_E, Y_G1, MAT_GRATING, SLAB);
  deck(k, ROOMS.G1_SW, Y_G1, MAT_GRATING, SLAB);
  deck(k, ROOMS.G1_SE, Y_G1, MAT_GRATING, SLAB);

  // 3. Galerie Górne Poziomu 2 (G2, y = +9.60 m, płyta +9.20..+9.60 m, szer. 3.2 m) w Hali Reaktora R2:
  deck(k, ROOMS.G2_N, Y_G2, MAT_GRATING, SLAB);
  deck(k, ROOMS.G2_W, Y_G2, MAT_GRATING, SLAB);
  deck(k, ROOMS.G2_E, Y_G2, MAT_GRATING, SLAB);

  // 4. Trójwymiarowe stropy kasetonowe ukrywane w ujęciach audytu z góry (`ceiling: true` + `rainShelters`, nauczka #2 z run7):
  cofferedCeilingSlab(k, ROOMS.R1, Y_R1_CEIL, MAT_CEIL);
  cofferedCeilingSlab(
    k,
    R(-2.4, 2.4, 36, 37.2),
    Y_L0 + 3.6,
    MAT_CEIL,
    SLAB,
    Y_L0 - 0.5,
    false,
  );
  cofferedCeilingSlab(k, ROOMS.R2, Y_HALL_CEIL, MAT_CEIL);
  cofferedCeilingSlab(k, ROOMS.R3, Y_G1_CEIL, MAT_CEIL, SLAB, Y_G1 - 0.5);
  cofferedCeilingSlab(
    k,
    R(-10.4, -5.6, -37.2, -36),
    Y_G1 + 3.6,
    MAT_CEIL,
    SLAB,
    Y_G1 - 0.5,
    false,
  );
  cofferedCeilingSlab(k, ROOMS.R4, Y_R4_CEIL, MAT_CEIL);
  cofferedCeilingSlab(k, ROOMS.R5, Y_R5_CEIL, MAT_CEIL);
  cofferedCeilingSlab(k, ROOMS.R6, Y_R6_CEIL, MAT_CEIL);
  cofferedCeilingSlab(k, ROOMS.R7, Y_R7_CEIL, MAT_CEIL);
  cofferedCeilingSlab(k, ROOMS.R8, Y_G1_CEIL, MAT_CEIL, SLAB, Y_G1 - 0.5);

  // 5. Ściany zewnętrzne i działowe (§3.2–3.5 docs/maps/run8.md):
  // --- R1 Szatnia i Śluza Dekontaminacyjna (X ∈ [-12, 12], Z ∈ [22, 36], y = 0..4.8 m) ---
  segmentedWall(k, 'x', 36, -12, 12, Y_L0, Y_R1_CEIL, MAT_CONCRETE, [
    [-2, 2, Y_L0, Y_L0 + 3.2],
  ]);
  // Obudowa wnęki wejściowej entry.
  solid(k, R(-2.4, -2, 36, 37.2), Y_L0, Y_L0 + 3.6, MAT_CONCRETE, {
    walkable: false,
  });
  solid(k, R(2, 2.4, 36, 37.2), Y_L0, Y_L0 + 3.6, MAT_CONCRETE, {
    walkable: false,
  });
  solid(k, R(-2.4, 2.4, 37, 37.4), Y_L0, Y_L0 + 3.6, MAT_CONCRETE, {
    walkable: false,
  });
  segmentedWall(k, 'z', -12, 22, 36, Y_L0, Y_R1_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'z', 12, 22, 36, Y_L0, Y_R1_CEIL, MAT_CONCRETE);

  // Ściana południowa Hali Reaktora R2 (Z = +22, X ∈ [-22, 22]):
  // Boczne skrzydła ściany poza obrysem R1 (X ∈ [-22, -12] i [12, 22], y = 0..19.2 m):
  segmentedWall(k, 'x', 22, -22, -12, Y_L0, Y_HALL_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 22, 12, 22, Y_L0, Y_HALL_CEIL, MAT_CONCRETE);
  // Odcinek wspólny R1 <-> R2 (X ∈ [-12, 12]): 8-metrowy Portal Główny [-4, 4] z bezpośrednim widokiem na Tokamak
  // oraz dwie 3-metrowe śluzy boczne [-10, -7] i [7, 10].
  segmentedWall(k, 'x', 22, -12, 12, Y_L0, Y_R1_CEIL, MAT_CONCRETE, [
    [-10, -7, Y_L0, Y_L0 + 3.4],
    [-4, 4, Y_L0, Y_L0 + 3.8],
    [7, 10, Y_L0, Y_L0 + 3.4],
  ]);
  segmentedWall(k, 'x', 22, -12, 12, Y_R1_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // --- Ściana zachodnia Hali Reaktora R2 (X = -22, Z ∈ [-22, 22]) ---
  // Styk R2 <-> R4 (Z ∈ [-22, 0], y = 0..5.6 m): 2 portale [-16, -12] i [-5, -1] + okno badawcze [-11, -6].
  segmentedWall(k, 'z', -22, -22, 0, Y_L0, Y_R4_CEIL, MAT_CONCRETE, [
    [-16, -12, Y_L0, Y_L0 + 3.8],
    [-11, -6, Y_L0, Y_L0 + 4.4],
    [-5, -1, Y_L0, Y_L0 + 3.8],
  ]);
  blastDoorFrame(k, placer, -22, Y_L0, -14, 1);
  controlWindowWall(k, placer, -22, Y_L0, -8.5, 1);
  blastDoorFrame(k, placer, -22, Y_L0, -3, 1);
  segmentedWall(k, 'z', -22, -22, 0, Y_R4_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // Styk R2 <-> R5 (Z ∈ [0, 22], y = 0..7.2 m): 2 portale [3, 7] i [13, 17].
  segmentedWall(k, 'z', -22, 0, 22, Y_L0, Y_R5_CEIL, MAT_CONCRETE, [
    [3, 7, Y_L0, Y_L0 + 3.8],
    [13, 17, Y_L0, Y_L0 + 3.8],
  ]);
  blastDoorFrame(k, placer, -22, Y_L0, 5, 1);
  blastDoorFrame(k, placer, -22, Y_L0, 15, 1);
  segmentedWall(k, 'z', -22, 0, 22, Y_R5_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // --- Mury zewnętrzne i działowe skrzydła zachodniego (R4 i R5, X ∈ [-38, -22]) ---
  segmentedWall(k, 'x', -22, -38, -22, Y_L0, Y_R4_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'z', -38, -22, 0, Y_L0, Y_R4_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 0, -38, -22, Y_L0, Y_R4_CEIL, MAT_CONCRETE, [
    [-32, -28, Y_L0, Y_L0 + 3.8],
  ]);
  blastDoorFrame(k, placer, -30, Y_L0, 0, 0);
  segmentedWall(k, 'x', 0, -38, -22, Y_R4_CEIL, Y_R5_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'z', -38, 0, 22, Y_L0, Y_R5_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 22, -38, -22, Y_L0, Y_R5_CEIL, MAT_CONCRETE);

  // --- Ściana wschodnia Hali Reaktora R2 (X = +22, Z ∈ [-22, 22]) ---
  // Styk R2 <-> R7 (Z ∈ [-22, -4], y = 0..5.6 m): portal [-16, -12] + okno diagnostyczne [-10.5, -5.5].
  segmentedWall(k, 'z', 22, -22, -4, Y_L0, Y_R7_CEIL, MAT_SHIELD, [
    [-16, -12, Y_L0, Y_L0 + 3.8],
    [-10.5, -5.5, Y_L0, Y_L0 + 4.4],
  ]);
  blastDoorFrame(k, placer, 22, Y_L0, -14, -1);
  controlWindowWall(k, placer, 22, Y_L0, -8.0, -1);
  segmentedWall(k, 'z', 22, -22, -4, Y_R7_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // Styk R2 <-> R6 (Z ∈ [-4, 22], y = 0..8.0 m): 2 portale [1, 5] i [13, 17].
  segmentedWall(k, 'z', 22, -4, 22, Y_L0, Y_R6_CEIL, MAT_CONCRETE, [
    [1, 5, Y_L0, Y_L0 + 3.8],
    [13, 17, Y_L0, Y_L0 + 3.8],
  ]);
  blastDoorFrame(k, placer, 22, Y_L0, 3, -1);
  blastDoorFrame(k, placer, 22, Y_L0, 15, -1);
  segmentedWall(k, 'z', 22, -4, 22, Y_R6_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // --- Mury zewnętrzne i działowe skrzydła wschodniego (R6 i R7, X ∈ [22, 38]) ---
  segmentedWall(k, 'x', -22, 22, 38, Y_L0, Y_R7_CEIL, MAT_SHIELD);
  segmentedWall(k, 'z', 38, -22, -4, Y_L0, Y_R7_CEIL, MAT_SHIELD);
  segmentedWall(k, 'x', -4, 22, 38, Y_L0, Y_R7_CEIL, MAT_CONCRETE, [
    [28, 32, Y_L0, Y_L0 + 3.8],
  ]);
  blastDoorFrame(k, placer, 30, Y_L0, -4, 0);
  segmentedWall(k, 'x', -4, 22, 38, Y_R7_CEIL, Y_R6_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'z', 38, -4, 22, Y_L0, Y_R6_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 22, 22, 38, Y_L0, Y_R6_CEIL, MAT_CONCRETE);

  // --- Ściana północna Hali Reaktora R2 (Z = -22, X ∈ [-22, 22]) oraz R3 Sterownia i R8 Biuro na G1 ---
  // Dolna część pod Galerią Północną G1-N (y = 0.0..4.8 m):
  segmentedWall(k, 'x', -22, -22, 22, Y_L0, Y_G1, MAT_CONCRETE);

  // Poziom G1 (y = 4.8..9.6 m, styk G1-N <-> R3/R8):
  // - 2 portale do Sterowni R3: X ∈ [-20, -16] oraz X ∈ [1, 5],
  // - 15-metrowe Pancerne Okno Obserwacyjne Sterowni R3 na Tokamak: X ∈ [-15, 0] (3 × `fus_control_window_wall`),
  // - 5-metrowe Okno Obserwacyjne Biura Kierownika R8 na Tokamak: X ∈ [8, 13] (`fus_control_window_wall`),
  // - portal do Biura Kierownika R8: X ∈ [15, 19].
  segmentedWall(k, 'x', -22, -22, 22, Y_G1, Y_G1_CEIL, MAT_SHIELD, [
    [-20, -16, Y_G1, Y_G1 + 3.8],
    [-15, 0, Y_G1, Y_G1 + 4.4],
    [1, 5, Y_G1, Y_G1 + 3.8],
    [8, 13, Y_G1, Y_G1 + 4.4],
    [15, 19, Y_G1, Y_G1 + 3.8],
  ]);
  blastDoorFrame(k, placer, -18, Y_G1, -22, 0);
  controlWindowWall(k, placer, -12.5, Y_G1, -22, 0);
  controlWindowWall(k, placer, -7.5, Y_G1, -22, 0);
  controlWindowWall(k, placer, -2.5, Y_G1, -22, 0);
  blastDoorFrame(k, placer, 3, Y_G1, -22, 0);
  controlWindowWall(k, placer, 10.5, Y_G1, -22, 0);
  blastDoorFrame(k, placer, 17, Y_G1, -22, 0);

  // Górna część ściany północnej R2 powyżej R3/R8 i za Galerią Górną G2-N (y = 9.6..19.2 m):
  segmentedWall(k, 'x', -22, -22, 22, Y_G1_CEIL, Y_HALL_CEIL, MAT_CONCRETE);

  // --- Mury zewnętrzne i działowe Sterowni Głównej R3 i Biura Kierownika R8 (Z ∈ [-36, -22], y = 4.8..9.6 m) ---
  segmentedWall(k, 'x', -36, -22, 6, Y_G1, Y_G1_CEIL, MAT_SHIELD, [
    [-10, -6, Y_G1, Y_G1 + 3.2],
  ]);
  // Obudowa wnęki wyjściowej exit w Sterowni R3.
  solid(k, R(-10.4, -10, -37.2, -36), Y_G1, Y_G1 + 3.6, MAT_SHIELD, {
    walkable: false,
  });
  solid(k, R(-6, -5.6, -37.2, -36), Y_G1, Y_G1 + 3.6, MAT_SHIELD, {
    walkable: false,
  });
  solid(k, R(-10.4, -5.6, -37.4, -37), Y_G1, Y_G1 + 3.6, MAT_SHIELD, {
    walkable: false,
  });
  segmentedWall(k, 'x', -36, 6, 22, Y_G1, Y_G1_CEIL, MAT_SHIELD);
  segmentedWall(k, 'z', -22, -36, -22, Y_G1, Y_G1_CEIL, MAT_SHIELD);
  segmentedWall(k, 'z', 22, -36, -22, Y_G1, Y_G1_CEIL, MAT_SHIELD);

  // Ściana działowa R3 <-> R8 (X = +6, Z ∈ [-36, -22], y = 4.8..9.6 m):
  // Portal przejściowy Z ∈ [-31, -27] oraz wewnętrzne przeszklenie Z ∈ [-26, -23.5].
  segmentedWall(k, 'z', 6, -36, -22, Y_G1, Y_G1_CEIL, MAT_SHIELD, [
    [-31, -27, Y_G1, Y_G1 + 3.8],
    [-26, -23.5, Y_G1 + 1.05, Y_G1 + 3.6],
  ]);
  blastDoorFrame(k, placer, 6, Y_G1, -29, 1);
  solid(k, R(5.92, 6.08, -26, -23.5), Y_G1 + 1.05, Y_G1 + 3.6, MAT_GLASS, {
    walkable: false,
  });
}

// --- Komunikacja pionowa: 6 biegów ramp stalowych (25.64° <= 26.6°, szer. 2.8–3.2 m >= 2.0 m) ---

function circulation(k, placer) {
  // 1. Rampa #1 (SW L0 <-> G1-SW): X: -6.0 -> -16.0, Z ∈ [+18.4, +21.6], y: 0.0 -> +4.8 m (szer. 3.2 m).
  rampFlightWithRails(
    k,
    'x',
    20.0,
    3.2,
    Y_L0,
    -6.0,
    Y_G1,
    -16.0,
    'neon_amber',
    [-1],
  );
  placer.reserve(R(-16.2, -5.8, 18.2, 21.8), Y_L0);
  placer.reserve(R(-16.4, -15.6, 18.2, 21.8), Y_G1);

  // 2. Rampa #2 (SE L0 <-> G1-SE): X: +6.0 -> +16.0, Z ∈ [+18.4, +21.6], y: 0.0 -> +4.8 m (szer. 3.2 m).
  rampFlightWithRails(
    k,
    'x',
    20.0,
    3.2,
    Y_L0,
    6.0,
    Y_G1,
    16.0,
    'neon_amber',
    [-1],
  );
  placer.reserve(R(5.8, 16.2, 18.2, 21.8), Y_L0);
  placer.reserve(R(15.6, 16.4, 18.2, 21.8), Y_G1);

  // 3. Rampa #3 (NW L0 <-> G1-N): X ∈ [-17.6, -14.8], Z: -8.0 -> -18.0, y: 0.0 -> +4.8 m (szer. 2.8 m).
  rampFlightWithRails(
    k,
    'z',
    -16.2,
    2.8,
    Y_L0,
    -8.0,
    Y_G1,
    -18.0,
    'neon_amber',
    [-1, 1],
  );
  placer.reserve(R(-17.8, -14.6, -18.2, -7.8), Y_L0);
  placer.reserve(R(-17.8, -14.6, -18.4, -17.6), Y_G1);

  // 4. Rampa #4 (NE L0 <-> G1-N): X ∈ [+14.8, +17.6], Z: -8.0 -> -18.0, y: 0.0 -> +4.8 m (szer. 2.8 m).
  rampFlightWithRails(
    k,
    'z',
    16.2,
    2.8,
    Y_L0,
    -8.0,
    Y_G1,
    -18.0,
    'neon_amber',
    [-1, 1],
  );
  placer.reserve(R(14.6, 17.8, -18.2, -7.8), Y_L0);
  placer.reserve(R(14.6, 17.8, -18.4, -17.6), Y_G1);

  // 5. Rampa #5 (Zachodnia Górna G1-SW <-> G2-W): X ∈ [-21.8, -19.0], Z: +16.0 -> +6.0, y: +4.8 -> +9.6 m (szer. 2.8 m).
  rampFlightWithRails(
    k,
    'z',
    -20.4,
    2.8,
    Y_G1,
    16.0,
    Y_G2,
    6.0,
    'neon_amber',
    [1],
  );
  placer.reserve(R(-21.8, -18.8, 15.6, 16.4), Y_G1);
  placer.reserve(R(-21.8, -18.8, 5.6, 6.4), Y_G2);

  // 6. Rampa #6 (Wschodnia Górna G1-SE <-> G2-E): X ∈ [+19.0, +21.8], Z: +16.0 -> +6.0, y: +4.8 -> +9.6 m (szer. 2.8 m).
  rampFlightWithRails(
    k,
    'z',
    20.4,
    2.8,
    Y_G1,
    16.0,
    Y_G2,
    6.0,
    'neon_amber',
    [-1],
  );
  placer.reserve(R(18.8, 21.8, 15.6, 16.4), Y_G1);
  placer.reserve(R(18.8, 21.8, 5.6, 6.4), Y_G2);
}

// --- Przemysłowe barierki galerii `fus_catwalk_railing` wokół G1 (y = +4.8 m) i G2 (y = +9.6 m) ---

function rails(k) {
  // 1. Poziom Galerii 1 (G1, y = +4.80 m):
  // Południowa krawędź Galerii Północnej G1-N (Z = -18.09, między Rampą #3 X ∈ [-17.8, -14.6] a Rampą #4 X ∈ [14.6, 17.8]).
  catwalkRailing(k, 'x', -18.09, -14.5, 14.5, Y_G1);

  // Wewnętrzne krawędzie Galerii Zachodniej G1-W (X = -18.09) i Wschodniej G1-E (X = +18.09) na Z ∈ [-18, +6].
  catwalkRailing(k, 'z', -18.09, -18.0, 5.8, Y_G1);
  catwalkRailing(k, 'z', 18.09, -18.0, 5.8, Y_G1);
  // Poprzeczne barierki zamykające południowy koniec G1-W i G1-E przed szybem Ramp #5 i #6 (Z = +5.91).
  catwalkRailing(k, 'x', 5.91, -21.8, -18.1, Y_G1);
  catwalkRailing(k, 'x', 5.91, 18.1, 21.8, Y_G1);

  // Barierki spoczników południowych G1-SW i G1-SE (y = +4.80 m, poza wejściami z Ramp #1/#2 i na Rampy #5/#6).
  catwalkRailing(k, 'z', -16.09, 16.0, 18.2, Y_G1);
  catwalkRailing(k, 'x', 16.09, -18.8, -16.1, Y_G1);
  catwalkRailing(k, 'z', 16.09, 16.0, 18.2, Y_G1);
  catwalkRailing(k, 'x', 16.09, 16.1, 18.8, Y_G1);

  // 2. Poziom Galerii 2 (G2, y = +9.60 m):
  // Południowa krawędź Galerii Górnej Północnej G2-N (Z = -18.89, X ∈ [-18.8, +18.8]).
  catwalkRailing(k, 'x', -18.89, -18.8, 18.8, Y_G2);
  // Wewnętrzne krawędzie Galerii Górnej Zachodniej G2-W (X = -18.89) i Wschodniej G2-E (X = +18.89) na Z ∈ [-18.8, +5.8].
  catwalkRailing(k, 'z', -18.89, -18.8, 5.8, Y_G2);
  catwalkRailing(k, 'z', 18.89, -18.8, 5.8, Y_G2);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run8',
    name: 'Elektrownia Fuzyjna Kurogane Arms — Kompleks Helios-IV',
    weather: 'kuroganeFusionPlant',
    theme: 'kuroganeFusion',
    bounds: R(-38, 38, -37, 37),
    startX: 0,
    exitX: -8,
  });
  k.arena.arenaMeta({
    batchCellM: 24,
    navigationCellM: 0.5,
    navigationClearanceM: 0.4,
    navigationMaxRiseM: 0.55,
    navigationHeadroomM: 2.2,
  });
  const placer = createPlacer(k);
  structure(k, placer);
  circulation(k, placer);
  rails(k);
  buildRooms(k, placer);
  dress(k, placer);

  k.setPieces.push(...SET_PIECES);
  k.civilians.push(...CIVILIANS);
  k.hideSpots.push(...HIDE_SPOTS);

  // Punkt startu gracza w R1 Szatni-Dekontaminacji (0, 0, 31) na osi widoku przez portal na Tokamak w R2,
  // drzwi entry (0, 1.5, 36.5) oraz drzwi exit w Sterowni Głównej R3 (-8, 6.3, -36.5).
  k.arena.roomMeta({
    playerSpawn: vec(0, Y_L0, 31),
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(0, Y_L0 + 1.5, 36.5),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(-8, Y_G1 + 1.5, -36.5),
        size: vec(4, 3, 1),
      },
    ],
  });

  for (const [x, y, z] of SPAWNS) {
    if (!placer.free(x, z, y, 0.9))
      throw new Error(`Spawn (${x}, ${y}, ${z}) leży zbyt blisko rekwizytu.`);
    k.arena.floorSpawn(vec(x, y, z));
  }

  for (const c of CIVILIANS) {
    const { x, y, z } = c.position;
    if (!placer.free(x, z, y, 0.6))
      throw new Error(
        `Naukowiec (${x}, ${y}, ${z}) leży zbyt blisko rekwizytu.`,
      );
  }

  for (const h of HIDE_SPOTS) {
    if (!placer.free(h.x, h.z, h.y, 0.5))
      throw new Error(
        `Kryjówka (${h.x}, ${h.y}, ${h.z}) leży zbyt blisko rekwizytu.`,
      );
  }

  k.finish({
    points: [
      ['A', 0, Y_L0, 14],
      ['B', 0, Y_L0, -14],
      ['C', -8, Y_G1, -29],
    ],
    zones: [
      [
        'Poziom Główny — Hala Reaktora, Lab Plazmy, Magazyn Paliwa i Turbiny',
        R(-38, 38, -22, 36),
        'open',
      ],
      [
        'Poziom Galerii G1 — Pomosty Techniczne, Sterownia Główna i Biuro Kierownika',
        R(-22, 22, -36, 22),
        'high',
      ],
      [
        'Poziom Galerii Górnej G2 — Pomosty Korony Tokamaka',
        R(-22, 22, -22, 6),
        'high',
      ],
    ],
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 30 },
  });
  k.arena.arenaMeta({
    batchCellM: 24,
    navigationCellM: 0.5,
    navigationClearanceM: 0.4,
    navigationMaxRiseM: 0.55,
    navigationHeadroomM: 2.2,
  });
  return k.arena;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  generate().write(
    fileURLToPath(
      new URL('../../../src/data/rooms/run8.json', import.meta.url),
    ),
  );
