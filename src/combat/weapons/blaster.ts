import type { GameContext } from '../../core/context';
import type { EntityId, Team } from '../../core/events';
import type { Stats } from '../../core/stats';
import type { ProjectileSystem } from './projectiles';
import { Weapon } from './weapon';
import { blasterDefinition } from './weaponSchema';
import type { WeaponDefinition } from './weaponSchema';
export type { WeaponInput as BlasterInput } from './weapon';

export class Blaster extends Weapon {
  constructor(
    owner: EntityId,
    ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
    stats: Stats,
    projectiles: Pick<ProjectileSystem, 'spawn'>,
    definition: WeaponDefinition = blasterDefinition,
    team: Team = 'player',
  ) {
    super(owner, ctx, stats, { projectiles }, definition, team);
  }
}
