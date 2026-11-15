import { Color, Group, Mesh, SphereGeometry } from 'three';
import type { EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';

/** Magenta jest zarezerwowana dla Rezonansu (ADR 0006): tylko wybuchy z tagiem #power. */
const ELECTRIC = new Color('#fff1d6');
const FIRE = new Color('#ffb84d');

export class ExplosionRenderer {
  readonly root = new Group();
  private readonly geometry = new SphereGeometry(1, 12, 8);
  private readonly pool;
  private readonly off: () => void;
  private sequence = 0;
  private readonly powerColor = getMaterial('power').color.clone();

  constructor(bus: EventBus) {
    this.pool = Array.from(
      { length: Math.max(1, Math.floor(tuning.vfx.maxExplosions)) },
      () => {
        const material = getMaterial('power').clone();
        material.transparent = true;
        material.depthWrite = false;
        const mesh = new Mesh(this.geometry, material);
        mesh.visible = false;
        this.root.add(mesh);
        return { mesh, age: 0, radius: 0, order: -1 };
      },
    );
    this.off = bus.on('explosion', ({ point, radiusM, tags }) => {
      const slot =
        this.pool.find((p) => !p.mesh.visible) ??
        this.pool.reduce((a, b) => (a.order < b.order ? a : b));
      slot.age = 0;
      slot.radius = radiusM;
      slot.order = this.sequence++;
      slot.mesh.position.set(point.x, point.y, point.z);
      slot.mesh.scale.setScalar(0);
      slot.mesh.material.opacity = tuning.vfx.explosionOpacity;
      slot.mesh.material.color.copy(
        tags.includes('#power')
          ? this.powerColor
          : tags.includes('#elektrycznosc')
            ? ELECTRIC
            : FIRE,
      );
      slot.mesh.visible = true;
    });
  }

  render(frameDt: number): void {
    for (const slot of this.pool) {
      if (!slot.mesh.visible) continue;
      slot.age += Math.max(0, frameDt);
      const progress = Math.min(1, slot.age / tuning.vfx.explosionDurationS);
      slot.mesh.scale.setScalar(slot.radius * progress);
      slot.mesh.material.opacity = tuning.vfx.explosionOpacity * (1 - progress);
      slot.mesh.visible = progress < 1;
    }
  }

  dispose(): void {
    this.off();
    this.root.removeFromParent();
    this.root.clear();
    for (const slot of this.pool) slot.mesh.material.dispose();
    this.geometry.dispose();
  }
}
