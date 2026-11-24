import { z } from 'zod';
import { savedLoadoutSchema } from '../progression/loadout';

export const missionCheckpointSchema = z.object({
  attemptId: z.string().min(1),
  missionId: z.string().min(1),
  levelId: z.string().min(1),
  seed: z.string(),
  checkpointId: z.string().min(1),
  objectives: z.record(z.string(), z.enum(['pending', 'active', 'done'])),
  completedEncounters: z.array(z.string()),
  elapsedS: z.number().finite().nonnegative(),
  kills: z.number().int().nonnegative().optional(),
  completed: z.boolean(),
  loadout: savedLoadoutSchema,
  talents: z.array(z.string()),
  implants: z.array(z.string()),
  threatLevel: z.number().int().nonnegative(),
});
export type MissionCheckpoint = z.infer<typeof missionCheckpointSchema>;
