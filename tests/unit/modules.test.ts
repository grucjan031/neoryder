import { describe, expect, it, vi } from 'vitest';
import {
  weaponDefinitions,
  weaponSchema,
} from '../../src/combat/weapons/weaponSchema';
import { fireProjectile } from '../../src/combat/weapons/fireModes/projectile';
import type { ProjectileSpec } from '../../src/combat/weapons/projectiles';
import { Rng } from '../../src/core/rng';
import { loadLoadout } from '../../src/progression/loadout';
import {
  loadModuleDefinitions,
  moduleDefinitions,
  moduleFitsWeapon,
  modulePatches,
  moduleSchema,
} from '../../src/progression/moduleSchema';
import { resolveLoadout } from '../../src/progression/patches';
import { loadDefinitionPatch } from '../../src/progression/patchSchema';
import { unlockIdSchema } from '../../src/progression/unlocksSchema';

const loadout = (weaponId: string, ids: string[]) =>
  loadLoadout({
    id: 'custom',
    name: 'Test',
    blade: 'plasmaBlade',
    weapons: [weaponId],
    powers: ['push'],
    tags: [],
    modules: { [weaponId]: ids },
  });

describe('moduły broni', () => {
  it('ładuje sześć modułów, waliduje prefiks odblokowań, operacje i brak target', () => {
    expect([...moduleDefinitions.keys()].sort()).toEqual([
      'collimator',
      'incendiary',
      'pierce',
      'ricochet',
      'scope',
      'superconductor',
    ]);
    const sample = moduleDefinitions.get('incendiary')!;
    expect(() => loadModuleDefinitions([sample, sample])).toThrow('Powtórzone');
    expect(
      moduleSchema.safeParse({
        ...sample,
        patches: [{ ...sample.patches[0], target: 'weapon:pistol' }],
      }).success,
    ).toBe(false);
    expect(() =>
      loadDefinitionPatch({
        target: 'weapon:pistol',
        op: 'append',
        path: 'statuses',
        value: [],
      }),
    ).not.toThrow();
    expect(() =>
      loadDefinitionPatch({
        target: 'weapon:pistol',
        op: 'append',
        path: 'statuses',
        value: 1,
      }),
    ).toThrow();
    expect(unlockIdSchema.safeParse('module:ricochet').success).toBe(true);
    expect(unlockIdSchema.safeParse('module:unknown').success).toBe(false);
  });

  it('każdy moduł przechodzi schemat każdej zgodnej broni, bez mutacji globalnych definicji', () => {
    for (const [weaponId, definition] of weaponDefinitions) {
      const snapshot = structuredClone(definition);
      for (const module of moduleDefinitions.values()) {
        if (!moduleFitsWeapon(module, weaponId)) continue;
        const choice = loadout(weaponId, [module.id]);
        const result = resolveLoadout(choice, modulePatches(choice))
          .weapons[0]!;
        expect(result).not.toBe(definition);
        expect(weaponSchema.safeParse(result).success).toBe(true);
        expect(definition).toEqual(snapshot);
      }
    }
  });

  it('Przebicie dodaje cel pistoletowi i zachowuje przebicie snajperki oraz spadek obrażeń', () => {
    for (const id of ['pistol', 'sniper']) {
      const choice = loadout(id, ['pierce', 'ricochet']);
      const result = resolveLoadout(choice, modulePatches(choice)).weapons[0]!;
      const base = weaponDefinitions.get(id)!;
      if (result.fireMode === 'beam' || base.fireMode === 'beam')
        throw new Error('Test wymaga pocisków');
      expect(result.pierceCount).toBe(base.pierceCount + 1);
      expect(result.pierceFalloff).toBe(base.pierceFalloff);
      const spawn = vi.fn<(spec: ProjectileSpec) => number>(() => 1);
      fireProjectile(result, { spawn }, new Rng('module'), {
        owner: 1,
        team: 'player',
        origin: { x: 0, y: 0, z: 0 },
        dir: { x: 0, y: 0, z: -1 },
      });
      expect(spawn.mock.calls[0]![0]).toMatchObject({
        ricochets: 1,
        pierce: { count: base.pierceCount + 1, falloff: base.pierceFalloff },
      });
    }
  });

  it('Nadprzewodnik stosuje wariant prędkości i ciepła', () => {
    const choice = loadout('pistol', ['superconductor']);
    const result = resolveLoadout(choice, modulePatches(choice)).weapons[0]!;
    const base = weaponDefinitions.get('pistol')!;
    if (result.fireMode === 'beam' || base.fireMode === 'beam')
      throw new Error('Test wymaga pocisków');
    expect(result.projectileSpeed).toBe(base.projectileSpeed * 1.2);
    expect(result.heatPerShot).toBe(base.heatPerShot * 0.85);
  });

  it('łatki mają cel wybranej broni, respektują kolejność slotów i nie mutują modułu', () => {
    const choice = loadout('pistol', ['ricochet', 'pierce']);
    const original = structuredClone(moduleDefinitions.get('ricochet'));
    const patches = modulePatches(choice);
    expect(patches.map(({ target, path }) => [target, path])).toEqual([
      ['weapon:pistol', 'ricochets'],
      ['weapon:pistol', 'pierceCount'],
    ]);
    patches[0]!.value = 99;
    expect(moduleDefinitions.get('ricochet')).toEqual(original);
    expect(() =>
      modulePatches({ weapons: ['pistol'], modules: { pistol: ['unknown'] } }),
    ).toThrow('Nieznany moduł');
    expect(() =>
      modulePatches({ weapons: ['beam'], modules: { beam: ['ricochet'] } }),
    ).toThrow('nie pasuje');
  });
});
