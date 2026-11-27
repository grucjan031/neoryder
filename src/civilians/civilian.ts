import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { Health } from '../combat/damage';
import type { Stats } from '../core/stats';
import type { CivilianDefinition } from './civilianSchema';

export interface CivilianSnapshot {
  id: EntityId;
  definition: string;
  variant: number;
  position: Vec3;
  yaw: number;
  hp: number;
  state: 'idle' | 'fleeing' | 'crouching' | 'dead';
  reactionS: number;
  hideSpot: Vec3 | null;
  deathS: number;
  fallDirection: Vec3;
  fallHeightM: number;
}

export interface CivilianEnvironment {
  visible(from: Vec3, to: Vec3): boolean;
  reserve(from: Vec3, player: Vec3): Vec3 | null;
  next(from: Vec3, to: Vec3): Vec3;
  move(from: Vec3, delta: Vec3): Vec3;
  panicked(id: EntityId): void;
}

/** Wyłącznie symulacja. Snapshot zawiera cały stan zachowania, bez obiektów renderu. */
export class Civilian {
  readonly current: CivilianSnapshot;
  previous: CivilianSnapshot;

  constructor(
    id: EntityId,
    readonly definition: CivilianDefinition,
    position: Vec3,
    yaw: number,
    variant: number,
    private readonly health: Health,
    private readonly stats: Stats,
    private readonly params: Tuning['civilians'],
    private readonly env: CivilianEnvironment,
  ) {
    this.current = {
      id,
      definition: definition.id,
      variant,
      position: { ...position },
      yaw,
      hp: health.current,
      state: 'idle',
      reactionS: 0,
      hideSpot: null,
      deathS: 0,
      fallDirection: { x: 0, y: 0, z: -1 },
      fallHeightM: params.bodyHeightM,
    };
    this.previous = this.snapshot();
  }

  kill(dir: Vec3 | null): boolean {
    const s = this.current;
    if (s.state === 'dead') return false;
    s.fallHeightM =
      s.state === 'crouching'
        ? this.params.crouchHeightM
        : this.params.bodyHeightM;
    s.state = 'dead';
    s.hp = 0;
    const x = dir?.x ?? Math.sin(s.yaw),
      z = dir?.z ?? Math.cos(s.yaw);
    const length = Math.hypot(x, z);
    s.fallDirection =
      length > 0
        ? { x: x / length, y: 0, z: z / length }
        : { x: Math.sin(s.yaw), y: 0, z: Math.cos(s.yaw) };
    return true;
  }

  step(dt: number, player: Vec3 | null): void {
    this.previous = this.snapshot();
    if (!(dt > 0)) return;
    const s = this.current;
    s.hp = this.health.current;
    if (s.state === 'dead') {
      s.deathS = Math.min(this.params.fallDurationS, s.deathS + dt);
      return;
    }
    if (s.state === 'crouching') return;
    if (s.state === 'idle') {
      if (!player || !this.sees(player)) {
        s.reactionS = 0;
        return;
      }
      s.reactionS += dt;
      if (s.reactionS < this.definition.reactionS) return;
      s.state = 'fleeing';
      this.env.panicked(s.id);
    }
    if (!s.hideSpot && player)
      s.hideSpot = this.env.reserve(s.position, player);
    if (!s.hideSpot) return;
    if (
      Math.hypot(
        s.hideSpot.x - s.position.x,
        s.hideSpot.y - s.position.y,
        s.hideSpot.z - s.position.z,
      ) <= this.params.arrivalM
    ) {
      s.state = 'crouching';
      return;
    }
    const goal = this.env.next(s.position, s.hideSpot);
    const dx = goal.x - s.position.x,
      dz = goal.z - s.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance === 0) return;
    const step = Math.min(distance, this.stats.get('moveSpeed') * dt);
    s.yaw = Math.atan2(dx, dz);
    s.position = this.env.move(s.position, {
      x: (dx / distance) * step,
      y: goal.y - s.position.y,
      z: (dz / distance) * step,
    });
  }

  snapshot(): CivilianSnapshot {
    const s = this.current;
    return {
      ...s,
      position: { ...s.position },
      hideSpot: s.hideSpot ? { ...s.hideSpot } : null,
      fallDirection: { ...s.fallDirection },
    };
  }

  private sees(player: Vec3): boolean {
    const s = this.current;
    const dx = player.x - s.position.x,
      dz = player.z - s.position.z;
    const dy = player.y - s.position.y;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > this.definition.visionRangeM) return false;
    const horizontal = Math.hypot(dx, dz);
    if (
      horizontal > 0 &&
      (dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw)) / horizontal <
        Math.cos((this.definition.visionAngleDeg * Math.PI) / 360)
    )
      return false;
    return this.env.visible(
      { ...s.position, y: s.position.y + this.params.eyeHeightM },
      { ...player, y: player.y + this.params.eyeHeightM },
    );
  }
}
