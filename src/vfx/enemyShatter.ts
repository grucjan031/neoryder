import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { DebrisSystem } from './debris';

export interface EnemyShatterOptions {
  /** Pozycja stóp wroga (dla drona: środek bryły); null dla gracza i nieznanych encji. */
  positionOf(id: EntityId): Vec3 | null;
  tuning: Pick<Tuning, 'vfx'>;
}

export class EnemyShatter {
  private readonly shattered = new Set<EntityId>();
  private readonly kinds = new Map<EntityId, string>();
  private readonly off: (() => void)[];

  constructor(bus: EventBus, debris: DebrisSystem, opts: EnemyShatterOptions) {
    const burst = (
      id: EntityId,
      amount: number,
      knockback: number,
      dir: Vec3 | null,
    ): void => {
      if (this.shattered.has(id)) return;
      const pos = opts.positionOf(id);
      if (!pos) return;
      this.shattered.add(id);
      const t = opts.tuning.vfx;
      if (this.kinds.get(id) === 'drone') {
        const n = Math.max(
          1,
          Math.round(
            Math.min(
              t.debrisMax,
              t.debrisMin + Math.max(0, amount) * t.debrisPerDamage,
            ) * t.droneDebrisCountMult,
          ),
        );
        const strength = t.debrisStrength + Math.max(0, knockback);
        debris.burst({
          origin: { x: pos.x, y: pos.y, z: pos.z },
          dir,
          strength,
          spread: strength * 0.65 * t.droneDebrisSpreadMult,
          count: n,
          size: t.debrisSize * t.droneDebrisSizeMult,
          bounds: { halfX: 0.3, halfY: 0.3, halfZ: 0.3 },
        });
        return;
      }
      const count = Math.round(
        Math.max(
          t.debrisMin,
          Math.min(
            t.debrisMax,
            t.debrisMin + Math.max(0, amount) * t.debrisPerDamage,
          ),
        ),
      );
      const headCount = Math.max(1, Math.floor(count / 5));
      const strength =
        t.debrisStrength +
        Math.max(0, knockback) +
        Math.max(0, amount) * t.debrisPerDamage * t.debrisSize;
      debris.burst({
        origin: { x: pos.x, y: pos.y + 1, z: pos.z },
        dir,
        strength,
        count: count - headCount,
        size: t.debrisSize,
        bounds: { halfX: 0.3, halfY: 0.65, halfZ: 0.2 },
      });
      debris.burst({
        origin: { x: pos.x, y: pos.y + 1.65, z: pos.z },
        dir,
        strength,
        count: headCount,
        size: t.debrisSize,
        bounds: { halfX: 0.18, halfY: 0.18, halfZ: 0.18 },
      });
    };
    this.off = [
      bus.on('damage_dealt', (event) => {
        if (event.killed)
          burst(event.target, event.amount, event.knockback, event.dir);
      }),
      bus.on('enemy_killed', ({ id }) => burst(id, 0, 0, null)),
      bus.on('entity_spawned', ({ id, kind }) => {
        this.shattered.delete(id);
        this.kinds.set(id, kind);
      }),
      bus.on('entity_despawned', ({ id }) => {
        this.shattered.delete(id);
        this.kinds.delete(id);
      }),
    ];
  }

  dispose(): void {
    for (const off of this.off) off();
    this.shattered.clear();
    this.kinds.clear();
  }
}
