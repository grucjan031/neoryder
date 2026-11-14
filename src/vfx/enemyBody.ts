import type { Enemy } from '../enemies/types';

/** Bryła wroga do efektów: y to dół bryły, height jej wysokość. */
export interface EnemyBody {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
}

const DEFAULT_HEIGHT = 1.8;
const DEFAULT_RADIUS = 0.3;

/** Interpolowana bryła wroga z publicznego stanu; dron ma pozycję w środku bryły. */
export function enemyBody(enemy: Enemy, alpha: number): EnemyBody {
  const a = enemy.previous.position;
  const b = enemy.current.position;
  const x = a.x + (b.x - a.x) * alpha;
  const y = a.y + (b.y - a.y) * alpha;
  const z = a.z + (b.z - a.z) * alpha;
  const def = enemy.definition;
  if (def.kind === 'drone') {
    const r = def.drone?.radiusM ?? DEFAULT_RADIUS;
    return { x, y: y - r, z, height: r * 2, radius: r };
  }
  return {
    x,
    y,
    z,
    height: def.body?.height ?? DEFAULT_HEIGHT,
    radius: def.body?.radius ?? DEFAULT_RADIUS,
  };
}
