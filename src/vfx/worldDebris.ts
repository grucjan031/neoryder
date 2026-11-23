import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { DEBRIS_TINT } from './debris';
import type { DebrisSystem } from './debris';

/**
 * Odłamki otoczenia: blacha z wybuchu beczki i okruchy betonu z trafień pocisków w świat.
 * Czysto kosmetyczne (pula `DebrisSystem`, zero ciał Rapiera, własny RNG puli).
 */
export class WorldDebris {
  private readonly off: (() => void)[];

  constructor(
    bus: EventBus,
    debris: DebrisSystem,
    opts: { tuning: Pick<Tuning, 'vfx' | 'props'> },
  ) {
    const t = opts.tuning.vfx;
    const props = opts.tuning.props;
    this.off = [
      bus.on('explosion', ({ point, tags }) => {
        if (!tags.includes('#hazard') || !tags.includes('#explosion')) return;
        debris.burst({
          origin: { ...point },
          dir: null,
          strength: t.barrelDebrisStrength,
          count: t.barrelDebrisCount,
          size: t.barrelDebrisSize,
          tint: DEBRIS_TINT.metal,
        });
      }),
      bus.on('prop_destroyed', ({ kind, point, size, dir }) => {
        debris.burst({
          origin: { ...point },
          dir,
          strength: props.debrisStrength,
          count:
            kind === 'crate'
              ? props.crateDebrisCount
              : props.smallCrateDebrisCount,
          size: props.debrisSize,
          bounds: {
            halfX: size.x * 0.4,
            halfY: size.y * 0.4,
            halfZ: size.z * 0.4,
          },
          tint: DEBRIS_TINT.plastic,
        });
      }),
      bus.on('world_hit', ({ point, normal }) => {
        const dir: Vec3 = { x: normal.x, y: normal.y, z: normal.z };
        debris.burst({
          origin: {
            x: point.x + normal.x * 0.02,
            y: point.y + normal.y * 0.02,
            z: point.z + normal.z * 0.02,
          },
          dir,
          strength: t.worldChipStrength,
          count: t.worldChipCount,
          size: t.worldChipSize,
          lifetimeS: t.worldChipLifetimeS,
          tint: DEBRIS_TINT.concrete,
        });
      }),
    ];
  }

  dispose(): void {
    for (const off of this.off) off();
    this.off.length = 0;
  }
}
