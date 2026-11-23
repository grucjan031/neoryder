import { Quaternion, Vector3 } from 'three';
import type { Object3D } from 'three';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';

/** Nakładka widoku. Przywracamy pozę przed mikserem, także dla kości bez ścieżki animacji. */
export class EnemyFlinch {
  private readonly off?: () => void;
  private readonly applied: { node: Object3D; base: Quaternion }[] = [];
  private readonly axis = new Vector3();
  private readonly worldAxis = new Vector3();
  private readonly parentAxis = new Vector3();
  private readonly parentRotation = new Quaternion();
  private readonly rotation = new Quaternion();
  private elapsed = 0;
  private dir: Vec3 | null = null;
  private strength = 0;
  headshot = false;

  constructor(id: EntityId, bus?: EventBus) {
    this.off = bus?.on('damage_dealt', (event) => {
      if (
        event.target !== id ||
        event.killed ||
        event.amount <= 0 ||
        event.tags.includes('#status')
      )
        return;
      this.elapsed = 0;
      this.dir = event.dir;
      this.strength = Math.min(
        1,
        event.amount / tuning.vfx.enemyFlinchReferenceDamage,
      );
      this.headshot = event.headshot === true;
    });
  }

  sample(dt: number, yaw: number): number {
    if (!this.strength) return 0;
    const { enemyFlinchDurationS, enemyFlinchDecay } = tuning.vfx;
    this.elapsed += Math.max(0, dt);
    const u = this.elapsed / enemyFlinchDurationS;
    if (!(u < 1)) {
      this.strength = 0;
      return 0;
    }
    this.setDirection(this.dir, yaw);
    const peak = Math.atan2(Math.PI, enemyFlinchDecay) / Math.PI;
    return (
      ((this.strength * Math.sin(Math.PI * u)) / Math.sin(Math.PI * peak)) *
      Math.exp(-enemyFlinchDecay * (u - peak))
    );
  }

  setDirection(dir: Vec3 | null, yaw: number): void {
    const x = dir?.x ?? 0;
    const z = dir?.z ?? 0;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    if (Math.hypot(x, z) > Number.EPSILON) {
      this.axis.set(x * s + z * c, 0, z * s - x * c).normalize();
    } else this.axis.set(-1, 0, 0);
    this.worldAxis.set(
      this.axis.x * c + this.axis.z * s,
      0,
      this.axis.z * c - this.axis.x * s,
    );
  }

  get pitch(): number {
    return this.axis.x;
  }
  get roll(): number {
    return this.axis.z;
  }

  apply(node: Object3D | undefined, radians: number): void {
    if (!node || !radians) return;
    this.applied.push({ node, base: node.quaternion.clone() });
    this.parentAxis.copy(this.worldAxis);
    if (node.parent)
      this.parentAxis.applyQuaternion(
        node.parent.getWorldQuaternion(this.parentRotation).invert(),
      );
    node.quaternion.premultiply(
      this.rotation.setFromAxisAngle(this.parentAxis, radians),
    );
  }

  restore(): void {
    for (const { node, base } of this.applied) node.quaternion.copy(base);
    this.applied.length = 0;
  }

  dispose(): void {
    this.off?.();
  }
}
