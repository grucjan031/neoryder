// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';
import {
  equipmentState,
  groupRows,
  nextLoadout,
  toggleSelection,
  unlockRows,
} from '../../src/ui/hub/workshopState';

const panels: HubPanel[] = [];
afterEach(() => {
  panels.splice(0).forEach((panel) => panel.dispose());
  document.body.replaceChildren();
});

function setup(prepare?: (manager: MetaManager) => void) {
  const manager = new MetaManager(createStarterMetaState());
  prepare?.(manager);
  const save = vi.fn(() => Promise.resolve());
  const panel = createWorkshopPanel({
    manager,
    save,
    navigate: vi.fn(),
    close: vi.fn(),
  });
  panels.push(panel);
  document.body.append(panel.root);
  return { manager, save, panel };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const row = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-unlock="${id}"]`)!;
const buyButton = (root: HTMLElement, id: string) =>
  row(root, id).querySelector<HTMLButtonElement>('button')!;
const choice = (root: HTMLElement, part: string, item: string) =>
  root.querySelector<HTMLButtonElement>(
    `button[data-part="${part}"][data-item="${item}"]`,
  );
const status = (root: HTMLElement) =>
  root.querySelector('[role="status"]')!.textContent;

describe('workshopState', () => {
  it('statusy wierszy: posiadane, poziom, Dane, Rdzenie, do kupienia', () => {
    const manager = new MetaManager(createStarterMetaState());
    let rows = unlockRows(manager);
    const find = (id: string) => rows.find((r) => r.id === id)!;
    expect(find('weapon:blaster').status).toBe('owned');
    expect(find('weapon:rifle').status).toBe('data');
    manager.debugAddData(1000);
    rows = unlockRows(manager);
    expect(find('weapon:rifle').status).toBe('buyable');
    expect(find('weapon:scatter').status).toBe('level');
    expect(find('weapon:scatter').minLevel).toBe(2);
    manager.debugAddXp(1_000_000);
    rows = unlockRows(manager);
    expect(find('power:focus').status).toBe('cores');
    manager.debugAddCores(100);
    expect(
      unlockRows(manager).find((r) => r.id === 'power:focus')!.status,
    ).toBe('buyable');
  });

  it('grupy: Bronie, Moce, Ostrza, Sloty; startowe posiadane na początku', () => {
    const groups = groupRows(
      unlockRows(new MetaManager(createStarterMetaState())),
    );
    expect(groups.map((g) => g.kind)).toEqual([
      'weapon',
      'power',
      'blade',
      'slot',
    ]);
    expect(groups[0]!.rows[0]!.status).toBe('owned');
    expect(groups[3]!.rows.map((r) => r.name)).toContain('Drugi slot broni');
  });

  it('toggleSelection: limit slotów i ostatnia pozycja', () => {
    expect(toggleSelection(['a'], 'b', 1)).toBeNull();
    expect(toggleSelection(['a'], 'a', 2)).toBeNull();
    expect(toggleSelection(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b'], 'a', 2)).toEqual(['b']);
  });

  it('equipmentState i nextLoadout respektują sloty', () => {
    const manager = new MetaManager(createStarterMetaState());
    const state = equipmentState(manager);
    expect(state.weapons.slots).toBe(1);
    expect(state.weapons.options.find((o) => o.key === 'pistol')!.blocked).toBe(
      'full',
    );
    expect(nextLoadout(manager, 'weapons', 'pistol')).toBeNull();
    expect(nextLoadout(manager, 'weapons', 'blaster')).toBeNull();
    manager.debugUnlockAll();
    expect(nextLoadout(manager, 'weapons', 'pistol')?.weapons).toEqual([
      'blaster',
      'pistol',
    ]);
  });
});

describe('createWorkshopPanel', () => {
  it('pokazuje Dane, Rdzenie i poziom w nagłówku', () => {
    const { root } = setup((m) => {
      m.debugAddData(42);
      m.debugAddCores(7);
    }).panel;
    expect(root.querySelector('[data-stat="data"] strong')!.textContent).toBe(
      '42',
    );
    expect(root.querySelector('[data-stat="cores"] strong')!.textContent).toBe(
      '7',
    );
    expect(root.querySelector('[data-stat="level"] strong')!.textContent).toBe(
      '1',
    );
  });

  it('zakup bez waluty i poniżej poziomu jest nieaktywny (brak buyUnlock)', async () => {
    const { manager, panel } = setup();
    const spy = vi.spyOn(manager, 'buyUnlock');
    const poor = buyButton(panel.root, 'weapon:rifle');
    expect(poor.disabled).toBe(true);
    expect(row(panel.root, 'weapon:rifle').textContent).toContain(
      'Za mało Danych',
    );
    poor.click();
    manager.debugAddData(1000);
    panel.refresh();
    const lowLevel = buyButton(panel.root, 'weapon:scatter');
    expect(lowLevel.disabled).toBe(true);
    expect(row(panel.root, 'weapon:scatter').textContent).toContain(
      'Wymagany poziom 2',
    );
    lowLevel.click();
    await flush();
    expect(spy).not.toHaveBeenCalled();
  });

  it('zakup odejmuje walutę, zapisuje i pokazuje pozycję jako posiadaną w edytorze', async () => {
    const { manager, save, panel } = setup((m) => m.debugAddData(100));
    expect(choice(panel.root, 'weapons', 'rifle')).toBeNull();
    buyButton(panel.root, 'weapon:rifle').click();
    await flush();
    expect(manager.state.data).toBe(20);
    expect(manager.isUnlocked('weapon:rifle')).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(row(panel.root, 'weapon:rifle').textContent).toContain('Posiadane');
    expect(row(panel.root, 'weapon:rifle').querySelector('button')).toBeNull();
    expect(choice(panel.root, 'weapons', 'rifle')).not.toBeNull();
    expect(
      panel.root.querySelector('[data-stat="data"] strong')!.textContent,
    ).toBe('20');
    expect(status(panel.root)).toBe('');
  });

  it('nie da się wybrać ponad limit slotów ani odznaczyć ostatniej pozycji', async () => {
    const { manager, save, panel } = setup((m) => {
      m.debugAddData(10_000);
      m.debugAddXp(1_000_000);
      m.buyUnlock('weapon:rifle');
      m.buyUnlock('power:grab');
    });
    panel.refresh();
    const spy = vi.spyOn(manager, 'setLoadout');
    expect(choice(panel.root, 'weapons', 'rifle')!.disabled).toBe(true);
    expect(choice(panel.root, 'weapons', 'blaster')!.disabled).toBe(true);
    expect(choice(panel.root, 'powers', 'push')!.disabled).toBe(true);
    choice(panel.root, 'weapons', 'rifle')!.click();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(
      panel.root.querySelector('[data-counter="weapons"]')!.textContent,
    ).toBe('Bronie: 1/1');
  });

  it('zmiana ekwipunku woła setLoadout i save, kolejność = kolejność wyboru', async () => {
    const { manager, save, panel } = setup((m) => {
      m.debugUnlockAll();
    });
    // debugUnlockAll odblokowuje też sloty: weapon:2 = 3 sloty broni, 2 sloty mocy
    const spy = vi.spyOn(manager, 'setLoadout');
    choice(panel.root, 'weapons', 'rifle')!.click();
    await flush();
    choice(panel.root, 'weapons', 'pistol')!.click();
    await flush();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
    expect(manager.state.loadout.weapons).toEqual([
      'blaster',
      'rifle',
      'pistol',
    ]);
    expect(
      panel.root.querySelector('[data-counter="weapons"]')!.textContent,
    ).toBe('Bronie: 3/3');
    expect(choice(panel.root, 'weapons', 'beam')!.disabled).toBe(true);
    choice(panel.root, 'weapons', 'blaster')!.click();
    await flush();
    expect(manager.state.loadout.weapons).toEqual(['rifle', 'pistol']);
    choice(panel.root, 'powers', 'grab')!.click();
    await flush();
    expect(manager.state.loadout.powers).toEqual(['push', 'grab']);
    panel.root
      .querySelector<HTMLButtonElement>(
        'button[data-action="blade"][data-item="twinBlades"]',
      )!
      .click();
    await flush();
    expect(manager.state.loadout.blade).toBe('twinBlades');
  });

  it('błąd zakupu i błąd setLoadout trafiają do linii statusu bez zmiany stanu', async () => {
    const { manager, save, panel } = setup((m) => m.debugAddData(500));
    vi.spyOn(manager, 'buyUnlock').mockImplementation(() => {
      throw new Error('Za mało Danych.');
    });
    buyButton(panel.root, 'weapon:rifle').click();
    await flush();
    expect(status(panel.root)).toBe('Za mało Danych.');
    expect(save).not.toHaveBeenCalled();

    manager.debugUnlockAll();
    panel.refresh();
    const before = manager.state.loadout;
    vi.spyOn(manager, 'setLoadout').mockImplementation(() => {
      throw new Error('Nieodblokowane (broń): rifle.');
    });
    choice(panel.root, 'weapons', 'rifle')!.click();
    await flush();
    expect(status(panel.root)).toBe('Nieodblokowane (broń): rifle.');
    expect(manager.state.loadout).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('nazwy ostrzy i slotów pochodzą z tekstów', () => {
    const { panel } = setup();
    expect(row(panel.root, 'blade:twinBlades').textContent).toContain(
      'Ostrza bliźniacze',
    );
    expect(row(panel.root, 'slot:power2').textContent).toContain(
      'Drugi slot mocy',
    );
  });
});
