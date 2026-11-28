import { expect, it } from 'vitest';
import { tuning } from '../../src/core/tuning';
import type { Vec3 } from '../../src/core/math';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run3')!;
const nav = new ArenaNavigation(room);
const civilians = room.civilians ?? [];
const hideSpots = room.hideSpots ?? [];
const areas = [
  { id: 'P3', x0: 10, x1: 26, z0: 14, z1: 28, y: 0 },
  { id: 'P4', x0: 10, x1: 26, z0: 0, z1: 14, y: 0 },
  { id: 'B1', x0: -20, x1: 20, z0: -44, z1: 0, y: -5.2 },
];

function reach(from: Vec3, to: Vec3) {
  const path = nav.path(from, to);
  const label = `${JSON.stringify(from)} -> ${JSON.stringify(to)}`;
  expect(path.length, label).toBeGreaterThan(2);
  // Ostatni punkt jest dopisywanym celem; sprawdzamy też komórki siatki.
  for (const [point, target] of [
    [path[0]!, from],
    [path.at(-2)!, to],
  ] as const) {
    expect(point.y, label).toBeCloseTo(target.y, 1);
    expect(
      Math.hypot(point.x - target.x, point.z - target.z),
      label,
    ).toBeLessThan(0.75);
  }
}

it('run3: sześciu naukowców ma po cztery osiągalne kryjówki w swoim pomieszczeniu', () => {
  expect(room.civilians).toHaveLength(6);
  expect(room.hideSpots).toHaveLength(12);
  expect(civilians.every((c) => c.id === 'scientist')).toBe(true);
  for (const area of areas) {
    const inside = (p: Vec3) =>
      p.y === area.y &&
      p.x > area.x0 &&
      p.x < area.x1 &&
      p.z > area.z0 &&
      p.z < area.z1;
    const areaCivilians = civilians.filter((c) => inside(c.position));
    const hides = hideSpots.filter(inside);
    expect(areaCivilians, area.id).toHaveLength(2);
    expect(hides, area.id).toHaveLength(4);
    for (const civilian of areaCivilians) {
      reach(room.playerSpawn, civilian.position);
      for (const hide of hides) reach(civilian.position, hide);
    }
  }
});

it('run3: naukowcy i kryjówki mają podparcie, wolną kapsułę i odstęp od spawnów, portali oraz ramp', () => {
  const { radiusM: radius, bodyHeightM: height } = tuning.civilians;
  const points = [...civilians.map((c) => c.position), ...hideSpots];
  for (const p of points) {
    const label = JSON.stringify(p);
    expect(
      room.blocks.some(
        (b) =>
          b.walkable &&
          !b.rotation &&
          Math.abs(b.position.y + b.size.y / 2 - p.y) < 0.01 &&
          Math.abs(p.x - b.position.x) < b.size.x / 2 - radius &&
          Math.abs(p.z - b.position.z) < b.size.z / 2 - radius,
      ),
      label,
    ).toBe(true);
    const hits = room.blocks.filter((b) => {
      if (
        b.position.y + b.size.y / 2 <= p.y + 0.05 ||
        b.position.y - b.size.y / 2 >= p.y + height
      )
        return false;
      const yaw = b.rotation?.y ?? 0;
      const dx = p.x - b.position.x,
        dz = p.z - b.position.z;
      const x = dx * Math.cos(yaw) - dz * Math.sin(yaw);
      const z = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      return (
        Math.hypot(
          Math.max(Math.abs(x) - b.size.x / 2, 0),
          Math.max(Math.abs(z) - b.size.z / 2, 0),
        ) < radius
      );
    });
    expect(
      hits.map((b) => b.model ?? b.material),
      label,
    ).toEqual([]);
    for (const spawn of [room.playerSpawn, ...room.spawnPoints]) {
      if (Math.abs((spawn.y ?? 0) - p.y) < 1)
        expect(Math.hypot(p.x - spawn.x, p.z - spawn.z), label).toBeGreaterThan(
          1.5,
        );
    }
    for (const door of room.doors)
      expect(
        Math.hypot(p.x - door.position.x, p.z - door.position.z),
        label,
      ).toBeGreaterThan(3);
    for (const ramp of room.blocks.filter(
      (b) => b.rotation?.x || b.rotation?.z,
    )) {
      expect(
        Math.abs(p.x - ramp.position.x) > ramp.size.x / 2 + radius ||
          Math.abs(p.z - ramp.position.z) > ramp.size.z / 2 + radius,
        label,
      ).toBe(true);
    }
  }
});
