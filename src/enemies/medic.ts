import { Ray, QueryFilterFlags } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { CollisionGroup, interactionGroups } from '../physics';
import { Health } from '../combat/damage';
import { Stats } from '../core/stats';
import { EnemyBody } from './enemyBody';
import { turnToward, updateBodyPose } from './locomotion';
import type { Enemy, EnemySnapshot, EnemyState } from './types';
import { clearWorld } from './tactics';
import type { EnemyDefinition } from './enemySchema';
import type { EnemyDependencies } from './types';

type Parameters = NonNullable<EnemyDefinition['medic']>;
interface Flight {
  start: Vec3;
  end: Vec3;
  duration: number;
  age: number;
  previous: Vec3;
  position: Vec3;
  params: Parameters;
  source: number | null;
}
interface Zone {
  center: Vec3;
  remaining: number;
  params: Parameters;
  source: number | null;
}

function arc(flight: Flight, fraction: number): Vec3 {
  const { start, end, params } = flight;
  return {
    x: start.x + (end.x - start.x) * fraction,
    y:
      start.y +
      (end.y - start.y) * fraction +
      4 * params.arcHeightM * fraction * (1 - fraction),
    z: start.z + (end.z - start.z) * fraction,
  };
}

export class MedicFog {
  readonly flights: Flight[] = [];
  readonly zones: Zone[] = [];
  constructor(
    private readonly deps: EnemyDependencies,
    private readonly settings: Tuning['enemies']['medic'],
  ) {}

  launch(
    source: number | null,
    start: Vec3,
    target: Vec3,
    velocity: Vec3 | undefined,
    definition: EnemyDefinition,
  ): boolean {
    const params = definition.medic!;
    if (this.flights.length >= this.settings.maxZones) return false;
    const distance = Math.hypot(target.x - start.x, target.z - start.z);
    if (distance > definition.attackRange) return false;
    const duration = Math.max(1 / 60, distance / definition.projectileSpeed!);
    const above = {
      x: target.x + (velocity?.x ?? 0) * duration,
      y: target.y,
      z: target.z + (velocity?.z ?? 0) * duration,
    };
    if (
      Math.hypot(above.x - start.x, above.z - start.z) > definition.attackRange
    )
      return false;
    const ground = this.deps.world.castRay(
      new Ray(above, { x: 0, y: -1, z: 0 }),
      definition.attackRange,
      true,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    if (!ground) return false;
    const end = { ...above, y: above.y - ground.timeOfImpact + 0.01 };
    const flight: Flight = {
      source,
      start,
      end,
      duration,
      age: 0,
      previous: start,
      position: start,
      params,
    };
    let point = start;
    for (let i = 1; i <= this.settings.arcSegments; i++) {
      const next = arc(flight, i / this.settings.arcSegments);
      if (!clearWorld(this.deps, point, next)) return false;
      point = next;
    }
    this.flights.push(flight);
    return true;
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i]!;
      zone.remaining -= dt;
      if (zone.remaining <= 0) this.zones.splice(i, 1);
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i]!;
      flight.previous = flight.position;
      flight.age += dt;
      flight.position = arc(flight, Math.min(1, flight.age / flight.duration));
      if (flight.age >= flight.duration) {
        this.flights.splice(i, 1);
        if (this.zones.length >= this.settings.maxZones) this.zones.shift();
        this.zones.push({
          source: flight.source,
          center: flight.end,
          remaining: flight.params.fogDurationS,
          params: flight.params,
        });
      }
    }
    if (this.zones.length === 0) return;
    const target = this.deps.getTarget();
    if (!target || this.deps.entities.team(target.id) !== 'player') return;
    const feet = target.position.y - (target.height ?? 0) / 2;
    const zone = this.zones.find(
      (z) =>
        Math.abs(feet - z.center.y) <= this.settings.fogHeightM &&
        Math.hypot(
          target.position.x - z.center.x,
          target.position.z - z.center.z,
        ) <= z.params.fogRadiusM,
    );
    if (
      zone &&
      (!this.deps.statuses?.has(target.id, 'slowed') ||
        this.deps.statuses.remaining(target.id, 'slowed') <=
          zone.params.lingerS - dt * 0.5)
    )
      this.deps.statuses?.apply?.(
        target.id,
        { id: 'slowed', durationS: zone.params.lingerS },
        zone.source,
      );
  }

  clear(): void {
    this.flights.length = 0;
    this.zones.length = 0;
  }
}

export class Medic implements Enemy {
  readonly id: number;
  readonly stats: Stats;
  readonly current: EnemySnapshot;
  previous: EnemySnapshot;
  removed = false;
  private readonly body: EnemyBody;
  private readonly off: (() => void)[];
  private wait = 0;
  private cover?: Vec3;
  private exit?: Vec3;

