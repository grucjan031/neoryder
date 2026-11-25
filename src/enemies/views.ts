import type { Object3D } from 'three';
import {
  AnimationUtils,
  MeshStandardMaterial,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
} from 'three';
import { DroneView } from './droneView';
import { EnemyView, loadEnemyModel } from './enemyView';
import { TurretView } from './turretView';
import type { Enemy } from './types';
import type { EventBus } from '../core/events';
import { perceptionView } from './perceptionView';

export interface EnemyViewLike {
  readonly root: Object3D;
  render(alpha: number, frameDt?: number): void;
  setExecutable?(ready: boolean, frameDt: number, pulseHz: number): void;
  dispose(): void;
}

/** Widok dla archetypu: dron ma własną bryłę, humanoidy — model GLB z bryłami zastępczymi. */
const preparedModels = new Set<string>();
function prepareHelixModel(name: string, telegraphS: number): void {
  if (preparedModels.has(name)) return;
  preparedModels.add(name);
  void loadEnemyModel(name).then((template) => {
    if (!template) return;
    template.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (node.name === 'case_glass')
        node.material = new MeshStandardMaterial({
          color: 0xbac2b4,
          transparent: true,
          opacity: 0.23,
          depthWrite: false,
        });
    });
    if (name === 'enemy_helix_medic') {
      const swing = template.animations.find(
        (clip) => clip.name === 'Sword_Attack',
      );
      if (!swing) return;
      // Zamach i wyrzut to kolejne odcinki jednego ruchu ramienia.
      const fps = 30,
        impact = Math.max(2, Math.round(swing.duration * fps * 0.52));
      const windup = AnimationUtils.subclip(
        swing,
        'Sword_Idle',
        0,
        impact + 1,
        fps,
      );
      const stretch = telegraphS / Math.max(windup.duration, 1 / fps);
      for (const track of windup.tracks) track.scale(stretch);
      windup.resetDuration();
      const release = AnimationUtils.subclip(
        swing,
        'Sword_Attack',
        impact,
        Math.ceil(swing.duration * fps) + 1,
        fps,
      );
      template.animations = template.animations
        .filter(
          (clip) => clip.name !== 'Sword_Idle' && clip.name !== 'Sword_Attack',
        )
        .concat(windup, release);
    }
  });
}

export function createEnemyView(
  enemy: Enemy,
  loadModels = true,
  bus?: EventBus,
): EnemyViewLike {
  if (loadModels && enemy.definition.model?.startsWith('enemy_helix_'))
    prepareHelixModel(enemy.definition.model, enemy.definition.telegraphS);
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
  const perception =
    enemy.perception && typeof document !== 'undefined'
      ? perceptionView(enemy, view.root, marker.position.y + 0.35)
      : undefined;
  const render = view.render.bind(view);
  // Znacznik dopinamy do tej samej instancji: wywołujący (i testy) widzą DroneView/EnemyView.
  return Object.assign(view, {
    ...(perception
      ? {
          render(alpha: number, frameDt?: number) {
            render(alpha, frameDt);
            perception.render();
          },
        }
      : {}),
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
      perception?.dispose();
      marker.removeFromParent();
      geometry.dispose();
      material.dispose();
      disposeView();
    },
  });
}
