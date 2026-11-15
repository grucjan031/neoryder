import { z } from 'zod';
import { bladeDefinitions } from '../combat/melee/bladeSchema';
import { powerDefinitions } from '../combat/powers/registry';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import unlocksData from '../data/meta/unlocks.json';
import { moduleDefinitions } from './moduleSchema';

export const SLOT_IDS = ['weapon2', 'weapon3', 'power2'] as const;

/** Id odblokowania: `weapon:<id>` | `power:<id>` | `blade:<id>` | `slot:<weapon2|weapon3|power2>`; przedmiot musi istnieć w danych. */
export const unlockIdSchema = z.string().superRefine((id, ctx) => {
  const separator = id.indexOf(':');
  const kind = id.slice(0, separator);
  const name = id.slice(separator + 1);
  const known =
    separator > 0 &&
    ((kind === 'weapon' && weaponDefinitions.has(name)) ||
      (kind === 'power' && powerDefinitions.has(name)) ||
      (kind === 'blade' && bladeDefinitions.has(name)) ||
      (kind === 'module' && moduleDefinitions.has(name)) ||
      (kind === 'slot' && (SLOT_IDS as readonly string[]).includes(name)));
  if (!known)
    ctx.addIssue({ code: 'custom', message: `Nieznane odblokowanie: ${id}` });
});

const costAmount = z.number().int().min(0);

export const unlockSchema = z
  .object({
    id: unlockIdSchema,
    cost: z
      .object({ data: costAmount.optional(), cores: costAmount.optional() })
      .strict()
      .refine(
        (cost) => cost.data !== undefined || cost.cores !== undefined,
        'Koszt wymaga Danych lub Rdzeni.',
      ),
    minLevel: z.number().int().min(1).optional(),
  })
  .strict();
export type UnlockDefinition = z.infer<typeof unlockSchema>;

export const unlocksSchema = z
  .array(unlockSchema)
  .refine(
    (list) => new Set(list.map((u) => u.id)).size === list.length,
    'Powtórzone id odblokowania.',
  );

export function loadUnlocks(data: unknown): UnlockDefinition[] {
  return unlocksSchema.parse(data);
}

export function loadUnlockDefinitions(
  data: unknown,
): ReadonlyMap<string, UnlockDefinition> {
  return new Map(loadUnlocks(data).map((unlock) => [unlock.id, unlock]));
}

export const unlockDefinitions = loadUnlockDefinitions(unlocksData);
