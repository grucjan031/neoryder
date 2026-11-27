import type { Vec3 } from '../core/math';
import type { RoomDefinition } from './roomSchema';
import { ElevatorRoutes } from './elevatorRoutes';
import { tuning, type Tuning } from '../core/tuning';
import { NO_CELL, type RouteGraph } from './enemyBatch';

type Block = RoomDefinition['blocks'][number];
type Cell = { position: Vec3; neighbors: number[]; surface: Block };
/** Stałe bryły liczone raz: obwiednia z obrotem Y, cos/tan nachylenia Z. */
type Shape = {
  block: Block;
  x: number;
  y: number;
  z: number;
  sizeY: number;
  walkable: boolean;
  extentX: number;
  extentZ: number;
  cos: number;
  tan: number;
  tanX: number;
  lift: number;
};

/** Wierzch bryły w (x, z) albo undefined poza obwiednią (z marginesem). */
function topOf(s: Shape, x: number, z: number, margin = 0): number | undefined {
  if (
    Math.abs(x - s.x) > s.extentX + margin ||
    Math.abs(z - s.z) > s.extentZ + margin
  )
    return undefined;
  return s.y + s.tan * (x - s.x) - s.tanX * (z - s.z) + s.lift;
}
const EPSILON = 1e-5;
/** Kubełki indeksu brył (m); wynik nawigacji nie zależy od tej wartości. */
const INDEX_CELL_M = 2;
/** Liczba buforowanych pól celu (jak w crate Rust); cel ruchomy nie rozdyma pamięci. */
const FIELD_LIMIT = 32;

function pointRectSq(
  px: number,
  pz: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number {
  const dx = Math.max(x0 - px, 0, px - x1),
    dz = Math.max(z0 - pz, 0, pz - z1);
  return dx * dx + dz * dz;
}
function pointSegmentSq(
  px: number,
  pz: number,
  a: Vec3,
  dx: number,
  dz: number,
  lenSq: number,
): number {
  const t = lenSq
    ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / lenSq))
    : 0;
  const ex = px - a.x - dx * t,
    ez = pz - a.z - dz * t;
  return ex * ex + ez * ez;
}
/** Czy odcinek a–b leży bliżej niż r od prostokąta XZ (bez alokacji). */
function nearRect(
  a: Vec3,
  b: Vec3,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  r: number,
): boolean {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  // Szybkie odrzucenie: środek komórki dalej niż r + połowa przekątnej.
  const reach = r + 0.7072 * (x1 - x0);
  if (
    pointSegmentSq((x0 + x1) / 2, (z0 + z1) / 2, a, dx, dz, lenSq) >
    reach * reach
  )
    return false;
  let t0 = 0,
    t1 = 1;
  if (Math.abs(dx) < 1e-12) {
    if (a.x < x0 || a.x > x1) t0 = 2;
  } else {
    const u = (x0 - a.x) / dx,
      v = (x1 - a.x) / dx;
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
  }
  if (t0 <= 1) {
    if (Math.abs(dz) < 1e-12) {
      if (a.z < z0 || a.z > z1) t0 = 2;
    } else {
      const u = (z0 - a.z) / dz,
        v = (z1 - a.z) / dz;
      t0 = Math.max(t0, Math.min(u, v));
      t1 = Math.min(t1, Math.max(u, v));
    }
    if (t0 <= t1) return true;
  }
  const limit = r * r;
  return (
    pointRectSq(a.x, a.z, x0, z0, x1, z1) < limit ||
    pointRectSq(b.x, b.z, x0, z0, x1, z1) < limit ||
    pointSegmentSq(x0, z0, a, dx, dz, lenSq) < limit ||
    pointSegmentSq(x0, z1, a, dx, dz, lenSq) < limit ||
    pointSegmentSq(x1, z0, a, dx, dz, lenSq) < limit ||
    pointSegmentSq(x1, z1, a, dx, dz, lenSq) < limit
  );
}

/** Warstwy płyt i ramp osiowych (X i Z); obwiednie przeszkód uwzględniają wysokość kapsuły. */
export class ArenaSurfaceNavigation {
  private readonly cells: Cell[] = [];
  private readonly columns = new Map<number, number[]>();
  private readonly fields = new Map<number, Int32Array>();
  private readonly cell: number;
  private readonly clearance: number;
  /** 0 = nieznane, 1 = pełne otoczenie, 2 = brak (cache `isInterior`). */
  private interior = new Uint8Array(0);
  private scratch = new Int32Array(0);
  private readonly rise: number;
  private readonly firstZ: number;
  private readonly widthZ: number;
  private readonly shapes = new Map<Block, Shape>();

  readonly elevatorRoutes?: ElevatorRoutes;

