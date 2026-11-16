import { Ray } from '@dimforge/rapier3d-compat';
import type { Vec3 } from '../core/math';
import { CollisionGroup, interactionGroups } from '../physics';
import { Drone } from './drone';

/** Lot i tokeny Drona, pojedyncza wiązka zamiast pocisków. */
export class Hacker extends Drone {
  private hackWaitS = 0;

  override step(dt: number): void {
    if (dt > 0) this.hackWaitS = Math.max(0, this.hackWaitS - dt);
    super.step(dt);
  }

  protected override engage(): boolean {
    return this.hackWaitS <= 1e-6 && super.engage();
  }
  protected override get aimTelegraphS(): number {
    return this.definition.hack!.hackTelegraphS;
  }

  protected override get cooldownS(): number {
    return this.definition.hack!.hackCooldownS;
  }

  protected override onDamage(): void {
    if (this.current.state === 'aim') {
      this.hackWaitS = this.cooldownS;
      this.transition('cooldown');
    }
  }

  protected override fire(target: Vec3): void {
    this.hackWaitS = this.cooldownS;
    const origin = this.muzzle();
    const distance = Math.hypot(
      target.x - origin.x,
      target.y - origin.y,
      target.z - origin.z,
    );
    if (distance <= 1e-6) return;
    const dir = {
      x: (target.x - origin.x) / distance,
      y: (target.y - origin.y) / distance,
      z: (target.z - origin.z) / distance,
    };
    const hit = this.deps.world.castRay(
      new Ray(origin, dir),
      this.definition.attackRange,
      true,
      undefined,
      interactionGroups(
        CollisionGroup.Enemy,
        CollisionGroup.World | CollisionGroup.Player,
      ),
      undefined,
      undefined,
      (collider) =>
        !collider.isSensor() ||
        this.deps.hurtboxes.get(collider.handle) !== undefined,
    );
    const box = hit && this.deps.hurtboxes.get(hit.collider.handle);
    const player = this.deps.getTarget();
    if (box && box.entity === player?.id)
      this.deps.damage.deal(box.entity, {
        source: this.id,
        amount: this.stats.get('damage'),
        tags: ['#hack'],
        point: target,
        dir,
        statuses: [
          { id: 'jammed', durationS: this.definition.hack!.durationS },
        ],
      });
    this.current.shotTimeS = 0;
  }
}
