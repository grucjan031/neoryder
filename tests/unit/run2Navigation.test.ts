import { beforeAll, expect, it } from 'vitest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run2')!;
const p = (x: number, y: number, z: number) => ({ x, y, z });
let nav: ArenaNavigation;
beforeAll(() => {
  nav = new ArenaNavigation(room);
});

function route(from: ReturnType<typeof p>, to: ReturnType<typeof p>) {
  const path = nav.path(from, to);
  const arrived = path.at(-2);
  const label = JSON.stringify({ from, to });
  expect(arrived, label).toBeDefined();
  expect(arrived!.y, label).toBeCloseTo(to.y);
  expect(Math.hypot(arrived!.x - to.x, arrived!.z - to.z), label).toBeLessThan(
    1,
  );
  return path;
}

const exit = { ...room.doors.find((d) => d.role === 'exit')!.position, y: 0 };
const gallery = p(-10.25, 3.2, 0.25);
const bridge = p(8.25, 4, 0.25);
const walkway = p(17.25, 4, -19.75);
const balcony = p(8.25, 3.2, -28.25);
it('od wejścia dociera do 16 spawnów, progów i każdego biegu', () => {
  expect(room.spawnPoints).toHaveLength(16);
  for (const goal of [
    ...room.spawnPoints.map(({ x, z }) => p(x, 0, z)),
    exit,
    p(4, 0, 25),
    p(-20, 0, 22),
    p(4, 0, 22),
    p(-11.25, 2.6, 26.25),
    gallery,
    p(-10.25, 1.52, 7.25),
    bridge,
    walkway,
    p(17.25, 2.25, 11.25),
    p(5.25, 2, -6.75),
    balcony,
    p(23.25, 1.5, -28.25),
  ])
    route(room.playerSpawn, goal);
});

it('zamyka górną pętlę przez most, targ i balkon na wysokości co najmniej 3,2 m', () => {
  const loop = [
    gallery,
    bridge,
    walkway,
    balcony,
    p(-10.25, 3.2, -25.25),
    gallery,
  ];
  for (const [i, goal] of loop.slice(1).entries()) {
    const from = loop[i]!;
    const path = route(from, goal);
    expect(Math.min(...path.map((pt) => pt.y))).toBeGreaterThanOrEqual(
      3.2 - 1e-6,
    );
    // Wyklucza obejście zerwanego łącznika pozostałymi trzema bokami pętli.
    for (const pt of path) {
      expect(pt.x).toBeGreaterThanOrEqual(Math.min(from.x, goal.x) - 2);
      expect(pt.x).toBeLessThanOrEqual(Math.max(from.x, goal.x) + 2);
      expect(pt.z).toBeGreaterThanOrEqual(Math.min(from.z, goal.z) - 2);
      expect(pt.z).toBeLessThanOrEqual(Math.max(from.z, goal.z) + 2);
    }
  }
});

it.each([
  [-20, -20],
  [4, 25],
])('przechodzi dołem przez progi X=%s i X=%s', (first, second) => {
  const steps = [room.playerSpawn, p(first, 0, 22), p(second, 0, -22), exit];
  for (const [i, goal] of steps.slice(1).entries()) {
    const path = route(steps[i]!, goal);
    expect(path.every((pt) => Math.abs(pt.y) < 1e-5)).toBe(true);
    if (i === 1)
      expect(path.every((pt) => (first < 0 ? pt.x < -6 : pt.x > -6))).toBe(
        true,
      );
  }
});
