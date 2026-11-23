// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MetaManager,
  defaultMetaRules,
  talentPoints,
} from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { talentTrees } from '../../src/progression/talentSchema';
import { talentNodeState } from '../../src/ui/hub/talentState';
import type { TalentView } from '../../src/ui/hub/talentState';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { createTalentsPanel } from '../../src/ui/hub/talentsPanel';
import {
  layoutTree,
  neighbourInDirection,
} from '../../src/ui/hub/talentLayout';

const { xpToNext } = defaultMetaRules.progression.levels;

function managerWithPoints(points: number): MetaManager {
  const meta = new MetaManager(
    createStarterMetaState(defaultMetaRules.progression.starter),
  );
  meta.debugAddXp(xpToNext.slice(0, points).reduce((a, b) => a + b, 0));
  expect(meta.talentPoints).toBe(points);
  expect(talentPoints(meta.level)).toBe(points);
  return meta;
}

function nodeOf(id: string) {
  for (const tree of talentTrees.values()) {
    const node = tree.nodes.find((n) => n.id === id);
    if (node) return { tree, node };
  }
  throw new Error(id);
}

const viewOf = (meta: MetaManager): TalentView => ({
  talents: meta.state.talents,
  freePoints: meta.freePoints,
  spentInTree: (tree) => meta.spentInTree(tree),
});

describe('talentNodeState', () => {
  it('kupiony, dostępny i brak punktów', () => {
    const meta = managerWithPoints(1);
    const { tree, node } = nodeOf('bladeRoot');
    expect(talentNodeState(tree, node, viewOf(meta))).toEqual({
      status: 'available',
    });
    meta.buyTalent('bladeRoot');
    expect(talentNodeState(tree, node, viewOf(meta))).toEqual({
      status: 'bought',
    });
    expect(talentNodeState(tree, node, viewOf(managerWithPoints(0)))).toEqual({
      status: 'locked',
      reason: { kind: 'points' },
    });
  });

  it('powód: brakujący węzeł wymagany', () => {
    const meta = managerWithPoints(3);
    const { tree, node } = nodeOf('bladeRiposte');
    expect(talentNodeState(tree, node, viewOf(meta))).toEqual({
      status: 'locked',
      reason: { kind: 'requires', nodeId: 'bladeRoot' },
    });
  });

  it('powód: próg drzewka', () => {
    const meta = managerWithPoints(5);
    meta.debugGrantTalent('bladeRoot');
    meta.debugGrantTalent('bladeDashCut');
    const { tree, node } = nodeOf('bladeThrowEdge');
    expect(talentNodeState(tree, node, viewOf(meta))).toEqual({
      status: 'locked',
      reason: { kind: 'tier', points: 4 },
    });
  });

  it('powód: punkty w drzewkach dla hybrydy', () => {
    const meta = managerWithPoints(6);
    const { tree, node } = nodeOf('hybridStormDancer');
    expect(talentNodeState(tree, node, viewOf(meta))).toEqual({
      status: 'locked',
      reason: {
        kind: 'treePoints',
        needs: [
          { tree: 'blade', points: 3 },
          { tree: 'resonance', points: 3 },
        ],
      },
    });
  });
});

const panels: HubPanel[] = [];
function mount(meta: MetaManager, save = vi.fn(async () => {})) {
  const panel = createTalentsPanel({
    manager: meta,
    save,
    navigate: vi.fn(),
    close: vi.fn(),
  });
  panels.push(panel);
  document.body.append(panel.root);
  return { panel, save };
}
const card = (id: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`[data-node-id=${id}]`)!;
const free = (): string =>
  document.querySelector('.talents-panel__free')!.textContent!;
const status = (): string =>
  document.querySelector('[role=status]')!.textContent!;
const details = (): string =>
  document.querySelector('.talents-panel__details')!.textContent!;
const buyButton = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>('[data-action=buy-talent]')!;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const confirmModal = async (): Promise<void> => {
  document
    .querySelector<HTMLButtonElement>(
      'dialog.ui-modal .ui-button--destructive',
    )!
    .click();
  await flush();
};
const visibleTree = (): string | null =>
  document
    .querySelector('.talents-tree:not([hidden])')
    ?.getAttribute('data-tree') ?? null;

