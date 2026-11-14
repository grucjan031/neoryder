import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { createEnemy } from './registry';
import type { Enemy, EnemyDependencies } from './types';

export class EnemyManager {
  private enemies: Enemy[] = [];
  /** Numer spawnu w runie — źródło losowości AI niezależne od rosnących ID encji. */
  private sequence = 0;
  private readonly deps: EnemyDependencies;
  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    deps: EnemyDependencies,
  ) {
    this.deps = { ...deps, getNeighbors: () => this.enemies };
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
  }
  forEach(cb: (enemy: Enemy) => void): void {
    this.enemies.forEach(cb);
  }
  despawnAll(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.sequence = 0;
  }
  dispose(): void {
    this.despawnAll();
  }
}
