import type { Vec3 } from '../../../core/math';
import type { Rng } from '../../../core/rng';

export function spreadDirection(dir: Vec3, spreadDeg: number, rng: Rng): Vec3 {
  const length = Math.hypot(dir.x, dir.y, dir.z);
  if (!(length > 0)) throw new Error('Kierunek strzału musi być niezerowy.');
  const forward = { x: dir.x / length, y: dir.y / length, z: dir.z / length };
  const right =
    Math.abs(forward.y) < 0.999
      ? { x: -forward.z, y: 0, z: forward.x }
      : { x: 1, y: 0, z: 0 };
  const rightLength = Math.hypot(right.x, right.y, right.z);
  right.x /= rightLength;
  right.z /= rightLength;
  const up = {
    x: forward.y * right.z - forward.z * right.y,
    y: forward.z * right.x - forward.x * right.z,
    z: forward.x * right.y - forward.y * right.x,
  };
  const angle = rng.float(0, Math.PI * 2);
  const radius = Math.sqrt(rng.next()) * Math.tan((spreadDeg * Math.PI) / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const result = {
    x: forward.x + right.x * x + up.x * y,
    y: forward.y + right.y * x + up.y * y,
    z: forward.z + right.z * x + up.z * y,
  };
  const norm = Math.hypot(result.x, result.y, result.z);
  return { x: result.x / norm, y: result.y / norm, z: result.z / norm };
}
