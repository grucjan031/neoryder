import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';

type Block = RoomDefinition['blocks'][number];
type Cell = { position: Vec3; neighbors: number[]; surface: Block };
const EPSILON = 1e-5;

/** Warstwy płyt i ramp X; obwiednie przeszkód uwzględniają wysokość kapsuły. */
export class ArenaSurfaceNavigation {
  private readonly cells: Cell[] = [];
  private readonly columns = new Map<string, number[]>();
  private readonly fields = new Map<number, Map<number, number>>();
  private readonly cell: number;
  private readonly rise: number;

  constructor(room: RoomDefinition) {
    const config = room.arena!;
    this.cell = config.navigationCellM;
    if (!config.navigationMaxRiseM || !config.navigationHeadroomM)
      throw new Error(
        'Powierzchnie areny wymagają limitu wzniosu i prześwitu.',
      );
    this.rise = config.navigationMaxRiseM;
    const surfaces = room.blocks.filter((b) => b.walkable);
    for (const b of surfaces) {
      if (b.rotation?.x || b.rotation?.y)
        throw new Error('Powierzchnia nawigacji obsługuje wyłącznie obrót Z.');
      const angle = b.rotation?.z ?? 0;
      const halfX = (b.size.x * Math.cos(angle)) / 2;
      for (
        let x = Math.floor((b.position.x - halfX) / this.cell);
        (x + 0.5) * this.cell <= b.position.x + halfX;
        x++
      ) {
        for (
          let z = Math.floor((b.position.z - b.size.z / 2) / this.cell);
          (z + 0.5) * this.cell <= b.position.z + b.size.z / 2;
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
          const margin = config.navigationClearanceM;
          if (
            [
              [-margin, 0],
              [margin, 0],
              [0, -margin],
              [0, margin],
            ].some(
              ([dx, dz]) =>
                !surfaces.some((s) => {
                  const top = this.top(s, p.x + dx!, p.z + dz!);
                  return top !== undefined && Math.abs(top - y) <= this.rise;
                }),
            )
          )
            continue;
          if (
            room.blocks.some((obstacle) => {
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
                top - obstacle.size.y / Math.cos(obstacle.rotation?.z ?? 0);
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
      const angle = ramp!.surface.rotation?.z ?? 0;
      if (!angle) continue;
      const half = (ramp!.surface.size.x * Math.cos(angle)) / 2;
      // Zmiana powierzchni wyłącznie na końcach rampy, nigdy przez boczny próg.
      if (Math.abs(other!.position.x - ramp!.surface.position.x) < half)
        return false;
    }
    return true;
  }

  private top(b: Block, x: number, z: number, margin = 0): number | undefined {
    const angle = b.rotation?.z ?? 0;
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
      Math.abs(x - b.position.x) > halfX * Math.cos(angle) + margin ||
      Math.abs(z - b.position.z) > halfZ + margin
    )
      return undefined;
    return (
      b.position.y +
      Math.tan(angle) * (x - b.position.x) +
      b.size.y / (2 * Math.cos(angle))
    );
  }
  private key(p: Vec3): string {
    return `${Math.floor(p.x / this.cell)},${Math.floor(p.z / this.cell)}`;
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
  private field(goal: number): Map<number, number> {
    const cached = this.fields.get(goal);
    if (cached) return cached;
    const field = new Map([[goal, 0]]);
    const queue = [goal];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      for (const next of this.cells[current]!.neighbors) {
        if (field.has(next)) continue;
        field.set(next, field.get(current)! + 1);
        queue.push(next);
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
    if (!field.has(current)) return [];
    const result = [this.cells[current]!.position];
    while (current !== target) {
      const next = this.cells[current]!.neighbors.find(
        (n) => field.get(n) === field.get(current!)! - 1,
      );
      if (next === undefined) return [];
      current = next;
      result.push(this.cells[current]!.position);
    }
    return [...result, goal];
  }
  next(start: Vec3, goal: Vec3): Vec3 {
    const path = this.path(start, goal);
    if (!path.length) return { ...start };
    let end = Math.min(1, path.length - 1);
    const direction = (i: number) => ({
      x: Math.sign(path[i]!.x - path[i - 1]!.x),
      z: Math.sign(path[i]!.z - path[i - 1]!.z),
    });
    if (end) {
      const first = direction(end);
      while (end + 1 < path.length) {
        const next = direction(end + 1);
        if (first.x !== next.x || first.z !== next.z) break;
        end++;
      }
    }
    // Skracanie wyłącznie po spójnym odcinku wysokości: nie przeskakuje dachów.
    // Sprawdzamy cały prosty odcinek raz zamiast każdy jego coraz dłuższy prefiks.
    const clearTo = (point: Vec3): boolean => {
      const steps = Math.ceil(
        Math.hypot(point.x - start.x, point.z - start.z) / (this.cell / 2),
      );
      let previous = this.locate(start);
      let clear = previous !== undefined;
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
