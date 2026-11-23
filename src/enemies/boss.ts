import { deathDirection, deathDuration } from './enemyDeath';
import { arrivalSpeed, updateBodyPose } from './locomotion';
import { Health } from '../combat/damage';
import type { DamageInfo } from '../combat/damage';
import { STUNNED } from '../combat/status/statusSystem';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { EnemyBody } from './enemyBody';
import type {
  BossPattern,
  EnemyDefinition,
  ShieldPattern,
  SummonPattern,
} from './enemySchema';
import type {
  Enemy,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const epsilon = 1e-6;
const POWER_TAG = '#power';
/** Cheaty debug (kill all, hit) przechodzą przez tarczę, żeby dało się przejść progi faz. */
const DEBUG_TAG = '#debug';
/** Obrażenia zadawane sługom w chwili śmierci bossa. */
const BOSS_DEATH_TAG = '#boss_death';
const VULNERABLE_SOURCE = 'boss:vulnerable';
const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});

type BossMinion = Pick<Enemy, 'id' | 'removed'> & {
  current: Pick<EnemySnapshot, 'state'>;
};
type BossDependencies =
  | EnemyDependencies
  | (Pick<
      EnemyDependencies,
      | 'entities'
      | 'damage'
      | 'hurtboxes'
      | 'getTarget'
      | 'statuses'
      | 'spawnModifiers'
    > & {
      world?: never;
      projectiles: Pick<
        NonNullable<EnemyDependencies['projectiles']>,
        'spawn' | 'addInterceptor'
      >;
      spawnEnemy?(id: string, position: Vec3): BossMinion;
      spawnPoints?: readonly Vec3[];
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
  private readonly body: EnemyBody | null;
  private readonly health: Health;
  private readonly rng;
  private readonly projectiles;
  private readonly off: (() => void)[] = [];
  private phaseIndex = 0;
  private shiftS = 0;
  private pattern: BossPattern | null = null;
  private minions: BossMinion[] = [];
  /** Pociski wystrzelone przez bossa; po odbiciu zdejmują wytrzymałość tarczy. */
  private readonly ownShots = new Set<number>();
  private reflectedHit = false;
  /** Odbity pocisk przeszedł guard bez tarczy; kontra otwiera się po przyjęciu obrażeń. */
  private counterPending = false;
  private shieldHp = 0;
  private shieldTimeS = 0;
  private shieldPattern: ShieldPattern | null = null;
  private stunS = 0;
  private vulnerableS = 0;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    private readonly deps: BossDependencies,
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
    for (const mod of deps.spawnModifiers ?? []) this.stats.add(mod);
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
      guard: (info) => this.guard(info),
    });
    this.body = deps.world
      ? new EnemyBody(deps, this.id, definition.body, spawn)
      : null;
    this.off.push(
      ctx.bus.on('damage_dealt', ({ target }) => {
        if (target !== this.id || this.health.dead) {
          this.counterPending = false;
          return;
        }
        const pending = this.counterPending;
        this.counterPending = false;
        if (
          this.phaseIndex + 1 < this.data.phases.length &&
          this.health.current <= this.nextThreshold()
        )
          this.enterPhase(this.phaseIndex + 1);
        else if (pending && this.vulnerableS <= epsilon)
          this.openReflectCounter();
      }),
      ctx.bus.on('enemy_killed', ({ id, dir, tags }) => {
        if (id === this.id) {
          this.setPattern(null);
          this.resetShield();
          this.body?.disableCollision();
          this.current.death = {
            dir: deathDirection(dir),
            durationS: deathDuration(tags, ctx.tuning.enemies),
          };
          this.transition('dead');
          this.killMinions();
        }
      }),
      ctx.bus.on('entity_despawned', ({ id }) => this.ownShots.delete(id)),
      this.projectiles.addInterceptor((hit) => {
        this.reflectedHit =
          hit.target === this.id &&
          hit.owner !== this.id &&
          this.ownShots.has(hit.projectile);
        return false;
      }),
    );
    ctx.bus.emit('boss_spawned', {
      id: this.id,
      name: this.data.name,
      maxHealth: this.health.max,
      phaseThresholds: this.data.phases
        .slice(1)
        .map((phase) => phase.hpThreshold),
    });
  }

  get phase(): number {
    return this.phaseIndex + 1;
  }

  /** Pozostała wytrzymałość tarczy (0 = brak tarczy). */
  get shield(): number {
    return this.shieldHp;
  }

  /** Liczba żywych sług wezwanych przez bossa. */
  get minionCount(): number {
    this.minions = this.minions.filter(
      (m) => !m.removed && m.current.state !== 'dead',
    );
    return this.minions.length;
  }

  private nextThreshold(): number {
    return (
      (this.data.phases[this.phaseIndex + 1]?.hpThreshold ?? 0) *
      this.health.max
    );
  }

  /** Wzorzec trafia też do snapshotu, żeby widok dopasował animację do czasów ataku. */
  private setPattern(pattern: BossPattern | null): void {
    this.pattern = pattern;
    this.current.field = undefined;
    this.current.attack = pattern
      ? {
          kind: pattern.kind,
          telegraphS: pattern.telegraphS,
          recoveryS: pattern.recoveryS,
        }
      : undefined;
  }

  private transition(state: EnemyState): void {
    this.current.state = state;
    this.current.stateTimeS = 0;
  }

  private enterPhase(index: number): void {
    const changed = index !== this.phaseIndex;
    this.phaseIndex = index;
    this.setPattern(null);
    this.resetShield();
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

  private eligible(pattern: BossPattern): boolean {
    if (pattern.kind === 'gridHack') return this.teleportMarkers().length > 0;
    if (pattern.kind === 'summon')
      return !!this.deps.spawnEnemy && this.minionCount < pattern.maxMinions;
    if (pattern.kind === 'shield')
      return this.shieldHp <= 0 && this.vulnerableS <= epsilon;
    return true;
  }

  private begin(): void {
    const patterns = this.data.phases[this.phaseIndex]!.patterns.filter((p) =>
      this.eligible(p),
    );
    if (patterns.length === 0) return;
    this.startPattern(this.rng.pick(patterns));
  }

  private startPattern(pattern: BossPattern): void {
    this.setPattern(pattern);
    this.current.field = this.prepareField(pattern);
    this.stats.setBase('damage', pattern.damage);
    this.transition('telegraph');
    this.ctx.bus.emit('enemy_telegraph', {
      id: this.id,
      kind: pattern.kind === 'fan' ? 'aim' : pattern.kind,
      durationS: pattern.telegraphS,
    });
  }

  private prepareField(pattern: BossPattern): EnemySnapshot['field'] {
    if (pattern.kind !== 'laser' && pattern.kind !== 'gridHack') return;
    const target = this.deps.getTarget();
    if (!target) return;
    const p = this.current.position;
    const center = {
      ...target.position,
      y: p.y - this.definition.body!.controllerOffset,
    };
    if (pattern.kind === 'laser') {
      center.y += pattern.heightM;
      return {
        kind: 'laser',
        center,
        yaw: Math.atan2(center.x - p.x, center.z - p.z),
        halfLengthM: pattern.halfLengthM,
        radiusM: pattern.radiusM,
      };
    }
    // Znacznik najdalej od gracza i nie bliżej niż suma promieni kapsuł.
    const clearance =
      this.ctx.tuning.player.capsuleRadius + this.definition.body!.radius;
    const distance = (m: Vec3) =>
      Math.hypot(m.x - target.position.x, m.z - target.position.z);
    const best = this.teleportMarkers()
      .filter((m) => distance(m) >= clearance)
      .reduce<Vec3 | undefined>(
        (a, m) => (!a || distance(m) > distance(a) ? m : a),
        undefined,
      );
    return {
      kind: 'gridHack',
      center,
      radiusM: pattern.radiusM,
      destination: best
        ? { ...best }
        : { ...p, y: p.y - this.definition.body!.controllerOffset },
    };
  }

  private teleportMarkers(): Vec3[] {
    const p = this.current.position;
    return (this.deps.spawnPoints ?? []).filter(
      (point) =>
        Math.hypot(point.x - p.x, point.z - p.z) > this.definition.body!.radius,
    );
  }

  /** Debug: natychmiast zaczyna wzorzec danego rodzaju (z bieżącej fazy, w razie braku z dowolnej). */
  forcePattern(kind: BossPattern['kind']): boolean {
    if (
      this.removed ||
      this.health.dead ||
      this.shiftS > epsilon ||
      this.stunS > epsilon
    )
      return false;
    const pattern =
      this.data.phases[this.phaseIndex]!.patterns.find(
        (p) => p.kind === kind,
      ) ??
      this.data.phases
        .flatMap((phase) => phase.patterns)
        .find((p) => p.kind === kind);
    if (!pattern || !this.eligible(pattern)) return false;
    this.startPattern(pattern);
    return true;
  }

  private summon(pattern: SummonPattern): void {
    const spawn = this.deps.spawnEnemy;
    if (!spawn) return;
    const count = Math.min(
      pattern.count,
      pattern.maxMinions - this.minionCount,
    );
    for (const point of this.summonPoints(pattern, count))
      this.minions.push(spawn(pattern.enemyId, point));
  }

  private summonPoints(
    pattern: SummonPattern,
    count: number,
  ): { x: number; y: number; z: number }[] {
    const base = this.deps.spawnPoints;
    if (pattern.placement === 'spawnPoints' && base && base.length > 0)
      return this.rng
        .shuffle([...base])
        .slice(0, Math.max(0, count))
        .map((point) => ({ ...point }));
    const origin = this.current.position;
    const y = origin.y - this.definition.body!.controllerOffset;
    const start = this.rng.float(0, Math.PI * 2);
    return Array.from({ length: Math.max(0, count) }, (_, i) => {
      const angle = start + (i * Math.PI * 2) / count;
      return {
        x: origin.x + Math.sin(angle) * pattern.radiusM,
        y,
        z: origin.z + Math.cos(angle) * pattern.radiusM,
      };
    });
  }

  private killMinions(): void {
    for (const minion of this.minions.splice(0))
      if (!minion.removed && minion.current.state !== 'dead')
        this.deps.damage.deal(minion.id, {
          source: null,
          amount: Number.MAX_VALUE,
          tags: [BOSS_DEATH_TAG],
        });
  }

  private raiseShield(pattern: ShieldPattern): void {
    this.shieldPattern = pattern;
    this.shieldHp = pattern.durability;
    this.shieldTimeS = pattern.durationS;
    this.current.shieldUp = true;
    this.emitShield();
  }

  /** Tarcza zeruje obrażenia; wytrzymałość tracą tylko #power i odbite pociski bossa. */
  private guard(info: DamageInfo): number {
    const reflected = this.reflectedHit;
    this.reflectedHit = false;
    if (this.shieldHp <= 0 || info.tags.includes(DEBUG_TAG)) {
      this.counterPending =
        reflected &&
        !!this.data.counterOnReflect &&
        this.vulnerableS <= epsilon;
      return 1;
    }
    if (info.tags.includes(POWER_TAG) || reflected) {
      this.shieldHp = Math.max(0, this.shieldHp - info.amount);
      this.emitShield();
      if (this.shieldHp <= 0) this.breakShield();
    }
    return 0;
  }

  private breakShield(): void {
    const pattern = this.shieldPattern;
    this.resetShield();
    if (!pattern) return;
    const feel = this.ctx.tuning.enemies;
    this.openCounter(
      pattern.stunS,
      pattern.vulnerableS,
      pattern.vulnerableMult,
    );
    this.ctx.bus.emit('hitstop', { ms: feel.shieldBreakHitstopMs });
    this.ctx.bus.emit('camera_shake', {
      intensity: feel.shieldBreakShake,
      durationS: feel.shieldBreakShakeS,
      dir: null,
    });
  }

  private openReflectCounter(): void {
    const { reflectCounterS, reflectCounterMult } = this.ctx.tuning.enemies;
    this.openCounter(reflectCounterS, reflectCounterS, reflectCounterMult);
  }

  private openCounter(
    stunS: number,
    vulnerableS: number,
    multiplier: number,
  ): void {
    this.stunS = stunS;
    this.vulnerableS = vulnerableS;
    this.stats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: multiplier,
      source: VULNERABLE_SOURCE,
    });
    this.setPattern(null);
    this.transition('stunned');
    this.ctx.bus.emit('enemy_stunned', { id: this.id, durationS: stunS });
  }

  /** Zdejmuje tarczę, ogłuszenie i okno zwiększonych obrażeń. */
  private resetShield(): void {
    const wasActive = this.shieldHp > 0;
    this.shieldHp = 0;
    this.shieldTimeS = 0;
    this.shieldPattern = null;
    this.stunS = 0;
    this.vulnerableS = 0;
    this.stats.removeBySource(VULNERABLE_SOURCE);
    this.current.shieldUp = false;
    if (wasActive) this.emitShield();
  }

  private emitShield(): void {
    this.ctx.bus.emit('boss_shield', {
      id: this.id,
      current: this.shieldHp,
      max: this.shieldPattern?.durability ?? 0,
    });
  }

  private tickShield(dt: number): void {
    if (this.shieldHp > 0) {
      this.shieldTimeS -= dt;
      if (this.shieldTimeS <= epsilon) {
        this.shieldHp = 0;
        this.shieldPattern = null;
        this.current.shieldUp = false;
        this.emitShield();
      }
    }
    if (this.vulnerableS > 0) {
      this.vulnerableS = Math.max(0, this.vulnerableS - dt);
      if (this.vulnerableS <= epsilon) {
        this.vulnerableS = 0;
        this.stats.removeBySource(VULNERABLE_SOURCE);
      }
    }
  }

  private strikeField(
    pattern: Extract<BossPattern, { kind: 'laser' | 'gridHack' }>,
    target: NonNullable<ReturnType<EnemyDependencies['getTarget']>>,
  ): void {
    const field = this.current.field;
    if (!field) return;
    const dx = target.position.x - field.center.x;
    const dz = target.position.z - field.center.z;
    if (field.kind === 'laser') {
      const player = this.ctx.tuning.player;
      const height = target.height ?? player.capsuleHeight;
      const dy = Math.abs(target.position.y - field.center.y);
      const along = dx * Math.sin(field.yaw) + dz * Math.cos(field.yaw);
      const across = dx * Math.cos(field.yaw) - dz * Math.sin(field.yaw);
      const distance = Math.hypot(
        Math.max(0, Math.abs(along) - field.halfLengthM),
        Math.max(0, dy - (height / 2 - player.capsuleRadius)),
        across,
      );
      if (distance <= player.capsuleRadius + field.radiusM)
        this.deps.damage.deal(target.id, {
          source: this.id,
          amount: this.stats.get('damage'),
          tags: ['#laser', '#heavy'],
        });
    } else if (pattern.kind === 'gridHack') {
      if (Math.hypot(dx, dz) <= field.radiusM)
        this.deps.damage.deal(target.id, {
          source: this.id,
          amount: this.stats.get('damage'),
          tags: ['#hack'],
          statuses: [{ id: 'jammed', durationS: pattern.jamS }],
        });
      const feet = {
        ...field.destination,
        y: field.destination.y + this.definition.body!.controllerOffset,
      };
      this.body?.teleport(feet);
      this.current.position = feet;
      this.previous.position = { ...feet };
    }
  }

  private attack(): void {
    const pattern = this.pattern;
    if (!pattern) return;
    if (pattern.kind === 'summon') return this.summon(pattern);
    if (pattern.kind === 'shield') return this.raiseShield(pattern);
    const target = this.deps.getTarget();
    if (!target) return;
    const p = this.current.position;
    if (pattern.kind === 'laser' || pattern.kind === 'gridHack')
      return this.strikeField(pattern, target);
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
      const shot = this.projectiles.spawn({
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
      this.ownShots.add(shot);
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
      if (
        s.stateTimeS + epsilon >=
        Math.max(
          this.ctx.tuning.enemies.corpseS,
          s.death ? s.death.durationS + dt : 0,
        )
      )
        this.dispose();
      return;
    }
    this.reflectedHit = false;
    this.counterPending = false;
    this.tickShield(dt);
    let vx = 0,
      vz = 0;
    if (this.shiftS > epsilon) {
      this.shiftS = Math.max(0, this.shiftS - dt);
      if (this.shiftS <= epsilon) this.transition('idle');
    } else if (this.stunS > epsilon) {
      this.stunS = Math.max(0, this.stunS - dt);
      this.setPattern(null);
      if (this.stunS <= epsilon) this.transition('idle');
      else if (s.state !== 'stunned') this.transition('stunned');
    } else if (this.deps.statuses?.has(this.id, STUNNED)) {
      this.setPattern(null);
      if (s.state !== 'stunned') this.transition('stunned');
    } else {
      const target = this.deps.getTarget();
      if (!target) {
        this.setPattern(null);
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
            if (s.state !== 'chase') this.transition('chase');
            const braking =
              this.ctx.tuning.enemies.brakingMps2 *
              (this.definition.body?.locomotionScale ?? 1);
            const speed = Math.min(
              this.stats.get('moveSpeed'),
              arrivalSpeed(distance - this.definition.attackRange, braking, dt),
            );
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
          this.setPattern(null);
          this.transition('idle');
        }
      }
    }
    if (this.body) {
      const movement = this.body.move(dt, vx, vz, this.ctx.tuning);
      s.position = movement.position;
      s.speed = movement.distance / dt;
      s.distance += movement.distance;
      updateBodyPose(
        this.previous,
        s,
        this.definition.turnRateDegS,
        dt,
        this.ctx.tuning.enemies,
      );
    }
  }

  dispose(): void {
    if (this.removed) return;
    this.removed = true;
    for (const off of this.off.splice(0)) off();
    this.deps.hurtboxes.removeEntity(this.id);
    this.deps.damage.unregister(this.id);
    this.deps.entities.destroy(this.id);
    this.body?.dispose();
  }
}
