import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import { tuning } from '../../src/core/tuning';
import { DebrisSystem } from '../../src/vfx/debris';
import type { DebrisBurst } from '../../src/vfx/debris';
import { DebrisRenderer } from '../../src/vfx/debrisRenderer';
import { EnemyShatter } from '../../src/vfx/enemyShatter';
import { Matrix4 } from 'three';
import type { BufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import { getMaterial } from '../../src/render/materials';

const spec: DebrisBurst = {
  origin: { x: 0, y: 2, z: 0 },
  dir: { x: 1, y: 0, z: 0 },
  count: 30,
  strength: 6,
  size: 0.18,
};
function positions(system: DebrisSystem): Vec3[] {
  const result: Vec3[] = [];
  system.forEachActive((pos) => result.push({ ...pos }));
  return result;
}
function snapshot(system: DebrisSystem): unknown[] {
  const result: unknown[] = [];
  system.forEachActive((pos, quat, scale, alpha) =>
    result.push({
      pos: { ...pos },
      quat: { ...quat },
      scale: { ...scale },
      alpha,
    }),
  );
  return result;
}

describe('DebrisSystem', () => {
  it('creates exactly count fragments and recycles the oldest slot', () => {
    const system = new DebrisSystem({ maxDebris: 3 });
    for (const x of [10, 20, 30])
      system.burst({ ...spec, origin: { x, y: 2, z: 0 }, count: 1 });
    expect(system.activeCount).toBe(3);
    system.burst({ ...spec, origin: { x: 40, y: 2, z: 0 }, count: 1 });
    expect(
      positions(system)
        .map((p) => p.x)
        .sort(),
    ).toEqual([20, 30, 40]);
    system.burst({ ...spec, origin: { x: 50, y: 2, z: 0 }, count: 1 });
    expect(
      positions(system)
        .map((p) => p.x)
        .sort(),
    ).toEqual([30, 40, 50]);
    system.burst({ ...spec, count: 100 });
    expect(system.activeCount).toBe(3);
    system.clear();
    expect(positions(system)).toEqual([]);
    system.burst({ ...spec, count: 2 });
    expect(system.activeCount).toBe(2);
  });

  it('launches along the normalized hit direction with symmetric horizontal spread', () => {
    const system = new DebrisSystem({ maxDebris: 600, seed: 42 });
    system.burst({ ...spec, count: 600, dir: { x: 10, y: 0, z: 0 } });
    const dt = 1 / 60;
    system.step(dt);
    const mean = positions(system).reduce(
      (v, p) => ({ x: v.x + p.x / 600 / dt, y: 0, z: v.z + p.z / 600 / dt }),
      { x: 0, y: 0, z: 0 },
    );
    expect(mean.x).toBeGreaterThan(5);
    expect(Math.abs(mean.z)).toBeLessThan(0.5);
  });

  it('applies gravity, bounces and never goes below the configured floor', () => {
    const system = new DebrisSystem({ maxDebris: 1, floorY: -2 });
    system.burst({
      ...spec,
      origin: { x: 0, y: -1, z: 0 },
      count: 1,
      dir: null,
      strength: 0,
      spread: 0,
    });
    const heights = [positions(system)[0]!.y];
    for (let i = 0; i < 70; i++) {
      system.step(1 / 60);
      heights.push(positions(system)[0]!.y);
    }
    expect(heights[1]).toBeLessThan(heights[0]!);
    expect(heights.every((y) => y >= -2 - 1e-9)).toBe(true);
    const floorIndex = heights.indexOf(-2);
    expect(floorIndex).toBeGreaterThan(0);
    expect(heights[floorIndex + 1]).toBeGreaterThan(-2);
    expect(heights.at(-1)).toBe(-2);
  });

  it('clips ray travel at walls and reverses velocity without crossing them', () => {
    const walls = vi.fn((pos: Vec3, dir: Vec3, dist: number) => {
      if (dir.x <= 0) return null;
      const hit = (1 - pos.x) / dir.x;
      return hit <= dist ? hit : null;
    });
    const system = new DebrisSystem({ maxDebris: 1, walls });
    system.burst({ ...spec, count: 1, spread: 0 });
    let maximum = 0;
    for (let i = 0; i < 30; i++) {
      system.step(1 / 60);
      maximum = Math.max(maximum, positions(system)[0]!.x);
    }
    expect(walls).toHaveBeenCalled();
    expect(maximum).toBeLessThanOrEqual(1);
    expect(positions(system)[0]!.x).toBeLessThan(maximum);
  });

  it('shrinks in the final 0.4 seconds and expires every fragment', () => {
    const settings = { ...tuning.vfx, debrisLifetimeS: 1 };
    const system = new DebrisSystem({ maxDebris: 30, tuning: settings });
    system.burst(spec);
    const initial: number[] = [];
    system.forEachActive((_p, _q, scale) => initial.push(scale.x));
    system.step(0.79);
    const shrinking: number[] = [];
    system.forEachActive((_p, _q, scale, alpha) => {
      shrinking.push(scale.x);
      expect(alpha).toBe(1);
    });
    expect(shrinking.every((size, i) => size <= initial[i]!)).toBe(true);
    expect(shrinking.some((size, i) => size < initial[i]!)).toBe(true);
    system.step(0.42);
    expect(system.activeCount).toBe(0);
  });

  it('is deterministic for the same seed and differs for a different seed', () => {
    const systems = [42, 42, 43].map(
      (seed) => new DebrisSystem({ maxDebris: 30, seed }),
    );
    for (const system of systems) {
      system.burst({ ...spec, bounds: { halfX: 0.3, halfY: 0.5, halfZ: 0.2 } });
      for (let i = 0; i < 25; i++) system.step(1 / 60);
    }
    expect(snapshot(systems[0]!)).toEqual(snapshot(systems[1]!));
    expect(snapshot(systems[0]!)).not.toEqual(snapshot(systems[2]!));
  });

  it('interpolates position and normalized rotation; dt zero preserves state', () => {
    const system = new DebrisSystem({ maxDebris: 1 });
    system.burst({ ...spec, count: 1, spread: 0 });
    system.step(1 / 60);
    const current = snapshot(system);
    system.step(0);
    expect(snapshot(system)).toEqual(current);
    system.forEachActive((pos, quat) => {
      expect(pos.x).toBeCloseTo(0.05);
      expect(Math.hypot(quat.x, quat.y, quat.z, quat.w)).toBeCloseTo(1);
    }, 0.5);
  });

  it('keeps 20 × 30 fragments within 600 slots and steps 1000 frames under 200 ms', () => {
    const system = new DebrisSystem({ maxDebris: 600 });
    for (let i = 0; i < 20; i++) system.burst(spec);
    expect(system.activeCount).toBe(600);
    const start = performance.now();
    for (let i = 0; i < 1000; i++) system.step(1 / 60);
    const elapsed = performance.now() - start;
    console.info(
      `DebrisSystem: 600 fragments, 1000 steps: ${elapsed.toFixed(1)} ms`,
    );
    expect(elapsed).toBeLessThan(200);
    expect(system.activeCount).toBe(0);
  });
});

describe('DebrisRenderer', () => {
  it('renders interpolated transforms, updates instance count and preserves shared material', () => {
    const system = new DebrisSystem({ maxDebris: 30 });
    const renderer = new DebrisRenderer(system);
    const disposeMaterial = vi.spyOn(getMaterial('enemy'), 'dispose');
    system.burst({ ...spec, count: 1, spread: 0 });
    system.step(1 / 60);
    renderer.render(0.5);
    expect(renderer.root.count).toBe(1);
    expect(renderer.root.frustumCulled).toBe(false);
    const matrix = new Matrix4();
    renderer.root.getMatrixAt(0, matrix);
    expect(matrix.elements[12]).toBeCloseTo(0.05);
    system.clear();
    renderer.render();
    expect(renderer.root.count).toBe(0);
    renderer.dispose();
    expect(disposeMaterial).not.toHaveBeenCalled();
    disposeMaterial.mockRestore();
  });
});

describe('EnemyShatter', () => {
  const damage: GameEvents['damage_dealt'] = {
    source: null,
    target: 1,
    amount: 20,
    tags: [],
    point: { x: 0, y: 1, z: 0 },
    dir: { x: 1, y: 0, z: 0 },
    knockback: 3,
    killed: true,
  };
  function setup() {
    const bus = new EventBus();
    const debris = new DebrisSystem({ maxDebris: 600 });
    const burst = vi.spyOn(debris, 'burst');
    const shatter = new EnemyShatter(bus, debris, {
      tuning,
      positionOf: (id) => (id === 999 ? null : { x: 2, y: 0, z: 4 }),
    });
    return { bus, debris, burst, shatter };
  }

  it('scales total count within min/max, splits torso/head and includes damage/knockback in strength', () => {
    const { bus, burst, shatter } = setup();
    const totals: number[] = [];
    const strengths: number[] = [];
    for (const [index, amount] of [0, 20, 1000].entries()) {
      burst.mockClear();
      bus.emit('damage_dealt', { ...damage, target: index + 1, amount });
      expect(burst).toHaveBeenCalledTimes(2);
      const specs = burst.mock.calls.map(([value]) => value);
      totals.push(specs.reduce((sum, value) => sum + value.count, 0));
      strengths.push(specs[0]!.strength);
      expect(specs[1]!.origin.y).toBeGreaterThan(specs[0]!.origin.y);
      expect(specs[0]!.dir).toEqual(damage.dir);
    }
    expect(totals).toEqual([tuning.vfx.debrisMin, 17, tuning.vfx.debrisMax]);
    expect(strengths[1]).toBeGreaterThan(strengths[0]!);
    expect(strengths[0]).toBe(tuning.vfx.debrisStrength + damage.knockback);
    shatter.dispose();
  });

  it('ignores surviving hits and targets that are not enemies', () => {
    const { bus, debris, shatter } = setup();
    bus.emit('damage_dealt', { ...damage, killed: false });
    bus.emit('damage_dealt', { ...damage, target: 999 });
    expect(debris.activeCount).toBe(0);
    shatter.dispose();
  });

  it('deduplicates kill events, uses a directionless fallback and supports reused IDs', () => {
    const { bus, debris, burst, shatter } = setup();
    bus.emit('damage_dealt', damage);
    const count = debris.activeCount;
    bus.emit('enemy_killed', { id: 1, killer: null, tags: [] });
    expect(debris.activeCount).toBe(count);
    bus.emit('enemy_killed', { id: 2, killer: null, tags: [] });
    expect(debris.activeCount).toBe(count + tuning.vfx.debrisMin);
    expect(burst.mock.lastCall?.[0].dir).toBeNull();
    bus.emit('entity_spawned', { id: 1, kind: 'enemy' });
    bus.emit('damage_dealt', damage);
    expect(debris.activeCount).toBe(count * 2 + tuning.vfx.debrisMin);
    shatter.dispose();
    const before = debris.activeCount;
    bus.emit('enemy_killed', { id: 3, killer: null, tags: [] });
    expect(debris.activeCount).toBe(before);
  });

  it('fits 20 maximum shatters including head bursts into the pool', () => {
    const { bus, debris, shatter } = setup();
    for (let id = 1; id <= 20; id++) {
      bus.emit('damage_dealt', { ...damage, target: id, amount: 100 });
      bus.emit('enemy_killed', { id, killer: null, tags: [] });
    }
    expect(debris.activeCount).toBe(600);
    shatter.dispose();
  });
});

describe('ustawienie Błyski ekranu', () => {
  it('flashes=false: zabicie bez rdzenia, przygaszony pierścień', () => {
    const bus = new EventBus();
    const debris = new DebrisSystem({ maxDebris: 60 });
    const shatter = new EnemyShatter(bus, debris, {
      tuning,
      positionOf: () => ({ x: 0, y: 0, z: 0 }),
      settings: { flashes: false },
    });
    const renderer = new DebrisRenderer(debris);
    bus.emit('enemy_killed', { id: 5, killer: null, tags: [] });
    let muted = false;
    debris.forEachFlash((f) => (muted = f.muted));
    expect(muted).toBe(true);
    // Dwie pierwsze klatki to rozgrzewka shaderów (niewidoczne kopie).
    for (let i = 0; i < 3; i++) renderer.render(1);
    const meshes = renderer.root.children
      .flatMap((c) => c.children)
      .filter((c) => c.visible) as Mesh<BufferGeometry, MeshBasicMaterial>[];
    expect(meshes.some((m) => m.geometry.type === 'IcosahedronGeometry')).toBe(
      false,
    );
    shatter.dispose();
    renderer.dispose();
  });
});
