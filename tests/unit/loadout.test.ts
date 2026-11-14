import { describe, expect, it } from 'vitest';
import {
  loadLoadout,
  loadLoadoutDefinitions,
  loadoutDefinitions,
} from '../../src/progression/loadout';

const classic = {
  id: 'classic',
  name: 'Klasyczny',
  blade: 'plasmaBlade',
  weapons: ['blaster'],
  powers: ['push'],
  tags: [],
};

describe('Loadout', () => {
  it('loads the four presets and preserves the F1 default', () => {
    expect([...loadoutDefinitions.keys()].sort()).toEqual([
      'blade',
      'classic',
      'gunner',
      'resonance',
    ]);
    expect(loadoutDefinitions.get('classic')).toEqual(classic);
    expect(loadoutDefinitions.get('blade')).toMatchObject({
      name: 'Ostrze',
      weapons: ['pistol'],
      powers: ['push'],
      tags: ['#build_blade'],
    });
    expect(loadoutDefinitions.get('resonance')).toMatchObject({
      name: 'Moc',
      weapons: ['blaster'],
      powers: ['push', 'shockwave'],
      tags: ['#build_resonance'],
    });
    expect(loadoutDefinitions.get('gunner')).toMatchObject({
      name: 'Strzelec',
      weapons: ['rifle', 'scatter', 'sniper'],
      powers: ['push'],
      tags: ['#build_gunner'],
    });
  });

  it.each([
    { weapons: ['missing'] },
    { powers: ['missing'] },
    { blade: 'missing' },
    { weapons: ['blaster', 'blaster'] },
    { powers: ['push', 'push'] },
    { weapons: [] },
    { powers: [] },
    { weapons: ['pistol', 'rifle', 'scatter', 'sniper'] },
    { powers: ['push', 'shockwave', 'push'] },
    { id: '' },
    { name: '' },
    { tags: ['build_blade'] },
  ])('rejects invalid data: %j', (override) => {
    expect(() => loadLoadout({ ...classic, ...override })).toThrow();
  });

  it('accepts boundary slot counts, all known firearms and powers from data', () => {
    expect(loadLoadout(classic)).toEqual(classic);
    expect(
      loadLoadout({
        ...classic,
        weapons: ['beam', 'emp', 'sniper'],
        powers: ['push', 'shockwave'],
      }).weapons,
    ).toEqual(['beam', 'emp', 'sniper']);
  });

  it('rejects repeated loadout ids instead of overwriting data', () => {
    expect(() => loadLoadoutDefinitions([classic, classic])).toThrow(
      'Powtórzone id ekwipunku: classic',
    );
  });
});
