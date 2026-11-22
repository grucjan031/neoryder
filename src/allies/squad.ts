import { QueryFilterFlags, Ray } from '@dimforge/rapier3d-compat';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { Health } from '../combat/damage';
import type { DamageSystem, Hurtboxes } from '../combat/damage';
import type { ProjectileSystem } from '../combat/weapons/projectiles';
import type { GameContext } from '../core/context';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';
import { Ally } from './ally';
import type {
  AllyEnvironment,
  AllyEvent,
  AllyHostile,
  AllyLeader,
  AllyNavigation,
  AllyOrder,
  AllyReviveSource,
  AllySnapshot,
} from './ally';
import { allyDefinitions } from './allySchema';
import type { AllyBark } from './allySchema';
import { selectHostileTarget } from './targeting';
import type { HostileCandidate } from './targeting';

type RapierModule = typeof import('@dimforge/rapier3d-compat');

export interface SquadLeader extends AllyLeader {
  id: EntityId;
}

/** To, czego drużyna potrzebuje od sceny walki (RoomScene i kolejne tryby). */
export interface SquadHost {
  ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>;
  rapier: RapierModule;
  world: World;
  entities: EntityRegistry;
  damage: DamageSystem;
  hurtboxes: Hurtboxes;
  projectiles: ProjectileSystem;
  navigation(): AllyNavigation | null;
  leader(): SquadLeader;
  /** Żywi wrogowie: stopy i wysokość środka sylwetki. */
  hostiles(): readonly Omit<AllyHostile, 'attackingPlayer'>[];
}

export interface AllyPose {
  position: Vec3;
  yaw: number;
}

interface Member {
  ally: Ally;
  collider: Collider;
  previous: AllyPose;
}

export type SquadCommandRegister = (
  name: string,
  help: string,
  run: (args: string[]) => string,
) => void;

/**
 * Drużyna gracza: tworzy sojuszników z danych, spina ich z modelem obrażeń (zdrowie, hurtbox,
 * pociski drużyny gracza), podaje im świat przez Rapiera i wybiera cele wrogom (`targetFor`).
 */
export class AllySquad {
  private readonly members: Member[] = [];
  private readonly off: (() => void)[] = [];
  /** Kto ostatnio ranił gracza: id wroga → czas drużyny. */
  private readonly attackers = new Map<EntityId, number>();
  /** Bieżący cel każdego wroga (histereza wyboru). */
  private readonly enemyTargets = new Map<EntityId, EntityId>();
  private hostileCache: AllyHostile[] = [];
  private timeS = 0;
  private _order: AllyOrder = 'follow';
  private readonly env: AllyEnvironment;

  constructor(private readonly host: SquadHost) {
    const { bus } = host.ctx;
    this.env = {
      navigation: () => host.navigation(),
      clear: (from, to) => this.clear(from, to),
      ground: (point) => this.ground(point),
      hostiles: () => this.hostileCache,
      leader: () => host.leader(),
      mates: (self) =>
        this.members
          .filter((m) => m.ally !== self && !m.ally.down)
          .map((m) => m.ally.position),
      fire: (self, shot) => {
        const w = self.definition.weapon;
        host.projectiles.spawn({
          owner: self.entity,
          team: 'player',
          origin: shot.origin,
          dir: shot.dir,
          speed: w.projectileSpeed,
          damage: host.damage.stats(self.entity)?.get('damage') ?? w.damage,
          lifetimeS: w.projectileLifetimeS,
          tags: w.tags,
        });
      },
      emit: (self, event) => this.emit(self, event),
    };
    this.off.push(
      bus.on('damage_dealt', ({ source, target, killed }) => {
        if (source !== null && target === host.leader().id)
          this.attackers.set(source, this.timeS);
        if (!killed) return;
        const member = this.members.find((m) => m.ally.entity === target);
        if (member) {
          member.ally.knockDown(source);
          this.sync(member);
        }
      }),
      bus.on('enemy_killed', ({ id, killer }) => {
        this.attackers.delete(id);
        this.enemyTargets.delete(id);
        const member = this.members.find((m) => m.ally.entity === killer);
        if (member) member.ally.kills++;
      }),
    );
  }

