// Tajne Laboratorium Kurogane Arms — Sektor X-51 (run3):
// 8 pomieszczeń na dwóch kondygnacjach (Parter y = 0.0 m: P1..P5; Piwnica y = -5.2 m + pomosty y = -1.6 m: B1..B3).
// Projekt: docs/maps/run3.md. Generator jest w pełni deterministyczny.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRunRoom } from './_runKit.mjs';
import { buildRooms } from './_run3Rooms.mjs';
import { SPAWNS, dress } from './_run3Dress.mjs';
import {
  H_HALL,
  H_WING,
  MAT_BUNKER,
  MAT_CLEAN,
  MAT_EPOXY,
  MAT_GRATING,
  MAT_SERVER,
  MAT_TURBINE,
  R,
  ROOMS,
  Y_B1_CEIL,
  Y_B23_CEIL,
  Y_BASEMENT,
  Y_CATWALK,
  Y_PARTER,
  blastDoorFrame,
  box,
  catwalkRail,
  ceilingSlab,
  createPlacer,
  deck,
  segmentedWall,
  solid,
  spans,
  vec,
} from './_run3Kit.mjs';

// --- Konstrukcja: płyty posadzek, pomosty, stropy (ceiling: true) i ściany z otworami -----------

function structure(k) {
  // 1. Posadzki Parteru (y = 0.00 m, płyta -1.00..0.00 m, granice na pełnych metrach).
  deck(k, ROOMS.P1, Y_PARTER, MAT_EPOXY, 1);
  deck(k, ROOMS.P2, Y_PARTER, MAT_EPOXY, 1);
  deck(k, ROOMS.P3, Y_PARTER, MAT_EPOXY, 1);
  deck(k, ROOMS.P4, Y_PARTER, 'tread_plate', 1);
  deck(k, ROOMS.P5, Y_PARTER, MAT_EPOXY, 1);
  // Wnęka drzwi wejściowych entry (południe P5: X ∈ [-2, 2], Z ∈ [28, 29]).
  deck(k, R(-2, 2, 28, 29), Y_PARTER, MAT_EPOXY, 1);

  // 2. Posadzki Piwnicy (y = -5.20 m, płyta -5.60..-5.20 m).
  deck(k, ROOMS.B1, Y_BASEMENT, MAT_TURBINE);
  deck(k, ROOMS.B2, Y_BASEMENT, MAT_EPOXY);
  deck(k, ROOMS.B3, Y_BASEMENT, MAT_SERVER);
  // Wnęka drzwi wyjściowych exit (północ B1: X ∈ [-2, 2], Z ∈ [-45, -44]).
  deck(k, R(-2, 2, -45, -44), Y_BASEMENT, MAT_TURBINE);

  // 3. Spocznik pośredni, Pomosty Obserwacyjne i Mostek Centralny B1 (y = -1.60 m, płyta -2.00..-1.60 m).
  deck(k, R(-20, -6.4, -6.6, 0), Y_CATWALK, MAT_GRATING);
  deck(k, R(6.4, 20, -6.6, 0), Y_CATWALK, MAT_GRATING);
  // Środkowy spocznik sięga Z = -3.4 m, podpierając od spodu dolny styk Ramp Górnych (Z = -3.6 m).
  deck(k, R(-6.4, 6.4, -6.6, -3.4), Y_CATWALK, MAT_GRATING);
  // Pomost Zachodni i Wschodni (szer. 3.0 m, nad bramami do B2 i B3, prześwit pod spodem 3.20 m).
  deck(k, R(-20, -17, -34, -6.6), Y_CATWALK, MAT_GRATING);
  deck(k, R(17, 20, -34, -6.6), Y_CATWALK, MAT_GRATING);
  // Mostek Centralny B1 (szer. 3.0 m) + zatoka konsoli nadzoru (X ∈ [-3.5, 3.5], Z ∈ [-20.5, -18.8]).
  deck(k, R(-17, 17, -23.5, -20.5), Y_CATWALK, MAT_GRATING);
  deck(k, R(-3.5, 3.5, -20.5, -18.8), Y_CATWALK, MAT_GRATING);

  // 4. Stropy ukrywane w ujęciach z góry (`ceiling: true`).
  ceilingSlab(k, R(-26, -10, 0, 28), H_WING, MAT_CLEAN);
  ceilingSlab(k, R(10, 26, 0, 28), H_WING, MAT_CLEAN);
  ceilingSlab(k, R(-10, 10, 0, 28), H_HALL, MAT_CLEAN);
  ceilingSlab(k, R(-2.4, 2.4, 28, 29.2), 3.6, MAT_CLEAN);
  ceilingSlab(k, ROOMS.B1, Y_B1_CEIL, MAT_BUNKER);
  ceilingSlab(k, R(-2.4, 2.4, -45.2, -44), Y_BASEMENT + 3.4, MAT_BUNKER);
  ceilingSlab(k, ROOMS.B2, Y_B23_CEIL, MAT_CLEAN);
  ceilingSlab(k, ROOMS.B3, Y_B23_CEIL, MAT_BUNKER);

  // 5. Ściany zewnętrzne i działowe Parteru (y = 0.0 m).
  // Południe (Z = 28): P1, P5 (z otworem entry [-2, 2]), P3.
  segmentedWall(k, 'x', 28, -26, -10, Y_PARTER, H_WING, MAT_CLEAN);
  segmentedWall(k, 'x', 28, 10, 26, Y_PARTER, H_WING, MAT_CLEAN);
  segmentedWall(k, 'x', 28, -10, 10, Y_PARTER, H_HALL, MAT_CLEAN, [
    [-2, 2, Y_PARTER, 3.2],
  ]);
  // Obudowa wnęki wejściowej entry.
  solid(k, R(-2.4, -2, 28, 29.2), Y_PARTER, 3.6, MAT_CLEAN, { walkable: false });
  solid(k, R(2, 2.4, 28, 29.2), Y_PARTER, 3.6, MAT_CLEAN, { walkable: false });
  solid(k, R(-2.4, 2.4, 29, 29.4), Y_PARTER, 3.6, MAT_CLEAN, { walkable: false });

  // Zachód (X = -26) i Wschód (X = +26) Parteru.
  segmentedWall(k, 'z', -26, 0, 28, Y_PARTER, H_WING, MAT_CLEAN);
  segmentedWall(k, 'z', 26, 0, 28, Y_PARTER, H_WING, MAT_CLEAN);

  // Ściany działowe P1/P2 (Z = 14, brama [-20, -16]) oraz P3/P4 (Z = 14, brama [16, 20]).
  segmentedWall(k, 'x', 14, -26, -10, Y_PARTER, H_WING, MAT_CLEAN, [
    [-20, -16, Y_PARTER, 3.4],
  ]);
  blastDoorFrame(k, -18, Y_PARTER, 14, 0);
  segmentedWall(k, 'x', 14, 10, 26, Y_PARTER, H_WING, MAT_CLEAN, [
    [16, 20, Y_PARTER, 3.4],
  ]);
  blastDoorFrame(k, 18, Y_PARTER, 14, 0);

  // Ściany działowe P1-P2 / P5 (X = -10) oraz P3-P4 / P5 (X = +10) z bramami [5, 9] i [19, 23].
  const hallOpenings = [
    [5, 9, Y_PARTER, 3.4],
    [19, 23, Y_PARTER, 3.4],
  ];
  segmentedWall(k, 'z', -10, 0, 28, Y_PARTER, H_WING, MAT_CLEAN, hallOpenings);
  segmentedWall(k, 'z', -10, 0, 28, H_WING, H_HALL, MAT_CLEAN);
  blastDoorFrame(k, -10, Y_PARTER, 7, 1);
  blastDoorFrame(k, -10, Y_PARTER, 21, 1);

  segmentedWall(k, 'z', 10, 0, 28, Y_PARTER, H_WING, MAT_CLEAN, hallOpenings);
  segmentedWall(k, 'z', 10, 0, 28, H_WING, H_HALL, MAT_CLEAN);
  blastDoorFrame(k, 10, Y_PARTER, 7, -1);
  blastDoorFrame(k, 10, Y_PARTER, 21, -1);

  // Północna granica Parteru (Z = 0) — styk z Wielką Salą Testów Humanoidalnych B1:
  // Odcinki zewnętrzne poza obrysem B1 (X ∈ [-26, -20] i [20, 26]).
  segmentedWall(k, 'x', 0, -26, -20, Y_PARTER, H_WING, MAT_CLEAN);
  segmentedWall(k, 'x', 0, 20, 26, Y_PARTER, H_WING, MAT_CLEAN);
  // Ściana P2 / B1 (X ∈ [-20, -10]) z otworem okna obserwacyjnego X ∈ [-19.5, -11.5], Y ∈ [1.0, 3.6].
  segmentedWall(k, 'x', 0, -20, -10, Y_PARTER, H_WING, MAT_CLEAN, [
    [-19.5, -11.5, 1.0, 3.6],
  ]);
  // Ściana P4 / B1 (X ∈ [10, 20]) z otworem okna obserwacyjnego X ∈ [11.5, 19.5], Y ∈ [1.0, 3.6].
  segmentedWall(k, 'x', 0, 10, 20, Y_PARTER, H_WING, MAT_CLEAN, [
    [11.5, 19.5, 1.0, 3.6],
  ]);
  // Portal zejścia z Holu P5 do B1 (X ∈ [-10, 10], Z = 0): otwarty w X ∈ [-6.4, 6.4], Y ∈ [-1.6, 4.4].
  segmentedWall(k, 'x', 0, -10, -6.4, Y_CATWALK, H_HALL, MAT_CLEAN);
  segmentedWall(k, 'x', 0, 6.4, 10, Y_CATWALK, H_HALL, MAT_CLEAN);
  segmentedWall(k, 'x', 0, -6.4, 6.4, Y_B1_CEIL, H_HALL, MAT_CLEAN);
  // Dolny mur oporowy Piwnicy B1 pod Parterem na Z = 0 (od y = -5.2 do spodu galerii / parteru).
  segmentedWall(k, 'x', 0, -20, 20, Y_BASEMENT, Y_CATWALK, MAT_BUNKER);
  segmentedWall(k, 'x', 0, -20, -6.4, Y_CATWALK, Y_PARTER, MAT_BUNKER);
  segmentedWall(k, 'x', 0, 6.4, 20, Y_CATWALK, Y_PARTER, MAT_BUNKER);

  // 6. Ściany Piwnicy (B1, B2, B3).
  // Północna ściana B1 (Z = -44) z bramą wyjściową exit [-2, 2].
  segmentedWall(k, 'x', -44, -20, 20, Y_BASEMENT, Y_B1_CEIL, MAT_BUNKER, [
    [-2, 2, Y_BASEMENT, Y_BASEMENT + 3.2],
  ]);
  blastDoorFrame(k, 0, Y_BASEMENT, -44, 0);
  // Obudowa wnęki wyjściowej exit.
  solid(
    k,
    R(-2.4, -2, -45.2, -44),
    Y_BASEMENT,
    Y_BASEMENT + 3.4,
    MAT_BUNKER,
    { walkable: false },
  );
  solid(
    k,
    R(2, 2.4, -45.2, -44),
    Y_BASEMENT,
    Y_BASEMENT + 3.4,
    MAT_BUNKER,
    { walkable: false },
  );
  solid(
    k,
    R(-2.4, 2.4, -45.4, -45),
    Y_BASEMENT,
    Y_BASEMENT + 3.4,
    MAT_BUNKER,
    { walkable: false },
  );

  // Zachodnia ściana B1 (X = -20) z dwiema bramami do Szatni B2: Z ∈ [-24, -20] i Z ∈ [-16, -12].
  const sideDoors = [
    [-24, -20, Y_BASEMENT, Y_BASEMENT + 3.2],
    [-16, -12, Y_BASEMENT, Y_BASEMENT + 3.2],
  ];
  segmentedWall(
    k,
    'z',
    -20,
    -44,
    0,
    Y_BASEMENT,
    Y_B1_CEIL,
    MAT_BUNKER,
    sideDoors,
  );
  blastDoorFrame(k, -20, Y_BASEMENT, -22, 1);
  blastDoorFrame(k, -20, Y_BASEMENT, -14, 1);

  // Wschodnia ściana B1 (X = +20) z dwiema bramami do Serwerowni B3: Z ∈ [-24, -20] i Z ∈ [-16, -12].
  segmentedWall(
    k,
    'z',
    20,
    -44,
    0,
    Y_BASEMENT,
    Y_B1_CEIL,
    MAT_BUNKER,
    sideDoors,
  );
  blastDoorFrame(k, 20, Y_BASEMENT, -22, -1);
  blastDoorFrame(k, 20, Y_BASEMENT, -14, -1);

  // Mury zewnętrzne Szatni Dekontaminacyjnej B2 (X ∈ [-32, -20], Z ∈ [-26, -10]).
  segmentedWall(k, 'z', -32, -26, -10, Y_BASEMENT, Y_B23_CEIL, 'tiles_wall');
  segmentedWall(k, 'x', -26, -32, -20, Y_BASEMENT, Y_B23_CEIL, 'tiles_wall');
  segmentedWall(k, 'x', -10, -32, -20, Y_BASEMENT, Y_B23_CEIL, 'tiles_wall');

  // Mury zewnętrzne Zaplecza Serwerowego B3 (X ∈ [20, 32], Z ∈ [-26, -10]).
  segmentedWall(k, 'z', 32, -26, -10, Y_BASEMENT, Y_B23_CEIL, 'metal');
  segmentedWall(k, 'x', -26, 20, 32, Y_BASEMENT, Y_B23_CEIL, 'metal');
  segmentedWall(k, 'x', -10, 20, 32, Y_BASEMENT, Y_B23_CEIL, 'metal');
}

