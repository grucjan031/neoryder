import { expect, it } from 'vitest';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';
import { tuning } from '../../src/core/tuning';
const room = roomDefinitions.get('run5')!;
const nav = new ArenaNavigation(room);
const point = (x: number, z: number, y = 0) => ({ x, y, z });
function reach(from: ReturnType<typeof point>, goal: ReturnType<typeof point>) {
  const path = nav.path(from, goal);
  const arrived = path.at(-2);
  expect(arrived, JSON.stringify(goal)).toBeDefined();
  expect(arrived!.y).toBeCloseTo(goal.y, 1);
  expect(
    Math.hypot(arrived!.x - goal.x, arrived!.z - goal.z),
    JSON.stringify(goal),
  ).toBeLessThan(1);
  return path;
}
it('dociera do windy, ośmiu sal i wszystkich spawnów na właściwym piętrze', () => {
  expect(room.spawnPoints).toHaveLength(18);
  expect(room.spawnPoints.filter((p) => p.y === 4.4)).toHaveLength(2);
  const goals = [
    point(0, -38.5),
    point(-1, 27),
    point(-24, 24),
    point(19, 19),
    point(-15, 12),
    point(0, 12),
    point(-16, 3.8),
    point(19, -3),
    point(0, -23),
  ];
  for (const p of [...goals, ...room.spawnPoints])
    reach(room.playerSpawn, point(p.x, p.z, p.y));
});
it('przechodzi po antresoli i pokonuje wszystkie cztery rampy bez objazdów', () => {
  const upper = [
    point(-22, -10, 4.4),
    point(0, -10, 4.4),
    point(0, -29, 4.4),
    point(10, -33, 4.4),
  ];
  for (const [i, b] of upper.slice(1).entries())
    expect(reach(upper[i]!, b).every((p) => p.y >= 4.399)).toBe(true);
  for (const s of [-1, 1])
    for (const [a, b] of [
      [point(s * 26, -23), point(s * 26, -11, 4.4)],
      [point(s * 23, -33), point(s * 11, -33, 4.4)],
    ] as const) {
      const path = reach(a, b);
      expect(path.some((p) => p.y > 1 && p.y < 3.5)).toBe(true);
      for (const p of path)
        expect(Math.hypot(p.x - a.x, p.z - a.z)).toBeLessThan(14);
    }
});
function footprint(b: (typeof room.blocks)[number]) {
  const quarter = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 0.001;
  return {
    x: b.position.x,
    z: b.position.z,
    hx: (quarter ? b.size.z : b.size.x) / 2,
    hz: (quarter ? b.size.x : b.size.z) / 2,
  };
}
it('kapsuła mieści się na starcie i przy każdym spawnie', () => {
  for (const p of [room.playerSpawn, ...room.spawnPoints]) {
    const y = p.y ?? 0;
    for (const b of room.blocks) {
      if (
        b.position.y - b.size.y / 2 >= y + tuning.player.capsuleHeight ||
        b.position.y + b.size.y / 2 <= y + 0.05
      )
        continue;
      const { x, z, hx, hz } = footprint(b);
      expect(
        Math.hypot(
          Math.max(Math.abs(p.x - x) - hx, 0),
          Math.max(Math.abs(p.z - z) - hz, 0),
        ),
        JSON.stringify(p),
      ).toBeGreaterThanOrEqual(tuning.player.capsuleRadius);
    }
  }
});
it('na posadzce nie ma pustego kwadratu większego niż 8 m', () => {
  const covers = room.blocks
    .filter(
      (b) =>
        !b.walkable &&
        !b.ceiling &&
        b.visible !== false &&
        b.size.y >= 0.8 &&
        b.position.y - b.size.y / 2 <= 1.2 &&
        b.position.y + b.size.y / 2 > 0.8,
    )
    .map(footprint);
  // Największy pusty kwadrat na siatce półmetrowej, tak samo jak w run3.
  let prev = new Uint16Array(113);
  for (let j = 0; j < 144; j++) {
    const row = new Uint16Array(113);
    for (let i = 1; i <= 112; i++) {
      const x = -28 + (i - 0.5) * 0.5,
        z = -38 + (j + 0.5) * 0.5;
      if (
        covers.some(
          (b) =>
            Math.abs(x - b.x) <= b.hx + 0.2 && Math.abs(z - b.z) <= b.hz + 0.2,
        )
      )
        continue;
      row[i] = 1 + Math.min(row[i - 1]!, prev[i]!, prev[i - 1]!);
      expect(
        row[i]! * 0.5,
        `pusty kwadrat kończy się w (${x}, ${z})`,
      ).toBeLessThanOrEqual(8);
    }
    prev = row;
  }
});
