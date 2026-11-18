import { QueryFilterFlags, Ray } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/math';
import { CollisionGroup, interactionGroups } from '../physics';
import type { EnemyDependencies } from './types';

/** Promienie taktyczne ignorują wrogów i sensory; osłoną jest wyłącznie geometria świata. */
export function clearWorld(
  deps: EnemyDependencies,
  from: Vec3,
  to: Vec3,
): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (length <= 1e-6) return true;
  return (
    deps.world.castRay(
      new Ray(from, {
        x: (to.x - from.x) / length,
        y: (to.y - from.y) / length,
        z: (to.z - from.z) / length,
      }),
      length,
      true,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    ) === null
  );
}

export function playerThreatens(
  deps: EnemyDependencies,
  id: number,
  position: Vec3,
  range: number,
  facingDot: number,
): boolean {
  const target = deps.getTarget();
  if (!target) return false;
  const dx = position.x - target.position.x,
    dz = position.z - target.position.z;
  const length = Math.hypot(dx, dz);
  if (length > range || length <= 1e-6) return false;
  const forward = deps.targetForward?.();
  if (forward && Math.hypot(forward.x, forward.z) > 1e-6)
    return (
      (dx * forward.x + dz * forward.z) /
        (length * Math.hypot(forward.x, forward.z)) >=
      facingDot
    );
  // Starsze sceny debug nie przekazują kierunku: reaguje tylko najbliższy wróg.
  return !(deps.getNeighbors?.() ?? []).some(
    (enemy) =>
      enemy.id !== id &&
      !enemy.removed &&
      enemy.current.state !== 'dead' &&
      Math.hypot(
        enemy.current.position.x - target.position.x,
        enemy.current.position.z - target.position.z,
      ) <
        length - 1e-6,
  );
}