// --- Komunikacja pionowa: 6 biegów ramp (czysty obrót rotation.x, nachylenie <= 26.6°) ---------

/**
 * Boczne policzki, świecące listwy cokołowe LED i poręcze dla pochyłego biegu rampy.
 * Odsunięte na zewnątrz szerokości biegu i cofnięte o 0.45 m od progów, by nie zawężać nawigacji.
 */
function rampSideRails(k, xCenter, width, yFrom, zFrom, yTo, zTo, ledMat = 'neon_amber') {
  const z0 = Math.min(zFrom, zTo) + 0.45;
  const z1 = Math.max(zFrom, zTo) - 0.45;
  const run = z1 - z0;
  if (run <= 0.5) return;
  const totalRun = Math.abs(zTo - zFrom);
  const rise = ((yTo - yFrom) * run) / totalRun;
  const dz = Math.sign(zTo - zFrom);
  const angle = Math.atan2(yTo - yFrom, totalRun);
  const rx = -dz * angle;
  const len = Math.hypot(run, rise);
  const midY = (yFrom + yTo) / 2;
  const midZ = (zFrom + zTo) / 2;
  const ny = Math.cos(rx);
  const nz = Math.sin(rx);
  for (const side of [-1, 1]) {
    const x = xCenter + side * (width / 2 + 0.1);
    // Stalowy policzek cokołu
    box(k, x, midY + ny * 0.1, midZ + nz * 0.1, 0.14, 0.22, len, 'trim', {
      rotation: vec(rx, 0, 0),
      walkable: false,
    });
    // Świecąca listwa LED cokołu
    box(k, x - side * 0.02, midY + ny * 0.23, midZ + nz * 0.23, 0.16, 0.05, len, ledMat, {
      rotation: vec(rx, 0, 0),
      walkable: false,
    });
    // Pochyła poręcz górna
    box(k, x, midY + ny * 0.92, midZ + nz * 0.92, 0.08, 0.08, len, 'hivis', {
      rotation: vec(rx, 0, 0),
      walkable: false,
    });
  }
}

