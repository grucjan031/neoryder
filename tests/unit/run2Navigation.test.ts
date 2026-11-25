import { expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run2')!;
const nav = new ArenaNavigation(room);
const L1 = 5.2;
const L2 = 10.4;

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

it('run2: ze startu można dojść do wyjścia i do wszystkich 16 spawnów na trzech kondygnacjach', () => {
  const exit = room.doors.find((door) => door.role === 'exit')!;
  expect(room.spawnPoints).toHaveLength(16);
  const levels = room.spawnPoints.map((p) => p.y ?? 0);
  expect(levels.filter((y) => y === 0)).toHaveLength(6);
  expect(levels.filter((y) => y === L1)).toHaveLength(5);
  expect(levels.filter((y) => y === L2)).toHaveLength(5);
  reach(room.playerSpawn, { ...exit.position, y: 0 });
  for (const p of room.spawnPoints)
    reach(room.playerSpawn, { x: p.x, y: p.y ?? 0, z: p.z });
});

it('run2: po każdych ruchomych schodach i klatkach można przejść między kondygnacjami', () => {
  const start = room.playerSpawn;
  const stops: Goal[] = [
    // ESC-1: parter, dolny spocznik i górne wyjście na mostek L1.
    { x: 4.8, y: 0, z: 17.6 },
    { x: 4.8, y: 2.6, z: 11.2 },
    { x: 4.8, y: L1, z: 5.5 },
    // ESC-2: parter i wyjście na północny pasaż L1.
    { x: -4.8, y: 0, z: -6.5 },
    { x: -4.8, y: 2.6, z: -12.8 },
    { x: -4.8, y: L1, z: -18.6 },
    // ESC-3: z mostka L1 na południowy pasaż L2.
    { x: -4.8, y: L1, z: 5.5 },
    { x: -4.8, y: 7.8, z: 11.2 },
    { x: -4.8, y: L2, z: 17.4 },
    // ESC-4: z północnego pasażu L1 na mostek L2.
    { x: 4.8, y: L1, z: -18.6 },
    { x: 4.8, y: 7.8, z: -12.8 },
    { x: 4.8, y: L2, z: -6.8 },
    // Klatki narożne: spoczniki 2,6 i 7,8 m w obu stronach.
    { x: -16, y: 2.6, z: -24.1 },
    { x: -16, y: 7.8, z: -24.1 },
    { x: 16, y: 2.6, z: -24.1 },
    { x: 16, y: 7.8, z: -24.1 },
    // Mostki: środek L1 i środek L2.
    { x: 0, y: L1, z: 4.5 },
    { x: 0, y: L2, z: -4.5 },
  ];
  for (const goal of stops) reach(start, goal);
  // Każde ruchome schody da się przejść w obie strony.
  reach({ x: 4.8, y: L1, z: 5.5 }, { x: 4.8, y: 0, z: 17.6 });
  reach({ x: -4.8, y: L2, z: 17.4 }, { x: -4.8, y: L1, z: 5.5 });
});

it('run2: ruch po L1 i L2 przez mostki nie wymaga zejścia na parter', () => {
  const l1 = nav.path({ x: -16.8, y: L1, z: 9 }, { x: 16.8, y: L1, z: -9 });
  expect(l1.length).toBeGreaterThan(2);
  expect(Math.min(...l1.map((p) => p.y))).toBeGreaterThanOrEqual(L1 - 0.01);
  const l2 = nav.path({ x: -16.8, y: L2, z: 10 }, { x: 16.8, y: L2, z: 10 });
  expect(Math.min(...l2.map((p) => p.y))).toBeGreaterThanOrEqual(L2 - 0.01);
  // Mostki L1 i L2 mają przejście między osłonami (ławki przy przeciwległych balustradach).
  const bridge = reach({ x: -9, y: L1, z: 4.75 }, { x: 9, y: L1, z: 4.25 });
  expect(Math.min(...bridge.map((p) => p.y))).toBeGreaterThanOrEqual(L1 - 0.01);
  const upper = reach({ x: -9, y: L2, z: -4.25 }, { x: 9, y: L2, z: -4.75 });
  expect(Math.min(...upper.map((p) => p.y))).toBeGreaterThanOrEqual(L2 - 0.01);
});

it('run2: kapsuła gracza mieści się na starcie i przy każdym spawnie', () => {
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
      // Płyta pod stopami (wierzch na y) nie liczy się; liczą się bryły w korpusie.
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

it('run2: na każdej kondygnacji osłony stoją gęsto (parter ≤ 8 m, L1 i L2 ≤ 10 m bez osłony)', () => {
  const covers = room.blocks.filter(
    (b) =>
      b.visible !== false &&
      !b.walkable &&
      b.size.y >= 0.8 &&
      b.size.y <= 3.9 &&
      b.position.y - b.size.y / 2 < 12,
  );
  const gap = (level: number, rect: number[], limit: number) => {
    const y = level;
    const [x0, x1, z0, z1] = rect as [number, number, number, number];
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
    // Największy pusty kwadrat (programowanie dynamiczne).
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
  gap(0, [-18, 18, -25, 25], 8);
  gap(L1, [-18, 18, -25, 25], 10);
  gap(L2, [-18, 18, -25, 25], 10);
});
