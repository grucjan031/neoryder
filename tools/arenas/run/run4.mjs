// Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62 (run4):
// 10 pomieszczeń + Trzykondygnacyjne Atrium na 3 piętrach (L0 y = 0.0 m, L1 y = 4.8 m, L2 y = 9.6 m)
// z działającą windą panoramiczną `elevators[0]`, 4 dwubiegowymi klatkami schodowymi i widokiem 360° na miasto.
// Projekt: docs/maps/run4.md. Generator jest w pełni deterministyczny.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom } from './_runKit.mjs';
import { buildRooms } from './_run4Rooms.mjs';
import { SPAWNS, dress } from './_run4Dress.mjs';
import {
  MAT_CARPET,
  MAT_CEIL,
  MAT_CLEAN,
  MAT_GRANITE,
  MAT_INLAY,
  MAT_WOOD_SLAT,
  R,
  ROOMS,
  Y_ATRIUM_CEIL,
  Y_L0,
  Y_L0_CEIL,
  Y_L1,
  Y_L1_CEIL,
  Y_L2,
  Y_L2_CEIL,
  Y_M01,
  Y_M12,
  Y_R10_CEIL,
  atriumGlassRail,
  ceilingSlab,
  createPlacer,
  deck,
  glassFacade,
  glassPartitionDoor,
  glassPartitionWall,
  segmentedWall,
  solid,
  spans,
  stairFlightWithRails,
  vec,
} from './_run4Kit.mjs';

// --- Konstrukcja: płyty 3 kondygnacji, stropy (ceiling: true + rainShelters), szklane fasady i ściany ---

