import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import type { GrabBeam } from '../combat/powers/grab';
import type { Tuning } from '../core/tuning';

/** Render czyta snapshot wiązki; położenie dłoni jest wyłącznie kosmetyczne. */
export class GrabRenderer {
  readonly root = new Group();
  private readonly positions = new Float32Array(6);
  private readonly geometry = new BufferGeometry();
  private readonly material = new LineBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  private readonly line = new Line(this.geometry, this.material);
  private readonly hand = new Vector3();

  constructor(private readonly tuning: Tuning) {
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.positions, 3),
    );
    this.line.frustumCulled = false;
    this.line.name = 'grab-beam';
    this.line.visible = false;
    this.root.add(this.line);
  }

  render(
    beam: Readonly<GrabBeam> | null,
    alpha: number,
    camera?: Camera,
  ): void {
    this.line.visible = beam !== null;
    if (!beam) return;
    const t = this.tuning.vfx;
    const { previous, current } = beam;
    this.hand.set(
      previous.from.x + (current.from.x - previous.from.x) * alpha,
      previous.from.y + (current.from.y - previous.from.y) * alpha,
      previous.from.z + (current.from.z - previous.from.z) * alpha,
    );
    if (camera) {
      this.hand
        .set(t.grabHandSideM, -t.grabHandDownM, -t.grabHandForwardM)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
    }
    this.positions.set([
      this.hand.x,
      this.hand.y,
      this.hand.z,
      previous.to.x + (current.to.x - previous.to.x) * alpha,
      previous.to.y + (current.to.y - previous.to.y) * alpha,
      previous.to.z + (current.to.z - previous.to.z) * alpha,
    ]);
    this.geometry.getAttribute('position').needsUpdate = true;
    this.material.color.set(t.grabBeamColor);
    this.material.opacity = t.grabBeamOpacity;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
