import { z } from 'zod';
import type { EventType } from '../../core/events';
import { vec3Schema } from '../../world/roomSchema';
import text from '../ui/tutorial.pl.json';

// Jawna lista zdarzeń obsługiwanych przez warunki; sprawdzana także przez TypeScript.
export const tutorialEvents = [
  'parry_success',
  'execute_performed',
  'wave_cleared',
  'damage_dealt',
  'player_jumped',
  'dash_used',
  'slide_started',
  'held_item_changed',
  'power_used',
  'weapon_fired',
  'melee_swing',
  'scene_loaded',
] as const satisfies readonly EventType[];

export const tutorialEventSchema = z.object({
  kind: z.literal('event'),
  event: z.enum(tutorialEvents),
  count: z.number().int().positive(),
  tags: z.array(z.string().startsWith('#')).optional(),
  double: z.boolean().optional(),
  held: z.enum(['blade', 'gun']).optional(),
  combo: z.boolean().optional(),
});
export const tutorialConditionSchema = z.discriminatedUnion('kind', [
  tutorialEventSchema,
  z.object({ kind: z.literal('heat_overheated') }),
  z.object({
    kind: z.literal('reach_marker'),
    position: vec3Schema,
    radius: z.number().positive(),
    sliding: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('land_on'),
    position: vec3Schema,
    radius: z.number().positive(),
  }),
]);
export const tutorialStepSchema = z.object({
  id: z.string().trim().min(1),
  text: z
    .string()
    .trim()
    .min(1)
    .refine((key) => Object.hasOwn(text.steps, key), 'Nieznany tekst'),
  condition: tutorialConditionSchema,
  requires: z.array(tutorialConditionSchema).default([]),
  marker: vec3Schema.optional(),
  start: z
    .object({
      x: z.number().finite().min(-1e4).max(1e4),
      z: z.number().finite().min(-1e4).max(1e4),
      yawDeg: z.number().finite().min(-1e6).max(1e6),
    })
    .optional(),
  held: z.enum(['blade', 'gun']).optional(),
  invulnerable: z.boolean().default(true),
  restartOnDeath: z.boolean().default(false),
  complete: z.boolean().default(false),
  wave: z.boolean().default(false),
  spawn: z
    .object({
      enemy: z.string().min(1),
      position: vec3Schema,
      passive: z.boolean().default(false),
      healthMultiplier: z.number().finite().positive().default(1),
      healthFraction: z.number().positive().max(1).default(1),
      turret: z
        .object({
          intervalS: z.number().positive(),
          speed: z.number().positive(),
          damage: z.number().nonnegative(),
          lifetimeS: z.number().positive(),
          height: z.number().finite(),
          offsetZ: z.number().finite(),
        })
        .optional(),
    })
    .optional(),
});
export const tutorialStepsSchema = z
  .array(tutorialStepSchema)
  .min(1)
  .refine(
    (steps) => new Set(steps.map((step) => step.id)).size === steps.length,
    'Powtórzone id kroku',
  );
export type TutorialStep = z.infer<typeof tutorialStepSchema>;
export type TutorialCondition = z.infer<typeof tutorialConditionSchema>;

export const tutorialDoneKey = 'neoryder.tutorialDone';
let doneInSession = false;
export function tutorialDone(): boolean {
  try {
    return doneInSession || localStorage.getItem(tutorialDoneKey) !== null;
  } catch {
    return doneInSession;
  }
}
export function markTutorialDone(): void {
  doneInSession = true;
  try {
    localStorage.setItem(tutorialDoneKey, '1');
  } catch {
    /* Pamięć sesji pozwala kontynuować przy zablokowanym Storage. */
  }
}
