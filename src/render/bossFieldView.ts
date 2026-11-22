import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import type { Enemy } from '../enemies/types';
import { getMaterial } from './materials';
import text from '../data/ui/bossTest.pl.json';

/** Znaczniki rozgrywki pozostają widoczne również w trybie fx=lite. */
export class BossFieldView {
  readonly root = new Group();
  private readonly material = new MeshBasicMaterial({
    color: getMaterial('enemyGlow').color,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly laser = new Mesh(
    new CylinderGeometry(1, 1, 2, 8),
    this.material,
  );
  private readonly ring = new Mesh(
    new RingGeometry(0.94, 1, 48),
    this.material,
  );
  private readonly marker = new Mesh(
    new RingGeometry(0.67, 1, 4),
    this.material,
  );

  constructor() {
    this.laser.rotation.set(Math.PI / 2, 0, 0, 'YXZ');
    this.ring.rotation.x = this.marker.rotation.x = -Math.PI / 2;
    this.root.add(this.laser, this.ring, this.marker);
  }

  render(enemy: Enemy | undefined, slideHeight: number): string {
    const state = enemy?.current;
    const warning = state?.state === 'telegraph';
    const field =
      warning || state?.state === 'swing' ? state?.field : undefined;
    this.laser.visible = field?.kind === 'laser';
    this.ring.visible = this.marker.visible = field?.kind === 'gridHack';
    this.material.opacity = warning
      ? 0.45 + 0.55 * Math.min(1, state.stateTimeS / state.attack!.telegraphS)
      : 1;
    if (field?.kind === 'laser') {
      this.laser.position.copy(field.center);
      this.laser.rotation.y = field.yaw;
      this.laser.scale.set(field.radiusM, field.halfLengthM, field.radiusM);
      // Wysokość wiązki względem podłogi bossa, nie współrzędna świata.
      const floorY =
        state!.position.y - enemy!.definition.body!.controllerOffset;
      return field.center.y - floorY > slideHeight
        ? text.laserHigh
        : text.laserLow;
    }
    if (field?.kind === 'gridHack') {
      this.ring.position.copy(field.center);
      this.ring.position.y += 0.04;
      this.ring.scale.setScalar(field.radiusM);
      this.marker.position.copy(field.destination);
      this.marker.position.y += 0.04;
      this.marker.scale.setScalar(enemy!.definition.body!.radius * 2);
      return text.gridHack;
    }
    if (state?.state === 'stunned') return text.counter;
    const kind = warning && state.attack?.kind;
    return kind === 'fan' || kind === 'summon' ? text[kind] : '';
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const mesh of [this.laser, this.ring, this.marker])
      mesh.geometry.dispose();
    this.material.dispose();
  }
}
