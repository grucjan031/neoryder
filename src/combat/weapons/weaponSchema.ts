import { z } from 'zod';

const weaponFields = {
  id: z.string().min(1),
  name: z.string().min(1),
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
  damage: z.number().finite().nonnegative(),
  fireRateHz: z.number().finite().positive(),
  automatic: z.boolean(),
  heatPerShot: z.number().finite().positive(),
  projectileSpeed: z.number().finite().positive(),
  projectileLifetimeS: z.number().finite().positive(),
  spreadDeg: z.number().finite().min(0).max(180),
};

export const weaponSchema = z.discriminatedUnion('fireMode', [
  z.object({ ...projectileFields, fireMode: z.literal('projectile') }),
  z
    .object({
      ...weaponFields,
      fireMode: z.literal('beam'),
      automatic: z.literal(true),
      dps: z.number().finite().positive(),
      heatPerS: z.number().finite().positive(),
      rangeM: z.number().finite().positive(),
      tickHz: z.number().finite().positive(),
    })
    .strict(),
  z.object({
    ...projectileFields,
    fireMode: z.literal('lob'),
    gravity: z.number().finite().positive(),
    radiusM: z.number().finite().positive(),
    explosionDamage: z.number().finite().positive(),
  }),
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
const loadedBlaster = weaponDefinitions.get('blaster')!;
if (loadedBlaster.fireMode !== 'projectile')
  throw new Error('Nieprawidłowy tryb blastera');
export const blasterDefinition = loadedBlaster;
