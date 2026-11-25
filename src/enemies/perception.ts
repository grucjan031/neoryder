import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { Enemy } from './types';
import type { LevelDefinition } from '../world/levelSchema';

type Config = Tuning['enemies']['perception'];
type Encounter = NonNullable<LevelDefinition['encounters'][number]['stealth']>;
export interface StealthSpawn extends Pick<
  Encounter,
  'visionRangeM' | 'visionAngleDeg'
> {
  groupId: string;
  patrol?: NonNullable<Encounter['patrols']>[number];
  sentry?: boolean;
  reportedAt?: Vec3;
}
type State = 'unaware' | 'suspicious' | 'alerted' | 'searching';
type Los = (from: Vec3, to: Vec3) => boolean;
interface Observer {
  position: Vec3;
  yaw: number;
}
export function observerPose(enemy: Enemy): Observer {
  const { position, yaw } = enemy.current;
  return {
    yaw,
    position: {
      ...position,
      y: position.y + (enemy.definition.body?.centerY ?? 0),
    },
  };
}
interface Target {
  position: Vec3;
  crouched?: boolean;
  velocity?: Vec3;
}

function bearing(observer: Observer, point: Vec3) {
  const dx = point.x - observer.position.x,
    dz = point.z - observer.position.z;
  const flat = Math.hypot(dx, dz);
  return flat
    ? (dx * Math.sin(observer.yaw) + dz * Math.cos(observer.yaw)) / flat
    : 1;
}
export function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export class Perception {
  state: State = 'unaware';
  awareness = 0;
  lastKnown?: Vec3;
  showCone = false;
  seesTarget = false;
  private unseenS = 0;
  private investigateLeft = 0;
  private waypoint = 0;
  private direction = 1;
  private waitLeft = 0;
  private searchPoint = 0;

  constructor(
    readonly config: Config,
    readonly spawn: StealthSpawn,
    private readonly los: Los,
  ) {}
  get range() {
    return this.spawn.visionRangeM ?? this.config.visionRangeM;
  }
  get angle() {
    return this.spawn.visionAngleDeg ?? this.config.visionAngleDeg;
  }
  sees(observer: Observer, point: Vec3) {
    return (
      distance(observer.position, point) <= this.range &&
      bearing(observer, point) >= Math.cos((this.angle * Math.PI) / 360) &&
      this.los(observer.position, point)
    );
  }
  vulnerable(observer: Observer, point: Vec3) {
    return (
      (this.state === 'unaware' || this.state === 'suspicious') &&
      (bearing(observer, point) <=
        -Math.cos((this.config.rearAngleDeg * Math.PI) / 360) ||
        !this.sees(observer, point))
    );
  }
  suspect(point: Vec3) {
    if (this.state === 'alerted') return;
    this.lastKnown = { ...point };
    if (this.state === 'searching') {
      this.unseenS = 0;
      this.searchPoint = 0;
      return;
    }
    this.state = 'suspicious';
    this.awareness = Math.max(this.config.suspicion, this.awareness);
    this.investigateLeft = this.config.investigateS;
  }
  alert(point: Vec3) {
    this.lastKnown = { ...point };
    this.state = 'alerted';
    this.awareness = 1;
    this.unseenS = 0;
  }
  step(dt: number, observer: Observer, target: Target | null) {
    if (dt <= 0) return;
    const c = this.config;
    this.seesTarget = !!target && this.sees(observer, target.position);
    if (target && this.seesTarget) {
      if (this.state === 'searching') {
        this.alert(target.position);
        return;
      }
      this.unseenS = 0;
      this.lastKnown = { ...target.position };
      const time = this.spawn.sentry
        ? c.sentryDetectS
        : c.nearDetectS +
          ((c.farDetectS - c.nearDetectS) *
            distance(observer.position, target.position)) /
            this.range;
      const moving =
        target.velocity &&
        Math.hypot(target.velocity.x, target.velocity.z) >
          c.movementThresholdMps;
      this.awareness = Math.min(
        1,
        this.awareness +
          (dt / time) *
            (moving ? c.movingFactor : 1) *
            (target.crouched ? c.crouchFactor : 1),
      );
      if (this.awareness >= 1) this.alert(target.position);
      else if (this.awareness >= c.suspicion) this.suspect(target.position);
      return;
    }
    this.unseenS += dt;
    if (this.state === 'alerted') {
      if (this.unseenS >= c.loseSightS) {
        this.state = 'searching';
        this.unseenS = 0;
        this.searchPoint = 0;
      }
      return;
    }
    this.investigateLeft -= dt;
    this.awareness = Math.max(0, this.awareness - c.decayPerS * dt);
    if (
      this.state === 'searching'
        ? this.unseenS >= c.searchS
        : this.awareness < c.suspicion && this.investigateLeft <= 0
    ) {
      this.state = 'unaware';
      if (this.unseenS >= c.searchS) this.awareness = 0;
      this.lastKnown = undefined;
    }
  }
  movement(dt: number, position: Vec3): Vec3 | undefined {
    const arrived = (p: Vec3) =>
      Math.hypot(position.x - p.x, position.z - p.z) <= this.config.arrivalM;
    if (this.spawn.sentry || this.state === 'alerted') return;
    if (this.state !== 'unaware') {
      if (!this.lastKnown) return;
      const goal = { ...this.lastKnown };
      if (this.state === 'searching' && this.searchPoint > 0) {
        const angle = ((this.searchPoint - 1) * Math.PI) / 2;
        goal.x += this.config.searchRadiusM * Math.cos(angle);
        goal.z += this.config.searchRadiusM * Math.sin(angle);
      }
      if (!arrived(goal)) return goal;
      if (this.state === 'searching') this.searchPoint++;
      return;
    }
    const patrol = this.spawn.patrol;
    if (!patrol) return;
    if (this.waitLeft > 0) {
      this.waitLeft -= dt;
      return;
    }
    const point = patrol.points[this.waypoint]!;
    if (!arrived(point)) return point;
    this.waitLeft = patrol.waitS ?? 0;
    if (patrol.mode === 'pingpong' && patrol.points.length > 1) {
      if (this.waypoint === patrol.points.length - 1) this.direction = -1;
      else if (this.waypoint === 0) this.direction = 1;
    }
    this.waypoint =
      (this.waypoint + this.direction + patrol.points.length) %
      patrol.points.length;
    return;
  }
}
