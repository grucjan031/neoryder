import { QueryFilterFlags } from '@dimforge/rapier3d-compat';
import type {
  Collider,
  KinematicCharacterController,
  World,
} from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { Stats } from '../core/stats';
import { Health } from '../combat/damage';
import type { DamageSystem, Hurtboxes } from '../combat/damage';
import { CollisionGroup, interactionGroups } from '../physics';
import type { RoomDefinition } from '../world/roomSchema';
import type { AllyNavigation } from '../allies/ally';
import { Civilian } from './civilian';
import { civilianDefinitions } from './civilianSchema';
import { automaticHideSpots, CivilianHiding } from './hiding';

export interface CivilianHost {
  ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>;
  rapier: typeof import('@dimforge/rapier3d-compat');
  world: World;
  entities: EntityRegistry;
  damage: DamageSystem;
  hurtboxes: Hurtboxes;
  navigation(): AllyNavigation | null;
  playerId: EntityId;
}

interface Member {
  civilian: Civilian;
  collider: Collider;
  controller: KinematicCharacterController;
  crouching: boolean;
}

/** Neutralne encje poza EnemyManager; żadnego atakowania ani wyboru celów wrogów. */
export class CivilianPopulation {
  private readonly members: Member[] = [];
  private readonly hiding: CivilianHiding;
  private readonly off: () => void;

  constructor(
    private readonly host: CivilianHost,
    room: RoomDefinition,
  ) {
    const t = host.ctx.tuning.civilians;
    this.hiding = new CivilianHiding(
      room.hideSpots ?? automaticHideSpots(room, t.hideInsetM),
      host.ctx.rng.fork('civilian-hiding'),
      t,
      (from, to) => this.free(to) && !!host.navigation()?.path(from, to).length,
      (from, to) => this.visible(from, to),
    );
    this.off = host.ctx.bus.on('damage_dealt', (event) => {
      if (!event.killed) return;
      const member = this.members.find(
        (m) => m.civilian.current.id === event.target,
      );
      if (!member || !member.civilian.kill(event.dir)) return;
      member.collider.setEnabled(false);
      host.hurtboxes.removeEntity(event.target);
      host.ctx.bus.emit('civilianKilled', {
        id: event.target,
        by: event.source,
      });
    });
    for (const spawn of room.civilians ?? [])
      this.add(spawn.id, spawn.position, spawn.yaw);
  }

  add(id: string, feet: Vec3, yaw = 0): Civilian {
    const definition = civilianDefinitions.get(id);
    if (!definition) throw new Error(`Nieznany cywil: ${id}`);
    const { ctx, rapier, world, entities, damage, hurtboxes } = this.host;
    const t = ctx.tuning.civilians;
    const entity = entities.create(`civilian:${id}`, 'neutral');
    const stats = new Stats({
      maxHealth: definition.maxHealth,
      moveSpeed: definition.fleeSpeedMps,
    });
    const health = new Health(() => stats.get('maxHealth'));
    const collider = world.createCollider(
      rapier.ColliderDesc.capsule(t.bodyHeightM / 2 - t.radiusM, t.radiusM)
        .setTranslation(feet.x, feet.y + t.bodyHeightM / 2, feet.z)
        .setCollisionGroups(
          interactionGroups(
            CollisionGroup.Enemy,
            CollisionGroup.World |
              CollisionGroup.Player |
              CollisionGroup.PlayerProjectile,
          ),
        ),
    );
    const controller = world.createCharacterController(t.controllerOffsetM);
    controller.enableSnapToGround(ctx.tuning.player.snapToGroundDistance);
    const civilian = new Civilian(
      entity,
      definition,
      feet,
      yaw,
      ctx.rng
        .fork(`civilian-look:${this.members.length}`)
        .int(0, definition.clothingVariants.length - 1),
      health,
      stats,
      t,
      {
        visible: (from, to) => this.visible(from, to),
        reserve: (from, player) => this.hiding.reserve(from, player),
        next: (from, to) => this.host.navigation()?.next(from, to) ?? from,
        move: (from, delta) => {
          controller.computeColliderMovement(
            collider,
            delta,
            QueryFilterFlags.EXCLUDE_SENSORS,
            interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
          );
          const moved = controller.computedMovement();
          const result = {
            x: from.x + moved.x,
            y: from.y + moved.y,
            z: from.z + moved.z,
          };
          collider.setTranslation({
            ...result,
            y: result.y + t.bodyHeightM / 2,
          });
          return result;
        },
        panicked: (id) => ctx.bus.emit('civilianPanicked', { id }),
      },
    );
    damage.register(entity, health, {
      stats,
      guard: (info) => (info.source === this.host.playerId ? 1 : 0),
    });
    hurtboxes.add(entity, collider);
    entities.bindCollider(entity, collider.handle);
    this.members.push({ civilian, collider, controller, crouching: false });
    return civilian;
  }

