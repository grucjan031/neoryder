import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Rng } from '../../src/core/rng';
import { RARITIES, type NodeType } from '../../src/core/runTypes';
import { loadImplantDefinitions } from '../../src/progression/implants';
import { offerReward } from '../../src/progression/rewards';
import { RunEconomy } from '../../src/progression/runEconomy';
import { stockShop } from '../../src/progression/shop';
import { RunManager } from '../../src/world/run';
import { kuroganeSector } from '../../src/world/sectors';

const definitions = loadImplantDefinitions(
  RARITIES.flatMap((rarity, index) =>
    Array.from({ length: 6 }, (_, i) => ({
      id: `${rarity}${i}`,
      name: `${rarity}${i}`,
      rarity,
      tags: ['#melee'],
      modifiers: [],
      ...(index < 3 ? { upgradesTo: `${RARITIES[index + 1]}${i}` } : {}),
    })),
  ),
);
function setup(type: NodeType = 'combat', defs = definitions) {
  const bus = new EventBus();
  const run = new RunManager(bus, {
    sector: kuroganeSector,
    generateMap: () => ({
      sectorId: 'kurogane',
      layers: [
        [{ id: 'node', layer: 1, index: 0, type, next: ['boss'] }],
        [{ id: 'boss', layer: 2, index: 0, type: 'boss', next: [] }],
      ],
    }),
  });
  run.newRun('economy');
  run.selectNode('node');
  run.completeRoom({ hp: 37 });
  const economy = new RunEconomy(run, bus, kuroganeSector, defs);
  return { run, economy, bus };
}
describe('run economy', () => {
  it('offers deterministic unique unowned implants without consuming the parent RNG', () => {
    const { run, economy, bus } = setup();
    const event = vi.fn();
    bus.on('reward_offered', event);
    run.addImplant('common0');
    const rng = new Rng('seed');
    const before = rng.getState();
    const first = offerReward(
      run.state,
      'combat',
      rng,
      kuroganeSector,
      definitions,
    );
    rng.next();
    expect(
      offerReward(run.state, 'combat', rng, kuroganeSector, definitions),
    ).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first).size).toBe(3);
    expect(first).not.toContain('common0');
    expect(before).not.toBe(rng.getState());
    economy.offerReward();
    economy.offerReward();
    expect(event).toHaveBeenCalledTimes(1);
    expect(economy.chooseReward('unknown')).toBe(false);
    expect(economy.chooseReward(economy.offerReward()[0])).toBe(true);
    expect(run.state.implants).toHaveLength(2);
    expect(economy.chooseReward(first[0])).toBe(false);
  });
  it.each(['combat', 'elite'] as const)(
    '%s rarity distribution matches the data over 10000 offers',
    (type) => {
      const { run } = setup(type);
      const counts = Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]));
      for (let i = 0; i < 10000; i++) {
        const id = offerReward(
          run.state,
          type,
          new Rng(`seed${i}`),
          kuroganeSector,
          definitions,
        )[0]!;
        counts[definitions.get(id)!.rarity]!++;
      }
      const weights = kuroganeSector.rewardWeights![type]!;
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      for (const rarity of RARITIES)
        expect(
          Math.abs(counts[rarity]! / 10000 - (weights[rarity] ?? 0) / total),
        ).toBeLessThan(0.02);
      const score = RARITIES.reduce(
        (sum, rarity, i) => sum + (i * (weights[rarity] ?? 0)) / total,
        0,
      );
      expect(score).toBe(type === 'combat' ? 0.35 : 1.15);
    },
  );
  it('falls back safely to credits on an exhausted pool, once', () => {
    const { run, economy } = setup('combat', new Map());
    expect(economy.offerReward()).toEqual([]);
    expect(economy.chooseReward()).toBe(true);
    expect(run.state.credits).toBe(kuroganeSector.economy!.puzzleCredits);
    expect(economy.chooseReward()).toBe(false);
  });
  it('shop prices, purchases, stock, healing cap and event are enforced', () => {
    const { run, economy, bus } = setup('shop');
    const event = vi.fn();
    bus.on('shop_purchase', event);
    const offers = economy.stockShop();
    expect(offers).toEqual(
      stockShop(
        run.state,
        new Rng(run.state.seed),
        kuroganeSector,
        definitions,
      ),
    );
    expect(new Set(offers.map((item) => item.id)).size).toBe(3);
    for (const item of offers)
      expect(item.price).toBe(
        kuroganeSector.economy!.shopPrices[definitions.get(item.id)!.rarity],
      );
    expect(economy.buy(offers[0]!.id)).toBe(false);
    run.addCredits(1000);
    const before = run.state.credits;
    expect(economy.buy(offers[0]!.id)).toBe(true);
    expect(run.state.credits).toBe(before - offers[0]!.price);
    expect(economy.buy(offers[0]!.id)).toBe(false);
    expect(economy.stockShop()).toHaveLength(2);
    expect(economy.buy('invalid')).toBe(false);
    run.setHp(99);
    expect(economy.buy('heal')).toBe(true);
    expect(run.state.hp).toBe(100);
    expect(economy.buy('heal')).toBe(false);
    expect(event).toHaveBeenCalledTimes(2);
  });
  it('rest replaces an upgradeable implant, never duplicates it, and permits one choice', () => {
    const { run, economy, bus } = setup('rest');
    const event = vi.fn();
    bus.on('rest_used', event);
    run.addImplant('common0');
    run.addImplant('legendary0');
    expect(economy.upgradeOptions()).toEqual(['common0']);
    expect(economy.rest('upgrade', 'legendary0')).toBe(false);
    expect(economy.rest('upgrade', 'common0')).toBe(true);
    expect(run.state.implants).toEqual(['rare0', 'legendary0']);
    expect(run.state.hp).toBe(37);
    expect(economy.rest('heal')).toBe(false);
    expect(event).toHaveBeenCalledOnce();
  });
  it('rest heals explicitly, with no passive healing in step or transitions', () => {
    const { run, economy } = setup('rest');
    run.step(1000);
    expect(run.state.hp).toBe(37);
    expect(economy.rest('heal')).toBe(true);
    expect(run.state.hp).toBe(77);
    run.step(1000);
    expect(run.state.hp).toBe(77);
  });
  it('credits use threat costs, elite bonus and puzzle amount from sector data', () => {
    const elite = setup('elite');
    expect(elite.run.state.credits).toBe(
      kuroganeSector.economy!.eliteBonusCredits,
    );
    expect(elite.run.creditKill(3)).toBe(
      3 * kuroganeSector.economy!.creditsPerThreat,
    );
    expect(setup('puzzle').run.state.credits).toBe(
      kuroganeSector.economy!.puzzleCredits,
    );
  });
});

