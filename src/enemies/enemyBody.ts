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

export class EnemyBody {
  private readonly body;
  private readonly collider;
  private readonly controller;
  private readonly groups = interactionGroups(CollisionGroup.Enemy, 0xffff);
  private readonly impulse = { x: 0, z: 0 };
  private verticalSpeed = 0;

  constructor(
    private readonly deps: EnemyDependencies,
    private readonly id: number,
    private readonly geometry: NonNullable<EnemyDefinition['body']>,
    position: Vec3,
  ) {
    const g = geometry;
    const centerY = g.height / 2;
    this.body = deps.world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y + centerY,
        position.z,
      ),
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
    for (const [collider, multiplier] of [
      [torso, 1],
      [head, g.headMultiplier],
    ] as const) {
      deps.entities.bindCollider(id, collider.handle);
      deps.hurtboxes.add(id, collider, multiplier);
    }
    this.controller = deps.world.createCharacterController(g.controllerOffset);
  }

  knockback(dir: Vec3, impulse: number): void {
    const length = Math.hypot(dir.x, dir.z);
    if (length <= Number.EPSILON) return;
    this.impulse.x += (dir.x / length) * impulse;
    this.impulse.z += (dir.z / length) * impulse;
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
  ): { position: Vec3; distance: number } {
    this.verticalSpeed += tuning.physics.gravity * dt;
    const center = this.body.translation();
    const separating = new Set<number>();
    // Kontroler nie rozwiązuje penetracji ze spawnu. Pozwól jedynie na ruch
    // od nakładającego się sąsiada; po rozdzieleniu kapsuł wraca zwykła kolizja.
    for (const neighbor of this.deps.getNeighbors?.() ?? []) {
      if (neighbor.id === this.id || !neighbor.definition.body) continue;
      const x = center.x - neighbor.current.position.x;
      const z = center.z - neighbor.current.position.z;
      const radii = this.geometry.radius + neighbor.definition.body.radius;
      if (
        Math.hypot(x, z) < radii &&
        x * (vx + this.impulse.x) + z * (vz + this.impulse.z) >= 0
      )
        separating.add(neighbor.id);
    }
    this.controller.computeColliderMovement(
      this.collider,
      {
        x: (vx + this.impulse.x) * dt,
        y: this.verticalSpeed * dt,
        z: (vz + this.impulse.z) * dt,
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      this.groups,
      (collider) =>
        !separating.has(this.deps.entities.byCollider(collider.handle) ?? -1),
    );
    const movement = this.controller.computedMovement();
    this.body.setNextKinematicTranslation({
      x: center.x + movement.x,
      y: center.y + movement.y,
      z: center.z + movement.z,
    });
    if (this.controller.computedGrounded()) this.verticalSpeed = 0;
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
    };
  }

  dispose(): void {
    this.deps.world.removeCharacterController(this.controller);
    this.deps.world.removeRigidBody(this.body);
  }
}
