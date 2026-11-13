import { describe, expect, it } from 'vitest';
import { Stats, computeStat } from '../../src/core/stats';
import type { StatModifier } from '../../src/core/stats';

const mod = (
  type: StatModifier['type'],
  value: number,
  source = 'test',
): StatModifier => ({ stat: 'damage', type, value, source });
describe('Stats', () => {
  it('liczy (base + suma flat) × (1 + suma percent) × iloczyn mult', () => {
    const mods = [
      mod('flat', 10),
      mod('flat', 5),
      mod('percent', 0.2),
      mod('percent', 0.3),
      mod('mult', 2),
      mod('mult', 1.5),
    ];
    expect(computeStat(100, mods)).toBe(517.5);
    expect(computeStat(100, [...mods].reverse())).toBe(517.5);
    expect(computeStat(10, [mod('flat', -30)])).toBe(0);
    expect(computeStat(10, [mod('percent', -2)])).toBe(0);
  });
  it('cache reaguje na zmianę bazy, dodanie i usunięcie źródła', () => {
    const stats = new Stats({ damage: 10 });
    expect(stats.get('damage')).toBe(10);
    stats.setBase('damage', 20);
    expect(stats.get('damage')).toBe(20);
    stats.add(mod('flat', 5, 'implant'));
    stats.add({ stat: 'moveSpeed', type: 'mult', value: 2, source: 'implant' });
    stats.add(mod('mult', 3, 'tree'));
    expect(stats.get('damage')).toBe(75);
    expect(stats.removeBySource('implant')).toBe(2);
    expect(stats.get('damage')).toBe(60);
    expect(stats.removeBySource('missing')).toBe(0);
    expect(stats.modifiers('damage')).toHaveLength(1);
  });
  it('brak bazy to zero, modyfikatory i baza są kopiowane', () => {
    const base = { damage: 10 };
    const stats = new Stats(base);
    base.damage = 99;
    expect(stats.getBase('damage')).toBe(10);
    expect(stats.getBase('maxHealth')).toBe(0);
    expect(stats.get('maxHealth')).toBe(0);
    const modifier = mod('flat', 5);
    stats.add(modifier);
    modifier.value = 100;
    expect(stats.get('damage')).toBe(15);
    expect(Object.isFrozen(stats.modifiers()[0])).toBe(true);
  });
});
