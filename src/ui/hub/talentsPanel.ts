import { z } from 'zod';
import type { TreeId } from '../../core/metaTypes';
import { talentTrees } from '../../progression/talentSchema';
import type { TalentNode, TalentTree } from '../../progression/talentSchema';
import textData from '../../data/ui/talents.pl.json';
import type { HubPanel, HubPanelFactory } from './hubPanel';
import { talentNodeState } from './talentState';
import type { TalentNodeState, TalentReason, TalentView } from './talentState';
import './talentsPanel.css';

const text = z
  .object({
    freePoints: z.string(),
    level: z.string(),
    trees: z.record(z.string(), z.string()),
    tier: z.string(),
    tierRequirement: z.string(),
    tierOpen: z.string(),
    cost: z.string(),
    states: z.object({
      bought: z.string(),
      available: z.string(),
      locked: z.string(),
    }),
    reasons: z.object({
      requires: z.string(),
      tier: z.string(),
      points: z.string(),
      treePoints: z.string(),
      treePart: z.string(),
      treeJoin: z.string(),
    }),
    detailsHint: z.string(),
    detailsCost: z.string(),
    reset: z.string(),
    resetConfirm: z.string(),
    resetDone: z.string(),
    bought: z.string(),
    saveFailed: z.string(),
  })
  .parse(textData);

/** Czas na drugie kliknięcie „Potwierdź reset” (UI, nie liczba „feel”). */
export const RESET_CONFIRM_MS = 4000;

const TREE_ORDER: readonly TreeId[] = [
  'blade',
  'resonance',
  'gunner',
  'hybrid',
];

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const treeName = (id: TreeId): string =>
  talentTrees.get(id)?.name ?? text.trees[id] ?? id;

const nodeName = (id: string): string => {
  for (const tree of talentTrees.values())
    for (const node of tree.nodes) if (node.id === id) return node.name;
  return id;
};

export function reasonText(reason: TalentReason): string {
  switch (reason.kind) {
    case 'requires':
      return fill(text.reasons.requires, { name: nodeName(reason.nodeId) });
    case 'tier':
      return fill(text.reasons.tier, { n: reason.points });
    case 'points':
      return text.reasons.points;
    case 'treePoints':
      return fill(text.reasons.treePoints, {
        parts: reason.needs
          .map((need) =>
            fill(text.reasons.treePart, {
              n: need.points,
              tree: treeName(need.tree),
            }),
          )
          .join(text.reasons.treeJoin),
      });
  }
}

interface Card {
  node: TalentNode;
  tree: TalentTree;
  button: HTMLButtonElement;
  meta: HTMLElement;
}

