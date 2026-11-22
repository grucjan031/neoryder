import { z } from 'zod';
import type { Rng } from '../core/rng';
import type { StatModifier } from '../core/stats';
import data from '../data/modes/endless.json';
import { enemyRegistry } from '../enemies/registry';
import { implantDefinitions } from '../progression/implants';
import { rollArenaMutator } from './arenaMutators';
import type { WavesDefinition } from './waves';

const count = z.int().positive();
const enemyId = z.string().refine((id) => enemyRegistry.has(id));
const endlessSchema = z
  .strictObject({
    baseCount: count,
    addEnemyEveryWaves: count,
    maxCount: count,
    roster: z.array(z.strictObject({ fromWave: count, enemy: enemyId })).min(1),
    eliteEveryWaves: count,
    eliteEnemy: enemyId,
    mutatorEveryWaves: count,
    implantEveryWaves: count,
    implantChoices: count,
    healthGrowth: z.number().positive(),
    damageGrowth: z.number().positive(),
    wavesPerRewardRoom: count,
    maxRewardRooms: count,
  })
  .refine(
    ({ baseCount, maxCount, roster, eliteEnemy }) =>
      baseCount <= maxCount &&
      roster[0]?.fromWave === 1 &&
      roster.every(
        ({ fromWave, enemy }, index) =>
          enemy !== eliteEnemy &&
          (index === 0 || fromWave >= roster[index - 1]!.fromWave),
      ) &&
      new Set(roster.map(({ enemy }) => enemy)).size === roster.length,
  );

export const endless = endlessSchema.parse(data);

export function planEndlessWave(
  wave: number,
  rng: Rng,
  spawnIntervalS: number,
  countScale = 1,
): WavesDefinition['waves'][number] {
  const pool = endless.roster.filter(({ fromWave }) => fromWave <= wave);
  const count = Math.min(
    endless.maxCount,
    Math.max(
      1,
      Math.round(
        (endless.baseCount +
          Math.floor((wave - 1) / endless.addEnemyEveryWaves)) *
          countScale,
      ),
    ),
  );
  const groups = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const { enemy } = rng.pick(pool);
    groups.set(enemy, (groups.get(enemy) ?? 0) + 1);
  }
  if (wave % endless.eliteEveryWaves === 0) groups.set(endless.eliteEnemy, 1);
  return {
    spawnIntervalS,
    groups: [...groups].map(([enemy, count]) => ({ enemy, count })),
  };
}

export function endlessSpawnModifiers(wave: number): StatModifier[] {
  const growth = Math.log1p(wave - 1);
  return [
    {
      stat: 'maxHealth',
      type: 'mult',
      value: 1 + growth * endless.healthGrowth,
      source: 'endless',
    },
    {
      stat: 'damage',
      type: 'mult',
      value: 1 + growth * endless.damageGrowth,
      source: 'endless',
    },
  ];
}

export function endlessMutator(wave: number, rng: Rng) {
  const rotation = Math.floor(wave / endless.mutatorEveryWaves);
  return rotation === 0
    ? null
    : rollArenaMutator(rng.fork(`endless:mutator:${rotation}`));
}

export function endlessImplantOffers(
  wave: number,
  owned: readonly string[],
  rng: Rng,
) {
  if (wave % endless.implantEveryWaves !== 0) return [];
  const available = [...implantDefinitions.values()].filter(
    ({ id }) => !owned.includes(id),
  );
  available.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return rng
    .fork(`endless:implants:${wave}`)
    .shuffle(available)
    .slice(0, endless.implantChoices);
}

export function endlessRewardRooms(wave: number): number {
  return Math.min(
    endless.maxRewardRooms,
    Math.floor(wave / endless.wavesPerRewardRoom),
  );
}
