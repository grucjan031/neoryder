import type { Vec3 } from '../../src/core/math';
import type { PointId } from '../../src/world/modeSchema';
import { loadRoom } from '../../src/world/roomSchema';
import { roomDefinitions } from '../../src/world/rooms';

export function largeArena() {
  const base = roomDefinitions.get('arenaOverpass')!;
  const slab = (x: number, z: number, w: number, d: number, top: number) => ({
    position: { x, y: top - 0.5, z },
    size: { x: w, y: 1, z: d },
    walkable: true,
  });
  const ramp = (start: number, end: number, high: number) => {
    const run = end - start;
    const rise = 6;
    const angle = Math.atan2(rise, run);
    return {
      ...slab(
        (start + end) / 2,
        -60,
        Math.hypot(run, rise),
        14,
        high - rise / 2,
      ),
      position: {
        x: (start + end) / 2,
        y: high - rise / 2 - 0.5 / Math.cos(angle),
        z: -60,
      },
      rotation: { x: 0, y: 0, z: angle },
    };
  };
  const points = [
    ['A', { x: -175, y: 0, z: -85 }],
    ['B', { x: 10, y: 6, z: -60 }],
    ['C', { x: 150, y: 12, z: -60 }],
    ['D', { x: 170, y: 0, z: 62 }],
    ['E', { x: -20, y: 0, z: 62 }],
  ] satisfies [PointId, Vec3][];
  const spawnPoints = Array.from({ length: 16 }, (_, i) => ({
    x: -200 + (i % 8) * 55,
    z: i < 8 ? 115 : -120,
  }));
  return loadRoom({
    id: 'large-arena-perf',
    name: 'Arena 450 × 300',
    type: 'combat',
    playerSpawn: { x: -55, y: 0, z: 95 },
    spawnPoints,
    doors: base.doors,
    blocks: [
      slab(0, 0, 450, 300, 0),
      slab(10, -60, 80, 44, 6),
      slab(157.5, -60, 105, 50, 12),
      ramp(-100, -30, 6),
      ramp(50, 105, 12),
    ],
    arena: {
      ...base.arena,
      navigationCellM: 2,
      maxAlive: 12,
      enemyTickets: 180,
      spawnRing: { minM: 30, maxM: 190 },
      spawnPoints,
      points: points.map(([id, position]) => ({ id, position, radiusM: 4 })),
    },
  });
}
