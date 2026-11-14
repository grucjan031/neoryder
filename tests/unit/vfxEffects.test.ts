import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { DebrisSystem } from '../../src/vfx/debris';
import { EnemyShatter } from '../../src/vfx/enemyShatter';
import { HitSparksRenderer, StatusVfxRenderer } from '../../src/vfx/fxRenderer';
import { ParticlePool } from '../../src/vfx/fxPool';
import type { FxInstance } from '../../src/vfx/fxPool';
import {
  HIT_SPARK_CYAN,
  HIT_SPARK_RED,
  HitSparks,
} from '../../src/vfx/hitSparks';
import { StatusVfx } from '../../src/vfx/statusVfx';

const body = { x: 0, y: 0, z: 0, height: 1.8, radius: 0.3 };
const applied = (target: number, status: string, stacks = 1) => ({
  target,
  status,
  stacks,
  durationS: 3,
  source: 1,
});

function setup() {
  const bus = new EventBus();
  const vfx = new StatusVfx(bus, { bodyOf: () => body, tuning });
  return { bus, vfx };
}
function run(vfx: StatusVfx, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) vfx.update(1 / 60, 1);
}

describe('ParticlePool', () => {
  it('nie przekracza pojemności i zastępuje najstarszą cząsteczkę', () => {
    const pool = new ParticlePool(3);
    for (let i = 0; i < 10; i++) pool.spawn(1).x = i;
    expect(pool.count).toBe(3);
    expect(pool.particles.map((p) => p.x).sort()).toEqual([7, 8, 9]);
  });
  it('zwalnia miejsca po czasie życia', () => {
    const pool = new ParticlePool(4);
    pool.spawn(0.1);
    pool.spawn(0.5);
    pool.step(0.2);
    expect(pool.count).toBe(1);
    pool.step(1);
    expect(pool.count).toBe(0);
  });
});

describe('StatusVfx', () => {
  it('podpalenie emituje płomienie do końca statusu i do limitu puli', () => {
    const { bus, vfx } = setup();
    bus.emit('status_applied', applied(5, 'burning'));
    run(vfx, 0.5);
    expect(vfx.count('flame')).toBeGreaterThan(0);
    run(vfx, 20);
    expect(vfx.count('flame')).toBeLessThanOrEqual(tuning.vfx.maxStatusFlames);
    bus.emit('status_expired', { target: 5, status: 'burning' });
    run(vfx, tuning.vfx.statusFlameLifeS * 2);
    expect(vfx.count('flame')).toBe(0);
    expect(vfx.trackedTargets).toBe(0);
  });

  it('przeciążenie: więcej stosów daje więcej łuków', () => {
    const a = setup();
    a.bus.emit('status_applied', applied(5, 'overload', 1));
    run(a.vfx, 1);
    const b = setup();
    b.bus.emit('status_applied', applied(5, 'overload', 3));
    run(b.vfx, 1);
    expect(a.vfx.count('spark')).toBeGreaterThan(0);
    expect(b.vfx.count('spark')).toBeGreaterThan(a.vfx.count('spark'));
  });

  it('ogłuszenie rysuje pierścień trójkątów nad głową i znika', () => {
    const { bus, vfx } = setup();
    bus.emit('status_applied', applied(5, 'stunned'));
    vfx.update(1 / 60, 1);
    expect(vfx.count('star')).toBe(tuning.vfx.statusStarCount);
    const ys: number[] = [];
    vfx.forEach('star', (i) => ys.push(i.y));
    expect(Math.min(...ys)).toBeGreaterThan(body.height);
    bus.emit('status_expired', { target: 5, status: 'stunned' });
    vfx.update(1 / 60, 1);
    expect(vfx.count('star')).toBe(0);
  });

  it('śmierć i despawn wroga kończą efekty bez wycieku', () => {
    const { bus, vfx } = setup();
    bus.emit('status_applied', applied(1, 'burning'));
    bus.emit('status_applied', applied(2, 'stunned'));
    bus.emit('status_applied', applied(3, 'overload'));
    bus.emit('enemy_killed', { id: 1 } as never);
    bus.emit('entity_despawned', { id: 2 });
    bus.emit('entity_despawned', { id: 3 });
    expect(vfx.trackedTargets).toBe(0);
    run(vfx, 1);
    expect(vfx.count('flame')).toBe(0);
    expect(vfx.count('spark')).toBe(0);
    expect(vfx.count('star')).toBe(0);
  });

  it('wielu wrogów nie przekracza limitu instancji gwiazdek', () => {
    const { bus, vfx } = setup();
    for (let id = 1; id <= 50; id++)
      bus.emit('status_applied', applied(id, 'stunned'));
    vfx.update(1 / 60, 1);
    expect(vfx.count('star')).toBe(tuning.vfx.maxStatusStars);
  });

  it('dispose odpina subskrypcje', () => {
    const { bus, vfx } = setup();
    vfx.dispose();
    bus.emit('status_applied', applied(5, 'burning'));
    expect(vfx.trackedTargets).toBe(0);
  });

  it('renderer ustawia liczbę instancji zgodną z efektem', () => {
    const { bus, vfx } = setup();
    const view = new StatusVfxRenderer(vfx, {
      flames: tuning.vfx.maxStatusFlames,
      sparks: tuning.vfx.maxStatusSparks,
      stars: tuning.vfx.maxStatusStars,
    });
    bus.emit('status_applied', applied(5, 'stunned'));
    view.render(1, 1 / 60);
    const stars = view.root.children[2] as { count: number };
    expect(stars.count).toBe(tuning.vfx.statusStarCount);
    view.dispose();
  });
});

