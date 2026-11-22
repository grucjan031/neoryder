import { z } from 'zod';
import textData from '../data/ui/puzzle.pl.json';

export const puzzleText = z
  .object({
    plate: z.string(),
    laser: z.string(),
    grab: z.string(),
    push: z.string(),
    skip: z.string(),
    solved: z.string(),
    skipped: z.string(),
    debugStatus: z.string(),
    debugUnavailable: z.string(),
  })
  .strict()
  .parse(textData);