function structure(k, placer) {
  // 1. Piętro 60 (L0, y = 0.00 m, płyta -1.00..0.00 m).
  deck(k, ROOMS.R1, Y_L0, MAT_GRANITE, 1);
  deck(k, ROOMS.R2, Y_L0, MAT_CARPET, 1);
  deck(k, ROOMS.R3, Y_L0, MAT_GRANITE, 1);
  // Wnęka drzwi wejściowych entry (południe R1: X ∈ [-2, 2], Z ∈ [30, 31]).
  deck(k, R(-2, 2, 30, 31), Y_L0, MAT_GRANITE, 1);
  // Posadzka Atrium A0 (X ∈ [-10, 10], Z ∈ [-16, 10]) wycięta wokół szybu windy X ∈ [-1.6, 1.6], Z ∈ [-15.6, -12.4].
  deck(k, R(-10, 10, -12.4, 10), Y_L0, MAT_GRANITE, 1);
  deck(k, R(-10, -1.6, -16, -12.4), Y_L0, MAT_GRANITE, 1);
  deck(k, R(1.6, 10, -16, -12.4), Y_L0, MAT_GRANITE, 1);
  deck(k, R(-1.6, 1.6, -16, -15.6), Y_L0, MAT_GRANITE, 1);

  // 2. Piętro 61 (L1, y = 4.80 m, płyta 4.40..4.80 m).
  deck(k, ROOMS.R4, Y_L1, MAT_CARPET);
  // W R5 wycinamy wnękę X ∈ [10, 14], Z ∈ [7, 8] na górny próg Klatki Schodowej #2 (Z = 7.0).
  deck(k, R(10, 30, -12, 7), Y_L1, MAT_CARPET);
  deck(k, R(14, 30, 7, 8), Y_L1, MAT_CARPET);
  deck(k, ROOMS.R6, Y_L1, MAT_GRANITE);
  deck(k, ROOMS.R7, Y_L1, MAT_INLAY);

  // Galerie i mostki Atrium A0 na Piętrze 61 (y = 4.80 m):
  // Południowy Mostek L1 (Z ∈ [5, 8]) oraz Galeria Zachodnia i Wschodnia (Z ∈ [-3, 5], poza rzutem Klatek #3 i #4!).
  deck(k, R(-10, 10, 5, 8), Y_L1, MAT_GRANITE);
  deck(k, R(-10, -6.4, -3, 5), Y_L1, MAT_GRANITE);
  deck(k, R(6.4, 10, -3, 5), Y_L1, MAT_GRANITE);
  // Wschodni Pomost Komunikacyjny L1 (X ∈ [2.4, 5.6], Z ∈ [-8, 5]) łączący Mostek Windy L1 z Południowym Mostkiem i R5.
  deck(k, R(2.4, 5.6, -8, 5), Y_L1, MAT_GRANITE);
  deck(k, R(5.6, 6.4, -3, 5), Y_L1, MAT_GRANITE);
  // Północny Mostek Windy L1 (X ∈ [-5.6, 5.6], Z ∈ [-12.4, -8.0]) — odsunięty o 0.8 m od Klatek #3 i #4 (|X| >= 6.4).
  deck(k, R(-5.6, 5.6, -12.4, -8), Y_L1, MAT_GRANITE);
  // Boczne obejścia szybu windy (Z ∈ [-16, -12.4]) i Północna Galeria L1 (Z ∈ [-24, -16], pod stropem L2 y = 9.2 m).
  deck(k, R(-5.6, -1.6, -16, -12.4), Y_L1, MAT_GRANITE);
  deck(k, R(1.6, 5.6, -16, -12.4), Y_L1, MAT_GRANITE);
  deck(k, R(-10, 10, -24, -16), Y_L1, MAT_GRANITE);

  // 3. Piętro 62 (L2, y = 9.60 m, płyta 9.20..9.60 m).
  deck(k, ROOMS.R8, Y_L2, MAT_CARPET);
  deck(k, ROOMS.R9_FOYER, Y_L2, MAT_GRANITE);
  deck(k, ROOMS.R9_EAST, Y_L2, MAT_CARPET);
  // Podest Przystanku #2 windy (doorSide: "N", z = -15.6) łączący północny próg szybu z Foyer Zarządu R9.
  deck(k, R(-1.6, 1.6, -16, -15.6), Y_L2, MAT_GRANITE);
  deck(k, ROOMS.R10, Y_L2, MAT_GRANITE);
  // Wnęka drzwi wyjściowych exit (północ R10: X ∈ [-2, 2], Z ∈ [-43, -42]).
  deck(k, R(-2, 2, -43, -42), Y_L2, MAT_GRANITE);

  // 4. Stropy ukrywane w ujęciach audytu z góry (`ceiling: true`) + szczelne `rainShelters` nad całym wnętrzem.
  // Taras południowy Piętra 60 (Z ∈ [8, 30], z wycięciem X ∈ [10, 14], Z ∈ [8, 20.4] nad Klatką Schodową #2).
  ceilingSlab(k, R(-30, 10, 8, 30), Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, R(14, 30, 8, 30), Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, R(10, 14, 20.4, 30), Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, R(10, 14, 8, 20.4), Y_L1_CEIL, MAT_CEIL);
  ceilingSlab(k, R(-2.4, 2.4, 30, 31.2), 3.6, MAT_CLEAN);

  // Strop nad Piętrem 61 (Z ∈ [-16, 8] dla skrzydeł bocznych oraz pasy zewnętrzne X ∈ [-30,-24] i [24,30] na Z ∈ [-24,-16]).
  ceilingSlab(k, R(-30, -10, -16, 8), Y_L1_CEIL, MAT_CEIL);
  ceilingSlab(k, R(10, 30, -16, 8), Y_L1_CEIL, MAT_CEIL);
  ceilingSlab(k, R(-30, -24, -24, -16), Y_L1_CEIL, MAT_CEIL);
  ceilingSlab(k, R(24, 30, -24, -16), Y_L1_CEIL, MAT_CEIL);

  // Strop nad Centralnym Atrium A0 (y = 15.20 m) oraz Piętrem 62 (R8/R9 y = 14.40 m, R10 y = 14.80 m).
  ceilingSlab(k, R(-10, 10, -16, 8), Y_ATRIUM_CEIL, MAT_CEIL);
  ceilingSlab(k, R(-24, 24, -28, -16), Y_L2_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R10, Y_R10_CEIL, MAT_CEIL);
  ceilingSlab(k, R(-2.4, 2.4, -43.2, -42), Y_L2 + 3.6, MAT_CLEAN);

  // 5. Zewnętrzne szklane fasady kurtynowe 360° (`mat_glass_clear` + `off_facade_mullion`) i ściany działowe:
  // --- POZIOM L0 (y = 0.00..4.80 m) ---
  glassFacade(k, 'x', 30, -30, -10, Y_L0, Y_L0_CEIL, 1);
  glassFacade(k, 'x', 30, 10, 30, Y_L0, Y_L0_CEIL, 1);
  glassFacade(k, 'x', 30, -10, 10, Y_L0, Y_L0_CEIL, 1, [[-2, 2, Y_L0, 3.2]]);
  // Obudowa wnęki wejściowej entry.
  solid(k, R(-2.4, -2, 30, 31.2), Y_L0, 3.6, MAT_WOOD_SLAT, { walkable: false });
  solid(k, R(2, 2.4, 30, 31.2), Y_L0, 3.6, MAT_WOOD_SLAT, { walkable: false });
  solid(k, R(-2.4, 2.4, 31, 31.4), Y_L0, 3.6, MAT_WOOD_SLAT, { walkable: false });

  glassFacade(k, 'z', -30, -2, 30, Y_L0, Y_L0_CEIL, -1);
  glassFacade(k, 'z', 30, -2, 30, Y_L0, Y_L0_CEIL, 1);
  glassFacade(k, 'x', -2, -30, -10, Y_L0, Y_L0_CEIL, -1);
  glassFacade(k, 'x', -2, 10, 30, Y_L0, Y_L0_CEIL, -1);
  glassFacade(k, 'z', -10, -16, -2, Y_L0, Y_L0_CEIL, -1);
  glassFacade(k, 'z', 10, -16, -2, Y_L0, Y_L0_CEIL, 1);
  glassFacade(k, 'x', -16, -10, 10, Y_L0, Y_L0_CEIL, -1);

  // Portal główny z Recepcji R1 do Atrium A0 (Z = 10, szerokość 12 m: X ∈ [-6, 6]).
  segmentedWall(k, 'x', 10, -10, 10, Y_L0, Y_L0_CEIL, MAT_WOOD_SLAT, [
    [-6, 6, Y_L0, 4.0],
  ]);
  // Ściana R2 <-> R1/A0 (X = -10, bramy Z ∈ [-1, 3] i Z ∈ [18, 22]).
  segmentedWall(k, 'z', -10, -2, 30, Y_L0, Y_L0_CEIL, MAT_WOOD_SLAT, [
    [-1, 3, Y_L0, 3.6],
    [18, 22, Y_L0, 3.6],
  ]);
  glassPartitionDoor(k, placer, -10, Y_L0, 1, 1);
  glassPartitionDoor(k, placer, -10, Y_L0, 20, 1);
  // Ściana R3 <-> R1/A0 (X = +10, bramy Z ∈ [-1, 3] i Z ∈ [22, 26] — poza Klatką #2 Z <= 20!).
  segmentedWall(k, 'z', 10, -2, 30, Y_L0, Y_L0_CEIL, MAT_WOOD_SLAT, [
    [-1, 3, Y_L0, 3.6],
    [22, 26, Y_L0, 3.6],
  ]);
  glassPartitionDoor(k, placer, 10, Y_L0, 1, 1);
  glassPartitionDoor(k, placer, 10, Y_L0, 24, 1);

  // --- POZIOM L1 (y = 4.80..9.60 m) ---
  glassFacade(k, 'x', 8, -30, -10, Y_L1, Y_L1_CEIL, 1);
  glassFacade(k, 'x', 8, -10, 10, Y_L1, Y_ATRIUM_CEIL, 1);
  glassFacade(k, 'x', 8, 14, 30, Y_L1, Y_L1_CEIL, 1);
  // Obudowa szybu Klatki Schodowej #2 ponad dachem L0 (X ∈ [10, 14], Z ∈ [8, 20.4], y = 4.8..9.6 m).
  glassFacade(k, 'z', 10, 8, 20.4, Y_L1, Y_L1_CEIL, -1);
  glassFacade(k, 'z', 14, 8, 20.4, Y_L1, Y_L1_CEIL, 1);
  glassFacade(k, 'x', 20.4, 10, 14, Y_L1, Y_L1_CEIL, 1);

  glassFacade(k, 'z', -30, -24, 8, Y_L1, Y_L1_CEIL, -1);
  glassFacade(k, 'z', 30, -24, 8, Y_L1, Y_L1_CEIL, 1);
  glassFacade(k, 'x', -24, -30, 30, Y_L1, Y_L1_CEIL, -1);

  // Przeszklone ścianki działowe Sal Konferencyjnych R4 i R5 od strony Atrium (X = ±10, Z ∈ [-12, 8]):
  // 4 pełne moduły `off_glass_partition_wall` (Z = -10, -6, -2, +6) + drzwi `off_glass_partition_door` (Z = +2).
  for (const sx of [-1, 1]) {
    const x = sx * 10;
    glassPartitionWall(k, placer, x, Y_L1, -10, 1);
    glassPartitionWall(k, placer, x, Y_L1, -6, 1);
    glassPartitionWall(k, placer, x, Y_L1, -2, 1);
    glassPartitionDoor(k, placer, x, Y_L1, 2, 1);
    glassPartitionWall(k, placer, x, Y_L1, 6, 1);
    solid(k, R(x - 0.18, x + 0.18, -12, 8), Y_L1 + 3.6, Y_L1_CEIL, MAT_WOOD_SLAT, {
      walkable: false,
    });
  }

  // Ściany działowe R4/R6 i R5/R7 (Z = -12) oraz R6/A0 i R7/A0 (X = ±10, Z ∈ [-24, -12]).
  segmentedWall(k, 'x', -12, -30, -10, Y_L1, Y_L1_CEIL, MAT_WOOD_SLAT, [
    [-22, -18, Y_L1, Y_L1 + 3.6],
  ]);
  glassPartitionDoor(k, placer, -20, Y_L1, -12, 0);
  segmentedWall(k, 'x', -12, 10, 30, Y_L1, Y_L1_CEIL, MAT_WOOD_SLAT, [
    [18, 22, Y_L1, Y_L1 + 3.6],
  ]);
  glassPartitionDoor(k, placer, 20, Y_L1, -12, 0);

  segmentedWall(k, 'z', -10, -24, -12, Y_L1, Y_L1_CEIL, MAT_WOOD_SLAT, [
    [-21, -17, Y_L1, Y_L1 + 3.6],
  ]);
  glassPartitionDoor(k, placer, -10, Y_L1, -19, 1);
  segmentedWall(k, 'z', 10, -24, -12, Y_L1, Y_L1_CEIL, MAT_WOOD_SLAT, [
    [-21, -17, Y_L1, Y_L1 + 3.6],
  ]);
  glassPartitionDoor(k, placer, 10, Y_L1, -19, 1);

  // --- POZIOM L2 (y = 9.60..14.80 m) oraz Górne Atrium (y = 9.60..15.20 m) ---
  glassFacade(k, 'z', -10, -16, 8, Y_L2, Y_ATRIUM_CEIL, -1);
  glassFacade(k, 'z', 10, -16, 8, Y_L2, Y_ATRIUM_CEIL, 1);
  glassFacade(k, 'x', -16, -10, 10, Y_L2 + 3.6, Y_ATRIUM_CEIL, -1);

  glassFacade(k, 'x', -16, -24, -10, Y_L2, Y_L2_CEIL, 1);
  glassFacade(k, 'x', -16, 10, 24, Y_L2, Y_L2_CEIL, 1);
  glassFacade(k, 'z', -24, -28, -16, Y_L2, Y_L2_CEIL, -1);
  glassFacade(k, 'z', 24, -28, -16, Y_L2, Y_L2_CEIL, 1);
  glassFacade(k, 'z', -24, -42, -28, Y_L2, Y_R10_CEIL, -1);
  glassFacade(k, 'z', 24, -42, -28, Y_L2, Y_R10_CEIL, 1);
  glassFacade(k, 'x', -42, -24, 24, Y_L2, Y_R10_CEIL, -1, [
    [-2, 2, Y_L2, Y_L2 + 3.2],
  ]);
  // Obudowa wnęki wyjściowej exit na Piętrze 62.
  solid(k, R(-2.4, -2, -43.2, -42), Y_L2, Y_L2 + 3.6, MAT_WOOD_SLAT, {
    walkable: false,
  });
  solid(k, R(2, 2.4, -43.2, -42), Y_L2, Y_L2 + 3.6, MAT_WOOD_SLAT, {
    walkable: false,
  });
  solid(k, R(-2.4, 2.4, -43.4, -43), Y_L2, Y_L2 + 3.6, MAT_WOOD_SLAT, {
    walkable: false,
  });

  // Przeszklone ścianki działowe między Foyer Zarządu a Gabinetami R8 i R9-E (X = ±10, Z ∈ [-28, -16]).
  for (const sx of [-1, 1]) {
    const x = sx * 10;
    glassPartitionWall(k, placer, x, Y_L2, -26, 1);
    glassPartitionDoor(k, placer, x, Y_L2, -22, 1);
    glassPartitionWall(k, placer, x, Y_L2, -18, 1);
    solid(k, R(x - 0.18, x + 0.18, -28, -16), Y_L2 + 3.6, Y_L2_CEIL, MAT_WOOD_SLAT, {
      walkable: false,
    });
  }

  // Reprezentacyjna ściana Gabinetu Zarządu R10 (Z = -28, X ∈ [-24, 24]) z 3 portalami.
  segmentedWall(k, 'x', -28, -24, 24, Y_L2, Y_R10_CEIL, MAT_WOOD_SLAT, [
    [-18, -14, Y_L2, Y_L2 + 3.6],
    [-3, 3, Y_L2, Y_L2 + 3.6],
    [14, 18, Y_L2, Y_L2 + 3.6],
  ]);
  glassPartitionDoor(k, placer, -16, Y_L2, -28, 0);
  glassPartitionDoor(k, placer, 16, Y_L2, -28, 0);
}

