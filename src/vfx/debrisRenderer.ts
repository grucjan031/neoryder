import {
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  TetrahedronGeometry,
} from 'three';
import { getMaterial } from '../render/materials';
import type { DebrisSystem } from './debris';

export class DebrisRenderer {
  readonly root: InstancedMesh;
  private readonly geometry = new TetrahedronGeometry(1, 0);
  private readonly transform = new Object3D();

  constructor(private readonly system: DebrisSystem) {
    this.root = new InstancedMesh(
      this.geometry,
      getMaterial('enemy'),
      system.maxDebris,
    );
    this.root.count = 0;
    this.root.frustumCulled = false;
    this.root.instanceMatrix.setUsage(DynamicDrawUsage);
  }

  render(alpha = 1): void {
    let count = 0;
    this.system.forEachActive((pos, quat, scale) => {
      this.transform.position.set(pos.x, pos.y, pos.z);
      this.transform.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      this.transform.scale.set(scale.x, scale.y, scale.z);
      this.transform.updateMatrix();
      this.root.setMatrixAt(count++, this.transform.matrix);
    }, alpha);
    this.root.count = count;
    this.root.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.dispose();
    this.geometry.dispose();
  }
}