  constructor(room: RoomDefinition, settings: Tuning = tuning) {
    const config = room.arena ?? {
      navigationCellM: settings.elevator.navCellM,
      navigationClearanceM: settings.player.capsuleRadius,
      navigationMaxRiseM: settings.enemies.stepHeight,
      navigationHeadroomM: settings.player.capsuleHeight,
    };
    this.cell = config.navigationCellM;
    this.clearance = config.navigationClearanceM;
    if (!config.navigationMaxRiseM || !config.navigationHeadroomM)
      throw new Error(
        'Powierzchnie areny wymagają limitu wzniosu i prześwitu.',
      );
    this.rise = config.navigationMaxRiseM;
    const surfaces = room.blocks.filter((b) => b.walkable);
    const margin = config.navigationClearanceM;
    const rise = this.rise;
    const headroom = config.navigationHeadroomM;
    // Indeks XZ: bryła trafia do kubełków całego obszaru, w którym top() z marginesem
    // może zwrócić wysokość, więc lokalne kandydaty dają ten sam wynik co pełna lista.
    const surfaceIndex = this.index(surfaces, margin);
    const blockIndex = this.index(room.blocks, margin);
    const offsets = [-margin, 0, margin, 0, 0, -margin, 0, margin];
    const supported = (x: number, z: number, y: number): boolean => {
      for (const s of this.near(surfaceIndex, x, z)) {
        const top = topOf(s, x, z);
        if (top !== undefined && Math.abs(top - y) <= rise) return true;
      }
      return false;
    };
    const obstructed = (
      own: Block,
      x: number,
      z: number,
      y: number,
    ): boolean => {
      for (const o of this.near(blockIndex, x, z)) {
        if (o.block === own) continue;
        const top = topOf(o, x, z, margin);
        if (top === undefined) continue;
        if (o.walkable && top <= y + rise && topOf(o, x, z) === undefined)
          continue;
        const bottom = top - o.sizeY / o.cos;
        if (top > y + EPSILON && bottom < y + headroom) return true;
      }
      return false;
    };
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
      const own = this.shape(b);
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
          const y = topOf(own, p.x, p.z);
          if (y === undefined) continue;
          p.y = y;
          let free = true;
          for (let i = 0; free && i < offsets.length; i += 2)
            free = supported(p.x + offsets[i]!, p.z + offsets[i + 1]!, y);
          if (!free || obstructed(b, p.x, p.z, y)) continue;
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
            this.connects(c, this.cells[i]!) &&
            !obstructed(
              c.surface,
              (c.position.x + this.cells[i]!.position.x) / 2,
              (c.position.z + this.cells[i]!.position.z) / 2,
              Math.max(c.position.y, this.cells[i]!.position.y),
            )
          )
            c.neighbors.push(i);
      }
    }
    this.interior = new Uint8Array(this.cells.length);
    if (room.elevators?.length)
      this.elevatorRoutes = new ElevatorRoutes(
        room.elevators,
        settings.elevator,
        (p) => this.locate(p),
        (from, to) => {
          const steps = this.field(to)[from]!;
          return steps < 0
            ? Infinity
            : (steps * this.cell) / settings.elevator.navWalkMps;
        },
      );
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
      // Zmiana powierzchni wyłącznie na końcach rampy, nigdy przez boczny próg.
      if (Math.abs(other!.position[axis] - surface.position[axis]) < half)
        return false;
    }
    return true;
  }

  private index(
    blocks: readonly Block[],
    margin: number,
  ): Map<number, Shape[]> {
    const buckets = new Map<number, Shape[]>();
    for (const b of blocks) {
      const shape = this.shape(b);
      const halfX = Math.abs(shape.extentX) + margin + EPSILON;
      const halfZ = shape.extentZ + margin + EPSILON;
      const x0 = Math.floor((b.position.x - halfX) / INDEX_CELL_M);
      const x1 = Math.floor((b.position.x + halfX) / INDEX_CELL_M);
      const z0 = Math.floor((b.position.z - halfZ) / INDEX_CELL_M);
      const z1 = Math.floor((b.position.z + halfZ) / INDEX_CELL_M);
      for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++) {
          const key = x * 65536 + z;
          const bucket = buckets.get(key);
          if (bucket) bucket.push(shape);
          else buckets.set(key, [shape]);
        }
    }
    return buckets;
  }
  private near(index: Map<number, Shape[]>, x: number, z: number): Shape[] {
    return (
      index.get(
        Math.floor(x / INDEX_CELL_M) * 65536 + Math.floor(z / INDEX_CELL_M),
      ) ?? []
    );
  }

  private shape(b: Block): Shape {
    const cached = this.shapes.get(b);
    if (cached) return cached;
    const angleX = b.rotation?.x ?? 0;
    const angleZ = b.rotation?.z ?? 0;
    const angle = angleX || angleZ;
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
    const shape = {
      block: b,
      x: b.position.x,
      y: b.position.y,
      z: b.position.z,
      sizeY: b.size.y,
      walkable: b.walkable === true,
      extentX: halfX * Math.cos(angleZ),
      extentZ: halfZ * Math.cos(angleX),
      cos: Math.cos(angle),
      tan: Math.tan(angleZ),
      tanX: Math.tan(angleX),
      lift: b.size.y / (2 * Math.cos(angle)),
    };
    this.shapes.set(b, shape);
    return shape;
  }

  private key(p: Vec3): number {
    const z = Math.floor(p.z / this.cell) - this.firstZ;
    if (z < 0 || z >= this.widthZ) return NaN;
    return Math.floor(p.x / this.cell) * this.widthZ + z;
  }
  private locate(p: Vec3): number | undefined {
    const pick = (column: number[] | undefined) =>
      column?.reduce<number | undefined>(
        (best, i) =>
          best === undefined ||
          Math.abs(this.cells[i]!.position.y - p.y) <
            Math.abs(this.cells[best]!.position.y - p.y)
            ? i
            : best,
        undefined,
      );
    const exact = pick(this.columns.get(this.key(p)));
    if (exact !== undefined) return exact;
    // Margines przy przeszkodzie/krawędzi: najbliższa komórka w małym promieniu.
    const r = tuning.arena.navFallbackCells;
    let best: number | undefined;
    let bestD = Infinity;
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        const i = pick(
          this.columns.get(
            this.key({
              ...p,
              x: p.x + dx * this.cell,
              z: p.z + dz * this.cell,
            }),
          ),
        );
        if (i === undefined) continue;
        const c = this.cells[i]!.position;
        const d = Math.hypot(c.x - p.x, c.z - p.z) + Math.abs(c.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    return best;
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
    if (this.fields.size >= FIELD_LIMIT)
      this.fields.delete(this.fields.keys().next().value!);
    this.fields.set(goal, field);
    return field;
  }

  batchGraph(): RouteGraph {
    const offsets = new Uint32Array(this.cells.length + 1);
    const edges: number[] = [];
    this.cells.forEach((cell, i) => {
      offsets[i] = edges.length;
      edges.push(...cell.neighbors);
    });
    offsets[this.cells.length] = edges.length;
    return {
      offsets,
      edges: Uint32Array.from(edges),
      locate: (p) => this.locate(p),
      prefix: (origin, goal, depth) => {
        const result: number[] = [];
        const field = this.field(goal);
        let current = origin;
        while (result.length < depth) {
          if (field[current] === -1) break;
          if (current !== goal) {
            const next = this.cells[current]!.neighbors.find(
              (n) => field[n] === field[current]! - 1,
            );
            if (next === undefined) break;
            current = next;
          }
          result.push(current);
          if (current === goal) break;
        }
        return result;
      },
      steer: (start, goal, origin, target, path) => {
        if (origin === NO_CELL || path[0] === NO_CELL) return start;
        const first = this.cells[origin]!;
        if (origin === target) return goal;
        if (this.key(start) !== this.key(first.position)) return first.position;
        for (let i = path.length - 1; i >= 0; i--) {
          const node = path[i]!;
          if (node === NO_CELL) continue;
          const dest = this.cells[node]!;
          const end =
            node === target && this.key(goal) === this.key(dest.position)
              ? goal
              : dest.position;
          const clear =
            first.surface === dest.surface &&
            this.clearSegment(origin, node, start, end);
          if (clear) return end;
          // Najbliższy węzeł zawsze prowadzi; bezpośredni cel w jego komórce tylko po czystym odcinku.
          if (i === 0) return dest.position;
        }
        return start;
      },
    };
  }

  /** Sąsiad kardynalny tej samej powierzchni przesunięty o (x, z) komórek. */
  private across(from: number, x: number, z: number): number | undefined {
    const cell = this.cells[from]!;
    return cell.neighbors.find((id) => {
      const c = this.cells[id]!;
      return (
        c.surface === cell.surface &&
        Math.abs(c.position.x - cell.position.x - x * this.cell) < EPSILON &&
        Math.abs(c.position.z - cell.position.z - z * this.cell) < EPSILON
      );
    });
  }

  /** Wszystkie 8 sąsiadów na tej powierzchni istnieje i jest połączonych krawędziami siatki. */
  private isInterior(id: number): boolean {
    const known = this.interior[id]!;
    if (known) return known === 1;
    let open = true;
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const x = this.across(id, dx, 0),
        z = this.across(id, 0, dz);
      const corner =
        x === undefined || z === undefined ? undefined : this.across(x, 0, dz);
      if (
        corner === undefined ||
        (z !== undefined && corner !== this.across(z, dx, 0))
      ) {
        open = false;
        break;
      }
    }
    this.interior[id] = open ? 1 : 2;
    return open;
  }

  /**
   * Kapsuła o promieniu prześwitu wzdłuż odcinka dotyka wyłącznie komórek tej samej
   * powierzchni, a sąsiadujące dotknięte komórki są połączone krawędzią siatki.
   */
  private sweptClear(surface: Block, start: Vec3, end: Vec3): boolean {
    const r = this.clearance,
      c = this.cell;
    const x0 = Math.floor((Math.min(start.x, end.x) - r) / c);
    const x1 = Math.floor((Math.max(start.x, end.x) + r) / c);
    const z0 = Math.floor((Math.min(start.z, end.z) - r) / c);
    const z1 = Math.floor((Math.max(start.z, end.z) + r) / c);
    const h = z1 - z0 + 1;
    const size = (x1 - x0 + 1) * h;
    if (this.scratch.length < size) this.scratch = new Int32Array(size);
    const grid = this.scratch;
    grid.fill(-1, 0, size);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        if (!nearRect(start, end, x * c, z * c, (x + 1) * c, (z + 1) * c, r))
          continue;
        const column =
          z - this.firstZ >= 0 && z - this.firstZ < this.widthZ
            ? this.columns.get(x * this.widthZ + z - this.firstZ)
            : undefined;
        let id = -1;
        if (column)
          for (let k = 0; k < column.length; k++)
            if (this.cells[column[k]!]!.surface === surface) {
              id = column[k]!;
              break;
            }
        if (id < 0) return false;
        grid[(x - x0) * h + z - z0] = id;
      }
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const id = grid[(x - x0) * h + z - z0]!;
        // Komórka z pełnym otoczeniem ma wszystkie krawędzie do dotkniętych sąsiadów.
        if (id < 0 || this.isInterior(id)) continue;
        const neighbors = this.cells[id]!.neighbors;
        if (x < x1) {
          const other = grid[(x + 1 - x0) * h + z - z0]!;
          if (other >= 0 && !neighbors.includes(other)) return false;
        }
        if (z < z1) {
          const other = grid[(x - x0) * h + z + 1 - z0]!;
          if (other >= 0 && !neighbors.includes(other)) return false;
        }
      }
    return true;
  }

  // Supercover DDA on one surface. At an exact corner both cardinal routes must be legal.
  private clearSegment(
    origin: number,
    target: number,
    start: Vec3,
    end: Vec3,
  ): boolean {
    let current = origin;
    const surface = this.cells[origin]!.surface;
    const dx = end.x - start.x,
      dz = end.z - start.z;
    const sx = Math.sign(dx),
      sz = Math.sign(dz);
    const strideX = this.cell / Math.abs(dx),
      strideZ = this.cell / Math.abs(dz);
    const boundary = (p: number, sign: number) =>
      (Math.floor(p / this.cell) + Number(sign > 0)) * this.cell;
    let tx = sx ? (boundary(start.x, sx) - start.x) / dx : Infinity;
    let tz = sz ? (boundary(start.z, sz) - start.z) / dz : Infinity;
    const across = (from: number, x: number, z: number) =>
      this.across(from, x, z);
    // Komórki z pełnym otoczeniem 3 x 3 nie wymagają kosztownego testu kapsuły.
    let open = this.clearance <= this.cell && this.isInterior(origin);
    while (current !== target) {
      if (Math.min(tx, tz) > 1 + EPSILON) return false;
      let next: number | undefined;
      if (Math.abs(tx - tz) < Number.EPSILON) {
        const x = across(current, sx, 0),
          z = across(current, 0, sz);
        if (x === undefined || z === undefined) return false;
        next = across(x, 0, sz);
        if (next !== across(z, sx, 0)) return false;
        open &&= this.isInterior(x) && this.isInterior(z);
        tx += strideX;
        tz += strideZ;
      } else if (tx < tz) {
        next = across(current, sx, 0);
        tx += strideX;
      } else {
        next = across(current, 0, sz);
        tz += strideZ;
      }
      if (next === undefined) return false;
      current = next;
      open &&= this.isInterior(current);
    }
    return open || this.sweptClear(surface, start, end);
  }
  path(start: Vec3, goal: Vec3): Vec3[] {
    const rides = this.elevatorRoutes?.rides(start, goal);
    if (!rides?.length) return this.walkPath(start, goal);
    const result: Vec3[] = [];
    for (const r of rides) {
      result.push(...this.walkPath(start, r.entry), r.exit);
      start = r.exit;
    }
    return result.concat(this.walkPath(start, goal));
  }
  private walkPath(start: Vec3, goal: Vec3): Vec3[] {
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