// --- Komunikacja pionowa: 4 dwubiegowe klatki schodowe (25.64° <= 26.6°, szer. 3.2 m >= 2.0 m) ---

function circulation(k, placer) {
  // 1. Klatka #1: Schody Główne Atrium Zachód (L0 <-> L1, w otworze Atrium X ∈ [-5.6, -2.4], Z: +5.0 -> -8.0).
  // Całkowicie wewnątrz pustki OTWÓR ATRIUM (brak płyty L1 nad biegami!), łączą L0 bezpośrednio z Mostkiem Windy L1.
  stairFlightWithRails(k, -4.0, 3.2, Y_L0, 5.0, Y_M01, 0.0, 'neon_amber');
  deck(k, R(-5.6, -2.4, -3.0, 0.0), Y_M01, MAT_GRANITE);
  stairFlightWithRails(k, -4.0, 3.2, Y_M01, -3.0, Y_L1, -8.0, 'neon_amber');
  placer.reserve(R(-5.8, -2.2, 2.0, 5.4), Y_L0);
  placer.reserve(R(-5.8, -2.2, -3.2, 0.2), Y_M01);

  // 2. Klatka #2: Schody Panoramowe Wschód w R3 (L0 <-> L1, X ∈ [10.4, 13.6], Z: +20.0 -> +7.0).
  stairFlightWithRails(k, 12.0, 3.2, Y_L0, 20.0, Y_M01, 15.0, 'neon_blue');
  deck(k, R(10.4, 13.6, 12.0, 15.0), Y_M01, MAT_GRANITE);
  stairFlightWithRails(k, 12.0, 3.2, Y_M01, 12.0, Y_L1, 7.0, 'neon_blue');
  placer.reserve(R(10.2, 13.8, 14.8, 20.4), Y_L0);
  placer.reserve(R(10.2, 13.8, 11.8, 15.2), Y_M01);
  placer.reserve(R(10.2, 13.8, 6.6, 8.2), Y_L1);

  // 3. Klatka #3: Schody Główne Atrium Wschód (L1 <-> L2, X ∈ [6.4, 9.6], Z: -3.0 -> -16.0).
  // Na zewnętrznej wschodniej krawędzi Atrium, poza rzutem Mostka Windy L1 (X ∈ [-5.6, 5.6]) — brak podłogi L1 pod biegami!
  stairFlightWithRails(k, 8.0, 3.2, Y_L1, -3.0, Y_M12, -8.0, 'neon_violet');
  deck(k, R(6.4, 9.6, -11.0, -8.0), Y_M12, MAT_GRANITE);
  stairFlightWithRails(k, 8.0, 3.2, Y_M12, -11.0, Y_L2, -16.0, 'neon_violet');
  placer.reserve(R(6.2, 9.8, -3.4, -2.6), Y_L1);
  placer.reserve(R(6.2, 9.8, -11.2, -7.8), Y_M12);
  placer.reserve(R(6.2, 9.8, -16.6, -15.8), Y_L2);

  // 4. Klatka #4: Schody Górne Atrium Zachód (L1 <-> L2, X ∈ [-9.6, -6.4], Z: -3.0 -> -16.0).
  // Symetrycznie na zewnętrznej zachodniej krawędzi Atrium, poza rzutem Mostka Windy L1 (X ∈ [-5.6, 5.6])!
  stairFlightWithRails(k, -8.0, 3.2, Y_L1, -3.0, Y_M12, -8.0, 'neon_amber');
  deck(k, R(-9.6, -6.4, -11.0, -8.0), Y_M12, MAT_GRANITE);
  stairFlightWithRails(k, -8.0, 3.2, Y_M12, -11.0, Y_L2, -16.0, 'neon_amber');
  placer.reserve(R(-9.8, -6.2, -3.4, -2.6), Y_L1);
  placer.reserve(R(-9.8, -6.2, -11.2, -7.8), Y_M12);
  placer.reserve(R(-9.8, -6.2, -16.6, -15.8), Y_L2);
}

