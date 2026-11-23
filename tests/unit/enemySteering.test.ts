import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../src/core/math';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { EnemyBatch, initEnemySim } from '../../src/world/enemyBatch';
import { roomDefinitions } from '../../src/world/rooms';

const CLEARANCE = 0.45;

/** Płaska podłoga 16 x 16 (komórki 1 m) i opcjonalna ściana 1 x 1 w komórce (0, 1). */
function flatRoom(wall: boolean, floorX = 16) {
  const room = structuredClone(roomDefinitions.get('arenaPowerPlant')!);
  room.arena!.navigationCellM = 1;
  room.arena!.navigationClearanceM = CLEARANCE;
  const floor = {
    ...room.blocks.find((b) => b.walkable)!,
    position: { x: 0, y: -0.5, z: 0 },
    size: { x: floorX, y: 1, z: 16 },
    rotation: undefined,
  };
  room.blocks = [floor];
  if (wall)
    room.blocks.push({
      ...floor,
      walkable: false,
      position: { x: 0.5, y: 1, z: 1.5 },
      size: { x: 1, y: 2, z: 1 },
    });
  return room;
}

function waypoint(
  room: ReturnType<typeof flatRoom>,
  start: Vec3,
  goal: Vec3,
  reference = false,
) {
  const nav = new ArenaSurfaceNavigation(room);
  const batch = new EnemyBatch(nav.batchGraph(), reference);
  try {
    const agent = { current: { position: start }, moveGoal: goal };
    batch.run([agent], 1, 12);
    return agent as {
      moveGoal: Vec3;
      moveGoalFinal?: boolean;
      current: { position: Vec3 };
    };
  } finally {
    batch.dispose();
  }
}

/** Odległość odcinka od prostokąta XZ (próbkowanie gęstsze niż 1 mm). */
function distanceToRect(a: Vec3, b: Vec3, r: [number, number, number, number]) {
  let min = Infinity;
  const steps = 4000;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const z = a.z + ((b.z - a.z) * i) / steps;
    min = Math.min(
      min,
      Math.hypot(
        Math.max(r[0] - x, 0, x - r[1]),
        Math.max(r[2] - z, 0, z - r[3]),
      ),
    );
  }
  return min;
}

describe('skracanie trasy z uwzględnieniem grubości kapsuły', () => {
  it.each([true, false])(
    'nie ścina narożnika ściany dla pozycji ciągłych (referencja TS: %s)',
    async (reference) => {
      await initEnemySim();
      const room = flatRoom(true);
      // Ściana zajmuje x 0..1, z 1..2; trasa (0,0) -> (1,0) -> (1,1) biegnie tuż przy jej narożniku.
      const goal = { x: 1.5, y: 0, z: 1.5 };
      for (const x of [0.5, 0.501, 0.52, 0.6, 0.75, 0.9, 0.99])
        for (const z of [0.2, 0.5, 0.8, 0.99]) {
          const start = { x, y: 0, z };
          const result = waypoint(room, start, goal, reference);
          const distance = distanceToRect(start, result.moveGoal, [0, 1, 1, 2]);
          expect(distance, JSON.stringify(start)).toBeGreaterThanOrEqual(
            Math.min(CLEARANCE, distanceToRect(start, start, [0, 1, 1, 2])) -
              1e-6,
          );
        }
    },
  );

  it('nie prowadzi wzdłuż krawędzi przepaści bliżej niż prześwit', async () => {
    await initEnemySim();
    // Podłoga x -3..3: komórka (2, ·) jest ostatnią, dalej przepaść.
    const room = flatRoom(false, 6);
    const start = { x: 2.85, y: 0, z: 0.5 };
    const goal = { x: 2.6, y: 0, z: 3.5 };
    const result = waypoint(room, start, goal);
    expect(result.moveGoal).not.toEqual(goal);
    expect(
      distanceToRect(start, result.moveGoal, [3, 4, -8, 8]),
    ).toBeGreaterThan(0.1);
    const center = waypoint(
      room,
      { x: 2.5, y: 0, z: 0.5 },
      { x: 2.5, y: 0, z: 3.5 },
    );
    expect(center.moveGoal).toEqual({ x: 2.5, y: 0, z: 3.5 });
  });

  it('wciąż skraca w otwartym polu i oznacza cel końcowy', async () => {
    await initEnemySim();
    const room = flatRoom(false);
    const start = { x: 0.53, y: 0, z: 0.5 };
    const goal = { x: 3.5, y: 0, z: 3.5 };
    const result = waypoint(room, start, goal);
    expect(result.moveGoal).toEqual(goal);
    expect(result.moveGoalFinal).toBe(true);
  });

  it('węzeł pośredni nie jest celem końcowym', async () => {
    await initEnemySim();
    const result = waypoint(
      flatRoom(true),
      { x: 0.5, y: 0, z: 0.5 },
      { x: 0.5, y: 0, z: 3.5 },
    );
    expect(result.moveGoal).not.toEqual({ x: 0.5, y: 0, z: 3.5 });
    expect(result.moveGoalFinal).toBe(false);
  });

  it('start tuż za granicą komórki prowadzi do jej środka', async () => {
    await initEnemySim();
    const room = flatRoom(true);
    // Komórka (0, 1) odrzucona; start w niej jest rozwiązywany do komórki obok.
    const start = { x: 0.5, y: 0, z: 1.0 };
    const goal = { x: 0.5, y: 0, z: 4.5 };
    const result = waypoint(room, start, goal);
    expect(result.moveGoalFinal).toBe(false);
  });
});
