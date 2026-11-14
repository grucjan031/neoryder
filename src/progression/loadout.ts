import { z } from 'zod';
import { bladeDefinitions } from '../combat/melee/bladeSchema';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import { powerDefinitions } from '../combat/powers/registry';

const uniqueIds = (ids: string[]): boolean => new Set(ids).size === ids.length;

export const loadoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  blade: z.string().refine((id) => bladeDefinitions.has(id), 'Nieznane ostrze'),
  weapons: z
    .array(
      z.string().refine((id) => weaponDefinitions.has(id), 'Nieznana broń'),
    )
    .min(1)
    .max(3)
    .refine(uniqueIds, 'Powtórzone id broni'),
  powers: z
    .array(z.string().refine((id) => powerDefinitions.has(id), 'Nieznana moc'))
    .min(1)
    .max(2)
    .refine(uniqueIds, 'Powtórzone id mocy'),
  tags: z.array(z.string().startsWith('#')),
});

export type Loadout = z.infer<typeof loadoutSchema>;

export function loadLoadout(data: unknown): Loadout {
  return loadoutSchema.parse(data);
}

export function loadLoadoutDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, Loadout> {
  const definitions = new Map<string, Loadout>();
  for (const raw of data) {
    const definition = loadLoadout(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id ekwipunku: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../data/loadouts/*.json', {
  eager: true,
  import: 'default',
});
export const loadoutDefinitions = loadLoadoutDefinitions(
  Object.values(modules),
);
