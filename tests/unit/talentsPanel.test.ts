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
import {
  RESET_CONFIRM_MS,
  createTalentsPanel,
} from '../../src/ui/hub/talentsPanel';

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
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  panels.splice(0).forEach((p) => p.dispose());
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('createTalentsPanel', () => {
  it('pokazuje nagłówek, drzewka i stany kart', () => {
    mount(managerWithPoints(1));
    expect(free()).toBe('Punkty talentów: 1');
    expect(document.querySelector('.talents-panel__level')!.textContent).toBe(
      'Poziom 2',
    );
    expect(document.querySelectorAll('.talents-tree')).toHaveLength(4);
    expect(card('bladeRoot').dataset.state).toBe('available');
    expect(card('bladeRiposte').dataset.state).toBe('locked');
    expect(card('bladeRiposte').textContent).toContain(
      'wymaga: ' + nodeOf('bladeRoot').node.name,
    );
    expect(card('hybridStormDancer').textContent).toContain(
      'wymaga 3 pkt w Ostrze i 3 pkt w Rezonans',
    );
  });

  it('niedostępny węzeł nie wywołuje buyTalent ani save', async () => {
    const meta = managerWithPoints(1);
    const spy = vi.spyOn(meta, 'buyTalent');
    const { save } = mount(meta);
    card('bladeRiposte').click();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('zakup zmniejsza punkty, zapisuje i odświeża sąsiadów', async () => {
    const meta = managerWithPoints(2);
    const { save } = mount(meta);
    expect(card('bladeRiposte').dataset.state).toBe('locked');
    card('bladeRoot').click();
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(free()).toBe('Punkty talentów: 1');
    expect(card('bladeRoot').dataset.state).toBe('bought');
    expect(card('bladeRiposte').dataset.state).toBe('available');
    expect(meta.state.talents).toEqual(['bladeRoot']);
  });

  it('błąd z MetaManager trafia do linii statusu', async () => {
    const meta = managerWithPoints(1);
    vi.spyOn(meta, 'buyTalent').mockImplementation(() => {
      throw new Error('Wymagany talent: x.');
    });
    const { save } = mount(meta);
    card('bladeRoot').click();
    await flush();
    expect(status()).toBe('Wymagany talent: x.');
    expect(save).not.toHaveBeenCalled();
  });

  it('opis węzła po fokusie', () => {
    mount(managerWithPoints(1));
    card('bladeRoot').dispatchEvent(new Event('focus'));
    expect(
      document.querySelector('.talents-panel__details')!.textContent,
    ).toContain(nodeOf('bladeRoot').node.description);
  });

  it('reset wymaga potwierdzenia i przywraca punkty', async () => {
    const meta = managerWithPoints(1);
    const { save } = mount(meta);
    card('bladeRoot').click();
    await flush();
    expect(free()).toBe('Punkty talentów: 0');
    const reset = document.querySelector<HTMLButtonElement>(
      '.talents-panel__reset',
    )!;
    reset.click();
    expect(reset.textContent).toBe('Potwierdź reset');
    expect(meta.state.talents).toHaveLength(1);
    reset.click();
    await flush();
    expect(meta.state.talents).toEqual([]);
    expect(free()).toBe('Punkty talentów: 1');
    expect(save).toHaveBeenCalledTimes(2);
    expect(reset.textContent).toBe('Resetuj talenty');
  });

  it('potwierdzenie resetu wygasa', () => {
    vi.useFakeTimers();
    const meta = managerWithPoints(1);
    mount(meta);
    const reset = document.querySelector<HTMLButtonElement>(
      '.talents-panel__reset',
    )!;
    reset.click();
    vi.advanceTimersByTime(RESET_CONFIRM_MS + 1);
    expect(reset.textContent).toBe('Resetuj talenty');
  });
});
