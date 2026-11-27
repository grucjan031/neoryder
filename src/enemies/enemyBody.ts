import { platformSkinM, supportingPlatform } from '../physics/platformMotion';
import { steerVelocity } from './locomotion';
import {
  ColliderDesc,
  QueryFilterFlags,
  Ray,
  RigidBodyDesc,
} from '@dimforge/rapier3d-compat';
import type { Tuning } from '../core/tuning';
import type { Vec3 } from '../core/math';
import { CollisionGroup, interactionGroups } from '../physics';
import type { EnemyDefinition } from './enemySchema';
import type { EnemyDependencies } from './types';
import {
  wallSlamContact,
  type WallSlam,
  type ImpactSource,
} from './enemyWallImpact';
import type { EnemySnapshot } from './types';
import {
  knockdownOffset,
  type KnockdownPose,
  type KnockdownTuning,
} from './enemyKnockdown';

export class EnemyBody {
  readonly body;
  private readonly collider;
  private readonly torso;
  private readonly head;
  private readonly controller;
  private readonly groups = interactionGroups(CollisionGroup.Enemy, 0xffff);
  private readonly impulse = { x: 0, z: 0 };
  private impulseSource: ImpactSource | null = null;
  private readonly velocity = { x: 0, z: 0 };
  private verticalSpeed = 0;
  private stepping = false;
  private knockdownHurtboxes = false;

