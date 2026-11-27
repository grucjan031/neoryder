import type { ProjectileSystem } from '../combat/weapons/projectiles';
import type { World } from '@dimforge/rapier3d-compat';
import type { DamageSystem, Hurtboxes } from '../combat/damage';
import type { StatusQuery } from '../combat/status/statusSystem';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { StatModifier } from '../core/stats';
import type { EnemyDirectorApi } from './director';
import type { EnemyDefinition } from './enemySchema';
import type { GrabTarget } from '../combat/powers/grabTypes';
import type { DifficultyProfile } from '../world/difficulty';

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
  bodyYaw?: number;
  lean?: number;
  speed: number;
  state: EnemyState;
  stateTimeS: number;
  distance: number;
  shotTimeS?: number;
  shieldUp?: boolean;
  controlled?: boolean;
  /** Punkt celowania podczas aim/burst (linia lasera Snajpera). */
  aim?: Vec3;
  /** Boss: bieżący wzorzec ataku (czasy dla animacji); brak poza atakiem. */
  attack?: { kind: string; telegraphS: number; recoveryS: number };
  field?:
    | {
        kind: 'laser';
        center: Vec3;
        yaw: number;
        halfLengthM: number;
        radiusM: number;
      }
    | { kind: 'gridHack'; center: Vec3; radiusM: number; destination: Vec3 };
  /**
   * Ogłuszenie z mocnego odrzutu (`knockback >= stunKnockback`): kierunek przewrócenia w świecie
   * (poziomy, jednostkowy) i odsunięcie modelu oraz hurtboxów od ściany.
   */
  knockdown?: { x: number; z: number; retreatM?: number };
  death?: { dir: Vec3; durationS: number };
}
export interface EnemyCarry {
  speedMultiplier: number;
  defendRangeM: number;
}
export interface Enemy {
  perception?: import('./perception').Perception;
  /** Bieżący cel taktyczny (debug i testy symulacji). */
  tacticalGoal?: Vec3;
  moveGoal?: Vec3;
  /** false, gdy `moveGoal` jest węzłem pośrednim trasy (bez hamowania i zatrzymania). */
  moveGoalFinal?: boolean;
  routeToPlayer?: boolean;
  setCarry?(carry: EnemyCarry | null): void;
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
  los?(from: Vec3, to: Vec3): boolean;
  vulnerableToBlade?(source: EntityId | null): boolean;
  difficulty?: DifficultyProfile;
  /** ADR 0011: autostep po schodach tylko na dużych arenach z nawigacją powierzchni; w pokojach i testach wyłączony. */
  stepClimbing?: boolean;
  transitWaypoint?(id: EntityId): Vec3 | undefined;
  platformFloors?: readonly import('../physics/platformMotion').MovingPlatform[];
  targetForward?(): Vec3;
  projectiles?: ProjectileSystem;
  world: World;
  entities: EntityRegistry;
  damage: DamageSystem;
  hurtboxes: Hurtboxes;
  getTarget(): {
    crouched?: boolean;
    velocity?: Vec3;
    id: EntityId;
    position: Vec3;
    yaw?: number;
    height?: number;
  } | null;
  /**
   * Cel konkretnego wroga (drużyna gracza: gracz albo sojusznik). Gdy podane, `EnemyManager`
   * daje każdemu wrogowi własne `getTarget`; `id` jest null w trakcie konstrukcji wroga.
   */
  getTargetFor?(enemy: { id: EntityId | null; position: Vec3 }): {
    id: EntityId;
    position: Vec3;
    yaw?: number;
    height?: number;
  } | null;
  getNeighbors?(): readonly Enemy[];
  getLocalNeighbors?(): readonly Enemy[];
  /** F2-12: tokeny ataku i sloty flankowania; bez dyrektora wróg atakuje jak w F1. */
  director?: EnemyDirectorApi;
  /** F3-17: tworzy wroga (EnemyManager.spawn); dla wezwań bossa. */
  spawnEnemy?(id: string, position: Vec3): Enemy;
  /** F3-17: punkty spawnu pokoju (y = 0) dla wezwań bossa. */
  spawnPoints?: readonly Vec3[];
  /** F2-02: status 'stunned' ogłusza wroga na czas trwania statusu. */
  statuses?: StatusQuery &
    Partial<
      Pick<import('../combat/status/statusSystem').StatusSystem, 'apply'>
    >;
  medicFog?: import('./medic').MedicFog;
  /** F4-05: modyfikatory Poziomu zagrożenia nakładane na Stats przy konstrukcji wroga (przed utworzeniem Health). */
  spawnModifiers?: readonly StatModifier[];
}
