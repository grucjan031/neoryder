import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import type { DebrisSystem } from './debris';
import type { EnemyBody } from './enemyBody';

import {
  deathDirection,
  deathDuration,
  deathPose,
} from '../enemies/enemyDeath';

export interface EnemyShatterOptions {
  /** Pozycja stóp wroga (dla drona: środek bryły); null dla gracza i nieznanych encji. */
  positionOf(id: EntityId): Vec3 | null;
  /** Bryła wroga (`enemyBody()`); bez niej błysk przyjmuje domyślną bryłę humanoida / drona. */
  bodyOf?(id: EntityId): EnemyBody | null;
  /** Pozycja kamery: gwiazda trafienia bliżej niż `hitFlashCameraMinM` jest pomijana. */
  cameraPosition?(): Vec3 | null;
  tuning: Pick<Tuning, 'vfx'>;
  collapse?: {
    tuning: Tuning['enemies'];
    ageOf?(id: EntityId): number | undefined;
  };
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
  private pending: {
    id: EntityId;
    elapsed: number;
    duration: number;
    finish: () => void;
  }[] = [];
  private readonly off: (() => void)[];

  constructor(
    bus: EventBus,
    debris: DebrisSystem,
    private readonly opts: EnemyShatterOptions,
  ) {
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
      point: Vec3 | null = null,
    ): void => {
      if (this.shattered.has(id)) return;
      const pos = opts.positionOf(id);
      if (!pos) return;
      this.shattered.add(id);
      const t = opts.tuning.vfx;
      const tint = tags.includes('#power') ? 1 : 0;
      const kind = this.kinds.get(id);
      const drone = kind === 'drone' || kind === 'hacker';
      debris.flash({
        kind: 'kill',
        ...flashCapsule(bodyOf(id, pos, drone), KILL_FLASH_RADIUS_MULT),
        dir,
        tint,
        muted: !(opts.settings ?? loadSettings()).flashes,
        life: t.killFlashS,
      });
      const baseCount = Math.min(
        t.debrisMax,
        t.debrisMin + Math.max(0, amount) * t.debrisPerDamage,
      );
      const count = Math.max(
        1,
        Math.round(baseCount * (drone ? t.droneDebrisCountMult : 1)),
      );
      const strength =
        t.debrisStrength +
        Math.max(0, knockback) +
        (drone ? 0 : Math.max(0, amount) * t.debrisPerDamage * t.debrisSize);
      const collapse = kind === 'turret' ? undefined : opts.collapse?.tuning;
      const duration = collapse ? deathDuration(tags, collapse) : 0;
      const away = deathDirection(dir);
      const pose =
        collapse && duration > 0 ? deathPose(1, drone, collapse) : null;
      const originAt = (height: number): Vec3 => {
        if (!pose) return { x: pos.x, y: pos.y + height, z: pos.z };
        const distance = pose.slide + height * Math.sin(pose.tilt);
        return {
          x: pos.x + away.x * distance,
          y: pos.y + height * Math.cos(pose.tilt) - pose.drop,
          z: pos.z + away.z * distance,
        };
      };
      const chips = pose
        ? Math.min(
            count - 1,
            Math.max(0, Math.round(count * t.deathCollapseChipFraction)),
          )
        : 0;
      if (chips > 0)
        debris.burst({
          origin: point ?? { ...pos, y: pos.y + (drone ? 0 : 1) },
          dir,
          strength,
          count: chips,
          size: t.debrisSize,
          bounds: { halfX: 0.18, halfY: 0.18, halfZ: 0.18 },
          tint,
        });
      const finish = (): void => {
        const remaining = count - chips;
        if (drone) {
          debris.burst({
            origin: originAt(0),
            dir,
            strength,
            spread: strength * 0.65 * t.droneDebrisSpreadMult,
            count: remaining,
            size: t.debrisSize * t.droneDebrisSizeMult,
            bounds: { halfX: 0.3, halfY: 0.3, halfZ: 0.3 },
            tint,
          });
          return;
        }
        const headCount = Math.max(1, Math.floor(remaining / 5));
        debris.burst({
          origin: originAt(1),
          dir,
          strength,
          count: remaining - headCount,
          size: t.debrisSize,
          bounds: { halfX: 0.3, halfY: 0.65, halfZ: 0.2 },
          tint,
        });
        debris.burst({
          origin: originAt(1.65),
          dir,
          strength,
          count: headCount,
          size: t.debrisSize,
          bounds: { halfX: 0.18, halfY: 0.18, halfZ: 0.18 },
          tint,
        });
      };
      if (pose) this.pending.push({ id, elapsed: 0, duration, finish });
      else finish();
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
      const kind = this.kinds.get(id);
      const drone = kind === 'drone' || kind === 'hacker';
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
            event.point,
          );
        else if (event.amount > 0 && !event.tags.includes('#status'))
          hit(event.target, event.point, event.dir, event.tags);
      }),
      bus.on('enemy_killed', ({ id, dir, tags }) =>
        burst(id, 0, 0, dir ?? null, tags),
      ),
      bus.on('entity_spawned', ({ id, kind }) => {
        this.shattered.delete(id);
        this.kinds.set(id, kind);
      }),
      bus.on('entity_despawned', ({ id }) => {
        this.pending = this.pending.filter((item) => item.id !== id);
        this.shattered.delete(id);
        this.kinds.delete(id);
      }),
    ];
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (let i = 0; i < this.pending.length;) {
      const item = this.pending[i]!;
      item.elapsed = this.opts.collapse?.ageOf?.(item.id) ?? item.elapsed + dt;
      if (item.elapsed < item.duration) {
        i++;
        continue;
      }
      this.pending.splice(i, 1);
      item.finish();
    }
  }

  dispose(): void {
    this.pending.length = 0;
    for (const off of this.off) off();
    this.shattered.clear();
    this.kinds.clear();
  }
}
