import { Group, Quaternion } from 'three';
import type { Object3D } from 'three';
import type { ScatterProps } from '../world/scatterProps';

/** Rysuje wywracalne dekoracje: osobne modele (jak w statycznej dekoracji), poza scalonym batchem. */
export class ScatterRenderer {
  readonly root = new Group();
  private readonly from = new Quaternion();
  private readonly to = new Quaternion();

  /** `objects[i]` odpowiada dekoracji o indeksie `i` w `ScatterProps` (model z początkiem w środku podstawy). */
  constructor(
    private readonly system: ScatterProps,
    private readonly objects: readonly Object3D[],
  ) {
    this.root.name = 'scatter-props';
    for (const object of objects) this.root.add(object);
  }

  render(alpha: number): void {
    const a = Math.max(0, Math.min(1, alpha));
    this.system.forEach((index, view) => {
      const object = this.objects[index];
      if (!object || !view.moving) return;
      const p = view.previousPosition;
      const c = view.position;
      object.position.set(
        p.x + (c.x - p.x) * a,
        p.y + (c.y - p.y) * a,
        p.z + (c.z - p.z) * a,
      );
      this.from.set(
        view.previousQuat.x,
        view.previousQuat.y,
        view.previousQuat.z,
        view.previousQuat.w,
      );
      this.to.set(view.quat.x, view.quat.y, view.quat.z, view.quat.w);
      object.quaternion.copy(this.from.slerp(this.to, a));
    });
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
