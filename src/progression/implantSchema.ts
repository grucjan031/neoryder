import { z } from 'zod';
import { RARITIES } from '../core/runTypes';
import { STAT_IDS } from '../core/stats';
import { effectSchema, whenSchema } from './synergies';

const positive = z.number().finite().positive();

export const implantModifierSchema = z.object({
  stat: z.enum(STAT_IDS),
  type: z.enum(['flat', 'percent', 'mult']),
  value: z.number().finite(),
});

export const implantTriggerSchema = z
  .object({
    when: whenSchema,
    effects: z.array(effectSchema).min(1),
    cooldownS: positive.optional(),
  })
  .superRefine((trigger, ctx) => {
    const { event, tagsAny, targetStatus } = trigger.when;
    const hasTarget = event === 'enemy_killed' || event === 'damage_dealt';
    if (!hasTarget && (tagsAny || targetStatus))
      ctx.addIssue({
        code: 'custom',
        message: `tagsAny i targetStatus tylko dla enemy_killed i damage_dealt (event: ${event})`,
      });
    if (
      event !== 'damage_dealt' &&
      trigger.effects.some((e) => e.kind === 'chain_on_hit')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'chain_on_hit tylko przy damage_dealt',
      });
  });

/** Definicja implantu z src/data/implants/*.json (ADR 0005 pkt 6). */
export const implantSchema = z.object({
  id: z.string().min(1),
  /** Nazwa w UI (pl). */
  name: z.string().min(1),
  rarity: z.enum(RARITIES),
  tags: z.array(z.string().startsWith('#')),
  modifiers: z.array(implantModifierSchema),
  triggers: z.array(implantTriggerSchema).optional(),
  upgradesTo: z.string().min(1).optional(),
});
export type ImplantDefinition = z.infer<typeof implantSchema>;

export function loadImplant(data: unknown): ImplantDefinition {
  return implantSchema.parse(data);
}
export const loadImplantDefinition = loadImplant;
