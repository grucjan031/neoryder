// Rezydencja Pułkownika Kurogane Arms — Willa Kuroyama (run6):
// 15 pomieszczeń na 3 kondygnacjach (Piwnica B y = -4.8 m, Parter L0 y = 0.0 m, Piętro L1 y = +4.8 m)
// z Wielkim Dwukondygnacyjnym Salonem (H = 9.6 m), działającą windą piwniczną `elevators[0]`,
// 4 dwubiegowymi klatkami schodowymi, Tablicą Śledczą „Iskra”, Salą Tortur i panoramą nocnego lasu.
// Projekt: docs/maps/run6.md. Generator jest w pełni deterministyczny.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom } from './_runKit.mjs';
import { buildRooms } from './_run6Rooms.mjs';
import { SPAWNS, dress } from './_run6Dress.mjs';
import {
  MAT_BUNKER,
  MAT_CEIL,
  MAT_CONCRETE,
  MAT_MARBLE,
  MAT_WALNUT,
  R,
  ROOMS,
  SLAB,
  Y_B,
  Y_B_CEIL,
  Y_L0,
  Y_L0_CEIL,
  Y_L1,
  Y_L1_CEIL,
  Y_M01,
  Y_MB0,
  Y_SALON_CEIL,
  box,
  ceilingSlab,
  createPlacer,
  deck,
  forestGlassFacade,
  glassBalustrade,
  interiorDoorFrame,
  segmentedWall,
  solid,
  stairFlightWithRails,
  vec,
} from './_run6Kit.mjs';

// --- Konstrukcja: płyty 3 kondygnacji, podpory pod L1, stropy (ceiling: true + rainShelters), fasady i ściany ---

