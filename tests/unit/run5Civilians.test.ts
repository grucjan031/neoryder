import { expect, it } from 'vitest';
import type { Vec3 } from '../../src/core/math';
import { ArenaNavigation } from '../../src/world/arenaNavigation';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run5')!;
const nav = new ArenaNavigation(room);
const staff = room.civilians ?? [];
const hideSpots = room.hideSpots ?? [];
const wards = [
  { name: 'G3', minX: 10, maxX: 28, minZ: 6, maxZ: 34 },
  { name: 'G4', minX: -28, maxX: -10, minZ: 6, maxZ: 20 },
  { name: 'G5', minX: -10, maxX: 10, minZ: -8, maxZ: 20 },
];

it('rozmieszcza sześciu naukowców poza portalami i spawnami', () => {
  expect(staff).toHaveLength(6);
  expect(hideSpots).toHaveLength(12);
  expect(staff.every((s) => s.id === 'scientist')).toBe(true);
  const portals = room.decor?.filter((d) => d.model === 'bw_door_portal') ?? [];
  expect(portals.length).toBeGreaterThan(0);
  const points = [...staff.map((s) => s.position), ...hideSpots];
  expect(new Set(points.map((p) => JSON.stringify(p))).size).toBe(
    points.length,
  );
  for (const p of points) {
    for (const { position } of portals)
      expect(Math.hypot(p.x - position.x, p.z - position.z)).toBeGreaterThan(3);
    for (const spawn of [room.playerSpawn, ...room.spawnPoints])
      expect(
        Math.hypot(p.x - spawn.x, p.y - (spawn.y ?? 0), p.z - spawn.z),
      ).toBeGreaterThan(1.5);
  }
});

it.each(wards)(
  '$name: dwie osoby mają trasy do czterech kryjówek na posadzce',
  (ward) => {
    const inside = (p: Vec3) =>
      p.y === 0 &&
      p.x > ward.minX &&
      p.x < ward.maxX &&
      p.z > ward.minZ &&
      p.z < ward.maxZ;
    const people = staff.filter((s) => inside(s.position));
    const hides = hideSpots.filter(inside);
    expect(people).toHaveLength(2);
    expect(hides).toHaveLength(4);
    // Punkty leżą w środkach komórek z podparciem i prześwitem dla postaci.
    // Sprawdzamy ostatnią komórkę trasy, bo nawigacja dopisuje później żądany cel.
    for (const { position } of people) {
      expect(nav.path(room.playerSpawn, position).at(-2)).toEqual(position);
      for (const hide of hides) {
        const path = nav.path(position, hide);
        expect(path[0], JSON.stringify(hide)).toEqual(position);
        expect(path.at(-2)).toEqual(hide);
      }
    }
  },
);
