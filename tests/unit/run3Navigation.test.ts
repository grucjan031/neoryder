import { expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run3')!;
const nav = new ArenaNavigation(room);
const surfaceNav = new ArenaSurfaceNavigation(room);

const Y_PARTER = 0;
const Y_CATWALK = -1.6;
const Y_BASEMENT = -5.2;

interface Goal {
  x: number;
  y: number;
  z: number;
}

/** Cel osiągalny: przedostatni punkt ścieżki (komórka siatki) leży przy celu na tej samej wysokości. */
function reach(from: Goal, goal: Goal): Goal[] {
  const path = nav.path(from, goal);
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

// Wszystkie 6 biegów ramp łączących Parter (0.0 m) -> Spocznik/Pomosty (-1.6 m) -> Piwnicę (-5.2 m).
const rampEnds = [
  { id: 'Rampa Górna Zach. góra', x: -4.6, y: Y_PARTER, aisle: 1.0, ramp: -0.9, rise: -0.4 },
  { id: 'Rampa Górna Zach. dół', x: -4.6, y: Y_CATWALK, aisle: -4.6, ramp: -2.7, rise: 0.4 },
  { id: 'Rampa Górna Wsch. góra', x: 4.6, y: Y_PARTER, aisle: 1.0, ramp: -0.9, rise: -0.4 },
  { id: 'Rampa Górna Wsch. dół', x: 4.6, y: Y_CATWALK, aisle: -4.6, ramp: -2.7, rise: 0.4 },
  { id: 'Rampa Dolna Zach. góra', x: -4.6, y: Y_CATWALK, aisle: -5.6, ramp: -7.6, rise: -0.45 },
  { id: 'Rampa Dolna Zach. dół', x: -4.6, y: Y_BASEMENT, aisle: -15.6, ramp: -13.6, rise: 0.45 },
  { id: 'Rampa Dolna Wsch. góra', x: 4.6, y: Y_CATWALK, aisle: -5.6, ramp: -7.6, rise: -0.45 },
  { id: 'Rampa Dolna Wsch. dół', x: 4.6, y: Y_BASEMENT, aisle: -15.6, ramp: -13.6, rise: 0.45 },
  { id: 'Rampa Pomostowa NW góra', x: -18.5, y: Y_CATWALK, aisle: -33.0, ramp: -35.0, rise: -0.45 },
  { id: 'Rampa Pomostowa NW dół', x: -18.5, y: Y_BASEMENT, aisle: -43.0, ramp: -41.0, rise: 0.45 },
  { id: 'Rampa Pomostowa NE góra', x: 18.5, y: Y_CATWALK, aisle: -33.0, ramp: -35.0, rise: -0.45 },
  { id: 'Rampa Pomostowa NE dół', x: 18.5, y: Y_BASEMENT, aisle: -43.0, ramp: -41.0, rise: 0.45 },
];

it.each(rampEnds)('run3: $id łączy się bezpośrednio z posadzką/spocznikiem/pomostem', (end) => {
  const aisle = { x: end.x, y: end.y, z: end.aisle };
  const ramp = { x: end.x, y: end.y + end.rise, z: end.ramp };
  for (const [from, to] of [[aisle, ramp], [ramp, aisle]] as const) {
    const path = surfaceNav.path(from, to);
    expect(path.length).toBeGreaterThan(2);
    const arrived = path.at(-2)!;
    expect(Math.abs(arrived.y - to.y)).toBeLessThan(0.35);
    expect(Math.hypot(arrived.x - to.x, arrived.z - to.z)).toBeLessThan(0.6);
    for (const p of path) {
      expect(Math.abs(p.x - end.x)).toBeLessThan(1.2);
      expect(p.z).toBeGreaterThanOrEqual(Math.min(end.aisle, end.ramp) - 0.6);
      expect(p.z).toBeLessThanOrEqual(Math.max(end.aisle, end.ramp) + 0.6);
    }
  }
});

it('run3: ze startu można dojść do wyjścia w piwnicy i do wszystkich 16 spawnów na 3 poziomach', () => {
  const exit = room.doors.find((door) => door.role === 'exit')!;
  expect(room.spawnPoints).toHaveLength(16);
  const levels = room.spawnPoints.map((p) => p.y ?? 0);
  expect(levels.filter((y) => y === Y_PARTER)).toHaveLength(7);
  expect(levels.filter((y) => y === Y_CATWALK)).toHaveLength(3);
  expect(levels.filter((y) => y === Y_BASEMENT)).toHaveLength(6);
  reach(room.playerSpawn, { x: exit.position.x, y: Y_BASEMENT, z: exit.position.z });
  for (const p of room.spawnPoints)
    reach(room.playerSpawn, { x: p.x, y: p.y ?? 0, z: p.z });
});

it('run3: wszystkie 8 pomieszczeń (P1..P5, B1..B3), spoczniki i pomosty są osiągalne w obie strony', () => {
  const start = room.playerSpawn;
  const targets: { id: string; goal: Goal }[] = [
    { id: 'P1 Punkt Kontrolny Kordon Zero', goal: { x: -18, y: Y_PARTER, z: 21 } },
    { id: 'P2 Czarne Archiwum Strefa 51', goal: { x: -18, y: Y_PARTER, z: 3 } },
    { id: 'P3 Laboratorium Biochemii', goal: { x: 18, y: Y_PARTER, z: 21 } },
    { id: 'P4 Zbrojownia Prototypów', goal: { x: 15, y: Y_PARTER, z: 10 } },
    { id: 'P5 Centralny Hol Badawczy', goal: { x: 0, y: Y_PARTER, z: 14 } },
    { id: 'Spocznik Pośredni B1', goal: { x: 0, y: Y_CATWALK, z: -5 } },
    { id: 'Pomost Obserwacyjny Zachodni B1', goal: { x: -18.5, y: Y_CATWALK, z: -22 } },
    { id: 'Pomost Obserwacyjny Wschodni B1', goal: { x: 18.5, y: Y_CATWALK, z: -22 } },
    { id: 'Mostek Centralny B1', goal: { x: 0, y: Y_CATWALK, z: -22 } },
    { id: 'B1 Wielka Sala Testów Humanoidalnych', goal: { x: 0, y: Y_BASEMENT, z: -28 } },
    { id: 'B2 Szatnia Dekontaminacyjna', goal: { x: -26, y: Y_BASEMENT, z: -18 } },
    { id: 'B3 Zaplecze Serwerowe Krypta Danych', goal: { x: 26, y: Y_BASEMENT, z: -18 } },
  ];
  for (const { goal } of targets) {
    reach(start, goal);
    reach(goal, start);
  }
});

it('run3: przejście między Pomostem Zachodnim a Wschodnim przez Mostek Centralny nie schodzi na posadzkę piwnicy', () => {
  const west = { x: -18.5, y: Y_CATWALK, z: -16 };
  const east = { x: 18.5, y: Y_CATWALK, z: -16 };
  const path = reach(west, east);
  expect(path.length).toBeGreaterThan(2);
  expect(Math.min(...path.map((p) => p.y))).toBeGreaterThanOrEqual(Y_CATWALK - 0.1);
});

it('run3: kapsuła gracza mieści się na starcie i przy każdym z 16 punktów spawnu', () => {
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

it('run3: gęstość osłon na Parterze i w Wielkiej Sali Testów B1 nie zostawia pustego kwadratu > 8 m', () => {
  const covers = room.blocks.filter(
    (b) =>
      b.visible !== false &&
      !b.walkable &&
      !b.ceiling &&
      b.size.y >= 0.8 &&
      b.size.y <= 4.45,
  );
  const gap = (level: number, rect: [number, number, number, number], limit: number) => {
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
  gap(Y_PARTER, [-26, 26, 0, 28], 8);
  gap(Y_BASEMENT, [-20, 20, -44, 0], 8);
});
