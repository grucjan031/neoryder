import { z } from 'zod';
import blasterData from '../../data/weapons/blaster.json';

export const weaponSchema = z.object({
  id: z.string().min(1),
  damage: z.number().finite().nonnegative(),
  fireRateHz: z.number().finite().positive(),
  heatPerShot: z.number().finite().positive(),
  projectileSpeed: z.number().finite().positive(),
  projectileLifetimeS: z.number().finite().positive(),
  spreadDeg: z.number().finite().min(0).max(180),
  tags: z.array(z.string().startsWith('#')),
});
export type WeaponDefinition = z.infer<typeof weaponSchema>;

export function loadWeapon(data: unknown): WeaponDefinition {
  const result = weaponSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane broni: ${result.error.message}`);
  return result.data;
}

export const blasterDefinition = loadWeapon(blasterData);
