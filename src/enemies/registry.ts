import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import { Drone } from './drone';
import { Turret } from './turret';
import { Medic } from './medic';
import { Hacker } from './hacker';
import { Gunner } from './gunner';
import { Assaulter } from './assaulter';
import { Boss } from './boss';
import { enemySchema } from './enemySchema';
import type { EnemyDefinition } from './enemySchema';
import type { Enemy, EnemyDependencies } from './types';

/** Czasy i rozrzut są kopią danych; HP/obrażenia przechodzą przez Stats managera. */
function definitionFor(
  id: string,
  deps: EnemyDependencies,
): EnemyDefinition | undefined {
  const base = enemyDefinitions.get(id);
  const profile = deps.difficulty;
  if (!base || !profile) return base;
  const definition = structuredClone(base);
  definition.telegraphS *= profile.telegraph;
  definition.cooldownS *= profile.burstBreak;
  if (definition.aimTelegraphS !== undefined)
    definition.aimTelegraphS *= profile.telegraph;
  if (definition.aimLockS !== undefined)
    definition.aimLockS *= profile.telegraph;
  if (definition.spreadDeg !== undefined)
    definition.spreadDeg = Math.min(
      90,
      (definition.spreadDeg * profile.spread) / profile.accuracy,
    );
  if (definition.hack) {
    definition.hack.hackTelegraphS *= profile.telegraph;
    definition.hack.hackCooldownS *= profile.burstBreak;
  }
  for (const phase of definition.boss?.phases ?? [])
    for (const pattern of phase.patterns) {
      pattern.telegraphS *= profile.telegraph;
      pattern.cooldownS *= profile.burstBreak;
    }
  return definition;
}

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
    'boss',
    (ctx, deps, id, position) => {
      const definition = definitionFor(id, deps);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Boss(ctx, deps, definition, position);
    },
  ],
  [
    'gunner',
    (ctx, deps, id, position) => {
      const definition = definitionFor(id, deps);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Gunner(ctx, deps, definition, position);
    },
  ],
  [
    // F2-13: Snajper to Strzelec z innymi danymi (długi telegraf, blokada celu, laser).
    'sniper',
    (ctx, deps, id, position) => {
      const definition = definitionFor(id, deps);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Gunner(ctx, deps, definition, position);
    },
  ],
  [
    'drone',
    (ctx, deps, id, position) => {
      const definition = definitionFor(id, deps);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Drone(ctx, deps, definition, position);
    },
  ],
  [
    'assaulter',
    (ctx, deps, id, position) => {
      const definition = definitionFor(id, deps);
      if (!definition) throw new Error(`Nieznany wróg: ${id}`);
      return new Assaulter(ctx, deps, definition, position);
    },
  ],
]);
for (const [kind, EnemyClass] of [
  ['medic', Medic],
  ['turret', Turret],
  ['hacker', Hacker],
] as const)
  factories.set(kind, (ctx, deps, id, position) => {
    const definition = definitionFor(id, deps);
    if (!definition) throw new Error(`Nieznany wróg: ${id}`);
    return new EnemyClass(ctx, deps, definition, position);
  });
for (const kind of ['shielder', 'executor'])
  factories.set(kind, (ctx, deps, id, position) => {
    const definition = definitionFor(id, deps);
    if (!definition) throw new Error(`Nieznany wróg: ${id}`);
    return new Assaulter(ctx, deps, definition, position);
  });
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
  const enemy = factory(ctx, deps, id, position);
  if (enemy.definition.damageTakenScale)
    deps.damage.setDamageTakenScale(
      enemy.id,
      enemy.definition.damageTakenScale,
    );
  return enemy;
}
