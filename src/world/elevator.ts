import type { EventBus } from '../core/events';
import type { Tuning } from '../core/tuning';
import type { ElevatorDefinition } from './elevatorSchema';

export interface ElevatorState {
  phase: 'idle' | 'doorsOpening' | 'open' | 'doorsClosing' | 'moving';
  stop: number;
  target: number;
  direction: number;
  y: number;
  speed: number;
  door: number;
  dwell: number;
  queue: number[];
}

/** Stan liczy się wyłącznie z danych, żądań i czasu symulacji. */
export class Elevator {
  readonly state: ElevatorState;
  constructor(
    readonly def: ElevatorDefinition,
    readonly tuning: Tuning['elevator'],
    private readonly bus?: EventBus,
  ) {
    this.state = {
      phase: 'idle',
      stop: def.startStop,
      target: def.startStop,
      direction: 1,
      y: def.stops[def.startStop]!.y,
      speed: 0,
      door: 0,
      dwell: 0,
      queue: [],
    };
  }
  request(stop: number): boolean {
    const s = this.state;
    if (
      !Number.isInteger(stop) ||
      !this.def.stops[stop] ||
      s.queue.includes(stop) ||
      (s.phase === 'moving' && s.target === stop)
    )
      return false;
    if (stop === s.stop && s.phase !== 'moving') {
      if (s.phase === 'open' || s.phase === 'doorsOpening') return false;
      this.bus?.emit('elevatorCalled', { id: this.def.id, stop });
      this.doors(true);
    } else {
      s.queue.push(stop);
      this.bus?.emit('elevatorCalled', { id: this.def.id, stop });
    }
    return true;
  }
  private doors(opening: boolean): void {
    this.state.phase = opening ? 'doorsOpening' : 'doorsClosing';
    this.bus?.emit('elevatorDoors', {
      id: this.def.id,
      stop: this.state.stop,
      opening,
    });
  }
  step(dt: number, doorwayOccupied = false): void {
    if (dt <= 0) return;
    const s = this.state,
      t = this.tuning;
    switch (s.phase) {
      case 'idle': {
        if (!s.queue.length) return;
        if (!s.queue.some((i) => (i - s.stop) * s.direction > 0))
          s.direction = -s.direction;
        s.target = s.queue
          .filter((i) => (i - s.stop) * s.direction > 0)
          .sort((a, b) => (a - b) * s.direction)[0]!;
        s.queue.splice(s.queue.indexOf(s.target), 1);
        s.phase = 'moving';
        this.bus?.emit('elevatorDeparted', {
          id: this.def.id,
          from: s.stop,
          to: s.target,
        });
        break;
      }
      case 'moving': {
        const a = Math.max(Number.EPSILON, t.elevatorAccelMps2);
        // Przyjmij wezwanie po drodze, o ile pozostaje dość drogi na hamowanie.
        const intermediate = s.queue
          .filter(
            (i) =>
              (s.target - i) * s.direction > 0 &&
              (this.def.stops[i]!.y - s.y) * s.direction >
                (s.speed * s.speed) / (2 * a) + s.speed * dt,
          )
          .sort((a, b) => (a - b) * s.direction)[0];
        if (intermediate !== undefined) {
          s.queue.splice(s.queue.indexOf(intermediate), 1, s.target);
          s.target = intermediate;
        }
        const dest = this.def.stops[s.target]!.y;
        const remaining = Math.abs(dest - s.y);
        const brakeSpeed =
          Math.sqrt(2 * a * remaining + (a * dt) ** 2) - a * dt;
        s.speed = Math.min(
          t.elevatorSpeedMps,
          s.speed + a * dt,
          Math.max(s.speed - a * dt, brakeSpeed),
        );
        const travel = s.speed * dt;
        if (remaining - travel > 1e-6) {
          s.y += s.direction * travel;
          break;
        }
        s.y = dest;
        s.stop = s.target;
        s.speed = 0;
        this.bus?.emit('elevatorArrived', { id: this.def.id, stop: s.stop });
        this.doors(true);
        break;
      }
      case 'doorsOpening':
        s.door = Math.min(1, s.door + dt / t.elevatorDoorOpenS);
        if (s.door === 1) {
          s.phase = 'open';
          s.dwell = t.elevatorDoorDwellS;
        }
        break;
      case 'open':
        s.dwell = Math.max(0, s.dwell - dt);
        if (s.dwell <= 0 && !doorwayOccupied) this.doors(false);
        break;
      case 'doorsClosing':
        if (doorwayOccupied) {
          this.doors(true);
          break;
        }
        s.door = Math.max(0, s.door - dt / t.elevatorDoorOpenS);
        if (!s.door) s.phase = 'idle';
        break;
    }
  }
}
