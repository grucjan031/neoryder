import { deathDirection, deathDuration } from './enemyDeath';
import { arrivalSpeed, steerVelocity, updateBodyPose } from './locomotion';
import type { GrabTarget } from '../combat/powers/grabTypes';
import {
  Ball,
  ColliderDesc,
  QueryFilterFlags,
  Ray,
  RigidBodyDesc,
} from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody } from '@dimforge/rapier3d-compat';
import { Health, PIERCE_BLOCK_TAG } from '../combat/damage';
import { STUNNED } from '../combat/status/statusSystem';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';
import { droneFields, gunnerFields } from './enemySchema';
import type { EnemyDefinition } from './enemySchema';
import {
  resolveWallSlam,
  wallSlamContact,
  type WallSlam,
  type ImpactSource,
} from './enemyWallImpact';
import type {
  Enemy,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const epsilon = 1e-6;
const identity = { x: 0, y: 0, z: 0, w: 1 };
const isOrbiting = (state: EnemyState): boolean =>
  state === 'reposition' || state === 'cooldown';
const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});

/**
 * Dron (F2-13): lata bez character controllera — kinematyczna kula na stałej wysokości
 * (`hoverHeightM` nad spawnem), krąży wokół celu w odległości `preferredRange` i strzela seriami
 * jak Strzelec (token 'shot' dyrektora). Ruch sprawdza `castShape` kuli po świecie: przy ścianie
 * ślizga się po niej, a po utknięciu może poszukać nowej pozycji na orbicie.
 * Pozycja snapshotów to środek drona.
 */
