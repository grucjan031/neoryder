export const EPS = 1e-6;

// Euler XYZ, tak samo jak render i collider Rapiera.
export function rotate(p, rotation = {}) {
  const { x = 0, y = 0, z = 0 } = rotation;
  const a = {
    x: p.x * Math.cos(z) - p.y * Math.sin(z),
    y: p.x * Math.sin(z) + p.y * Math.cos(z),
    z: p.z,
  };
  const b = {
    x: a.x * Math.cos(y) + a.z * Math.sin(y),
    y: a.y,
    z: -a.x * Math.sin(y) + a.z * Math.cos(y),
  };
  return {
    x: b.x,
    y: b.y * Math.cos(x) - b.z * Math.sin(x),
    z: b.y * Math.sin(x) + b.z * Math.cos(x),
  };
}

export function corners(block, topOnly = false) {
  return [-1, 1].flatMap((x) =>
    (topOnly ? [1] : [-1, 1]).flatMap((y) =>
      [-1, 1].map((z) => {
        const p = rotate(
          {
            x: (x * block.size.x) / 2,
            y: (y * block.size.y) / 2,
            z: (z * block.size.z) / 2,
          },
          block.rotation,
        );
        return {
          x: p.x + block.position.x,
          y: p.y + block.position.y,
          z: p.z + block.position.z,
        };
      }),
    ),
  );
}

export function footprint(block) {
  const points = corners(block);
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

export const contains = (rect, p, margin = 0) =>
  p.x >= rect.minX + margin &&
  p.x <= rect.maxX - margin &&
  p.z >= rect.minZ + margin &&
  p.z <= rect.maxZ - margin;

function axes(block) {
  return [
    rotate({ x: 1, y: 0, z: 0 }, block.rotation),
    rotate({ x: 0, y: 1, z: 0 }, block.rotation),
    rotate({ x: 0, y: 0, z: 1 }, block.rotation),
  ];
}

export function topAt(block, x, z) {
  const basis = axes(block);
  const normal = basis[1];
  if (normal.y <= EPS) return undefined;
  const dx = x - block.position.x,
    dz = z - block.position.z;
  const dy = (block.size.y / 2 - normal.x * dx - normal.z * dz) / normal.y;
  if (
    [0, 2].some(
      (i) =>
        Math.abs(basis[i].x * dx + basis[i].y * dy + basis[i].z * dz) >
        block.size[i === 0 ? 'x' : 'z'] / 2 + EPS,
    )
  )
    return undefined;
  return block.position.y + dy;
}

export function verticalRange(block, x, z) {
  let min = -Infinity,
    max = Infinity;
  const basis = axes(block);
  for (const [i, key] of ['x', 'y', 'z'].entries()) {
    const axis = basis[i],
      half = block.size[key] / 2;
    const offset =
      axis.x * (x - block.position.x) + axis.z * (z - block.position.z);
    if (Math.abs(axis.y) < EPS) {
      if (Math.abs(offset) > half + EPS) return undefined;
    } else {
      const a = (-half - offset) / axis.y + block.position.y;
      const b = (half - offset) / axis.y + block.position.y;
      min = Math.max(min, Math.min(a, b));
      max = Math.min(max, Math.max(a, b));
    }
  }
  return min <= max + EPS ? { min, max } : undefined;
}

/**
 * Prostokąt pomniejszony o otwory: rozłączne prostokąty pokrywające resztę.
 * Kolejne otwory tną kawałki pasami wzdłuż Z (lewy/prawy pas na całą głębokość).
 */
export function subtractRects(rect, holes = []) {
  let pieces = [{ ...rect }];
  for (const hole of holes) {
    const next = [];
    for (const r of pieces) {
      const cut = {
        minX: Math.max(r.minX, hole.minX),
        maxX: Math.min(r.maxX, hole.maxX),
        minZ: Math.max(r.minZ, hole.minZ),
        maxZ: Math.min(r.maxZ, hole.maxZ),
      };
      if (cut.maxX - cut.minX < EPS || cut.maxZ - cut.minZ < EPS) {
        next.push(r);
        continue;
      }
      if (cut.minX - r.minX > EPS) next.push({ ...r, maxX: cut.minX });
      if (r.maxX - cut.maxX > EPS) next.push({ ...r, minX: cut.maxX });
      if (cut.minZ - r.minZ > EPS)
        next.push({ ...cut, minZ: r.minZ, maxZ: cut.minZ });
      if (r.maxZ - cut.maxZ > EPS)
        next.push({ ...cut, minZ: cut.maxZ, maxZ: r.maxZ });
    }
    pieces = next;
  }
  return pieces;
}