  constructor(
    private readonly ctx: Pick<GameContext, 'bus' | 'tuning' | 'rng'>,
    private readonly deps: EnemyDependencies,
    readonly definition: EnemyDefinition,
    position: Vec3,
  ) {
    this.id = deps.entities.create('medic', 'enemy');
    this.stats = new Stats({
      maxHealth: definition.maxHealth,
      moveSpeed: definition.moveSpeed,
      damage: definition.damage,
    });
    for (const mod of deps.spawnModifiers ?? []) this.stats.add(mod);
    deps.damage.register(
      this.id,
      new Health(() => this.stats.get('maxHealth')),
      { stats: this.stats },
    );
    this.body = new EnemyBody(deps, this.id, definition.body!, position);
    this.current = {
      position: { ...position },
      state: 'idle',
      stateTimeS: 0,
      yaw: 0,
      speed: 0,
      distance: 0,
    };
    this.previous = { ...this.current };
    this.off = [
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id === this.id) {
          this.body.disableCollision();
          this.change('dead');
        }
      }),
      ctx.bus.on('damage_dealt', (e) => {
        if (e.target !== this.id || e.killed || !e.dir || e.knockback <= 0)
          return;
        this.body.knockback(
          e.dir,
          e.knockback * (1 - definition.knockbackResist),
          ctx.tuning.enemies,
          { source: e.source, tags: e.tags },
        );
        if (e.knockback >= ctx.tuning.enemies.stunKnockback)
          this.change('stunned');
      }),
    ];
  }
  private change(state: EnemyState): void {
    if (this.current.state !== state) {
      this.current.state = state;
      this.current.stateTimeS = 0;
    }
  }
  private seekCover(target: Vec3): void {
    const here = this.current.position,
      t = this.ctx.tuning.enemies,
      lift = this.definition.muzzle!.y;
    const eye = { ...here, y: here.y + lift };
    const offset = this.ctx.rng.float(0, Math.PI * 2);
    for (let i = 0; i < t.coverSamples; i++) {
      const angle = offset + (2 * Math.PI * i) / t.coverSamples;
      const point = {
        x: eye.x + t.coverRadiusM * Math.sin(angle),
        y: eye.y,
        z: eye.z + t.coverRadiusM * Math.cos(angle),
      };
      if (
        clearWorld(this.deps, eye, point) &&
        !clearWorld(this.deps, point, target) &&
        !clearWorld(this.deps, point, {
          ...point,
          y: here.y - t.coverGroundProbeM,
        })
      ) {
        this.cover = point;
        this.exit = { ...here };
        return;
      }
    }
  }
  step(dt: number): void {
    const s = this.current,
      d = this.definition,
      m = d.medic!;
    this.previous = { ...s, position: { ...s.position } };
    if (this.removed || !(dt > 0)) return;
    s.stateTimeS += dt;
    if (s.state === 'dead') {
      if (s.stateTimeS >= this.ctx.tuning.enemies.corpseS) this.dispose();
      return;
    }
    this.wait = Math.max(0, this.wait - dt);
    const target = this.deps.getTarget();
    let vx = 0,
      vz = 0;
    if (
      this.deps.statuses?.has(this.id, 'stunned') ||
      (s.state === 'stunned' && s.stateTimeS < d.stunOnHeavyS)
    )
      this.change('stunned');
    else if (!target) this.change('idle');
    else {
      const dx = target.position.x - s.position.x,
        dz = target.position.z - s.position.z;
      const range = Math.hypot(dx, dz);
      s.yaw = turnToward(s.yaw, Math.atan2(dx, dz), d.turnRateDegS, dt);
      const origin = { ...s.position, y: s.position.y + d.muzzle!.y };
      const sight = clearWorld(this.deps, origin, target.position);
      let goal: Vec3 | undefined;
      const near = d.preferredRange! - d.rangeTolerance!,
        far = d.preferredRange! + d.rangeTolerance!;
      if (range < m.panicRangeM) {
        this.cover = undefined;
        this.exit = undefined;
      }
      if (range < near) {
        const length = range || 1;
        goal = {
          x: s.position.x - (range ? dx / length : Math.sin(s.yaw)) * near,
          y: s.position.y,
          z: s.position.z - (range ? dz / length : Math.cos(s.yaw)) * near,
        };
      } else if (this.wait > 0 && this.cover) goal = this.cover;
      else if (this.exit) {
        goal = this.exit;
        this.cover = undefined;
        if (
          Math.hypot(goal.x - s.position.x, goal.z - s.position.z) <
          this.ctx.tuning.enemies.tacticArrivalM
        )
          this.exit = undefined;
      } else if (range > far || !sight) goal = target.position;
      if (goal) {
        this.change('reposition');
        const x = goal.x - s.position.x,
          z = goal.z - s.position.z,
          len = Math.hypot(x, z);
        if (len > 0) {
          const speed = Math.min(this.stats.get('moveSpeed'), len / dt);
          vx = (x / len) * speed;
          vz = (z / len) * speed;
        }
      } else if (s.state === 'swing' && s.stateTimeS < d.swingActiveS) {
        // Końcówka zamachu po wypuszczeniu strzykawki.
      } else if (this.wait > 0) this.change('cooldown');
      else if (s.state !== 'telegraph') {
        this.change('telegraph');
        this.ctx.bus.emit('enemy_telegraph', {
          id: this.id,
          kind: 'aim',
          durationS: d.telegraphS,
        });
      } else if (s.stateTimeS >= d.telegraphS) {
        const thrown = this.deps.medicFog?.launch(
          this.id,
          origin,
          target.position,
          target.velocity,
          d,
        );
        this.change(thrown ? 'swing' : 'reposition');
        this.wait = thrown ? m.throwCooldownS : d.recoveryS;
        if (thrown) this.seekCover(target.position);
      }
    }
    const move = this.body.move(dt, vx, vz, this.ctx.tuning);
    s.position = move.position;
    s.speed = move.distance / dt;
    s.distance += move.distance;
    updateBodyPose(
      this.previous,
      s,
      d.turnRateDegS,
      dt,
      this.ctx.tuning.enemies,
    );
  }
  dispose(): void {
    if (this.removed) return;
    this.removed = true;
    for (const off of this.off) off();
    this.deps.hurtboxes.removeEntity(this.id);
    this.deps.damage.unregister(this.id);
    this.deps.entities.destroy(this.id);
    this.body.dispose();
  }
}
