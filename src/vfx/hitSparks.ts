import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { makeInstance, ParticlePool } from './fxPool';
import type { FxInstance } from './fxPool';

export const HIT_SPARK_CYAN = 0x00e5ff;
export const HIT_SPARK_RED = 0xe0262b;

export interface HitSparksOptions {
  /** Identyfikator gracza: jego trafienia są cyan, trafienia w niego czerwone. */
  playerId: EntityId;
  /** Pozycja kamery gracza; iskry trafień w gracza zbyt blisko niej są pomijane. */
  cameraPosition?(): Vec3 | null;
  tuning: Pick<Tuning, 'vfx'>;
}

const rand = (): number => Math.random();
const scratch = makeInstance();

/** Krótki rozprysk iskier w punkcie trafienia (kosmetyka, osobna pula, bez wpływu na symulację). */
export class HitSparks {
  private readonly pool: ParticlePool;
  private readonly off: () => void;
  private readonly offParry: () => void;
  private readonly offWall: () => void;

  constructor(
    bus: EventBus,
    private readonly opts: HitSparksOptions,
  ) {
    this.pool = new ParticlePool(opts.tuning.vfx.maxHitSparks);
    this.off = bus.on('damage_dealt', (event) => {
      if (
        !event.point ||
        (event.tags.includes('#wall') && event.tags.includes('#hazard'))
      )
        return;
      if (event.source === opts.playerId && event.target !== opts.playerId)
        this.burst(event.point, event.dir, HIT_SPARK_CYAN);
      else if (event.target === opts.playerId && event.source !== opts.playerId)
        this.burstAtPlayer(event.point, event.dir);
    });
    this.offParry = bus.on('melee_parried', ({ defender, point }) => {
      if (defender === opts.playerId)
        this.burst(
          point,
          null,
          HIT_SPARK_CYAN,
          opts.tuning.vfx.parrySparkCount,
        );
    });
    this.offWall = bus.on('enemy_wall_slam', ({ point, normal }) =>
      this.burst(point, normal, HIT_SPARK_RED),
    );
  }

  get count(): number {
    return this.pool.count;
  }

  /** Czerwone iskry trafienia w gracza; pomijane, gdy punkt leży w kamerze. */
  private burstAtPlayer(point: Vec3, dir: Vec3 | null): void {
    const camera = this.opts.cameraPosition?.();
    if (
      camera &&
      Math.hypot(point.x - camera.x, point.y - camera.y, point.z - camera.z) <
        this.opts.tuning.vfx.hitSparkCameraMinM
    )
      return;
    this.burst(point, dir, HIT_SPARK_RED);
  }

  burst(
    point: Vec3,
    dir: Vec3 | null,
    color: number,
    count = this.opts.tuning.vfx.hitSparkCount,
  ): void {
    const t = this.opts.tuning.vfx;
    const length = dir ? Math.hypot(dir.x, dir.y, dir.z) : 0;
    for (let i = 0; i < count; i++) {
      const p = this.pool.spawn(t.hitSparkLifeS * (0.7 + rand() * 0.6));
      const speed = t.hitSparkSpeedMS * (0.6 + rand() * 0.8);
      p.x = point.x;
      p.y = point.y;
      p.z = point.z;
      p.vx = (rand() - 0.5) * 2 * t.hitSparkSpreadMS;
      p.vy = (rand() - 0.5) * 2 * t.hitSparkSpreadMS;
      p.vz = (rand() - 0.5) * 2 * t.hitSparkSpreadMS;
      if (dir && length > 0) {
        p.vx += (dir.x / length) * speed;
        p.vy += (dir.y / length) * speed;
        p.vz += (dir.z / length) * speed;
      }
      p.size = 0.7 + rand() * 0.6;
      p.color = color;
    }
  }

  update(dt: number): void {
    this.pool.step(dt, this.opts.tuning.vfx.hitSparkGravity);
  }

  forEach(cb: (instance: FxInstance) => void): void {
    const t = this.opts.tuning.vfx;
    const i = scratch;
    for (const p of this.pool.particles) {
      if (p.life === 0) continue;
      const k = 1 - p.age / p.life;
      i.x = p.x;
      i.y = p.y;
      i.z = p.z;
      i.sx = i.sz = t.hitSparkWidthM * (0.5 + k);
      i.sy = t.hitSparkLengthM * p.size * k;
      i.dx = p.vx;
      i.dy = p.vy;
      i.dz = p.vz;
      i.roll = 0;
      i.color = p.color;
      cb(i);
    }
  }

  clear(): void {
    this.pool.clear();
  }

  dispose(): void {
    this.off();
    this.offParry();
    this.offWall();
    this.pool.clear();
  }
}
