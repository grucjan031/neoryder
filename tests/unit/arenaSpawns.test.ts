import { expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { selectArenaSpawn, spawnOcclusion } from '../../src/world/arenaSpawns';
import { initPhysics } from '../../src/physics';

const point = (x: number, z = 0) => ({ x, y: 0, z });
const player = point(0);
const ring = { minM: 30, maxM: 90 };

it('wykrywa ścianę Rapiera pomiędzy okiem a spawnem', async () => {
  const rapier = await initPhysics();
  const world = new rapier.World({ x: 0, y: 0, z: 0 });
  try {
    world.createCollider(
      rapier.ColliderDesc.cuboid(1, 2, 2).setTranslation(12, 1, 0),
    );
    world.step();
    const occluded = spawnOcclusion(
      { ...player, y: 1.5 },
      1.5,
      (origin, direction, length) =>
        world.castRay(new rapier.Ray(origin, direction), length, true)
          ?.timeOfImpact ?? null,
    );
    expect(occluded(point(40))).toBe(true);
    expect(occluded(point(40, 30))).toBe(false);
    expect(
      selectArenaSpawn(
        ring,
        [point(40), point(40, 30)],
        player,
        [point(40, 30)],
        new Rng('spawn'),
        occluded,
      ),
    ).toEqual(point(40));
  } finally {
    world.free();
  }
});

it('wybiera blisko spornego celu i preferuje zasłonięte spawny wewnątrz pierścienia', () => {
  const spawns = [point(20), point(40), point(65), point(80), point(100)];
  const target = point(81);
  expect(
    selectArenaSpawn(ring, spawns, player, [target], new Rng('spawn')),
  ).toEqual(point(80));
  expect(
    selectArenaSpawn(
      ring,
      spawns,
      player,
      [target],
      new Rng('spawn'),
      (p) => p.x !== 80,
    ),
  ).toEqual(point(65));
  expect(
    selectArenaSpawn(
      ring,
      spawns,
      player,
      [target],
      new Rng('spawn'),
      (p) => p.x === 100,
    ),
  ).toEqual(point(80));
});

it('wraca do najbliższego bezpiecznego spawnu poza zewnętrzną krawędzią', () => {
  expect(
    selectArenaSpawn(
      ring,
      [point(12), point(110), point(100)],
      player,
      [point(110)],
      new Rng('spawn'),
    ),
  ).toEqual(point(100));
  expect(
    selectArenaSpawn(ring, [point(12)], player, [], new Rng('spawn')),
  ).toBeNull();
});

it('rozstrzyga remisy deterministycznym strumieniem RNG', () => {
  const positions = [point(30, 40), point(-30, 40)];
  const sequence = (seed: string) => {
    const rng = new Rng(seed);
    return Array.from(
      { length: 24 },
      () => selectArenaSpawn(ring, positions, player, [], rng)?.x,
    );
  };
  expect(sequence('spawn')).toEqual(sequence('spawn'));
  expect(new Set(sequence('spawn')).size).toBe(2);
});
