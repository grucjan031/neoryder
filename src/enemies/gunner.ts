import type { GrabTarget } from '../combat/powers/grabTypes';
import { Ray } from '@dimforge/rapier3d-compat';
import { Health, PIERCE_BLOCK_TAG } from '../combat/damage';
import { STUNNED } from '../combat/status/statusSystem';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';
import { gunnerFields } from './enemySchema';
import type { EnemyDefinition } from './enemySchema';
import { EnemyBody } from './enemyBody';
import { clearWorld } from './tactics';
import type {
  Enemy,
  EnemyCarry,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const epsilon = 1e-6;
const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});

export class Gunner implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  previous: EnemySnapshot;
  current: EnemySnapshot;
  removed = false;
  moveGoal?: Vec3;
  tacticalGoal?: Vec3;
  private coverPhase: 'travel' | 'hold' | 'exit' | null = null;
  private coverExit: Vec3 | null = null;
  private coverS = 0;
  private coverCheckS = 0;
  private coverHidden = false;
  private tacticRetryS = 0;
  private evadeS = 0;
  private pressureSeen = false;
  private pressureReady = false;
  private carry: EnemyCarry | null = null;
  private readonly body: EnemyBody;
  private readonly off: (() => void)[] = [];
  private readonly rng;
  private readonly ranged;
  private readonly projectiles;
  private stunS = 0;
  private strafe = 0;
  private shots = 0;
  private nextShotS = 0;
  private probeS = 0;
  private avoid = 0;
  /** Token strzału od dyrektora (F2-12). */
  private token = false;
  /** Punkt, w który pójdzie strzał; zamrożony na `aimLockS` przed końcem telegrafu. */
  private aimPoint: Vec3 | null = null;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    private readonly deps: EnemyDependencies,
    readonly definition: EnemyDefinition,
    position: Vec3,
  ) {
    this.ranged = gunnerFields.parse(definition);
    if (!definition.body) throw new Error('Strzelec wymaga danych body.');
    if (!deps.projectiles)
      throw new Error('Strzelec wymaga ProjectileSystem sceny.');
    this.projectiles = deps.projectiles;
    this.id = deps.entities.create(definition.kind, 'enemy');
    // ctx.rng to strumień konkretnego spawnu (EnemyManager) — bez ID encji w etykiecie.
    this.rng = ctx.rng.fork('ai');
    this.stats = new Stats({
      maxHealth: definition.maxHealth,
      moveSpeed: definition.moveSpeed,
      damage: this.ranged.projectileDamage,
    });
    for (const mod of deps.spawnModifiers ?? []) this.stats.add(mod);
    deps.damage.register(
      this.id,
      new Health(() => this.stats.get('maxHealth')),
      { stats: this.stats },
    );
    this.body = new EnemyBody(deps, this.id, definition.body, position);
    this.current = {
      position: { ...position },
      yaw: 0,
      speed: 0,
      state: 'idle',
      stateTimeS: 0,
      distance: 0,
    };
    this.previous = copy(this.current);
    this.off.push(
      ctx.bus.on('dash_used', ({ user, dir }) => {
        const target = deps.getTarget();
        const t = ctx.tuning.enemies;
        const dx = this.current.position.x - (target?.position.x ?? 0);
        const dz = this.current.position.z - (target?.position.z ?? 0);
        const distance = Math.hypot(dx, dz);
        const directionLength = Math.hypot(dir.x, dir.z);
        if (
          definition.stationary ||
          user !== target?.id ||
          this.current.controlled ||
          !['aim', 'reposition', 'cooldown'].includes(this.current.state) ||
          distance <= epsilon ||
          distance > t.dashThreatRangeM ||
          directionLength <= epsilon ||
          (dx * dir.x + dz * dir.z) / (distance * directionLength) <
            t.threatFacingDot ||
          !this.rng.chance(deps.difficulty?.dashDodgeChance ?? 0)
        )
          return;
        const side = this.rng.chance(0.5) ? 1 : -1;
        const travel = this.stats.get('moveSpeed') * t.evadeS;
        this.coverPhase = null;
        this.transition('reposition');
        this.tacticalGoal = {
          x: this.current.position.x + (dz / distance) * side * travel,
          y: this.current.position.y,
          z: this.current.position.z - (dx / distance) * side * travel,
        };
        this.evadeS = t.evadeS;
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
        if (dir && !definition.stationary)
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
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id === this.id && this.current.state !== 'dead')
          this.transition('dead');
      }),
    );
  }

  private transition(state: EnemyState): void {
    if (state === 'stunned' || state === 'dead' || state === 'idle') {
      this.coverPhase = null;
      this.tacticalGoal = undefined;
      this.evadeS = 0;
    }
    this.current.state = state;
    this.current.stateTimeS = 0;
    delete this.current.knockdown;
    // Token trzyma tylko celowanie i seria; po niej strzela następny (ostrzał zaporowy).
    if (state !== 'aim' && state !== 'burst') {
      this.releaseToken();
      this.aimPoint = null;
      this.current.aim = undefined;
    }
    if (state === 'reposition') {
      this.strafe = this.rng.chance(0.5) ? 1 : -1;
      this.probeS = 0;
      this.avoid = 0;
    }
    if (state === 'aim')
      this.ctx.bus.emit('enemy_telegraph', {
        id: this.id,
        kind: 'aim',
        durationS: this.ranged.aimTelegraphS,
      });
    if (state === 'burst') {
      this.shots = 0;
      this.nextShotS = 0;
    }
  }

  /** Zamrożony punkt strzału: ostatnie `aimLockS` telegrafu i seria; null bez blokady. */
  private lockedPoint(): Vec3 | null {
    const lock = this.ranged.aimLockS;
    const s = this.current;
    if (lock === undefined || !this.aimPoint) return null;
    if (s.state === 'burst') return this.aimPoint;
    return s.state === 'aim' &&
      s.stateTimeS + epsilon >= this.ranged.aimTelegraphS - lock
      ? this.aimPoint
      : null;
  }

  /** Bez `aimLockS` cel śledzony do końca serii; z nim — zamrożony na końcu telegrafu. */
  private track(target: Vec3): void {
    if (!this.lockedPoint()) this.aimPoint = { ...target };
    this.current.aim = this.aimPoint ? { ...this.aimPoint } : undefined;
  }

  private releaseToken(): void {
    if (this.token) this.deps.director?.releaseToken(this.id);
    this.token = false;
  }

  /** Bez dyrektora zawsze true; z dyrektorem prosi o token strzału. */
  private engage(): boolean {
    const director = this.deps.director;
    if (!director) return true;
    this.token = director.requestToken(this.id, 'shot');
    return this.token;
  }

  private muzzle(): Vec3 {
    const { position: p, yaw } = this.current;
    const m = this.ranged.muzzle;
    return {
      x: p.x + Math.cos(yaw) * m.x + Math.sin(yaw) * m.z,
      y: p.y + m.y,
      z: p.z - Math.sin(yaw) * m.x + Math.cos(yaw) * m.z,
    };
  }

  private hasLos(target: Vec3): boolean {
    if (!this.ranged.losRequired) return true;
    const origin = this.muzzle();
    // Sprawdź też odcinek od ciała do wylotu, aby karabin nie strzelał przez osłonę.
    const bodyOrigin = { ...this.current.position, y: origin.y };
    const blocked = (a: Vec3, b: Vec3): boolean => {
      const distance = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      if (distance <= epsilon) return false;
      return (
        this.deps.world.castRay(
          new Ray(a, {
            x: (b.x - a.x) / distance,
            y: (b.y - a.y) / distance,
            z: (b.z - a.z) / distance,
          }),
          distance,
          true,
          undefined,
          interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
        ) !== null
      );
    };
    return !blocked(bodyOrigin, origin) && !blocked(origin, target);
  }

  private fire(target: Vec3): void {
    const origin = this.muzzle();
    const dx = target.x - origin.x,
      dy = target.y - origin.y,
      dz = target.z - origin.z;
    const spread = (this.ranged.spreadDeg * Math.PI) / 180;
    const yaw =
      (this.definition.stationary ? this.current.yaw : Math.atan2(dx, dz)) +
      this.rng.float(-spread, spread);
    const pitch =
      Math.atan2(dy, Math.hypot(dx, dz)) + this.rng.float(-spread, spread);
    this.current.shotTimeS = 0;
    this.projectiles.spawn({
      owner: this.id,
      team: 'enemy',
      origin,
      dir: {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch),
      },
      speed: this.ranged.projectileSpeed,
      damage: this.stats.get('damage'),
      lifetimeS: this.ranged.projectileLifetimeS,
      tags: this.ranged.projectileTags ?? ['#gun'],
    });
  }

  private seekCover(target: Vec3): void {
    const t = this.ctx.tuning.enemies;
    // Osłona tylko dla Strzelca: Snajper po strzale zostaje na pozycji (F2-13).
    if (
      this.definition.kind !== 'gunner' ||
      this.definition.stationary ||
      this.coverPhase ||
      this.evadeS > 0 ||
      this.tacticRetryS > 0
    )
      return;
    this.tacticRetryS = t.tacticRetryS;
    if (!this.rng.chance(this.deps.difficulty?.coverUse ?? 0)) return;
    const p = this.current.position;
    const lift = this.ranged.muzzle.y;
    const from = { ...p, y: p.y + lift };
    const offset = this.rng.float(0, Math.PI * 2);
    for (const radius of [t.coverRadiusM / 2, t.coverRadiusM]) {
      for (let i = 0; i < t.coverSamples; i++) {
        const angle = offset + (i * Math.PI * 2) / t.coverSamples;
        const goal = {
          x: p.x + Math.sin(angle) * radius,
          y: p.y,
          z: p.z + Math.cos(angle) * radius,
        };
        const eye = { ...goal, y: goal.y + lift };
        if (
          clearWorld(this.deps, eye, target) ||
          !clearWorld(this.deps, from, eye) ||
          clearWorld(this.deps, eye, {
            ...goal,
            y: goal.y - t.coverGroundProbeM,
          })
        )
          continue;
        // Promienie na bokach kapsuły eliminują punkty przy zbyt wąskich przejściach.
        const width = this.definition.body!.radius;
        if (
          ![1, -1].every((side) =>
            clearWorld(
              this.deps,
              {
                x: from.x + Math.cos(angle) * width * side,
                y: from.y,
                z: from.z - Math.sin(angle) * width * side,
              },
              {
                x: eye.x + Math.cos(angle) * width * side,
                y: eye.y,
                z: eye.z - Math.sin(angle) * width * side,
              },
            ),
          )
        )
          continue;
        this.coverExit = { ...p };
        this.tacticalGoal = goal;
        this.coverPhase = 'travel';
        this.coverS = t.coverTravelS;
        this.coverCheckS = 0;
        this.transition('reposition');
        return;
      }
    }
  }

  private updateCover(dt: number, target: Vec3): void {
    if (!this.coverPhase) return;
    this.coverS -= dt;
    const p = this.current.position;
    // Widoczność z osłony sprawdzana co `coverCheckS` (cache), nie co klatkę.
    this.coverCheckS -= dt;
    if (this.coverCheckS <= epsilon) {
      this.coverCheckS = this.ctx.tuning.enemies.coverCheckS;
      this.coverHidden =
        !this.hasLos(target) &&
        !clearWorld(this.deps, { ...p, y: p.y + this.ranged.muzzle.y }, target);
    }
    const hidden = this.coverHidden;
    if (this.coverPhase === 'travel' && hidden) {
      this.coverPhase = 'hold';
      this.coverS = this.ctx.tuning.enemies.coverHoldS;
      this.tacticalGoal = undefined;
      this.transition('cooldown');
    } else if (
      this.coverPhase === 'hold' &&
      (this.coverS <= epsilon || !hidden)
    ) {
      this.coverPhase = 'exit';
      this.coverS = this.ctx.tuning.enemies.coverTravelS;
      this.tacticalGoal = this.coverExit ?? undefined;
      this.transition('reposition');
    } else if (
      this.coverPhase !== 'hold' &&
      (this.coverS <= epsilon ||
        (this.coverPhase === 'exit' &&
          this.tacticalGoal &&
          Math.hypot(this.tacticalGoal.x - p.x, this.tacticalGoal.z - p.z) <=
            this.ctx.tuning.enemies.tacticArrivalM))
    ) {
      this.coverPhase = null;
      this.tacticalGoal = undefined;
      this.transition('reposition');
    }
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
    const s = this.current,
      d = this.definition,
      r = this.ranged;
    s.stateTimeS += dt;
    if (s.shotTimeS !== undefined) s.shotTimeS += dt;
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
    this.holdStun();
    this.tacticRetryS = Math.max(0, this.tacticRetryS - dt);
    this.evadeS = Math.max(0, this.evadeS - dt);
    if (this.evadeS <= epsilon && !this.coverPhase)
      this.tacticalGoal = undefined;
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
    const los = target !== null && this.hasLos(target.position);
    if (target && !march && !s.controlled && s.state !== 'stunned') {
      const health = this.deps.damage.health(this.id);
      if (
        health &&
        health.current / health.max <= this.ctx.tuning.enemies.coverLowHp
      )
        this.seekCover(target.position);
      this.updateCover(dt, target.position);
    }
    const pressure = this.deps.director?.pressure?.() ?? false;
    if (!pressure) {
      this.pressureSeen = false;
      this.pressureReady = false;
    } else if (!this.pressureSeen) {
      this.pressureSeen = true;
      this.pressureReady = this.rng.chance(
        this.deps.difficulty?.groupAttack ?? 0,
      );
      if (this.pressureReady && s.state === 'cooldown' && !this.coverPhase)
        this.transition('reposition');
    }
    if (s.state === 'stunned') {
      if (s.stateTimeS + epsilon >= this.stunS)
        this.transition(target ? 'reposition' : 'idle');
    } else if (march) {
      if (s.state !== 'reposition') this.transition('reposition');
    } else if (!target) {
      if (s.state !== 'idle') this.transition('idle');
    } else if (this.coverPhase || this.evadeS > epsilon) {
      // Taktyczne przemieszczenie i pełny czas za osłoną blokują rozpoczęcie celowania.
    } else {
      // Po zamrożeniu celu Snajper patrzy w zamrożony punkt i nie przerywa strzału,
      // gdy gracz zejdzie z linii albo schowa się — strzał leci w zapowiedziane miejsce.
      const locked = this.lockedPoint();
      const yaw = locked
        ? Math.atan2(locked.x - s.position.x, locked.z - s.position.z)
        : Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      const turn = ((d.turnRateDegS * Math.PI) / 180) * dt;
      s.yaw += Math.max(-turn, Math.min(turn, delta));
      if (s.state === 'idle') this.transition('reposition');
      if ((s.state === 'aim' || s.state === 'burst') && !los && !locked)
        this.transition('reposition');
      if (
        s.state === 'reposition' &&
        los &&
        ((this.pressureReady && distance <= d.attackRange) || d.stationary
          ? distance <= d.attackRange
          : Math.abs(distance - r.preferredRange) <=
            r.rangeTolerance + epsilon) &&
        Math.abs(delta) <= turn + epsilon &&
        this.engage()
      )
        this.transition('aim');
      else if (s.state === 'aim' && s.stateTimeS + epsilon >= r.aimTelegraphS)
        this.transition('burst');
      else if (s.state === 'cooldown' && s.stateTimeS + epsilon >= d.cooldownS)
        this.transition('reposition');
      if (s.state === 'aim' || s.state === 'burst') this.track(target.position);
      if (s.state === 'burst' && s.stateTimeS + epsilon >= this.nextShotS) {
        this.fire(this.aimPoint ?? target.position);
        this.shots++;
        this.nextShotS += r.burstIntervalS;
        if (this.shots >= r.burstCount) {
          this.transition('cooldown');
          this.seekCover(target.position);
        }
      }
    }
    if (d.stationary) return;
    let vx = 0,
      vz = 0;
    // Z dyrektorem i widocznym celem: czekanie na token w slocie na preferowanym dystansie.
    const goal =
      this.tacticalGoal ??
      (march && s.state === 'reposition'
        ? march
        : s.state === 'reposition' && target && los
          ? (this.deps.director?.slot(this.id, 'shot', r.preferredRange) ??
            null)
          : null);
    if (goal) {
      const gx = goal.x - s.position.x,
        gz = goal.z - s.position.z;
      const gap = Math.hypot(gx, gz);
      if (gap > (march ? this.ctx.tuning.modes.conquest.goalStopM : epsilon)) {
        const heading = this.steer(dt, Math.atan2(gx, gz), this.strafe);
        if (march) s.yaw = heading;
        const speed = Math.min(this.stats.get('moveSpeed'), gap / dt);
        vx = Math.sin(heading) * speed;
        vz = Math.cos(heading) * speed;
      }
    } else if (
      s.state === 'reposition' &&
      !this.coverPhase &&
      target &&
      distance > epsilon
    ) {
      const radial =
        !los || distance > r.preferredRange + r.rangeTolerance
          ? 1
          : distance < r.preferredRange - r.rangeTolerance
            ? -1
            : 0;
      // Próba ściany w kierunku faktycznego ruchu (cofanie się sprawdza ścianę za plecami).
      this.steer(
        dt,
        radial !== 0
          ? Math.atan2(dx * radial, dz * radial)
          : Math.atan2(dz * this.strafe, -dx * this.strafe),
        0,
      );
      const lateral = this.avoid ? this.strafe : this.strafe * r.strafeScale;
      const norm = Math.hypot(radial, lateral) || 1;
      const speed = this.stats.get('moveSpeed');
      vx = ((dx * radial + dz * lateral) / distance / norm) * speed;
      vz = ((dz * radial - dx * lateral) / distance / norm) * speed;
    }
    for (const neighbor of this.deps.getNeighbors?.() ?? []) {
      if (this.coverPhase === 'hold') break;
      if (neighbor.id === this.id || neighbor.current.state === 'dead')
        continue;
      let x = s.position.x - neighbor.current.position.x,
        z = s.position.z - neighbor.current.position.z;
      const length = Math.hypot(x, z),
        radius = this.ctx.tuning.enemies.separationRadius;
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
  }

  /**
   * Próba ściany co `wallProbe / moveSpeed` (+ rozrzut z Rng). Zapisuje `avoid` (1 = omijanie)
   * i zwraca kierunek ruchu: przy ścianie odchylony o 90° w stronę `side`.
   */
  private steer(dt: number, heading: number, side: number): number {
    this.probeS -= dt;
    if (this.probeS <= 0) {
      this.avoid = this.body.wallAhead(
        heading,
        this.ctx.tuning.enemies.wallProbe,
      )
        ? 1
        : 0;
      this.probeS =
        this.ctx.tuning.enemies.wallProbe / this.stats.get('moveSpeed') +
        this.rng.float(0, this.definition.repathJitter);
    }
    return heading + (this.avoid * side * Math.PI) / 2;
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
