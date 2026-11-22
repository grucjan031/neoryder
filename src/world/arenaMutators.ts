import { z } from 'zod';
import type { Rng } from '../core/rng';

const multiplier = z.number().positive();

export const arenaMutatorSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .refine((id) => id !== 'seed'),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  effect: z.discriminatedUnion('stat', [
    z.strictObject({
      stat: z.literal('gravityScale'),
      value: multiplier.lt(1),
    }),
    z.strictObject({ stat: z.literal('moveSpeed'), value: multiplier.gt(1) }),
    z.strictObject({
      stat: z.literal('ammoCapacity'),
      value: z.int().positive(),
    }),
    z.strictObject({
      stat: z.literal('arenaLightScale'),
      value: multiplier.lt(1),
    }),
  ]),
});

export type ArenaMutator = z.infer<typeof arenaMutatorSchema>;

const modules = import.meta.glob('../data/mutators/*.json', {
  eager: true,
  import: 'default',
});

const catalog = Object.values(modules).map((raw) =>
  arenaMutatorSchema.parse(raw),
);
catalog.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
export const arenaMutators: ReadonlyMap<string, ArenaMutator> = new Map(
  catalog.map((definition) => [definition.id, definition]),
);
if (catalog.length === 0 || arenaMutators.size !== catalog.length)
  throw new Error(
    'Katalog mutatorów areny jest pusty albo zawiera powtórzone id.',
  );

export function rollArenaMutator(rng: Rng): ArenaMutator {
  return rng.fork('arena-mutator').pick(catalog);
}