  step(dt: number, player: Vec3 | null): void {
    for (const member of this.members) {
      member.civilian.step(dt, player);
      const s = member.civilian.current;
      if (s.state === 'crouching' && !member.crouching) {
        const t = this.host.ctx.tuning.civilians;
        member.collider.setShape(
          new this.host.rapier.Capsule(
            t.crouchHeightM / 2 - t.radiusM,
            t.radiusM,
          ),
        );
        member.collider.setTranslation({
          ...s.position,
          y: s.position.y + t.crouchHeightM / 2,
        });
        member.crouching = true;
      }
    }
  }

  snapshots() {
    return this.members.map((m) => m.civilian.snapshot());
  }
  forEachPose(cb: (civilian: Civilian) => void): void {
    for (const { civilian } of this.members) cb(civilian);
  }
  targets(): { id: EntityId; position: Vec3; physical: true }[] {
    const t = this.host.ctx.tuning.civilians;
    return this.members
      .filter((m) => m.civilian.current.state !== 'dead')
      .map(({ civilian }) => ({
        id: civilian.current.id,
        physical: true,
        position: {
          ...civilian.current.position,
          y:
            civilian.current.position.y +
            (civilian.current.state === 'crouching'
              ? t.crouchHeightM
              : t.bodyHeightM) /
              2,
        },
      }));
  }

  private visible(from: Vec3, to: Vec3): boolean {
    const dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    return (
      length === 0 ||
      !this.host.world.castRay(
        new this.host.rapier.Ray(from, {
          x: dx / length,
          y: dy / length,
          z: dz / length,
        }),
        length,
        true,
        QueryFilterFlags.EXCLUDE_SENSORS,
        interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      )
    );
  }

  private free(feet: Vec3): boolean {
    const { world, rapier, ctx } = this.host,
      t = ctx.tuning.civilians;
    let blocked = false;
    world.intersectionsWithShape(
      { ...feet, y: feet.y + t.bodyHeightM / 2 + t.controllerOffsetM },
      { x: 0, y: 0, z: 0, w: 1 },
      new rapier.Capsule(t.bodyHeightM / 2 - t.radiusM, t.radiusM),
      () => {
        blocked = true;
        return false;
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    const support = world.castRay(
      new rapier.Ray(
        { ...feet, y: feet.y + t.controllerOffsetM },
        { x: 0, y: -1, z: 0 },
      ),
      ctx.tuning.player.snapToGroundDistance,
      true,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    return !blocked && support !== null;
  }

  dispose(): void {
    this.off();
    for (const { civilian, collider, controller } of this.members.splice(0)) {
      const id = civilian.current.id;
      this.host.hurtboxes.removeEntity(id);
      this.host.damage.unregister(id);
      this.host.entities.destroy(id);
      this.host.world.removeCollider(collider, true);
      this.host.world.removeCharacterController(controller);
    }
  }
}
