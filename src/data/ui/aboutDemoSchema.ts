import { z } from 'zod';
import data from './aboutDemo.json';

export const aboutDemoText = z
  .object({
    title: z.string().min(1),
    report: z.string().min(1),
    close: z.string().min(1),
    saveTitle: z.string().min(1),
    saveDescription: z.string().min(1),
    copied: z.string().min(1),
    copyFallback: z.string().min(1),
    copyPending: z.string().min(1),
    reportUrl: z.url().startsWith('https://'),
    reportLink: z.string().min(1),
    reportData: z.string().min(1),
    pauseKey: z.string().min(1),
    look: z.string().min(1),
    missing: z.string().min(1),
    seedUnavailable: z.string().min(1),
    labels: z.object({
      version: z.string().min(1),
      build: z.string().min(1),
      seed: z.string().min(1),
      scene: z.string().min(1),
      userAgent: z.string().min(1),
      resolution: z.string().min(1),
      date: z.string().min(1),
    }),
  })
  .parse(data);
