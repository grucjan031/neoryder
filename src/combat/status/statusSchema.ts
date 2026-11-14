import { z } from 'zod';

const positive = z.number().finite().positive();
const application = z.object({
  id: z.string().min(1),
  durationS: positive,
  stacks: z.number().int().positive().optional(),
});

/** Definicja statusu z src/data/statuses/*.json. Liczby balansu tylko tutaj. */
export const statusSchema = z.object({
  id: z.string().min(1),
  /** Nazwa w UI (pl). */
  name: z.string().min(1),
  /** Tagi obrażeń zadawanych przez status (system dopisuje '#status'). */
  tags: z.array(z.string().min(1)),
  maxStacks: z.number().int().positive(),
  /** Obrażenia okresowe: `damage` × stosy co `intervalS` (pierwszy tik po `intervalS`). */
  tick: z
    .object({ intervalS: positive, damage: z.number().finite().nonnegative() })
    .optional(),
  /** Modyfikator `percent` na `damageTaken` celu za każdy stos (0.25 = +25%). */
  damageTakenPerStack: z.number().finite().optional(),
  /** Po osiągnięciu `maxStacks`: zużycie stosów, statusy na tym samym celu, wyładowanie obok. */
  onMaxStacks: z
    .object({
      apply: z.array(application).default([]),
      discharge: z
        .object({
          radiusM: positive,
          damage: z.number().finite().nonnegative(),
          tags: z.array(z.string().min(1)),
        })
        .optional(),
    })
    .optional(),
});
export type StatusDefinition = z.infer<typeof statusSchema>;

/** Waliduje komplet definicji: unikalne id, istniejące cele `onMaxStacks.apply`, bez samonakładania. */
export function loadStatusDefinitions(
  raws: readonly unknown[],
): ReadonlyMap<string, StatusDefinition> {
  const defs = new Map<string, StatusDefinition>();
  for (const raw of raws) {
    const def = statusSchema.parse(raw);
    if (defs.has(def.id)) throw new Error(`Powtórzony status: ${def.id}`);
    defs.set(def.id, def);
  }
  for (const def of defs.values())
    for (const { id } of def.onMaxStacks?.apply ?? []) {
      if (!defs.has(id))
        throw new Error(`Status ${def.id}: nieznany status ${id}`);
      if (id === def.id)
        throw new Error(`Status ${def.id} nie może nakładać sam siebie`);
    }
  return defs;
}

const files = import.meta.glob<unknown>('../../data/statuses/*.json', {
  eager: true,
  import: 'default',
});
export const statusDefinitions = loadStatusDefinitions(Object.values(files));
