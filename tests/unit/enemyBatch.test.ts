import { expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { SimGraph } from '../../src/wasm/neoryder-sim/neoryder_sim';
import { ArenaSurfaceNavigation } from '../../src/world/arenaSurfaceNavigation';
import { EnemyBatch, initEnemySim, NO_CELL } from '../../src/world/enemyBatch';
import { roomDefinitions } from '../../src/world/rooms';
import { arenaSpawnPoints } from '../../src/world/arenaSpawns';

it('zachowuje ścieżki BFS, remisy i kolejność sąsiadów po kompilacji do WASM', async () => {
  expect(await initEnemySim()).toBe(true);
  const room = roomDefinitions.get('arenaPowerPlant')!;
  const nav = new ArenaSurfaceNavigation(room);
  const graph = nav.batchGraph();
  const native = new SimGraph(graph.offsets, graph.edges);
  const reference = new EnemyBatch(graph, true);
  const batch = new EnemyBatch(graph);
  const rng = new Rng('enemy-wasm-parity');
  const points = arenaSpawnPoints(room);
  try {
    for (let test = 0; test < 5; test++) {
      const agents = Array.from({ length: 60 }, () => ({
        current: {
          position: {
            ...rng.pick(points),
            x: rng.pick(points).x + rng.float(-1, 1),
          },
        },
        moveGoal: rng.pick(room.arena!.points).position,
      }));
      agents[1]!.current.position = { ...agents[0]!.current.position };
      agents[2]!.current.position.x = 100000;
      const copy = structuredClone(agents);
      expect(batch.run(agents, 2, 8)).toEqual(reference.run(copy, 2, 8));
      expect(agents).toEqual(copy);
      const start = rng.pick(points),
        goal = rng.pick(room.arena!.points).position;
      const ids = nav
        .path(start, goal)
        .slice(1, -1)
        .map((p) => graph.locate(p)!);
      expect(ids.length).toBeGreaterThan(0);
      const result = native.frame(
        Uint32Array.of(graph.locate(start)!, graph.locate(goal)!),
        Float32Array.of(start.x, start.z),
        1,
        ids.length + 1,
      );
      expect(Array.from(result.slice(0, ids.length + 1))).toEqual([
        ...ids,
        NO_CELL,
      ]);
    }
  } finally {
    native.free();
    reference.dispose();
    batch.dispose();
  }
});

it('skraca zakręt w otwartym prostokącie i respektuje przerwę w powierzchni', async () => {
  await initEnemySim();
  const room = structuredClone(roomDefinitions.get('arenaPowerPlant')!);
  room.arena!.navigationCellM = 1;
  room.blocks = [
    {
      ...room.blocks.find((b) => b.walkable)!,
      position: { x: 0, y: -0.5, z: 0 },
      size: { x: 16, y: 1, z: 16 },
      rotation: undefined,
    },
  ];
  const start = { x: 0.5, y: 0, z: 0.5 },
    goal = { x: 3.5, y: 0, z: 3.5 };
  for (const blocked of [false, true]) {
    if (blocked)
      room.blocks.push({
        ...room.blocks[0]!,
        walkable: false,
        position: { x: 2, y: 1, z: 2 },
        size: { x: 1, y: 2, z: 1 },
      });
    const nav = new ArenaSurfaceNavigation(room);
    const path = nav.path(start, goal);
    const batch = new EnemyBatch(nav.batchGraph());
    try {
      const agent = { current: { position: start }, moveGoal: goal };
      batch.run([agent], 1, 12);
      if (blocked) expect(agent.moveGoal).not.toEqual(goal);
      else {
        expect(agent.moveGoal).toEqual(goal);
        const length = path
          .slice(1)
          .reduce(
            (sum, p, i) => sum + Math.hypot(p.x - path[i]!.x, p.z - path[i]!.z),
            0,
          );
        expect(Math.hypot(goal.x - start.x, goal.z - start.z)).toBeLessThan(
          length,
        );
      }
    } finally {
      batch.dispose();
    }
  }
});
