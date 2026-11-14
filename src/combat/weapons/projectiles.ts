import { Ray } from '@dimforge/rapier3d-compat';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import type { EntityRegistry } from '../../core/entities';
import type { EntityId, EventBus, Team } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import type { DamageSystem, Hurtboxes } from '../damage';
import { CollisionGroup, interactionGroups } from '../../physics';
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
  order: number;
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
        order: 0,
      }),
    );
  }

  spawn(spec: ProjectileSpec): EntityId {
    const dir = normalized(spec.dir);
    const slot =
      this.pool.find((p) => p.id === null) ??
      this.pool.reduce((oldest, p) => (p.order < oldest.order ? p : oldest));
    this.release(slot);
    const id = this.entities.create('projectile', spec.team);
    Object.assign(slot, {
      id,
      owner: spec.owner,
      team: spec.team,
      speed: spec.speed,
      damage: spec.damage,
      tags: [...spec.tags],
      remainingS: spec.lifetimeS ?? blasterDefinition.projectileLifetimeS,
      order: this.sequence++,
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
    p.damage *= opts.damageMult ?? 1;
    p.owner = newOwner;
    p.team = newTeam;
    this.entities.setTeam(id, newTeam);
    this.bus.emit('projectile_reflected', { id, newOwner });
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const p of this.pool) {
      if (p.id === null) continue;
      const travelS = Math.min(dt, Math.max(0, p.remainingS));
      const distance = p.speed * travelS;
      const member =
        p.team === 'player'
          ? CollisionGroup.PlayerProjectile
          : p.team === 'enemy'
            ? CollisionGroup.EnemyProjectile
            : CollisionGroup.PlayerProjectile | CollisionGroup.EnemyProjectile;
      const targets =
        CollisionGroup.World |
        (p.team === 'player'
          ? CollisionGroup.Enemy
          : p.team === 'enemy'
            ? CollisionGroup.Player
            : CollisionGroup.Player | CollisionGroup.Enemy);
      const hit =
        distance > 0
          ? this.world.castRayAndGetNormal(
              new Ray(p.pos, p.dir),
              distance,
              true,
              undefined,
              interactionGroups(member, targets),
              undefined,
              undefined,
              (collider) => this.canHit(collider, p.owner),
            )
          : null;
      if (hit) {
        const box = this.hurtboxes.get(hit.collider.handle);
        const point = {
          x: p.pos.x + p.dir.x * hit.timeOfImpact,
          y: p.pos.y + p.dir.y * hit.timeOfImpact,
          z: p.pos.z + p.dir.z * hit.timeOfImpact,
        };
        // Zwalniamy przed emisją obrażeń, aby synchroniczne handlery nie trafiły ponownie.
        const info = {
          amount: p.damage * (box?.multiplier ?? 1),
          source: p.owner,
          tags: p.tags,
          point,
          dir: { ...p.dir },
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
          if (this.interceptors.some((intercept) => intercept(hitInfo))) {
            // Przejęty (np. odbity): pocisk zostaje tuż przed punktem trafienia i leci dalej.
            p.pos.x = point.x - hitInfo.dir.x * 0.05;
            p.pos.y = point.y - hitInfo.dir.y * 0.05;
            p.pos.z = point.z - hitInfo.dir.z * 0.05;
            continue;
          }
        }
        this.release(p);
        if (box) this.damage.deal(box.entity, info);
        continue;
      }
      p.pos.x += p.dir.x * distance;
      p.pos.y += p.dir.y * distance;
      p.pos.z += p.dir.z * distance;
      p.remainingS -= dt;
      if (p.remainingS <= Number.EPSILON) this.release(p);
    }
  }

  /**
   * Pocisk trafia tylko hurtboxy (nie właściciela) i geometrię świata. Collidery ruchu postaci
   * (kapsuła character controllera wroga) nie są celami — inaczej „połykają” strzały w głowę,
   * bo obejmują sensor głowy.
   */
  private canHit(collider: Collider, owner: EntityId): boolean {
    if (this.hurtboxes.get(collider.handle))
      return this.entities.byCollider(collider.handle) !== owner;
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
