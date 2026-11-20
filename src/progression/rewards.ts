import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import { RARITIES, type NodeType, type RunState } from '../core/runTypes';
import type { SectorDefinition } from '../world/sectorSchema';
import { implantDefinitions, type ImplantDefinition } from './implants';

export function drawImplants(
  owned: readonly string[],
  type: NodeType,
  rng: Rng,
  sector: SectorDefinition,
  definitions: ReadonlyMap<string, ImplantDefinition>,
): string[] {
  const pool = [...definitions.values()]
    .filter((def) => !owned.includes(def.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const result: string[] = [];
  const weights = sector.rewardWeights?.[type];
  while (pool.length && result.length < 3) {
    const available = RARITIES.filter(
      (rarity) =>
        pool.some((def) => def.rarity === rarity) &&
        (weights?.[rarity] ?? 0) > 0,
    );
    if (!available.length) break;
    const total = available.reduce(
      (sum, rarity) => sum + (weights?.[rarity] ?? 0),
      0,
    );
    let roll = rng.next() * total;
    const rarity =
      available.find((rarity) => {
        roll -= weights?.[rarity] ?? 0;
        return roll < 0;
      }) ?? available[available.length - 1]!;
    const selected = rng.pick(pool.filter((def) => def.rarity === rarity));
    result.push(selected.id);
    pool.splice(pool.indexOf(selected), 1);
  }
  return result;
}

export function offerReward(
  state: Readonly<RunState>,
  nodeType: NodeType,
  rng: Rng,
  sector: SectorDefinition,
  definitions = implantDefinitions,
  bus?: EventBus,
): string[] {
  const options = drawImplants(
    state.implants,
    nodeType,
    rng.fork(`reward:${state.currentNodeId}`),
    sector,
    definitions,
  );
  bus?.emit('reward_offered', {
    nodeId: state.currentNodeId!,
    options: [...options],
  });
  return options;
}
