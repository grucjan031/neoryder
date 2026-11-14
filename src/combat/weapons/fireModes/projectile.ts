import type { Rng } from '../../../core/rng';
import type { ProjectileSpec, ProjectileSystem } from '../projectiles';
import type { WeaponDefinition } from '../weaponSchema';
import { spreadDirection } from './spread';

export function fireProjectile(
  definition: WeaponDefinition,
  projectiles: Pick<ProjectileSystem, 'spawn'>,
  rng: Rng,
  aim: Pick<ProjectileSpec, 'owner' | 'team' | 'origin' | 'dir'>,
): void {
  const count = definition.fireMode === 'spread' ? definition.pellets : 1;
  for (let i = 0; i < count; i++) {
    projectiles.spawn({
      ...aim,
      dir: spreadDirection(aim.dir, definition.spreadDeg, rng),
      speed: definition.projectileSpeed,
      damage: definition.damage,
      tags: definition.tags,
      lifetimeS: definition.projectileLifetimeS,
      ...(definition.statuses ? { statuses: definition.statuses } : {}),
      ...(definition.fireMode === 'pierce'
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
