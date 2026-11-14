import { Rng } from '../core/rng';
import { NODE_TYPES } from '../core/runTypes';
import type { MapNode, NodeType, SectorMap } from '../core/runTypes';
import { loadSector } from './sectorSchema';
import type { SectorDefinition } from './sectorSchema';

function connectLayers(
  current: MapNode[],
  next: MapNode[],
  rng: Rng,
  chance: number,
): void {
  const edges: { from: MapNode; to: MapNode }[] = [];
  const connect = (from: MapNode, to: MapNode): boolean => {
    if (from.next.includes(to.id)) return true;
    if (
      edges.some(
        (edge) =>
          (from.index - edge.from.index) * (to.index - edge.to.index) < 0,
      )
    )
      return false;
    from.next.push(to.id);
    edges.push({ from, to });
    return true;
  };
  const distance = (from: MapNode, to: MapNode): number =>
    Math.abs(
      (from.index + 0.5) * next.length - (to.index + 0.5) * current.length,
    );
  const nearest = (from: MapNode): MapNode[] =>
    [...next].sort(
      (a, b) => distance(from, a) - distance(from, b) || a.index - b.index,
    );

  for (const from of current) connect(from, nearest(from)[0]!);
  // Naprawa wejść przed opcjonalnymi krawędziami zachowuje planarność szkieletu.
  for (const to of next) {
    if (edges.some((edge) => edge.to === to)) continue;
    const sources = [...current].sort(
      (a, b) => distance(a, to) - distance(b, to) || a.index - b.index,
    );
    if (!sources.some((from) => connect(from, to)))
      throw new Error('Nie można połączyć warstw bez przecięć.');
  }
  for (const from of current) {
    const second = nearest(from)[1];
    if (second && rng.chance(chance)) connect(from, second);
    from.next.sort(
      (a, b) =>
        next.findIndex((node) => node.id === a) -
        next.findIndex((node) => node.id === b),
    );
  }
}

function respectsLimits(map: SectorMap, def: SectorDefinition): boolean {
  const eliteCounts = new Map<string, number>();
  for (const layer of map.layers) {
    for (const type of NODE_TYPES) {
      const max = def.limits.maxPerLayer[type];
      if (
        max !== undefined &&
        layer.filter((node) => node.type === type).length > max
      )
        return false;
    }
    for (const node of layer) {
      const count =
        (eliteCounts.get(node.id) ?? 0) + Number(node.type === 'elite');
      if (count > def.limits.maxElitesPerPath) return false;
      for (const id of node.next)
        eliteCounts.set(id, Math.max(eliteCounts.get(id) ?? 0, count));
    }
  }
  return true;
}

function assignTypes(map: SectorMap, def: SectorDefinition, rng: Rng): void {
  const nodes = map.layers.flat();
  const mutable = nodes.filter(
    (node) => node.layer > 1 && node.layer < def.layers - 1,
  );
  for (const node of mutable) {
    const entries = def.typeWeights.filter(
      (entry) => node.layer >= entry.fromLayer && node.layer <= entry.toLayer,
    );
    if (entries.length !== 1)
      throw new Error(`Warstwa ${node.layer} wymaga jednego zestawu wag.`);
    const weights = entries[0]!.weights;
    if ((weights.boss ?? 0) > 0)
      throw new Error('Typ boss jest dozwolony tylko w ostatniej warstwie.');
    const total = NODE_TYPES.reduce(
      (sum, type) => sum + (weights[type] ?? 0),
      0,
    );
    if (total <= 0 || !Number.isFinite(total))
      throw new Error(`Warstwa ${node.layer} wymaga dodatniej sumy wag.`);
    let draw = rng.float(0, total);
    for (const type of NODE_TYPES) {
      draw -= weights[type] ?? 0;
      if (draw < 0) {
        node.type = type;
        break;
      }
    }
    // Naprawa limitów w stabilnej kolejności id, bez dodatkowego losowania.
    if (!respectsLimits(map, def)) node.type = 'combat';
  }

  const count = (rule: SectorDefinition['guarantees'][number]): number =>
    nodes.filter(
      (node) =>
        node.type === rule.type &&
        node.layer >= rule.fromLayer &&
        node.layer <= rule.toLayer,
    ).length;
  const fillGuarantees = (): boolean => {
    const missing = def.guarantees.find((rule) => count(rule) < rule.min);
    if (!missing) return respectsLimits(map, def);
    if (missing.type === 'boss') return false;
    for (const node of mutable) {
      if (
        node.type !== 'combat' ||
        missing.type === 'combat' ||
        node.layer < missing.fromLayer ||
        node.layer > missing.toLayer
      )
        continue;
      node.type = missing.type;
      if (respectsLimits(map, def) && fillGuarantees()) return true;
      node.type = 'combat';
    }
    return false;
  };
  if (fillGuarantees()) return;
  // Wylosowane typy mogą blokować gwarancję; ponów deterministycznie od walk.
  for (const node of mutable) node.type = 'combat';
  if (!fillGuarantees())
    throw new Error('Nie można spełnić gwarancji i limitów sektora.');
}

/** Czysta generacja serializowalnego grafu; bez współdzielonego stanu RNG. */
export function generateSectorMap(
  definition: SectorDefinition,
  seed: string,
): SectorMap {
  const def = loadSector(definition);
  if (def.layers < 3)
    throw new Error('Mapa wymaga osobnych warstw walki, odpoczynku i bossa.');
  for (const rule of def.guarantees) {
    if (rule.toLayer > def.layers)
      throw new Error('Gwarancja wykracza poza warstwy sektora.');
  }
  const rng = new Rng(seed).fork('map');
  const map: SectorMap = { sectorId: def.id, layers: [] };
  for (let layer = 1; layer <= def.layers; layer++) {
    const count =
      layer === def.layers
        ? 1
        : rng.int(def.nodesPerLayer.min, def.nodesPerLayer.max);
    const type: NodeType =
      layer === def.layers
        ? 'boss'
        : layer === def.layers - 1
          ? 'rest'
          : 'combat';
    map.layers.push(
      Array.from({ length: count }, (_, index) => ({
        id: `L${layer}N${index + 1}`,
        layer,
        index,
        type,
        next: [],
      })),
    );
  }
  for (let i = 0; i < map.layers.length - 1; i++)
    connectLayers(map.layers[i]!, map.layers[i + 1]!, rng, def.extraEdgeChance);
  assignTypes(map, def, rng);
  return map;
}