describe('HitSparks', () => {
  const player = 1;
  const point = { x: 1, y: 1, z: 1 };
  const hit = (source: number | null, target: number, p = point) => ({
    source,
    target,
    amount: 5,
    tags: [],
    point: p,
    dir: { x: 1, y: 0, z: 0 },
    knockback: 0,
    killed: false,
  });
  const colors = (sparks: HitSparks): number[] => {
    const out: number[] = [];
    sparks.forEach((i: FxInstance) => out.push(i.color));
    return out;
  };

  it('obrażenia gracza dają iskry cyan, obrażenia wrogów czerwone', () => {
    const bus = new EventBus();
    const sparks = new HitSparks(bus, { playerId: player, tuning });
    bus.emit('damage_dealt', hit(player, 7));
    expect(sparks.count).toBe(tuning.vfx.hitSparkCount);
    expect(new Set(colors(sparks))).toEqual(new Set([HIT_SPARK_CYAN]));
    sparks.clear();
    bus.emit('damage_dealt', hit(7, player));
    expect(new Set(colors(sparks))).toEqual(new Set([HIT_SPARK_RED]));
  });

  it('pomija trafienia bez punktu, bez gracza i punkt w kamerze', () => {
    const bus = new EventBus();
    const sparks = new HitSparks(bus, {
      playerId: player,
      cameraPosition: () => ({ x: 1, y: 1, z: 1.1 }),
      tuning,
    });
    bus.emit('damage_dealt', { ...hit(player, 7), point: null });
    bus.emit('damage_dealt', hit(7, 8));
    bus.emit('damage_dealt', hit(7, player));
    expect(sparks.count).toBe(0);
    bus.emit('damage_dealt', hit(7, player, { x: 5, y: 1, z: 1 }));
    expect(sparks.count).toBe(tuning.vfx.hitSparkCount);
  });

  it('iskry lecą w kierunku dir, giną i nie przekraczają puli', () => {
    const bus = new EventBus();
    const sparks = new HitSparks(bus, { playerId: player, tuning });
    for (let i = 0; i < 100; i++) bus.emit('damage_dealt', hit(player, 7));
    expect(sparks.count).toBe(tuning.vfx.maxHitSparks);
    sparks.clear();
    bus.emit('damage_dealt', hit(player, 7));
    sparks.update(0.05);
    let meanX = 0;
    sparks.forEach((i) => (meanX += i.x - point.x));
    expect(meanX).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) sparks.update(1 / 60);
    expect(sparks.count).toBe(0);
    const view = new HitSparksRenderer(sparks, tuning.vfx.maxHitSparks);
    view.render(1 / 60);
    expect(view.root.count).toBe(0);
    view.dispose();
  });
});

describe('odłamki drona', () => {
  function shatterKind(kind: string) {
    const bus = new EventBus();
    const debris = new DebrisSystem({ maxDebris: 600, tuning: tuning.vfx });
    const shatter = new EnemyShatter(bus, debris, {
      positionOf: () => ({ x: 0, y: 3, z: 0 }),
      tuning,
    });
    bus.emit('entity_spawned', { id: 9, kind });
    bus.emit('damage_dealt', {
      source: 1,
      target: 9,
      amount: 10,
      tags: [],
      point: null,
      dir: null,
      knockback: 0,
      killed: true,
    });
    const ys: number[] = [];
    const sizes: number[] = [];
    debris.forEachActive((pos, _q, scale) => {
      ys.push(pos.y);
      sizes.push(scale.x);
    });
    shatter.dispose();
    return { ys, sizes };
  }

  it('dron rozpryskuje mniej i mniejszych odłamków ze środka bryły', () => {
    const drone = shatterKind('drone');
    const human = shatterKind('assaulter');
    expect(drone.ys.length).toBeGreaterThan(0);
    expect(drone.ys.length).toBeLessThan(human.ys.length);
    const mean = (a: number[]): number =>
      a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(drone.sizes)).toBeLessThan(mean(human.sizes));
    expect(Math.abs(mean(drone.ys) - 3)).toBeLessThan(0.4);
    expect(mean(human.ys)).toBeGreaterThan(3.5);
  });
});
