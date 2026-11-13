import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '../../src/core/rng';

const sequence = (rng: Rng) => Array.from({ length: 100 }, () => rng.next());
describe('Rng', () => {
  it('ten sam seed daje identyczny ciąg, inny seed daje inny', () => {
    expect(sequence(new Rng('neoryder'))).toEqual(
      sequence(new Rng('neoryder')),
    );
    expect(sequence(new Rng('neoryder'))).not.toEqual(
      sequence(new Rng('other')),
    );
    expect(hashSeed('tekst')).toBe(hashSeed('tekst'));
    expect(hashSeed('tekst')).toBeGreaterThanOrEqual(0);
    expect(hashSeed('tekst')).toBeLessThan(2 ** 32);
  });
  it('mulberry32 zachowuje wektor referencyjny dla seeda 1', () => {
    const rng = new Rng(1);
    expect(rng.next()).toBe(0.6270739405881613);
    expect(rng.next()).toBe(0.002735721180215478);
  });
  it('next/float/int zachowują zakresy, int obejmuje oba końce', () => {
    const rng = new Rng(42);
    const integers = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const next = rng.next();
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(1);
      const value = rng.float(-3, 4);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(4);
      const integer = rng.int(-1, 1);
      expect(Number.isInteger(integer)).toBe(true);
      integers.add(integer);
    }
    expect([...integers].sort()).toEqual([-1, 0, 1]);
    expect(rng.int(2, 2)).toBe(2);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
  it('fork zależy od seeda i etykiety, nie od bieżącego stanu; nie zmienia rodzica', () => {
    const parent = new Rng('run');
    const original = parent.getState();
    const fork = parent.fork('loot');
    expect(parent.getState()).toBe(original);
    parent.next();
    expect(sequence(fork)).toEqual(sequence(parent.fork('loot')));
    expect(sequence(parent.fork('loot'))).not.toEqual(
      sequence(parent.fork('rooms')),
    );
  });
  it('get/setState pozwala wznowić ciąg', () => {
    const rng = new Rng('save');
    rng.next();
    const state = rng.getState();
    const expected = sequence(rng);
    rng.setState(state);
    expect(sequence(rng)).toEqual(expected);
  });
  it('pick odrzuca pustą tablicę, shuffle działa w miejscu i zachowuje elementy', () => {
    const rng = new Rng('pick');
    expect(() => rng.pick([])).toThrow();
    expect(rng.pick(['a'])).toBe('a');
    const values = [1, 2, 3, 4, 5, 6];
    const original = [...values];
    expect(rng.shuffle(values)).toBe(values);
    expect([...values].sort()).toEqual(original);
    expect(values).not.toEqual(original);
  });
});
