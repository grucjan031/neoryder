import type { HubLayout } from './hubSchema';
import type { Tuning } from '../core/tuning';

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Przygotowana raz suma podłóg; test ruchu nie tworzy tablic ani wektorów. */
export class FaunaGround {
  private readonly holes: Rect[] = [];
  private readonly obstacles: Rect[];
  private readonly stationary: { x: number; z: number }[];
  private readonly minX: number;
  private readonly maxX: number;
  private readonly minZ: number;
  private readonly maxZ: number;

  constructor(
    layout: Pick<HubLayout, 'blocks' | 'npcs'>,
    private readonly t: Tuning['hub'],
    ground: number,
  ) {
    const rect = (b: HubLayout['blocks'][number]): Rect => ({
      minX: b.position.x - b.size.x / 2,
      maxX: b.position.x + b.size.x / 2,
      minZ: b.position.z - b.size.z / 2,
      maxZ: b.position.z + b.size.z / 2,
    });
    const floors = layout.blocks
      .filter(
        (b) =>
          Math.abs(b.position.y + b.size.y / 2 - ground) < Number.EPSILON * 8,
      )
      .map(rect);
    const xs = [...new Set(floors.flatMap((f) => [f.minX, f.maxX]))].sort(
      (a, b) => a - b,
    );
    const zs = [...new Set(floors.flatMap((f) => [f.minZ, f.maxZ]))].sort(
      (a, b) => a - b,
    );
    this.minX = xs[0] ?? Infinity;
    this.maxX = xs.at(-1) ?? -Infinity;
    this.minZ = zs[0] ?? Infinity;
    this.maxZ = zs.at(-1) ?? -Infinity;
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < zs.length; j++) {
        const minX = xs[i - 1]!,
          maxX = xs[i]!,
          minZ = zs[j - 1]!,
          maxZ = zs[j]!;
        const x = (minX + maxX) / 2,
          z = (minZ + maxZ) / 2;
        if (
          !floors.some(
            (f) => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ,
          )
        )
          this.holes.push({ minX, maxX, minZ, maxZ });
      }
    this.obstacles = layout.blocks
      .filter(
        (b) =>
          b.position.y - b.size.y / 2 < ground + t.catHeightM &&
          b.position.y + b.size.y / 2 > ground + Number.EPSILON * 8,
      )
      .map(rect);
    this.stationary = (layout.npcs ?? [])
      .filter((n) => !n.route)
      .map((n) => n.position);
  }

  safe(x: number, z: number, radius = this.t.catRadiusM): boolean {
    if (
      x - radius < this.minX ||
      x + radius > this.maxX ||
      z - radius < this.minZ ||
      z + radius > this.maxZ
    )
      return false;
    for (const h of this.holes)
      if (
        x + radius > h.minX &&
        x - radius < h.maxX &&
        z + radius > h.minZ &&
        z - radius < h.maxZ
      )
        return false;
    for (const b of this.obstacles)
      if (
        Math.hypot(
          Math.max(0, b.minX - x, x - b.maxX),
          Math.max(0, b.minZ - z, z - b.maxZ),
        ) < radius
      )
        return false;
    for (const n of this.stationary)
      if (Math.hypot(x - n.x, z - n.z) < this.t.catStaticClearanceM)
        return false;
    return true;
  }

  segment(ax: number, az: number, bx: number, bz: number): boolean {
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(bx - ax, bz - az) / this.t.faunaSampleM),
    );
    for (let i = 0; i <= count; i++)
      if (
        !this.safe(ax + ((bx - ax) * i) / count, az + ((bz - az) * i) / count)
      )
        return false;
    return true;
  }
}
