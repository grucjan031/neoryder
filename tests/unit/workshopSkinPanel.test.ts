// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';
import { createAchievementsPanel } from '../../src/ui/hub/achievementsPanel';
import { achievementDefinitions } from '../../src/progression/achievementsSchema';

it('pozwala przymierzyć zablokowany skin i wyjaśnia, jak go zdobyć', () => {
  const manager = new MetaManager(createStarterMetaState());
  const panel = createWorkshopPanel({
    manager,
    save: vi.fn(),
    navigate: vi.fn(),
    close: vi.fn(),
  });
  try {
    const tiles = panel.root.querySelectorAll<HTMLElement>('.workshop__skin');
    expect(tiles[0]?.dataset.skin).toBe('factory');
    const tile = panel.root.querySelector<HTMLElement>(
      '[data-skin="kurtyna-brandta"]',
    )!;
    expect(tile.querySelector<HTMLButtonElement>('.ui-button')?.disabled).toBe(
      true,
    );
    expect(tile.textContent).toContain(
      achievementDefinitions.get('upadek-brandta')!.hint,
    );
    tile.querySelector('button')!.click();
    expect(
      panel.root.querySelector<HTMLElement>('[data-testid="weapon-preview"]')
        ?.dataset.skin,
    ).toBe('kurtyna-brandta');
    expect(manager.state.loadout.skins).toEqual({});
    const shop = panel.root.querySelector(
      '.workshop__skin[data-skin="bursztynowa-linia"]',
    )!;
    expect(shop.textContent).toContain('Wymagany poziom 3');
  } finally {
    panel.dispose();
  }
});
it('pokazuje obok waluty nazwę nagrody przedmiotowej', () => {
  const panel = createAchievementsPanel(
    new MetaManager(createStarterMetaState()),
  );
  try {
    const reward = panel.root.querySelector(
      '[data-id="zwierciadlo"] .achv-card__reward',
    );
    expect(reward?.textContent).toContain('20 Danych');
    expect(reward?.textContent).toContain('Skin: Zwierciadło');
  } finally {
    panel.dispose();
  }
});
