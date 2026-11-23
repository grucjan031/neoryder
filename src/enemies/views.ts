import type { Object3D } from 'three';
import {
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
} from 'three';
import { DroneView } from './droneView';
import { EnemyView } from './enemyView';
import { TurretView } from './turretView';
import type { Enemy } from './types';
import type { EventBus } from '../core/events';

export interface EnemyViewLike {
  readonly root: Object3D;
  render(alpha: number, frameDt?: number): void;
  setExecutable?(ready: boolean, frameDt: number, pulseHz: number): void;
  dispose(): void;
}

/** Widok dla archetypu: dron ma własną bryłę, humanoidy — model GLB z bryłami zastępczymi. */
export function createEnemyView(
  enemy: Enemy,
  loadModels = true,
  bus?: EventBus,
): EnemyViewLike {
  const view =
    enemy.definition.kind === 'turret'
      ? new TurretView(enemy, loadModels)
      : enemy.definition.kind === 'drone' || enemy.definition.kind === 'hacker'
        ? new DroneView(enemy, loadModels, bus)
        : new EnemyView(enemy, loadModels, bus);
  const geometry = new RingGeometry(0.16, 0.21, 4);
  const red = new Color(0xff3028);
  const white = new Color(0xffd8bd);
  const material = new MeshBasicMaterial({
    color: red,
    side: DoubleSide,
    toneMapped: false,
  });
  const marker = new Mesh(geometry, material);
  marker.name = 'executeMarker';
  marker.position.y = enemy.definition.body
    ? enemy.definition.body.centerY + enemy.definition.body.height / 2 + 0.3
    : (enemy.definition.drone?.radiusM ?? 0) + 0.3;
  marker.visible = false;
  const parentRotation = new Quaternion();
  const cameraRotation = new Quaternion();
  marker.onBeforeRender = (_renderer, _scene, camera) => {
    view.root.getWorldQuaternion(parentRotation);
    camera.getWorldQuaternion(cameraRotation);
    marker.quaternion.copy(parentRotation.invert()).multiply(cameraRotation);
    marker.updateMatrixWorld();
  };
  view.root.add(marker);
  let ageS = 0;
  const disposeView = view.dispose.bind(view);
  // Znacznik dopinamy do tej samej instancji: wywołujący (i testy) widzą DroneView/EnemyView.
  return Object.assign(view, {
    setExecutable: (ready: boolean, frameDt: number, pulseHz: number) => {
      marker.visible = ready && enemy.current.state !== 'dead';
      if (!marker.visible) {
        ageS = 0;
        return;
      }
      ageS += Math.max(0, frameDt);
      const pulse = (1 + Math.sin(ageS * pulseHz * Math.PI * 2)) / 2;
      material.color.copy(red).lerp(white, pulse);
      marker.scale.setScalar(1 + pulse * 0.15);
    },
    dispose: () => {
      marker.removeFromParent();
      geometry.dispose();
      material.dispose();
      disposeView();
    },
  });
}
