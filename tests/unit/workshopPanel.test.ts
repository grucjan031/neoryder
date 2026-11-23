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
  nextModuleLoadout,
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
const isDisabled = (node: Element | null): boolean =>
  node?.getAttribute('aria-disabled') === 'true' ||
  (node as HTMLButtonElement | null)?.disabled === true;
/** Wybiera wiersz sklepu i zwraca główny przycisk jego karty. */
const openCard = (root: HTMLElement, id: string): HTMLButtonElement => {
  root.querySelector<HTMLElement>(`[data-key="row:${id}"]`)!.click();
  return root.querySelector<HTMLButtonElement>(
    `[data-card="${id}"] [data-action="card"]`,
  )!;
};
/** Potwierdza okno zakupu (modal `uiConfirm`). */
const confirmModal = async (): Promise<void> => {
  document
    .querySelector<HTMLButtonElement>('dialog.ui-modal .ui-button--primary')!
    .click();
  await flush();
};

it('wydobywa jeden moduł, pozwala ponowić zapis i od razu udostępnia montaż', async () => {
  const manager = new MetaManager({
    ...createStarterMetaState(),
    pendingExtractions: [
      { runId: 'elite:1', moduleIds: ['pierce', 'ricochet'] },
    ],
  });
  const save = vi
    .fn(async () => {})
    .mockRejectedValueOnce(new Error('Błąd dysku'));
  const panel = createWorkshopPanel({
    manager,
    save,
    close: vi.fn(),
    navigate: vi.fn(),
  });
  panels.push(panel);
  const button = panel.root.querySelector<HTMLButtonElement>(
    '[data-key="extract:elite:1:pierce"]',
  )!;
  button.click();
  await flush();
  expect(status(panel.root)).toContain('Błąd dysku');
  panel.root
    .querySelector<HTMLButtonElement>('[data-section="extraction"] button')!
    .click();
  await flush();
  expect(save).toHaveBeenCalledTimes(2);
  expect(panel.root.querySelector('[data-section="extraction"]')).toBeNull();
  expect(manager.isUnlocked('module:ricochet')).toBe(false);
  const slot = panel.root.querySelector<HTMLSelectElement>(
    'select[data-weapon="blaster"][data-slot="0"]',
  )!;
  slot.value = 'pierce';
  slot.dispatchEvent(new Event('change'));
  await flush();
  expect(manager.loadout().modules?.blaster).toEqual(['pierce']);
});
const row = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-unlock="${id}"]`)!;
const choice = (root: HTMLElement, part: string, item: string) =>
  root.querySelector<HTMLButtonElement>(
    `button[data-part="${part}"][data-item="${item}"]`,
  );
const status = (root: HTMLElement) =>
  root.querySelector('[role="status"]')!.textContent;

describe('workshopState', () => {
  it('zmiana modułu pomija nieznane id w starym zapisie i sortuje po slotach', () => {
    const state = createStarterMetaState();
    state.loadout.modules = { blaster: ['scope', 'unknown', 'incendiary'] };
    const manager = new MetaManager(state);
    expect(nextModuleLoadout(manager, 'blaster', 0, 'pierce').modules).toEqual({
      blaster: ['pierce', 'incendiary', 'scope'],
    });
    expect(manager.state).toEqual(state);
  });
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
    expect(find('slot:power2').status).toBe('cores');
    manager.debugAddCores(100);
    expect(
      unlockRows(manager).find((r) => r.id === 'slot:power2')!.status,
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
      'module',
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
  it('odrzucona zmiana podczas zapisu przywraca select do stanu meta', async () => {
    const { manager, save, panel } = setup((m) => m.debugUnlockAll());
    let finishSave: () => void = () => {};
    save.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const spy = vi.spyOn(manager, 'setLoadout');
    const select = (slot: number) =>
      panel.root.querySelector<HTMLSelectElement>(
        `select[data-weapon="blaster"][data-slot="${slot}"]`,
      )!;
    select(0).value = 'pierce';
    select(0).dispatchEvent(new Event('change'));
    select(1).value = 'incendiary';
    select(1).dispatchEvent(new Event('change'));
    expect(select(0).value).toBe('pierce');
    expect(select(1).value).toBe('');
    expect(manager.state.loadout.modules).toEqual({ blaster: ['pierce'] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    finishSave();
    await flush();
    expect(select(1).value).toBe('');
    select(1).value = 'incendiary';
    select(1).dispatchEvent(new Event('change'));
    await flush();
    expect(manager.state.loadout.modules.blaster).toEqual([
      'pierce',
      'incendiary',
    ]);
  });

  it('błąd obliczenia modułów trafia do statusu, a select wraca do meta', async () => {
    const { manager, save, panel } = setup((m) => m.debugUnlockAll());
    const select = panel.root.querySelector<HTMLSelectElement>(
      'select[data-weapon="blaster"][data-slot="0"]',
    )!;
    const invalid = document.createElement('option');
    invalid.value = 'scope';
    select.append(invalid);
    select.value = 'scope';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(status(panel.root)).toBe('Moduł nie pasuje do slotu.');
    expect(panel.root.querySelector<HTMLSelectElement>('select')!.value).toBe(
      '',
    );
    expect(manager.state.loadout.modules).toEqual({});
    expect(save).not.toHaveBeenCalled();
  });

  it('błąd setLoadout i odrzucony zapis odświeżają select ze stanu meta', async () => {
    const { manager, save, panel } = setup((m) => m.debugUnlockAll());
    const select = () =>
      panel.root.querySelector<HTMLSelectElement>(
        'select[data-weapon="blaster"][data-slot="0"]',
      )!;
    vi.spyOn(manager, 'setLoadout').mockImplementationOnce(() => {
      throw new Error('Odrzucono moduł.');
    });
    select().value = 'pierce';
    select().dispatchEvent(new Event('change'));
    await flush();
    expect(status(panel.root)).toBe('Odrzucono moduł.');
    expect(select().value).toBe('');
    expect(save).not.toHaveBeenCalled();
    save.mockRejectedValueOnce(new Error('Błąd zapisu.'));
    select().value = 'ricochet';
    select().dispatchEvent(new Event('change'));
    await flush();
    expect(status(panel.root)).toBe('Błąd zapisu.');
    expect(select().value).toBe('ricochet');
    expect(manager.state.loadout.modules).toEqual({ blaster: ['ricochet'] });
  });
  it('montuje i usuwa moduły przez setLoadout i save, filtruje duplikaty oraz typ broni', async () => {
    const { manager, save, panel } = setup((m) => m.debugUnlockAll());
    const spy = vi.spyOn(manager, 'setLoadout');
    const select = (weapon: string, slot: number) =>
      panel.root.querySelector<HTMLSelectElement>(
        `select[data-weapon="${weapon}"][data-slot="${slot}"]`,
      )!;
    expect(row(panel.root, 'module:ricochet').textContent).toContain(
      'Rykoszet',
    );
    expect(
      panel.root.querySelectorAll('select[data-weapon="blaster"]'),
    ).toHaveLength(4);
    select('blaster', 0).value = 'ricochet';
    select('blaster', 0).dispatchEvent(new Event('change'));
    await flush();
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modules: { blaster: ['ricochet'] },
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(select('blaster', 0).value).toBe('ricochet');
    expect([...select('blaster', 1).options].map((o) => o.value)).not.toContain(
      'ricochet',
    );
    select('blaster', 1).value = 'incendiary';
    select('blaster', 1).dispatchEvent(new Event('change'));
    await flush();
    expect(manager.state.loadout.modules.blaster).toEqual([
      'ricochet',
      'incendiary',
    ]);
    select('blaster', 0).value = '';
    select('blaster', 0).dispatchEvent(new Event('change'));
    await flush();
    expect(manager.state.loadout.modules.blaster).toEqual(['incendiary']);
    expect(select('blaster', 1).value).toBe('incendiary');
    expect(select('blaster', 0).value).toBe('');
    expect(
      panel.root.querySelector('[data-module-weapon="blaster"]')?.textContent,
    ).toContain('Ogniwo');
    expect(
      panel.root.querySelector('[data-module-weapon="blaster"]')?.textContent,
    ).toContain('Optyka');
    expect(
      panel.root.querySelector(
        '[data-module-weapon="blaster"] .workshop__module-description',
      )?.textContent,
    ).toBe('');
    expect(
      select('blaster', 1).parentElement?.querySelector(
        '.workshop__module-description',
      )?.textContent,
    ).toContain('Trafienie podpala');
    choice(panel.root, 'weapons', 'beam')!.click();
    await flush();
    expect([...select('beam', 1).options].map((o) => o.value)).toEqual([
      '',
      'extendedCell',
      'incendiary',
    ]);
    choice(panel.root, 'weapons', 'blaster')!.click();
    await flush();
    expect(manager.state.loadout.modules).toEqual({});
    expect(
      panel.root.querySelector('select[data-weapon="blaster"]'),
    ).toBeNull();
    expect(save).toHaveBeenCalledTimes(5);
  });

  it('sloty nie oferują nieodblokowanych modułów', () => {
    const { panel } = setup();
    const select = panel.root.querySelector<HTMLSelectElement>('select')!;
    expect([...select.options].map((o) => o.value)).toEqual(['']);
  });
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
    const poor = openCard(panel.root, 'weapon:rifle');
    expect(isDisabled(poor)).toBe(true);
    expect(row(panel.root, 'weapon:rifle').textContent).toContain(
      'Za mało Danych',
    );
    poor.click();
    expect(status(panel.root)).toBe('Za mało Danych');
    manager.debugAddData(1000);
    panel.refresh();
    const lowLevel = openCard(panel.root, 'weapon:scatter');
    expect(isDisabled(lowLevel)).toBe(true);
    expect(row(panel.root, 'weapon:scatter').textContent).toContain(
      'Wymagany poziom 2',
    );
    lowLevel.click();
    await flush();
    expect(document.querySelector('dialog.ui-modal')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('zakup odejmuje walutę, zapisuje i pokazuje pozycję jako posiadaną w edytorze', async () => {
    const { manager, save, panel } = setup((m) => {
      m.debugAddData(100);
      m.debugGrantAchievement('pierwszy-zakup');
    });
    expect(choice(panel.root, 'weapons', 'rifle')).toBeNull();
    openCard(panel.root, 'weapon:rifle').click();
    // Zakup wymaga potwierdzenia: Anuluj nic nie zmienia, Kup kupuje.
    document
      .querySelector<HTMLButtonElement>(
        'dialog.ui-modal .ui-button--secondary',
      )!
      .click();
    await flush();
    expect(manager.state.data).toBe(100);
    expect(save).not.toHaveBeenCalled();
    openCard(panel.root, 'weapon:rifle').click();
    expect(document.querySelector('dialog.ui-modal')!.textContent).toContain(
      'Cena: 80 Dane',
    );
    await confirmModal();
    expect(manager.state.data).toBe(20);
    expect(manager.isUnlocked('weapon:rifle')).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(row(panel.root, 'weapon:rifle').textContent).toContain('Posiadane');
    expect(row(panel.root, 'weapon:rifle').querySelector('button')).toBeNull();
    expect(choice(panel.root, 'weapons', 'rifle')).not.toBeNull();
    expect(
      panel.root.querySelector('[data-stat="data"] strong')!.textContent,
    ).toBe('20');
    expect(status(panel.root)).toBe('Kupiono: Karabin.');
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
    expect(isDisabled(choice(panel.root, 'weapons', 'rifle')!)).toBe(true);
    expect(isDisabled(choice(panel.root, 'weapons', 'blaster')!)).toBe(true);
    expect(isDisabled(choice(panel.root, 'powers', 'push')!)).toBe(true);
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
    expect(isDisabled(choice(panel.root, 'weapons', 'beam')!)).toBe(true);
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
    openCard(panel.root, 'weapon:rifle').click();
    await confirmModal();
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

  it('bez WebGL (jsdom) podgląd się nie tworzy, a panel działa i niesie atrybuty', () => {
    const { panel } = setup();
    const box = panel.root.querySelector<HTMLElement>(
      '[data-testid="weapon-preview"]',
    )!;
    expect(box.dataset.weapon).toBe('blaster');
    expect(box.dataset.modules).toBe('');
    expect(box.querySelector('canvas')!.hidden).toBe(true);
    expect(box.querySelector('p')!.hidden).toBe(false);
    expect(() => panel.refresh()).not.toThrow();
  });
});

describe('warsztat: nawigacja klawiaturą i padem, porównanie statystyk', () => {
  const tab = (root: HTMLElement, id: string) =>
    root.querySelector<HTMLButtonElement>(
      `[data-action="tab"][data-tab="${id}"]`,
    )!;
  const selectedTab = (root: HTMLElement) =>
    root
      .querySelector('[role="tab"][aria-selected="true"]')!
      .getAttribute('data-tab');

  it('kategorie to pionowa lista zakładek: strzałki góra/dół, Home/End i cycleTab (Q/E, LB/RB)', () => {
    const { panel } = setup((m) => m.debugAddData(100));
    const list = panel.root.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
    // Zakładka Wydobycie jest ukryta, gdy nie ma ofert.
    expect(tab(panel.root, 'extraction').hidden).toBe(true);
    expect(selectedTab(panel.root)).toBe('weapon');
    tab(panel.root, 'weapon').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(selectedTab(panel.root)).toBe('module');
    expect(
      panel.root.querySelector<HTMLElement>('[data-pane="module"]')!.hidden,
    ).toBe(false);
    panel.cycleTab!(1);
    expect(selectedTab(panel.root)).toBe('equipment');
    panel.cycleTab!(1);
    panel.cycleTab!(1);
    // Zapętlenie pomija ukrytą zakładkę Wydobycie.
    expect(selectedTab(panel.root)).toBe('weapon');
    panel.cycleTab!(-1);
    expect(selectedTab(panel.root)).toBe('unlocks');
  });

  it('wiersz sklepu wybiera się Enterem, a karta pokazuje ▲ lepiej i ▼ gorzej', () => {
    const { panel } = setup((m) => m.debugAddData(500));
    const rifle = panel.root.querySelector<HTMLElement>(
      '[data-key="row:weapon:rifle"]',
    )!;
    rifle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    const better = panel.root.querySelector<HTMLElement>(
      '.workshop__trend[data-trend="better"]',
    )!;
    const worse = panel.root.querySelector<HTMLElement>(
      '.workshop__trend[data-trend="worse"]',
    )!;
    expect(better.textContent).toContain('▲');
    expect(better.textContent).toContain('lepiej');
    expect(worse.textContent).toContain('▼');
  });
});
