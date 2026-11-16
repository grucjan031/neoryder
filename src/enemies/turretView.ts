import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { BufferGeometry } from 'three';
import { getMaterial } from '../render/materials';
import { AimLaser } from './aimLaser';
import type { Enemy } from './types';

export class TurretView {
  readonly root = new Group();
  private readonly head = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly laser: AimLaser;

  constructor(private readonly enemy: Enemy) {
    const body = enemy.definition.body!;
    const muzzle = enemy.definition.muzzle!;
    const baseGeometry = new CylinderGeometry(
      body.radius,
      body.radius * 1.4,
      body.centerY,
      8,
    );
    const headGeometry = new BoxGeometry(
      body.headRadius * 2,
      body.headRadius,
      body.headRadius * 2,
    );
    const barrelGeometry = new BoxGeometry(
      body.headRadius * 0.4,
      body.headRadius * 0.4,
      muzzle.z,
    );
    this.geometries.push(baseGeometry, headGeometry, barrelGeometry);
    const base = new Mesh(baseGeometry, getMaterial('enemy'));
    base.name = 'base';
    base.position.y = body.centerY / 2;
    const head = new Mesh(headGeometry, getMaterial('enemy'));
    head.name = 'head';
    head.position.y = muzzle.y;
    const barrel = new Mesh(barrelGeometry, getMaterial('enemyGlow'));
    barrel.name = 'barrel';
    barrel.position.set(muzzle.x, muzzle.y, muzzle.z / 2);
    this.head.name = 'turretHead';
    this.head.add(head, barrel);
    this.laser = new AimLaser(enemy, body.headRadius * 0.04);
    this.head.add(this.laser.mesh);
    this.root.add(base, this.head);
  }

  render(alpha: number): void {
    const { previous: a, current: b } = this.enemy;
    const t = Math.max(0, Math.min(1, alpha));
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    this.head.rotation.y = a.yaw + delta * t;
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    this.laser.render(this.head);
  }

  dispose(): void {
    this.laser.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