export class Drone implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  previous: EnemySnapshot;
  current: EnemySnapshot;
  removed = false;
  private readonly ranged;
  private readonly flight;
  private readonly projectiles;
  private readonly body: RigidBody;
  private readonly hurtbox: Collider;
  private readonly shape: Ball;
  private readonly altitude: number;
  private readonly off: (() => void)[] = [];
  private readonly rng;
  private readonly impulse = { x: 0, y: 0, z: 0 };
  private readonly velocity = { x: 0, z: 0 };
  private orbit: 1 | -1;
  private orbitReverseWaitS = 0;
  private orbitWatch: {
    start: Vec3;
    elapsedS: number;
    reversals: number;
  } | null = null;
  private escapeGoal: Vec3 | null = null;
  private stunS = 0;
  private impulseSource: ImpactSource | null = null;
  private shots = 0;
  private nextShotS = 0;
  private token = false;

  constructor(
    protected readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    protected readonly deps: EnemyDependencies,
    readonly definition: EnemyDefinition,
    position: Vec3,
  ) {
    this.ranged = gunnerFields.parse(definition);
    this.flight = droneFields.parse(definition.drone);
    if (!deps.projectiles) throw new Error('Dron wymaga ProjectileSystem.');
    this.projectiles = deps.projectiles;
    this.id = deps.entities.create(definition.kind, 'enemy');
    this.rng = ctx.rng.fork('ai');
    this.orbit = this.rng.chance(0.5) ? 1 : -1;
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
    this.altitude = position.y + this.flight.hoverHeightM;
    const center = { x: position.x, y: this.altitude, z: position.z };
    this.body = deps.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased()
        .lockRotations()
        .setTranslation(center.x, center.y, center.z),
    );
    this.hurtbox = deps.world.createCollider(
      ColliderDesc.ball(this.flight.radiusM)
        .setMass(this.flight.massKg)
        .setSensor(true)
        .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
      this.body,
    );
    deps.entities.bindCollider(this.id, this.hurtbox.handle);
    deps.hurtboxes.add(this.id, this.hurtbox, this.flight.hurtboxMultiplier);
    this.shape = new Ball(this.flight.radiusM);
    this.current = {
      position: center,
      yaw: 0,
      speed: 0,
      state: 'idle',
      stateTimeS: 0,
      distance: 0,
    };
    this.previous = copy(this.current);
    this.off.push(
      ctx.bus.on('damage_dealt', (event) => {
        if (
          event.target !== this.id ||
          this.current.state === 'dead' ||
          this.current.controlled ||
          event.killed
        )
          return;
        this.onDamage();
        const dir = event.dir;
        const push = event.knockback * (1 - definition.knockbackResist);
        if (dir && push > 0) {
          const length = Math.hypot(dir.x, dir.y, dir.z) || 1;
          this.impulse.x += (dir.x / length) * push;
          this.impulse.y += (dir.y / length) * push;
          this.impulse.z += (dir.z / length) * push;
          this.impulseSource = event;
        }
        if (
          event.tags.includes(PIERCE_BLOCK_TAG) ||
          event.knockback >= ctx.tuning.enemies.stunKnockback
        ) {
          this.stunS = definition.stunOnHeavyS;
          this.transition('stunned');
          ctx.bus.emit('enemy_stunned', { id: this.id, durationS: this.stunS });
        }
      }),
      ctx.bus.on('enemy_killed', ({ id, dir, tags }) => {
        if (id !== this.id || this.current.state === 'dead') return;
        this.deps.hurtboxes.removeEntity(this.id);
        this.deps.entities.unbindCollider(this.hurtbox.handle);
        this.deps.world.removeCollider(this.hurtbox, false);
        this.current.death = {
          dir: deathDirection(dir),
          durationS: deathDuration(tags, ctx.tuning.enemies),
        };
        this.transition('dead');
      }),
    );
  }

  protected onDamage(): void {}

  protected get aimTelegraphS(): number {
    return this.ranged.aimTelegraphS;
  }

  protected get cooldownS(): number {
    return this.definition.cooldownS;
  }

  protected transition(state: EnemyState): void {
    this.current.state = state;
    this.current.stateTimeS = 0;
    if (!isOrbiting(state)) this.orbitWatch = null;
    if (state === 'idle' || state === 'stunned' || state === 'dead')
      this.escapeGoal = null;
    if (state !== 'aim' && state !== 'burst') {
      this.current.aim = undefined;
      if (this.token) this.deps.director?.releaseToken(this.id);
      this.token = false;
    }
    if (state === 'aim')
      this.ctx.bus.emit('enemy_telegraph', {
        id: this.id,
        kind: 'aim',
        durationS: this.aimTelegraphS,
      });
    if (state === 'burst') {
      this.shots = 0;
      this.nextShotS = 0;
    }
  }

  protected muzzle(): Vec3 {
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
    const blocked = (a: Vec3, b: Vec3): boolean => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= epsilon) return false;
      return (
        this.deps.world.castRay(
          new Ray(a, { x: dx / distance, y: dy / distance, z: dz / distance }),
          distance,
          true,
          undefined,
          interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
        ) !== null
      );
    };
    // Odcinek środek → lufa też: przy narożniku lufa może wystawać za przeszkodę.
    const origin = this.muzzle();
    return !blocked(this.current.position, origin) && !blocked(origin, target);
  }

  protected fire(target: Vec3): void {
    const origin = this.muzzle();
    const dx = target.x - origin.x,
      dy = target.y - origin.y,
      dz = target.z - origin.z;
    const spread = (this.ranged.spreadDeg * Math.PI) / 180;
    const yaw = Math.atan2(dx, dz) + this.rng.float(-spread, spread);
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

  syncControlled(): void {
    if (!this.removed && this.current.controlled)
      this.current.position = { ...this.body.translation() };
  }

  grabTarget(): GrabTarget {
    return {
      id: this.id,
      body: this.body,
      enemy: true,
      controlled: this.current.controlled ?? false,
      grabbable: this.definition.grabbable ?? false,
      massKg: this.flight.massKg,
      setControlled: (controlled) => {
        if (this.removed) return;
        this.current.controlled = controlled;
        this.velocity.x = this.velocity.z = 0;
        this.deps.director?.releaseToken(this.id);
        this.token = false;
        this.hurtbox.setSensor(!controlled);
        this.impulse.x = this.impulse.y = this.impulse.z = 0;
        this.current.position = { ...this.body.translation() };
        if (!controlled) this.recoverClearance();
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
    if (s.controlled) {
      s.position = { ...this.body.translation() };
      return;
    }
    const stunned = this.deps.statuses?.remaining(this.id, STUNNED) ?? 0;
    this.orbitReverseWaitS = Math.max(0, this.orbitReverseWaitS - dt);
    if (stunned > 0) {
      if (s.state !== 'stunned') {
        this.transition('stunned');
        this.stunS = stunned;
        this.ctx.bus.emit('enemy_stunned', { id: this.id, durationS: stunned });
      } else this.stunS = Math.max(this.stunS, s.stateTimeS + stunned);
    }
    const target = this.deps.getTarget();
    const dx = target ? target.position.x - s.position.x : 0;
    const dz = target ? target.position.z - s.position.z : 0;
    const distance = Math.hypot(dx, dz);
    const los = target !== null && this.hasLos(target.position);
    if (s.state === 'stunned') {
      if (s.stateTimeS + epsilon >= this.stunS)
        this.transition(target ? 'reposition' : 'idle');
    } else if (!target) {
      if (s.state !== 'idle') this.transition('idle');
    } else {
      const yaw = Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw));
      const turn = ((d.turnRateDegS * Math.PI) / 180) * dt;
      s.yaw += Math.max(-turn, Math.min(turn, delta));
      if (s.state === 'idle') this.transition('reposition');
      if ((s.state === 'aim' || s.state === 'burst') && !los)
        this.transition('reposition');
      if (
        s.state === 'reposition' &&
        los &&
        Math.abs(distance - r.preferredRange) <= r.rangeTolerance + epsilon &&
        Math.abs(delta) <= turn + epsilon &&
        this.engage()
      )
        this.transition('aim');
      else if (
        s.state === 'aim' &&
        s.stateTimeS + epsilon >= this.aimTelegraphS
      )
        this.transition('burst');
      else if (
        s.state === 'cooldown' &&
        s.stateTimeS + epsilon >= this.cooldownS
      )
        this.transition('reposition');
      if (s.state === 'aim' || s.state === 'burst')
        s.aim = { ...target.position };
      if (s.state === 'burst' && s.stateTimeS + epsilon >= this.nextShotS) {
        this.fire(target.position);
        this.shots++;
        this.nextShotS += r.burstIntervalS;
        if (this.shots >= r.burstCount) this.transition('cooldown');
      }
    }
    // Krąży w reposition i cooldown; celując i strzelając zawisa w miejscu.
    let vx = 0,
      vy = 0,
      vz = 0;
    const scale = this.flight.locomotionScale ?? 1;
    const settings = this.ctx.tuning.enemies;
    const orbiting = target !== null && isOrbiting(s.state);
    if (orbiting && this.escapeGoal) {
      const x = this.escapeGoal.x - s.position.x;
      const y = this.escapeGoal.y - s.position.y;
      const z = this.escapeGoal.z - s.position.z;
      const distance = Math.hypot(x, y, z);
      const speed = Math.min(
        this.stats.get('moveSpeed'),
        arrivalSpeed(distance, settings.brakingMps2 * scale, dt),
      );
      const ratio = speed / Math.max(distance, epsilon);
      vx = x * ratio;
      vy = y * ratio;
      vz = z * ratio;
    } else if (orbiting) {
      // Krążenie = składowa styczna (prędkość kątowa na bieżącym promieniu) + korekta promienia
      // do preferredRange. Gdy ściana blokuje korektę, ślizg zachowuje pełne krążenie.
      const speed = this.stats.get('moveSpeed');
      const rx = s.position.x - target.position.x,
        rz = s.position.z - target.position.z;
      const radius = Math.hypot(rx, rz);
      const ux = radius > epsilon ? rx / radius : 0,
        uz = radius > epsilon ? rz / radius : 1;
      const tangential = Math.min(
        speed,
        ((this.flight.orbitSpeedDegS * Math.PI) / 180) * radius,
      );
      const radial = Math.max(
        -speed,
        Math.min(speed, (r.preferredRange - radius) / dt),
      );
      vx = uz * this.orbit * tangential + ux * radial;
      vz = -ux * this.orbit * tangential + uz * radial;
      const horizontal = Math.hypot(vx, vz);
      if (horizontal > speed) {
        vx *= speed / horizontal;
        vz *= speed / horizontal;
      }
      vy = Math.max(
        -speed,
        Math.min(speed, (this.altitude - s.position.y) / dt),
      );
    } else if (s.state !== 'stunned') {
      // Powrót na wysokość lotu po odrzucie.
      vy = (this.altitude - s.position.y) / Math.max(dt, epsilon);
      vy = Math.max(
        -this.stats.get('moveSpeed'),
        Math.min(this.stats.get('moveSpeed'), vy),
      );
    }
    for (const neighbor of this.deps.getLocalNeighbors?.() ??
      this.deps.getNeighbors?.() ??
      []) {
      if (neighbor.id === this.id || neighbor.current.state === 'dead')
        continue;
      const x = s.position.x - neighbor.current.position.x,
        y = s.position.y - neighbor.current.position.y,
        z = s.position.z - neighbor.current.position.z;
      const length = Math.hypot(x, y, z),
        radius = this.ctx.tuning.enemies.separationRadius;
      if (length >= radius || length <= epsilon) continue;
      const strength =
        ((radius - length) / radius) * this.stats.get('moveSpeed');
      vx += (x / length) * strength;
      vz += (z / length) * strength;
    }
    steerVelocity(
      this.velocity,
      vx,
      vz,
      settings.accelerationMps2 * scale,
      settings.brakingMps2 * scale,
      dt,
    );
    vx = this.velocity.x;
    vz = this.velocity.z;
    const moved = this.move({
      x: (vx + this.impulse.x) * dt,
      y: (vy + this.impulse.y) * dt,
      z: (vz + this.impulse.z) * dt,
    });
    if (this.deps.damage.health(this.id)?.dead) return;
    if (target && isOrbiting(s.state))
      this.updateOrbitProgress(target.position, dt);
    const damping = Math.exp(-this.flight.knockbackDamping * dt);
    this.impulse.x *= damping;
    this.impulse.y *= damping;
    this.impulse.z *= damping;
    s.speed = moved / dt;
    s.distance += moved;
    updateBodyPose(this.previous, s, d.turnRateDegS, dt, settings);
  }

  private updateOrbitProgress(target: Vec3, dt: number): void {
    const recovery = this.flight.cornerEscape;
    if (!recovery) return;
    const position = this.current.position;
    const goal = this.escapeGoal;
    if (
      goal &&
      Math.hypot(
        goal.x - position.x,
        goal.y - position.y,
        goal.z - position.z,
      ) <= this.flight.skinM
    ) {
      this.escapeGoal = this.orbitWatch = null;
      return;
    }
    const watch = this.orbitWatch;
    if (!watch) return;
    watch.elapsedS += dt;
    const windowEnded = watch.elapsedS + epsilon >= recovery.stuckWindowS;
    if (!windowEnded && watch.reversals <= recovery.maxOrbitReversals) return;
    this.orbitWatch = null;
    if (
      watch.reversals > recovery.maxOrbitReversals ||
      Math.hypot(position.x - watch.start.x, position.z - watch.start.z) <
        recovery.stuckDistanceM
    )
      this.escapeGoal = this.findEscapeGoal(target, recovery.sampleCount);
  }

  private findEscapeGoal(target: Vec3, sampleCount: number): Vec3 | null {
    const from = this.current.position;
    const turn = 2 * Math.PI;
    const offset = this.rng.float(0, turn);
    let best: Vec3 | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < sampleCount; i++) {
      const angle = offset + (i * turn) / sampleCount;
      const candidate = {
        x: target.x + this.ranged.preferredRange * Math.cos(angle),
        y: this.altitude,
        z: target.z + this.ranged.preferredRange * Math.sin(angle),
      };
      const delta = {
        x: candidate.x - from.x,
        y: candidate.y - from.y,
        z: candidate.z - from.z,
      };
      const distance = Math.hypot(delta.x, delta.y, delta.z);
      if (distance <= this.flight.skinM || distance >= bestDistance) continue;
      // Tak jak przy ślizgu, mniejszy zapas pozwala ruszyć z granicy kontaktu.
      if (this.sweep(from, delta, this.flight.skinM / 2)) continue;
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  private recoverClearance(): void {
    const point = { ...this.body.translation() };
    this.deps.world.forEachCollider((collider) => {
      if (
        collider.isSensor() ||
        ((collider.collisionGroups() >>> 16) & CollisionGroup.World) === 0
      )
        return;
      const contact = collider.contactShape(
        this.shape,
        point,
        identity,
        this.flight.skinM,
      );
      if (!contact || contact.distance >= this.flight.skinM) return;
      const distance = this.flight.skinM - contact.distance + epsilon;
      point.x += contact.normal1.x * distance;
      point.y += contact.normal1.y * distance;
      point.z += contact.normal1.z * distance;
    });
    this.body.setTranslation(point, true);
    this.body.setNextKinematicTranslation(point);
    this.current.position = point;
  }

  private sweep(from: Vec3, delta: Vec3, clearance = this.flight.skinM) {
    return this.deps.world.castShape(
      from,
      identity,
      delta,
      this.shape,
      clearance,
      1,
      false,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      undefined,
      this.body,
    );
  }

  private move(delta: Vec3): number {
    const length = Math.hypot(delta.x, delta.y, delta.z);
    if (length <= epsilon) return 0;
    const pos = { ...this.current.position };
    const orbiting = isOrbiting(this.current.state);
    const clearance =
      orbiting && this.escapeGoal ? this.flight.skinM / 2 : this.flight.skinM;
    const hit = this.sweep(pos, delta, clearance);
    const t = hit ? Math.max(0, Math.min(1, hit.time_of_impact)) : 1;
    pos.x += delta.x * t;
    pos.y += delta.y * t;
    pos.z += delta.z * t;
    let moved = length * t;
    let slam: WallSlam | null = null;
    if (hit && t < 1) {
      const recovery = this.flight.cornerEscape;
      if (orbiting && recovery && !this.orbitWatch)
        this.orbitWatch = {
          start: this.current.position,
          elapsedS: 0,
          reversals: 0,
        };
      const n = hit.normal1;
      slam = wallSlamContact(
        this.impulse,
        hit.collider,
        hit.witness1,
        n,
        this.impulseSource,
        this.ctx.tuning.enemies,
      );
      if (!slam) this.impulse.x = this.impulse.y = this.impulse.z = 0;
      const normalSpeed = this.velocity.x * n.x + this.velocity.z * n.z;
      if (normalSpeed < 0) {
        this.velocity.x -= normalSpeed * n.x;
        this.velocity.z -= normalSpeed * n.z;
      }
      const dot = delta.x * n.x + delta.y * n.y + delta.z * n.z;
      const slide = {
        x: (delta.x - dot * n.x) * (1 - t),
        y: (delta.y - dot * n.y) * (1 - t),
        z: (delta.z - dot * n.z) * (1 - t),
      };
      const tangentLength = Math.hypot(slide.x, slide.y, slide.z);
      if (tangentLength > epsilon) {
        // The first cast stopped at the skin boundary. A tangent cast with the
        // same inflated radius can hit that wall again at time zero after f32 rounding.
        const second = this.sweep(pos, slide, this.flight.skinM / 2);
        const fraction = second
          ? Math.max(0, Math.min(1, second.time_of_impact))
          : 1;
        pos.x += slide.x * fraction;
        pos.y += slide.y * fraction;
        pos.z += slide.z * fraction;
        moved += tangentLength * fraction;
      }
      if (
        moved <= epsilon &&
        orbiting &&
        !this.escapeGoal &&
        this.orbitReverseWaitS <= epsilon
      ) {
        this.orbit = this.orbit === 1 ? -1 : 1;
        this.orbitReverseWaitS = recovery?.orbitReverseLockS ?? 0;
        if (this.orbitWatch) this.orbitWatch.reversals++;
      }
    }
    this.body.setNextKinematicTranslation(pos);
    this.current.position = pos;
    if (slam) {
      const extra = this.ctx.tuning.enemies.wallSlamExtraStunS;
      if (extra > 0) {
        if (this.current.state !== 'stunned') {
          this.transition('stunned');
          this.stunS = 0;
        }
        this.stunS = Math.max(this.stunS, this.current.stateTimeS) + extra;
        this.ctx.bus.emit('enemy_stunned', {
          id: this.id,
          durationS: this.stunS - this.current.stateTimeS,
        });
      }
      resolveWallSlam(this.ctx, this.deps.damage, this.id, slam);
    }
    return moved;
  }

  protected engage(): boolean {
    const director = this.deps.director;
    if (!director) return true;
    this.token = director.requestToken(this.id, 'shot');
    return this.token;
  }

  dispose(): void {
    if (this.removed) return;
    this.removed = true;
    if (this.token) this.deps.director?.releaseToken(this.id);
    this.token = false;
    for (const off of this.off.splice(0)) off();
    this.deps.hurtboxes.removeEntity(this.id);
    this.deps.damage.unregister(this.id);
    this.deps.entities.destroy(this.id);
    this.deps.world.removeRigidBody(this.body);
  }
}