// --- Szklane balustrady `off_atrium_glass_rail` wokół pustki Atrium i spoczników schodów ----------

function rails(k) {
  // Południowy Mostek L1: krawędź północna (Z = 5.07) z przerwą na Wschodni Pomost L1 [2.4, 6.4].
  for (const [s0, s1] of spans(-6.4, 6.4, [[2.4, 6.4]]))
    atriumGlassRail(k, 'x', 5.07, s0, s1, Y_L1);

  // Galeria Zachodnia L1 (X = -6.47, Z ∈ [-2.8, 5.0]) oraz Wschodni Pomost L1 (X = 2.47, Z ∈ [-8.0, 5.0]).
  atriumGlassRail(k, 'z', -6.47, -2.8, 5.0, Y_L1);
  atriumGlassRail(k, 'z', 2.47, -7.9, 5.0, Y_L1);
  atriumGlassRail(k, 'z', 5.53, -7.9, -3.0, Y_L1);

  // Północny Mostek Windy L1: krawędź południowa (Z = -8.07) z przerwami na Klatkę #1 [-5.6, -2.4] i Pomost E [2.4, 5.6].
  for (const [s0, s1] of spans(-5.6, 5.6, [
    [-5.6, -2.4],
    [2.4, 5.6],
  ]))
    atriumGlassRail(k, 'x', -8.07, s0, s1, Y_L1);
  // Boczne krawędzie Mostka Windy i obejść szybu windy na L1 (X = ±5.53, Z ∈ [-16.0, -8.0]).
  atriumGlassRail(k, 'z', -5.53, -15.9, -8.1, Y_L1);
  atriumGlassRail(k, 'z', 5.53, -15.9, -8.1, Y_L1);

  // Krawędź południowa Północnej Galerii L1 (Z = -16.07) po bokach obejść szybu windy.
  atriumGlassRail(k, 'x', -16.07, -9.8, -5.6, Y_L1);
  atriumGlassRail(k, 'x', -16.07, 5.6, 9.8, Y_L1);

  // Krawędź południowa Foyer Zarządu L2 nad pustką Atrium (Z = -16.07), między Klatką #4, szybem windy i Klatką #3.
  atriumGlassRail(k, 'x', -16.07, -6.3, -1.9, Y_L2);
  atriumGlassRail(k, 'x', -16.07, 1.9, 6.3, Y_L2);

  // Balustrady spoczników pośrednich M01 (y = 2.4 m) i M12 (y = 7.2 m).
  atriumGlassRail(k, 'z', -5.53, -2.9, -0.1, Y_M01);
  atriumGlassRail(k, 'z', -2.47, -2.9, -0.1, Y_M01);
  atriumGlassRail(k, 'z', 13.53, 12.1, 14.9, Y_M01);
  atriumGlassRail(k, 'z', 6.47, -10.9, -8.1, Y_M12);
  atriumGlassRail(k, 'z', -6.47, -10.9, -8.1, Y_M12);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run4',
    name: 'Wieżowiec Korporacyjny Kurogane Arms — Piętra 60–62',
    weather: 'kuroganeOfficeTower',
    bounds: R(-30, 30, -43, 31),
    startX: 0,
    exitX: 0,
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

  // Działająca winda panoramiczna w szybie Atrium (§3.4A) + obniżona panorama miasta 60. piętra (180 m).
  k.arena.roomMeta({
    panoramaDropM: 180,
    playerSpawn: vec(0, Y_L0, 26),
    elevators: [
      {
        id: 'atrium-main-lift',
        x: 0,
        z: -14,
        width: 3.2,
        depth: 3.2,
        startStop: 0,
        model: 'off_elevator_cab',
        stops: [
          { y: Y_L0, doorSide: 's' },
          { y: Y_L1, doorSide: 's' },
          { y: Y_L2, doorSide: 'n' },
        ],
      },
    ],
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(0, Y_L0 + 1.5, 30.5),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(0, Y_L2 + 1.5, -42.5),
        size: vec(4, 3, 1),
      },
    ],
  });

  for (const [x, y, z] of SPAWNS) {
    if (!placer.free(x, z, y, 0.9))
      throw new Error(`Spawn (${x}, ${y}, ${z}) leży zbyt blisko rekwizytu.`);
    k.arena.floorSpawn(vec(x, y, z));
  }

  k.finish({
    points: [
      ['A', 0, Y_L0, 2],
      ['B', 0, Y_L1, -10],
      ['C', 0, Y_L2, -35],
    ],
    zones: [
      ['Piętro 60 — Lobby i Openspace', R(-30, 30, -16, 30), 'interior'],
      ['Piętro 61 — Centrum Konferencyjne i IT', R(-30, 30, -24, 8), 'high'],
      ['Piętro 62 — Gabinet Zarządu Kurogane Arms', R(-24, 24, -42, -16), 'open'],
    ],
    maxAlive: 10,
    minSpawnDistance: 10,
    spawnRing: { minM: 10, maxM: 28 },
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
      new URL('../../../src/data/rooms/run4.json', import.meta.url),
    ),
  );
