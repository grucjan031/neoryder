import { Health } from '../combat/damage';
import type { DamageInfo } from '../combat/damage';
import { STUNNED } from '../combat/status/statusSystem';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { EnemyBody } from './enemyBody';
import type { BossPattern, EnemyDefinition } from './enemySchema';
import type {
  Enemy,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const epsilon = 1e-6;
const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});

/** Limit po redukcjach DamageSystem: nawet pojedyncze trafienie nie pomija fazy. */
class BossHealth extends Health {
  constructor(
    max: () => number,
    private readonly floor: () => number,
  ) {
    super(max);
  }
  override apply(info: Pick<DamageInfo, 'amount'>): number {
    return super.apply({
      amount: Math.min(info.amount, Math.max(0, this.current - this.floor())),
    });
  }
}

export class Boss implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  previous: EnemySnapshot;
  current: EnemySnapshot;
  removed = false;
  private readonly data;
  private readonly body: EnemyBody;
  private readonly health: Health;
  private readonly rng;
  private readonly projectiles;
  private readonly off: (() => void)[] = [];
  private phaseIndex = 0;
  private shiftS = 0;
  private pattern: BossPattern | null = null;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    private readonly deps: EnemyDependencies,
    readonly definition: EnemyDefinition,
    position: Vec3,
  ) {
    if (!definition.boss || !definition.body || !deps.projectiles)
      throw new Error('Boss wymaga danych boss, body i ProjectileSystem.');
    this.data = definition.boss;
    this.projectiles = deps.projectiles;
    this.rng = ctx.rng.fork('ai');
    this.id = deps.entities.create(definition.kind, 'enemy');
    this.stats = new Stats({
      maxHealth: definition.maxHealth,
      moveSpeed: definition.moveSpeed,
    });
    this.health = new BossHealth(
      () => this.stats.get('maxHealth'),
      () => this.nextThreshold(),
    );
    const spawn = {
      ...position,
      y: position.y + definition.body.controllerOffset,
    };
    this.current = {
      position: { ...spawn },
      yaw: 0,
      speed: 0,
      state: 'idle',
      stateTimeS: 0,
      distance: 0,
    };
    this.previous = copy(this.current);
    deps.damage.register(this.id, this.health, {
      stats: this.stats,
      invulnerable: () => this.shiftS > epsilon,
    });
    this.body = new EnemyBody(deps, this.id, definition.body, spawn);
    this.off.push(
      ctx.bus.on('damage_dealt', ({ target }) => {
        if (target !== this.id || this.health.dead) return;
        if (
          this.phaseIndex + 1 < this.data.phases.length &&
          this.health.current <= this.nextThreshold()
        )
          this.enterPhase(this.phaseIndex + 1);
      }),
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id === this.id) {
          this.pattern = null;
          this.transition('dead');
        }
      }),
    );
    ctx.bus.emit('boss_spawned', {
      id: this.id,
      name: this.data.name,
      maxHealth: this.health.max,
    });
  }

  get phase(): number {
    return this.phaseIndex + 1;
  }

  private nextThreshold(): number {
    return (
      (this.data.phases[this.phaseIndex + 1]?.hpThreshold ?? 0) *
      this.health.max
    );
  }

  private transition(state: EnemyState): void {
    this.current.state = state;
    this.current.stateTimeS = 0;
  }

  private enterPhase(index: number): void {
    const changed = index !== this.phaseIndex;
    this.phaseIndex = index;
    this.pattern = null;
    this.shiftS = this.ctx.tuning.enemies.phaseShiftS;
    this.transition(this.shiftS > epsilon ? 'recovery' : 'idle');
    if (changed)
      this.ctx.bus.emit('boss_phase', {
        id: this.id,
        phase: this.phase,
        phases: this.data.phases.length,
      });
  }

  setPhase(phase: number): boolean {
    if (
      this.removed ||
      this.health.dead ||
      !Number.isInteger(phase) ||
      phase < 1 ||
      phase > this.data.phases.length
    )
      return false;
    this.health.set(this.health.max * this.data.phases[phase - 1]!.hpThreshold);
    this.enterPhase(phase - 1);
    this.ctx.bus.emit('health_changed', {
      id: this.id,
      current: this.health.current,
      max: this.health.max,
    });
    return true;
  }

  private begin(): void {
    this.pattern = this.rng.pick(this.data.phases[this.phaseIndex]!.patterns);
    this.stats.setBase('damage', this.pattern.damage);
    this.transition('telegraph');
    this.ctx.bus.emit('enemy_telegraph', {
      id: this.id,
      kind: this.pattern.kind === 'slam' ? 'slam' : 'aim',
      durationS: this.pattern.telegraphS,
    });
  }

  private attack(): void {
    const pattern = this.pattern;
    const target = this.deps.getTarget();
    if (!pattern || !target) return;
    const p = this.current.position;
    if (pattern.kind === 'slam') {
      if (
        Math.hypot(
          target.position.x - p.x,
          target.position.y - p.y,
          target.position.z - p.z,
        ) <=
        pattern.radiusM + epsilon
      )
        this.deps.damage.deal(target.id, {
          source: this.id,
          amount: this.stats.get('damage'),
          tags: ['#melee', '#heavy'],
          point: { ...p },
        });
      return;
    }
    const m = this.data.muzzle;
    const yaw = this.current.yaw;
    const origin = {
      x: p.x + Math.cos(yaw) * m.x + Math.sin(yaw) * m.z,
      y: p.y + m.y,
      z: p.z - Math.sin(yaw) * m.x + Math.cos(yaw) * m.z,
    };
    const dx = target.position.x - origin.x,
      dz = target.position.z - origin.z;
    const center = Math.atan2(dx, dz);
    const pitch = Math.atan2(target.position.y - origin.y, Math.hypot(dx, dz));
    for (let i = 0; i < pattern.projectileCount; i++) {
      const offset =
        pattern.projectileCount === 1
          ? 0
          : i / (pattern.projectileCount - 1) - 0.5;
      const angle = center + (offset * pattern.spreadDeg * Math.PI) / 180;
      this.projectiles.spawn({
        owner: this.id,
        team: 'enemy',
        origin,
        dir: {
          x: Math.sin(angle) * Math.cos(pitch),
          y: Math.sin(pitch),
          z: Math.cos(angle) * Math.cos(pitch),
        },
        speed: pattern.projectileSpeed,
        damage: this.stats.get('damage'),
        lifetimeS: pattern.projectileLifetimeS,
        tags: ['#gun'],
      });
    }
    this.current.shotTimeS = 0;
  }

  step(dt: number): void {
    if (this.removed) return;
    this.previous = copy(this.current);
    if (!(dt > 0)) return;
    const s = this.current;
    s.stateTimeS += dt;
    s.speed = 0;
    if (s.shotTimeS !== undefined) s.shotTimeS += dt;
    if (s.state === 'dead') {
      if (s.stateTimeS + epsilon >= this.ctx.tuning.enemies.corpseS)
        this.dispose();
      return;
    }
    let vx = 0,
      vz = 0;
    if (this.shiftS > epsilon) {
      this.shiftS = Math.max(0, this.shiftS - dt);
      if (this.shiftS <= epsilon) this.transition('idle');
    } else if (this.deps.statuses?.has(this.id, STUNNED)) {
      this.pattern = null;
      if (s.state !== 'stunned') this.transition('stunned');
    } else {
      const target = this.deps.getTarget();
      if (!target) {
        this.pattern = null;
        this.transition('idle');
      } else {
        const dx = target.position.x - s.position.x,
          dz = target.position.z - s.position.z;
        const distance = Math.hypot(dx, dz);
        const yaw = Math.atan2(dx, dz);
        const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
        const turn = ((this.definition.turnRateDegS * Math.PI) / 180) * dt;
        s.yaw += Math.max(-turn, Math.min(turn, delta));
        if (s.state === 'stunned') this.transition('idle');
        if (s.state === 'idle' || s.state === 'chase') {
          if (distance <= this.definition.attackRange) this.begin();
          else {
            this.transition('chase');
            const speed = Math.min(this.stats.get('moveSpeed'), distance / dt);
            vx = (dx / distance) * speed;
            vz = (dz / distance) * speed;
          }
        } else if (
          s.state === 'telegraph' &&
          this.pattern &&
          s.stateTimeS + epsilon >= this.pattern.telegraphS
        ) {
          this.transition('swing');
          this.attack();
        } else if (
          s.state === 'swing' &&
          s.stateTimeS + epsilon >= this.definition.swingActiveS
        )
          this.transition('recovery');
        else if (
          s.state === 'recovery' &&
          this.pattern &&
          s.stateTimeS + epsilon >= this.pattern.recoveryS
        )
          this.transition('cooldown');
        else if (
          s.state === 'cooldown' &&
          this.pattern &&
          s.stateTimeS + epsilon >= this.pattern.cooldownS
        ) {
          this.pattern = null;
          this.transition('idle');
        }
      }
    }
    const movement = this.body.move(dt, vx, vz, this.ctx.tuning);
    s.position = movement.position;
    s.speed = movement.distance / dt;
    s.distance += movement.distance;
  }

  dispose(): void {
    if (this.removed) return;
    this.removed = true;
    for (const off of this.off.splice(0)) off();
    this.deps.hurtboxes.removeEntity(this.id);
    this.deps.damage.unregister(this.id);
    this.deps.entities.destroy(this.id);
    this.body.dispose();
  }
}
