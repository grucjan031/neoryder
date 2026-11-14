import { Ray } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { GrabTarget } from '../combat/powers/grabTypes';
import { CollisionGroup, interactionGroups } from '../physics';
import { EnemyDirector } from './director';
import type { DirectorConfig } from './director';
import { createEnemy } from './registry';
import type { Enemy, EnemyDependencies } from './types';

export interface EnemyManagerOptions {
  /** Dane `director` sceny; bez nich wrogowie atakują bez koordynacji (F1). */
  director?: DirectorConfig;
}

export class EnemyManager {
  private enemies: Enemy[] = [];
  /** Numer spawnu w runie — źródło losowości AI niezależne od rosnących ID encji. */
  private sequence = 0;
  private readonly deps: EnemyDependencies;
  readonly director: EnemyDirector | null;
  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    deps: EnemyDependencies,
    options: EnemyManagerOptions = {},
  ) {
    this.director = options.director
      ? new EnemyDirector(ctx.bus, options.director, {
          target: () => deps.getTarget(),
          position: (id) => this.position(id),
          clear: (from, to) => {
            const dx = to.x - from.x,
              dy = to.y - from.y,
              dz = to.z - from.z;
            const length = Math.hypot(dx, dy, dz);
            if (length <= 1e-6) return true;
            return (
              deps.world.castRay(
                new Ray(from, {
                  x: dx / length,
                  y: dy / length,
                  z: dz / length,
                }),
                length,
                true,
                undefined,
                interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
              ) === null
            );
          },
        })
      : null;
    this.deps = {
      ...deps,
      getNeighbors: () => this.enemies,
      ...(this.director ? { director: this.director } : {}),
    };
  }
  private position(id: EntityId): Vec3 | null {
    for (const enemy of this.enemies)
      if (enemy.id === id && !enemy.removed) return enemy.current.position;
    return null;
  }
  spawn(id: string, position: Vec3): Enemy {
    const rng = this.ctx.rng.fork(`spawn:${this.sequence++}`);
    const enemy = createEnemy({ ...this.ctx, rng }, this.deps, id, position);
    this.enemies.push(enemy);
    return enemy;
  }
  step(dt: number): void {
    for (const enemy of this.enemies) enemy.step(dt);
    this.enemies = this.enemies.filter((enemy) => !enemy.removed);
    this.director?.step(dt);
  }
  forEach(cb: (enemy: Enemy) => void): void {
    this.enemies.forEach(cb);
  }
  grabTargets(): GrabTarget[] {
    return this.enemies.flatMap((enemy) => {
      if (enemy.removed || enemy.current.state === 'dead') return [];
      const target = enemy.grabTarget?.();
      return target ? [target] : [];
    });
  }
  captureControlled(): void {
    for (const enemy of this.enemies) enemy.syncControlled?.();
  }
  despawnAll(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.sequence = 0;
    this.director?.reset();
  }
  dispose(): void {
    this.despawnAll();
    this.director?.dispose();
  }
}
