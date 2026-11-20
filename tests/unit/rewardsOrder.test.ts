import { expect, it } from 'vitest';
import type { Rng } from '../../src/core/rng';
import { drawImplants } from '../../src/progression/rewards';
import type { ImplantDefinition } from '../../src/progression/implants';
import type { SectorDefinition } from '../../src/world/sectorSchema';

it('kolejność puli nagród nie zależy od ustawień regionalnych (porównanie kodowe)', () => {
  const defs = new Map(
    ['alpha', 'Zeta'].map((id) => [id, { id, rarity: 'common' }]),
  ) as unknown as ReadonlyMap<string, ImplantDefinition>;
  const rng = { next: () => 0, pick: <T>(a: readonly T[]) => a[0]! } as Rng;
  const sector = {
    rewardWeights: { combat: { common: 1 } },
  } as unknown as SectorDefinition;
  expect(drawImplants([], 'combat', rng, sector, defs)).toEqual([
    'Zeta',
    'alpha',
  ]);
});