  constructor(
    private readonly deps: EnemyDependencies,
    private readonly id: number,
    private readonly geometry: NonNullable<EnemyDefinition['body']>,
    position: Vec3,
  ) {
    const g = geometry;
    const centerY = g.height / 2;
    this.body = deps.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased()
        .lockRotations()
        .setTranslation(position.x, position.y + centerY, position.z),
    );
    this.collider = deps.world.createCollider(
      ColliderDesc.capsule(centerY - g.radius, g.radius).setCollisionGroups(
        this.groups,
      ),
      this.body,
    );
    deps.entities.bindCollider(id, this.collider.handle);
    const torso = deps.world.createCollider(
      ColliderDesc.capsule(g.halfHeight, g.radius)
        .setTranslation(0, g.centerY - centerY, 0)
        .setSensor(true)
        .setCollisionGroups(this.groups),
      this.body,
    );
    const head = deps.world.createCollider(
      ColliderDesc.ball(g.headRadius)
        .setTranslation(0, g.headY - centerY, 0)
        .setSensor(true)
        .setCollisionGroups(this.groups),
      this.body,
    );
    this.torso = torso;
    this.head = head;
    for (const [collider, multiplier] of [
      [torso, 1],
      [head, g.headMultiplier],
    ] as const) {
      deps.entities.bindCollider(id, collider.handle);
      deps.hurtboxes.add(id, collider, multiplier, collider === head);
    }
    this.controller = deps.world.createCharacterController(g.controllerOffset);
  }

  updateKnockdown(
    snapshot: EnemySnapshot,
    pose: KnockdownPose | null,
    tuning: KnockdownTuning,
  ): void {
    const g = this.geometry;
    const centerY = g.height / 2;
    const dir = snapshot.knockdown;
    if (!pose || !dir) {
      this.resetHurtboxes();
      return;
    }
    const { tilt, sin, cos, up, forward } = knockdownOffset(
      pose,
      g.centerY,
      tuning.lieRestM,
    );
    const headY = g.headY * pose.squash;
    const torsoY = g.centerY * pose.squash;
    const halfHeight = g.halfHeight * pose.squash;
    const extent = Math.max(
      forward + headY * sin + g.headRadius,
      forward + torsoY * sin + Math.abs(sin) * halfHeight + g.radius,
    );
    const { position } = snapshot;
    const hit =
      sin > 0 && extent > 0
        ? this.deps.world.castRay(
            new Ray(
              { ...position, y: position.y + up + headY * cos },
              { x: dir.x, y: 0, z: dir.z },
            ),
            extent,
            true,
            QueryFilterFlags.EXCLUDE_SENSORS,
            interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
            this.collider,
            this.body,
          )
        : null;
    const retreatM = hit ? extent - hit.timeOfImpact : 0;
    snapshot.knockdown = { ...dir, retreatM };
    const shift = forward - retreatM;
    const local = (y: number, verticalRadius: number): Vec3 => ({
      x: dir.x * (shift + y * sin),
      y: Math.max(verticalRadius, up + y * cos) - centerY,
      z: dir.z * (shift + y * sin),
    });
    this.torso.setHalfHeight(halfHeight);
    this.torso.setTranslationWrtParent(
      local(torsoY, Math.abs(cos) * halfHeight + g.radius),
    );
    this.torso.setRotationWrtParent({
      x: dir.z * Math.sin(tilt / 2),
      y: 0,
      z: -dir.x * Math.sin(tilt / 2),
      w: Math.cos(tilt / 2),
    });
    this.head.setTranslationWrtParent(local(headY, g.headRadius));
    this.knockdownHurtboxes = true;
  }

  resetHurtboxes(): void {
    if (!this.knockdownHurtboxes) return;
    const g = this.geometry;
    this.torso.setHalfHeight(g.halfHeight);
    this.torso.setRotationWrtParent({ x: 0, y: 0, z: 0, w: 1 });
    this.torso.setTranslationWrtParent({
      x: 0,
      y: g.centerY - g.height / 2,
      z: 0,
    });
    this.head.setTranslationWrtParent({
      x: 0,
      y: g.headY - g.height / 2,
      z: 0,
    });
    this.knockdownHurtboxes = false;
  }

  disableCollision(): void {
    this.knockdownHurtboxes = false;
    this.deps.hurtboxes.removeEntity(this.id);
    // Samo setEnabled zostawia collider w wynikach zapytań do następnego world.step().
    for (const collider of [this.collider, this.torso, this.head]) {
      this.deps.entities.unbindCollider(collider.handle);
      this.deps.world.removeCollider(collider, false);
    }
  }

  knockback(
    dir: Vec3,
    impulse: number,
    tuning: Tuning['enemies'],
    source: ImpactSource,
  ): void {
    if (!(impulse > 0)) return;
    if (impulse >= tuning.stunKnockback || dir.y > 0)
      this.verticalSpeed = Math.max(
        this.verticalSpeed,
        Math.min(
          tuning.knockbackMaxLiftSpeed,
          impulse * Math.max(dir.y, tuning.knockbackLiftRatio),
        ),
      );
    const length = Math.hypot(dir.x, dir.z);
    if (length <= Number.EPSILON) return;
    this.impulse.x += (dir.x / length) * impulse;
    this.impulse.z += (dir.z / length) * impulse;
    this.impulseSource = source;
  }

  clearMotion(): void {
    this.velocity.x = this.velocity.z = 0;
    this.impulse.x = this.impulse.z = this.verticalSpeed = 0;
    this.impulseSource = null;
  }

  position(): Vec3 {
    const p = this.body.translation();
    return { x: p.x, y: p.y - this.geometry.height / 2, z: p.z };
  }

  teleport(feet: Vec3): void {
    this.clearMotion();
    const center = { ...feet, y: feet.y + this.geometry.height / 2 };
    this.body.setTranslation(center, true);
    this.body.setNextKinematicTranslation(center);
    this.deps.world.propagateModifiedBodyPositionsToColliders();
  }

  wallAhead(yaw: number, distance: number): boolean {
    return (
      this.deps.world.castRay(
        new Ray(this.body.translation(), {
          x: Math.sin(yaw),
          y: 0,
          z: Math.cos(yaw),
        }),
        distance,
        true,
        QueryFilterFlags.EXCLUDE_SENSORS,
        interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
        this.collider,
        this.body,
      ) !== null
    );
  }

  move(
    dt: number,
    vx: number,
    vz: number,
    tuning: Tuning,
  ): { position: Vec3; distance: number; wallSlam: WallSlam | null } {
    if (!this.stepping) {
      // Wróg wchodzi po stopniach tak jak gracz: nawigacja aren prowadzi go schodami.
      const t = tuning.enemies;
      if (this.deps.stepClimbing) {
        this.controller.enableAutostep(t.stepHeight, t.stepMinWidth, false);
        if (t.snapToGroundDistance > 0)
          this.controller.enableSnapToGround(t.snapToGroundDistance);
      }
      this.stepping = true;
    }
    const waypoint = this.deps.transitWaypoint?.(this.id);
    if (waypoint && dt > 0) {
      const p = this.body.translation(),
        dx = waypoint.x - p.x,
        dz = waypoint.z - p.z;
      const speed = tuning.elevator.navWalkMps;
      const factor = Math.min(
        1 / dt,
        speed / Math.max(Number.EPSILON, Math.hypot(dx, dz)),
      );
      vx = dx * factor;
      vz = dz * factor;
    }
    const scale = this.geometry.locomotionScale;
    if (scale !== undefined) {
      steerVelocity(
        this.velocity,
        vx,
        vz,
        tuning.enemies.accelerationMps2 * scale,
        tuning.enemies.brakingMps2 * scale,
        dt,
      );
      vx = this.velocity.x;
      vz = this.velocity.z;
    }
    this.verticalSpeed += tuning.physics.gravity * dt;
    const center = this.body.translation();
    const separating = new Set<number>();
    // Kontroler nie rozwiązuje penetracji ze spawnu. Pozwól jedynie na ruch
    // od nakładającego się sąsiada; po rozdzieleniu kapsuł wraca zwykła kolizja.
    for (const neighbor of this.deps.getLocalNeighbors?.() ??
      this.deps.getNeighbors?.() ??
      []) {
      if (
        neighbor.id === this.id ||
        !neighbor.definition.body ||
        neighbor.current.state === 'dead'
      )
        continue;
      const x = center.x - neighbor.current.position.x;
      const z = center.z - neighbor.current.position.z;
      const radii = this.geometry.radius + neighbor.definition.body.radius;
      if (
        Math.hypot(x, z) < radii &&
        x * (vx + this.impulse.x) + z * (vz + this.impulse.z) >= 0
      )
        separating.add(neighbor.id);
    }
    const platform = supportingPlatform(
      this.deps.platformFloors,
      center,
      this.geometry.height,
      this.geometry.controllerOffset,
      this.verticalSpeed,
    );
    this.controller.computeColliderMovement(
      this.collider,
      {
        x: (vx + this.impulse.x) * dt,
        y: platform ? 0 : this.verticalSpeed * dt,
        z: (vz + this.impulse.z) * dt,
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      this.groups,
      (collider) =>
        collider.handle !== platform?.floorHandle &&
        !separating.has(this.deps.entities.byCollider(collider.handle) ?? -1),
    );
    const movement = this.controller.computedMovement();
    // Na szwie podestu Rapier może wyczerpać iteracje o płaską podłogę
    // bez ruchu. Przywróć odstęp kapsuły od rzeczywistego punktu styku.
    if (
      waypoint &&
      !platform &&
      this.verticalSpeed <= 0 &&
      !movement.x &&
      !movement.z
    ) {
      const hit = this.controller.computedCollision(0);
      if (hit && hit.normal1.y > 1 - 1e-6)
        movement.y = Math.max(
          movement.y,
          hit.witness1.y +
            this.geometry.height / 2 +
            this.geometry.controllerOffset +
            platformSkinM -
            center.y,
        );
    }
    if (platform)
      movement.y +=
        platform.state.y +
        this.geometry.height / 2 +
        this.geometry.controllerOffset +
        platformSkinM -
        center.y;
    this.body.setNextKinematicTranslation({
      x: center.x + movement.x,
      y: center.y + movement.y,
      z: center.z + movement.z,
    });
    if (
      this.verticalSpeed <= 0 &&
      (platform || this.controller.computedGrounded())
    )
      this.verticalSpeed = 0;
    let wallSlam: WallSlam | null = null;
    if (
      Math.hypot(this.impulse.x, this.impulse.z) >=
      tuning.enemies.wallSlamMinSpeed
    ) {
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
        const hit = this.controller.computedCollision(i);
        if (!hit) continue;
        wallSlam = wallSlamContact(
          this.impulse,
          hit.collider,
          hit.witness1,
          hit.normal1,
          this.impulseSource,
          tuning.enemies,
        );
        if (wallSlam) break;
      }
    }
    const damping = Math.exp(-this.geometry.knockbackDamping * dt);
    this.impulse.x *= damping;
    this.impulse.z *= damping;
    return {
      position: {
        x: center.x + movement.x,
        y: center.y + movement.y - this.geometry.height / 2,
        z: center.z + movement.z,
      },
      distance: Math.hypot(movement.x, movement.z),
      wallSlam,
    };
  }

  dispose(): void {
    this.deps.world.removeCharacterController(this.controller);
    this.deps.world.removeRigidBody(this.body);
  }
}
