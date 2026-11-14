import { Ball, Capsule, Cuboid } from '@dimforge/rapier3d-compat';
import type { World } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../../core/math';
import { CollisionGroup, interactionGroups } from '../../physics';
import { queryHurtboxes } from '../damage';
import type { Hurtboxes } from '../damage';

/** Kapsuła toru rzutu albo poziomy pas dash-cięcia; bez zależności od renderu. */
export function queryBladeSegment(
  world: World,
  hurtboxes: Hurtboxes,
  from: Vec3,
  to: Vec3,
  radius: number,
  dashCut: boolean,
  height: number,
  fallbackDir: Vec3 = { x: 0, y: 0, z: -1 },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  const center = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
    z: (from.z + to.z) / 2,
  };
  let rotation = { x: 0, y: 0, z: 0, w: 1 };
  let shape;
  if (dashCut) {
    const yaw =
      Math.hypot(dx, dz) > 0
        ? Math.atan2(dx, dz)
        : Math.atan2(fallbackDir.x, fallbackDir.z);
    rotation = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    shape = new Cuboid(
      radius,
      height / 2,
      Math.max(Number.EPSILON, Math.hypot(dx, dz) / 2),
    );
  } else if (length > 0) {
    // Quaternion obracający oś Y kapsuły w kierunek odcinka.
    const y = dy / length;
    if (y < -1 + 1e-9) rotation = { x: 1, y: 0, z: 0, w: 0 };
    else {
      const scale = Math.sqrt(2 * (1 + y));
      rotation = {
        x: dz / length / scale,
        y: 0,
        z: -dx / length / scale,
        w: scale / 2,
      };
    }
    shape = new Capsule(length / 2, radius);
  } else shape = new Ball(radius);
  return queryHurtboxes(
    world,
    hurtboxes,
    shape,
    center,
    rotation,
    interactionGroups(CollisionGroup.Player, CollisionGroup.Enemy),
  );
}
