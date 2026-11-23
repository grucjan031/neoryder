import { Ball, Ray } from '@dimforge/rapier3d-compat';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import type { EntityRegistry } from '../../core/entities';
import type { EntityId, EventBus, Team } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import type { DamageSystem, Hurtboxes } from '../damage';
import type { StatusApplication } from '../damage/types';
import { CollisionGroup, interactionGroups } from '../../physics';
import { queryHurtboxes } from '../damage/hurtbox';
import { blasterDefinition } from './weaponSchema';

export interface ProjectileSpec {
  owner: EntityId;
  team: Team;
  origin: Vec3;
  dir: Vec3;
  speed: number;
  damage: number;
  tags: readonly string[];
  /** Domyślnie czas życia z danych blastera. */
  lifetimeS?: number;
  statuses?: readonly StatusApplication[];
  pierce?: { count: number; falloff: number };
  ricochets?: number;
  gravity?: number;
  explode?: {
    radiusM: number;
    damage: number;
    tags: readonly string[];
    statuses?: readonly StatusApplication[];
  };
}

/** Trafienie pocisku w hurtbox, zanim zada obrażenia (np. parowanie ostrzem). */
export interface ProjectileHit {
  projectile: EntityId;
  owner: EntityId;
  team: Team;
  target: EntityId;
  point: Vec3;
  dir: Vec3;
  speed: number;
}

/** Zwraca true, gdy przejął trafienie (np. odbił pocisk przez reflect) — obrażeń nie ma. */
export type ProjectileInterceptor = (hit: ProjectileHit) => boolean;

interface Projectile {
  id: EntityId | null;
  owner: EntityId;
  team: Team;
  pos: Vec3;
  dir: Vec3;
  speed: number;
  damage: number;
  tags: readonly string[];
  remainingS: number;
  lifetimeS: number;
  order: number;
  statuses: readonly StatusApplication[] | undefined;
  hitsRemaining: number;
  ricochetsRemaining: number;
  falloff: number;
  hitTargets: EntityId[];
  gravity: number;
  velocityY: number;
  velocityX: number;
  velocityZ: number;
  explode: ProjectileSpec['explode'];
}

export class ProjectileSystem {
  private readonly pool: Projectile[];
  private readonly interceptors: ProjectileInterceptor[] = [];
  private sequence = 0;

  constructor(
    private readonly world: World,
    private readonly entities: EntityRegistry,
    private readonly hurtboxes: Hurtboxes,
    private readonly damage: DamageSystem,
    private readonly bus: EventBus,
    tuning: Pick<Tuning, 'weapons'>,
  ) {
    this.pool = Array.from(
      { length: Math.max(1, Math.floor(tuning.weapons.maxProjectiles)) },
      (): Projectile => ({
        id: null,
        owner: 0,
        team: 'neutral',
        pos: { x: 0, y: 0, z: 0 },
        dir: { x: 0, y: 0, z: -1 },
        speed: 0,
        damage: 0,
        tags: [],
        remainingS: 0,
        lifetimeS: 0,
        order: 0,
        statuses: undefined,
        hitsRemaining: 1,
        ricochetsRemaining: 0,
        falloff: 0,
        hitTargets: [],
        gravity: 0,
        velocityY: 0,
        velocityX: 0,
        velocityZ: 0,
        explode: undefined,
      }),
    );
  }

  spawn(spec: ProjectileSpec): EntityId {
    const dir = normalized(spec.dir);
    const slot =
      this.pool.find((p) => p.id === null) ??
      this.pool.reduce((oldest, p) => (p.order < oldest.order ? p : oldest));
    this.release(slot);
    slot.hitTargets.length = 0;
    const id = this.entities.create('projectile', spec.team);
    Object.assign(slot, {
      id,
      owner: spec.owner,
      team: spec.team,
      speed: spec.speed,
      damage: spec.damage,
      tags: [...spec.tags],
      remainingS: spec.lifetimeS ?? blasterDefinition.projectileLifetimeS,
      lifetimeS: spec.lifetimeS ?? blasterDefinition.projectileLifetimeS,
      order: this.sequence++,
      statuses: spec.statuses?.map((status) => ({ ...status })),
      hitsRemaining: spec.pierce?.count ?? 1,
      ricochetsRemaining: spec.ricochets ?? 0,
      falloff: spec.pierce?.falloff ?? 0,
      gravity: spec.gravity ?? 0,
      velocityY: dir.y * spec.speed,
      velocityX: dir.x * spec.speed,
      velocityZ: dir.z * spec.speed,
      explode: spec.explode
        ? {
            ...spec.explode,
            tags: [...spec.explode.tags],
            statuses: spec.explode.statuses?.map((status) => ({ ...status })),
          }
        : undefined,
    });
    Object.assign(slot.pos, spec.origin);
    Object.assign(slot.dir, dir);
    this.bus.emit('projectile_spawned', {
      id,
      owner: spec.owner,
      team: spec.team,
    });
    return id;
  }

