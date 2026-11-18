import { corners, footprint } from './geometry.mjs';

/** Largest axis-aligned square without solid cover, sampled on a 2 m grid. */
export function largestGroundGap(blocks, bounds, excluded) {
  const step = 2;
  const width = (bounds.maxX - bounds.minX) / step;
  const depth = (bounds.maxZ - bounds.minZ) / step;
  const occupied = new Uint8Array(width * depth);
  const mark = (r, value) => {
    for (
      let z = Math.max(0, Math.ceil((r.minZ - bounds.minZ) / step - 0.5));
      z < depth && bounds.minZ + (z + 0.5) * step < r.maxZ;
      z++
    )
      for (
        let x = Math.max(0, Math.ceil((r.minX - bounds.minX) / step - 0.5));
        x < width && bounds.minX + (x + 0.5) * step < r.maxX;
        x++
      )
        occupied[z * width + x] = value;
  };
  for (const block of blocks) {
    const ys = corners(block).map((p) => p.y);
    if (block.visible === false) continue;
    if (!block.rotation?.z && Math.abs(Math.max(...ys)) < 1e-6)
      mark(footprint(block), 1);
  }
  for (const block of blocks) {
    const ys = corners(block).map((p) => p.y);
    if (
      block.visible !== false &&
      !block.rotation?.z &&
      Math.min(...ys) < 0.15 &&
      Math.max(...ys) >= 0.85
    )
      mark(footprint(block), 0);
  }
  for (const r of excluded) mark(r, 0);
  const previous = new Uint16Array(width + 1);
  let side = 0,
    endX = 0,
    endZ = 0;
  for (let z = 0; z < depth; z++) {
    let diagonal = 0;
    for (let x = 1; x <= width; x++) {
      const above = previous[x];
      previous[x] = occupied[z * width + x - 1]
        ? 1 + Math.min(above, diagonal, previous[x - 1])
        : 0;
      diagonal = above;
      if (previous[x] > side) {
        side = previous[x];
        endX = x;
        endZ = z + 1;
      }
    }
  }
  return {
    sideM: side * step,
    minX: bounds.minX + (endX - side) * step,
    minZ: bounds.minZ + (endZ - side) * step,
  };
}
