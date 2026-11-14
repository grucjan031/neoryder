import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';

describe('modele broni', () => {
  const withModel = [...weaponDefinitions.values()].filter((d) => d.model);

  it('każda broń gracza ma pole model', () => {
    expect(withModel.length).toBe(weaponDefinitions.size);
  });

  it.each(withModel.map((d) => [d.id, d.model] as const))(
    '%s: plik modelu istnieje w public/assets/models',
    (_id, model) => {
      expect(
        existsSync(join('public', 'assets', 'models', `${model}.glb`)),
      ).toBe(true);
    },
  );
});
