import type { Collider } from '@dimforge/rapier3d-compat';
import type { EntityId } from '../core/events';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { DamageInfo, DamageSystem } from '../combat/damage';
import { CollisionGroup } from '../physics';

export interface WallSlam {
  point: Vec3;
  normal: Vec3;
  speed: number;
  cause: ImpactSource | null;
}

export type ImpactSource = Pick<DamageInfo, 'source' | 'tags'>;

export function wallSlamContact(
  impulse: { x: number; z: number },
  collider: Collider | null,
  point: Vec3,
  normal: Vec3,
  cause: ImpactSource | null,
  tuning: Tuning['enemies'],
): WallSlam | null {
  if (
    !collider ||
    ((collider.collisionGroups() >>> 16) & CollisionGroup.World) === 0 ||
    collider.parent()?.isDynamic() ||
    Math.abs(normal.y) >= tuning.wallSlamMaxNormalY
  )
    return null;
  const length = Math.hypot(normal.x, normal.z);
  if (!length) return null;
  const x = normal.x / length;
  const z = normal.z / length;
  const speed = -(impulse.x * x + impulse.z * z);
  if (speed <= 0 || speed < tuning.wallSlamMinSpeed) return null;
  impulse.x += x * speed * (1 + tuning.wallSlamBounce);
  impulse.z += z * speed * (1 + tuning.wallSlamBounce);
  return { point, normal, speed, cause };
}

export function resolveWallSlam(
  ctx: Pick<GameContext, 'bus' | 'tuning'>,
  damage: DamageSystem,
  id: EntityId,
  slam: WallSlam,
): void {
  const t = ctx.tuning.enemies;
  const { point, normal, speed, cause } = slam;
  const source = cause?.source ?? null;
  const tags = ['#wall', '#hazard'];
  if (cause?.tags.includes('#power')) tags.push('#power');
  damage.deal(id, {
    amount: t.wallSlamDamage,
    source,
    tags,
    point,
    dir: normal,
  });
  ctx.bus.emit('enemy_wall_slam', { id, point, normal, speed });
  ctx.bus.emit('world_hit', { point, normal, owner: source ?? id, tags });
  ctx.bus.emit('hitstop', { ms: t.wallSlamHitstopMs });
  ctx.bus.emit('camera_shake', {
    intensity: t.wallSlamShake,
    durationS: t.wallSlamShakeS,
    dir: normal,
  });
}
