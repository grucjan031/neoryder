import { z } from 'zod';

const weaponFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  damage: z.number().finite().nonnegative(),
  fireRateHz: z.number().finite().positive(),
  automatic: z.boolean(),
  heatPerShot: z.number().finite().positive(),
  tags: z.array(z.string().startsWith('#')),
  statuses: z
    .array(
      z.object({
        id: z.string().min(1),
        durationS: z.number().finite().positive(),
        stacks: z.number().int().positive().optional(),
      }),
    )
    .optional(),
};

const projectileFields = {
  ...weaponFields,
  projectileSpeed: z.number().finite().positive(),
  projectileLifetimeS: z.number().finite().positive(),
  spreadDeg: z.number().finite().min(0).max(180),
};

export const weaponSchema = z.discriminatedUnion('fireMode', [
  z.object({ ...projectileFields, fireMode: z.literal('projectile') }),
  z.object({
    ...projectileFields,
    fireMode: z.literal('spread'),
    pellets: z.number().int().min(2),
  }),
  z.object({
    ...projectileFields,
    fireMode: z.literal('pierce'),
    pierceCount: z.number().int().min(1),
    pierceFalloff: z.number().finite().min(0).max(1),
  }),
]);
export type WeaponDefinition = z.infer<typeof weaponSchema>;

export function loadWeapon(data: unknown): WeaponDefinition {
  const result = weaponSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane broni: ${result.error.message}`);
  return result.data;
}

export function loadWeaponDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, WeaponDefinition> {
  const definitions = new Map<string, WeaponDefinition>();
  for (const raw of data) {
    const definition = loadWeapon(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id broni: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../../data/weapons/*.json', {
  eager: true,
  import: 'default',
});
export const weaponDefinitions = loadWeaponDefinitions(
  Object.entries(modules)
    .filter(([path]) => !path.endsWith('/plasmaBlade.json'))
    .map(([, data]) => data),
);
export const blasterDefinition = weaponDefinitions.get('blaster')!;
