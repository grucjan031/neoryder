import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { AlarmGroup } from './alarm';
import { Perception, distance, observerPose as observer } from './perception';
import type { Enemy, EnemyDependencies } from './types';

/** Istnieje tylko w pokojach ze skradaniem. Wszystkie grupy słyszą to samo otoczenie. */
export class StealthEncounter {
  private readonly groups = new Map<string, AlarmGroup>();
  private readonly guards = new Map<EntityId, Enemy>();
  private readonly off: (() => void)[];
  constructor(
    private readonly ctx: Pick<GameContext, 'tuning' | 'bus'>,
    private readonly deps: EnemyDependencies,
    position: (id: EntityId) => Vec3 | null,
  ) {
    const c = ctx.tuning.enemies.perception;
    const sound = (point: Vec3 | null, radius: number, source: EntityId) => {
      if (!point) return;
      for (const enemy of this.guards.values())
        if (
          source !== enemy.id &&
          distance(observer(enemy).position, point) <= radius
        )
          enemy.perception!.suspect(point);
    };
    const origin = (id: EntityId) => {
      const player = deps.getTarget();
      return player?.id === id ? player.position : position(id);
    };
    this.off = [
      ctx.bus.on('weapon_fired', (e) =>
        sound(origin(e.owner), c.shotRadiusM, e.owner),
      ),
      ctx.bus.on('melee_swing', (e) =>
        sound(origin(e.attacker), c.bladeRadiusM, e.attacker),
      ),
      ctx.bus.on('explosion', (e) =>
        sound(e.point, c.explosionRadiusM, e.owner),
      ),
      ctx.bus.on('enemy_killed', ({ id }) => {
        const victim = this.guards.get(id);
        const point = victim ? observer(victim).position : position(id);
        this.remove(id);
        if (point)
          for (const other of this.guards.values())
            if (other.perception!.sees(observer(other), point))
              other.perception!.suspect(point);
      }),
      ctx.bus.on('damage_dealt', (hit) => {
        const enemy = this.guards.get(hit.target);
        const player = deps.getTarget();
        if (
          !enemy ||
          !player ||
          player.id !== hit.source ||
          !hit.tags.includes('#melee') ||
          hit.tags.includes('#execute') ||
          !enemy.perception!.vulnerable(observer(enemy), player.position)
        )
          return;
        const point = hit.point ?? observer(enemy).position;
        if (!hit.killed)
          deps.damage.deal(enemy.id, {
            source: player.id,
            amount: Number.MAX_VALUE,
            tags: ['#melee', '#execute'],
            point,
          });
        if (deps.damage.health(enemy.id)?.dead)
          ctx.bus.emit('execute_performed', {
            attacker: player.id,
            target: enemy.id,
            point,
          });
      }),
    ];
  }
  add(enemy: Enemy, p: Perception) {
    this.guards.set(enemy.id, enemy);
    let group = this.groups.get(p.spawn.groupId);
    if (!group) {
      group = new AlarmGroup(p.spawn.groupId, (groupId) =>
        this.ctx.bus.emit('alarm_raised', { groupId }),
      );
      group.reportedAt = p.spawn.reportedAt;
      this.groups.set(group.id, group);
    }
    group.members.set(enemy.id, p);
    if (group.reportedAt) p.alert(group.reportedAt);
  }
  remove(id: EntityId) {
    const p = this.guards.get(id)?.perception;
    if (p) this.groups.get(p.spawn.groupId)?.remove(id);
    this.guards.delete(id);
  }
  step(dt: number) {
    if (dt <= 0) return;
    const player = this.deps.getTarget();
    for (const enemy of this.guards.values()) {
      if (enemy.removed) {
        this.remove(enemy.id);
        continue;
      }
      const p = enemy.perception!;
      const fighting = p.state === 'alerted';
      p.step(dt, observer(enemy), player);
      if (fighting && p.state === 'searching')
        this.deps.director?.releaseToken(enemy.id);
      enemy.moveGoal = p.movement(dt, enemy.current.position);
      if (
        !enemy.moveGoal &&
        !p.seesTarget &&
        p.state !== 'alerted' &&
        (p.spawn.sentry || p.state !== 'unaware')
      )
        enemy.current.yaw += (dt * p.config.scanDegS * Math.PI) / 180;
    }
    for (const group of this.groups.values())
      group.step(dt, this.ctx.tuning.enemies.alarm.alarmDelayS);
  }
  force(id: string) {
    const target = this.deps.getTarget();
    if (target) this.groups.get(id)?.raise(target.position);
  }
  reported(groupId: string) {
    return !!this.groups.get(groupId)?.reportedAt;
  }
  dispose() {
    for (const off of this.off) off();
  }
}
