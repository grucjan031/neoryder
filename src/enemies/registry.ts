import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Assaulter } from './assaulter';
import { enemySchema } from './enemySchema';
import type { EnemyDefinition } from './enemySchema';
import type { Enemy, EnemyDependencies } from './types';

export type EnemyFactory = (
  ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
  deps: EnemyDependencies,
  id: string,
  position: Vec3,
) => Enemy;
export const enemyDefinitions = new Map<string, EnemyDefinition>();
export const enemyRegistry = new Map<string, EnemyFactory>();
const factories = new Map<string, EnemyFactory>([
  [
    'assaulter',
    (ctx, deps, id, position) => {
      const definition = enemyDefinitions.get(id);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Assaulter(ctx, deps, definition, position);
    },
  ],
]);
const files = import.meta.glob<unknown>('../data/enemies/*.json', {
  eager: true,
  import: 'default',
});
for (const raw of Object.values(files)) {
  const definition = enemySchema.parse(raw);
  const factory = factories.get(definition.kind);
  if (!factory) throw new Error(`Nieznany archetyp: ${definition.kind}`);
  if (enemyRegistry.has(definition.id))
    throw new Error(`Powtórzony wróg: ${definition.id}`);
  enemyDefinitions.set(definition.id, definition);
  enemyRegistry.set(definition.id, factory);
}
export function availableEnemyIds(): string[] {
  return [...enemyRegistry.keys()];
}
export function createEnemy(
  ctx: Pick<GameContext, 'bus' | 'rng' | 'tuning'>,
  deps: EnemyDependencies,
  id: string,
  position: Vec3,
): Enemy {
  const factory = enemyRegistry.get(id);
  if (!factory) throw new Error(`Nieznany wróg: ${id}`);
  return factory(ctx, deps, id, position);
}
