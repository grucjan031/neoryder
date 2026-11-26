import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { facePoint, type ElevatorDefinition } from './elevatorSchema';

export interface ElevatorEdge {
  kind: 'elevator';
  id: string;
  from: number;
  to: number;
  entry: Vec3;
  exit: Vec3;
  seconds: number;
}
interface Landing {
  def: ElevatorDefinition;
  stop: number;
  position: Vec3;
  cell: number;
}

/** Mały graf podestów. Koszt dojścia pochodzi z pełnego pola odległości siatki.
 * Dijkstra uwzględnia dojście, jazdę, przesiadki i pieszą drogę do celu. */
export class ElevatorRoutes {
  private readonly landings: Landing[] = [];
  constructor(
    defs: ElevatorDefinition[],
    private readonly t: Tuning['elevator'],
    private readonly locate: (p: Vec3) => number | undefined,
    private readonly walkSeconds: (from: number, to: number) => number,
  ) {
    for (const def of defs)
      def.stops.forEach((s, stop) => {
        const position = facePoint(def, s.doorSide, s.y, t.landingOffsetM);
        const cell = locate(position);
        if (cell !== undefined)
          this.landings.push({ def, stop, position, cell });
      });
  }
  rides(start: Vec3, goal: Vec3): ElevatorEdge[] {
    const origin = this.locate(start),
      target = this.locate(goal);
    if (origin === undefined || target === undefined) return [];
    const nodes = this.landings;
    const cost = nodes.map((n) => this.walkSeconds(origin, n.cell));
    const previous = nodes.map(() => -1);
    const ride = nodes.map(() => false);
    const visited = new Set<number>();
    let best = this.walkSeconds(origin, target),
      end = -1;
    while (true) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++)
        if (
          !visited.has(i) &&
          cost[i]! < best &&
          (current < 0 || cost[i]! < cost[current]!)
        )
          current = i;
      if (current < 0) break;
      visited.add(current);
      const a = nodes[current]!;
      const final = cost[current]! + this.walkSeconds(a.cell, target);
      if (final < best) {
        best = final;
        end = current;
      }
      nodes.forEach((b, i) => {
        if (visited.has(i)) return;
        const walk = this.walkSeconds(a.cell, b.cell);
        const lift = a.def === b.def ? this.rideSeconds(a, b) : Infinity;
        const next = cost[current]! + Math.min(walk, lift);
        if (next >= cost[i]!) return;
        cost[i] = next;
        previous[i] = current;
        ride[i] = lift < walk;
      });
    }
    const result: ElevatorEdge[] = [];
    while (end >= 0) {
      const prev = previous[end]!;
      if (ride[end]) {
        const a = nodes[prev]!,
          b = nodes[end]!;
        result.push({
          kind: 'elevator',
          id: a.def.id,
          from: a.stop,
          to: b.stop,
          entry: a.position,
          exit: b.position,
          seconds: this.rideSeconds(a, b),
        });
      }
      end = prev;
    }
    return result.reverse();
  }
  private rideSeconds(a: Landing, b: Landing): number {
    return (
      this.t.elevatorDoorDwellS +
      2 * this.t.elevatorDoorOpenS +
      Math.abs(a.position.y - b.position.y) / this.t.elevatorSpeedMps
    );
  }
}
