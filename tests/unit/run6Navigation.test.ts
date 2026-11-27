import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';
import { tuning } from '../../src/core/tuning';
const room = roomDefinitions.get('run6')!;
const nav = new ArenaNavigation(room);
const point = (x: number, z: number, y = 0) => ({ x, y, z });
function reach(a: ReturnType<typeof point>, b: ReturnType<typeof point>) {
  const path = nav.path(a, b),
    arrived = path.at(-2);
  expect(arrived, JSON.stringify([a, b])).toBeDefined();
  expect(
    Math.hypot(arrived!.x - b.x, arrived!.z - b.z),
    JSON.stringify(b),
  ).toBeLessThan(1);
  expect(arrived!.y).toBeCloseTo(b.y, 1);
  return path;
}
it('łączy start z windą i osiemnastoma kieszeniami na dwóch poziomach', () => {
  expect(room.spawnPoints).toHaveLength(18);
  expect(room.spawnPoints.filter((p) => p.y === 4.2)).toHaveLength(2);
  for (const p of [...room.spawnPoints, point(14, -38.5)])
    reach(room.playerSpawn, point(p.x, p.z, p.y));
});
it('generator zapisuje osiem stref targu', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import build from './tools/arenas/run/run6.mjs';console.log(JSON.stringify(build().metadata.zones.map(z=>z.kind)))",
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(result)).toEqual([
    'interior',
    'dense',
    'interior',
    'dense',
    'interior',
    'open',
    'high',
    'open',
  ]);
});
it('domyka górną pętlę i pokonuje trzy rampy bez objazdu', () => {
  const upper = [
    [-17, -32],
    [-6, -24],
    [-6, -16],
    [7.5, -16],
    [7.5, 5.5],
    [-7.5, 5.5],
    [-7.5, -16],
    [-6, -16],
  ];
  for (const [i, [x, z]] of upper.slice(1).entries()) {
    const a = upper[i]!;
    expect(
      reach(point(a[0]!, a[1]!, 4.2), point(x!, z!, 4.2)).every(
        (p) => p.y >= 4.199,
      ),
    ).toBe(true);
  }
  for (const [a, b] of [
    [point(-28, -15), point(-28, -27, 4.2)],
    [point(28.5, -16), point(16.5, -16, 4.2)],
    [point(4.2, 18), point(4.2, 6, 4.2)],
  ] as const) {
    const path = reach(a, b);
    expect(path.some((p) => p.y > 1 && p.y < 3.5)).toBe(true);
    expect(path.every((p) => Math.hypot(p.x - a.x, p.z - a.z) < 14)).toBe(true);
  }
});
function footprint(b: (typeof room.blocks)[number]) {
  const swap = Math.abs(Math.cos(b.rotation?.y ?? 0)) < 0.001;
  return {
    x: b.position.x,
    z: b.position.z,
    hx: (swap ? b.size.z : b.size.x) / 2,
    hz: (swap ? b.size.x : b.size.z) / 2,
  };
}
it('kapsuły posiłków i gracza mieszczą się między przeszkodami', () => {
  for (const p of [room.playerSpawn, ...room.spawnPoints]) {
    const y = p.y ?? 0;
    for (const b of room.blocks) {
      if (
        b.position.y - b.size.y / 2 >= y + tuning.player.capsuleHeight ||
        b.position.y + b.size.y / 2 <= y + 0.05
      )
        continue;
      const r = footprint(b);
      expect(
        Math.hypot(
          Math.max(0, Math.abs(p.x - r.x) - r.hx),
          Math.max(0, Math.abs(p.z - r.z) - r.hz),
        ),
        JSON.stringify([p, b]),
      ).toBeGreaterThanOrEqual(tuning.player.capsuleRadius);
    }
  }
});
it('każdy kwadrat większy niż osiem metrów zawiera osłonę', () => {
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
  let prev = new Uint16Array(121);
  for (let j = 0; j < 144; j++) {
    const row = new Uint16Array(121);
    for (let i = 1; i <= 120; i++) {
      const x = -30 + (i - 0.5) * 0.5,
        z = -38 + (j + 0.5) * 0.5;
      if (
        covers.some(
          (b) =>
            Math.abs(x - b.x) <= b.hx + 0.2 && Math.abs(z - b.z) <= b.hz + 0.2,
        )
      )
        continue;
      row[i] = 1 + Math.min(row[i - 1]!, prev[i]!, prev[i - 1]!);
      expect(row[i]! * 0.5, JSON.stringify([x, z])).toBeLessThanOrEqual(8);
    }
    prev = row;
  }
});
