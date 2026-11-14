import type { Rng } from '../core/rng';
import type { RunState } from '../core/runTypes';
import type { SectorDefinition } from '../world/sectorSchema';
import { implantDefinitions } from './implants';
import { drawImplants } from './rewards';

export interface ShopItem {
  id: string;
  price: number;
}
export function stockShop(
  state: Readonly<RunState>,
  rng: Rng,
  sector: SectorDefinition,
  definitions = implantDefinitions,
): ShopItem[] {
  if (!sector.economy) throw new Error('Brak konfiguracji economy.');
  return drawImplants(
    state.implants,
    'shop',
    rng.fork(`shop:${state.currentNodeId}`),
    sector,
    definitions,
  ).map((id) => ({
    id,
    price: sector.economy!.shopPrices[definitions.get(id)!.rarity],
  }));
}
