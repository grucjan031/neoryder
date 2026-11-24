import { add, dot, scale, sub, vec3, type Vec3 } from '../core/math';

export interface Box {
  center: Vec3;
  axes: Vec3[];
  half: number[];
  min: Vec3;
  max: Vec3;
}

const cross = (a: Vec3, b: Vec3) =>
  vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export function orientedBox(center: Vec3, size: Vec3, rotation?: Vec3): Box {
  // Kolumny macierzy Eulera XYZ, tak jak w RoomScene i Rapierze.
  const a = Math.cos(rotation?.x ?? 0),
    b = Math.sin(rotation?.x ?? 0);
  const c = Math.cos(rotation?.y ?? 0),
    d = Math.sin(rotation?.y ?? 0);
  const e = Math.cos(rotation?.z ?? 0),
    f = Math.sin(rotation?.z ?? 0);
  const axes = [
    vec3(c * e, a * f + b * e * d, b * f - a * e * d),
    vec3(-c * f, a * e - b * f * d, b * e + a * f * d),
    vec3(d, -b * c, a * c),
  ];
  const half = [size.x / 2, size.y / 2, size.z / 2];
  const extent = (k: keyof Vec3) =>
    axes.reduce((sum, axis, i) => sum + Math.abs(axis[k]) * half[i]!, 0);
  const r = vec3(extent('x'), extent('y'), extent('z'));
  return { center, axes, half, min: sub(center, r), max: add(center, r) };
}

export function modelPoint(
  position: Vec3,
  yaw: number,
  factor: number,
  local: readonly number[],
): Vec3 {
  const x = local[0]!,
    z = local[2]!;
  return add(
    position,
    scale(
      vec3(
        x * Math.cos(yaw) + z * Math.sin(yaw),
        local[1]!,
        z * Math.cos(yaw) - x * Math.sin(yaw),
      ),
      factor,
    ),
  );
}

export function contains(box: Box, point: Vec3, margin: number): boolean {
  const offset = sub(point, box.center);
  return box.axes.every(
    (axis, i) => Math.abs(dot(axis, offset)) <= box.half[i]! + margin,
  );
}

// Test osi rozdzielających dla dwóch OBB. Ujemny margines wymaga penetracji w metrach.
export function intersects(a: Box, b: Box, margin: number): boolean {
  if (
    a.max.x + margin < b.min.x ||
    b.max.x + margin < a.min.x ||
    a.max.y + margin < b.min.y ||
    b.max.y + margin < a.min.y ||
    a.max.z + margin < b.min.z ||
    b.max.z + margin < a.min.z
  )
    return false;
  const offset = sub(a.center, b.center);
  const radius = (box: Box, axis: Vec3) =>
    box.axes.reduce((r, v, i) => r + box.half[i]! * Math.abs(dot(v, axis)), 0);
  const separates = (axis: Vec3) => {
    const length = Math.hypot(axis.x, axis.y, axis.z);
    return (
      length > 1e-6 &&
      Math.abs(dot(offset, axis)) >
        radius(a, axis) + radius(b, axis) + margin * length
    );
  };
  return (
    !a.axes.some(separates) &&
    !b.axes.some(separates) &&
    !a.axes.some((av) => b.axes.some((bv) => separates(cross(av, bv))))
  );
}

/** Wierzch obróconego bloku pod środkiem stóp, również na rampie. */
export function surfaceY(
  box: Box,
  point: Vec3,
  margin: number,
): number | undefined {
  const up = box.axes[1]!;
  if (up.y < 0.5) return undefined;
  const y =
    box.center.y +
    (box.half[1]! -
      up.x * (point.x - box.center.x) -
      up.z * (point.z - box.center.z)) /
      up.y;
  return contains(box, { ...point, y }, margin + 1e-6) ? y : undefined;
}