afterEach(() => {
  panels.splice(0).forEach((p) => p.dispose());
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('talentLayout', () => {
  it('rozkłada drzewko na kolumny progów, a krawędzie łączą wymagane węzły', () => {
    const blade = talentTrees.get('blade')!;
    const layout = layoutTree(blade);
    expect(layout.flat).toBe(false);
    expect(layout.columns.map((c) => c.tier)).toEqual([1, 2, 3, 4]);
    expect(layout.nodes).toHaveLength(blade.nodes.length);
    const root = layout.nodes.find((n) => n.node.id === 'bladeRoot')!;
    const riposte = layout.nodes.find((n) => n.node.id === 'bladeRiposte')!;
    expect(riposte.x).toBeGreaterThan(root.x);
    expect(layout.edges).toHaveLength(
      blade.nodes.reduce((sum, n) => sum + n.requires.length, 0),
    );
    expect(layout.edges.map((e) => e.to)).toContain('bladeRiposte');
  });

  it('hybrydy to siatka bez krawędzi, a strzałki wybierają najbliższego sąsiada', () => {
    const hybrid = layoutTree(talentTrees.get('hybrid')!);
    expect(hybrid.flat).toBe(true);
    expect(hybrid.edges).toEqual([]);
    const blade = layoutTree(talentTrees.get('blade')!);
    expect(neighbourInDirection(blade, 'bladeRoot', 1, 0)).toMatch(/^blade/);
    expect(neighbourInDirection(blade, 'bladeRoot', -1, 0)).toBeUndefined();
    expect(neighbourInDirection(blade, 'bladeThrowEdge', 1, 0)).toBe(
      'bladeHeavyBreaker',
    );
  });
});

describe('createTalentsPanel', () => {
  it('pokazuje nagłówek, cztery drzewka i stany węzłów', () => {
    mount(managerWithPoints(1));
    expect(free()).toBe('Punkty talentów: 1');
    expect(document.querySelector('.talents-panel__level')!.textContent).toBe(
      'Poziom 2',
    );
    expect(document.querySelectorAll('.talents-tree')).toHaveLength(4);
    expect(card('bladeRoot').dataset.state).toBe('available');
    expect(card('bladeRiposte').dataset.state).toBe('locked');
    expect(visibleTree()).toBe('blade');
  });

  it('powód blokady widać w panelu szczegółów po wyborze węzła', () => {
    mount(managerWithPoints(1));
    card('bladeRiposte').click();
    expect(details()).toContain('wymaga: ' + nodeOf('bladeRoot').node.name);
    expect(card('bladeRiposte').getAttribute('aria-pressed')).toBe('true');
    expect(buyButton().getAttribute('aria-disabled')).toBe('true');
    card('hybridStormDancer').click();
    expect(details()).toContain('wymaga 3 pkt w Ostrze i 3 pkt w Rezonans');
  });

  it('niedostępny węzeł nie wywołuje buyTalent ani save', async () => {
    const meta = managerWithPoints(1);
    const spy = vi.spyOn(meta, 'buyTalent');
    const { save } = mount(meta);
    card('bladeRiposte').click();
    buyButton().click();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(status()).toContain('wymaga');
  });

  it('klik wybiera węzeł, a kupuje dopiero przycisk w szczegółach', async () => {
    const meta = managerWithPoints(2);
    const { save } = mount(meta);
    expect(card('bladeRiposte').dataset.state).toBe('locked');
    card('bladeRoot').click();
    expect(meta.state.talents).toEqual([]);
    buyButton().click();
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(free()).toBe('Punkty talentów: 1');
    expect(card('bladeRoot').dataset.state).toBe('bought');
    expect(card('bladeRiposte').dataset.state).toBe('available');
    expect(meta.state.talents).toEqual(['bladeRoot']);
    expect(status()).toBe(`Kupiono: ${nodeOf('bladeRoot').node.name}.`);
    expect(
      document.querySelector('.talents-edge[data-state=open]'),
    ).not.toBeNull();
  });

  it('błąd z MetaManager trafia do linii statusu', async () => {
    const meta = managerWithPoints(1);
    vi.spyOn(meta, 'buyTalent').mockImplementation(() => {
      throw new Error('Wymagany talent: x.');
    });
    const { save } = mount(meta);
    card('bladeRoot').click();
    buyButton().click();
    await flush();
    expect(status()).toBe('Wymagany talent: x.');
    expect(save).not.toHaveBeenCalled();
  });

  it('opis węzła pojawia się po fokusie (klawiatura i pad)', () => {
    mount(managerWithPoints(1));
    card('bladeRoot').dispatchEvent(new Event('focus'));
    expect(details()).toContain(nodeOf('bladeRoot').node.description);
  });

  it('strzałki przenoszą fokus po grafie, cycleTab (Q/E, LB/RB) zmienia drzewko', () => {
    const { panel } = mount(managerWithPoints(1));
    card('bladeRoot').focus();
    card('bladeRoot').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect((document.activeElement as HTMLElement).dataset.nodeId).toMatch(
      /^blade(?!Root)/,
    );
    panel.cycleTab!(1);
    expect(visibleTree()).toBe('resonance');
    expect(document.activeElement?.getAttribute('role')).toBe('tab');
    panel.cycleTab!(-1);
    expect(visibleTree()).toBe('blade');
  });

  it('reset prosi o potwierdzenie modalem i przywraca punkty', async () => {
    const meta = managerWithPoints(1);
    const { save } = mount(meta);
    card('bladeRoot').click();
    buyButton().click();
    await flush();
    expect(free()).toBe('Punkty talentów: 0');
    const reset = document.querySelector<HTMLButtonElement>(
      '.talents-panel__reset',
    )!;
    reset.click();
    // Anulowanie nic nie zmienia.
    document
      .querySelector<HTMLButtonElement>(
        'dialog.ui-modal .ui-button--secondary',
      )!
      .click();
    await flush();
    expect(meta.state.talents).toHaveLength(1);
    reset.click();
    await confirmModal();
    expect(meta.state.talents).toEqual([]);
    expect(free()).toBe('Punkty talentów: 1');
    expect(save).toHaveBeenCalledTimes(2);
  });
});
