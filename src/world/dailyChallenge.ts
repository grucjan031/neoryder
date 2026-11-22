import { z } from 'zod';
import data from '../data/modes/dailyChallenge.json';
import { loadoutDefinitions } from '../progression/loadout';
import { difficultyIdSchema } from './difficulty';

export const dailyChallenge = z
  .object({
    loadoutId: z.string().refine((id) => loadoutDefinitions.has(id)),
    difficulty: difficultyIdSchema,
  })
  .parse(data);
