import { clearWorld } from './tactics';
import type { Rng } from '../core/rng';
import type { EnemyDefinition } from './enemySchema';
import type { Enemy, EnemyDependencies, EnemySnapshot } from './types';

type Config = NonNullable<EnemyDefinition['chimera']>;

export class ChimeraBehavior {
  private remainingS: number;
  private prey?: Enemy;
  private locked = false;
  private victim?: number;
  constructor(
    private readonly config: Config,
    private readonly rng: Rng,
    private readonly eyeHeight: number,
  ) {
    this.remainingS = this.stalkDuration();
  }
  private stalkDuration(): number {
    return this.config.stalkMinS + this.rng.float(0, this.config.stalkExtraS);
  }
  tick(dt: number, s: EnemySnapshot, deps: EnemyDependencies): void {
    if (s.state !== 'chase' && s.state !== 'idle') return;
    s.chimeraMode ??= 'stalk';
    this.remainingS -= dt;
    if (this.remainingS > 0) return;
    this.prey = undefined;
    if (s.chimeraMode !== 'stalk') {
      s.chimeraMode = 'stalk';
      this.remainingS = this.stalkDuration();
      return;
    }
    s.chimeraMode = 'sprint';
    this.remainingS = this.config.sprintS;
    if (!this.rng.chance(this.config.turncoatChance)) return;
    let nearest = this.config.preyRangeM;
    const eye = { ...s.position, y: s.position.y + this.eyeHeight };
    for (const enemy of deps.getNeighbors?.() ?? []) {
      if (
        enemy.removed ||
        enemy.current.state === 'dead' ||
        enemy.definition.kind === 'chimera' ||
        !this.config.preyIds.includes(enemy.definition.id)
      )
        continue;
      const p = enemy.current.position;
      const distance = Math.hypot(
        p.x - s.position.x,
        p.y - s.position.y,
        p.z - s.position.z,
      );
      if (distance > nearest) continue;
      const center = { ...p, y: p.y + (enemy.definition.body?.centerY ?? 0) };
      if (clearWorld(deps, eye, center)) {
        nearest = distance;
        this.prey = enemy;
      }
    }
  }
  get friendlyStrike(): boolean {
    return !!this.prey;
  }
  target(deps: EnemyDependencies): ReturnType<EnemyDependencies['getTarget']> {
    const p = this.prey;
    const target = p
      ? !p.removed && p.current.state !== 'dead'
        ? { id: p.id, position: p.current.position }
        : null
      : deps.getTarget();
    return this.locked && target?.id !== this.victim ? null : target;
  }
  transition(s: EnemySnapshot, deps: EnemyDependencies): void {
    if (s.state === 'telegraph') {
      this.victim = this.target(deps)?.id;
      this.locked = true;
      s.claw = this.rng.pick(['L', 'R', 'B'] as const);
    } else if (s.state !== 'swing') {
      this.locked = false;
      if (s.state === 'recovery' && this.rng.chance(this.config.lostChance)) {
        this.prey = undefined;
        s.chimeraMode = 'lost';
        this.remainingS = this.config.lostS;
      }
    }
  }
}
