import {
  CylinderGeometry,
  Group,
  Mesh,
  OctahedronGeometry,
  SphereGeometry,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { getMaterial } from '../render/materials';
import { droneFields } from './enemySchema';
import { loadEnemyModel } from './enemyView';
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
  }

  dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
