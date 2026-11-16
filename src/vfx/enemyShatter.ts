import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import type { DebrisSystem } from './debris';
import type { EnemyBody } from './enemyBody';

export interface EnemyShatterOptions {
  /** Pozycja stóp wroga (dla drona: środek bryły); null dla gracza i nieznanych encji. */
  positionOf(id: EntityId): Vec3 | null;
  /** Bryła wroga (`enemyBody()`); bez niej błysk przyjmuje domyślną bryłę humanoida / drona. */
  bodyOf?(id: EntityId): EnemyBody | null;
  /** Pozycja kamery: gwiazda trafienia bliżej niż `hitFlashCameraMinM` jest pomijana. */
  cameraPosition?(): Vec3 | null;
  tuning: Pick<Tuning, 'vfx'>;
  /** Ustawienia (domyślnie `loadSettings()` przy zdarzeniu): `flashes` jak dla wybuchu. */
  settings?: Pick<Settings, 'flashes'>;
}

/** Zapas obrysu błysku względem promienia bryły (kosmetyka). */
const KILL_FLASH_RADIUS_MULT = 1.5;
const HIT_FLASH_RADIUS_MULT = 1.4;
const DEFAULT_BODY = { height: 1.8, radius: 0.3 };
const DEFAULT_DRONE_RADIUS = 0.25;

/** Kapsuła błysku opisana na bryle wroga: środek bryły, promień z zapasem. */
function flashCapsule(
  body: EnemyBody,
  radiusMult: number,
): { origin: Vec3; radius: number; height: number } {
  const radius = body.radius * radiusMult;
  return {
    origin: { x: body.x, y: body.y + body.height / 2, z: body.z },
    radius,
    height: Math.max(body.height, radius * 2),
  };
}

export class EnemyShatter {
  private readonly shattered = new Set<EntityId>();
  private readonly kinds = new Map<EntityId, string>();
  private readonly off: (() => void)[];

  constructor(bus: EventBus, debris: DebrisSystem, opts: EnemyShatterOptions) {
    /** Bryła z `bodyOf`, a bez niej domyślna wokół `pos` (dron: `pos` to środek). */
    const bodyOf = (id: EntityId, pos: Vec3, drone: boolean): EnemyBody =>
      opts.bodyOf?.(id) ??
      (drone
        ? {
            x: pos.x,
            y: pos.y - DEFAULT_DRONE_RADIUS,
            z: pos.z,
            height: DEFAULT_DRONE_RADIUS * 2,
            radius: DEFAULT_DRONE_RADIUS,
          }
        : { x: pos.x, y: pos.y, z: pos.z, ...DEFAULT_BODY });
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
        ...flashCapsule(bodyOf(id, pos, drone), KILL_FLASH_RADIUS_MULT),
        dir,
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
    const nearCamera = (point: Vec3): boolean => {
      const camera = opts.cameraPosition?.();
      return (
        !!camera &&
        Math.hypot(point.x - camera.x, point.y - camera.y, point.z - camera.z) <
          opts.tuning.vfx.hitFlashCameraMinM
      );
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
        ...flashCapsule(bodyOf(id, pos, drone), HIT_FLASH_RADIUS_MULT),
        point: point && !nearCamera(point) ? point : null,
        dir,
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