function circulation(k, placer) {
  // 1. Dwa biegi Ramp Górnych wokół Szybu Windy Towarowej (P5 y=0.0 -> Spocznik B1 y=-1.6):
  // szer. 3.6 m, dł. 3.6 m, kąt 23.96° <= 26.6°.
  for (const sx of [-1, 1]) {
    const x = sx * 4.6;
    k.p.ramp({
      from: vec(x, Y_PARTER, 0),
      to: vec(x, Y_CATWALK, -3.6),
      width: 3.6,
      material: 'tread_plate',
    });
    rampSideRails(k, x, 3.6, Y_PARTER, 0, Y_CATWALK, -3.6, 'neon_amber');
    // Policzek boczny obudowy rampy górnej od strony Galerii Południowej
    solid(
      k,
      R(sx > 0 ? 6.38 : -6.54, sx > 0 ? 6.54 : -6.38, -3.5, -0.1),
      Y_CATWALK,
      Y_PARTER,
      'machine',
      { walkable: false },
    );
    solid(
      k,
      R(sx > 0 ? 6.36 : -6.56, sx > 0 ? 6.56 : -6.36, -3.5, -0.1),
      -0.85,
      -0.77,
      'neon_amber',
      { walkable: false },
    );
    placer.reserve(R(x - 1.8, x + 1.8, -3.6, 0.2), Y_PARTER);
    placer.reserve(R(x - 1.8, x + 1.8, -3.8, 0), Y_CATWALK);
  }

  // 2. Dwa biegi Ramp Dolnych (Spocznik B1 y=-1.6 -> Posadzka B1 y=-5.2):
  // szer. 3.2 m, dł. 8.0 m, kąt 24.23° <= 26.6°.
  for (const sx of [-1, 1]) {
    const x = sx * 4.6;
    k.p.ramp({
      from: vec(x, Y_CATWALK, -6.6),
      to: vec(x, Y_BASEMENT, -14.6),
      width: 3.2,
      material: 'tread_plate',
    });
    rampSideRails(
      k,
      x,
      3.2,
      Y_CATWALK,
      -6.6,
      Y_BASEMENT,
      -14.6,
      sx < 0 ? 'neon_green' : 'neon_blue',
    );
    placer.reserve(R(x - 1.6, x + 1.6, -14.8, -6.4), Y_CATWALK);
    placer.reserve(R(x - 1.6, x + 1.6, -14.8, -6.4), Y_BASEMENT);
  }

  // 3. Dwa biegi Ramp Pomostowych Północnych (Pomosty Zach./Wsch. y=-1.6 -> Posadzka B1 y=-5.2):
  // szer. 3.0 m, dł. 8.0 m (Z: -34 -> -42), kąt 24.23° <= 26.6°.
  for (const sx of [-1, 1]) {
    const x = sx * 18.5;
    k.p.ramp({
      from: vec(x, Y_CATWALK, -34),
      to: vec(x, Y_BASEMENT, -42),
      width: 3.0,
      material: 'tread_plate',
    });
    rampSideRails(
      k,
      x,
      3.0,
      Y_CATWALK,
      -34,
      Y_BASEMENT,
      -42,
      sx < 0 ? 'neon_green' : 'neon_blue',
    );
    placer.reserve(R(x - 1.5, x + 1.5, -42.2, -33.8), Y_CATWALK);
    placer.reserve(R(x - 1.5, x + 1.5, -42.2, -33.8), Y_BASEMENT);
  }
}

