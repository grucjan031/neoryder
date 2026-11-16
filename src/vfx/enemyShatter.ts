import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import type { DebrisSystem } from './debris';

export interface EnemyShatterOptions {
  /** Pozycja stóp wroga (dla drona: środek bryły); null dla gracza i nieznanych encji. */
  positionOf(id: EntityId): Vec3 | null;
  tuning: Pick<Tuning, 'vfx'>;
  /** Ustawienia (domyślnie `loadSettings()` przy zdarzeniu): `flashes` jak dla wybuchu. */
  settings?: Pick<Settings, 'flashes'>;
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
      tags: readonly string[] = [],
    ): void => {
      if (this.shattered.has(id)) return;
      const pos = opts.positionOf(id);
      if (!pos) return;
      this.shattered.add(id);
      const t = opts.tuning.vfx;
      const tint = tags.includes('#power') ? 1 : 0;
      const drone = this.kinds.get(id) === 'drone';
      debris.flash({
        kind: 'kill',
        origin: { x: pos.x, y: drone ? pos.y : pos.y + 1.1, z: pos.z },
        dir,
        radius: drone ? 0.35 : 0.45,
        height: drone ? 0.7 : 1.8,
        tint,
        muted: !(opts.settings ?? loadSettings()).flashes,
        life: t.killFlashS,
      });
      if (drone) {
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
          tint,
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
        tint,
      });
      debris.burst({
        origin: { x: pos.x, y: pos.y + 1.65, z: pos.z },
        dir,
        strength,
        count: headCount,
        size: t.debrisSize,
        bounds: { halfX: 0.18, halfY: 0.18, halfZ: 0.18 },
        tint,
      });
    };
    /** Błysk sylwetki trafionego (żywego) wroga i iskra w punkcie trafienia. */
    const hit = (
      id: EntityId,
      point: Vec3 | null,
      dir: Vec3 | null,
      tags: readonly string[],
    ): void => {
      if (this.shattered.has(id)) return;
      const pos = opts.positionOf(id);
      if (!pos) return;
      const drone = this.kinds.get(id) === 'drone';
      debris.flash({
        kind: 'hit',
        origin: { x: pos.x, y: drone ? pos.y : pos.y + 0.9, z: pos.z },
        point,
        dir,
        radius: drone ? 0.38 : 0.42,
        height: drone ? 0.76 : 1.85,
        tint: tags.includes('#power') ? 1 : 0,
        muted: !(opts.settings ?? loadSettings()).flashes,
        life: opts.tuning.vfx.hitFlashS,
      });
    };
    this.off = [
      bus.on('damage_dealt', (event) => {
        if (event.killed)
          burst(
            event.target,
            event.amount,
            event.knockback,
            event.dir,
            event.tags,
          );
        else if (event.amount > 0 && !event.tags.includes('#status'))
          hit(event.target, event.point, event.dir, event.tags);
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