  get size(): number {
    return this.members.length;
  }
  get order(): AllyOrder {
    return this._order;
  }
  /** Zabójstwa całej drużyny (bez gracza). */
  get kills(): number {
    return this.members.reduce((sum, m) => sum + m.ally.kills, 0);
  }

  get(id: string): Ally | undefined {
    return this.members.find((m) => m.ally.definition.id === id)?.ally;
  }

  /** Dodaje sojusznika z `src/data/allies`; null, gdy już jest w drużynie albo brak miejsca. */
  add(id: string, feet: Vec3): Ally | null {
    const definition = allyDefinitions.get(id);
    if (!definition) throw new Error(`Nieznany sojusznik: ${id}`);
    const t = this.host.ctx.tuning.allies;
    if (this.get(id) || this.members.length >= t.maxSquad) return null;
    const { entities, damage, hurtboxes, world, rapier } = this.host;
    // Drużyna neutralna w rejestrze: powalenie nie emituje `player_died` ani `enemy_killed`.
    const entity = entities.create(`ally:${id}`, 'neutral');
    const stats = new Stats({
      maxHealth: definition.hp,
      moveSpeed: definition.moveSpeed,
      damage: definition.weapon.damage,
    });
    const health = new Health(() => stats.get('maxHealth'));
    const taken = new Set<number>(this.members.map((m) => m.ally.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const ally = new Ally(
      entity,
      definition,
      slot,
      feet,
      health,
      stats,
      this.env,
      t,
      this.host.ctx.rng.fork(`ally:${id}`),
    );
    damage.register(entity, health, {
      stats,
      invulnerable: () => ally.invulnerable,
      // Gracz i drużyna nie ranią sojuszników (wybuchy, moce obszarowe).
      guard: (info) => (this.friendly(info.source) ? 0 : 1),
    });
    // Sensor: trafiają go pociski i ciosy wrogów, ale nikogo nie blokuje (gracz przechodzi).
    const collider = world.createCollider(
      rapier.ColliderDesc.capsule(
        Math.max(0.01, t.colliderHeightM / 2 - t.colliderRadiusM),
        t.colliderRadiusM,
      )
        .setSensor(true)
        .setCollisionGroups(
          interactionGroups(
            CollisionGroup.Player,
            CollisionGroup.EnemyProjectile | CollisionGroup.Enemy,
          ),
        ),
    );
    hurtboxes.add(entity, collider);
    entities.bindCollider(entity, collider.handle);
    const member: Member = { ally, collider, previous: pose(ally) };
    this.members.push(member);
    ally.setOrder(this._order);
    this.sync(member);
    this.host.ctx.bus.emit('ally_spawned', { id: entity, ally: id });
    return ally;
  }

  remove(id: string): boolean {
    const index = this.members.findIndex((m) => m.ally.definition.id === id);
    if (index < 0) return false;
    this.release(this.members[index]!);
    this.members.splice(index, 1);
    return true;
  }

  setOrder(order: AllyOrder): void {
    if (order === this._order) return;
    this._order = order;
    for (const { ally } of this.members) ally.setOrder(order);
    this.host.ctx.bus.emit('ally_order', { order });
  }

  toggleOrder(): AllyOrder {
    this.setOrder(this._order === 'follow' ? 'hold' : 'follow');
    return this._order;
  }

  /** Powalony sojusznik w zasięgu gracza (najbliższy), którego można teraz podnieść. */
  reviveCandidate(): Ally | null {
    const leader = this.host.leader();
    if (!leader.alive) return null;
    const t = this.host.ctx.tuning.allies;
    let best: Ally | null = null;
    let bestD = t.reviveRadiusM;
    for (const { ally } of this.members) {
      if (!ally.down || ally.evacuated) continue;
      const d = Math.hypot(
        ally.position.x - leader.position.x,
        ally.position.y - leader.position.y,
        ally.position.z - leader.position.z,
      );
      if (d <= bestD) {
        best = ally;
        bestD = d;
      }
    }
    return best;
  }

  /** `reviveHeld`: gracz trzyma klawisz interakcji (podnoszenie powalonego w zasięgu). */
  step(dt: number, reviveHeld: boolean): void {
    if (!(dt > 0) || this.members.length === 0) return;
    this.timeS += dt;
    const memory = this.host.ctx.tuning.allies.threatMemoryS;
    this.hostileCache = this.host.hostiles().map((hostile) => ({
      ...hostile,
      attackingPlayer:
        (this.attackers.get(hostile.id) ?? -Infinity) > this.timeS - memory,
    }));
    if (reviveHeld) this.reviveCandidate()?.assist();
    for (const member of this.members) {
      member.previous = pose(member.ally);
      member.ally.step(dt);
      this.sync(member);
    }
  }

  /**
   * Cel wroga spośród drużyny gracza. `player` to gracz jako kandydat (null, gdy nie żyje);
   * bez aktywnych sojuszników wynik jest taki sam jak dawne `getTarget`.
   */
  targetFor(
    enemy: { id: EntityId | null; position: Vec3 },
    player: Omit<HostileCandidate, 'kind'> | null,
  ): { id: EntityId; position: Vec3; yaw?: number } | null {
    const candidates: HostileCandidate[] = player
      ? [{ ...player, kind: 'player' }]
      : [];
    for (const { ally } of this.members)
      if (!ally.down)
        candidates.push({
          id: ally.entity,
          position: ally.center(),
          kind: 'ally',
          // Wrogowie liczą przód celu jak u gracza (−sin, −cos).
          yaw: ally.yaw + Math.PI,
        });
    const t = this.host.ctx.tuning.allies;
    const picked = selectHostileTarget(enemy.position, candidates, {
      allyBias: t.enemyAllyBias,
      stickyBias: t.enemyStickyBias,
      currentId: enemy.id === null ? null : this.enemyTargets.get(enemy.id),
    });
    if (!picked) return null;
    if (enemy.id !== null) this.enemyTargets.set(enemy.id, picked.id);
    return {
      id: picked.id,
      position: picked.position,
      ...(picked.yaw !== undefined ? { yaw: picked.yaw } : {}),
    };
  }

  /** Powala sojusznika (debug, skrypty misji). */
  knockDown(id: string): boolean {
    const ally = this.get(id);
    if (!ally || ally.down) return false;
    ally.knockDown(null);
    return true;
  }

  revive(id: string, by: AllyReviveSource = 'debug'): boolean {
    const ally = this.get(id);
    if (!ally?.down) return false;
    ally.revive(by);
    return true;
  }

  /**
   * Checkpoint: powaleni wstają z pełnym zdrowiem. Z `at` cała drużyna staje przy tym punkcie
   * (respawn gracza); bez niego wracają tylko ci, którzy nie doczekali pomocy — przy graczu.
   */
  restore(at?: Vec3): void {
    const leader = this.host.leader();
    for (const member of this.members) {
      const { ally } = member;
      if (!at && !ally.evacuated) continue;
      ally.revive('checkpoint', this.spot(at ?? leader.position, ally.slot));
      member.previous = pose(ally);
      this.sync(member);
    }
  }

  bark(kind: AllyBark): void {
    this.members.find((m) => !m.ally.down)?.ally.bark(kind);
  }

  snapshots(): AllySnapshot[] {
    return this.members.map((m) => m.ally.snapshot());
  }

  /** Pozy do interpolacji w `render(alpha)`. */
  forEachPose(
    cb: (ally: Ally, previous: AllyPose, current: AllyPose) => void,
  ): void {
    for (const member of this.members)
      cb(member.ally, member.previous, pose(member.ally));
  }

  registerCommands(register: SquadCommandRegister): void {
    const ids = [...allyDefinitions.keys()].join('|');
    register(
      'ally spawn',
      `ally spawn <${ids}> — sojusznik przy graczu`,
      (a) => {
        const id = a[0] ?? '';
        if (a.length !== 1 || !allyDefinitions.has(id))
          return `Użycie: ally spawn <${ids}>`;
        const leader = this.host.leader();
        const ally = this.add(
          id,
          this.spot(leader.position, this.members.length),
        );
        return ally
          ? `Sojusznik ${ally.definition.name} w drużynie.`
          : 'Sojusznik już jest w drużynie albo brak miejsca.';
      },
    );
    register('ally down', 'ally down <id> — powal sojusznika', (a) =>
      a.length === 1 && this.knockDown(a[0]!)
        ? 'Sojusznik powalony.'
        : 'Brak takiego stojącego sojusznika.',
    );
    register('ally revive', 'ally revive <id> — podnieś sojusznika', (a) =>
      a.length === 1 && this.revive(a[0]!)
        ? 'Sojusznik podniesiony.'
        : 'Brak takiego powalonego sojusznika.',
    );
    register('ally hold', 'ally hold — drużyna trzyma pozycję', () => {
      this.setOrder('hold');
      return 'Drużyna trzyma pozycję.';
    });
    register('ally follow', 'ally follow — drużyna idzie za graczem', () => {
      this.setOrder('follow');
      return 'Drużyna idzie za graczem.';
    });
    register('ally status', 'ally status — stan drużyny', () =>
      JSON.stringify(this.snapshots()),
    );
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    for (const member of this.members.splice(0)) this.release(member);
    this.attackers.clear();
    this.enemyTargets.clear();
  }

  // ------------------------------------------------------------------ wnętrze

  private release(member: Member): void {
    const { entities, damage, hurtboxes, world } = this.host;
    const id = member.ally.entity;
    hurtboxes.removeEntity(id);
    damage.unregister(id);
    entities.destroy(id);
    world.removeCollider(member.collider, false);
  }

  private friendly(source: EntityId | null): boolean {
    return (
      source !== null &&
      (this.host.entities.team(source) === 'player' ||
        this.members.some((m) => m.ally.entity === source))
    );
  }

  /** Hurtbox idzie za sojusznikiem; powalony nie przyjmuje trafień. */
  private sync(member: Member): void {
    const t = this.host.ctx.tuning.allies;
    const p = member.ally.position;
    member.collider.setTranslation({
      x: p.x,
      y: p.y + t.colliderHeightM / 2,
      z: p.z,
    });
    member.collider.setEnabled(!member.ally.down);
  }

  /** Miejsce dla sojusznika wokół punktu (pierścień wg slotu); bez podłoża sam punkt. */
  private spot(center: Vec3, slot: number): Vec3 {
    const t = this.host.ctx.tuning.allies;
    const angle = (slot * Math.PI * 2) / t.maxSquad + Math.PI / 4;
    const point = {
      x: center.x + Math.sin(angle) * t.regroupRadiusM,
      y: center.y,
      z: center.z + Math.cos(angle) * t.regroupRadiusM,
    };
    const ground = this.ground(point);
    const lift = (v: Vec3): Vec3 => ({ ...v, y: v.y + t.chestM });
    return ground !== null &&
      Math.abs(ground - center.y) <= t.maxStepM &&
      this.clear(lift(center), lift(point))
      ? { ...point, y: ground }
      : { ...center };
  }

  private clear(from: Vec3, to: Vec3): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    if (length <= 1e-6) return true;
    return (
      this.host.world.castRay(
        new Ray(from, { x: dx / length, y: dy / length, z: dz / length }),
        length,
        true,
        QueryFilterFlags.EXCLUDE_SENSORS,
        interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      ) === null
    );
  }

  private ground(point: Vec3): number | null {
    const t = this.host.ctx.tuning.allies;
    // Start tuż ponad progiem: stopień w górę jeszcze łapie, strop nad głową już nie.
    const lift = t.maxStepM + 0.2;
    const hit = this.host.world.castRay(
      new Ray(
        { x: point.x, y: point.y + lift, z: point.z },
        { x: 0, y: -1, z: 0 },
      ),
      lift + t.groundProbeM,
      true,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    return hit ? point.y + lift - hit.timeOfImpact : null;
  }

  private emit(self: Ally, event: AllyEvent): void {
    const { bus } = this.host.ctx;
    const base = { id: self.entity, ally: self.definition.id };
    if (event.type === 'state')
      bus.emit('ally_state', { ...base, from: event.from, to: event.to });
    else if (event.type === 'downed')
      bus.emit('ally_downed', { ...base, source: event.source });
    else if (event.type === 'revived')
      bus.emit('ally_revived', { ...base, by: event.by });
    else if (event.type === 'evacuated') bus.emit('ally_evacuated', base);
    else bus.emit('ally_bark', { ...base, kind: event.kind, text: event.text });
  }
}

function pose(ally: Ally): AllyPose {
  return { position: { ...ally.position }, yaw: ally.yaw };
}
