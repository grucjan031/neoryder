import { CylinderGeometry, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { getMaterial } from '../render/materials';
import type { Enemy } from './types';

/** Linia w lokalnym układzie obrotowej głowicy lub drona. */
export class AimLaser {
  readonly mesh: Mesh;
  private readonly end = new Vector3();
  private readonly from = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor(
    private readonly enemy: Enemy,
    radius: number,
  ) {
    this.mesh = new Mesh(
      new CylinderGeometry(radius, radius, 1, 6, 1, true),
      getMaterial('enemyGlow'),
    );
    this.mesh.name = 'laser';
    this.mesh.userData.noOutline = true;
    this.mesh.visible = false;
  }

  render(parent: Object3D): void {
    const { current, definition } = this.enemy;
    const muzzle = definition.muzzle;
    this.mesh.visible = current.state === 'aim' && !!current.aim && !!muzzle;
    if (!this.mesh.visible || !current.aim || !muzzle) return;
    parent.updateWorldMatrix(true, false);
    this.end.set(current.aim.x, current.aim.y, current.aim.z);
    parent.worldToLocal(this.end);
    this.from.set(muzzle.x, muzzle.y, muzzle.z);
    this.end.sub(this.from);
    const length = this.end.length();
    if (length <= 1e-6) {
      this.mesh.visible = false;
      return;
    }
    // Wieżyczka pokazuje faktyczny kierunek głowicy, nie cel poza jej kątem obrotu.
    if (definition.stationary)
      this.end.set(0, this.end.y, Math.hypot(this.end.x, this.end.z));
    this.mesh.position.copy(this.from).addScaledVector(this.end, 0.5);
    this.mesh.quaternion.setFromUnitVectors(this.up, this.end.normalize());
    this.mesh.scale.y = length;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}