// --- Balustrady pomostów obserwacyjnych `lab_catwalk_rail` (z przerwami na wejścia z ramp) -----

function rails(k) {
  // Krawędź południowego spocznika i galerii (Z = -6.53, z przerwami na Rampy Dolne [-6.2,-3.0] i [3.0,6.2]).
  for (const [s0, s1] of spans(-17, 17, [
    [-6.2, -3.0],
    [3.0, 6.2],
  ]))
    catwalkRail(k, 'x', -6.53, s0, s1, Y_CATWALK);

  // Krawędzie wewnętrzne Pomostu Zachodniego (X = -17.07) i Wschodniego (X = +17.07),
  // z przerwą Z ∈ [-23.5, -20.5] na wejście na Mostek Centralny B1.
  for (const sx of [-1, 1])
    for (const [s0, s1] of spans(-34, -6.6, [[-23.5, -20.5]]))
      catwalkRail(k, 'z', sx * 17.07, s0, s1, Y_CATWALK);

  // Mostek Centralny B1: krawędź północna (Z = -23.43) oraz południowa (Z = -20.57) z zatoką konsoli.
  catwalkRail(k, 'x', -23.43, -16.9, 16.9, Y_CATWALK);
  for (const [s0, s1] of spans(-16.9, 16.9, [[-3.5, 3.5]]))
    catwalkRail(k, 'x', -20.57, s0, s1, Y_CATWALK);
  catwalkRail(k, 'x', -18.87, -3.5, 3.5, Y_CATWALK);
  for (const sx of [-1, 1])
    catwalkRail(k, 'z', sx * 3.43, -20.5, -18.87, Y_CATWALK);
}

