import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';
import { dot, normalize, sub } from '../../core/math';
import { PowerBase } from './power';
import type { ConePowerDefinition } from './powerSchema';

interface PendingSlam {
  target: EntityId;
  remainingS: number;
  point: Vec3;
  dir: Vec3;
}

export class ConePower extends PowerBase<ConePowerDefinition> {
  private readonly pending: PendingSlam[] = [];

  protected override stepEffect(dt: number): void {
    this.stepSlams(dt);
  }

  protected override resetEffect(): void {
    this.pending.length = 0;
  }

  protected override activate(): number {
    const { owner } = this.deps;
    this.deps.bus.emit('camera_shake', {
      intensity: this.deps.tuning.powers.pushShake,
      durationS: this.def.shakeDurationS,
      dir: null,
    });

    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const cosHalf = Math.cos(((this.def.coneAngleDeg / 2) * Math.PI) / 180);
    let hits = 0;
    for (const target of this.deps.targets()) {
      const to = sub(target.position, origin);
      const distance = Math.hypot(to.x, to.y, to.z);
      if (distance > this.def.range || distance < 1e-6) continue;
      const away = normalize(to);
      if (this.def.coneAngleDeg < 360 && dot(away, forward) < cosHalf) continue;
      // Odrzut głównie poziomy, lekko w górę — czytelny lot.
      const push = normalize({
        x: away.x,
        y: Math.max(this.def.knockbackLift, away.y),
        z: away.z,
      });
      const dealt = this.deps.damage.deal(target.id, {
        amount: this.def.damage,
        source: owner,
        tags: this.def.tags,
        point: target.position,
        dir: push,
        knockback: this.def.knockback,
      });
      if (
        dealt <= 0 &&
        !this.deps.damage.canDamage(owner, target.id, this.def.tags)
      )
        continue;
      hits++;
      const flat = normalize({ x: push.x, y: 0, z: push.z });
      const wall = this.deps.castWall(
        target.position,
        flat,
        this.def.wallSlamRange,
      );
      if (wall !== null && this.def.knockback > 0)
        this.pending.push({
          target: target.id,
          remainingS: wall / this.def.knockback,
          point: {
            x: target.position.x + flat.x * wall,
            y: target.position.y,
            z: target.position.z + flat.z * wall,
          },
          dir: flat,
        });
    }
    if (hits > 0)
      this.deps.bus.emit('hitstop', {
        ms: this.deps.tuning.powers.pushHitstopMs,
      });
    return hits;
  }

  private stepSlams(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const slam = this.pending[i] as PendingSlam;
      slam.remainingS -= dt;
      if (slam.remainingS > 0) continue;
      this.pending.splice(i, 1);
      this.deps.damage.deal(slam.target, {
        amount: this.def.wallSlamDamage,
        source: this.deps.owner,
        tags: [...this.def.tags, '#wall'],
        point: slam.point,
        dir: slam.dir,
      });
    }
  }
}
