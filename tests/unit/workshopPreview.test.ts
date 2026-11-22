// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';
import { previewTarget } from '../../src/ui/hub/workshopState';

const fake = vi.hoisted(() => ({
  instances: [] as {
    show: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    highlight: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('../../src/render/weaponPreview', () => ({
  PREVIEW_WIDTH: 360,
  PREVIEW_HEIGHT: 220,
  canCreateWeaponPreview: () => true,
  WeaponPreview: class {
    show = vi.fn(() => Promise.resolve());
    dispose = vi.fn();
    highlight = vi.fn();
    constructor() {
      fake.instances.push(this);
    }
  },
}));

const panels: HubPanel[] = [];
afterEach(() => {
  panels.splice(0).forEach((panel) => panel.dispose());
  document.body.replaceChildren();
  fake.instances.length = 0;
});

function setup(prepare?: (manager: MetaManager) => void) {
  const manager = new MetaManager(createStarterMetaState());
  prepare?.(manager);
  const panel = createWorkshopPanel({
    manager,
    save: vi.fn(() => Promise.resolve()),
    navigate: vi.fn(),
    close: vi.fn(),
  });
  panels.push(panel);
  document.body.append(panel.root);
  return { manager, panel };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const box = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-testid="weapon-preview"]')!;

describe('podgląd broni w warsztacie', () => {
  it('previewTarget: wybrana broń z ekwipunku, inaczej pierwsza; moduły oczyszczone', () => {
    const state = createStarterMetaState();
    state.loadout.weapons = ['blaster', 'rifle'];
    state.loadout.modules = {
      blaster: ['pierce', 'unknown'],
      rifle: ['scope'],
    };
    const manager = new MetaManager(state);
    expect(previewTarget(manager)).toEqual({
      weaponId: 'blaster',
      moduleIds: ['pierce'],
    });
    expect(previewTarget(manager, 'rifle')?.weaponId).toBe('rifle');
    expect(previewTarget(manager, 'scatter')?.weaponId).toBe('blaster');
  });

  it('kontener ma data-weapon i data-modules, a podgląd dostaje broń', () => {
    const { panel } = setup();
    expect(fake.instances).toHaveLength(1);
    expect(box(panel.root).dataset.weapon).toBe('blaster');
    expect(box(panel.root).dataset.modules).toBe('');
    expect(fake.instances[0]!.show).toHaveBeenCalledWith('blaster', []);
  });

  it('zmiana modułu w polu slotu aktualizuje data-modules i podgląd', async () => {
    const { panel } = setup((manager) => manager.debugUnlockAll());
    const select = panel.root.querySelector<HTMLSelectElement>(
      'select[data-weapon="blaster"][data-slot="0"]',
    )!;
    select.value = 'pierce';
    select.dispatchEvent(new Event('change'));
    await flush();
    expect(box(panel.root).dataset.modules).toBe('pierce');
    expect(fake.instances[0]!.show).toHaveBeenLastCalledWith('blaster', [
      'pierce',
    ]);
    // Ten sam stan po odświeżeniu nie ładuje modelu ponownie.
    const calls = fake.instances[0]!.show.mock.calls.length;
    panel.refresh();
    expect(fake.instances[0]!.show.mock.calls.length).toBe(calls);
  });

  it('przełącznik broni zmienia podgląd bez zmiany ekwipunku', async () => {
    const { panel, manager } = setup((m) => {
      m.debugUnlockAll();
      m.setLoadout({ ...m.state.loadout, weapons: ['blaster', 'rifle'] });
    });
    expect(
      panel.root.querySelectorAll('button[data-action="preview"]'),
    ).toHaveLength(2);
    panel.root
      .querySelector<HTMLButtonElement>(
        'button[data-action="preview"][data-item="rifle"]',
      )!
      .click();
    await flush();
    expect(box(panel.root).dataset.weapon).toBe('rifle');
    expect(fake.instances[0]!.show).toHaveBeenLastCalledWith('rifle', []);
    expect(manager.state.loadout.weapons).toEqual(['blaster', 'rifle']);
  });

  it('canvas przeżywa odświeżenia, a dispose panelu zwalnia podgląd', () => {
    const { panel } = setup();
    const canvas = panel.root.querySelector('canvas');
    panel.refresh();
    expect(panel.root.querySelector('canvas')).toBe(canvas);
    panel.dispose();
    expect(fake.instances[0]!.dispose).toHaveBeenCalledTimes(1);
  });
});