function structure(k, placer) {
  // 1. Parter (L0, y = 0.00 m, płyta -0.60..0.00 m).
  // Posadzka Holu R1 (X ∈ [-10, 10], Z ∈ [4, 16]) wycięta wokół szybu windy X ∈ [-1.3, 1.3], Z ∈ [13.7, 16.0].
  deck(k, R(-10, 10, 4, 13.7), Y_L0, MAT_MARBLE, 0.6);
  deck(k, R(-10, -1.3, 13.7, 16), Y_L0, MAT_MARBLE, 0.6);
  deck(k, R(1.3, 10, 13.7, 16), Y_L0, MAT_MARBLE, 0.6);
  // Próg drzwi wejściowych entry (południe R1 między Klatką #1 X = -5.2 a szybem windy X = -1.6).
  deck(k, R(-5.0, -1.6, 16, 17), Y_L0, MAT_MARBLE, 0.4);

  deck(k, ROOMS.R2, Y_L0, MAT_WALNUT, 0.6);
  deck(k, ROOMS.R3, Y_L0, MAT_WALNUT, 0.6);
  deck(k, ROOMS.R4, Y_L0, MAT_MARBLE, 0.6);
  // Posadzka Krytego Basenu R5 (X ∈ [16, 30], Z ∈ [-18, 4]) wycięta wokół niecki basenu R(20, 26, -14, 0).
  deck(k, R(16, 20, -18, 4), Y_L0, MAT_MARBLE, 0.6);
  deck(k, R(26, 30, -18, 4), Y_L0, MAT_MARBLE, 0.6);
  deck(k, R(20, 26, -18, -14), Y_L0, MAT_MARBLE, 0.6);
  deck(k, R(20, 26, 0, 4), Y_L0, MAT_MARBLE, 0.6);
  deck(k, ROOMS.R6, Y_L0, MAT_CONCRETE, 0.6);
  deck(k, ROOMS.R7, Y_L0, MAT_CONCRETE, 0.6);

  // 2. Piętro i Antresola Salonu (L1, y = +4.80 m, płyta +4.40..+4.80 m).
  deck(k, ROOMS.R8, Y_L1, MAT_WALNUT);
  deck(k, ROOMS.R9, Y_L1, MAT_WALNUT);
  deck(k, ROOMS.R10, Y_L1, MAT_MARBLE);
  deck(k, ROOMS.R11, Y_L1, MAT_WALNUT);
  deck(k, ROOMS.R12, Y_L1, MAT_MARBLE);

  // Antresola Dwukondygnacyjnego Salonu R2-M (y = +4.80 m) z otworami nad Klatkami #3 i #4 (X ∈ [±12.0, ±15.2], Z ∈ [-14.8, -1.8]):
  deck(k, ROOMS.R2_MEZZ_N, Y_L1, MAT_WALNUT);
  deck(k, R(-16, -9.8, -2, 4), Y_L1, MAT_WALNUT);
  deck(k, R(-12.0, -9.8, -15, -2), Y_L1, MAT_WALNUT);
  deck(k, R(-16, -15.2, -15, -2), Y_L1, MAT_WALNUT);
  deck(k, R(9.8, 16, -2, 4), Y_L1, MAT_WALNUT);
  deck(k, R(9.8, 12.0, -15, -2), Y_L1, MAT_WALNUT);
  deck(k, R(15.2, 16, -15, -2), Y_L1, MAT_WALNUT);

  // 3. Skarpa leśna, rygle i słupy konstrukcyjne pod wystającym na północ Piętrem L1 (konsola nad lasem Z ∈ [-42, -18]):
  solid(k, R(-30.4, 30.4, -30.2, -18), -1.4, -0.4, 'excavation_dirt', {
    walkable: false,
  });
  solid(k, R(-30.2, 30.2, -30.1, -18), -0.4, 0.0, 'canal_stone_wall', {
    walkable: false,
  });
  solid(k, R(-24.4, 24.4, -42.4, -30), -2.0, -0.8, 'excavation_dirt', {
    walkable: false,
  });
  solid(k, R(-24.2, 24.2, -42.2, -30), -0.8, -0.2, 'canal_stone_wall', {
    walkable: false,
  });
  // Rygle podstropowe pod konsolą Piętra L1 (y = 3.90..4.40 m).
  for (const z of [-24.0, -29.6]) {
    box(k, 0, 4.15, z, 59.6, 0.5, 0.6, MAT_CONCRETE, { walkable: false });
    for (const x of [-29.2, -20.0, -12.0, 0, 12.0, 20.0, 29.2]) {
      box(k, x, 2.2, z, 0.85, 4.4, 0.85, MAT_CONCRETE, { walkable: false });
      box(k, x, 3.85, z, 0.92, 0.08, 0.92, 'neon_amber', { walkable: false });
    }
  }
  for (const z of [-36.0, -41.4]) {
    box(k, 0, 4.15, z, 47.6, 0.5, 0.6, MAT_CONCRETE, { walkable: false });
    for (const x of [-23.2, -14.0, -4.0, 4.0, 14.0, 23.2]) {
      box(k, x, 2.1, z, 0.85, 4.6, 0.85, MAT_CONCRETE, { walkable: false });
      box(k, x, 3.85, z, 0.92, 0.08, 0.92, 'neon_amber', { walkable: false });
    }
  }

  // 4. Piwnica (B, y = -4.80 m, płyta -5.40..-4.80 m).
  deck(k, ROOMS.R13, Y_B, MAT_BUNKER, 0.6);
  // Posadzka Winiarni R14 (X ∈ [-10, 10], Z ∈ [16, 32]) wycięta wokół szybu windy X ∈ [-1.3, 1.3], Z ∈ [16.0, 16.3].
  deck(k, R(-10, 10, 16.3, 32), Y_B, MAT_WALNUT, 0.6);
  deck(k, R(-10, -1.3, 16, 16.3), Y_B, MAT_WALNUT, 0.6);
  deck(k, R(1.3, 10, 16, 16.3), Y_B, MAT_WALNUT, 0.6);
  deck(k, ROOMS.R15, Y_B, MAT_BUNKER, 0.6);
  // Wnęka drzwi wyjściowych exit (południe R15: X ∈ [17, 21], Z ∈ [32, 33]).
  deck(k, R(17, 21, 32, 33), Y_B, MAT_BUNKER, 0.6);

  // 5. Stropy ukrywane w ujęciach audytu z góry (`ceiling: true`) + szczelne `rainShelters` nad całym wnętrzem.
  // Strop/taras nad Piwnicą B (Z ∈ [16, 32], y = 0.00..0.40 m), z wycięciem nad Klatkami #1 i #2 oraz szybem windy.
  ceilingSlab(k, ROOMS.R13, Y_B_CEIL, MAT_CONCRETE, SLAB, Y_B - 0.5);
  ceilingSlab(k, ROOMS.R15, Y_B_CEIL, MAT_CONCRETE, SLAB, Y_B - 0.5);
  ceilingSlab(
    k,
    R(16.6, 21.4, 32, 33.2),
    Y_B + 3.6,
    MAT_BUNKER,
    SLAB,
    Y_B - 0.5,
  );
  ceilingSlab(k, R(-10, -8.6, 16, 32), Y_B_CEIL, MAT_CONCRETE, SLAB, Y_B - 0.5);
  ceilingSlab(k, R(8.6, 10, 16, 32), Y_B_CEIL, MAT_CONCRETE, SLAB, Y_B - 0.5);
  ceilingSlab(
    k,
    R(-8.6, -5.0, 24.2, 32),
    Y_B_CEIL,
    MAT_CONCRETE,
    SLAB,
    Y_B - 0.5,
  );
  ceilingSlab(
    k,
    R(5.0, 8.6, 24.2, 32),
    Y_B_CEIL,
    MAT_CONCRETE,
    SLAB,
    Y_B - 0.5,
  );
  ceilingSlab(
    k,
    R(-5.0, -1.6, 16, 32),
    Y_B_CEIL,
    MAT_CONCRETE,
    SLAB,
    Y_B - 0.5,
  );
  ceilingSlab(k, R(1.6, 5.0, 16, 32), Y_B_CEIL, MAT_CONCRETE, SLAB, Y_B - 0.5);
  ceilingSlab(
    k,
    R(-1.6, 1.6, 16.6, 32),
    Y_B_CEIL,
    MAT_CONCRETE,
    SLAB,
    Y_B - 0.5,
  );
  // Strop nad obudowami Klatek #1 i #2 oraz południową częścią szybu windy (y = 4.80..5.20 m).
  ceilingSlab(k, R(-8.6, -5.0, 16, 24.2), Y_L0_CEIL, MAT_CEIL, SLAB, Y_B - 0.5);
  ceilingSlab(k, R(5.0, 8.6, 16, 24.2), Y_L0_CEIL, MAT_CEIL, SLAB, Y_B - 0.5);
  ceilingSlab(k, R(-1.6, 1.6, 16, 16.6), Y_L0_CEIL, MAT_CEIL, SLAB, Y_B - 0.5);

  // Stropy nad pomieszczeniami bocznymi Parteru L0 (y = 4.80..5.20 m).
  ceilingSlab(k, ROOMS.R1, Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R3, Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R4, Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R5, Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R6, Y_L0_CEIL, MAT_CEIL);
  ceilingSlab(k, ROOMS.R7, Y_L0_CEIL, MAT_CEIL);

  // Wysoki strop nad Dwukondygnacyjnym Salonem R2 (y = 9.60..10.00 m) oraz Piętrem L1 (R8..R12, y = 9.60..10.00 m).
  ceilingSlab(k, ROOMS.R2, Y_SALON_CEIL, MAT_CEIL);
  ceilingSlab(k, R(-30, 30, -30, -18), Y_L1_CEIL, MAT_CEIL, SLAB, Y_L1 - 0.5);
  ceilingSlab(k, R(-24, 24, -42, -30), Y_L1_CEIL, MAT_CEIL, SLAB, Y_L1 - 0.5);

  // 6. Ściany Piwnicy B (y = -4.80..0.00 m):
  segmentedWall(k, 'x', 16, -28, -10, Y_B, Y_B_CEIL, MAT_BUNKER);
  segmentedWall(k, 'x', 16, 10, 28, Y_B, Y_B_CEIL, MAT_BUNKER);
  segmentedWall(k, 'x', 16, -10, -8.4, Y_B, Y_B_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, -5.2, -1.6, Y_B, Y_B_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, 1.6, 5.2, Y_B, Y_B_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, 8.4, 10, Y_B, Y_B_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, -8.4, -5.2, Y_B, -0.4, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, 5.2, 8.4, Y_B, -0.4, MAT_CONCRETE);

  segmentedWall(k, 'x', 32, -28, 10, Y_B, Y_B_CEIL, MAT_BUNKER);
  segmentedWall(k, 'x', 32, 10, 28, Y_B, Y_B_CEIL, MAT_BUNKER, [
    [17, 21, Y_B, Y_B + 3.2],
  ]);
  // Obudowa wnęki wyjściowej exit w Piwnicy B.
  solid(k, R(16.6, 17, 32, 33.2), Y_B, Y_B + 3.6, MAT_BUNKER, {
    walkable: false,
  });
  solid(k, R(21, 21.4, 32, 33.2), Y_B, Y_B + 3.6, MAT_BUNKER, {
    walkable: false,
  });
  solid(k, R(16.6, 21.4, 33, 33.4), Y_B, Y_B + 3.6, MAT_BUNKER, {
    walkable: false,
  });

  segmentedWall(k, 'z', -28, 16, 32, Y_B, Y_B_CEIL, MAT_BUNKER);
  segmentedWall(k, 'z', 28, 16, 32, Y_B, Y_B_CEIL, MAT_BUNKER);

  // Ściany działowe Piwnicy B: R13 <-> R14 (X = -10) oraz R14 <-> R15 (X = +10), po 2 bramy.
  const cellarDoors = [
    [16.4, 20.4, Y_B, Y_B + 3.6],
    [27.6, 31.6, Y_B, Y_B + 3.6],
  ];
  segmentedWall(k, 'z', -10, 16, 32, Y_B, Y_B_CEIL, MAT_CONCRETE, cellarDoors);
  interiorDoorFrame(k, placer, -10, Y_B, 18.4, 1);
  interiorDoorFrame(k, placer, -10, Y_B, 29.6, 1);

  segmentedWall(k, 'z', 10, 16, 32, Y_B, Y_B_CEIL, MAT_CONCRETE, cellarDoors);
  interiorDoorFrame(k, placer, 10, Y_B, 18.4, 1);
  interiorDoorFrame(k, placer, 10, Y_B, 29.6, 1);

  // 7. Szklane fasady na las (`res_forest_glass_facade`) i ściany Parteru L0 (y = 0.00..4.80 m):
  // Wielka 32-metrowa północna fasada Salonu R2 (Z = -18, X ∈ [-16, 16]) + fasady Kuchni R4, Jadalni R3 i Basenu R5.
  forestGlassFacade(k, 'x', -18, -16, 16, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'x', -18, -30, -16, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'x', -18, 16, 30, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'z', -30, -18, 4, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'z', 30, -18, 4, Y_L0, Y_L0_CEIL, 1);

  // Mury zewnętrzne Garażu R6 (SW) i Pokoju Ochrony R7 (SE) oraz południowa ściana Holu R1 (Z = 16).
  segmentedWall(k, 'z', -30, 4, 16, Y_L0, Y_L0_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, -30, -10, Y_L0, Y_L0_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'z', 30, 4, 16, Y_L0, Y_L0_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', 16, 10, 30, Y_L0, Y_L0_CEIL, MAT_CONCRETE);

  // Ściana południowa Holu R1 (Z = 16, X ∈ [-10, 10]) z otworami na Klatkę #1, drzwi entry, szyb windy i Klatkę #2.
  segmentedWall(k, 'x', 16, -10, 10, Y_L0, Y_L0_CEIL, MAT_CONCRETE, [
    [-8.4, -5.2, Y_L0, Y_L0 + 3.8],
    [-4.8, -1.6, Y_L0, Y_L0 + 3.4],
    [-1.6, 1.6, Y_L0, Y_L0 + 3.4],
    [5.2, 8.4, Y_L0, Y_L0 + 3.8],
  ]);
  // Przeszklone obudowy górnych biegów Klatek Schodowych #1 i #2 ponad tarasem Piwnicy (Z ∈ [16, 24.2]).
  forestGlassFacade(k, 'z', -8.6, 16, 24.2, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'z', -5.0, 16, 24.2, Y_L0, Y_L0_CEIL, 1);
  forestGlassFacade(k, 'x', 24.2, -8.6, -5.0, Y_L0, Y_L0_CEIL, 1);
  forestGlassFacade(k, 'z', 5.0, 16, 24.2, Y_L0, Y_L0_CEIL, -1);
  forestGlassFacade(k, 'z', 8.6, 16, 24.2, Y_L0, Y_L0_CEIL, 1);
  forestGlassFacade(k, 'x', 24.2, 5.0, 8.6, Y_L0, Y_L0_CEIL, 1);

  // Ściany działowe Parteru L0:
  // Ściana Z = +4 (R3/R2/R5 <-> R6/R1/R7):
  segmentedWall(k, 'x', 4, -30, -16, Y_L0, Y_L0_CEIL, MAT_WALNUT, [
    [-25, -21, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -23, Y_L0, 4, 0);

  segmentedWall(k, 'x', 4, -16, 16, Y_L0, Y_L0_CEIL, MAT_CONCRETE, [
    [-14, -10, Y_L0, Y_L0 + 3.6],
    [-5, 5, Y_L0, Y_L0 + 4.0],
    [10, 14, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -12, Y_L0, 4, 0);
  interiorDoorFrame(k, placer, 12, Y_L0, 4, 0);

  segmentedWall(k, 'x', 4, 16, 30, Y_L0, Y_L0_CEIL, MAT_CONCRETE, [
    [21, 25, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, 23, Y_L0, 4, 0);

  // Ściana Z = -6 (R3 <-> R4):
  segmentedWall(k, 'x', -6, -30, -16, Y_L0, Y_L0_CEIL, MAT_WALNUT, [
    [-25, -21, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -23, Y_L0, -6, 0);

  // Ściany X = -10 (R6 <-> R1) oraz X = +10 (R1 <-> R7):
  segmentedWall(k, 'z', -10, 4, 16, Y_L0, Y_L0_CEIL, MAT_CONCRETE, [
    [8, 12, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -10, Y_L0, 10, 1);

  segmentedWall(k, 'z', 10, 4, 16, Y_L0, Y_L0_CEIL, MAT_CONCRETE, [
    [8, 12, Y_L0, Y_L0 + 3.6],
  ]);
  interiorDoorFrame(k, placer, 10, Y_L0, 10, 1);

  // Ściany boczne Salonu R2: X = -16 (R3/R4 <-> R2) oraz X = +16 (R2 <-> R5):
  const salonSideOpenings = [
    [-16, -12, Y_L0, Y_L0 + 3.6],
    [-1, 3, Y_L0, Y_L0 + 3.6],
  ];
  segmentedWall(
    k,
    'z',
    -16,
    -18,
    4,
    Y_L0,
    Y_L0_CEIL,
    MAT_WALNUT,
    salonSideOpenings,
  );
  interiorDoorFrame(k, placer, -16, Y_L0, -14, 1);
  interiorDoorFrame(k, placer, -16, Y_L0, 1, 1);

  segmentedWall(
    k,
    'z',
    16,
    -18,
    4,
    Y_L0,
    Y_L0_CEIL,
    MAT_CONCRETE,
    salonSideOpenings,
  );
  interiorDoorFrame(k, placer, 16, Y_L0, -14, 1);
  interiorDoorFrame(k, placer, 16, Y_L0, 1, 1);

  // 8. Piętro L1 oraz górna kondygnacja Salonu R2 (y = 4.80..9.60 m):
  // Górne przeszklenia Dwukondygnacyjnego Salonu R2 (y = 4.80..9.60 m) oraz przeszklona ściana R2-M <-> R8/R9/R10 (Z = -18):
  forestGlassFacade(k, 'x', 4, -16, 16, Y_L1, Y_SALON_CEIL, 1);
  forestGlassFacade(k, 'z', -16, -18, 4, Y_L1, Y_SALON_CEIL, -1);
  forestGlassFacade(k, 'z', 16, -18, 4, Y_L1, Y_SALON_CEIL, 1);
  forestGlassFacade(k, 'x', -18, -16, 16, Y_L1, Y_SALON_CEIL, -1, [
    [-16, -12, Y_L1, Y_L1 + 3.6],
    [-2, 2, Y_L1, Y_L1 + 3.6],
    [12, 16, Y_L1, Y_L1 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -14, Y_L1, -18, 0);
  interiorDoorFrame(k, placer, 0, Y_L1, -18, 0);
  interiorDoorFrame(k, placer, 14, Y_L1, -18, 0);

  // Zewnętrzne ściany i przeszklenia Piętra L1 (R8, R9, R10, R11, R12):
  forestGlassFacade(k, 'x', -18, -30, -16, Y_L1, Y_L1_CEIL, 1);
  forestGlassFacade(k, 'x', -18, 16, 30, Y_L1, Y_L1_CEIL, 1);
  forestGlassFacade(k, 'z', -30, -30, -18, Y_L1, Y_L1_CEIL, -1);
  segmentedWall(k, 'z', 30, -30, -18, Y_L1, Y_L1_CEIL, MAT_CONCRETE);

  // Ściany działowe R9 <-> R8 (X = -12) oraz R8 <-> R10 (X = +12):
  segmentedWall(k, 'z', -12, -30, -18, Y_L1, Y_L1_CEIL, MAT_WALNUT, [
    [-26, -22, Y_L1, Y_L1 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -12, Y_L1, -24, 1);

  segmentedWall(k, 'z', 12, -30, -18, Y_L1, Y_L1_CEIL, MAT_CONCRETE, [
    [-26, -22, Y_L1, Y_L1 + 3.6],
  ]);
  interiorDoorFrame(k, placer, 12, Y_L1, -24, 1);

  // Ściana Z = -30 (styk R9/R8/R10 z R11/R12; centralny odcinek X ∈ [-2, 6] to monolit pod Tablicę Śledczą „Iskra”!).
  segmentedWall(k, 'x', -30, -30, -24, Y_L1, Y_L1_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', -30, 24, 30, Y_L1, Y_L1_CEIL, MAT_CONCRETE);
  segmentedWall(k, 'x', -30, -24, 24, Y_L1, Y_L1_CEIL, MAT_CONCRETE, [
    [-18, -14, Y_L1, Y_L1 + 3.6],
    [-6, -2, Y_L1, Y_L1 + 3.6],
    [6, 10, Y_L1, Y_L1 + 3.6],
    [14, 18, Y_L1, Y_L1 + 3.6],
  ]);
  interiorDoorFrame(k, placer, -16, Y_L1, -30, 0);
  interiorDoorFrame(k, placer, -4, Y_L1, -30, 0);
  interiorDoorFrame(k, placer, 8, Y_L1, -30, 0);
  interiorDoorFrame(k, placer, 16, Y_L1, -30, 0);

  // Ściana działowa R11 <-> R12 (X = +4, Z ∈ [-42, -30]) oraz szklane fasady północne Sypialni R11 i Spa R12:
  segmentedWall(k, 'z', 4, -42, -30, Y_L1, Y_L1_CEIL, MAT_MARBLE, [
    [-38, -34, Y_L1, Y_L1 + 3.6],
  ]);
  interiorDoorFrame(k, placer, 4, Y_L1, -36, 1);

  forestGlassFacade(k, 'x', -42, -24, 24, Y_L1, Y_L1_CEIL, -1);
  forestGlassFacade(k, 'z', -24, -42, -30, Y_L1, Y_L1_CEIL, -1);
  forestGlassFacade(k, 'z', 24, -42, -30, Y_L1, Y_L1_CEIL, 1);
}

// --- Komunikacja pionowa: 4 dwubiegowe klatki schodowe (25.64° <= 26.6°, szer. 3.2 m >= 2.0 m) ---

function circulation(k, placer) {
  // 1. Klatka #1: Schody Piwniczne Zachodnie (L0 <-> B, X ∈ [-8.4, -5.2], Z: +16.0 -> +21.0 -> +24.0 -> +29.0).
  stairFlightWithRails(k, -6.8, 3.2, Y_L0, 16.0, Y_MB0, 21.0, 'neon_amber');
  deck(k, R(-8.4, -5.2, 21.0, 24.0), Y_MB0, MAT_CONCRETE);
  stairFlightWithRails(k, -6.8, 3.2, Y_MB0, 24.0, Y_B, 29.0, 'neon_amber');
  placer.reserve(R(-8.5, -5.1, 15.2, 16.4), Y_L0);
  placer.reserve(R(-8.5, -5.1, 20.8, 24.2), Y_MB0);
  placer.reserve(R(-8.5, -5.1, 28.6, 29.8), Y_B);

  // 2. Klatka #2: Schody Piwniczne Wschodnie (L0 <-> B, X ∈ [+5.2, +8.4], Z: +16.0 -> +21.0 -> +24.0 -> +29.0).
  stairFlightWithRails(k, 6.8, 3.2, Y_L0, 16.0, Y_MB0, 21.0, 'neon_blue');
  deck(k, R(5.2, 8.4, 21.0, 24.0), Y_MB0, MAT_CONCRETE);
  stairFlightWithRails(k, 6.8, 3.2, Y_MB0, 24.0, Y_B, 29.0, 'neon_blue');
  placer.reserve(R(5.1, 8.5, 15.2, 16.4), Y_L0);
  placer.reserve(R(5.1, 8.5, 20.8, 24.2), Y_MB0);
  placer.reserve(R(5.1, 8.5, 28.6, 29.8), Y_B);

  // 3. Klatka #3: Schody Salonowe Zachodnie (L0 <-> L1, X ∈ [-15.2, -12.0], Z: -1.8 -> -6.8 -> -9.8 -> -14.8).
  stairFlightWithRails(k, -13.6, 3.2, Y_L0, -2.0, Y_M01, -7.0, 'neon_amber');
  deck(k, R(-15.2, -12.0, -10.0, -7.0), Y_M01, MAT_WALNUT);
  stairFlightWithRails(k, -13.6, 3.2, Y_M01, -10.0, Y_L1, -15.0, 'neon_amber');
  placer.reserve(R(-15.3, -11.9, -4.8, -1.4), Y_L0);
  placer.reserve(R(-15.3, -11.9, -10.0, -6.6), Y_M01);
  placer.reserve(R(-15.3, -11.9, -15.6, -14.6), Y_L1);

  // 4. Klatka #4: Schody Salonowe Wschodnie (L0 <-> L1, X ∈ [+12.0, +15.2], Z: -1.8 -> -6.8 -> -9.8 -> -14.8).
  stairFlightWithRails(k, 13.6, 3.2, Y_L0, -2.0, Y_M01, -7.0, 'neon_amber');
  deck(k, R(12.0, 15.2, -10.0, -7.0), Y_M01, MAT_WALNUT);
  stairFlightWithRails(k, 13.6, 3.2, Y_M01, -10.0, Y_L1, -15.0, 'neon_amber');
  placer.reserve(R(11.9, 15.3, -4.8, -1.4), Y_L0);
  placer.reserve(R(11.9, 15.3, -10.0, -6.6), Y_M01);
  placer.reserve(R(11.9, 15.3, -15.6, -14.6), Y_L1);
}

// --- Szklane balustrady `res_glass_balustrade` wokół Antresoli Salonu i spoczników schodów ---

function rails(k) {
  // Krawędź południowa Galerii Północnej Antresoli Salonu (Z = -14.88, między pomostami wewnętrznymi X ∈ [-9.8, 9.8]).
  glassBalustrade(k, 'x', -14.88, -9.8, 9.8, Y_L1);

  // Wewnętrzne krawędzie Galerii Zachodniej (X = -9.88) i Wschodniej (X = +9.88) nad pustką Salonu R2.
  glassBalustrade(k, 'z', -9.88, -14.8, 3.8, Y_L1);
  glassBalustrade(k, 'z', 9.88, -14.8, 3.8, Y_L1);

  // Poprzeczne barierki zabezpieczające otwory Klatek #3 i #4 od południa na L1 (Z = -1.88).
  glassBalustrade(k, 'x', -1.88, -15.2, -12.0, Y_L1);
  glassBalustrade(k, 'x', -1.88, 12.0, 15.2, Y_L1);

  // Balustrady spoczników pośrednich M01 (y = +2.4 m) i MB0 (y = -2.4 m).
  glassBalustrade(k, 'z', -15.12, -9.7, -6.9, Y_M01);
  glassBalustrade(k, 'z', -12.08, -9.7, -6.9, Y_M01);
  glassBalustrade(k, 'z', 12.08, -9.7, -6.9, Y_M01);
  glassBalustrade(k, 'z', 15.12, -9.7, -6.9, Y_M01);
  glassBalustrade(k, 'z', -8.32, 21.1, 23.9, Y_MB0);
  glassBalustrade(k, 'z', -5.28, 21.1, 23.9, Y_MB0);
  glassBalustrade(k, 'z', 5.28, 21.1, 23.9, Y_MB0);
  glassBalustrade(k, 'z', 8.32, 21.1, 23.9, Y_MB0);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run6',
    name: 'Rezydencja Pułkownika Kurogane Arms — Willa Kuroyama',
    weather: 'kuroganeForestResidence',
    theme: 'kuroganeResidence',
    bounds: R(-30, 30, -43, 33),
    startX: -4,
    exitX: 19,
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

  // Działająca prywatna winda piwniczna Pułkownika (§3.4A) łącząca Hol Wejściowy R1 (y = 0.0 m) z Winiarnią R14 (y = -4.8 m).
  k.arena.roomMeta({
    playerSpawn: vec(-4, Y_L0, 12),
    elevators: [
      {
        id: 'cellar-interrogation-lift',
        x: 0,
        z: 15,
        width: 2.6,
        depth: 2.6,
        startStop: 1,
        model: 'res_elevator_cab',
        stops: [
          { y: Y_B, doorSide: 's' },
          { y: Y_L0, doorSide: 'n' },
        ],
      },
    ],
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(-4, Y_L0 + 1.5, 16.5),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(19, Y_B + 1.5, 32.5),
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
      ['A', 0, Y_L0, -6],
      ['B', 0, Y_L1, -24],
      ['C', 0, Y_B, 24],
    ],
    zones: [
      ['Parter — Wielki Salon, Basen i Foyer', R(-30, 30, -18, 16), 'interior'],
      ['Piętro — Biuro Pułkownika i Apartamenty', R(-30, 30, -42, 4), 'high'],
      [
        'Piwnica — Winiarnia, Sala Tortur i Bunkier',
        R(-28, 28, 16, 32),
        'open',
      ],
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
      new URL('../../../src/data/rooms/run6.json', import.meta.url),
    ),
  );
