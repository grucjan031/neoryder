import { z } from 'zod';
import { moduleLootSchema } from '../progression/moduleSchema';
import { difficultyIdSchema, type DifficultyId } from './difficulty';
import { modeIdSchema } from './modeSchema';
import {
  NODE_TYPES,
  type MapNode,
  type RunDamageStats,
  type RunState,
  type SectorMap,
} from '../core/runTypes';
import { runAchievementProgressSchema } from '../progression/achievementsSchema';
import { savedLoadoutSchema } from '../progression/loadout';
import { squadStateSchema } from '../allies/roster';
import type { SquadMemberState } from '../allies/roster';

// Schematy stanu runu bez RunManagera: zapis (`core/save`) i menu nie wciągają przez nie trybów, pokoi ani wrogów.
export const mapNodeSchema: z.ZodType<MapNode> = z.object({
  id: z.string().min(1),
  layer: z.number().int().min(1),
  index: z.number().int().nonnegative(),
  type: z.enum(NODE_TYPES),
  next: z.array(z.string().min(1)),
  fixed: z
    .object({
      roomId: z.string().min(1),
      objectives: z.array(z.string()),
      final: z.boolean().optional(),
    })
    .optional(),
});

export const sectorMapSchema: z.ZodType<SectorMap> = z.object({
  sectorId: z.string().min(1).default('kurogane'),
  layers: z.array(z.array(mapNodeSchema).min(1)).min(1),
});

export const runDamageStatsSchema: z.ZodType<RunDamageStats> = z.object({
  melee: z.number().finite().nonnegative(),
  power: z.number().finite().nonnegative(),
  gun: z.number().finite().nonnegative(),
  other: z.number().finite().nonnegative(),
});

export type CheckpointRunState = RunState & {
  difficulty?: DifficultyId;
  roomCredits?: Record<string, number>;
  /** Drużyna gracza (docs/systems/allies.md): zdrowie członków między pokojami; brak = bez drużyny. */
  squad?: SquadMemberState[];
};

export const runStateSchema: z.ZodType<CheckpointRunState> = z
  .object({
    difficulty: difficultyIdSchema.optional(),
    modeId: modeIdSchema.optional(),
    missionId: z.string().min(1).optional(),
    objectives: z
      .record(z.string(), z.enum(['pending', 'active', 'done']))
      .optional(),
    objectiveProgress: z
      .record(z.string(), z.number().finite().min(0).max(1))
      .optional(),
    seed: z.string(),
    sectorId: z.string().min(1).default('kurogane'),
    loadoutId: z.string().min(1),
    loadout: savedLoadoutSchema,
    talents: z
      .array(z.string().min(1))
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Powtórzone id talentu w stanie runu.',
      ),
    threatLevel: z.number().int().nonnegative(),
    startedAtMs: z.number().finite().nonnegative(),
    elapsedS: z.number().finite().nonnegative(),
    map: sectorMapSchema,
    currentNodeId: z.string().min(1).nullable(),
    visited: z.array(z.string().min(1)),
    hp: z.number().finite().nonnegative(),
    energy: z.number().finite().nonnegative(),
    credits: z.number().finite().nonnegative(),
    foundModules: moduleLootSchema.optional(),
    roomCredits: z
      .record(z.string(), z.number().int().nonnegative())
      .optional(),
    squad: squadStateSchema.optional(),
    implants: z
      .array(z.string().min(1))
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Powtórzone id implantu w stanie runu.',
      ),
    stats: z.object({
      kills: z.number().int().nonnegative(),
      damage: runDamageStatsSchema,
    }),
    achievementProgress: runAchievementProgressSchema.optional(),
  })
  .superRefine((state, ctx) => {
    const validIds = new Set<string>();
    for (const layer of state.map.layers)
      for (const node of layer) validIds.add(node.id);

    if (state.currentNodeId !== null && !validIds.has(state.currentNodeId))
      ctx.addIssue({
        code: 'custom',
        path: ['currentNodeId'],
        message: `Nieznany węzeł currentNodeId: ${state.currentNodeId}`,
      });

    for (const id of state.visited) {
      if (!validIds.has(id))
        ctx.addIssue({
          code: 'custom',
          path: ['visited'],
          message: `Nieznany węzeł w visited: ${id}`,
        });
    }
  });
