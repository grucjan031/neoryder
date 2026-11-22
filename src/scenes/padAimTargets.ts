import type { Vec3 } from '../core/math';
import type { EnemyManager } from '../enemies/manager';

export function padAimTargets(manager: EnemyManager): Vec3[] {
  const targets: Vec3[] = [];
  manager.forEach((enemy) => {
    if (enemy.removed || enemy.current.state === 'dead') return;
    const { x, y, z } = enemy.current.position;
    targets.push({ x, y: y + (enemy.definition.body?.centerY ?? 0), z });
  });
  return targets;
}
