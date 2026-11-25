import type { Vec3 } from '../core/math';
import { FLOOR_EPSILON_M, type RoomDefinition } from './roomSchema';
import { ArenaSurfaceNavigation } from './arenaSurfaceNavigation';
import { freeModePosition } from './modeSchema';
import { tuning } from '../core/tuning';
import { EnemyBatch, type MovingAgent } from './enemyBatch';

/** Liczba buforowanych pól celu; cel ruchomy (gracz, lider) nie rozdyma pamięci. */
const FIELD_LIMIT = 32;

/** Pola odległości po gruncie; bez fizyki, renderu i losowości. */
export class ArenaNavigation {
  private readonly cells = new Map<string, Vec3>();
  private readonly fields = new Map<string, Map<string, number>>();
  private readonly cell: number;
  private readonly surface?: ArenaSurfaceNavigation;
  private batch?: EnemyBatch;
  constructor(private readonly room: RoomDefinition) {
    const config = room.arena;
    if (!config) throw new Error('Nawigacja wymaga danych areny.');
    this.cell = config.navigationCellM;
    if (room.blocks.some((b) => b.walkable)) {
      this.surface = new ArenaSurfaceNavigation(room);
      return;
    }
    const floors = room.blocks.filter(
      (b) =>
        !b.rotation &&
        Math.abs(b.position.y + b.size.y / 2 - room.playerSpawn.y) <=
          FLOOR_EPSILON_M,
    );
    const rotated = room.blocks.filter((b) => b.rotation);
    for (const floor of floors) {
      for (
        let x = Math.floor((floor.position.x - floor.size.x / 2) / this.cell);
        x * this.cell < floor.position.x + floor.size.x / 2;
        x++
      ) {
        for (
          let z = Math.floor((floor.position.z - floor.size.z / 2) / this.cell);
          z * this.cell < floor.position.z + floor.size.z / 2;
          z++
        ) {
          const p = {
            x: (x + 0.5) * this.cell,
            y: room.playerSpawn.y,
            z: (z + 0.5) * this.cell,
          };
          if (!freeModePosition(room, p, config.navigationClearanceM)) continue;
          // Rampy są trasami gracza; naziemne AI omija ich konserwatywną obwiednię.
          if (
            rotated.some(
              (b) =>
                Math.abs(p.x - b.position.x) <=
                  b.size.x / 2 + config.navigationClearanceM &&
                Math.abs(p.z - b.position.z) <=
                  b.size.z / 2 + config.navigationClearanceM,
            )
          )
            continue;
          this.cells.set(`${x},${z}`, p);
        }
      }
    }
  }

  private key(p: Vec3): string {
    return `${Math.floor(p.x / this.cell)},${Math.floor(p.z / this.cell)}`;
  }
  private neighbors(key: string): string[] {
    const [x, z] = key.split(',').map(Number) as [number, number];
    return [`${x - 1},${z}`, `${x + 1},${z}`, `${x},${z - 1}`, `${x},${z + 1}`];
  }
  /** Komórka celu; poza siatką (przy ścianie/przeszkodzie) najbliższa przejezdna w małym promieniu. */
  private resolve(p: Vec3): string {
    const key = this.key(p);
    if (this.cells.has(key)) return key;
    const [kx, kz] = key.split(',').map(Number) as [number, number];
    const r = tuning.arena.navFallbackCells;
    let best = key;
    let bestD = Infinity;
    for (let x = kx - r; x <= kx + r; x++)
      for (let z = kz - r; z <= kz + r; z++) {
        const c = this.cells.get(`${x},${z}`);
        if (!c) continue;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = `${x},${z}`;
        }
      }
    return best;
  }
  private field(goal: Vec3): Map<string, number> {
    const key = this.resolve(goal);
    const cached = this.fields.get(key);
    if (cached) return cached;
    const result = new Map<string, number>();
    const queue = this.cells.has(key) ? [key] : [];
    if (queue.length) result.set(key, 0);
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i]!;
      for (const next of this.neighbors(current)) {
        if (!this.cells.has(next) || result.has(next)) continue;
        result.set(next, result.get(current)! + 1);
        queue.push(next);
      }
    }
    if (this.fields.size >= FIELD_LIMIT)
      this.fields.delete(this.fields.keys().next().value!);
    this.fields.set(key, result);
    return result;
  }

  path(start: Vec3, goal: Vec3): Vec3[] {
    if (this.surface) return this.surface.path(start, goal);
    const field = this.field(goal);
    let key = this.key(start);
    // Pozycje tuż przy ścianie mogą wypaść w odrzuconej komórce: najbliższa sąsiednia.
    if (!field.has(key)) {
      key =
        this.neighbors(key)
          .filter((k) => field.has(k))
          .sort((a, b) => {
            const p = this.cells.get(a)!,
              q = this.cells.get(b)!;
            return (
              Math.hypot(p.x - start.x, p.z - start.z) -
              Math.hypot(q.x - start.x, q.z - start.z)
            );
          })[0] ?? key;
    }
    if (!field.has(key)) return [];
    const result: Vec3[] = [this.cells.get(key)!];
    while (field.get(key)! > 0) {
      const next = this.neighbors(key).find(
        (k) => field.get(k) === field.get(key)! - 1,
      );
      if (!next) return [];
      key = next;
      result.push(this.cells.get(key)!);
    }
    result.push(goal);
    return result;
  }

  next(start: Vec3, goal: Vec3): Vec3 {
    if (this.surface) return this.surface.next(start, goal);
    if (start.x === goal.x && start.z === goal.z) return { ...goal };
    const path = this.path(start, goal);
    let next = path[0] ?? start;
    for (const point of path) {
      const steps = Math.ceil(
        Math.hypot(point.x - start.x, point.z - start.z) / (this.cell / 2),
      );
      let clear = true;
      for (let i = 1; i <= steps; i++) {
        const p = {
          x: start.x + ((point.x - start.x) * i) / steps,
          y: this.room.playerSpawn.y,
          z: start.z + ((point.z - start.z) * i) / steps,
        };
        if (!this.cells.has(this.key(p))) {
          clear = false;
          break;
        }
      }
      if (!clear) break;
      next = point;
    }
    return { ...next };
  }

  nextBatch(
    agents: readonly MovingAgent[],
    radius: number,
    lookahead: number,
  ): Uint32Array {
    this.batch ??= new EnemyBatch(this.surface?.batchGraph());
    if (!this.surface)
      for (const agent of agents)
        if (agent.moveGoal) {
          const goal = agent.moveGoal;
          agent.moveGoal = this.next(agent.current.position, goal);
          agent.moveGoalFinal =
            agent.moveGoal.x === goal.x && agent.moveGoal.z === goal.z;
        }
    return this.batch.run(agents, radius, lookahead);
  }

  dispose(): void {
    this.batch?.dispose();
  }
}
