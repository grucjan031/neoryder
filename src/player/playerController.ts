import {
  platformSkinM,
  supportingPlatform,
  type MovingPlatform,
} from '../physics/platformMotion';
import {
  Capsule,
  ColliderDesc,
  QueryFilterFlags,
  Ray,
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
import { assistAim } from '../core/input/aimAssist';
import { SIM_DT } from '../core/loop';
import type { Vec3 } from '../core/math';
import type { Settings } from '../core/save';
import { Stats, type StatId } from '../core/stats';
import { PlayerStamina, staminaStatsSchema } from './stamina';
import { CollisionGroup, interactionGroups } from '../physics';

export interface PlayerState {
  /** Środek kapsuły. */
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  coyoteMs: number;
  jumpBufferMs: number;
  airJumpsUsed: number;
  /** Bieżąca wysokość kapsuły (niższa przy slide i w przysiadzie). */
  height: number;
  /** Pozostały czas trwającego dashu (s); > 0 = dash w toku. */
  dashS: number;
  /** Pozostałe odnowienie dashu (s). */
  dashCooldownS: number;
  dashDir: Vec3;
  sliding: boolean;
  slideS: number;
  /** Niska kapsuła bez slide (np. po slide pod przeszkodą). */
  crouched: boolean;
  sprinting: boolean;
}

/** Pozycja oznacza środek kapsuły. Właściciel świata wykonuje world.step po step. */
export class PlayerController {
  readonly stats: Stats;
  readonly stamina: PlayerStamina;

  get gravity(): number {
    return this.ctx.tuning.physics.gravity * this.stats.get('gravityScale');
  }
  private sprintExhausted = false;
  private jumpDenialNotified = false;
  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly controller: KinematicCharacterController;
  private readonly groups = interactionGroups(CollisionGroup.Player, 0xffff);
  private shapeHeight: number;
  private shapeRadius: number;
  private readonly state: PlayerState;
  private aimTargets?: () => readonly Vec3[];

  constructor(
    readonly id: EntityId,
    private readonly world: World,
    private readonly ctx: Pick<GameContext, 'bus' | 'tuning'>,
    position: Vec3,
    private readonly settings: Pick<Settings, 'mouseSensitivity'> &
      Partial<Pick<Settings, 'invertY'>> = {
      mouseSensitivity: 1,
    },
    statBases: Partial<Record<StatId, number>> = {},
    private readonly platformFloors?: readonly MovingPlatform[],
  ) {
    const t = ctx.tuning.player;
    this.stats = new Stats({
      gravityScale: 1,
      ...statBases,
      ...staminaStatsSchema.parse(statBases),
    });
    this.stamina = new PlayerStamina(id, this.stats, ctx.bus, ctx.tuning);
    this.shapeHeight = t.capsuleHeight;
    this.shapeRadius = t.capsuleRadius;
    this.body = world.createRigidBody(
      RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y,
        position.z,
      ),
    );
    this.collider = world.createCollider(
      ColliderDesc.capsule(
        halfSegment(t.capsuleHeight, t.capsuleRadius),
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
      airJumpsUsed: 0,
      height: t.capsuleHeight,
      dashS: 0,
      dashCooldownS: 0,
      dashDir: { x: 0, y: 0, z: -1 },
      sliding: false,
      slideS: 0,
      crouched: false,
      sprinting: false,
    };
  }

  /** Uchwyt collidera kapsuły (rejestracja jako hurtbox gracza). */
  get colliderHandle(): number {
    return this.collider.handle;
  }

  enableDynamicPush(massKg: number): void {
    this.controller.setCharacterMass(massKg);
    this.controller.setApplyImpulsesToDynamicBodies(true);
  }

  getState(): PlayerState {
    return {
      ...this.state,
      position: { ...this.state.position },
      velocity: { ...this.state.velocity },
      dashDir: { ...this.state.dashDir },
    };
  }

  /** Nietykalność w trakcie dashu (tuning.player.dashInvulnerable = 1). */
  isInvulnerable(): boolean {
    return this.state.dashS > 0 && this.ctx.tuning.player.dashInvulnerable > 0;
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
      airJumpsUsed: 0,
      dashS: 0,
      dashCooldownS: 0,
      sliding: false,
      slideS: 0,
      crouched: false,
      sprinting: false,
    });
    this.setHeight(this.ctx.tuning.player.capsuleHeight, false);
  }

  step(dt: number, input: InputSnapshot): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    this.look(input);
    // Wciśnięcia zapamiętujemy także podczas hitstopu (dt = 0), żeby nie ginęły.
    if (input.pressed.has('jump')) {
      s.jumpBufferMs = t.jumpBufferMs;
      this.jumpDenialNotified = false;
    }
    if (input.pressed.has('dash') && this.carrySpeed === null)
      this.dashBufferMs = t.dashBufferMs;
    if (input.pressed.has('crouch')) {
      this.crouchQueued = true;
      this.slideBufferMs = t.slideBufferMs;
    }
    if (input.released.has('crouch')) {
      this.crouchQueued = false;
      this.slideBufferMs = 0;
    }
    if (dt <= 0) return;

    if (this.stamina.current <= 0) this.sprintExhausted = true;
    this.stamina.step(dt);
    if (this.stamina.current > t.sprintMinStamina) this.sprintExhausted = false;
    this.configure();
    const wasGrounded = s.grounded;
    if (!s.grounded) s.coyoteMs = Math.max(0, s.coyoteMs - dt * 1000);
    s.dashCooldownS = Math.max(0, s.dashCooldownS - dt);

    const move = this.moveInput(input);
    this.stats.setBase('dashCooldown', t.dashCooldownS);
    if (this.dashBufferMs > 0 && s.dashCooldownS <= 0 && s.dashS <= 0) {
      this.dashBufferMs = 0;
      this.startDash(move);
    }
    this.dashBufferMs = Math.max(0, this.dashBufferMs - dt * 1000);

    if (s.jumpBufferMs > 0 && s.dashS <= 0) {
      if (s.grounded || s.coyoteMs > 0) this.jump(false);
      else if (s.airJumpsUsed < Math.floor(this.stats.get('extraJumps')))
        this.jump(true);
    }

    if (
      this.crouchQueued &&
      this.carrySpeed === null &&
      s.grounded &&
      !s.sliding &&
      s.dashS <= 0 &&
      horizontalSpeed(s.velocity) >= t.slideMinSpeed
    )
      this.startSlide();
    this.crouchQueued = false;
    // Bufor ślizgu żyje tylko w powietrzu (lądowanie bez skoku z bufora).
    if (s.grounded) this.slideBufferMs = 0;
    else if (!input.held.has('crouch')) this.slideBufferMs = 0;

    s.sprinting =
      this.carrySpeed === null &&
      this.aim <= 0 &&
      input.held.has('sprint') &&
      move.forward > 0 &&
      !s.crouched &&
      !s.sliding &&
      s.dashS <= 0 &&
      !this.sprintExhausted &&
      this.stamina.current > 0;
    const sprintStep = s.sprinting;
    const dashing = s.dashS > 0;
    if (dashing) this.stepDash(dt);
    else if (s.sliding) this.stepSlide(dt, move, input);
    else this.stepRun(dt, move);

    if (!dashing)
      s.velocity.y += this.gravity * this.gravityMultiplier(input) * dt;
    const impactSpeed = Math.abs(s.velocity.y);
    if (s.grounded && s.velocity.y <= 0)
      this.controller.enableSnapToGround(t.snapToGroundDistance);
    else this.controller.disableSnapToGround();
    const platform = supportingPlatform(
      this.platformFloors,
      s.position,
      s.height,
      t.controllerOffset,
      s.velocity.y,
    );
    if (platform) this.controller.disableSnapToGround();
    this.controller.computeColliderMovement(
      this.collider,
      {
        x: s.velocity.x * dt,
        y: platform
          ? 0
          : (s.grounded
              ? Math.min(s.velocity.y, -t.groundStickSpeed)
              : s.velocity.y) * dt,
        z: s.velocity.z * dt,
      },
      QueryFilterFlags.EXCLUDE_SENSORS,
      this.groups,
      platform ? (c) => c.handle !== platform.floorHandle : undefined,
    );
    const movement = this.controller.computedMovement();
    this.resolveContacts(dt, movement);
    // Pomijamy mikrokorekty kontaktów Rapiera (metry), nie rzeczywisty ruch.
    if (
      sprintStep &&
      Math.hypot(movement.x, movement.z) > t.sprintMovementEpsilonM
    ) {
      this.stamina.spend(
        Math.min(this.stamina.current, t.sprintStaminaPerS * dt),
      );
      if (this.stamina.current <= 0) {
        this.sprintExhausted = true;
        s.sprinting = false;
      }
    } else s.sprinting = false;
    const position = this.body.translation();
    s.position = {
      x: position.x + movement.x,
      y:
        (platform
          ? platform.state.y + s.height / 2 + t.controllerOffset + platformSkinM
          : position.y) + movement.y,
      z: position.z + movement.z,
    };
    if (this.dashEnded) {
      // Po dashu prędkość spada do dashExitSpeed w kierunku dashu (płynne wyjście).
      const exit = t.dashExitSpeed;
      s.velocity.x = s.dashDir.x * exit;
      s.velocity.z = s.dashDir.z * exit;
      this.dashEnded = false;
    }
    s.grounded =
      s.velocity.y <= 0 && (!!platform || this.controller.computedGrounded());
    if (s.grounded) {
      s.velocity.y = 0;
      s.coyoteMs = t.coyoteTimeMs;
      s.airJumpsUsed = 0;
      if (!wasGrounded) {
        this.ctx.bus.emit('player_landed', { id: this.id, speed: impactSpeed });
        if (s.jumpBufferMs > 0 && s.dashS <= 0) this.jump(false);
        else if (
          this.slideBufferMs > 0 &&
          this.carrySpeed === null &&
          !s.sliding &&
          s.dashS <= 0 &&
          horizontalSpeed(s.velocity) >= t.slideMinSpeed
        )
          this.startSlide();
        this.slideBufferMs = 0;
      }
    } else {
      if (s.sliding) this.endSlide();
      if (s.velocity.y > 0 && movement.y < s.velocity.y * dt) {
        // Kontakt z sufitem kasuje wznoszenie, ale nie odświeża skoków.
        for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
          if ((this.controller.computedCollision(i)?.normal1.y ?? 0) < 0) {
            s.velocity.y = 0;
            break;
          }
        }
      }
    }
    if (s.crouched && !s.sliding && !input.held.has('crouch')) this.tryStand();
    s.jumpBufferMs = Math.max(0, s.jumpBufferMs - dt * 1000);
    this.slideBufferMs = Math.max(0, this.slideBufferMs - dt * 1000);
    this.body.setNextKinematicTranslation(s.position);
  }

  /** Normalna podłoża z ostatniego kroku (ślizg po rampie); (0,1,0) w locie i na płaskim. */
  private groundNormal = { x: 0, y: 1, z: 0 };
  private slideDownhill = false;
  /** Czas ślizgu na stoku (nie liczy się do limitu `slideMaxS` po wyjściu na płaskie). */
  private slideDownhillS = 0;
  private dashBufferMs = 0;
  private crouchQueued = false;
  private slideBufferMs = 0;
  /** Postęp celowania 0–1 (ustawiany przez scenę z `HeldItem.aim`). */
  private aim = 0;
  private aimSensitivityScale = 1;
  private carrySpeed: number | null = null;

  setCarry(speed: number | null): void {
    if (speed === this.carrySpeed) return;
    this.carrySpeed = speed;
    this.stats.removeBySource('heistCarry');
    if (speed !== null) {
      this.stats.add({
        stat: 'moveSpeed',
        type: 'mult',
        value: speed,
        source: 'heistCarry',
      });
      this.dashBufferMs = 0;
      this.dashEnded = false;
      this.state.dashS = 0;
      this.state.sprinting = false;
      this.endSlide();
      this.state.velocity.x = 0;
      this.state.velocity.z = 0;
    }
  }

  /**
   * Celowanie: czułość myszy i prędkość ruchu skalowane `tuning.player.aim` (prędkość przez
   * `StatModifier`), sprint niedostępny, dopóki celowanie trwa.
   */
  setAim(aim: number, sensitivityScale = 1): void {
    this.aimSensitivityScale = sensitivityScale;
    const k = Math.min(1, Math.max(0, Number.isFinite(aim) ? aim : 0));
    if (k === this.aim) return;
    this.aim = k;
    this.stats.removeBySource('aim');
    if (k > 0)
      this.stats.add({
        stat: 'moveSpeed',
        type: 'mult',
        value: 1 + (this.ctx.tuning.player.aim.moveSpeed - 1) * k,
        source: 'aim',
      });
  }

  setAimTargets(targets: () => readonly Vec3[]): void {
    this.aimTargets = targets;
  }

  private look(input: InputSnapshot): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const aimScale =
      1 + (t.aim.sensitivity * this.aimSensitivityScale - 1) * this.aim;
    const sensitivity =
      t.lookSensitivity * this.settings.mouseSensitivity * aimScale;
    let dx = input.lookDelta.x * sensitivity;
    let dy = input.lookDelta.y * sensitivity * (this.settings.invertY ? -1 : 1);
    if (input.gamepad) {
      const { move, look, aimAssist } = input.gamepad;
      const eye = {
        ...s.position,
        y: s.position.y + s.height / 2 - (t.capsuleHeight - t.eyeHeight),
      };
      const result =
        aimAssist && this.aimTargets && (move.x || move.y || look.x || look.y)
          ? assistAim(
              look,
              Boolean(move.x || move.y),
              s.yaw,
              s.pitch,
              eye,
              this.aimTargets(),
              this.ctx.tuning.gamepad.aim,
              (dir, distance) =>
                !this.world.castRay(
                  new Ray(eye, dir),
                  distance,
                  true,
                  QueryFilterFlags.EXCLUDE_SENSORS,
                  interactionGroups(
                    CollisionGroup.Player,
                    CollisionGroup.World,
                  ),
                ),
            )
          : look;
      dx += result.x * aimScale * SIM_DT;
      dy += result.y * aimScale * SIM_DT;
    }
    s.yaw -= dx;
    const pitchLimit = (t.maxPitchDeg * Math.PI) / 180;
    s.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, s.pitch - dy));
  }

  /** Kierunek ruchu z WASD w świecie (poziomy, jednostkowy) i składowe wejścia. */
  private moveInput(input: InputSnapshot): {
    forward: number;
    right: number;
    dir: Vec3 | null;
    scale: number;
  } {
    const analog = input.gamepad?.move;
    const forward =
      -(analog?.y ?? 0) +
      Number(input.held.has('moveForward')) -
      Number(input.held.has('moveBack'));
    const right =
      (analog?.x ?? 0) +
      Number(input.held.has('moveRight')) -
      Number(input.held.has('moveLeft'));
    const magnitude = Math.hypot(forward, right);
    if (magnitude === 0) return { forward, right, dir: null, scale: 0 };
    const yaw = this.state.yaw;
    return {
      forward,
      right,
      scale: input.gamepad ? Math.min(1, magnitude) : 1,
      dir: {
        x: (right * Math.cos(yaw) - forward * Math.sin(yaw)) / magnitude,
        y: 0,
        z: (-right * Math.sin(yaw) - forward * Math.cos(yaw)) / magnitude,
      },
    };
  }

  private stepRun(dt: number, move: ReturnType<PlayerController['moveInput']>) {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const base = s.crouched
      ? t.crouchSpeed
      : s.sprinting
        ? t.sprintSpeed
        : t.walkSpeed;
    this.stats.setBase('moveSpeed', base);
    const targetSpeed = this.stats.get('moveSpeed') * move.scale;
    const flightSpeed = horizontalSpeed(s.velocity);
    if (
      move.dir &&
      !s.grounded &&
      t.airPreserveMomentum > 0 &&
      flightSpeed > targetSpeed &&
      s.velocity.x * move.dir.x + s.velocity.z * move.dir.z >= 0
    ) {
      // Pęd ponad targetSpeed (slide-jump, dash): sterowanie obraca wektor, nie hamuje.
      const keep = Math.max(
        targetSpeed,
        flightSpeed * Math.exp(-t.airDrag * dt),
      );
      accelerateTowards(
        s.velocity,
        move.dir.x * flightSpeed,
        move.dir.z * flightSpeed,
        t.airAccel * dt,
      );
      const turned = horizontalSpeed(s.velocity);
      if (turned > 1e-6) {
        s.velocity.x *= keep / turned;
        s.velocity.z *= keep / turned;
      }
    } else if (move.dir) {
      const acceleration = s.grounded ? t.groundAccel : t.airAccel;
      accelerateTowards(
        s.velocity,
        move.dir.x * targetSpeed,
        move.dir.z * targetSpeed,
        acceleration * dt,
      );
    } else if (s.grounded) {
      const damping = Math.exp(-t.groundFriction * dt);
      s.velocity.x *= damping;
      s.velocity.z *= damping;
    } else if (t.airPreserveMomentum > 0 && flightSpeed > targetSpeed) {
      // Bez wejścia w locie nadmiar pędu też podlega łagodnemu airDrag (jak przy trzymanym kierunku).
      const keep = Math.max(
        targetSpeed,
        flightSpeed * Math.exp(-t.airDrag * dt),
      );
      s.velocity.x *= keep / flightSpeed;
      s.velocity.z *= keep / flightSpeed;
    }
  }

  /** Krzywa skoku: lżejsza grawitacja w szczycie, cięższa w opadaniu i po puszczeniu skoku (1 = wyłączone). */
  private gravityMultiplier(input: InputSnapshot): number {
    const s = this.state;
    const t = this.ctx.tuning.player;
    if (s.grounded) return 1;
    const vy = s.velocity.y;
    if (Math.abs(vy) < t.apexSpeedThreshold) return t.apexGravityMult;
    if (vy < 0) return t.fallGravityMult;
    return input.held.has('jump') ? 1 : t.jumpCutGravityMult;
  }

  /**
   * Kontakty po `computeColliderMovement`: rzutowanie prędkości poziomej na ścianę, gdy ruch
   * został faktycznie zablokowany (autostep nie liczy się).
   */
  private resolveContacts(dt: number, movement: Vec3): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const wanted = Math.hypot(s.velocity.x, s.velocity.z) * dt;
    // Na ziemi poza ślizgiem wejście i tak ustawia prędkość w następnym kroku; autostep (ruch w górę) to nie ściana.
    const momentum = s.sliding || !s.grounded;
    const steppedUp = s.grounded && movement.y > 0.02;
    const blocked =
      momentum &&
      !steppedUp &&
      wanted > 1e-6 &&
      Math.hypot(movement.x, movement.z) < wanted * t.wallBlockedFrac;
    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const collision = this.controller.computedCollision(i);
      const normal = collision?.normal1;
      if (!normal) continue;
      // Ciała dynamiczne (skrzynie, dekoracje) nie są ścianą: ustąpią pod impulsem.
      if (collision?.collider?.parent()?.isDynamic()) continue;
      if (
        blocked &&
        t.wallVelocityProjection > 0 &&
        Math.abs(normal.y) < t.wallNormalMaxY
      ) {
        const length = Math.hypot(normal.x, normal.z);
        if (length < 1e-6) continue;
        const nx = normal.x / length;
        const nz = normal.z / length;
        const into = s.velocity.x * nx + s.velocity.z * nz;
        if (into < 0) {
          s.velocity.x -= into * nx;
          s.velocity.z -= into * nz;
        }
      }
    }
  }

  /** Normalna podłoża pod stopami (promień w dół); kontakty kontrolera nie raportują stoku przy snap-to-ground. */
  private updateGroundNormal(): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const n = this.groundNormal;
    n.x = 0;
    n.y = 1;
    n.z = 0;
    const feet = s.position.y - s.height / 2;
    const hit = this.world.castRayAndGetNormal(
      new Ray(
        { x: s.position.x, y: feet + t.groundProbeUpM, z: s.position.z },
        { x: 0, y: -1, z: 0 },
      ),
      t.groundProbeUpM + t.snapToGroundDistance + t.controllerOffset,
      true,
      undefined,
      interactionGroups(CollisionGroup.Player, CollisionGroup.World),
      undefined,
      this.body,
    );
    if (!hit || hit.normal.y < Math.cos((t.maxSlopeDeg * Math.PI) / 180))
      return;
    n.x = hit.normal.x;
    n.y = hit.normal.y;
    n.z = hit.normal.z;
  }

  private startDash(move: ReturnType<PlayerController['moveInput']>): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    if (!this.stamina.spend(t.dashStaminaCost)) {
      this.ctx.bus.emit('stamina_denied', { user: this.id, action: 'dash' });
      return;
    }
    const yaw = s.yaw;
    s.dashDir = move.dir ?? { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
    s.dashS = t.dashDurationS;
    s.dashCooldownS = this.stats.get('dashCooldown');
    s.velocity.y = 0;
    if (s.sliding) this.endSlide();
    this.ctx.bus.emit('dash_used', { user: this.id, dir: { ...s.dashDir } });
  }

  private stepDash(dt: number): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const speed = t.dashDistance / Math.max(t.dashDurationS, 1e-3);
    // Ostatni krok dashu może być krótszy niż dt — przesuwamy dokładnie o dashDistance.
    const fraction = Math.min(1, s.dashS / dt);
    s.velocity.x = s.dashDir.x * speed * fraction;
    s.velocity.z = s.dashDir.z * speed * fraction;
    s.velocity.y = 0;
    s.dashS = Math.max(0, s.dashS - dt);
    if (s.dashS <= 0) this.dashEnded = true;
  }

  private dashEnded = false;

  private startSlide(): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    const speed = horizontalSpeed(s.velocity);
    const boosted = Math.min(t.slideMaxSpeed, speed + t.slideBoost);
    const k = speed > 0 ? boosted / speed : 0;
    s.velocity.x *= k;
    s.velocity.z *= k;
    s.sliding = true;
    s.slideS = 0;
    this.slideDownhillS = 0;
    this.setHeight(t.slideCapsuleHeight, true);
    s.crouched = true;
    this.ctx.bus.emit('slide_started', { user: this.id });
  }

  private stepSlide(
    dt: number,
    move: ReturnType<PlayerController['moveInput']>,
    input: InputSnapshot,
  ): void {
    const s = this.state;
    const t = this.ctx.tuning.player;
    s.slideS += dt;
    const damping = Math.exp(-t.slideFriction * dt);
    s.velocity.x *= damping;
    s.velocity.z *= damping;
    this.updateGroundNormal();
    // Składowa grawitacji wzdłuż stoku: zjazd przyspiesza ślizg, podjazd go hamuje.
    const slope = Math.hypot(this.groundNormal.x, this.groundNormal.z);
    this.slideDownhill = false;
    if (slope > 1e-3 && t.slideSlopeAccelScale > 0) {
      const accel = Math.abs(this.gravity) * t.slideSlopeAccelScale;
      // Poziomy składnik normalnej wskazuje w dół stoku.
      const ax = this.groundNormal.x * accel * dt;
      const az = this.groundNormal.z * accel * dt;
      s.velocity.x += ax;
      s.velocity.z += az;
      this.slideDownhill =
        s.velocity.x * ax + s.velocity.z * az > 0 &&
        slope > t.slideDownhillMinSlope;
      const speed = horizontalSpeed(s.velocity);
      if (speed > t.slideMaxSpeed) {
        s.velocity.x *= t.slideMaxSpeed / speed;
        s.velocity.z *= t.slideMaxSpeed / speed;
      }
    }
    if (this.slideDownhill) this.slideDownhillS += dt;
    // Lekkie sterowanie bez przyspieszania: obracamy wektor prędkości w stronę wejścia.
    if (move.dir) {
      const speed = horizontalSpeed(s.velocity);
      accelerateTowards(
        s.velocity,
        move.dir.x * speed,
        move.dir.z * speed,
        t.slideSteer * dt,
      );
    }
    if (
      horizontalSpeed(s.velocity) < t.slideEndSpeed ||
      s.slideS - this.slideDownhillS >= t.slideMaxS ||
      s.slideS >= t.slideDownhillMaxS ||
      !input.held.has('crouch')
    )
      this.endSlide();
  }

  private endSlide(): void {
    const s = this.state;
    if (!s.sliding) return;
    s.sliding = false;
    this.ctx.bus.emit('slide_ended', { user: this.id });
    this.tryStand();
  }

  /** Wstaje, jeśli nad głową jest miejsce; inaczej zostaje w przysiadzie. */
  private tryStand(): void {
    const t = this.ctx.tuning.player;
    if (this.state.height >= t.capsuleHeight) {
      this.state.crouched = false;
      return;
    }
    if (this.setHeight(t.capsuleHeight, this.state.grounded))
      this.state.crouched = false;
  }

  /**
   * Zmienia wysokość kapsuły. keepFeet: stopy zostają na miejscu (środek przesuwa się).
   * Zwraca false (bez zmian), gdy wyższa kapsuła nachodziłaby na otoczenie.
   */
  private setHeight(height: number, keepFeet: boolean): boolean {
    const s = this.state;
    const t = this.ctx.tuning.player;
    if (Math.abs(height - s.height) < 1e-6) return true;
    const dy = keepFeet ? (height - s.height) / 2 : 0;
    const center = { x: s.position.x, y: s.position.y + dy, z: s.position.z };
    if (height > s.height) {
      let blocked = false;
      const shape = new Capsule(
        halfSegment(height, t.capsuleRadius),
        t.capsuleRadius - 0.02,
      );
      this.world.intersectionsWithShape(
        center,
        { x: 0, y: 0, z: 0, w: 1 },
        shape,
        () => {
          blocked = true;
          return false;
        },
        QueryFilterFlags.EXCLUDE_SENSORS,
        interactionGroups(CollisionGroup.Player, CollisionGroup.World),
        this.collider,
      );
      if (blocked) return false;
    }
    s.height = height;
    s.position = center;
    this.collider.setShape(
      new Capsule(halfSegment(height, t.capsuleRadius), t.capsuleRadius),
    );
    this.shapeHeight = height;
    this.body.setTranslation(center, true);
    this.body.setNextKinematicTranslation(center);
    this.world.propagateModifiedBodyPositionsToColliders();
    return true;
  }

  private jump(double: boolean): void {
    const s = this.state;
    if (
      double &&
      !this.stamina.spend(this.ctx.tuning.player.doubleJumpStaminaCost)
    ) {
      if (!this.jumpDenialNotified)
        this.ctx.bus.emit('stamina_denied', {
          user: this.id,
          action: 'doubleJump',
        });
      this.jumpDenialNotified = true;
      return;
    }
    if (s.sliding) this.endSlide(); // slide-jump: pęd poziomy zostaje
    s.velocity.y = double
      ? this.ctx.tuning.player.doubleJumpVelocity
      : this.ctx.tuning.player.jumpVelocity;
    s.grounded = false;
    s.coyoteMs = 0;
    s.jumpBufferMs = 0;
    if (double) s.airJumpsUsed++;
    this.ctx.bus.emit('player_jumped', { id: this.id, double });
  }

  private configure(): void {
    const t = this.ctx.tuning.player;
    this.controller.setOffset(t.controllerOffset);
    this.controller.enableAutostep(t.stepHeight, t.stepMinWidth, false);
    this.controller.setMaxSlopeClimbAngle((t.maxSlopeDeg * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((t.maxSlopeDeg * Math.PI) / 180);
    // Strojenie wysokości/promienia z panelu działa na stojącą kapsułę.
    const target =
      this.state.crouched || this.state.sliding
        ? t.slideCapsuleHeight
        : t.capsuleHeight;
    if (this.shapeRadius !== t.capsuleRadius || this.shapeHeight !== target) {
      this.collider.setShape(
        new Capsule(halfSegment(target, t.capsuleRadius), t.capsuleRadius),
      );
      this.shapeHeight = target;
      this.shapeRadius = t.capsuleRadius;
      this.state.height = target;
    }
  }

  dispose(): void {
    this.world.removeCharacterController(this.controller);
    this.world.removeRigidBody(this.body);
  }
}

function halfSegment(height: number, radius: number): number {
  return Math.max(0, height / 2 - radius);
}

function horizontalSpeed(v: Vec3): number {
  return Math.hypot(v.x, v.z);
}

/** Zbliża (vx, vz) do celu o co najwyżej maxDelta (m/s). */
function accelerateTowards(
  v: Vec3,
  targetX: number,
  targetZ: number,
  maxDelta: number,
): void {
  const dx = targetX - v.x;
  const dz = targetZ - v.z;
  const distance = Math.hypot(dx, dz);
  const fraction = distance > 0 ? Math.min(1, maxDelta / distance) : 0;
  v.x += dx * fraction;
  v.z += dz * fraction;
}
