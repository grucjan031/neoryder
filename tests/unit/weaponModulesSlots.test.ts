import { describe, expect, it } from 'vitest';
import {
  moduleDefinitions,
  modulePatches,
  moduleSchema,
} from '../../src/progression/moduleSchema';
import { MetaManager, defaultMetaRules } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { simulateTypicalRuns } from '../../src/balance/metaSim';
import {
  weaponDefinitions,
  weaponSchema,
} from '../../src/combat/weapons/weaponSchema';
import { resolveLoadout } from '../../src/progression/patches';
import { loadLoadout } from '../../src/progression/loadout';

describe('sloty modułów S4c', () => {
  it('wymaga slotu i zgodnego kształtu', () => {
    for (const module of moduleDefinitions.values()) {
      expect(moduleSchema.safeParse(module).success).toBe(true);
      expect(
        moduleSchema.safeParse({ ...module, slot: undefined }).success,
      ).toBe(false);
      expect(
        moduleSchema.safeParse({ ...module, visual: undefined }).success,
      ).toBe(false);
      for (const slot of ['muzzle', 'cell', 'optic'])
        expect(moduleSchema.safeParse({ ...module, slot }).success).toBe(
          slot === module.slot,
        );
    }
  });

  it('odrzuca konflikt slotów atomowo, dopuszcza trzy różne sloty', () => {
    const meta = new MetaManager(createStarterMetaState());
    meta.debugUnlockAll();
    const base = meta.state.loadout;
    for (const ids of [
      ['pierce', 'ricochet'],
      ['incendiary', 'superconductor'],
      ['scope', 'collimator'],
    ]) {
      expect(() =>
        meta.setLoadout({ ...base, modules: { blaster: ids } }),
      ).toThrow('Slot');
      expect(meta.state.loadout).toEqual(base);
    }
    meta.setLoadout({
      ...base,
      modules: { blaster: ['scope', 'incendiary', 'pierce'] },
    });
    expect(meta.state.loadout.modules.blaster).toHaveLength(3);
  });

  it('zachowuje stary zapis meta, a do gry zwraca pierwszy moduł każdego slotu', () => {
    const old = createStarterMetaState();
    old.loadout.modules = {
      blaster: ['pierce', 'ricochet', 'incendiary', 'superconductor'],
    };
    const snapshot = structuredClone(old);
    const restored = MetaManager.restore(old);
    expect(restored.state).toEqual(old);
    expect(restored.loadout().modules).toEqual({
      blaster: ['pierce', 'incendiary'],
    });
    expect(restored.serialize()).toEqual(old);
    expect(old).toEqual(snapshot);
  });

  it('sortuje łatki Wylot → Ogniwo → Optyka niezależnie od tablicy', () => {
    const patches = (ids: string[]) =>
      modulePatches({ weapons: ['blaster'], modules: { blaster: ids } });
    const canonical = patches(['pierce', 'incendiary', 'scope']);
    expect(patches(['scope', 'pierce', 'incendiary'])).toEqual(canonical);
    expect(patches(['incendiary', 'scope', 'pierce'])).toEqual(canonical);
    expect(canonical.map((p) => p.path)).toEqual([
      'pierceCount',
      'statuses',
      'aimFovScale',
      'aimInScale',
      'aimSensitivityScale',
    ]);
  });

  it('skale są opcjonalne, dodatnie i skończone, optyka modyfikuje kopię definicji', () => {
    const base = weaponDefinitions.get('blaster')!;
    for (const field of [
      'aimInScale',
      'aimSpreadScale',
      'aimSensitivityScale',
    ] as const) {
      expect(base[field]).toBeUndefined();
      for (const value of [0, -1, Infinity, NaN])
        expect(
          weaponSchema.safeParse({ ...base, [field]: value }).success,
        ).toBe(false);
      expect(weaponSchema.safeParse({ ...base, [field]: 0.6 }).success).toBe(
        true,
      );
    }
    for (const id of ['collimator', 'scope']) {
      const choice = loadLoadout({
        id: 'test',
        name: 'Test',
        blade: 'plasmaBlade',
        weapons: ['blaster'],
        powers: ['push'],
        tags: [],
        modules: { blaster: [id] },
      });
      const weapon = resolveLoadout(choice, modulePatches(choice)).weapons[0]!;
      for (const patch of moduleDefinitions.get(id)!.patches)
        expect(weapon).toHaveProperty(patch.path, patch.value);
    }
  });

  it('symulacja F4 pozostaje identyczna po dodaniu optyki', () => {
    const before = simulateTypicalRuns({
      ...defaultMetaRules,
      unlocks: new Map(
        [...defaultMetaRules.unlocks].filter(
          ([id]) => !['module:collimator', 'module:scope'].includes(id),
        ),
      ),
    });
    const after = simulateTypicalRuns();
    expect(after).toEqual(before);
    expect(after.finalLevel).toBe(7);
    expect(after.purchases).toBe(4);
  });
});
