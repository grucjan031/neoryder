import {
  Capsule,
  ColliderDesc,
  QueryFilterFlags,
  RigidBodyDesc,
} from '@dimforge/rapier3d-compat';
import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import type { Settings } from '../core/save';
import { Stats } from '../core/stats';
import { CollisionGroup, interactionGroups } from '../physics';

export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  coyoteMs: number;
  jumpBufferMs: number;
  doubleJumpUsed: boolean;
}

/** Pozycja oznacza środek kapsuły. Właściciel świata wykonuje world.step po step. */
export class PlayerController {
  readonly stats = new Stats({});
  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly controller: KinematicCharacterController;
  private readonly groups = interactionGroups(CollisionGroup.Player, 0xffff);
  private capsuleHeight: number;
  private capsuleRadius: number;
  private readonly state: PlayerState;

  constructor(
    readonly id: EntityId,
    private readonly world: World,
    private readonly ctx: Pick<GameContext, 'bus' | 'tuning'>,
    position: Vec3,
    private readonly settings: Pick<Settings, 'mouseSensitivity'> = {
      mouseSensitivity: 1,
    },
  ) {
    const t = ctx.tuning.player;
    this.capsuleHeight = t.capsuleHeight;
    this.capsuleRadius = t.capsuleRadius;
    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y,
        position.z,
      ),
    );
    this.collider = world.createCollider(
      ColliderDesc.capsule(
        Math.max(0, t.capsuleHeight / 2 - t.capsuleRadius),
        t.capsuleRadius,
      ).setCollisionGroups(this.groups),
      this.body,
    );
    this.controller = world.createCharacterController(t.controllerOffset);
    this.state = {
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      grounded: false,
      coyoteMs: 0,
      jumpBufferMs: 0,
      doubleJumpUsed: false,
    };
  }

  getState(): PlayerState {
    return {
      ...this.state,
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
    };
  }

  teleport(position: Vec3): void {
    this.body.setTranslation(position, true);
    this.body.setNextKinematicTranslation(position);
    this.world.propagateModifiedBodyPositionsToColliders();
    Object.assign(this.state, {
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: false,
      coyoteMs: 0,
      jumpBufferMs: 0,
      doubleJumpUsed: false,
    });
  }

  step(dt: number, input: InputSnapshot): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const sensitivity = t.lookSensitivity * this.settings.mouseSensitivity;
    s.yaw -= input.lookDelta.x * sensitivity;
    const pitchLimit = (t.maxPitchDeg * Math.PI) / 180;
    s.pitch = Math.max(
      -pitchLimit,
      Math.min(pitchLimit, s.pitch - input.lookDelta.y * sensitivity),
    );
    if (input.pressed.has('jump')) s.jumpBufferMs = t.jumpBufferMs;
    if (dt <= 0) return;

    this.configure();
    const wasGrounded = s.grounded;
    if (!s.grounded) s.coyoteMs = Math.max(0, s.coyoteMs - dt * 1000);
    if (s.jumpBufferMs > 0) {
      if (s.grounded || s.coyoteMs > 0) this.jump(false);
      else if (!s.doubleJumpUsed) this.jump(true);
    }

    const forward =
      Number(input.held.has('moveForward')) -
      Number(input.held.has('moveBack'));
    const right =
      Number(input.held.has('moveRight')) - Number(input.held.has('moveLeft'));
    const magnitude = Math.hypot(forward, right);
    const speed =
      input.held.has('sprint') && forward > 0 ? t.sprintSpeed : t.walkSpeed;
    this.stats.setBase('moveSpeed', speed);
    const targetSpeed = this.stats.get('moveSpeed');
    if (magnitude > 0) {
      const targetX =
        ((right * Math.cos(s.yaw) - forward * Math.sin(s.yaw)) / magnitude) *
        targetSpeed;
      const targetZ =
        ((-right * Math.sin(s.yaw) - forward * Math.cos(s.yaw)) / magnitude) *
        targetSpeed;
      const dx = targetX - s.velocity.x;
      const dz = targetZ - s.velocity.z;
      const distance = Math.hypot(dx, dz);
      const acceleration = s.grounded ? t.groundAccel : t.airAccel;
      const fraction =
        distance > 0 ? Math.min(1, (acceleration * dt) / distance) : 0;
      s.velocity.x += dx * fraction;
      s.velocity.z += dz * fraction;
    } else if (s.grounded) {
      const damping = Math.exp(-t.groundFriction * dt);
      s.velocity.x *= damping;
      s.velocity.z *= damping;
    }

    s.velocity.y += this.ctx.tuning.physics.gravity * dt;
    const impactSpeed = Math.abs(s.velocity.y);
    if (s.grounded && s.velocity.y <= 0)
      this.controller.enableSnapToGround(t.snapToGroundDistance);
    else this.controller.disableSnapToGround();
    this.controller.computeColliderMovement(
      this.collider,
      {
        x: s.velocity.x * dt,
        y:
          (s.grounded
            ? Math.min(s.velocity.y, -t.groundStickSpeed)
            : s.velocity.y) * dt,
        z: s.velocity.z * dt,
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      this.groups,
    );
    const movement = this.controller.computedMovement();
    const position = this.body.translation();
    s.position = {
      x: position.x + movement.x,
      y: position.y + movement.y,
      z: position.z + movement.z,
    };
    s.grounded = s.velocity.y <= 0 && this.controller.computedGrounded();
    if (s.grounded) {
      s.velocity.y = 0;
      s.coyoteMs = t.coyoteTimeMs;
      s.doubleJumpUsed = false;
      if (!wasGrounded) {
        this.ctx.bus.emit('player_landed', { id: this.id, speed: impactSpeed });
        if (s.jumpBufferMs > 0) this.jump(false);
      }
    } else if (s.velocity.y > 0 && movement.y < s.velocity.y * dt) {
      // Kontakt z sufitem kasuje wznoszenie, ale nie odświeża skoków.
      for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
        if ((this.controller.computedCollision(i)?.normal1.y ?? 0) < 0) {
          s.velocity.y = 0;
          break;
        }
      }
    }
    s.jumpBufferMs = Math.max(0, s.jumpBufferMs - dt * 1000);
    this.body.setNextKinematicTranslation(s.position);
  }

  private jump(double: boolean): void {
    const s = this.state;
    s.velocity.y = double
      ? this.ctx.tuning.player.doubleJumpVelocity
      : this.ctx.tuning.player.jumpVelocity;
    s.grounded = false;
    s.coyoteMs = 0;
    s.jumpBufferMs = 0;
    if (double) s.doubleJumpUsed = true;
    this.ctx.bus.emit('player_jumped', { id: this.id, double });
  }

  private configure(): void {
    const t = this.ctx.tuning.player;
    this.controller.setOffset(t.controllerOffset);
    this.controller.enableAutostep(t.stepHeight, t.stepMinWidth, false);
    this.controller.setMaxSlopeClimbAngle((t.maxSlopeDeg * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((t.maxSlopeDeg * Math.PI) / 180);
    if (
      this.capsuleHeight !== t.capsuleHeight ||
      this.capsuleRadius !== t.capsuleRadius
    ) {
      this.collider.setShape(
        new Capsule(
          Math.max(0, t.capsuleHeight / 2 - t.capsuleRadius),
          t.capsuleRadius,
        ),
      );
      this.capsuleHeight = t.capsuleHeight;
      this.capsuleRadius = t.capsuleRadius;
    }
  }

  dispose(): void {
    this.world.removeCharacterController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}
