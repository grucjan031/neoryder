import type { EntityId, EventBus, Team } from './events';

export type { EntityId, Team } from './events';

interface EntityRecord {
  kind: string;
  team: Team;
  colliders: Set<number>;
}

/**
 * Rejestr encji: przydziela identyfikatory, pamięta rodzaj i drużynę,
 * mapuje uchwyty colliderów Rapier na encje (trafienia, zapytania fizyki).
 */
export class EntityRegistry {
  private nextId = 1;
  private readonly entities = new Map<EntityId, EntityRecord>();
  private readonly colliders = new Map<number, EntityId>();

  constructor(private readonly bus?: EventBus) {}

  create(kind: string, team: Team): EntityId {
    const id = this.nextId++;
    this.entities.set(id, { kind, team, colliders: new Set() });
    this.bus?.emit('entity_spawned', { id, kind });
    return id;
  }

  destroy(id: EntityId): void {
    const record = this.entities.get(id);
    if (!record) return;
    for (const handle of record.colliders) this.colliders.delete(handle);
    this.entities.delete(id);
    this.bus?.emit('entity_despawned', { id });
  }

  alive(id: EntityId): boolean {
    return this.entities.has(id);
  }

  team(id: EntityId): Team | undefined {
    return this.entities.get(id)?.team;
  }

  /** Zmiana drużyny (np. odbity pocisk przechodzi na stronę gracza). */
  setTeam(id: EntityId, team: Team): void {
    const record = this.entities.get(id);
    if (record) record.team = team;
  }

  kind(id: EntityId): string | undefined {
    return this.entities.get(id)?.kind;
  }

  bindCollider(id: EntityId, colliderHandle: number): void {
    const record = this.entities.get(id);
    if (!record) throw new Error(`Encja ${id} nie istnieje.`);
    const previous = this.colliders.get(colliderHandle);
    if (previous !== undefined && previous !== id)
      this.entities.get(previous)?.colliders.delete(colliderHandle);
    record.colliders.add(colliderHandle);
    this.colliders.set(colliderHandle, id);
  }

  unbindCollider(colliderHandle: number): void {
    const id = this.colliders.get(colliderHandle);
    if (id === undefined) return;
    this.entities.get(id)?.colliders.delete(colliderHandle);
    this.colliders.delete(colliderHandle);
  }

  byCollider(colliderHandle: number): EntityId | undefined {
    return this.colliders.get(colliderHandle);
  }

  get size(): number {
    return this.entities.size;
  }

  ids(): EntityId[] {
    return [...this.entities.keys()];
  }
}
