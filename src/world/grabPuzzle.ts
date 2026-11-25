import { ColliderDesc, Ray, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { CollisionGroup, interactionGroups } from '../physics';
import type { GrabPhysics } from '../physics/grabPhysics';
import type { GrabPuzzleDefinition, Hazard } from './roomSchema';
import { insideLevelZone } from './levelRuntime';

export type PuzzleOutcome = 'solved' | 'skipped';

export interface GrabPuzzleState {
  readonly previous: Vec3;
  readonly position: Vec3;
  readonly engaged: boolean;
  readonly outcome: PuzzleOutcome | null;
}

interface GrabPuzzleOptions {
  world: World;
  entities: EntityRegistry;
  grab: GrabPhysics;
  hazards: readonly Hazard[];
  tuning: Tuning['puzzle'];
}

export class GrabPuzzle {
  private readonly id: EntityId;
  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly unregister: () => void;
  private readonly laser?: { ray: Ray; distance: number };
  private previous: Vec3;
  private position: Vec3;
  private engaged = false;
  private outcome: PuzzleOutcome | null = null;
  private confirmS = 0;

  constructor(
    private readonly definition: GrabPuzzleDefinition,
    private readonly options: GrabPuzzleOptions,
  ) {
    if (definition.kind === 'laser') {
      const laser = options.hazards.find(
        (hazard) => hazard.id === definition.laserId,
      );
      if (laser?.kind !== 'laser_gate')
        throw new Error('Brak bramki laserowej zagadki.');
      const x = laser.to.x - laser.from.x;
      const y = laser.to.y - laser.from.y;
      const z = laser.to.z - laser.from.z;
      const distance = Math.hypot(x, y, z);
      this.laser = {
        ray: new Ray(laser.from, {
          x: x / distance,
          y: y / distance,
          z: z / distance,
        }),
        distance,
      };
    }
    const { position, size, massKg } = definition.object;
    this.position = this.previous = { ...position };
    this.body = options.world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .lockRotations()
        .setLinearDamping(options.tuning.objectDamping)
        .setCcdEnabled(true),
    );
    this.collider = options.world.createCollider(
      ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
        .setMass(massKg)
        .setCollisionGroups(interactionGroups(CollisionGroup.Debris, 0xffff)),
      this.body,
    );
    this.id = options.entities.create('puzzle_object', 'neutral');
    options.entities.bindCollider(this.id, this.collider.handle);
    this.unregister = options.grab.registerObject(this.id, this.body, massKg);
  }

  view(): GrabPuzzleState {
    return {
      previous: this.previous,
      position: this.position,
      engaged: this.engaged,
      outcome: this.outcome,
    };
  }

  step(dt: number): boolean {
    if (!(dt > 0)) return false;
    this.body.setLinearDamping(this.options.tuning.objectDamping);
    this.previous = this.position;
    this.position = { ...this.body.translation() };
    if (this.outcome !== null) return false;
    this.engaged = this.matchesGoal();
    if (
      this.definition.workArea &&
      this.body.isDynamic() &&
      !(this.laser && this.engaged) &&
      !insideLevelZone(this.position, this.definition.workArea)
    ) {
      const occupied = this.options.world.intersectionWithShape(
        this.definition.object.position,
        this.collider.rotation(),
        this.collider.shape,
        undefined,
        interactionGroups(
          CollisionGroup.Debris,
          CollisionGroup.Player | CollisionGroup.Debris,
        ),
        this.collider,
      );
      if (!occupied) this.reset();
      this.engaged = false;
      this.confirmS = 0;
      return false;
    }
    this.confirmS = this.engaged ? this.confirmS + dt : 0;
    if (this.engaged && this.confirmS >= this.options.tuning.confirmS)
      return this.finish('solved');
    return false;
  }

  blocksLaser(id: string): boolean {
    return (
      this.definition.kind === 'laser' &&
      this.definition.laserId === id &&
      (this.engaged || this.outcome === 'solved')
    );
  }

  finish(outcome: PuzzleOutcome): boolean {
    if (this.outcome !== null) return false;
    this.outcome = outcome;
    if (outcome === 'skipped') this.engaged = false;
    return true;
  }

  /** Przywraca obiekt na miejsce startu i zeruje wynik (ponowna próba po śmierci). */
  reset(): void {
    const { x, y, z } = this.definition.object.position;
    this.body.setTranslation({ x, y, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.position = this.previous = { x, y, z };
    this.engaged = false;
    this.outcome = null;
    this.confirmS = 0;
  }

  private matchesGoal(): boolean {
    if (this.laser)
      return this.collider.intersectsRay(this.laser.ray, this.laser.distance);

    const plate = this.definition;
    if (plate.kind !== 'plate') return false;
    const { x, y, z } = this.position;
    const bottom = y - plate.object.size.y / 2;
    return (
      Math.abs(bottom - plate.position.y) <=
        this.options.tuning.plateClearanceM &&
      Math.hypot(x - plate.position.x, z - plate.position.z) <= plate.radiusM
    );
  }

  dispose(): void {
    this.unregister();
    const { world, entities } = this.options;
    entities.destroy(this.id);
    world.removeRigidBody(this.body);
  }
}
