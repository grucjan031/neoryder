import { describe, expect, it } from 'vitest';
import { Health } from '../../src/combat/damage/health';

describe('Health.set', () => {
  it('ustawia zdrowie obcięte do przedziału [0, max]', () => {
    let max = 100;
    const h = new Health(() => max);
    h.set(37);
    expect(h.current).toBe(37);
    expect(h.dead).toBe(false);

    h.set(150);
    expect(h.current).toBe(100);

    h.set(-20);
    expect(h.current).toBe(0);
    expect(h.dead).toBe(true);

    // Przywrócenie zdrowia ze stanu RunState nawet z 0 HP
    h.set(45);
    expect(h.current).toBe(45);
    expect(h.dead).toBe(false);

    max = 40;
    expect(h.current).toBe(40);
  });
});
