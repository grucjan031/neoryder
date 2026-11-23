import { z } from 'zod';
import { playUiSound } from '../../audio/uiSounds';
import type { TreeId } from '../../core/metaTypes';
import { talentTrees } from '../../progression/talentSchema';
import type { TalentNode, TalentTree } from '../../progression/talentSchema';
import textData from '../../data/ui/talents.pl.json';
import uiText from '../../data/ui/ui.pl.json';
import { achievementText } from '../achievementText';
import { createLockIcon } from '../achievementIcons';
import { uiButton } from '../components/button';
import { uiBadge } from '../components/controls';
import { el } from '../components/dom';
import { bindUiFeedback } from '../components/feedback';
import { uiConfirm } from '../components/modal';
import { createTabs } from '../components/tabs';
import { createAchievementsPanel } from './achievementsPanel';
import type { HubPanel, HubPanelFactory } from './hubPanel';
import { GRAPH_METRICS, layoutTree, neighbourInDirection } from './talentLayout';
import type { GraphLayout } from './talentLayout';
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
    costShort: z.string(),
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
    buy: z.string(),
    treesLabel: z.string(),
    hybridNote: z.string(),
    reset: z.string(),
    resetConfirm: z.object({
      title: z.string(),
      message: z.string(),
      confirm: z.string(),
    }),
    resetDone: z.string(),
    bought: z.string(),
    saveFailed: z.string(),
  })
  .parse(textData);

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