  /** Rejestruje przechwytywanie trafień; zwraca funkcję wyrejestrowania. */
  addInterceptor(interceptor: ProjectileInterceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      const i = this.interceptors.indexOf(interceptor);
      if (i >= 0) this.interceptors.splice(i, 1);
    };
  }

  reflect(
    id: EntityId,
    newOwner: EntityId,
    newTeam: Team,
    dir: Vec3,
    opts: { speedMult?: number; damageMult?: number } = {},
  ): void {
    const p = this.pool.find((p) => p.id === id);
    if (!p) return;
    Object.assign(p.dir, normalized(dir));
    p.speed *= opts.speedMult ?? 1;
    p.velocityY = p.dir.y * p.speed;
    p.velocityX = p.dir.x * p.speed;
    p.velocityZ = p.dir.z * p.speed;
    p.damage *= opts.damageMult ?? 1;
    p.owner = newOwner;
    p.team = newTeam;
    p.hitTargets.length = 0;
    p.remainingS = p.lifetimeS;
    this.entities.setTeam(id, newTeam);
    this.bus.emit('projectile_reflected', { id, newOwner });
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const p of this.pool) {
      if (p.id === null) continue;
      const id = p.id;
      const travelS = Math.min(dt, Math.max(0, p.remainingS));
      let distance = p.speed * travelS;
      if (p.gravity !== 0) {
        const dx = p.velocityX * travelS;
        const dy = p.velocityY * travelS - (p.gravity * travelS * travelS) / 2;
        const dz = p.velocityZ * travelS;
        p.velocityY -= p.gravity * travelS;
        distance = Math.hypot(dx, dy, dz);
        if (distance > 0)
          Object.assign(p.dir, {
            x: dx / distance,
            y: dy / distance,
            z: dz / distance,
          });
      }
      let intercepted = false;
      while (distance > 0 && p.id === id) {
        const member =
          p.team === 'player'
            ? CollisionGroup.PlayerProjectile
            : p.team === 'enemy'
              ? CollisionGroup.EnemyProjectile
              : CollisionGroup.PlayerProjectile |
                CollisionGroup.EnemyProjectile;
        const targets =
          CollisionGroup.World |
          (p.team === 'player'
            ? CollisionGroup.Enemy
            : p.team === 'enemy'
              ? CollisionGroup.Player
              : CollisionGroup.Player | CollisionGroup.Enemy);
        const hit = this.world.castRayAndGetNormal(
          new Ray(p.pos, p.dir),
          distance,
          true,
          undefined,
          interactionGroups(member, targets),
          undefined,
          undefined,
          (collider) => this.canHit(collider, p),
        );
        if (hit) {
          const box = this.hurtboxes.get(hit.collider.handle);
          const point = {
            x: p.pos.x + p.dir.x * hit.timeOfImpact,
            y: p.pos.y + p.dir.y * hit.timeOfImpact,
            z: p.pos.z + p.dir.z * hit.timeOfImpact,
          };
          const info = {
            amount: p.damage * (box?.multiplier ?? 1),
            source: p.owner,
            tags: p.tags,
            point,
            dir: { ...p.dir },
            ...(p.statuses ? { statuses: p.statuses } : {}),
          };
          if (box && p.id !== null) {
            const hitInfo: ProjectileHit = {
              projectile: p.id,
              owner: p.owner,
              team: p.team,
              target: box.entity,
              point,
              dir: { ...p.dir },
              speed: p.speed,
            };
            if (
              [...this.interceptors].some((intercept) => intercept(hitInfo))
            ) {
              if (p.id !== id) break;
              // Przejęty (np. odbity): pocisk zostaje tuż przed punktem trafienia i leci dalej.
              p.pos.x = point.x - hitInfo.dir.x * 0.05;
              p.pos.y = point.y - hitInfo.dir.y * 0.05;
              p.pos.z = point.z - hitInfo.dir.z * 0.05;
              intercepted = true;
              break;
            }
          }
          if (p.id !== id) break;
          if (!box)
            this.bus.emit('world_hit', {
              point: { ...point },
              normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
              owner: p.owner,
              tags: p.tags,
            });
          if (!box && p.ricochetsRemaining > 0) {
            const normal = hit.normal;
            const dot =
              p.dir.x * normal.x + p.dir.y * normal.y + p.dir.z * normal.z;
            p.dir.x -= 2 * dot * normal.x;
            p.dir.y -= 2 * dot * normal.y;
            p.dir.z -= 2 * dot * normal.z;
            const velocityDot =
              p.velocityX * normal.x +
              p.velocityY * normal.y +
              p.velocityZ * normal.z;
            p.velocityX -= 2 * velocityDot * normal.x;
            p.velocityY -= 2 * velocityDot * normal.y;
            p.velocityZ -= 2 * velocityDot * normal.z;
            p.ricochetsRemaining--;
            // Tolerancja numeryczna Rapier: kolejny ray zaczyna się poza powierzchnią.
            const separation = 1e-4;
            p.pos.x = point.x + p.dir.x * separation;
            p.pos.y = point.y + p.dir.y * separation;
            p.pos.z = point.z + p.dir.z * separation;
            distance = Math.max(0, distance - hit.timeOfImpact - separation);
            continue;
          }
          if (p.explode) {
            Object.assign(p.pos, point);
            const directTarget = box?.entity;
            this.detonate(
              p,
              directTarget === undefined
                ? undefined
                : () => this.damage.deal(directTarget, info),
            );
            break;
          }
          // Zapisujemy trafienie lub zwalniamy slot przed synchroniczną emisją obrażeń.
          if (box) {
            p.hitTargets.push(box.entity);
            p.hitsRemaining--;
            p.damage *= 1 - p.falloff;
          }
          Object.assign(p.pos, point);
          distance = Math.max(0, distance - hit.timeOfImpact);
          if (!box || p.hitsRemaining <= 0) this.release(p);
          if (box) this.damage.deal(box.entity, info);
          continue;
        }
        p.pos.x += p.dir.x * distance;
        p.pos.y += p.dir.y * distance;
        p.pos.z += p.dir.z * distance;
        break;
      }
      if (p.id !== id || intercepted) continue;
      p.remainingS -= dt;
      if (p.remainingS <= Number.EPSILON) {
        if (p.explode) this.detonate(p);
        else this.release(p);
      }
    }
  }

  /**
   * Pocisk trafia tylko hurtboxy (nie właściciela) i geometrię świata. Collidery ruchu postaci
   * (kapsuła character controllera wroga) nie są celami — inaczej „połykają” strzały w głowę,
   * bo obejmują sensor głowy.
   */
  private canHit(collider: Collider, p: Projectile): boolean {
    const box = this.hurtboxes.get(collider.handle);
    if (box)
      return box.entity !== p.owner && !p.hitTargets.includes(box.entity);
    const membership = collider.collisionGroups() >>> 16;
    return (membership & CollisionGroup.World) !== 0;
  }

  forEachActive(
    cb: (id: EntityId, pos: Vec3, dir: Vec3, team: Team) => void,
  ): void {
    for (const p of this.pool)
      if (p.id !== null) cb(p.id, p.pos, p.dir, p.team);
  }

  get activeCount(): number {
    return this.pool.reduce((count, p) => count + Number(p.id !== null), 0);
  }

  dispose(): void {
    for (const p of this.pool) this.release(p);
  }

  private detonate(p: Projectile, directHit?: () => void): void {
    const explosion = p.explode!;
    const point = { ...p.pos };
    const owner = p.owner;
    const targets = queryHurtboxes(
      this.world,
      this.hurtboxes,
      new Ball(explosion.radiusM),
      point,
      { x: 0, y: 0, z: 0, w: 1 },
    );
    this.release(p);
    directHit?.();
    for (const box of targets) {
      if (box.entity === owner) continue;
      this.damage.deal(box.entity, {
        source: owner,
        amount: explosion.damage,
        tags: explosion.tags,
        point,
        ...(explosion.statuses ? { statuses: explosion.statuses } : {}),
      });
    }
    this.bus.emit('explosion', {
      point,
      radiusM: explosion.radiusM,
      owner,
      tags: explosion.tags,
    });
  }

  private release(p: Projectile): void {
    if (p.id === null) return;
    const id = p.id;
    p.id = null;
    this.entities.destroy(id);
  }
}

function normalized(dir: Vec3): Vec3 {
  const length = Math.hypot(dir.x, dir.y, dir.z);
  if (!(length > 0) || !Number.isFinite(length))
    throw new Error('Kierunek pocisku musi być skończony i niezerowy.');
  return { x: dir.x / length, y: dir.y / length, z: dir.z / length };
}