export default function generate() {
  const k = createRunRoom({
    id: 'run3',
    name: 'Tajne Laboratorium Kurogane Arms — Sektor X-51',
    weather: 'kuroganeSecretLab',
    bounds: R(-32, 32, -45, 29),
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
  structure(k);
  circulation(k, placer);
  rails(k);
  buildRooms(k, placer);
  dress(k, placer);

  // Punkt startu gracza na Parterze (0, 0, 25) oraz drzwi entry (Parter) i exit (Piwnica y = -5.2 m).
  k.arena.roomMeta({
    playerSpawn: vec(0, Y_PARTER, 25),
    doors: [
      {
        id: 'entry',
        role: 'entry',
        position: vec(0, Y_PARTER + 1.5, 28.5),
        size: vec(4, 3, 1),
      },
      {
        id: 'exit',
        role: 'exit',
        position: vec(0, Y_BASEMENT + 1.5, -44.5),
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
      ['A', 0, Y_PARTER, 14],
      ['B', 0, Y_CATWALK, -22],
      ['C', 0, Y_BASEMENT, -36],
    ],
    zones: [
      ['Parter — Kompleks Analityczny', R(-26, 26, 0, 28), 'interior'],
      ['Pomosty Obserwacyjne B1', R(-20, 20, -34, 0), 'high'],
      ['Piwnica — Inkubator Chimera', R(-32, 32, -44, 0), 'open'],
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
      new URL('../../../src/data/rooms/run3.json', import.meta.url),
    ),
  );
