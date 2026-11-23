import { z } from 'zod';
import data from '../data/ui/challenge.pl.json';

export const challengeText = z
  .object({
    title: z.string(),
    kicker: z.string(),
    rules: z.string(),
    today: z.string(),
    start: z.string(),
    used: z.string(),
    history: z.string(),
    empty: z.string(),
    noResult: z.string(),
    victory: z.string(),
    death: z.string(),
    rooms: z.string(),
    kills: z.string(),
    time: z.string(),
    loading: z.string(),
    loadError: z.string(),
    startError: z.string(),
    saving: z.string(),
    saveError: z.string(),
    retry: z.string(),
    back: z.string(),
  })
  .parse(data);
