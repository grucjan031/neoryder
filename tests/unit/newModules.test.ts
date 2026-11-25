import { Mesh } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import { fireProjectile } from '../../src/combat/weapons/fireModes/projectile';
import type { ProjectileSpec } from '../../src/combat/weapons/projectiles';
import { Rng } from '../../src/core/rng';
import { moddedWeapon } from '../../src/progression/moddedWeapon';
import {
  moduleDefinitions,
  moduleFitsWeapon,
  MODULE_SHAPES_BY_SLOT,
} from '../../src/progression/moduleSchema';
import { unlockDefinitions } from '../../src/progression/unlocksSchema';
import { createModuleVisual } from '../../src/render/weaponModuleVisuals';

const ballistic = ['projectile', 'spread', 'pierce'];
const withLob = [...ballistic, 'lob'];
const cases = [
  ['suppressor', 'muzzle', 'suppressor', ballistic, { data: 150 }, 2],
  ['choke', 'muzzle', 'choke', ['spread'], { data: 140 }, 2],
  ['drumCell', 'cell', 'drum', withLob, { data: 210 }, 4],
  ['overloadCell', 'cell', 'overload', ballistic, { cores: 3 }, 4, 'rezonator'],
  ['stunCell', 'cell', 'stun', ['pierce', 'lob'], { cores: 4 }, 5, 'egzekutor'],
  ['radiator', 'cell', 'radiator', withLob, { data: 170 }, 3],
  ['stabilizer', 'grip', 'angled', ballistic, { data: 180 }, 3],
  [
    'prism',
    'optic',
    'prism',
    ['projectile', 'pierce', 'beam'],
    { data: 200 },
    4,
  ],
] as const;

describe('nowe moduły warsztatu', () => {
  for (const [id, slot, shape, kinds, cost, minLevel, badge] of cases) {
    it(`${id} ma właściwy slot, montaż, zgodność i odblokowanie`, () => {
      const mod = moduleDefinitions.get(id)!;
      expect(mod.slot).toBe(slot);
      expect(mod.visual.shape).toBe(shape);
      expect(MODULE_SHAPES_BY_SLOT[slot]).toContain(shape);
      const unlock = unlockDefinitions.get(`module:${id}`)!;
      expect(unlock.cost).toEqual(cost);
      expect(unlock.minLevel).toBe(minLevel);
      expect(unlock.requiresAchievement).toBe(badge);
      for (const weapon of weaponDefinitions.values()) {
        expect(moduleFitsWeapon(mod, weapon.id), weapon.id).toBe(
          (kinds as readonly string[]).includes(weapon.fireMode),
        );
      }
      const visual = createModuleVisual(mod.visual);
      expect(
        visual.children.some(
          (node) =>
            node instanceof Mesh &&
            node.geometry.getAttribute('position').count > 0,
        ),
      ).toBe(true);
    });
  }

  it('łączy ogniwo bębnowe i tłumik w karabinie', () => {
    const weapon = moddedWeapon('rifle', ['drumCell', 'suppressor']);
    expect(weapon).toMatchObject({
      recoilScale: 0.8,
      heatPerShot: 9,
      projectileSpeed: 67.5,
      heatCapacityScale: 1.6,
    });
    if (weapon?.fireMode !== 'projectile')
      throw new Error('Test wymaga karabinu');
    expect(weapon.spreadDeg).toBeCloseTo(0.935);
    expect(weapon.fireRateHz).toBeCloseTo(9.2);
  });

  it.each([
    ['rifle', 'overloadCell', 'overload', 4],
    ['sniper', 'stunCell', 'stunned', 0.4],
    ['emp', 'stunCell', 'stunned', 0.4],
  ] as const)(
    '%s przenosi status ogniwa na pocisk lub wybuch',
    (weaponId, moduleId, id, durationS) => {
      const weapon = moddedWeapon(weaponId, [moduleId]);
      if (!weapon || weapon.fireMode === 'beam')
        throw new Error('Test wymaga pocisków');
      const spawn = vi.fn<(spec: ProjectileSpec) => number>(() => 1);
      fireProjectile(weapon, { spawn }, new Rng('status'), {
        owner: 1,
        team: 'player',
        origin: { x: 0, y: 0, z: 0 },
        dir: { x: 0, y: 0, z: -1 },
      });
      const spec = spawn.mock.calls[0]![0];
      expect(
        weaponId === 'emp' ? spec.explode?.statuses : spec.statuses,
      ).toEqual([
        ...(weaponDefinitions.get(weaponId)!.statuses ?? []),
        { id, durationS },
      ]);
    },
  );

  it('radiator zmienia obrażenia kontaktowe EMP, zachowując siłę wybuchu', () => {
    expect(moddedWeapon('emp', ['radiator'])).toMatchObject({
      damage: 1.84,
      heatPerShot: 48,
      explosionDamage: 8,
    });
  });
});
