import { describe, expect, it } from 'vitest';
import { Stats } from '../../src/core/stats';
import {
  implantTriggerSchema,
  loadImplantDefinitions,
  nextRarity,
} from '../../src/progression/implants';

const files = import.meta.glob('../../src/data/implants/*.json', {
  eager: true,
  import: 'default',
});
const families = [
  'nanoBloodstream',
  'thermalFuse',
  'recoilCapacitor',
  'reactiveArmor',
  'parrySpark',
  'emberEdge',
  'resonanceLoop',
  'mirrorCoil',
  'glassCore',
  'overdriveHeart',
];

describe('Z4 — zawartość implantów', () => {
  it('ładuje całą pulę i sprawdza komplet 20 wariantów oraz wszystkie łańcuchy', () => {
    const definitions = loadImplantDefinitions(Object.values(files));
    expect(definitions.size).toBe(Object.keys(files).length);
    for (const id of families) {
      const base = definitions.get(id);
      const upgrade = definitions.get(`${id}Plus`);
      expect(base?.upgradesTo).toBe(`${id}Plus`);
      expect(upgrade?.rarity).toBe(nextRarity(base!.rarity));
      expect(upgrade?.upgradesTo).toBeUndefined();
    }
    for (const def of definitions.values()) {
      const visited = new Set<string>();
      let current = def;
      while (current.upgradesTo) {
        expect(visited.has(current.id)).toBe(false);
        visited.add(current.id);
        const next = definitions.get(current.upgradesTo);
        expect(next).toBeDefined();
        expect(next?.rarity).toBe(nextRarity(current.rarity));
        current = next!;
      }
      for (const trigger of def.triggers ?? []) {
        if (
          trigger.effects.some((e) =>
            ['heal', 'explode', 'apply_status_area'].includes(e.kind),
          )
        )
          expect(trigger.cooldownS).toBeGreaterThan(0);
      }
    }
  });

  it('każdy przeklęty wariant ma rzeczywistą wadę dla gracza i jawny opis', () => {
    const definitions = loadImplantDefinitions(Object.values(files));
    const cursed = [...definitions.values()].filter((def) =>
      def.tags.includes('#cursed'),
    );
    expect(cursed).toHaveLength(4);
    for (const def of cursed) {
      expect(def.description).toMatch(/^Przeklęty:.*ale /);
      const stats = new Stats({
        damage: 1,
        maxHealth: 100,
        moveSpeed: 8,
        energyRegen: 10,
        damageTaken: 1,
      });
      for (const modifier of def.modifiers)
        stats.add({ ...modifier, source: def.id });
      expect(
        stats.get('maxHealth') < 100 || stats.get('damageTaken') > 1,
        def.id,
      ).toBe(true);
      expect(stats.get('damage') > 1 || stats.get('moveSpeed') > 8).toBe(true);
    }
  });

  it('loader odrzuca nieznany status, a wyzwalacze implantów wymagają cooldownS i poprawnego celu', () => {
    const effect = {
      kind: 'apply_status_area',
      at: 'target',
      radiusM: 0,
      status: 'unknown',
      durationS: 2,
    };
    expect(() =>
      loadImplantDefinitions([
        {
          id: 'invalid',
          name: 'Błędny',
          rarity: 'rare',
          tags: ['#melee'],
          modifiers: [],
          triggers: [
            {
              when: { event: 'damage_dealt' },
              effects: [effect],
              cooldownS: 1,
            },
          ],
        },
      ]),
    ).toThrow(/Nieznany status/);
    for (const valid of [
      { ...effect, status: 'burning' },
      { kind: 'heal', amount: 1 },
      { kind: 'explode', at: 'user', radiusM: 1, damage: 0, tags: [] },
    ]) {
      expect(() =>
        implantTriggerSchema.parse({
          when: { event: 'damage_dealt' },
          effects: [valid],
        }),
      ).toThrow(/cooldownS/);
    }
    expect(() =>
      implantTriggerSchema.parse({
        when: { event: 'dash_used' },
        effects: [{ ...effect, status: 'burning' }],
        cooldownS: 1,
      }),
    ).toThrow(/target/);
  });
});