interface TreeView {
  tree: TalentTree;
  layout: GraphLayout;
  section: HTMLElement;
  edges: Map<string, SVGPathElement>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const rem = (value: number): string => `${value}rem`;

export const createTalentsPanel: HubPanelFactory = (ctx) => {
  const { manager } = ctx;
  const root = el('div', 'talents-panel');

  const treeIds = TREE_ORDER.filter((id) => talentTrees.has(id));
  const tabs = createTabs({
    prefix: 'talents',
    label: text.treesLabel,
    tabs: [
      ...treeIds.map((id) => ({ id, label: treeName(id) })),
      { id: 'achievements', label: achievementText.panel.tabAchievements },
    ],
    onSelect: (id) => showTab(id),
  });
  for (const [id, button] of tabs.buttons) {
    button.dataset.tab = id;
    button.dataset.tree = id;
  }
  root.append(tabs.root);

  const stage = el('div', 'talents-panel__stage');
  const treesEl = el('div', 'talents-panel__trees');
  const side = el('aside', 'talents-panel__side');
  const head = el('div', 'talents-panel__head');
  const freeEl = el('span', 'talents-panel__free');
  const levelEl = el('span', 'talents-panel__level');
  head.append(freeEl, levelEl);
  const statusEl = el('div', 'talents-panel__status');
  statusEl.setAttribute('role', 'status');
  const details = el('div', 'talents-panel__details');
  details.setAttribute('aria-live', 'polite');
  const resetBtn = uiButton({
    label: text.reset,
    variant: 'quiet',
    onClick: () => void reset(),
  });
  resetBtn.classList.add('talents-panel__reset');
  const foot = el('div', 'talents-panel__foot');
  foot.append(resetBtn);
  side.append(head, statusEl, details, foot);
  stage.append(treesEl, side);
  root.append(stage);

  // Zakładka „Naszywki Iskry”: terminal drzewek to miejsce trwałej progresji postaci.
  const achievements = createAchievementsPanel(manager);
  const achievementsView = el(
    'section',
    'talents-panel__achievements ui-scroll',
  );
  achievementsView.id = 'talents-view-achievements';
  achievementsView.hidden = true;
  achievementsView.append(achievements.root);
  root.append(achievementsView);

  const cards: Card[] = [];
  const views = new Map<string, TreeView>();
  const tierLabels: { tree: TalentTree; tier: number; el: HTMLElement }[] = [];
  let disposed = false;
  let busy = false;
  let selected: Card | undefined;

  const view = (): TalentView => ({
    talents: manager.state.talents,
    freePoints: manager.freePoints,
    spentInTree: (tree) => manager.spentInTree(tree),
  });

  const setStatus = (message: string): void => {
    statusEl.textContent = message;
  };

  const save = async (): Promise<void> => {
    try {
      await ctx.save();
    } catch {
      setStatus(text.saveFailed);
    }
  };

  const stateOf = (card: Card): TalentNodeState =>
    talentNodeState(card.tree, card.node, view());

  const renderDetails = (): void => {
    details.replaceChildren();
    if (!selected) {
      details.append(el('p', 'talents-panel__hint', text.detailsHint));
      return;
    }
    const card = selected;
    const state = stateOf(card);
    const header = el('div', 'talents-details__head');
    header.append(
      el('h3', 'talents-details__name', card.node.name),
      uiBadge(
        text.states[state.status],
        state.status === 'bought'
          ? 'success'
          : state.status === 'available'
            ? 'accent'
            : 'neutral',
      ),
    );
    const meta = el(
      'p',
      'talents-details__meta',
      `${card.tree.name} · ${fill(text.detailsCost, { n: card.node.cost })}`,
    );
    const description = el('p', 'talents-details__text', card.node.description);
    details.append(header, meta, description);
    if (state.status === 'locked') {
      const reason = el('p', 'talents-details__reason');
      reason.append(createLockIcon(), reasonText(state.reason));
      details.append(reason);
    }
    if (state.status !== 'bought') {
      const buyBtn = uiButton({
        label: fill(text.buy, { n: card.node.cost }),
        variant: 'primary',
        sound: false,
        onClick: () => void buy(card),
      });
      buyBtn.classList.add('talents-details__buy');
      buyBtn.dataset.action = 'buy-talent';
      buyBtn.setAttribute(
        'aria-disabled',
        String(state.status !== 'available'),
      );
      bindUiFeedback(buyBtn, state.status === 'available' ? false : 'error');
      details.append(buyBtn);
    }
  };

  const select = (card: Card): void => {
    selected = card;
    for (const other of cards)
      other.button.setAttribute('aria-pressed', String(other === card));
    renderDetails();
  };

  const describe = (card: Card, state: TalentNodeState): string => {
    const cost = fill(text.costShort, { n: card.node.cost });
    if (state.status === 'bought') return text.states.bought;
    if (state.status === 'available')
      return `${text.states.available} · ${cost}`;
    return `${text.states.locked} · ${cost}`;
  };

  const refresh = (): void => {
    achievements.refresh();
    const v = view();
    freeEl.textContent = fill(text.freePoints, { n: v.freePoints });
    freeEl.dataset.active = String(v.freePoints > 0);
    levelEl.textContent = fill(text.level, { n: manager.level });
    for (const { tree, tier, el: label } of tierLabels) {
      const need = tree.tierThresholds[tier - 1] ?? 0;
      const spent = v.spentInTree(tree.tree);
      label.replaceChildren(
        el('strong', undefined, fill(text.tier, { tier })),
        el(
          'span',
          undefined,
          need > 0
            ? fill(text.tierRequirement, { need, spent })
            : fill(text.tierOpen, { spent }),
        ),
      );
      label.dataset.open = String(spent >= need);
    }
    for (const card of cards) {
      const state = talentNodeState(card.tree, card.node, v);
      card.button.dataset.state = state.status;
      card.button.setAttribute(
        'aria-label',
        `${card.node.name}. ${describe(card, state)}`,
      );
      card.meta.textContent = describe(card, state);
    }
    for (const entry of views.values())
      for (const edge of entry.layout.edges) {
        const path = entry.edges.get(`${edge.from}>${edge.to}`);
        if (!path) continue;
        path.dataset.state =
          v.talents.includes(edge.from) && v.talents.includes(edge.to)
            ? 'bought'
            : v.talents.includes(edge.from)
              ? 'open'
              : 'locked';
      }
    renderDetails();
  };

  const buy = async (card: Card): Promise<void> => {
    if (disposed || busy) return;
    const state = stateOf(card);
    if (state.status !== 'available') {
      setStatus(
        state.status === 'locked'
          ? reasonText(state.reason)
          : text.states.bought,
      );
      playUiSound('error');
      return;
    }
    busy = true;
    try {
      manager.buyTalent(card.node.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      playUiSound('error');
      busy = false;
      refresh();
      return;
    }
    playUiSound('purchase');
    setStatus(fill(text.bought, { name: card.node.name }));
    await save();
    busy = false;
    if (!disposed) {
      refresh();
      card.button.focus();
    }
  };

  const doReset = async (): Promise<void> => {
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

  async function reset(): Promise<void> {
    if (disposed || busy) return;
    const ok = await uiConfirm({
      title: text.resetConfirm.title,
      message: text.resetConfirm.message,
      confirmLabel: text.resetConfirm.confirm,
      cancelLabel: uiText.cancel,
      destructive: true,
    });
    if (ok && !disposed) await doReset();
  }

  const buildGraph = (tree: TalentTree): TreeView => {
    const layout = layoutTree(tree);
    const section = el('section', 'talents-tree');
    section.dataset.tree = tree.tree;
    section.hidden = true;
    section.setAttribute('aria-label', tree.name);
    const graph = el('div', 'talents-graph');
    graph.style.width = rem(layout.width);
    graph.style.height = rem(layout.height);
    const edges = new Map<string, SVGPathElement>();
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'talents-edges');
    svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.style.width = rem(layout.width);
    svg.style.height = rem(layout.height);
    for (const edge of layout.edges) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', edge.path);
      path.setAttribute('class', 'talents-edge');
      edges.set(`${edge.from}>${edge.to}`, path);
      svg.append(path);
    }
    graph.append(svg);

    for (const column of layout.columns) {
      const label = el('div', 'talents-tier__label');
      label.style.left = rem(column.x);
      label.style.width = rem(GRAPH_METRICS.nodeW);
      tierLabels.push({ tree, tier: column.tier, el: label });
      graph.append(label);
    }
    if (layout.flat)
      graph.append(el('p', 'talents-graph__note', text.hybridNote));
    for (const entry of layout.nodes) {
      const button = el('button', 'talents-node ui-interactive');
      button.type = 'button';
      button.dataset.nodeId = entry.node.id;
      button.dataset.tier = String(entry.node.tier);
      button.style.left = rem(entry.x);
      button.style.top = rem(entry.y);
      button.style.width = rem(GRAPH_METRICS.nodeW);
      button.style.height = rem(GRAPH_METRICS.nodeH);
      button.setAttribute('aria-pressed', 'false');
      const meta = el('span', 'talents-node__meta');
      const mark = el('span', 'talents-node__mark');
      mark.setAttribute('aria-hidden', 'true');
      button.append(
        mark,
        el('span', 'talents-node__name', entry.node.name),
        meta,
      );
      const card: Card = { node: entry.node, tree, button, meta };
      button.addEventListener('click', () => {
        select(card);
        if (stateOf(card).status === 'locked') playUiSound('error');
        else playUiSound('hover');
      });
      button.addEventListener('focus', () => select(card));
      button.addEventListener('keydown', (event) => {
        const dir = (
          {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          } as Record<string, [number, number]>
        )[event.key];
        if (!dir) return;
        event.preventDefault();
        const target = neighbourInDirection(
          layout,
          entry.node.id,
          dir[0],
          dir[1],
        );
        if (target)
          cards.find((item) => item.node.id === target)?.button.focus();
      });
      bindUiFeedback(button, false);
      cards.push(card);
      graph.append(button);
    }
    section.append(graph);
    const result: TreeView = { tree, layout, section, edges };
    views.set(tree.tree, result);
    return result;
  };

  for (const id of treeIds) {
    const tree = talentTrees.get(id);
    if (tree) treesEl.append(buildGraph(tree).section);
  }

  function showTab(id: string): void {
    const achievementsTab = id === 'achievements';
    achievementsView.hidden = !achievementsTab;
    stage.hidden = achievementsTab;
    for (const [treeId, entry] of views) entry.section.hidden = treeId !== id;
    if (achievementsTab) achievements.refresh();
  }

  tabs.select(treeIds[0] ?? 'achievements');
  refresh();

  const panel: HubPanel = {
    root,
    refresh,
    dispose(): void {
      disposed = true;
      achievements.dispose();
      root.remove();
    },
    actions: [
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
      { keys: '{tabs}', label: uiText.tabs, decorative: true },
    ],
    cycleTab: (direction) => tabs.cycle(direction),
  };
  return panel;
};
