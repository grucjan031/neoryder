import { describe, expect, it } from 'vitest';
import yard from './fixtures/legacyYard.json';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { SIM_DT } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { arenaSpawnPoints, selectWaveSpawn } from '../../src/world/arenaSpawns';
import { loadRoom, roomSchema } from '../../src/world/roomSchema';
import { loadWaves, WaveDirector } from '../../src/world/waves';

/** Podest `walkable` z górną powierzchnią na y = 5.2 nad dziedzińcem. */
const deck = {
  size: { x: 6, y: 0.4, z: 6 },
  position: { x: 0, y: 5, z: 0 },
  walkable: true,
};
const withDeck = (extra: object[] = []) => ({
  ...yard,
  blocks: [...yard.blocks, deck, ...extra],
});

describe('spawn z y (F-01)', () => {
  it('przyjmuje punkt na górnej powierzchni bloku walkable', () => {
    const room = loadRoom({
      ...withDeck(),
      spawnPoints: [...yard.spawnPoints, { x: 1, y: 5.2, z: 1 }],
    });
    expect(room.spawnPoints.at(-1)?.y).toBe(5.2);
  });

  it('pokój bez y przechodzi jak dotąd, a y równe podłodze to punkt parterowy', () => {
    expect(loadRoom(yard)).toEqual(yard);
    expect(() =>
      loadRoom({
        ...yard,
        spawnPoints: [...yard.spawnPoints, { x: 0, y: 0, z: 0 }],
      }),
    ).not.toThrow();
  });

  it('odrzuca punkt w powietrzu i punkt w bloku', () => {
    for (const y of [4, 6.5, 5.0]) {
      const result = roomSchema.safeParse({
        ...withDeck(),
        spawnPoints: [...yard.spawnPoints, { x: 1, y, z: 1 }],
      });
      expect(result.success).toBe(false);
    }
    const blockedRoom = withDeck([
      {
        size: { x: 1, y: 3, z: 1 },
        position: { x: 1, y: 6.7, z: 1 },
      },
    ]);
    expect(() =>
      loadRoom({
        ...blockedRoom,
        spawnPoints: [...yard.spawnPoints, { x: 1, y: 5.2, z: 1 }],
      }),
    ).toThrow(/w bloku/);
  });

  it('odrzuca punkt poza obrysem podestu i podest bez walkable', () => {
    expect(() =>
      loadRoom({
        ...withDeck(),
        spawnPoints: [...yard.spawnPoints, { x: 5, y: 5.2, z: 5 }],
      }),
    ).toThrow(/walkable/);
    expect(() =>
      loadRoom({
        ...yard,
        blocks: [...yard.blocks, { ...deck, walkable: undefined }],
        spawnPoints: [...yard.spawnPoints, { x: 1, y: 5.2, z: 1 }],
      }),
    ).toThrow(/walkable/);
  });
});

describe('wysokość spawnu fal (F-01)', () => {
  const def = (spawnPoints: { x: number; y?: number; z: number }[]) =>
    loadWaves({
      id: 't',
      firstBreakS: 0,
      breakS: 1,
      maxAlive: 4,
      minSpawnDistance: 0,
      spawnPoints,
      waves: [{ spawnIntervalS: 0.1, groups: [{ enemy: 'a', count: 2 }] }],
    });
  const spawnAt = (spawnPoints: { x: number; y?: number; z: number }[]) => {
    const positions: Vec3[] = [];
    const director = new WaveDirector(
      def(spawnPoints),
      {
        spawn: (_enemy, position) => {
          positions.push(position);
          return positions.length;
        },
        playerPosition: () => ({ x: 0, y: 0, z: 0 }),
      },
      new EventBus(),
      new Rng('y'),
    );
    director.start();
    for (let i = 0; i < 120; i++) director.step(SIM_DT);
    return positions;
  };

  it('wróg pojawia się na wysokości punktu, a bez y na 0', () => {
    const high = spawnAt([{ x: 1, y: 5.2, z: 1 }]);
    expect(high).toHaveLength(2);
    expect(high.every((p) => p.y === 5.2)).toBe(true);
    const flat = spawnAt([{ x: 1, z: 1 }]);
    expect(flat.every((p) => p.y === 0)).toBe(true);
  });

  it('punkty pokoju zachowują y, a pokój bez y daje playerSpawn.y', () => {
    const room = loadRoom({
      ...withDeck(),
      spawnPoints: [...yard.spawnPoints, { x: 1, y: 5.2, z: 1 }],
    });
    expect(arenaSpawnPoints(room).at(-1)?.y).toBe(5.2);
    expect(arenaSpawnPoints(loadRoom(yard)).every((p) => p.y === 0)).toBe(true);
  });

  it('selektor spawnów zachowuje y punktu', () => {
    const point = selectWaveSpawn(
      [{ x: 10, y: 5.2, z: 0 }],
      { x: 0, y: 0, z: 0 },
      0,
      50,
      { path: (from) => [from, { x: 0, y: 0, z: 0 }] },
      () => true,
      new Rng('s'),
    );
    expect(point?.y).toBe(5.2);
  });
});
