import type { TalentNode, TalentTree } from '../../progression/talentSchema';

/** Wymiary siatki grafu w jednostkach `rem` (CSS i SVG liczą w tej samej skali). */
export const GRAPH_METRICS = {
  nodeW: 13,
  nodeH: 4.8,
  gapX: 4,
  gapY: 1.1,
  /** Wysokość nagłówków progów nad kolumnami. */
  headH: 2.6,
  /** Liczba kolumn drzewka bez zależności węzłów (hybrydy). */
  flatColumns: 3,
} as const;

export interface GraphNode {
  node: TalentNode;
  /** Środek węzła w `rem`. */
  cx: number;
  cy: number;
  /** Lewy górny róg w `rem`. */
  x: number;
  y: number;
  column: number;
  row: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Ścieżka SVG (krzywa Béziera) w `rem`. */
  path: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  /** Kolumny z nagłówkiem progu (puste dla drzewka płaskiego). */
  columns: { tier: number; x: number }[];
  flat: boolean;
}

/**
 * Układ drzewka jako graf: kolumny = progi, wiersze w kolumnie uporządkowane według rodzica
 * i wyśrodkowane. Drzewko bez zależności węzłów (hybrydy) dostaje siatkę bez krawędzi.
 */
export function layoutTree(tree: TalentTree): GraphLayout {
  const { nodeW, nodeH, gapX, gapY, headH, flatColumns } = GRAPH_METRICS;
  const flat = tree.nodes.every((node) => node.requires.length === 0);
  const placed = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];
  const place = (
    node: TalentNode,
    column: number,
    row: number,
    offsetRows = 0,
  ): void => {
    const x = column * (nodeW + gapX);
    const y = headH + (row + offsetRows) * (nodeH + gapY);
    const entry: GraphNode = {
      node,
      x,
      y,
      cx: x + nodeW / 2,
      cy: y + nodeH / 2,
      column,
      row: row + offsetRows,
    };
    placed.set(node.id, entry);
    nodes.push(entry);
  };

  if (flat) {
    tree.nodes.forEach((node, index) =>
      place(node, index % flatColumns, Math.floor(index / flatColumns)),
    );
    const columns = Math.min(flatColumns, tree.nodes.length);
    const rows = Math.ceil(tree.nodes.length / flatColumns);
    return {
      nodes,
      edges: [],
      width: columns * nodeW + (columns - 1) * gapX,
      height: headH + rows * nodeH + (rows - 1) * gapY,
      columns: [],
      flat,
    };
  }

  const tiers = [...new Set(tree.nodes.map((node) => node.tier))].sort(
    (a, b) => a - b,
  );
  const byTier = tiers.map((tier) =>
    tree.nodes.filter((node) => node.tier === tier),
  );
  const maxRows = Math.max(...byTier.map((list) => list.length));
  byTier.forEach((list, column) => {
    const parentRow = (node: TalentNode): number => {
      const parent = node.requires.map((id) => placed.get(id)).find(Boolean);
      return parent?.row ?? 0;
    };
    const ordered = column === 0 ? list : [...list].sort(
      (a, b) => parentRow(a) - parentRow(b),
    );
    const offset = (maxRows - ordered.length) / 2;
    ordered.forEach((node, row) => place(node, column, row, offset));
  });
  const edges: GraphEdge[] = [];
  for (const entry of nodes)
    for (const requiredId of entry.node.requires) {
      const from = placed.get(requiredId);
      if (!from) continue;
      const x1 = from.x + nodeW;
      const y1 = from.cy;
      const x2 = entry.x;
      const y2 = entry.cy;
      const mid = (x1 + x2) / 2;
      edges.push({
        from: requiredId,
        to: entry.node.id,
        path: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
      });
    }
  return {
    nodes,
    edges,
    width: tiers.length * nodeW + (tiers.length - 1) * gapX,
    height: headH + maxRows * nodeH + (maxRows - 1) * gapY,
    columns: tiers.map((tier, column) => ({
      tier,
      x: column * (nodeW + gapX),
    })),
    flat,
  };
}

/** Najbliższy węzeł w kierunku strzałki (po środkach); `undefined`, gdy nic nie leży w tym kierunku. */
export function neighbourInDirection(
  layout: GraphLayout,
  fromId: string,
  dx: number,
  dy: number,
): string | undefined {
  const from = layout.nodes.find((entry) => entry.node.id === fromId);
  if (!from) return undefined;
  let best: string | undefined;
  let bestScore = Infinity;
  for (const entry of layout.nodes) {
    if (entry === from) continue;
    const vx = entry.cx - from.cx;
    const vy = entry.cy - from.cy;
    const forward = vx * dx + vy * dy;
    if (forward <= 0) continue;
    const lateral = Math.abs(vx * dy - vy * dx);
    const score = Math.hypot(forward, lateral) + lateral;
    if (score < bestScore) {
      best = entry.node.id;
      bestScore = score;
    }
  }
  return best;
}