it('health modifiers use Stats and upgrades add only the increase in maximum', () => {
  const defs = loadImplantDefinitions([
    {
      id: 'hp',
      name: 'HP',
      rarity: 'common',
      tags: [],
      modifiers: [{ stat: 'maxHealth', type: 'flat', value: 20 }],
      upgradesTo: 'hpRare',
    },
    {
      id: 'hpRare',
      name: 'HP+',
      rarity: 'rare',
      tags: [],
      modifiers: [{ stat: 'maxHealth', type: 'flat', value: 30 }],
    },
  ]);
  const { run, economy } = setup('rest', defs);
  expect(economy.addDebugImplant('hp')).toBe(true);
  expect(run.state.hp).toBe(57);
  expect(economy.maxHealth()).toBe(120);
  expect(economy.rest('upgrade', 'hp')).toBe(true);
  expect(run.state.implants).toEqual(['hpRare']);
  expect(run.state.hp).toBe(67);
  expect(economy.maxHealth()).toBe(130);
});
it('rest excludes upgrade targets already owned', () => {
  const { run, economy } = setup('rest');
  run.addImplant('common0');
  run.addImplant('rare0');
  expect(economy.upgradeOptions()).not.toContain('common0');
  expect(economy.rest('upgrade', 'common0')).toBe(false);
  run.setHp(99);
  expect(economy.rest('heal')).toBe(true);
  expect(run.state.hp).toBe(100);
});
