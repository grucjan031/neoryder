import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { getMaterial } from '../render/materials';
import { droneFields } from './enemySchema';
import { loadEnemyModel } from './enemyView';
import { AimLaser } from './aimLaser';
import type { Enemy } from './types';

/**
 * Widok drona (F2-13): model GLB z `definition.model` (węzły `eye` i `rotor*`) albo,
 * przy braku modelu lub błędzie ładowania, bryła z prymitywów: korpus, oko z przodu (+Z), cztery wirniki.
 */
export class DroneView {
  readonly root = new Group();
  private readonly tilt = new Group();
  private eye: Object3D;
  private rotors: Object3D[] = [];
  private disposed = false;
  private readonly geometries: BufferGeometry[] = [];
  private readonly flight;
  private spin = 0;
  private readonly antenna = new Group();
  private readonly laser?: AimLaser;

  constructor(
    readonly enemy: Enemy,
    loadModels = true,
  ) {
    this.flight = droneFields.parse(enemy.definition.drone);
    const r = this.flight.radiusM;
    const hull = new OctahedronGeometry(r);
    const eye = new SphereGeometry(r * 0.3, 12, 8);
    const rotor = new CylinderGeometry(r * 0.45, r * 0.45, r * 0.06, 16);
    this.geometries.push(hull, eye, rotor);
    const body = new Mesh(hull, getMaterial('enemy'));
    body.name = 'hull';
    body.scale.y = 0.6;
    this.eye = new Mesh(eye, getMaterial('enemyGlow'));
    this.eye.name = 'eye';
    this.eye.position.z = r * 0.75;
    this.tilt.add(body, this.eye);
    for (const [x, z] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const mesh = new Mesh(rotor, getMaterial('enemy'));
      mesh.name = 'rotor';
      mesh.position.set(x * r * 1.1, r * 0.3, z * r * 1.1);
      this.rotors.push(mesh);
      this.tilt.add(mesh);
    }
    this.root.add(this.tilt);
    if (this.flight.antenna) {
      // Haker: maszt z ciemnym talerzem, pierścieniem nadajnika i świecącym czubkiem (bez konturu).
      const mast = new CylinderGeometry(r * 0.06, r * 0.1, r * 1.4, 6);
      const dish = new CylinderGeometry(r * 0.72, r * 0.3, r * 0.16, 12);
      const ring = new TorusGeometry(r * 0.62, r * 0.05, 4, 20);
      const tip = new OctahedronGeometry(r * 0.13);
      const fins = new BoxGeometry(r * 0.9, r * 0.05, r * 0.08);
      this.geometries.push(mast, dish, ring, tip, fins);
      const stem = new Mesh(mast, getMaterial('enemyDark'));
      stem.position.y = r;
      const disk = new Mesh(dish, getMaterial('enemy'));
      disk.position.y = r * 1.6;
      const halo = new Mesh(ring, getMaterial('enemyGlow'));
      halo.position.y = r * 1.72;
      halo.rotation.x = Math.PI / 2;
      const beacon = new Mesh(tip, getMaterial('enemyGlow'));
      beacon.position.y = r * 2.05;
      halo.userData.noOutline = true;
      beacon.userData.noOutline = true;
      const crossbar = new Mesh(fins, getMaterial('enemyDark'));
      crossbar.position.y = r * 1.25;
      this.antenna.name = 'antenna';
      this.antenna.add(stem, disk, halo, beacon, crossbar);
      this.tilt.add(this.antenna);
    }
    if (enemy.definition.laserSight) {
      this.laser = new AimLaser(enemy, r * 0.04);
      this.root.add(this.laser.mesh);
    }
    if (loadModels && enemy.definition.model)
      void loadEnemyModel(enemy.definition.model).then((source) => {
        const eye = source?.getObjectByName('eye');
        if (!source || !eye || this.disposed) return;
        const model = source.clone(true);
        const rotors: Object3D[] = [];
        model.traverse((node) => {
          if (node.name.startsWith('rotor')) rotors.push(node);
        });
        this.tilt.clear();
        this.tilt.add(model);
        if (this.flight.antenna) this.tilt.add(this.antenna);
        this.eye = model.getObjectByName('eye') ?? eye;
        this.rotors = rotors;
      });
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const { previous: a, current: b } = this.enemy;
    const t = Math.max(0, Math.min(1, alpha));
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    this.root.rotation.y = a.yaw + delta * t;
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    const stunned = b.state === 'stunned';
    this.tilt.rotation.z = stunned ? this.flight.stunTiltRad : 0;
    this.spin +=
      Math.PI * 2 * this.flight.rotorSpinHz * frameDt * (stunned ? 0.2 : 1);
    for (const rotor of this.rotors) rotor.rotation.y = this.spin;
    const pulse =
      b.state === 'aim'
        ? 1 +
          this.flight.pulseScale *
            (1 + Math.sin(b.stateTimeS * this.flight.pulseHz * Math.PI * 2))
        : 1;
    this.eye.scale.setScalar(pulse);
    this.laser?.render(this.root);
  }

  dispose(): void {
    this.disposed = true;
    this.laser?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
