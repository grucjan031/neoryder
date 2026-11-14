import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import type { Weapon } from '../combat/weapons/weapon';
import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';

export class BeamRenderer {
  readonly root = new Group();
  private readonly geometry = new CylinderGeometry(1, 1, 1, 8);
  private readonly mesh = new Mesh(this.geometry, getMaterial('player'));
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor() {
    this.root.add(this.mesh);
    this.mesh.visible = false;
  }

  render(beam: Weapon['beam'], from: Vec3 | undefined = beam?.from): void {
    this.mesh.visible = beam?.active ?? false;
    if (!beam?.active || !from) return;
    this.direction.set(
      beam.to.x - from.x,
      beam.to.y - from.y,
      beam.to.z - from.z,
    );
    const length = this.direction.length();
    this.mesh.position.set(
      (from.x + beam.to.x) / 2,
      (from.y + beam.to.y) / 2,
      (from.z + beam.to.z) / 2,
    );
    this.mesh.scale.set(tuning.vfx.beamRadiusM, length, tuning.vfx.beamRadiusM);
    if (length > 0)
      this.mesh.quaternion.setFromUnitVectors(
        this.up,
        this.direction.divideScalar(length),
      );
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
  }
}
