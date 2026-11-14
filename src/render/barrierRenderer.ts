import {
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import type { BarrierPower } from '../combat/powers/barrier';
import type { Tuning } from '../core/tuning';
import type { CameraPose } from '../player/fpsCamera';

/** Płat przed kamerą: wyłącznie odczyt stanu symulacji. */
export class BarrierRenderer {
  readonly root = new Group();
  private readonly material = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly mesh = new Mesh(new CylinderGeometry(), this.material);
  private geometryKey = '';

  constructor(private readonly tuning: Tuning) {
    this.root.add(this.mesh);
    this.root.visible = false;
  }

  render(power: BarrierPower, pose: CameraPose): void {
    this.root.visible = power.active;
    if (!power.active) return;
    const vfx = this.tuning.vfx;
    const arc = (power.def.arcDeg * Math.PI) / 180;
    const key = [
      vfx.barrierRadiusM,
      vfx.barrierHeightM,
      vfx.barrierSegments,
      arc,
    ].join();
    if (key !== this.geometryKey) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new CylinderGeometry(
        vfx.barrierRadiusM,
        vfx.barrierRadiusM,
        vfx.barrierHeightM,
        Math.max(3, Math.floor(vfx.barrierSegments)),
        1,
        true,
        Math.PI - arc / 2,
        arc,
      );
      this.geometryKey = key;
    }
    this.root.position.copy(pose.position);
    this.root.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    this.mesh.position.z = -vfx.barrierDistanceM;
    this.material.color.set(this.tuning.render.player);
    const flash = Math.min(
      1,
      power.reflectionFlashS /
        Math.max(Number.EPSILON, this.tuning.powers.barrierFlashS),
    );
    this.material.opacity =
      vfx.barrierOpacity +
      flash * (vfx.barrierFlashOpacity - vfx.barrierOpacity);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
