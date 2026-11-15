import type { TreeId } from '../../core/metaTypes';
import type { TalentNode, TalentTree } from '../../progression/talentSchema';

/** Minimalny widok `MetaManager` potrzebny do wyliczenia stanu węzłów. */
export interface TalentView {
  readonly talents: readonly string[];
  readonly freePoints: number;
  spentInTree(tree: TreeId): number;
}

export type TalentReason =
  | { kind: 'requires'; nodeId: string }
  | { kind: 'tier'; points: number }
  | { kind: 'treePoints'; needs: { tree: TreeId; points: number }[] }
  | { kind: 'points' };

export type TalentNodeState =
  | { status: 'bought' }
  | { status: 'available' }
  | { status: 'locked'; reason: TalentReason };

/**
 * Odwzorowuje reguły `MetaManager.buyTalent`: wymagane węzły, próg drzewka,
 * punkty w drzewkach (hybrydy), na końcu wolne punkty.
 */
export function talentNodeState(
  tree: TalentTree,
  node: TalentNode,
  view: TalentView,
): TalentNodeState {
  if (view.talents.includes(node.id)) return { status: 'bought' };
  const missing = node.requires.find((id) => !view.talents.includes(id));
  if (missing !== undefined)
    return { status: 'locked', reason: { kind: 'requires', nodeId: missing } };
  const threshold = tree.tierThresholds[node.tier - 1] ?? 0;
  if (view.spentInTree(tree.tree) < threshold)
    return { status: 'locked', reason: { kind: 'tier', points: threshold } };
  const needs = Object.entries(node.requiresTreePoints ?? {})
    .map(([id, points]) => ({ tree: id as TreeId, points: points ?? 0 }))
    .filter((need) => view.spentInTree(need.tree) < need.points);
  if (needs.length > 0)
    return { status: 'locked', reason: { kind: 'treePoints', needs } };
  if (view.freePoints < node.cost)
    return { status: 'locked', reason: { kind: 'points' } };
  return { status: 'available' };
}
