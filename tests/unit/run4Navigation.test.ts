import { expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { facePoint } from '../../src/world/elevatorSchema';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run4')!;
const nav = new ArenaNavigation(room);
const surfaceNav = new ArenaSurfaceNavigation(room);
const stairsTuning = structuredClone(tuning);
stairsTuning.elevator.elevatorDoorDwellS = 500;
const stairsNav = new ArenaNavigation(room, stairsTuning);

const Y_L0 = 0;
const Y_M01 = 2.4;
const Y_L1 = 4.8;
const Y_M12 = 7.2;
const Y_L2 = 9.6;

interface Goal {
  x: number;
  y: number;
  z: number;
}

/** Cel osiągalny: przedostatni punkt ścieżki (komórka siatki) leży przy celu na tej samej wysokości. */
function reach(from: Goal, goal: Goal, navigator = nav): Goal[] {
  const path = navigator.path(from, goal);
  const arrived = path.at(-2);
  const label = JSON.stringify(goal);
  expect(arrived, label).toBeDefined();
  expect(arrived!.y, label).toBeCloseTo(goal.y, 1);
  expect(
    Math.hypot(arrived!.x - goal.x, arrived!.z - goal.z),
    label,
  ).toBeLessThan(1);
  return path;
}

// Wszystkie 8 biegów 4 klatek schodowych łączących Piętro 60 (0.0 m) <-> Piętro 61 (4.8 m) <-> Piętro 62 (9.6 m).
const stairEnds = [
  // Klatka #1: Atrium Zachód (L0 <-> L1, X = -4.0)
  { id: 'Klatka #1 dół L0', x: -4.0, y: Y_L0, aisle: 6.0, ramp: 4.0, rise: 0.48 },
  { id: 'Klatka #1 spocznik M01-W S', x: -4.0, y: Y_M01, aisle: -1.0, ramp: 1.0, rise: -0.48 },
  { id: 'Klatka #1 spocznik M01-W N', x: -4.0, y: Y_M01, aisle: -2.0, ramp: -4.0, rise: 0.48 },
  { id: 'Klatka #1 góra L1', x: -4.0, y: Y_L1, aisle: -9.0, ramp: -7.0, rise: -0.48 },
  // Klatka #2: Panoramowa Wschód w R3 (L0 <-> L1, X = +12.0)
  { id: 'Klatka #2 dół L0', x: 12.0, y: Y_L0, aisle: 21.0, ramp: 19.0, rise: 0.48 },
  { id: 'Klatka #2 spocznik M01-E S', x: 12.0, y: Y_M01, aisle: 14.0, ramp: 16.0, rise: -0.48 },
  { id: 'Klatka #2 spocznik M01-E N', x: 12.0, y: Y_M01, aisle: 13.0, ramp: 11.0, rise: 0.48 },
  { id: 'Klatka #2 góra L1', x: 12.0, y: Y_L1, aisle: 6.0, ramp: 8.0, rise: -0.48 },
  // Klatka #3: Atrium Wschód (L1 <-> L2, X = +8.0)
  { id: 'Klatka #3 dół L1', x: 8.0, y: Y_L1, aisle: -2.0, ramp: -4.0, rise: 0.48 },
  { id: 'Klatka #3 spocznik M12-E S', x: 8.0, y: Y_M12, aisle: -9.0, ramp: -7.0, rise: -0.48 },
  { id: 'Klatka #3 spocznik M12-E N', x: 8.0, y: Y_M12, aisle: -10.0, ramp: -12.0, rise: 0.48 },
  { id: 'Klatka #3 góra L2', x: 8.0, y: Y_L2, aisle: -17.0, ramp: -15.0, rise: -0.48 },
  // Klatka #4: Atrium Zachód (L1 <-> L2, X = -8.0)
  { id: 'Klatka #4 dół L1', x: -8.0, y: Y_L1, aisle: -2.0, ramp: -4.0, rise: 0.48 },
  { id: 'Klatka #4 spocznik M12-W S', x: -8.0, y: Y_M12, aisle: -9.0, ramp: -7.0, rise: -0.48 },
  { id: 'Klatka #4 spocznik M12-W N', x: -8.0, y: Y_M12, aisle: -10.0, ramp: -12.0, rise: 0.48 },
  { id: 'Klatka #4 góra L2', x: -8.0, y: Y_L2, aisle: -17.0, ramp: -15.0, rise: -0.48 },
];

it.each(stairEnds)(
  'run4: $id łączy się bezpośrednio z posadzką/spocznikiem',
  (end) => {
    const aisle = { x: end.x, y: end.y, z: end.aisle };
    const ramp = { x: end.x, y: end.y + end.rise, z: end.ramp };
    for (const [from, to] of [
      [aisle, ramp],
      [ramp, aisle],
    ] as const) {
      const path = surfaceNav.path(from, to);
      expect(path.length).toBeGreaterThan(2);
      const arrived = path.at(-2)!;
      expect(Math.abs(arrived.y - to.y)).toBeLessThan(0.35);
      expect(Math.hypot(arrived.x - to.x, arrived.z - to.z)).toBeLessThan(0.6);
      for (const p of path) {
        expect(Math.abs(p.x - end.x)).toBeLessThan(1.2);
        expect(p.z).toBeGreaterThanOrEqual(
          Math.min(end.aisle, end.ramp) - 0.6,
        );
        expect(p.z).toBeLessThanOrEqual(Math.max(end.aisle, end.ramp) + 0.6);
      }
    }
  },
);

it('run4: winda ma 3 przystanki na blokach walkable oraz trasę jazdy i pieszą po schodach między wszystkimi 3 piętrami', () => {
  expect(room.panoramaDropM).toBe(180);
  expect(room.elevators).toHaveLength(1);
  const lift = room.elevators![0]!;
  expect(lift).toMatchObject({
    id: 'atrium-main-lift',
    x: 0,
    z: -14,
    width: 3.2,
    depth: 3.2,
    model: 'off_elevator_cab',
    stops: [
      { y: Y_L0, doorSide: 's' },
      { y: Y_L1, doorSide: 's' },
      { y: Y_L2, doorSide: 'n' },
    ],
  });
  for (const stop of lift.stops) {
    const threshold = facePoint(lift, stop.doorSide, stop.y, 0.05);
    const supported = room.blocks.some(
      (b) =>
        b.walkable === true &&
        !b.rotation?.x &&
        !b.rotation?.z &&
        Math.abs(b.position.y + b.size.y / 2 - stop.y) < 1e-4 &&
        Math.abs(threshold.x - b.position.x) <= b.size.x / 2 &&
        Math.abs(threshold.z - b.position.z) <= b.size.z / 2,
    );
    expect(supported, `przystanek y=${stop.y}`).toBe(true);
  }
  const stopL0 = { x: 0, y: Y_L0, z: -11.5 };
  const stopL1 = { x: 0, y: Y_L1, z: -10.5 };
  const stopL2 = { x: 0, y: Y_L2, z: -17.0 };
  expect(nav.elevatorRoute(stopL0, stopL2)).toMatchObject([
    { id: 'atrium-main-lift', kind: 'elevator', from: 0, to: 2 },
  ]);
  expect(nav.elevatorRoute(stopL2, stopL0)).toMatchObject([
    { id: 'atrium-main-lift', kind: 'elevator', from: 2, to: 0 },
  ]);
  // Również czysto pieszo po schodach (gdy winda jest zajęta) wszystkie 3 piętra są osiągalne w obie strony!
  expect(stairsNav.elevatorRoute(stopL0, stopL2)).toHaveLength(0);
  for (const target of [stopL0, stopL1, stopL2]) {
    reach(room.playerSpawn, target, stairsNav);
    reach(target, room.playerSpawn, stairsNav);
  }
});

it('run4: ze startu można dojść po schodach oraz z windą do wyjścia na 62. piętrze i do wszystkich 18 spawnów na 3 piętrach', () => {
  const exit = room.doors.find((door) => door.role === 'exit')!;
  expect(room.spawnPoints).toHaveLength(18);
  const levels = room.spawnPoints.map((p) => p.y ?? 0);
  expect(levels.filter((y) => y === Y_L0)).toHaveLength(7);
  expect(levels.filter((y) => y === Y_L1)).toHaveLength(6);
  expect(levels.filter((y) => y === Y_L2)).toHaveLength(5);
  const exitGoal = { x: exit.position.x, y: Y_L2, z: exit.position.z };
  reach(room.playerSpawn, exitGoal, nav);
  reach(room.playerSpawn, exitGoal, stairsNav);
  for (const p of room.spawnPoints) {
    const goal = { x: p.x, y: p.y ?? 0, z: p.z };
    reach(room.playerSpawn, goal, nav);
    reach(room.playerSpawn, goal, stairsNav);
  }
});

it('run4: wszystkie 10 pomieszczeń (R1..R10), Atrium (A0) i 3 przystanki windy są osiągalne w obie strony', () => {
  const start = room.playerSpawn;
  const targets: { id: string; goal: Goal }[] = [
    { id: 'R1 Recepcja i Lobby Główne', goal: { x: 0, y: Y_L0, z: 16 } },
    { id: 'R2 Wielki Openspace Operacyjny', goal: { x: -20, y: Y_L0, z: 12 } },
    { id: 'R3 Korytarz Panoramowy', goal: { x: 16, y: Y_L0, z: 21 } },
    { id: 'A0 Centralne Atrium Parter', goal: { x: 0, y: Y_L0, z: 2 } },
    { id: 'Przystanek #0 Windy (L0)', goal: { x: 0, y: Y_L0, z: -11.5 } },
    { id: 'R4 Sala Konferencyjna Aegis', goal: { x: -16, y: Y_L1, z: 0 } },
    { id: 'R5 Sala Konferencyjna Vanguard', goal: { x: 20, y: Y_L1, z: -2 } },
    { id: 'R6 Kuchnia i Strefa Socjalna Sky Lounge', goal: { x: -20, y: Y_L1, z: -18 } },
    { id: 'R7 Serwerownia Biurowa i Drukarnia', goal: { x: 16, y: Y_L1, z: -18 } },
    { id: 'Przystanek #1 Windy (L1)', goal: { x: 0, y: Y_L1, z: -10.5 } },
    { id: 'R8 Szklane Gabinety Kierownictwa W', goal: { x: -16, y: Y_L2, z: -22 } },
    { id: 'R9 Foyer Zarządu i Gabinety E', goal: { x: 16, y: Y_L2, z: -22 } },
    { id: 'Przystanek #2 Windy (L2)', goal: { x: 0, y: Y_L2, z: -17.0 } },
    { id: 'R10 Gabinet Zarządu Penthouse', goal: { x: 0, y: Y_L2, z: -35 } },
  ];
  for (const { goal } of targets) {
    reach(start, goal, stairsNav);
    reach(goal, start, stairsNav);
  }
});

it('run4: kapsuła gracza mieści się na starcie i przy każdym z 18 punktów spawnu', () => {
  const { capsuleHeight: height, capsuleRadius: radius } = tuning.player;
  const points = [
    { x: room.playerSpawn.x, y: room.playerSpawn.y, z: room.playerSpawn.z },
    ...room.spawnPoints.map((p) => ({ x: p.x, y: p.y ?? 0, z: p.z })),
  ];
  for (const p of points) {
    const hits = room.blocks.filter((b) => {
      const quarter = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 1e-5;
      const hx = (quarter ? b.size.z : b.size.x) / 2;
      const hz = (quarter ? b.size.x : b.size.z) / 2;
      const bottom = b.position.y - b.size.y / 2;
      const top = b.position.y + b.size.y / 2;
      if (top <= p.y + 0.05 || bottom >= p.y + height) return false;
      const dx = Math.max(Math.abs(p.x - b.position.x) - hx, 0);
      const dz = Math.max(Math.abs(p.z - b.position.z) - hz, 0);
      return Math.hypot(dx, dz) < radius;
    });
    expect(
      hits.map((b) => b.model ?? b.material),
      JSON.stringify(p),
    ).toEqual([]);
  }
});

it('run4: gęstość osłon na wszystkich 3 piętrach (L0, L1, L2) nie zostawia pustego kwadratu > 8 m', () => {
  const covers = room.blocks.filter(
    (b) =>
      b.visible !== false &&
      !b.walkable &&
      !b.ceiling &&
      b.size.y >= 0.8 &&
      b.size.y <= 4.45,
  );
  const gap = (
    level: number,
    rect: [number, number, number, number],
    limit: number,
  ) => {
    const y = level;
    const [x0, x1, z0, z1] = rect;
    const step = 0.5;
    const nx = Math.round((x1 - x0) / step),
      nz = Math.round((z1 - z0) / step);
    const free: number[][] = [];
    for (let i = 0; i < nx; i++) {
      free.push([]);
      for (let j = 0; j < nz; j++) {
        const x = x0 + (i + 0.5) * step,
          z = z0 + (j + 0.5) * step;
        const blocked = covers.some((b) => {
          const bottom = b.position.y - b.size.y / 2;
          if (bottom > y + 1.2 || bottom < y - 0.5) return false;
          const quarter = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 1e-5;
          const hx = (quarter ? b.size.z : b.size.x) / 2;
          const hz = (quarter ? b.size.x : b.size.z) / 2;
          return (
            Math.abs(x - b.position.x) <= hx + 0.2 &&
            Math.abs(z - b.position.z) <= hz + 0.2
          );
        });
        const onFloor = room.blocks.some(
          (b) =>
            b.walkable &&
            !b.rotation &&
            Math.abs(b.position.y + b.size.y / 2 - y) < 0.01 &&
            Math.abs(x - b.position.x) <= b.size.x / 2 &&
            Math.abs(z - b.position.z) <= b.size.z / 2,
        );
        free[i]!.push(onFloor && !blocked ? 1 : 0);
      }
    }
    let best = 0;
    const dp = free.map((row) => row.map(() => 0));
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        if (!free[i]![j]) continue;
        dp[i]![j] =
          1 +
          Math.min(
            i && j ? dp[i - 1]![j - 1]! : 0,
            i ? dp[i - 1]![j]! : 0,
            j ? dp[i]![j - 1]! : 0,
          );
        best = Math.max(best, dp[i]![j]!);
      }
    expect(best * step, `kondygnacja y=${y}`).toBeLessThanOrEqual(limit);
  };
  gap(Y_L0, [-30, 30, -16, 30], 8);
  gap(Y_L1, [-30, 30, -24, 8], 8);
  gap(Y_L2, [-24, 24, -42, -16], 8);
});
