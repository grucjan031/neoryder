import type { Rng } from '../../../core/rng';
import type { ProjectileSpec, ProjectileSystem } from '../projectiles';
import type { WeaponDefinition } from '../weaponSchema';
import { spreadDirection } from './spread';

export function fireProjectile(
  definition: Exclude<WeaponDefinition, { fireMode: 'beam' }>,
  projectiles: Pick<ProjectileSystem, 'spawn'>,
  rng: Rng,
  aim: Pick<ProjectileSpec, 'owner' | 'team' | 'origin' | 'dir'>,
  /** Mnożnik rozrzutu (celowanie zawęża stożek). */
  spreadScale = 1,
): void {
  const count = definition.fireMode === 'spread' ? definition.pellets : 1;
  for (let i = 0; i < count; i++) {
    projectiles.spawn({
      ...aim,
      dir: spreadDirection(aim.dir, definition.spreadDeg * spreadScale, rng),
      speed: definition.projectileSpeed,
      damage: definition.damage,
      tags: definition.tags,
      lifetimeS: definition.projectileLifetimeS,
      ...(definition.ricochets !== undefined
        ? { ricochets: definition.ricochets }
        : {}),
      ...(definition.fireMode === 'lob'
        ? {
            gravity: definition.gravity,
            explode: {
              radiusM: definition.radiusM,
              damage: definition.explosionDamage,
              tags: definition.tags,
              ...(definition.statuses ? { statuses: definition.statuses } : {}),
            },
          }
        : {}),
      ...(definition.fireMode !== 'lob' && definition.statuses
        ? { statuses: definition.statuses }
        : {}),
      ...(definition.fireMode === 'pierce' || definition.pierceCount > 1
        ? {
            pierce: {
              count: definition.pierceCount,
              falloff: definition.pierceFalloff,
            },
          }
        : {}),
    });
  }
}
