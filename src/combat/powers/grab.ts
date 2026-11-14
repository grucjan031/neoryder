import { RigidBodyType } from '@dimforge/rapier3d-compat';
import type { EntityId } from '../../core/events';
import type { Vec3 } from '../../core/math';
import { dot, normalize, scale, sub } from '../../core/math';
import type { GrabContact, GrabTarget } from './grabTypes';
import { PowerBase } from './power';
import type { PowerInput } from './power';
import type { GrabPowerDefinition } from './powerSchema';

interface Captured {
  target: GrabTarget;
  bodyType: RigidBodyType;
  ccd: boolean;
}
interface Flight extends Captured {
  velocity: Vec3;
  damaging: boolean;
  impacted: boolean;
  fresh: boolean;
}
interface BeamPoints {
  from: Vec3;
  to: Vec3;
}
export interface GrabBeam {
  previous: BeamPoints;
  current: BeamPoints;
}

const epsilon = 1e-6;

export class GrabPower extends PowerBase<GrabPowerDefinition> {
  private selected: GrabTarget | null = null;
  private held: Captured | null = null;
  private heldS = 0;
  private readonly flights: Flight[] = [];
  private readonly off: (() => void)[] = [];
  private pendingRelease = false;
  private visual: GrabBeam | null = null;

  get heldTarget(): EntityId | null {
    return this.held?.target.id ?? null;
  }
  get beam(): Readonly<GrabBeam> | null {
    return this.visual;
  }
  override get active(): boolean {
    return this.held !== null;
  }
  protected override get cooldownOnActivation(): boolean {
    return false;
  }

  override step(dt: number, input: PowerInput, worldDt = dt): void {
    if (
      input.released &&
      (this.active || this.activationQueued || input.pressed)
    )
      this.pendingRelease = true;
    // Wciśnięcie i puszczenie w hitstopie nadal wykonuje jeden chwyt i rzut.
    super.step(dt, input);
    if (dt > 0 && this.pendingRelease) {
      this.pendingRelease = false;
      if (this.held) this.release(true);
    }
    if (worldDt > 0) this.stepFlights(worldDt);
    if (!(dt > 0) && this.visual) this.visual.previous = this.visual.current;
  }

  protected override canActivate(): boolean {
    if (this.active || this.deps.damage.health(this.deps.owner)?.dead)
      return false;
    this.selected = this.findTarget();
    const reason = !this.selected
      ? 'out_of_range'
      : !this.selected.grabbable || this.selected.massKg > this.def.maxMassKg
        ? 'too_heavy'
        : null;
    if (reason) {
      this.deps.bus.emit('power_denied', {
        power: this.def.id,
        user: this.deps.owner,
        reason,
      });
      this.selected = null;
      return false;
    }
    return true;
  }

  private findTarget(): GrabTarget | null {
    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const cosHalf = Math.cos((this.def.aimConeDeg * Math.PI) / 360);
    let closest: GrabTarget | null = null;
    let distance = this.def.rangeM + epsilon;
    for (const target of this.deps.grab?.targets() ?? []) {
      if (target.controlled) continue;
      if (this.flights.some((flight) => flight.target.id === target.id))
        continue;
      if (target.enemy && this.deps.damage.health(target.id)?.dead) continue;
      const to = sub(target.body.translation(), origin);
      const length = Math.hypot(to.x, to.y, to.z);
      if (
        length < epsilon ||
        length > distance ||
        length > this.def.rangeM + epsilon
      )
        continue;
      const away = scale(to, 1 / length);
      if (this.def.aimConeDeg < 360 && dot(away, forward) < cosHalf - epsilon)
        continue;
      const wall = this.deps.castWall(origin, away, length);
      if (wall !== null && wall < length - epsilon) continue;
      closest = target;
      distance = length;
    }
    return closest;
  }

