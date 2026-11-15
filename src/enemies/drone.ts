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
      if (s.stateTimeS + epsilon >= this.ctx.tuning.enemies.corpseS)
        this.dispose();
      return;
    }
    if (s.controlled) {
      s.position = { ...this.body.translation() };
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

  /** Rzut kuli z `from` o `delta`; zwraca ułamek ruchu do kolizji (1 = bez przeszkody). */
  private sweep(from: Vec3, delta: Vec3): number {
    if (Math.hypot(delta.x, delta.y, delta.z) <= epsilon) return 1;
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
    return hit ? Math.max(0, Math.min(1, hit.time_of_impact)) : 1;
  }

  /**
   * Przesuwa kulę o `delta`, zatrzymując się `skinM` przed światem. Przy kolizji resztę ruchu
   * próbuje osobno w osiach x, z, y (ślizg wzdłuż ściany), więc dron nie zamarza, gdy cel orbity
   * leży za ścianą. Gdy nie przesunie się wcale, odwraca kierunek krążenia. Zwraca przebytą drogę.
   */
  private move(delta: Vec3): number {
    const length = Math.hypot(delta.x, delta.y, delta.z);
    if (length <= epsilon) return 0;
    const pos = { ...this.current.position };
    const t = this.sweep(pos, delta);
    pos.x += delta.x * t;
    pos.y += delta.y * t;
    pos.z += delta.z * t;
    let moved = length * t;
    if (t < 1) {
      this.impulse.x = this.impulse.y = this.impulse.z = 0;
      for (const axis of ['x', 'z', 'y'] as const) {
        const rest = delta[axis] * (1 - t);
        if (Math.abs(rest) <= epsilon) continue;
        const step = { x: 0, y: 0, z: 0, [axis]: rest };
        const k = this.sweep(pos, step);
        pos[axis] += rest * k;
        moved += Math.abs(rest) * k;
      }
      if (moved <= epsilon) this.orbit = this.orbit === 1 ? -1 : 1;
    }
    this.body.setNextKinematicTranslation(pos);
    this.current.position = pos;
    return moved;
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
