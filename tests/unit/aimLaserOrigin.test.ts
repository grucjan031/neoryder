import { afterEach, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Mesh } from 'three';
import { enemySchema } from '../../src/enemies/enemySchema';
import { createEnemyView } from '../../src/enemies/views';
import type { EnemyViewLike } from '../../src/enemies/views';
import type { Enemy, EnemySnapshot } from '../../src/enemies/types';
import turret from '../../src/data/enemies/turret.json';
import hacker from '../../src/data/enemies/hacker.json';
import sniper from '../../src/data/enemies/sniper.json';

const views: EnemyViewLike[] = [];
afterEach(() => {
  for (const view of views.splice(0)) view.dispose();
});

/** Punkt wylotu pocisku jak w symulacji (`Gunner.muzzle()`): `muzzle` z danych obrócony o yaw. */
function simMuzzle(
  snapshot: EnemySnapshot,
  muzzle: { x: number; y: number; z: number },
) {
  const { position: p, yaw } = snapshot;
  return new Vector3(
    p.x + Math.cos(yaw) * muzzle.x + Math.sin(yaw) * muzzle.z,
    p.y + muzzle.y,
    p.z - Math.sin(yaw) * muzzle.x + Math.cos(yaw) * muzzle.z,
  );
}

it.each([
  ['turret', turret],
  ['hacker', hacker],
  ['sniper', sniper],
])(
  '%s: początek lasera celowania pokrywa się z wylotem pocisku (przesunięty i obrócony)',
  (_, raw) => {
    const definition = enemySchema.parse(raw);
    const snapshot = (): EnemySnapshot => ({
      position: { x: 3, y: 0.5, z: -2 },
      yaw: 0.7,
      speed: 0,
      state: 'aim',
      stateTimeS: 0.2,
      distance: 0,
      aim: { x: 7, y: 1.6, z: 4 },
    });
    const enemy: Enemy = {
      id: 1,
      definition,
      previous: snapshot(),
      current: snapshot(),
      removed: false,
      step: () => {},
      dispose: () => {},
    };
    const view = createEnemyView(enemy, false);
    views.push(view);
    view.render(1);
    view.root.updateMatrixWorld(true);
    const laser = view.root.getObjectByName('laser') as Mesh;
    expect(laser.visible).toBe(true);
    // Walec jednostkowy wzdłuż +Y, wyśrodkowany: początek to lokalne (0, -0,5, 0).
    const start = laser.localToWorld(new Vector3(0, -0.5, 0));
    const expected = simMuzzle(enemy.current, definition.muzzle!);
    expect(start.distanceTo(expected)).toBeLessThan(1e-6);
  },
);
