import type {
  Collider,
  Rotation,
  Shape,
  Vector,
  World,
} from '@dimforge/rapier3d-compat';
import type { EntityId } from '../../core/events';

/** Collider przyjmujący obrażenia. multiplier: np. 1.5 dla głowy. */
export interface Hurtbox {
  entity: EntityId;
  colliderHandle: number;
  multiplier: number;
}

/** Indeks hurtboxów po uchwycie collidera Rapier. */
export class Hurtboxes {
  private readonly byHandle = new Map<number, Hurtbox>();

  add(entity: EntityId, collider: Collider | number, multiplier = 1): Hurtbox {
    const colliderHandle =
      typeof collider === 'number' ? collider : collider.handle;
    const box = { entity, colliderHandle, multiplier };
    this.byHandle.set(colliderHandle, box);
    return box;
  }

  get(colliderHandle: number): Hurtbox | undefined {
    return this.byHandle.get(colliderHandle);
  }

  removeEntity(entity: EntityId): void {
    for (const [handle, box] of this.byHandle)
      if (box.entity === entity) this.byHandle.delete(handle);
  }

  clear(): void {
    this.byHandle.clear();
  }
}

/**
 * Hurtboxy przecinające kształt (np. łuk cięcia). Zwraca co najwyżej jeden hurtbox na encję:
 * ten z największym mnożnikiem. filterGroups: interactionGroups(member, filter) atakującego.
 */
export function queryHurtboxes(
  world: World,
  hurtboxes: Hurtboxes,
  shape: Shape,
  position: Vector,
  rotation: Rotation,
  filterGroups?: number,
): Hurtbox[] {
  const best = new Map<EntityId, Hurtbox>();
  world.intersectionsWithShape(
    position,
    rotation,
    shape,
    (collider) => {
      const box = hurtboxes.get(collider.handle);
      if (box) {
        const current = best.get(box.entity);
        if (!current || box.multiplier > current.multiplier)
          best.set(box.entity, box);
      }
      return true;
    },
    undefined,
    filterGroups,
  );
  return [...best.values()];
}
