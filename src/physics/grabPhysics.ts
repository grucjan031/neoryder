import { Ball, QueryFilterFlags } from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { GrabContact, GrabTarget } from '../combat/powers/grabTypes';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { CollisionGroup, interactionGroups } from './index';

/** Rejestr sceny i zapytania fizyki; nie krokuje świata ani nie zadaje obrażeń. */
export class GrabPhysics {
  private readonly objects = new Map<EntityId, GrabTarget>();

  constructor(
    private readonly world: World,
    private readonly entities: EntityRegistry,
    private readonly enemies: () => readonly GrabTarget[],
  ) {}

  registerObject(id: EntityId, body: RigidBody, massKg: number): () => void {
    if (!body.isDynamic() || !Number.isFinite(massKg) || massKg <= 0)
      throw new Error('Chwyt wymaga dynamicznego obiektu z dodatnią masą.');
    const target: GrabTarget = {
      id,
      body,
      massKg,
      enemy: false,
      grabbable: true,
    };
    this.objects.set(id, target);
    return () => {
      if (this.objects.get(id) === target) this.objects.delete(id);
    };
  }

  targets(): readonly GrabTarget[] {
    return [...this.enemies(), ...this.objects.values()].filter(
      (target) => target.body.isValid() && this.entities.alive(target.id),
    );
  }

  private collider(target: GrabTarget): Collider {
    for (let i = 0; i < target.body.numColliders(); i++) {
      const collider = target.body.collider(i);
      if (!collider.isSensor()) return collider;
    }
    return target.body.collider(0);
  }

  holdPosition(
    target: GrabTarget,
    origin: Vec3,
    desired: Vec3,
    options: {
      owner: EntityId;
      playerRadiusM: number;
      clearanceM: number;
    },
  ): Vec3 | null {
    const collider = this.collider(target);
    const from = origin;
    const delta = {
      x: desired.x - from.x,
      y: desired.y - from.y,
      z: desired.z - from.z,
    };
    const floorAtOrigin = new Set<number>();
    let blockedOrigin = false;
    this.world.forEachCollider((other) => {
      if (
        other.isSensor() ||
        ((other.collisionGroups() >>> 16) & CollisionGroup.World) === 0
      )
        return;
      const contact = other.contactShape(
        collider.shape,
        origin,
        collider.rotation(),
        options.clearanceM,
      );
      if (!contact || contact.distance >= options.clearanceM) return;
      if (contact.normal1.y > 0) floorAtOrigin.add(other.handle);
      else blockedOrigin = true;
    });
    if (blockedOrigin) return null;
    const hit = this.world.castShape(
      from,
      collider.rotation(),
      delta,
      collider.shape,
      options.clearanceM,
      1,
      false,
      QueryFilterFlags.EXCLUDE_SENSORS,
      interactionGroups(0xffff, CollisionGroup.World),
      undefined,
      target.body,
      (other) => !floorAtOrigin.has(other.handle),
    );
    const fraction = hit ? Math.max(0, Math.min(1, hit.time_of_impact)) : 1;
    const point = {
      x: from.x + delta.x * fraction,
      y: from.y + delta.y * fraction,
      z: from.z + delta.z * fraction,
    };
    let safe = true;
    let playerFound = false;
    this.world.forEachCollider((other) => {
      if (other.isSensor() || other.parent()?.handle === target.body.handle)
        return;
      if (((other.collisionGroups() >>> 16) & CollisionGroup.World) !== 0) {
        const contact = other.contactShape(
          collider.shape,
          point,
          collider.rotation(),
          options.clearanceM,
        );
        if (
          contact &&
          contact.distance < options.clearanceM &&
          contact.normal1.y > 0
        ) {
          const correction = options.clearanceM - contact.distance;
          point.x += contact.normal1.x * correction;
          point.y += contact.normal1.y * correction;
          point.z += contact.normal1.z * correction;
        }
      }
    });
    this.world.forEachCollider((other) => {
      if (
        other.isSensor() ||
        this.entities.byCollider(other.handle) !== options.owner
      )
        return;
      playerFound = true;
      const contact = other.contactShape(
        collider.shape,
        point,
        collider.rotation(),
        options.clearanceM,
      );
      if (contact && contact.distance < options.clearanceM) safe = false;
    });
    if (!playerFound) {
      const contact = new Ball(options.playerRadiusM).contactShape(
        origin,
        { x: 0, y: 0, z: 0, w: 1 },
        collider.shape,
        point,
        collider.rotation(),
        options.clearanceM,
      );
      if (contact && contact.distance < options.clearanceM) safe = false;
    }
    return safe ? point : null;
  }

  placeForRelease(target: GrabTarget): void {
    target.body.setTranslation(target.body.nextTranslation(), true);
    this.world.propagateModifiedBodyPositionsToColliders();
  }

  sweep(
    target: GrabTarget,
    velocity: Vec3,
    dt: number,
    accept: (contact: GrabContact) => boolean = () => true,
  ): GrabContact | null {
    const collider = this.collider(target);
    const excluded = new Set<number>();
    let best: GrabContact | null = null;
    let maxToi = dt;
    for (;;) {
      const hit = this.world.castShape(
        collider.translation(),
        collider.rotation(),
        velocity,
        collider.shape,
        0,
        maxToi,
        true,
        undefined,
        interactionGroups(0xffff, CollisionGroup.World | CollisionGroup.Enemy),
        undefined,
        target.body,
        (other) =>
          !excluded.has(other.handle) &&
          this.isImpactCollider(other, target.id),
      );
      if (!hit) break;
      excluded.add(hit.collider.handle);
      const id = this.entities.byCollider(hit.collider.handle);
      const contact: GrabContact = {
        impact: true,
        enemy:
          id !== undefined && this.entities.team(id) === 'enemy' ? id : null,
        point: { ...hit.witness1 },
        normalY: hit.normal1.y,
        normal: { ...hit.normal1 },
      };
      if (!accept(contact)) continue;
      if (!best || contact.enemy !== null) best = contact;
      maxToi = Math.min(maxToi, hit.time_of_impact + 1e-6);
    }
    return best;
  }

  private isImpactCollider(collider: Collider, self: EntityId): boolean {
    const id = this.entities.byCollider(collider.handle);
    if (id === self) return false;
    if (id !== undefined && this.entities.team(id) === 'enemy') return true;
    return (
      !collider.isSensor() &&
      ((collider.collisionGroups() >>> 16) & CollisionGroup.World) !== 0
    );
  }

  contacts(target: GrabTarget): GrabContact[] {
    const result: GrabContact[] = [];
    const collider = this.collider(target);
    this.world.contactPairsWith(collider, (other) => {
      if (other.isSensor() || other.parent()?.handle === target.body.handle)
        return;
      this.world.contactPair(collider, other, (manifold, flipped) => {
        if (manifold.numSolverContacts() === 0) return;
        const id = this.entities.byCollider(other.handle);
        result.push({
          impact: this.isImpactCollider(other, target.id),
          enemy:
            id !== undefined && this.entities.team(id) === 'enemy' ? id : null,
          point: {
            ...(manifold.solverContactPoint(0) ?? target.body.translation()),
          },
          normalY: manifold.normal().y * (flipped ? 1 : -1),
          normal: {
            x: manifold.normal().x * (flipped ? 1 : -1),
            y: manifold.normal().y * (flipped ? 1 : -1),
            z: manifold.normal().z * (flipped ? 1 : -1),
          },
        });
      });
    });
    return result;
  }
}
