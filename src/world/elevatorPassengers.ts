import type { Vec3 } from '../core/math';
import type { ArenaNavigation } from './arenaNavigation';
import type { ElevatorEdge } from './elevatorRoutes';
import { facePoint } from './elevatorSchema';
import type { ElevatorCabin } from './elevatorCabin';

interface Trip {
  edge: ElevatorEdge;
  phase: 'approach' | 'wait' | 'board' | 'ride' | 'exit' | 'retreat' | 'stairs';
  slot: number;
  elapsed: number;
}
const gap = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

export class ElevatorPassengers {
  private readonly trips = new Map<number, Trip>();
  readonly waypoints = new Map<number, Vec3>();
  constructor(
    private readonly cabins: ReadonlyMap<string, ElevatorCabin>,
    private readonly navigation: ArenaNavigation,
  ) {}
  boardingAt(id: string, stop: number): boolean {
    for (const trip of this.trips.values()) {
      if (
        trip.edge.id === id &&
        trip.edge.from === stop &&
        trip.phase === 'board'
      )
        return true;
    }
    return false;
  }
  remove(id: number): void {
    this.trips.delete(id);
    this.waypoints.delete(id);
  }
  update(id: number, p: Vec3, goal: Vec3, dt: number): void {
    this.waypoints.delete(id);
    let trip = this.trips.get(id);
    if (!trip) {
      const edge = this.navigation.elevatorRoute(p, goal)[0];
      if (!edge) return;
      trip = { edge, phase: 'approach', slot: -1, elapsed: 0 };
      this.trips.set(id, trip);
    }
    const { edge } = trip;
    const cabin = this.cabins.get(edge.id)!;
    const { def, state, tuning: t } = cabin;
    const stop = def.stops[edge.from]!;
    const near = (a: Vec3, b: Vec3) => gap(a, b) < t.boardingToleranceM;
    const walk = (to: Vec3) =>
      this.waypoints.set(id, this.navigation.next(p, to));
    const direct = (to: Vec3) => this.waypoints.set(id, to);
    const openAt = (index: number) =>
      state.phase === 'open' && state.stop === index;
    if (trip.phase === 'stairs') {
      if (Math.abs(goal.y - p.y) < t.boardingToleranceM) {
        this.remove(id);
        return;
      }
      walk(goal);
      return;
    }
    if (trip.phase === 'approach') {
      if (
        Math.abs(p.y - stop.y) > t.boardingToleranceM ||
        gap(p, edge.entry) > t.landingOffsetM
      ) {
        walk(edge.entry);
        return;
      }
      trip.phase = 'wait';
    }
    if (trip.phase === 'wait' || trip.phase === 'board') {
      trip.elapsed += dt;
      if (trip.elapsed >= t.waitTimeoutS) trip.phase = 'retreat';
    }
    if (trip.phase === 'wait') {
      const slots = new Set(
        [...this.trips.values()]
          .filter((other) => other.edge.id === edge.id && other.slot >= 0)
          .map((other) => other.slot),
      );
      const capacity = Math.floor(t.maxEnemies);
      if (slots.size < capacity) {
        if (!openAt(edge.from)) cabin.request(edge.from);
        else {
          let slot = 0;
          while (slots.has(slot)) slot++;
          trip.slot = slot;
          trip.phase = 'board';
        }
      }
      if (trip.phase === 'wait') {
        direct(edge.entry);
        return;
      }
    }
    // Oddzielne miejsca obok siebie, z dala od progu.
    const span =
      stop.doorSide === 'n' || stop.doorSide === 's' ? def.width : def.depth;
    const tangent =
      ((trip.slot + 0.5) / Math.max(1, Math.floor(t.maxEnemies)) - 0.5) *
      span *
      0.82;
    const seat = {
      x: def.x + (stop.doorSide === 'n' || stop.doorSide === 's' ? tangent : 0),
      y: state.y,
      z: def.z + (stop.doorSide === 'e' || stop.doorSide === 'w' ? tangent : 0),
    };
    if (trip.phase === 'board') {
      if (!openAt(edge.from)) {
        trip.slot = -1;
        trip.phase = 'wait';
        direct(edge.entry);
        return;
      }
      if (!near(p, seat)) {
        direct(seat);
        return;
      }
      trip.phase = 'ride';
      cabin.request(edge.to);
    }
    if (trip.phase === 'ride') {
      if (!openAt(edge.to)) {
        direct(seat);
        return;
      }
      trip.phase = 'exit';
      trip.elapsed = 0;
    }
    if (trip.phase === 'exit' && (trip.elapsed += dt) >= t.waitTimeoutS) {
      trip.slot = -1;
      trip.phase = 'stairs';
      walk(goal);
      return;
    }
    const landing = def.stops[trip.phase === 'retreat' ? edge.from : edge.to]!;
    const lane =
      landing.doorSide === 'n' || landing.doorSide === 's'
        ? seat.x - def.x
        : seat.z - def.z;
    const sign = landing.doorSide === 's' || landing.doorSide === 'w' ? 1 : -1;
    const out = facePoint(
      def,
      landing.doorSide,
      landing.y,
      t.landingOffsetM,
      trip.slot < 0 ? 0 : lane * sign,
    );
    if (!near(p, out)) {
      direct(out);
      return;
    }
    if (trip.phase === 'retreat') {
      trip.slot = -1;
      trip.phase = 'stairs';
      walk(goal);
    } else this.remove(id);
  }
}
