import { z } from 'zod';
import { moduleLootSchema } from './moduleSchema';
import {
  MAX_APPLIED_RUN_IDS,
  MAX_LAST_RUNS,
  type MetaState,
} from '../core/metaTypes';

const count = z.number().int().min(0);
const ids = z.array(z.string().min(1));

export const loadoutChoiceSchema = z.object({
  blade: z.string().min(1),
  weapons: ids.min(1).max(3),
  powers: ids.min(1).max(2),
  skins: z.record(z.string(), z.string()).default({}),
  modules: z.record(z.string().min(1), ids).default({}),
});

export const runRewardsSchema = z.object({
  xp: count,
  data: count,
  cores: count,
});

export const metaRunRecordSchema = z.object({
  runId: z.string().min(1),
  outcome: z.enum(['victory', 'death']),
  elapsedS: z.number().finite().min(0),
  layerReached: count,
  threatLevel: count,
  rewards: runRewardsSchema,
  achievements: ids.optional(),
});

/** Strukturalna walidacja stanu meta do zapisu; zawartość (id odblokowań) sprawdza MetaManager i dane. */
export const metaStateSchema: z.ZodType<MetaState> = z
  .object({
    campaign: z.object({
      completed: ids,
      pendingDebrief: z.string().min(1).nullable(),
    }),
    xp: count,
    data: count,
    cores: count,
    talents: ids,
    unlocks: ids,
    pendingExtractions: z
      .array(
        z.object({
          runId: z.string().min(1),
          moduleIds: moduleLootSchema,
        }),
      )
      .default([]),
    loadout: loadoutChoiceSchema,
    threat: z.object({ max: count, selected: count }),
    stats: z.object({
      runs: count,
      victories: count,
      deaths: count,
      kills: count,
      bestVictoryS: z.number().finite().min(0).nullable(),
    }),
    lastRuns: z.array(metaRunRecordSchema).max(MAX_LAST_RUNS),
    appliedRunIds: ids.max(MAX_APPLIED_RUN_IDS),
    // Uszkodzone osiągnięcia nie unieważniają reszty zapisu meta.
    achievements: z
      .object({
        unlocked: ids,
        counters: z.record(z.string().min(1), count),
      })
      .catch({ unlocked: [], counters: {} }),
  })
  .refine((state) => state.threat.selected <= state.threat.max, {
    message: 'Wybrany Poziom zagrożenia przekracza maksymalny.',
    path: ['threat', 'selected'],
  });
