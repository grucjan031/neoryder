import type { EntityId, EventBus } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { DamageSystem } from '../damage';
import type { StatusApplication } from '../damage/types';
import { statusDefinitions } from './statusSchema';
import type { StatusDefinition } from './statusSchema';

export const STATUS_TAG = '#status';
/** Status, przy którym wróg nie atakuje (src/data/statuses/stunned.json). */
export const STUNNED = 'stunned';
const epsilon = 1e-6;

export interface StatusQuery {
  has(target: EntityId, status: string): boolean;
  stacks(target: EntityId, status: string): number;
  /** Pozostały czas w sekundach, 0 gdy brak. */
  remaining(target: EntityId, status: string): number;
}

export interface StatusDeps {
  /** Dla wyładowań w promieniu. */
  position(id: EntityId): Vec3 | null;
  /** Potencjalne cele wyładowań. */
  targets(): readonly EntityId[];
}

export interface ActiveStatus {
  id: string;
  stacks: number;
  remainingS: number;
  source: EntityId | null;
}

interface Instance extends ActiveStatus {
  tickS: number;
}

/**
 * Statusy (F2-02): nakładane wyłącznie z `damage_dealt.statuses` (gdy amount > 0 i cel przeżył),
 * odliczane w czasie symulacji. Obrażenia statusów idą przez `DamageSystem.deal` ze źródłem
 * nakładającego i tagami statusu + '#status', bez `statuses` — wyładowanie nie tworzy pętli.
 */
export class StatusSystem implements StatusQuery {
  private readonly active = new Map<EntityId, Map<string, Instance>>();
  private readonly off: (() => void)[];

  constructor(
    private readonly bus: EventBus,
    private readonly damage: DamageSystem,
    private readonly deps: StatusDeps,
    private readonly defs: ReadonlyMap<
      string,
      StatusDefinition
    > = statusDefinitions,
  ) {
    this.off = [
      bus.on('damage_dealt', (event) => {
        if (!event.statuses || !(event.amount > 0) || event.killed) return;
        for (const app of event.statuses)
          this.apply(event.target, app, event.source);
      }),
      bus.on('enemy_killed', ({ id }) => this.clear(id)),
      bus.on('player_died', ({ id }) => this.clear(id)),
      bus.on('entity_despawned', ({ id }) => this.clear(id)),
    ];
  }

  has(target: EntityId, status: string): boolean {
    return this.active.get(target)?.has(status) ?? false;
  }
  stacks(target: EntityId, status: string): number {
    return this.active.get(target)?.get(status)?.stacks ?? 0;
  }
  remaining(target: EntityId, status: string): number {
    return this.active.get(target)?.get(status)?.remainingS ?? 0;
  }
  /** Aktywne statusy celu (HUD, debug). */
  list(target: EntityId): ActiveStatus[] {
    return [...(this.active.get(target)?.values() ?? [])].map(
      ({ id, stacks, remainingS, source }) => ({
        id,
        stacks,
        remainingS,
        source,
      }),
    );
  }

  /**
   * Nakłada status: stosy sumują się do `maxStacks`, czas trwania to dłuższy z obecnego i nowego.
   * Tylko dla StatusSystem (z damage_dealt), testów i komend debug — reszta gry nakłada statusy
   * przez `DamageInfo.statuses`.
   */
  apply(
    target: EntityId,
    app: StatusApplication,
    source: EntityId | null,
  ): boolean {
    const def = this.defs.get(app.id);
    if (!def) throw new Error(`Nieznany status: ${app.id}`);
    const health = this.damage.health(target);
    if (!health || health.dead || !(app.durationS > 0)) return false;
    let statuses = this.active.get(target);
    if (!statuses) {
      statuses = new Map();
      this.active.set(target, statuses);
    }
    const active = statuses.get(def.id);
    if (
      active &&
      def.moveSpeedScale !== undefined &&
      active.stacks === def.maxStacks &&
      active.source === source
    ) {
      active.remainingS = Math.max(active.remainingS, app.durationS);
      return true;
    }
    const instance = active ?? {
      id: def.id,
      stacks: 0,
      remainingS: 0,
      source,
      tickS: 0,
    };
    statuses.set(def.id, instance);
    instance.stacks = Math.min(
      def.maxStacks,
      instance.stacks + (app.stacks ?? 1),
    );
    instance.remainingS = Math.max(instance.remainingS, app.durationS);
    instance.source = source;
    this.updateModifier(target, def, instance.stacks);
    this.bus.emit('status_applied', {
      target,
      status: def.id,
      stacks: instance.stacks,
      durationS: instance.remainingS,
      source,
    });
    if (instance.stacks >= def.maxStacks && def.onMaxStacks)
      this.trigger(target, def, source);
    return true;
  }

