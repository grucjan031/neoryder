import { z } from 'zod';
import { bladeDefinitions } from '../combat/melee/bladeSchema';
import { powerDefinitions } from '../combat/powers/definitions';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import progressionData from '../data/meta/progression.json';
import type { MetaState } from '../core/metaTypes';
import { loadoutChoiceSchema } from './metaStateSchema';
import { unlockIdSchema } from './unlocksSchema';

const count = z.number().int().min(0);

export const starterSchema = z
  .object({
    xp: z.literal(0),
    data: count,
    cores: count,
    talents: z.array(z.string().min(1)),
    unlocks: z.array(unlockIdSchema),
    loadout: loadoutChoiceSchema,
    threat: z.object({ max: count, selected: count }),
  })
  .strict()
  .superRefine((starter, ctx) => {
    const unlocked = new Set(starter.unlocks);
    if (unlocked.size !== starter.unlocks.length)
      ctx.addIssue({
        code: 'custom',
        path: ['unlocks'],
        message: 'Powtórzone odblokowanie startowe.',
      });
    const { blade, weapons, powers } = starter.loadout;
    const check = (
      kind: string,
      id: string,
      known: ReadonlyMap<string, unknown>,
    ) => {
      if (!known.has(id) || !unlocked.has(`${kind}:${id}`))
        ctx.addIssue({
          code: 'custom',
          path: ['loadout'],
          message: `Ekwipunek startowy zawiera nieodblokowany lub nieznany przedmiot: ${kind}:${id}`,
        });
    };
    check('blade', blade, bladeDefinitions);
    for (const id of weapons) check('weapon', id, weaponDefinitions);
    for (const id of powers) check('power', id, powerDefinitions);
    if (starter.threat.selected > starter.threat.max)
      ctx.addIssue({
        code: 'custom',
        path: ['threat', 'selected'],
        message: 'Wybrany Poziom zagrożenia przekracza maksymalny.',
      });
  });

const positiveInt = z.number().int().min(1);

/** Liczby nagród za run (ADR 0007 pkt 2); strojone w danych. */
export const rewardRulesSchema = z
  .object({
    xpPerRoom: count,
    xpPerElite: count,
    xpVictory: count,
    dataPerRoom: count,
    dataPerKill: count,
    dataVictory: count,
    coresPerElite: count,
    coresVictory: count,
  })
  .strict();
export type RewardRules = z.infer<typeof rewardRulesSchema>;

export const progressionSchema = z
  .object({
    starter: starterSchema,
    levels: z
      .object({
        /** `xpToNext[n - 1]` = XP potrzebne do przejścia z poziomu n na n + 1; długość = limit poziomu - 1. */
        xpToNext: z
          .array(positiveInt)
          .min(1)
          .refine(
            (list) => list.every((v, i) => i === 0 || v >= (list[i - 1] ?? 0)),
            'Progi doświadczenia muszą być niemalejące.',
          ),
      })
      .strict(),
    rewards: rewardRulesSchema,
    moduleSlotsPerWeapon: positiveInt,
  })
  .strict();
export type ProgressionData = z.infer<typeof progressionSchema>;
export type StarterMeta = ProgressionData['starter'];

export function loadProgression(data: unknown): ProgressionData {
  return progressionSchema.parse(data);
}

export const progression: ProgressionData = loadProgression(progressionData);

/** Pełny stan meta nowego gracza: dane startowe i pusta historia (ADR 0007 pkt 1). */
export function createStarterMetaState(
  starter: StarterMeta = progression.starter,
): MetaState {
  return {
    xp: starter.xp,
    data: starter.data,
    cores: starter.cores,
    talents: [...starter.talents],
    unlocks: [...starter.unlocks],
    pendingExtractions: [],
    loadout: {
      blade: starter.loadout.blade,
      weapons: [...starter.loadout.weapons],
      powers: [...starter.loadout.powers],
      skins: { ...starter.loadout.skins },
      modules: structuredClone(starter.loadout.modules),
    },
    threat: { ...starter.threat },
    stats: { runs: 0, victories: 0, deaths: 0, kills: 0, bestVictoryS: null },
    lastRuns: [],
    appliedRunIds: [],
    campaign: { completed: [], pendingDebrief: null },
    achievements: { unlocked: [], counters: {} },
  };
}
