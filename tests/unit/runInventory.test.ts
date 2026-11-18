import { describe, expect, it } from 'vitest';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { implantDefinitions } from '../../src/progression/implants';
import { buildRunInventoryView } from '../../src/ui/runInventory';

describe('widok menu ulepszeń', () => {
  const loadout = loadoutDefinitions.get('classic')!;

  it('pokazuje implanty z opisem i rzadkością oraz kredyty', () => {
    const id = [...implantDefinitions.keys()][0]!;
    const view = buildRunInventoryView({
      loadout,
      implants: [id],
      credits: 42,
    });
    expect(view.credits).toBe(42);
    expect(view.implants).toHaveLength(1);
    expect(view.implants[0]!.name).toBe(implantDefinitions.get(id)!.name);
    expect(view.implants[0]!.rarity).toBe(implantDefinitions.get(id)!.rarity);
    expect(view.implants[0]!.description.length).toBeGreaterThan(0);
  });

  it('pokazuje moce i broń z modułami, bez implantów daje pustą listę', () => {
    const view = buildRunInventoryView({ loadout });
    expect(view.implants).toEqual([]);
    expect(view.credits).toBeUndefined();
    expect(view.powers).toHaveLength(loadout.powers.length);
    expect(view.weapons).toHaveLength(loadout.weapons.length);
    expect(view.weapons[0]!.modules).toEqual([]);
  });

  it('aktywuje synergie z tagów ekwipunku i implantów', () => {
    const withTags = {
      ...loadout,
      tags: ['#melee', '#melee', '#melee'],
    };
    const view = buildRunInventoryView({ loadout: withTags });
    expect(view.synergies.map((entry) => entry.name)).toContain(
      'Mistrzostwo ostrza',
    );
  });

  it('nieznany implant nie psuje widoku', () => {
    const view = buildRunInventoryView({ loadout, implants: ['nie-ma'] });
    expect(view.implants[0]!.name).toBe('nie-ma');
  });
});
