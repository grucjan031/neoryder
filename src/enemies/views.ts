import type { Object3D } from 'three';
import { DroneView } from './droneView';
import { EnemyView } from './enemyView';
import type { Enemy } from './types';

export interface EnemyViewLike {
  readonly root: Object3D;
  render(alpha: number, frameDt?: number): void;
  dispose(): void;
}

/** Widok dla archetypu: dron ma własną bryłę, humanoidy — model GLB z bryłami zastępczymi. */
export function createEnemyView(
  enemy: Enemy,
  loadModels = true,
): EnemyViewLike {
  return enemy.definition.kind === 'drone'
    ? new DroneView(enemy, loadModels)
    : new EnemyView(enemy, loadModels);
}
