import { describe, expect, it } from 'vitest';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import { achievementDefinitions } from '../../src/progression/achievementsSchema';
import {
  skinDefinitions,
  skinFitsWeapon,
} from '../../src/progression/skinSchema';
import { unlockDefinitions } from '../../src/progression/unlocksSchema';

describe('nowe bronie w katalogu i progresji', () => {
  it.each([
    { id: 'revolver', model: 'revolver', cost: { data: 160 }, minLevel: 3 },
    { id: 'smg', model: 'smg', cost: { data: 130 }, minLevel: 2 },
    { id: 'crossbow', model: 'mag_crossbow', cost: { cores: 5 }, minLevel: 5 },
  ])(
    '$id ma model, odblokowanie i własny skin za mistrzostwo',
    ({ id, model, cost, minLevel }) => {
      expect(weaponDefinitions.get(id)?.model).toBe(model);
      const unlock = unlockDefinitions.get('weapon:' + id);
      expect(unlock?.cost).toEqual(cost);
      expect(unlock?.minLevel).toBe(minLevel);
      expect(unlock?.requiresAchievement).toBe(
        id === 'crossbow' ? 'droga-strzelca' : undefined,
      );
      const mastery = 'mistrz-' + id;
      expect(achievementDefinitions.get(mastery)).toMatchObject({
        kind: 'counter',
        counter: 'kills_' + id,
        target: 150,
        reward: { cores: 1, unlocks: ['skin:' + mastery] },
      });
      const skin = skinDefinitions.get(mastery)!;
      expect(skin.weapons).toEqual([id]);
      expect(skinFitsWeapon(skin, id)).toBe(true);
    },
  );
});
