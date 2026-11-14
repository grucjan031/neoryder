import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import type { MapNode, RunState } from '../../src/core/runTypes';
import { implantDefinitions } from '../../src/progression/implants';
import { offerReward } from '../../src/progression/rewards';
import { stockShop } from '../../src/progression/shop';
import { roomDefinitions } from '../../src/world/rooms';
import { kuroganeSector } from '../../src/world/sectors';
import { generateSectorMap } from '../../src/world/sectorMap';
import { planWaves } from '../../src/world/threat';

const SEEDS = Array.from({ length: 25 }, (_, i) => `det-${i}`);

function stateFor(seed: string, node: MapNode): RunState {
  return {
    seed,
    sectorId: kuroganeSector.id,
    loadoutId: 'classic',
    startedAtMs: 0,
    elapsedS: 0,
    map: generateSectorMap(kuroganeSector, seed),
    currentNodeId: node.id,
    visited: [],
    hp: 100,
    energy: 0,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  };
}

function snapshot(seed: string) {
  const map = generateSectorMap(kuroganeSector, seed);
  const combatRooms = [...roomDefinitions.values()]
    .filter((room) => room.type === 'combat')
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    map,
    nodes: map.layers.flat().map((node) => {
      const state = stateFor(seed, node);
      const rng = () => new Rng(seed);
      return {
        id: node.id,
        reward: offerReward(
          state,
          node.type,
          rng(),
          kuroganeSector,
          implantDefinitions,
        ),
        shop: stockShop(state, rng(), kuroganeSector, implantDefinitions),
        waves:
          node.type === 'combat' || node.type === 'elite'
            ? planWaves(combatRooms[0]!, kuroganeSector, node, rng())
            : null,
      };
    }),
  };
}

describe('determinizm runu', () => {
  it('ten sam seed daje identyczną mapę, oferty i fale', () => {
    for (const seed of SEEDS) {
      expect(snapshot(seed)).toEqual(snapshot(seed));
    }
  });

  it('różne seedy dają różne mapy', () => {
    const maps = SEEDS.map((seed) =>
      JSON.stringify(generateSectorMap(kuroganeSector, seed)),
    );
    expect(new Set(maps).size).toBeGreaterThan(SEEDS.length / 2);
    expect(maps[0]).not.toEqual(maps[1]);
  });
});
