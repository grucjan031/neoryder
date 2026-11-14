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
import type {
  Enemy,
  EnemyDependencies,
  EnemySnapshot,
  EnemyState,
} from './types';

const epsilon = 1e-6;
const identity = { x: 0, y: 0, z: 0, w: 1 };
const copy = (s: EnemySnapshot): EnemySnapshot => ({
  ...s,
  position: { ...s.position },
});

/**
 * Dron (F2-13): lata bez character controllera — kinematyczna kula na stałej wysokości
 * (`hoverHeightM` nad spawnem), krąży wokół celu w odległości `preferredRange` i strzela seriami
 * jak Strzelec (token 'shot' dyrektora). Ruch sprawdza `castShape` kuli po świecie: przy ścianie
 * zatrzymuje się przed nią i zmienia kierunek krążenia. Pozycja snapshotów to środek drona.
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
  private orbit: 1 | -1;
  private stunS = 0;
  private shots = 0;
  private nextShotS = 0;
  private token = false;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    private readonly deps: EnemyDependencies,
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
    deps.damage.register(
      this.id,
      new Health(() => this.stats.get('maxHealth')),
      { stats: this.stats },
    );
    this.altitude = position.y + this.flight.hoverHeightM;
    const center = { x: position.x, y: this.altitude, z: position.z };
    this.body = deps.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      ),
    );
    this.hurtbox = deps.world.createCollider(
      ColliderDesc.ball(this.flight.radiusM)
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
          event.killed
        )
          return;
        const dir = event.dir;
        const push = event.knockback * (1 - definition.knockbackResist);
        if (dir && push > 0) {
          const length = Math.hypot(dir.x, dir.y, dir.z) || 1;
          this.impulse.x += (dir.x / length) * push;
          this.impulse.y += (dir.y / length) * push;
          this.impulse.z += (dir.z / length) * push;
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
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id === this.id && this.current.state !== 'dead')
          this.transition('dead');
      }),
    );
  }

  private transition(state: EnemyState): void {
    this.current.state = state;
    this.current.stateTimeS = 0;
    if (state !== 'aim' && state !== 'burst') {
      if (this.token) this.deps.director?.releaseToken(this.id);
      this.token = false;
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
    const dx = target.x - origin.x,
      dy = target.y - origin.y,
      dz = target.z - origin.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= epsilon) return true;
    return (
      this.deps.world.castRay(
        new Ray(origin, {
          x: dx / distance,
          y: dy / distance,
          z: dz / distance,
        }),
        distance,
        true,
        undefined,
        interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      ) === null
    );
  }

  private fire(target: Vec3): void {
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
    const stunned = this.deps.statuses?.remaining(this.id, STUNNED) ?? 0;
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
      else if (s.state === 'aim' && s.stateTimeS + epsilon >= r.aimTelegraphS)
        this.transition('burst');
      else if (s.state === 'cooldown' && s.stateTimeS + epsilon >= d.cooldownS)
        this.transition('reposition');
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
    if (target && (s.state === 'reposition' || s.state === 'cooldown')) {
      const bearing = Math.atan2(
        s.position.x - target.position.x,
        s.position.z - target.position.z,
      );
      const next =
        bearing +
        this.orbit * ((this.flight.orbitSpeedDegS * Math.PI) / 180) * dt;
      const goal = {
        x: target.position.x + Math.sin(next) * r.preferredRange,
        y: this.altitude,
        z: target.position.z + Math.cos(next) * r.preferredRange,
      };
      const gx = goal.x - s.position.x,
        gy = goal.y - s.position.y,
        gz = goal.z - s.position.z;
      const gap = Math.hypot(gx, gy, gz);
      if (gap > epsilon) {
        const speed = Math.min(this.stats.get('moveSpeed'), gap / dt);
        vx = (gx / gap) * speed;
        vy = (gy / gap) * speed;
        vz = (gz / gap) * speed;
      }
    } else if (s.state !== 'stunned') {
      // Powrót na wysokość lotu po odrzucie.
      vy = (this.altitude - s.position.y) / Math.max(dt, epsilon);
      vy = Math.max(
        -this.stats.get('moveSpeed'),
        Math.min(this.stats.get('moveSpeed'), vy),
      );
    }
    for (const neighbor of this.deps.getNeighbors?.() ?? []) {
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
    const moved = this.move({
      x: (vx + this.impulse.x) * dt,
      y: (vy + this.impulse.y) * dt,
      z: (vz + this.impulse.z) * dt,
    });
    const damping = Math.exp(-this.flight.knockbackDamping * dt);
    this.impulse.x *= damping;
    this.impulse.y *= damping;
    this.impulse.z *= damping;
    s.speed = moved / dt;
    s.distance += moved;
  }

  /** Przesuwa kulę o `delta`, zatrzymując się `skinM` przed światem. Zwraca przebytą drogę. */
  private move(delta: Vec3): number {
    const length = Math.hypot(delta.x, delta.y, delta.z);
    if (length <= epsilon) return 0;
    const from = this.current.position;
    const hit = this.deps.world.castShape(
      from,
      identity,
      delta,
      this.shape,
      this.flight.skinM,
      1,
      false,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      undefined,
      this.body,
    );
    const t = hit ? Math.max(0, hit.time_of_impact) : 1;
    if (hit) {
      // Ściana na drodze: odwróć krążenie i wygaś odrzut, żeby nie wciskać się w nią dalej.
      this.orbit = this.orbit === 1 ? -1 : 1;
      this.impulse.x = this.impulse.y = this.impulse.z = 0;
    }
    const next = {
      x: from.x + delta.x * t,
      y: from.y + delta.y * t,
      z: from.z + delta.z * t,
    };
    this.body.setNextKinematicTranslation(next);
    this.current.position = next;
    return length * t;
  }

  private engage(): boolean {
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
