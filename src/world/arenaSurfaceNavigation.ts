import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';

type Block = RoomDefinition['blocks'][number];
type Cell = { position: Vec3; neighbors: number[]; surface: Block };
const EPSILON = 1e-5;

/** Warstwy płyt i ramp osiowych; obwiednie przeszkód uwzględniają wysokość kapsuły. */
export class ArenaSurfaceNavigation {
  private readonly cells: Cell[] = [];
  private readonly columns = new Map<number, number[]>();
  private readonly fields = new Map<number, Int32Array>();
  private readonly cell: number;
  private readonly rise: number;
  private readonly firstZ: number;
  private readonly widthZ: number;

  constructor(room: RoomDefinition) {
    const config = room.arena!;
    this.cell = config.navigationCellM;
    if (!config.navigationMaxRiseM || !config.navigationHeadroomM)
      throw new Error(
        'Powierzchnie areny wymagają limitu wzniosu i prześwitu.',
      );
    this.rise = config.navigationMaxRiseM;
    const surfaces = room.blocks.filter((b) => b.walkable);
    const bucketSize = config.batchCellM;
    const margin = config.navigationClearanceM;
    const buckets = new Map<string, { blocks: Block[]; surfaces: Block[] }>();
    for (const block of room.blocks) {
      const yaw = block.rotation?.y ?? 0;
      const halfX =
        (Math.abs(Math.cos(yaw)) * block.size.x +
          Math.abs(Math.sin(yaw)) * block.size.z) /
          2 +
        margin;
      const halfZ =
        (Math.abs(Math.sin(yaw)) * block.size.x +
          Math.abs(Math.cos(yaw)) * block.size.z) /
          2 +
        margin;
      for (
        let x = Math.floor((block.position.x - halfX) / bucketSize);
        x <= Math.floor((block.position.x + halfX) / bucketSize);
        x++
      )
        for (
          let z = Math.floor((block.position.z - halfZ) / bucketSize);
          z <= Math.floor((block.position.z + halfZ) / bucketSize);
          z++
        ) {
          const key = `${x},${z}`;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = { blocks: [], surfaces: [] };
            buckets.set(key, bucket);
          }
          bucket.blocks.push(block);
          if (block.walkable) bucket.surfaces.push(block);
        }
    }
    this.firstZ = Math.floor(
      Math.min(...surfaces.map((b) => b.position.z - b.size.z / 2)) / this.cell,
    );
    this.widthZ =
      Math.ceil(
        Math.max(...surfaces.map((b) => b.position.z + b.size.z / 2)) /
          this.cell,
      ) -
      this.firstZ +
      1;
    for (const b of surfaces) {
      if (b.rotation?.y || (b.rotation?.x && b.rotation?.z))
        throw new Error('Powierzchnia nawigacji wymaga rampy w osi X lub Z.');
      const halfX = (b.size.x * Math.cos(b.rotation?.z ?? 0)) / 2;
      const halfZ = (b.size.z * Math.cos(b.rotation?.x ?? 0)) / 2;
      for (
        let x = Math.floor((b.position.x - halfX) / this.cell);
        (x + 0.5) * this.cell <= b.position.x + halfX;
        x++
      ) {
        for (
          let z = Math.floor((b.position.z - halfZ) / this.cell);
          (z + 0.5) * this.cell <= b.position.z + halfZ;
          z++
        ) {
          const p = {
            x: (x + 0.5) * this.cell,
            y: 0,
            z: (z + 0.5) * this.cell,
          };
          const y = this.top(b, p.x, p.z);
          if (y === undefined) continue;
          p.y = y;
          const nearby = buckets.get(
            `${Math.floor(p.x / bucketSize)},${Math.floor(p.z / bucketSize)}`,
          )!;
          if (
            [
              [-margin, 0],
              [margin, 0],
              [0, -margin],
              [0, margin],
            ].some(
              ([dx, dz]) =>
                !nearby.surfaces.some((s) => {
                  const top = this.top(s, p.x + dx!, p.z + dz!);
                  return top !== undefined && Math.abs(top - y) <= this.rise;
                }),
            )
          )
            continue;
          if (
            nearby.blocks.some((obstacle) => {
              if (obstacle === b) return false;
              const top = this.top(obstacle, p.x, p.z, margin);
              if (top === undefined) return false;
              if (
                obstacle.walkable &&
                top <= y + this.rise &&
                this.top(obstacle, p.x, p.z) === undefined
              )
                return false;
              const bottom =
                top -
                obstacle.size.y /
                  Math.cos(obstacle.rotation?.z || obstacle.rotation?.x || 0);
              return (
                top > y + EPSILON && bottom < y + config.navigationHeadroomM!
              );
            })
          )
            continue;
          const key = this.key(p);
          const column = this.columns.get(key) ?? [];
          if (
            column.some(
              (i) => Math.abs(this.cells[i]!.position.y - y) < EPSILON,
            )
          )
            continue;
          column.push(this.cells.length);
          this.columns.set(key, column);
          this.cells.push({ position: p, neighbors: [], surface: b });
        }
      }
    }
    for (const c of this.cells) {
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const column = this.columns.get(
          this.key({
            ...c.position,
            x: c.position.x + dx! * this.cell,
            z: c.position.z + dz! * this.cell,
          }),
        );
        for (const i of column ?? [])
          if (
            Math.abs(this.cells[i]!.position.y - c.position.y) <= this.rise &&
            this.connects(c, this.cells[i]!)
          )
            c.neighbors.push(i);
      }
    }
  }

  private connects(a: Cell, b: Cell): boolean {
    if (a.surface === b.surface) return true;
    for (const [ramp, other] of [
      [a, b],
      [b, a],
    ]) {
      const surface = ramp!.surface;
      const axis = surface.rotation?.x ? 'z' : 'x';
      const angle = surface.rotation?.x || surface.rotation?.z;
      if (!angle) continue;
      const half = (surface.size[axis] * Math.cos(angle)) / 2;
      // Wejście na rampę tylko przez jej końce.
      if (Math.abs(other!.position[axis] - surface.position[axis]) < half)
        return false;
    }
    return true;
  }

  private top(b: Block, x: number, z: number, margin = 0): number | undefined {
    const angleX = b.rotation?.x ?? 0;
    const angleZ = b.rotation?.z ?? 0;
    // Obrócone wokół Y rekwizyty: konserwatywna obwiednia, nigdy powierzchnia.
    const yaw = b.rotation?.y ?? 0;
    const halfX =
      (Math.abs(Math.cos(yaw)) * b.size.x +
        Math.abs(Math.sin(yaw)) * b.size.z) /
      2;
    const halfZ =
      (Math.abs(Math.sin(yaw)) * b.size.x +
        Math.abs(Math.cos(yaw)) * b.size.z) /
      2;
    if (
      Math.abs(x - b.position.x) > halfX * Math.cos(angleZ) + margin ||
      Math.abs(z - b.position.z) > halfZ * Math.cos(angleX) + margin
    )
      return undefined;
    return (
      b.position.y +
      Math.tan(angleZ) * (x - b.position.x) -
      Math.tan(angleX) * (z - b.position.z) +
      b.size.y / (2 * Math.cos(angleX || angleZ))
    );
  }
  private key(p: Vec3): number {
    const z = Math.floor(p.z / this.cell) - this.firstZ;
    if (z < 0 || z >= this.widthZ) return NaN;
    return Math.floor(p.x / this.cell) * this.widthZ + z;
  }
  private locate(p: Vec3): number | undefined {
    return this.columns
      .get(this.key(p))
      ?.reduce<number | undefined>(
        (best, i) =>
          best === undefined ||
          Math.abs(this.cells[i]!.position.y - p.y) <
            Math.abs(this.cells[best]!.position.y - p.y)
            ? i
            : best,
        undefined,
      );
  }
  private field(goal: number): Int32Array {
    const cached = this.fields.get(goal);
    if (cached) return cached;
    const field = new Int32Array(this.cells.length).fill(-1);
    const queue = new Int32Array(this.cells.length);
    field[goal] = 0;
    queue[0] = goal;
    let length = 1;
    for (let i = 0; i < length; i++) {
      const current = queue[i]!;
      for (const next of this.cells[current]!.neighbors) {
        if (field[next] !== -1) continue;
        field[next] = field[current]! + 1;
        queue[length++] = next;
      }
    }
    this.fields.set(goal, field);
    return field;
  }
  path(start: Vec3, goal: Vec3): Vec3[] {
    const origin = this.locate(start);
    const target = this.locate(goal);
    if (origin === undefined || target === undefined) return [];
    let current: number = origin;
    const field = this.field(target);
    if (field[current] === -1) return [];
    const result = [this.cells[current]!.position];
    while (current !== target) {
      const next = this.cells[current]!.neighbors.find(
        (n) => field[n] === field[current]! - 1,
      );
      if (next === undefined) return [];
      current = next;
      result.push(this.cells[current]!.position);
    }
    return [...result, goal];
  }
  next(start: Vec3, goal: Vec3): Vec3 {
    const origin = this.locate(start);
    const target = this.locate(goal);
    if (origin === undefined || target === undefined) return { ...start };
    const field = this.field(target);
    if (field[origin] === -1) return { ...start };
    let current = origin;
    const first = this.cells[origin]!.position;
    const path = [first];
    let signX = 0;
    let signZ = 0;
    // Potrzebny jest tylko pierwszy prosty odcinek pola, do najbliższego zakrętu.
    while (true) {
      const previous = this.cells[current]!.position;
      const next =
        current === target
          ? undefined
          : this.cells[current]!.neighbors.find(
              (n) => field[n] === field[current]! - 1,
            );
      if (next === undefined && current !== target) break;
      const point = next === undefined ? goal : this.cells[next]!.position;
      const dx = Math.sign(point.x - previous.x);
      const dz = Math.sign(point.z - previous.z);
      if (path.length > 1 && (dx !== signX || dz !== signZ)) break;
      path.push(point);
      signX = dx;
      signZ = dz;
      if (next === undefined) break;
      current = next;
    }
    const end = path.length - 1;
    // Skracanie wyłącznie po spójnym odcinku wysokości: nie przeskakuje dachów.
    // Sprawdzamy cały prosty odcinek raz zamiast każdy jego coraz dłuższy prefiks.
    const clearTo = (point: Vec3): boolean => {
      const steps = Math.ceil(
        Math.hypot(point.x - start.x, point.z - start.z) / (this.cell / 2),
      );
      let previous: number | undefined = origin;
      let clear = true;
      for (let i = 1; clear && i <= steps; i++) {
        const t = i / steps;
        const sample = {
          x: start.x + (point.x - start.x) * t,
          y: path[0]!.y + (point.y - path[0]!.y) * t,
          z: start.z + (point.z - start.z) * t,
        };
        const index = this.locate(sample);
        clear =
          index !== undefined &&
          Math.abs(this.cells[index]!.position.y - sample.y) <= this.rise &&
          (index === previous ||
            this.cells[previous!]!.neighbors.includes(index));
        previous = index;
      }
      return clear;
    };
    if (clearTo(path[end]!)) return { ...path[end]! };
    let low = 0;
    let high = end;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (clearTo(path[middle]!)) low = middle;
      else high = middle;
    }
    return { ...path[low]! };
  }
}