  /** Czas symulacji: tiki obrażeń, potem wygaśnięcie. dt = 0 (hitstop) nic nie zmienia. */
  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const [target, statuses] of [...this.active]) {
      for (const instance of [...statuses.values()]) {
        if (this.active.get(target)?.get(instance.id) !== instance) continue;
        const def = this.defs.get(instance.id);
        if (!def) continue;
        instance.remainingS -= dt;
        if (def.tick) {
          instance.tickS += dt;
          while (instance.tickS + epsilon >= def.tick.intervalS) {
            instance.tickS -= def.tick.intervalS;
            this.damage.deal(target, {
              amount: def.tick.damage * instance.stacks,
              source: instance.source,
              tags: [...def.tags, STATUS_TAG],
            });
            if (this.active.get(target)?.get(instance.id) !== instance) break;
          }
        }
        if (
          instance.remainingS <= epsilon &&
          this.active.get(target)?.get(instance.id) === instance
        )
          this.remove(target, def.id);
      }
    }
  }

  /** Śmierć, despawn: zdejmuje statusy celu (z modyfikatorami) i emituje status_expired. */
  clear(target: EntityId): void {
    for (const id of [...(this.active.get(target)?.keys() ?? [])])
      this.remove(target, id);
  }

  /** Nowy run: wszystko znika bez zdarzeń, modyfikatory zdjęte. */
  reset(): void {
    for (const [target, statuses] of this.active)
      for (const id of statuses.keys())
        this.damage.stats(target)?.removeBySource(modifierSource(id));
    this.active.clear();
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.reset();
  }

  private remove(target: EntityId, id: string): void {
    const statuses = this.active.get(target);
    if (!statuses?.delete(id)) return;
    if (statuses.size === 0) this.active.delete(target);
    this.damage.stats(target)?.removeBySource(modifierSource(id));
    this.bus.emit('status_expired', { target, status: id });
  }

  private updateModifier(
    target: EntityId,
    def: StatusDefinition,
    stacks: number,
  ): void {
    if (
      def.damageTakenPerStack === undefined &&
      def.moveSpeedScale === undefined
    )
      return;
    const stats = this.damage.stats(target);
    if (!stats) return;
    stats.removeBySource(modifierSource(def.id));
    if (def.moveSpeedScale !== undefined)
      stats.add({
        stat: 'moveSpeed',
        type: 'mult',
        value: def.moveSpeedScale,
        source: modifierSource(def.id),
      });
    if (def.damageTakenPerStack !== undefined)
      stats.add({
        stat: 'damageTaken',
        type: 'percent',
        value: def.damageTakenPerStack * stacks,
        source: modifierSource(def.id),
      });
  }

  private trigger(
    target: EntityId,
    def: StatusDefinition,
    source: EntityId | null,
  ): void {
    const effect = def.onMaxStacks;
    if (!effect) return;
    const center = this.deps.position(target);
    this.remove(target, def.id);
    for (const app of effect.apply) this.apply(target, app, source);
    const discharge = effect.discharge;
    if (!discharge || !center) return;
    for (const other of [...this.deps.targets()]) {
      if (other === target) continue;
      const p = this.deps.position(other);
      if (!p) continue;
      const dx = p.x - center.x,
        dy = p.y - center.y,
        dz = p.z - center.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > discharge.radiusM + epsilon) continue;
      this.damage.deal(other, {
        amount: discharge.damage,
        source,
        tags: [...discharge.tags, STATUS_TAG],
        point: p,
        ...(distance > epsilon
          ? { dir: { x: dx / distance, y: dy / distance, z: dz / distance } }
          : {}),
      });
    }
  }
}

function modifierSource(id: string): string {
  return `status:${id}`;
}
