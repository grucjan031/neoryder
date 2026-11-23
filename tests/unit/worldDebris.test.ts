import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';
import { DEBRIS_TINT, DebrisSystem } from '../../src/vfx/debris';
import { DebrisRenderer } from '../../src/vfx/debrisRenderer';
import { WorldDebris } from '../../src/vfx/worldDebris';

function tints(system: DebrisSystem): number[] {
  const result: number[] = [];
  system.forEachActive((_p, _q, _s, _a, _age, tint) => result.push(tint));
  return result;
}

describe('paleta odłamków otoczenia', () => {
  it('tint 0/1 zostają w warstwie walki, 2-5 trafiają do warstwy otoczenia z własnym kolorem', () => {
    const system = new DebrisSystem({ maxDebris: 40 });
    const renderer = new DebrisRenderer(system);
    const base = {
      origin: { x: 0, y: 1, z: 0 },
      dir: null,
      strength: 1,
      size: 0.1,
    };
    system.burst({ ...base, count: 2, tint: 0 });
    system.burst({ ...base, count: 1, tint: 1 });
    system.burst({ ...base, count: 1, tint: DEBRIS_TINT.concrete });
    system.burst({ ...base, count: 1, tint: DEBRIS_TINT.glass });
    renderer.render(1);
    const env = renderer.root.getObjectByName('debris-env') as unknown as {
      count: number;
      getColorAt(i: number, c: Color): void;
    };
    expect(renderer.root.count).toBe(3);
    expect(env.count).toBe(2);
    const a = new Color();
    const b = new Color();
    env.getColorAt(0, a);
    env.getColorAt(1, b);
    expect(a.getHex()).not.toBe(b.getHex());
    // Otoczenie nie używa czerwieni wroga ani magenty Rezonansu jako barwy bryły.
    for (const c of [a, b]) expect(c.r > 0.8 && c.g < 0.3).toBe(false);
    renderer.dispose();
  });

  it('lifetimeS skraca życie okruchów', () => {
    const system = new DebrisSystem({ maxDebris: 8 });
    system.burst({
      origin: { x: 0, y: 1, z: 0 },
      dir: null,
      strength: 1,
      size: 0.1,
      count: 4,
      lifetimeS: 0.5,
    });
    for (let i = 0; i < 40; i++) system.step(1 / 60);
    expect(system.activeCount).toBe(0);
  });
});

describe('odbicie od ściany z normalną', () => {
  const run = (normal: Vec3 | undefined) => {
    let hits = 0;
    const system = new DebrisSystem({
      maxDebris: 1,
      walls: (pos, dir, dist) => {
        if (dir.x <= 0 || hits > 0) return null;
        const d = (2 - pos.x) / dir.x;
        if (d < 0 || d > dist) return null;
        hits++;
        return normal ? { distance: d, normal } : d;
      },
    });
    system.burst({
      origin: { x: 1.9, y: 5, z: 0 },
      dir: { x: 1, y: 0, z: 1 },
      strength: 10,
      spread: 0,
      size: 0.1,
      count: 1,
    });
    const velocityAfter: Vec3 = { x: 0, y: 0, z: 0 };
    system.step(1 / 60);
    // Odczyt prędkości przez przemieszczenie w kolejnym kroku.
    const before = positions(system);
    system.step(1 / 60);
    const after = positions(system);
    velocityAfter.x = (after.x - before.x) * 60;
    velocityAfter.z = (after.z - before.z) * 60;
    return velocityAfter;
  };
  function positions(system: DebrisSystem): Vec3 {
    let p: Vec3 = { x: 0, y: 0, z: 0 };
    system.forEachActive((pos) => (p = { ...pos }));
    return p;
  }

  it('z normalną zachowuje składową styczną (z tarciem) i odwraca normalną', () => {
    const v = run({ x: -1, y: 0, z: 0 });
    expect(v.x).toBeLessThan(0);
    expect(v.z).toBeGreaterThan(0);
    // styczna ~ 10/sqrt2 * tarcie 0.8, a nie 0.3 jak przy odbiciu wzdłuż promienia
    expect(v.z).toBeGreaterThan(5);
  });

  it('bez normalnej odwraca cały wektor (zachowanie wsteczne)', () => {
    const v = run(undefined);
    expect(v.x).toBeLessThan(0);
    expect(v.z).toBeLessThan(3);
  });
});

describe('WorldDebris', () => {
  const setup = () => {
    const bus = new EventBus();
    const system = new DebrisSystem({ maxDebris: 200 });
    const world = new WorldDebris(bus, system, { tuning });
    return { bus, system, world };
  };

  it('wybuch beczki wyrzuca metalowe odłamki, inne wybuchy nie', () => {
    const { bus, system } = setup();
    bus.emit('explosion', {
      point: { x: 0, y: 1, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: ['#synergy'],
    });
    expect(system.activeCount).toBe(0);
    bus.emit('explosion', {
      point: { x: 0, y: 1, z: 0 },
      radiusM: 3,
      owner: 1,
      tags: ['#hazard', '#explosion'],
    });
    expect(system.activeCount).toBe(tuning.vfx.barrelDebrisCount);
    expect(new Set(tints(system))).toEqual(new Set([DEBRIS_TINT.metal]));
  });

  it('trafienie w świat sypie okruchami betonu, po dispose nic', () => {
    const { bus, system, world } = setup();
    bus.emit('world_hit', {
      point: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      owner: 1,
      tags: [],
    });
    expect(system.activeCount).toBe(tuning.vfx.worldChipCount);
    expect(new Set(tints(system))).toEqual(new Set([DEBRIS_TINT.concrete]));
    world.dispose();
    bus.emit('world_hit', {
      point: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      owner: 1,
      tags: [],
    });
    expect(system.activeCount).toBe(tuning.vfx.worldChipCount);
  });
});

describe('odłamek zaczynający wewnątrz bryły', () => {
  it('zerowa normalna nie zawiesza odłamka w powietrzu', () => {
    const system = new DebrisSystem({
      maxDebris: 1,
      walls: () => ({ distance: 0, normal: { x: 0, y: 0, z: 0 } }),
    });
    system.burst({
      origin: { x: 0, y: 5, z: 0 },
      dir: { x: 1, y: 0, z: 0 },
      strength: 6,
      spread: 0,
      size: 0.1,
      count: 1,
    });
    for (let i = 0; i < 10; i++) system.step(1 / 60);
    let x = 0;
    system.forEachActive((p) => (x = p.x));
    expect(x).toBeGreaterThan(0.5);
  });
});