export const createTalentsPanel: HubPanelFactory = (ctx) => {
  const { manager } = ctx;
  const root = document.createElement('div');
  root.className = 'talents-panel';

  const head = document.createElement('div');
  head.className = 'talents-panel__head';
  const freeEl = document.createElement('span');
  freeEl.className = 'talents-panel__free';
  const levelEl = document.createElement('span');
  levelEl.className = 'talents-panel__level';
  head.append(freeEl, levelEl);

  const treesEl = document.createElement('div');
  treesEl.className = 'talents-panel__trees';

  const details = document.createElement('div');
  details.className = 'talents-panel__details';
  details.setAttribute('aria-live', 'polite');
  details.textContent = text.detailsHint;

  const foot = document.createElement('div');
  foot.className = 'talents-panel__foot';
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'talents-panel__reset';
  resetBtn.textContent = text.reset;
  const statusEl = document.createElement('div');
  statusEl.className = 'talents-panel__status';
  statusEl.setAttribute('role', 'status');
  foot.append(resetBtn, statusEl);

  root.append(head, treesEl, details, foot);

  const cards: Card[] = [];
  const tierLabels: { tree: TalentTree; tier: number; el: HTMLElement }[] = [];
  let disposed = false;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const view = (): TalentView => ({
    talents: manager.state.talents,
    freePoints: manager.freePoints,
    spentInTree: (tree) => manager.spentInTree(tree),
  });

  const showDetails = (node: TalentNode): void => {
    details.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = node.name;
    const cost = document.createElement('span');
    cost.textContent = ` — ${fill(text.detailsCost, { n: node.cost })}`;
    const desc = document.createElement('p');
    desc.style.margin = '6px 0 0';
    desc.textContent = node.description;
    details.append(name, cost, desc);
  };

  const setStatus = (message: string): void => {
    statusEl.textContent = message;
  };

  const cancelReset = (): void => {
    if (resetTimer !== undefined) clearTimeout(resetTimer);
    resetTimer = undefined;
    resetBtn.dataset.confirm = 'false';
    resetBtn.textContent = text.reset;
  };

  const save = async (): Promise<void> => {
    try {
      await ctx.save();
    } catch {
      setStatus(text.saveFailed);
    }
  };

  const describe = (card: Card, state: TalentNodeState): string => {
    const cost = fill(text.cost, { n: card.node.cost });
    if (state.status === 'bought') return `${text.states.bought} · ${cost}`;
    if (state.status === 'available')
      return `${text.states.available} · ${cost}`;
    return `${text.states.locked}: ${reasonText(state.reason)} · ${cost}`;
  };

  const refresh = (): void => {
    const v = view();
    freeEl.textContent = fill(text.freePoints, { n: v.freePoints });
    levelEl.textContent = fill(text.level, { n: manager.level });
    for (const { tree, tier, el } of tierLabels) {
      const need = tree.tierThresholds[tier - 1] ?? 0;
      const spent = v.spentInTree(tree.tree);
      const label = fill(text.tier, { tier });
      el.textContent =
        tree.tree === 'hybrid'
          ? label
          : `${label} — ${
              need > 0
                ? fill(text.tierRequirement, { need, spent })
                : fill(text.tierOpen, { spent })
            }`;
    }
    for (const card of cards) {
      const state = talentNodeState(card.tree, card.node, v);
      card.button.dataset.state = state.status;
      card.button.setAttribute(
        'aria-disabled',
        state.status === 'available' ? 'false' : 'true',
      );
      card.meta.textContent = describe(card, state);
    }
  };

  const buy = async (card: Card): Promise<void> => {
    if (disposed) return;
    const state = talentNodeState(card.tree, card.node, view());
    if (state.status !== 'available') return;
    try {
      manager.buyTalent(card.node.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      refresh();
      return;
    }
    setStatus(fill(text.bought, { name: card.node.name }));
    await save();
    if (!disposed) refresh();
  };

  const reset = async (): Promise<void> => {
    cancelReset();
    try {
      manager.resetTalents();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      refresh();
      return;
    }
    setStatus(text.resetDone);
    await save();
    if (!disposed) refresh();
  };

  resetBtn.addEventListener('click', () => {
    if (resetBtn.dataset.confirm === 'true') {
      void reset();
      return;
    }
    resetBtn.dataset.confirm = 'true';
    resetBtn.textContent = text.resetConfirm;
    resetTimer = setTimeout(cancelReset, RESET_CONFIRM_MS);
  });
  cancelReset();

  for (const id of TREE_ORDER) {
    const tree = talentTrees.get(id);
    if (!tree) continue;
    const treeEl = document.createElement('section');
    treeEl.className = 'talents-tree';
    treeEl.dataset.tree = id;
    const title = document.createElement('h2');
    title.className = 'talents-tree__title';
    title.textContent = tree.name;
    treeEl.append(title);
    for (const tier of [1, 2, 3, 4] as const) {
      const nodes = tree.nodes.filter((node) => node.tier === tier);
      if (nodes.length === 0) continue;
      const tierEl = document.createElement('div');
      tierEl.className = 'talents-tier';
      const label = document.createElement('div');
      label.className = 'talents-tier__label';
      tierLabels.push({ tree, tier, el: label });
      const list = document.createElement('div');
      list.className = 'talents-tier__nodes';
      for (const node of nodes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'talents-node';
        button.dataset.nodeId = node.id;
        const name = document.createElement('span');
        name.className = 'talents-node__name';
        name.textContent = node.name;
        const meta = document.createElement('span');
        meta.className = 'talents-node__meta';
        button.append(name, meta);
        const card: Card = { node, tree, button, meta };
        button.addEventListener('click', () => void buy(card));
        button.addEventListener('mouseenter', () => showDetails(node));
        button.addEventListener('focus', () => showDetails(node));
        cards.push(card);
        list.append(button);
      }
      tierEl.append(label, list);
      treeEl.append(tierEl);
    }
    treesEl.append(treeEl);
  }

  refresh();

  const panel: HubPanel = {
    root,
    refresh,
    dispose(): void {
      disposed = true;
      cancelReset();
      root.remove();
    },
  };
  return panel;
};
