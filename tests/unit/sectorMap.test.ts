import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { MapNode, SectorMap } from '../../src/core/runTypes';
import { NODE_TYPES } from '../../src/core/runTypes';
import { Rng } from '../../src/core/rng';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector as def } from '../../src/world/sectors';
import { loadSector } from '../../src/world/sectorSchema';

function paths(map: SectorMap): MapNode[][] {
  const byId = new Map(map.layers.flat().map((node) => [node.id, node]));
  const visit = (node: MapNode): MapNode[][] =>
    node.next.length === 0
      ? [[node]]
      : node.next.flatMap((id) =>
          visit(byId.get(id)!).map((tail) => [node, ...tail]),
        );
  return map.layers[0]!.flatMap(visit);
}

describe('generator mapy sektora', () => {
  it('spełnia niezmienniki i budżet czasu na wszystkich ścieżkach 200 seedów', () => {
    const unique = new Set<string>();
    let totalPaths = 0;
    let durationInRange = 0;
    let mapsWithPuzzle = 0;
    for (let seed = 0; seed < 200; seed++) {
      const map = generateSectorMap(def, `sector-${seed}`);
      expect(generateSectorMap(def, `sector-${seed}`)).toEqual(map);
      unique.add(JSON.stringify(map));
      expect(map.sectorId).toBe(def.id);
      expect(map.layers).toHaveLength(8);
      const nodes = map.layers.flat();
      if (nodes.some((node) => node.type === 'puzzle')) mapsWithPuzzle++;
      expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
      const reachable = new Set(map.layers[0]!.map((node) => node.id));
      for (const [i, layer] of map.layers.entries()) {
        expect(layer.length).toBeGreaterThanOrEqual(i === 7 ? 1 : 2);
        expect(layer.length).toBeLessThanOrEqual(i === 7 ? 1 : 4);
        for (const [index, node] of layer.entries()) {
          expect(node.layer).toBe(i + 1);
          expect(node.index).toBe(index);
          expect(node.id).toBe(`L${i + 1}N${index + 1}`);
          expect(reachable.has(node.id)).toBe(true);
          if (i === 0) expect(node.type).toBe('combat');
          if (i === 6) expect(node.type).toBe('rest');
          if (node.type === 'puzzle') {
            expect(node.layer).toBeGreaterThanOrEqual(3);
            expect(node.layer).toBeLessThanOrEqual(6);
          }
          expect(node.type === 'boss').toBe(i === 7);
          expect(new Set(node.next).size).toBe(node.next.length);
          if (i === 7) expect(node.next).toEqual([]);
          else expect(node.next.length).toBeGreaterThan(0);
          for (const id of node.next) {
            expect(map.layers[i + 1]!.some((target) => target.id === id)).toBe(
              true,
            );
            reachable.add(id);
          }
        }
        for (const type of NODE_TYPES) {
          const max = def.limits.maxPerLayer[type];
          if (max !== undefined)
            expect(
              layer.filter((node) => node.type === type).length,
            ).toBeLessThanOrEqual(max);
        }
        const next = map.layers[i + 1];
        if (!next) continue;
        const edges = layer.flatMap((from) =>
          from.next.map((id) => ({
            from: from.index,
            to: next.findIndex((node) => node.id === id),
          })),
        );
        for (const a of edges)
          for (const b of edges)
            expect((a.from - b.from) * (a.to - b.to)).toBeGreaterThanOrEqual(0);
      }
      for (const rule of def.guarantees) {
        expect(
          nodes.filter(
            (node) =>
              node.type === rule.type &&
              node.layer >= rule.fromLayer &&
              node.layer <= rule.toLayer,
          ).length,
        ).toBeGreaterThanOrEqual(rule.min);
      }
      const routes = paths(map);
      const seen = new Set<string>();
      let validDurations = 0;
      for (const route of routes) {
        expect(route).toHaveLength(8);
        expect(route.at(-1)!.type).toBe('boss');
        expect(
          route.filter((node) => node.type === 'elite').length,
        ).toBeLessThanOrEqual(def.limits.maxElitesPerPath);
        for (const node of route) seen.add(node.id);
        const duration = route.reduce(
          (sum, node) => sum + def.expectedDurationS[node.type],
          0,
        );
        if (duration >= 900 && duration <= 1500) validDurations++;
      }
      expect(seen.size).toBe(nodes.length);
      expect(validDurations / routes.length).toBeGreaterThanOrEqual(0.95);
      totalPaths += routes.length;
      durationInRange += validDurations;
    }
    expect(unique.size).toBeGreaterThanOrEqual(50);
    expect(mapsWithPuzzle).toBeGreaterThan(0);
    expect(mapsWithPuzzle).toBeLessThan(200 * 0.2);
    expect(durationInRange / totalPaths).toBeGreaterThanOrEqual(0.95);
  });

  it('używa wyłącznie fork map i nie zmienia danych ani obcego RNG', () => {
    const before = structuredClone(def);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random');
    });
    const fork = vi.spyOn(Rng.prototype, 'fork');
    try {
      const rng = new Rng('outside');
      const state = rng.getState();
      generateSectorMap(def, 'isolated');
      expect(fork).toHaveBeenCalledExactlyOnceWith('map');
      expect(rng.getState()).toBe(state);
      expect(random).not.toHaveBeenCalled();
      expect(def).toEqual(before);
      const source = readFileSync('src/world/sectorMap.ts', 'utf8');
      expect(source).not.toMatch(
        /Math\.random|from ['"]three['"]|\bdocument\b|\bwindow\b/,
      );
    } finally {
      random.mockRestore();
      fork.mockRestore();
    }
  });

  it('waliduje dane i odrzuca sprzeczne reguły z czytelnym błędem', () => {
    expect(() =>
      generateSectorMap(
        {
          ...def,
          guarantees: [{ type: 'boss', min: 2, fromLayer: 1, toLayer: 8 }],
        },
        'bad',
      ),
    ).toThrow(/gwarancji/);
    expect(() =>
      loadSector({ ...def, nodesPerLayer: { min: 0, max: 4 } }),
    ).toThrow();
    expect(() => generateSectorMap({ ...def, layers: 2 }, 'bad')).toThrow(
      /warstw/,
    );
    expect(() =>
      generateSectorMap({ ...def, typeWeights: [] }, 'bad'),
    ).toThrow();
    expect(() =>
      generateSectorMap(
        {
          ...def,
          typeWeights: [{ fromLayer: 1, toLayer: 8, weights: { combat: 0 } }],
        },
        'bad',
      ),
    ).toThrow(/sumy wag/);
    expect(() =>
      generateSectorMap(
        {
          ...def,
          guarantees: [{ type: 'shop', min: 1, fromLayer: 1, toLayer: 9 }],
        },
        'bad',
      ),
    ).toThrow(/wykracza/);
    expect(() =>
      generateSectorMap(
        {
          ...def,
          guarantees: [{ type: 'shop', min: 1, fromLayer: 1, toLayer: 1 }],
        },
        'bad',
      ),
    ).toThrow(/gwarancji/);
    expect(() =>
      generateSectorMap(
        {
          ...def,
          guarantees: [{ type: 'elite', min: 5, fromLayer: 3, toLayer: 6 }],
        },
        'bad',
      ),
    ).toThrow(/gwarancji/);
  });

  it('naprawia limity i gwarancje także dla skrajnych wag i szans krawędzi', () => {
    for (const extraEdgeChance of [0, 1]) {
      for (const type of ['combat', 'elite', 'shop'] as const) {
        const sector = {
          ...def,
          extraEdgeChance,
          typeWeights: [{ fromLayer: 1, toLayer: 6, weights: { [type]: 1 } }],
        };
        const map = generateSectorMap(sector, `extreme-${type}`);
        for (const rule of def.guarantees)
          expect(
            map.layers
              .flat()
              .filter(
                (node) =>
                  node.type === rule.type &&
                  node.layer >= rule.fromLayer &&
                  node.layer <= rule.toLayer,
              ).length,
          ).toBeGreaterThanOrEqual(rule.min);
        for (const route of paths(map))
          expect(
            route.filter((node) => node.type === 'elite').length,
          ).toBeLessThanOrEqual(def.limits.maxElitesPerPath);
      }
    }
  });
});
