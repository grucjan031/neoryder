import { describe, expect, it } from 'vitest';
import { ResourcePool } from '../../src/core/resource';
import { Stats } from '../../src/core/stats';

describe('ResourcePool — energia', () => {
  const energy = (stats = new Stats({ maxEnergy: 100, energyRegen: 20 })) =>
    new ResourcePool({
      max: () => stats.get('maxEnergy'),
      regenPerS: () => stats.get('energyRegen'),
      regenDelayS: () => 2,
    });

  it('startuje pełna, spend odmawia przy braku i nic nie zmienia', () => {
    const e = energy();
    expect(e.current).toBe(100);
    expect(e.spend(70)).toBe(true);
    expect(e.spend(40)).toBe(false);
    expect(e.current).toBe(30);
    expect(e.spend(-5)).toBe(false);
  });

  it('regeneruje dopiero po opóźnieniu, także w środku kroku', () => {
    const e = energy();
    e.spend(50);
    e.step(1.9);
    expect(e.current).toBe(50);
    e.step(0.2); // 0,1 s po opóźnieniu
    expect(e.current).toBeCloseTo(52);
    e.step(10);
    expect(e.current).toBe(100);
  });

  it('add (parowanie, zabójstwo) nie resetuje opóźnienia i obcina do max', () => {
    const e = energy();
    e.spend(50);
    e.step(2.5);
    const before = e.current;
    e.add(10);
    e.step(0.5);
    expect(e.current).toBeCloseTo(before + 10 + 10);
    e.add(1000);
    expect(e.current).toBe(100);
  });

  it('max ze Stats działa na żywo (modyfikator implantu)', () => {
    const stats = new Stats({ maxEnergy: 100, energyRegen: 20 });
    const e = energy(stats);
    stats.add({
      stat: 'maxEnergy',
      type: 'percent',
      value: 0.5,
      source: 'implant',
    });
    expect(e.max).toBe(150);
    expect(e.fraction).toBeCloseTo(100 / 150);
  });
});

describe('ResourcePool — ciepło', () => {
  it('nagrzewanie add(resetDelay) wstrzymuje chłodzenie, potem stygnie do 0', () => {
    const heat = new ResourcePool({
      max: () => 100,
      regenPerS: () => -40,
      regenDelayS: () => 0.25,
      start: 0,
    });
    heat.add(30, { resetDelay: true });
    heat.step(0.2);
    expect(heat.current).toBe(30);
    heat.step(0.3);
    expect(heat.current).toBeCloseTo(30 - 40 * 0.25);
    heat.step(5);
    expect(heat.current).toBe(0);
  });
});
