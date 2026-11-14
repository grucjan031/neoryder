import { Ray } from '@dimforge/rapier3d-compat';
import { Health, PIERCE_BLOCK_TAG } from '../combat/damage';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';
import { gunnerFields } from './enemySchema';
import type { EnemyDefinition } from './enemySchema';
import { EnemyBody } from './enemyBody';
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

export class Gunner implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  previous: EnemySnapshot;
  current: EnemySnapshot;
  removed = false;
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
      ctx.bus.on('damage_dealt', (event) => {
        if (
          event.target !== this.id ||
          this.current.state === 'dead' ||
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
      tags: ['#gun'],
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
        Math.abs(delta) <= turn + epsilon
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
    let vx = 0,
      vz = 0;
    if (s.state === 'reposition' && target && distance > epsilon) {
      this.probeS -= dt;
      if (this.probeS <= 0) {
        this.avoid = this.body.wallAhead(
          Math.atan2(dx, dz),
          this.ctx.tuning.enemies.wallProbe,
        )
          ? this.strafe
          : 0;
        this.probeS =
          this.ctx.tuning.enemies.wallProbe / this.stats.get('moveSpeed') +
          this.rng.float(0, d.repathJitter);
      }
      const radial =
        !los || distance > r.preferredRange + r.rangeTolerance
          ? 1
          : distance < r.preferredRange - r.rangeTolerance
            ? -1
            : 0;
      const lateral = this.avoid || this.strafe * r.strafeScale;
      const norm = Math.hypot(radial, lateral) || 1;
      const speed = this.stats.get('moveSpeed');
      vx = ((dx * radial + dz * lateral) / distance / norm) * speed;
      vz = ((dz * radial - dx * lateral) / distance / norm) * speed;
    }
    for (const neighbor of this.deps.getNeighbors?.() ?? []) {
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
