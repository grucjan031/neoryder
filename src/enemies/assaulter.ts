import type { GrabTarget } from '../combat/powers/grabTypes';
import { Cuboid } from '@dimforge/rapier3d-compat';
import {
  Health,
  Hitbox,
  PIERCE_BLOCK_TAG,
  queryHurtboxes,
} from '../combat/damage';
import type { DamageInfo } from '../combat/damage';
import { STUNNED } from '../combat/status/statusSystem';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';
import type { EnemyDefinition } from './enemySchema';
import { EnemyBody } from './enemyBody';
import { clearWorld, playerThreatens } from './tactics';
import type {
  Enemy,
  EnemyCarry,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});
// Rapier przechowuje pozycje w float32.
const epsilon = 1e-6;

/** Pozycja spawnu i snapshotów oznacza stopy; świat krokuje właściciel managera. */
export class Assaulter implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  previous: EnemySnapshot;
  current: EnemySnapshot;
  removed = false;
  moveGoal?: Vec3;
  tacticalGoal?: Vec3;
  private tacticS = 0;
  private flanking = false;
  private tacticRetryS = 0;
  private carry: EnemyCarry | null = null;
  private readonly body: EnemyBody;
  private readonly off: (() => void)[] = [];
  private readonly geometry;
  private readonly rng;
  private cooldown = 0;
  private stunS = 0;
  private shieldDownS = 0;
  private parryCooldownS = 0;
  private probeS = 0;
  private avoid = 0;
  private hitbox?: Hitbox;
  /** Token ataku wręcz od dyrektora (F2-12). */
  private token = false;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    private readonly deps: EnemyDependencies,
    readonly definition: EnemyDefinition,
    position: Vec3,
  ) {
    if (!definition.body) throw new Error('Szturmowiec wymaga danych body.');
    this.geometry = definition.body;
    this.id = deps.entities.create(definition.kind, 'enemy');
    // ctx.rng to strumień konkretnego spawnu (EnemyManager) — bez ID encji w etykiecie.
    this.rng = ctx.rng.fork('ai');
    this.stats = new Stats({
      maxHealth: definition.maxHealth,
      moveSpeed: definition.moveSpeed,
      damage: definition.damage,
    });
    for (const mod of deps.spawnModifiers ?? []) this.stats.add(mod);
    deps.damage.register(
      this.id,
      new Health(() => this.stats.get('maxHealth')),
      {
        stats: this.stats,
        ...(definition.shield || definition.parry
          ? { guard: (info: DamageInfo) => this.guard(info) }
          : {}),
      },
    );
    this.body = new EnemyBody(deps, this.id, this.geometry, position);
    this.current = {
      position: { ...position },
      yaw: 0,
      speed: 0,
      state: 'idle',
      stateTimeS: 0,
      distance: 0,
    };
    this.updateShield();
    this.previous = copy(this.current);
    this.off.push(
      ctx.bus.on('melee_swing', ({ attacker, stage }) => {
        const t = ctx.tuning.enemies;
        if (
          stage !== 'heavy' ||
          attacker !== deps.getTarget()?.id ||
          !['idle', 'chase', 'telegraph'].includes(this.current.state) ||
          this.current.controlled ||
          this.isStunned() ||
          !playerThreatens(
            deps,
            this.id,
            this.current.position,
            t.evadeRangeM,
            t.threatFacingDot,
          ) ||
          !this.rng.chance(deps.difficulty?.heavyDodgeChance ?? 0)
        )
          return;
        const target = deps.getTarget()!;
        const yaw = Math.atan2(
          this.current.position.x - target.position.x,
          this.current.position.z - target.position.z,
        );
        this.transition('chase');
        this.tacticalGoal = {
          x:
            this.current.position.x +
            Math.sin(yaw) * this.stats.get('moveSpeed') * t.evadeS,
          y: this.current.position.y,
          z:
            this.current.position.z +
            Math.cos(yaw) * this.stats.get('moveSpeed') * t.evadeS,
        };
        this.tacticS = t.evadeS;
        this.flanking = false;
      }),
      ctx.bus.on('damage_dealt', (event) => {
        if (
          event.target !== this.id ||
          this.current.state === 'dead' ||
          this.current.controlled ||
          event.killed
        )
          return;
        const target = deps.getTarget();
        const dir =
          event.dir ??
          (target?.id === event.source
            ? {
                x: this.current.position.x - target.position.x,
                y: 0,
                z: this.current.position.z - target.position.z,
              }
            : null);
        if (dir)
          this.body.knockback(
            dir,
            event.knockback * (1 - definition.knockbackResist),
          );
        const heavy = event.knockback >= ctx.tuning.enemies.stunKnockback;
        if (event.tags.includes(PIERCE_BLOCK_TAG) || heavy) {
          this.stunS = definition.stunOnHeavyS;
          this.transition('stunned');
          // Przewrócenie (tylko widok): kierunek odrzutu, czas i balans ogłuszenia bez zmian.
          const length = dir ? Math.hypot(dir.x, dir.z) : 0;
          if (heavy && dir && length > 1e-6)
            this.current.knockdown = { x: dir.x / length, z: dir.z / length };
          ctx.bus.emit('enemy_stunned', { id: this.id, durationS: this.stunS });
        }
      }),
      ctx.bus.on('melee_parried', ({ defender, attacker }) => {
        if (
          attacker !== this.id ||
          this.current.state === 'dead' ||
          this.current.controlled
        )
          return;
        const target = deps.getTarget();
        if (target?.id === defender)
          this.body.knockback(
            {
              x: this.current.position.x - target.position.x,
              y: 0,
              z: this.current.position.z - target.position.z,
            },
            ctx.tuning.melee.meleeParryKnockback *
              (1 - definition.knockbackResist),
          );
        this.stunS = ctx.tuning.melee.meleeParryStunS;
        this.transition('stunned');
        ctx.bus.emit('enemy_stunned', { id: this.id, durationS: this.stunS });
      }),
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id === this.id && this.current.state !== 'dead')
          this.transition('dead');
      }),
    );
  }

  private isStunned(): boolean {
    return (
      this.current.state === 'stunned' ||
      (this.deps.statuses?.has(this.id, STUNNED) ?? false)
    );
  }

  private updateShield(): void {
    if (this.definition.shield)
      this.current.shieldUp =
        this.shieldDownS <= epsilon &&
        !this.isStunned() &&
        this.current.state !== 'dead' &&
        !this.current.controlled &&
        !this.deps.statuses?.has(this.id, 'overload');
  }

  private guard(info: DamageInfo): number {
    if (info.tags.includes('#execute')) return 1;
    const { shield, parry } = this.definition;
    const heavy = info.tags.includes(PIERCE_BLOCK_TAG);
    this.updateShield();
    if (shield && this.current.shieldUp && info.dir) {
      const length = Math.hypot(info.dir.x, info.dir.y, info.dir.z);
      const dot =
        -info.dir.x * Math.sin(this.current.yaw) -
        info.dir.z * Math.cos(this.current.yaw);
      const front =
        length > 0 &&
        dot / length + epsilon >= Math.cos((shield.arcDeg * Math.PI) / 360);
      if (front && heavy) {
        this.shieldDownS = shield.downS;
        this.updateShield();
      } else if (
        front &&
        info.tags.some((tag) => shield.blocksTags.includes(tag))
      ) {
        this.blocked(info);
        return 0;
      }
    }
    if (
      parry &&
      !this.current.controlled &&
      !heavy &&
      info.tags.includes('#melee') &&
      this.parryCooldownS <= epsilon &&
      !this.isStunned() &&
      (this.current.state === 'idle' || this.current.state === 'chase')
    ) {
      this.parryCooldownS = parry.cooldownS;
      const target = this.deps.getTarget();
      if (target) {
        const dx = target.position.x - this.current.position.x;
        const dz = target.position.z - this.current.position.z;
        if (
          Math.hypot(dx, dz) <= this.definition.attackRange + epsilon &&
          this.engage(
            Math.hypot(dx, dz),
            this.definition.flankDistanceM ?? this.definition.attackRange,
          )
        ) {
          this.current.yaw = Math.atan2(dx, dz);
          this.transition('telegraph');
        }
      }
      this.blocked(info);
      return 0;
    }
    return 1;
  }

  private blocked(info: DamageInfo): void {
    this.ctx.bus.emit('melee_blocked', {
      defender: this.id,
      attacker: info.source,
      amount: info.amount,
    });
  }

  private transition(state: EnemyState): void {
    this.current.state = state;
    this.current.stateTimeS = 0;
    delete this.current.knockdown;
    this.hitbox = undefined;
    this.updateShield();
    // Token trzyma tylko zapowiedź i wymach; regeneracja po ciosie oddaje go następnemu.
    if (state !== 'telegraph' && state !== 'swing') this.releaseToken();
    if (state === 'telegraph')
      this.ctx.bus.emit('enemy_telegraph', {
        id: this.id,
        kind: this.definition.attackTags?.includes(PIERCE_BLOCK_TAG)
          ? 'heavy'
          : 'swing',
        durationS: this.definition.telegraphS,
      });
    if (state === 'swing')
      this.hitbox = new Hitbox({
        owner: this.id,
        team: 'enemy',
        damage: this.stats.get('damage'),
        tags: this.definition.attackTags ?? ['#melee'],
        lifetimeS: this.definition.swingActiveS,
      });
    if (state === 'recovery') this.cooldown = this.definition.cooldownS;
  }

  private releaseToken(): void {
    this.deps.director?.releaseToken(this.id);
    this.token = false;
  }

  /** Bez dyrektora zawsze true. Z dyrektorem: token prosi wróg w zasięgu krążenia + ciosu. */
  private engage(distance: number, flank: number, ready = false): boolean {
    if (this.tacticalGoal) {
      this.releaseToken();
      return false;
    }
    const director = this.deps.director;
    if (!director) return true;
    // Gracz poza zasięgiem krążenia + ciosu albo cios się odnawia: token wraca do kolejki,
    // wróg wraca do slotu (po ataku odstępuje, zamiast blokować token na odnowieniu).
    if (
      distance > flank + this.definition.attackRange + epsilon ||
      this.cooldown > epsilon
    ) {
      this.releaseToken();
      return false;
    }
    this.token = director.requestToken(this.id, 'melee');
    if (this.token)
      this.token =
        director.requestGroupToken?.(
          this.id,
          ready && distance <= this.definition.attackRange + epsilon,
        ) ?? this.token;
    return this.token;
  }

  /** Status 'stunned' (F2-02) działa jak ogłuszenie ciosem i trwa, dopóki trwa status. */
  private holdStun(): void {
    const remaining = this.deps.statuses?.remaining(this.id, STUNNED) ?? 0;
    if (!(remaining > 0)) return;
    if (this.current.state !== 'stunned') {
      this.transition('stunned');
      this.stunS = remaining;
      this.ctx.bus.emit('enemy_stunned', { id: this.id, durationS: remaining });
    } else
      this.stunS = Math.max(this.stunS, this.current.stateTimeS + remaining);
  }

  syncControlled(): void {
    if (!this.removed && this.current.controlled)
      this.current.position = this.body.position();
  }

  grabTarget(): GrabTarget {
    return {
      id: this.id,
      body: this.body.body,
      enemy: true,
      controlled: this.current.controlled ?? false,
      grabbable: this.definition.grabbable ?? false,
      massKg: this.body.body.mass(),
      setControlled: (controlled) => {
        if (this.removed) return;
        this.current.controlled = controlled;
        this.deps.director?.releaseToken(this.id);
        this.token = false;
        this.body.clearMotion();
        this.current.position = this.body.position();
        if (this.current.state !== 'dead') {
          this.transition('idle');
          const remaining =
            this.deps.statuses?.remaining(this.id, STUNNED) ?? 0;
          if (!controlled && remaining > 0) {
            this.stunS = remaining;
            this.transition('stunned');
          }
        }
      },
    };
  }

  setCarry(carry: EnemyCarry | null): void {
    if (
      carry?.speedMultiplier === this.carry?.speedMultiplier &&
      carry?.defendRangeM === this.carry?.defendRangeM
    )
      return;
    this.carry = carry ? { ...carry } : null;
    this.stats.removeBySource('heistCarry');
    if (carry)
      this.stats.add({
        stat: 'moveSpeed',
        type: 'mult',
        value: carry.speedMultiplier,
        source: 'heistCarry',
      });
  }

  step(dt: number): void {
    if (this.removed) return;
    this.previous = copy(this.current);
    if (!(dt > 0)) return;
    const s = this.current;
    const d = this.definition;
    s.stateTimeS += dt;
    s.speed = 0;
    if (s.state === 'dead') {
      if (s.stateTimeS + epsilon >= this.ctx.tuning.enemies.corpseS)
        this.dispose();
      return;
    }
    if (s.controlled) {
      s.position = this.body.position();
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.tacticS = Math.max(0, this.tacticS - dt);
    this.tacticRetryS = Math.max(0, this.tacticRetryS - dt);
    if (
      this.tacticalGoal &&
      (this.tacticS <= epsilon ||
        Math.hypot(
          this.tacticalGoal.x - s.position.x,
          this.tacticalGoal.z - s.position.z,
        ) <= this.ctx.tuning.enemies.tacticArrivalM)
    )
      this.tacticalGoal = undefined;
    this.shieldDownS = Math.max(0, this.shieldDownS - dt);
    this.parryCooldownS = Math.max(0, this.parryCooldownS - dt);
    this.holdStun();
    this.updateShield();
    const target = this.deps.getTarget();
    const march =
      this.moveGoal &&
      (!target ||
        Math.hypot(
          target.position.x - s.position.x,
          target.position.z - s.position.z,
        ) >
          (this.carry?.defendRangeM ??
            this.ctx.tuning.modes.conquest.detectRangeM))
        ? this.moveGoal
        : undefined;
    const dx = target ? target.position.x - s.position.x : 0;
    const dz = target ? target.position.z - s.position.z : 0;
    const distance = Math.hypot(dx, dz);
    const flank = d.flankDistanceM ?? d.attackRange;
    if (
      !march &&
      target &&
      !this.tacticalGoal &&
      this.tacticRetryS <= epsilon &&
      ['idle', 'chase'].includes(s.state)
    )
      this.tryFlank(target.position, flank);
    let engaged = true;
    if (s.state === 'stunned') {
      if (s.stateTimeS + epsilon >= this.stunS)
        this.transition(target ? 'chase' : 'idle');
    } else if (march && this.carry) {
      this.releaseToken();
      if (s.state !== 'chase') this.transition('chase');
    } else if (s.state === 'telegraph') {
      if (s.stateTimeS + epsilon >= d.telegraphS) this.transition('swing');
    } else if (s.state === 'swing') {
      if (s.stateTimeS + epsilon >= d.swingActiveS) this.transition('recovery');
    } else if (s.state === 'recovery') {
      if (s.stateTimeS + epsilon >= d.recoveryS)
        this.transition(target ? 'chase' : 'idle');
    } else if (march) {
      this.releaseToken();
      if (s.state !== 'chase') this.transition('chase');
    } else if (!target) this.transition('idle');
    else {
      if (s.state === 'idle') this.transition('chase');
      const yaw = Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      const turn = ((d.turnRateDegS * Math.PI) / 180) * dt;
      s.yaw += Math.max(-turn, Math.min(turn, delta));
      engaged = this.engage(distance, flank, Math.abs(delta) <= turn + epsilon);
      if (
        engaged &&
        distance <= d.attackRange + epsilon &&
        this.cooldown <= epsilon &&
        Math.abs(delta) <= turn + epsilon
      )
        this.transition('telegraph');
    }
    let vx = 0;
    let vz = 0;
    let heading: number | null = null;
    let speed = 0;
    if (march && s.state === 'chase') {
      const gx = march.x - s.position.x,
        gz = march.z - s.position.z;
      const gap = Math.hypot(gx, gz);
      if (gap > this.ctx.tuning.modes.conquest.goalStopM) {
        heading = Math.atan2(gx, gz);
        s.yaw = heading;
        speed = gap / dt;
      }
    } else if (s.state === 'chase' && target) {
      if (this.tacticalGoal) {
        let goal = this.tacticalGoal;
        if (this.flanking) {
          this.deps.director?.slot(this.id, 'melee', flank);
          const angle = Math.atan2(
            s.position.x - target.position.x,
            s.position.z - target.position.z,
          );
          const end = Math.atan2(
            goal.x - target.position.x,
            goal.z - target.position.z,
          );
          const delta = Math.atan2(
            Math.sin(end - angle),
            Math.cos(end - angle),
          );
          const limit =
            (this.ctx.tuning.enemies.flankArcStepDeg * Math.PI) / 180;
          const next = angle + Math.max(-limit, Math.min(limit, delta));
          goal = {
            x: target.position.x + Math.sin(next) * flank,
            y: goal.y,
            z: target.position.z + Math.cos(next) * flank,
          };
        }
        heading = Math.atan2(goal.x - s.position.x, goal.z - s.position.z);
        speed = Math.hypot(goal.x - s.position.x, goal.z - s.position.z) / dt;
      } else if (engaged) {
        if (distance > d.attackRange) {
          heading = s.yaw;
          speed = (distance - d.attackRange) / dt;
        }
      } else if (
        distance > d.attackRange + epsilon ||
        !this.deps.difficulty?.groupAttack
      ) {
        // Bez tokenu: krążenie w slocie dyrektora, twarzą do celu.
        const goal = this.deps.director?.slot(this.id, 'melee', flank) ?? {
          x: target.position.x - (dx / Math.max(distance, epsilon)) * flank,
          z: target.position.z - (dz / Math.max(distance, epsilon)) * flank,
        };
        const gx = goal.x - s.position.x;
        const gz = goal.z - s.position.z;
        const gap = Math.hypot(gx, gz);
        if (gap > epsilon) {
          heading = Math.atan2(gx, gz);
          speed = gap / dt;
        }
      }
    }
    if (heading !== null) {
      this.probeS -= dt;
      if (this.probeS <= 0) {
        const hit = this.body.wallAhead(
          heading,
          this.ctx.tuning.enemies.wallProbe,
        );
        this.avoid = hit ? (this.rng.chance(0.5) ? 1 : -1) : 0;
        this.probeS =
          this.ctx.tuning.enemies.wallProbe / this.stats.get('moveSpeed') +
          this.rng.float(0, d.repathJitter);
      }
      const yaw = heading + (this.avoid * Math.PI) / 2;
      const v = Math.min(this.stats.get('moveSpeed'), speed);
      vx = Math.sin(yaw) * v;
      vz = Math.cos(yaw) * v;
    }
    for (const neighbor of this.deps.getNeighbors?.() ?? []) {
      if (neighbor.id === this.id || neighbor.current.state === 'dead')
        continue;
      let x = s.position.x - neighbor.current.position.x;
      let z = s.position.z - neighbor.current.position.z;
      const length = Math.hypot(x, z);
      const radius = this.ctx.tuning.enemies.separationRadius;
      if (length >= radius) continue;
      if (length <= epsilon) {
        x = this.id < neighbor.id ? -1 : 1;
        z = 0;
      } else {
        x /= length;
        z /= length;
      }
      const strength =
        ((radius - length) / radius) * this.stats.get('moveSpeed');
      vx += x * strength;
      vz += z * strength;
    }
    const movement = this.body.move(dt, vx, vz, this.ctx.tuning);
    s.position = movement.position;
    s.speed = movement.distance / dt;
    s.distance += movement.distance;
    if (this.hitbox) {
      this.strike();
      // strike() może przerwać cios (sparowanie → stunned zeruje hitbox).
      this.hitbox?.step(dt);
    }
  }

  private strike(): void {
    const d = this.definition;
    const s = this.current;
    const target = this.deps.getTarget();
    if (
      !target ||
      Math.hypot(
        target.position.x - s.position.x,
        target.position.z - s.position.z,
      ) >
        d.attackRange + epsilon
    )
      return;
    const forward = { x: Math.sin(s.yaw), y: 0, z: Math.cos(s.yaw) };
    const position = {
      x: s.position.x + (forward.x * d.attackRange) / 2,
      y: s.position.y + this.geometry.centerY,
      z: s.position.z + (forward.z * d.attackRange) / 2,
    };
    for (const box of queryHurtboxes(
      this.deps.world,
      this.deps.hurtboxes,
      new Cuboid(
        this.geometry.attackHalfWidth,
        this.geometry.attackHalfHeight,
        d.attackRange / 2,
      ),
      position,
      { x: 0, y: Math.sin(s.yaw / 2), z: 0, w: Math.cos(s.yaw / 2) },
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.Player),
    )) {
      if (box.entity !== target.id) continue;
      this.hitbox?.strike(box.entity, this.deps.damage, {
        multiplier: box.multiplier,
        dir: forward,
        point: position,
      });
    }
  }

  private tryFlank(target: Vec3, radius: number): void {
    const partner = this.deps
      .getNeighbors?.()
      .find(
        (enemy) =>
          enemy.id !== this.id &&
          ['telegraph', 'swing'].includes(enemy.current.state) &&
          ['assaulter', 'executor', 'shielder'].includes(enemy.definition.kind),
      );
    if (!partner) return;
    const t = this.ctx.tuning.enemies;
    this.tacticRetryS = t.tacticRetryS;
    const ax = partner.current.position.x - target.x,
      az = partner.current.position.z - target.z;
    const bx = this.current.position.x - target.x,
      bz = this.current.position.z - target.z;
    const length = Math.hypot(ax, az) * Math.hypot(bx, bz);
    // Z różnych stron już atakujemy poprawnie; nie przerywaj przyznanej pary.
    if (
      length <= epsilon ||
      (ax * bx + az * bz) / length <=
        Math.cos((t.flankMinDeg * Math.PI) / 180) + epsilon ||
      !this.rng.chance(this.deps.difficulty?.flankChance ?? 0)
    )
      return;
    const side = this.rng.chance(0.5) ? 1 : -1;
    const angle =
      Math.atan2(ax, az) +
      (side * this.rng.float(t.flankMinDeg, t.flankMaxDeg) * Math.PI) / 180;
    const goal = {
      x: target.x + Math.sin(angle) * radius,
      y: this.current.position.y,
      z: target.z + Math.cos(angle) * radius,
    };
    const lift = this.geometry.centerY;
    if (
      !clearWorld(
        this.deps,
        { ...this.current.position, y: this.current.position.y + lift },
        { ...goal, y: goal.y + lift },
      )
    )
      return;
    this.tacticalGoal = goal;
    this.flanking = true;
    this.tacticS = t.flankTimeoutS;
  }

  dispose(): void {
    if (this.removed) return;
    this.removed = true;
    this.releaseToken();
    for (const off of this.off.splice(0)) off();
    this.deps.hurtboxes.removeEntity(this.id);
    this.deps.damage.unregister(this.id);
    this.deps.entities.destroy(this.id);
    this.body.dispose();
  }
}
