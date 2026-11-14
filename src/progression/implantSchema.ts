import { z } from 'zod';
import { RARITIES, type Rarity } from '../core/runTypes';
import { STAT_IDS } from '../core/stats';
import { effectSchema, whenSchema } from './synergies';

const positive = z.number().finite().positive();

/** Zwraca kolejną rzadkość w łańcuchu ulepszeń (null dla legendary). */
export function nextRarity(rarity: Rarity): Rarity | null {
  const index = RARITIES.indexOf(rarity);
  return index >= 0 && index + 1 < RARITIES.length
    ? (RARITIES[index + 1] ?? null)
    : null;
}

export const implantModifierSchema = z.object({
  stat: z.enum(STAT_IDS),
  type: z.enum(['flat', 'percent', 'mult']),
  value: z.number().finite(),
});
export type ImplantModifier = z.infer<typeof implantModifierSchema>;

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
export type ImplantTrigger = z.infer<typeof implantTriggerSchema>;

let registeredRarities: ReadonlyMap<string, Rarity> | null = null;

/** Rejestruje rzadkości załadowanych implantów do walidacji pojedynczego upgradesTo. */
export function registerImplantRarities(
  rarities: ReadonlyMap<string, Rarity> | null,
): void {
  registeredRarities = rarities;
}

/** Definicja implantu z src/data/implants/*.json (ADR 0005 pkt 6). */
export const implantSchema = z
  .object({
    id: z.string().min(1),
    /** Nazwa w UI (pl). */
    name: z.string().min(1),
    /** Opis w UI (pl). */
    description: z.string().min(1).optional(),
    rarity: z.enum(RARITIES),
    tags: z.array(z.string().startsWith('#')),
    modifiers: z.array(implantModifierSchema),
    triggers: z.array(implantTriggerSchema).optional(),
    upgradesTo: z.string().min(1).optional(),
  })
  .superRefine((implant, ctx) => {
    if (implant.upgradesTo === undefined) return;
    if (implant.upgradesTo === implant.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['upgradesTo'],
        message: `Implant ${implant.id} nie może ulepszać się sam do siebie.`,
      });
      return;
    }
    const expected = nextRarity(implant.rarity);
    if (expected === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['upgradesTo'],
        message: `Implant o rzadkości ${implant.rarity} nie może mieć upgradesTo.`,
      });
      return;
    }
    const targetRarity = registeredRarities?.get(implant.upgradesTo);
    if (targetRarity !== undefined && targetRarity !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['upgradesTo'],
        message: `Niepoprawna rzadkość upgradesTo dla ${implant.id}: oczekiwano ${expected}, otrzymano ${targetRarity}.`,
      });
    }
  });
export type ImplantDefinition = z.infer<typeof implantSchema>;

export function loadImplant(data: unknown): ImplantDefinition {
  return implantSchema.parse(data);
}
export const loadImplantDefinition = loadImplant;