  protected override activate(): number {
    const target = this.selected!;
    this.selected = null;
    const body = target.body;
    this.held = { target, bodyType: body.bodyType(), ccd: body.isCcdEnabled() };
    this.heldS = 0;
    target.setControlled?.(true);
    body.setBodyType(RigidBodyType.KinematicPositionBased, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.subscribe();
    this.moveHeld();
    return 1;
  }

  protected override stepEffect(dt: number): void {
    if (!this.held) return;
    if (!this.held.target.body.isValid()) {
      this.finishTarget(this.held.target.id);
      return;
    }
    if (this.pendingRelease) {
      this.moveHeld();
      return;
    }
    const duration = Math.min(dt, Math.max(0, this.def.maxHoldS - this.heldS));
    const cost = duration * this.def.drainPerS;
    if (this.deps.energy.current + epsilon < cost) {
      this.deps.energy.spend(this.deps.energy.current);
      this.release(false);
      return;
    }
    this.deps.energy.spend(Math.min(cost, this.deps.energy.current));
    this.heldS += duration;
    if (
      this.deps.energy.current <= epsilon ||
      this.heldS + epsilon >= this.def.maxHoldS
    ) {
      this.release(false);
      return;
    }
    this.moveHeld();
  }

  private moveHeld(): void {
    if (!this.held) return;
    const { origin, dir } = this.deps.aim();
    const forward = normalize(dir);
    const desired = {
      x: origin.x + forward.x * this.def.holdDistanceM,
      y: origin.y + forward.y * this.def.holdDistanceM,
      z: origin.z + forward.z * this.def.holdDistanceM,
    };
    const point = this.deps.grab!.holdPosition(
      this.held.target,
      origin,
      desired,
      {
        owner: this.deps.owner,
        playerRadiusM: this.deps.tuning.player.capsuleRadius,
        clearanceM: this.deps.tuning.powers.grabClearanceM,
      },
    );
    if (!point) {
      this.release(false);
      return;
    }
    this.held.target.body.setNextKinematicTranslation(point);
    const current = { from: { ...origin }, to: { ...point } };
    this.visual = { previous: this.visual?.current ?? current, current };
  }

  private release(throwing: boolean): void {
    const captured = this.held;
    if (!captured) return;
    this.held = null;
    this.visual = null;
    const body = captured.target.body;
    if (body.isValid()) {
      this.deps.grab!.placeForRelease(captured.target);
      const velocity = throwing
        ? scale(normalize(this.deps.aim().dir), this.def.throwSpeed)
        : { x: 0, y: 0, z: 0 };
      body.setBodyType(RigidBodyType.Dynamic, true);
      body.enableCcd(true);
      body.setLinvel(velocity, true);
      this.flights.push({
        ...captured,
        velocity,
        damaging: throwing,
        impacted: false,
        fresh: true,
      });
    }
    this.startCooldown();
    this.deps.bus.emit('power_released', {
      power: this.def.id,
      user: this.deps.owner,
    });
    this.unsubscribeIfIdle();
  }

  private stepFlights(dt: number): void {
    for (const flight of [...this.flights]) {
      const { target } = flight;
      if (!target.body.isValid()) {
        this.finishTarget(target.id);
        continue;
      }
      const contacts = flight.fresh ? [] : this.deps.grab!.contacts(target);
      flight.fresh = false;
      const currentVelocity = target.body.linvel();
      const currentSpeed = Math.hypot(
        currentVelocity.x,
        currentVelocity.y,
        currentVelocity.z,
      );
      const accepts = (hit: GrabContact, velocity: Vec3): boolean => {
        if (!hit.impact) return false;
        if (hit.enemy !== null) return true;
        if (
          hit.normalY >= this.def.landingNormalY &&
          currentSpeed > this.def.landingSpeedMps
        )
          return false;
        return -dot(hit.normal, velocity) + epsilon >= this.def.minImpactSpeed;
      };
      const eligible = contacts.filter((hit) => accepts(hit, flight.velocity));
      const actualImpact =
        eligible.find((hit) => hit.enemy !== null) ?? eligible[0];
      const contact =
        actualImpact ??
        this.deps.grab!.sweep(target, currentVelocity, dt, (hit) =>
          accepts(hit, currentVelocity),
        );
      if (contact && flight.damaging && !flight.impacted) {
        const velocity = actualImpact ? flight.velocity : target.body.linvel();
        if (
          Math.hypot(velocity.x, velocity.y, velocity.z) + epsilon >=
          this.def.minImpactSpeed
        ) {
          flight.impacted = true;
          this.impact(flight, contact, velocity);
        }
      }
      if (!this.flights.includes(flight)) continue;
      if (flight.impacted && !target.enemy) {
        this.finishTarget(target.id);
        continue;
      }
      if (
        contacts.some((hit) => hit.normalY >= this.def.landingNormalY) &&
        currentSpeed <= this.def.landingSpeedMps
      ) {
        this.finishTarget(target.id);
      } else flight.velocity = { ...target.body.linvel() };
    }
  }

  private impact(flight: Flight, contact: GrabContact, velocity: Vec3): void {
    // Oba trafienia należą do tego samego uderzenia, także jeśli pierwsze zabije rzucanego.
    const victims = new Set<EntityId>();
    if (flight.target.enemy) victims.add(flight.target.id);
    if (contact.enemy !== null) victims.add(contact.enemy);
    for (const target of victims)
      this.deps.damage.deal(target, {
        source: this.deps.owner,
        amount: this.def.impactDamage,
        tags: this.def.tags,
        point: contact.point,
        dir: normalize(velocity),
      });
  }

  private restore(captured: Captured): void {
    const body = captured.target.body;
    if (body.isValid()) {
      body.setBodyType(captured.bodyType, true);
      body.enableCcd(captured.ccd);
      if (!body.isDynamic()) {
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setNextKinematicTranslation(body.translation());
      }
    }
    captured.target.setControlled?.(false);
  }

  private finishTarget(id: EntityId): void {
    if (this.held?.target.id === id) {
      const held = this.held;
      this.held = null;
      this.visual = null;
      this.restore(held);
      this.startCooldown();
      this.deps.bus.emit('power_released', {
        power: this.def.id,
        user: this.deps.owner,
      });
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i]!;
      if (flight.target.id !== id) continue;
      this.flights.splice(i, 1);
      this.restore(flight);
    }
    this.unsubscribeIfIdle();
  }

  private subscribe(): void {
    if (this.off.length) return;
    this.off.push(
      this.deps.bus.on('enemy_killed', ({ id }) => this.finishTarget(id)),
      this.deps.bus.on('entity_despawned', ({ id }) => this.finishTarget(id)),
      this.deps.bus.on('player_died', ({ id }) => {
        if (id !== this.deps.owner) return;
        if (this.held) this.release(false);
        for (const flight of this.flights) flight.damaging = false;
      }),
    );
  }

  private unsubscribeIfIdle(): void {
    if (this.held || this.flights.length) return;
    for (const off of this.off.splice(0)) off();
  }

  protected override resetEffect(): void {
    const captured = [...(this.held ? [this.held] : []), ...this.flights];
    this.held = null;
    this.flights.length = 0;
    for (const item of captured) this.restore(item);
    this.selected = null;
    this.visual = null;
    this.pendingRelease = false;
    this.heldS = 0;
    this.unsubscribeIfIdle();
  }
}
