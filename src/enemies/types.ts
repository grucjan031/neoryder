import type { ProjectileSystem } from '../combat/weapons/projectiles';
import type { World } from '@dimforge/rapier3d-compat';
import type { DamageSystem, Hurtboxes } from '../combat/damage';
import type { StatusQuery } from '../combat/status/statusSystem';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { EnemyDirectorApi } from './director';
import type { EnemyDefinition } from './enemySchema';
import type { GrabTarget } from '../combat/powers/grabTypes';

export type EnemyState =
  | 'idle'
  | 'chase'
  | 'telegraph'
  | 'swing'
  | 'recovery'
  | 'reposition'
  | 'aim'
  | 'burst'
  | 'cooldown'
  | 'stunned'
  | 'dead';
export interface EnemySnapshot {
  position: Vec3;
  yaw: number;
  speed: number;
  state: EnemyState;
  stateTimeS: number;
  distance: number;
  shotTimeS?: number;
  shieldUp?: boolean;
  controlled?: boolean;
  /** Punkt celowania podczas aim/burst (linia lasera Snajpera). */
  aim?: Vec3;
}
export interface Enemy {
  readonly id: EntityId;
  readonly definition: EnemyDefinition;
  readonly previous: EnemySnapshot;
  readonly current: EnemySnapshot;
  readonly removed: boolean;
  grabTarget?(): GrabTarget;
  syncControlled?(): void;
  step(dt: number): void;
  dispose(): void;
}
export interface EnemyDependencies {
  projectiles?: ProjectileSystem;
  world: World;
  entities: EntityRegistry;
  damage: DamageSystem;
  hurtboxes: Hurtboxes;
  getTarget(): { id: EntityId; position: Vec3 } | null;
  getNeighbors?(): readonly Enemy[];
  /** F2-12: tokeny ataku i sloty flankowania; bez dyrektora wróg atakuje jak w F1. */
  director?: EnemyDirectorApi;
  /** F3-17: tworzy wroga (EnemyManager.spawn); dla wezwań bossa. */
  spawnEnemy?(id: string, position: Vec3): Enemy;
  /** F3-17: punkty spawnu pokoju (y = 0) dla wezwań bossa. */
  spawnPoints?: readonly Vec3[];
  /** F2-02: status 'stunned' ogłusza wroga na czas trwania statusu. */
  statuses?: StatusQuery;
}
