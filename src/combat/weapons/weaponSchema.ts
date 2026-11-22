import { z } from 'zod';

const vec3 = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const poseName = z.string().min(1);

/**
 * Chwyt dłoni dopasowany do modelu broni (tylko widok FPP). `offset` i `rotation`
 * (rad, Euler XYZ) to położenie gniazda dłoni w układzie modelu broni (m, osie glTF):
 * prawa dłoń — `socket_gun` względem korzenia modelu; dłoń podpierająca —
 * `socket_support` względem macierzy węzła `support` (po stałych dwuręcznych).
 * Nazwy póz pochodzą z `src/data/hands/handPoses.json`.
 */
export const weaponGripSchema = z.strictObject({
  offset: vec3,
  rotation: vec3.optional(),
  pose: poseName,
  firePose: poseName,
  support: z
    .strictObject({ offset: vec3, rotation: vec3.optional(), pose: poseName })
    .optional(),
});
export type WeaponGrip = z.infer<typeof weaponGripSchema>;

const weaponFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string().startsWith('#')),
  /** Nazwa modelu FPP: `public/assets/models/<model>.glb`. */
  model: z.string().min(1).optional(),
  /** FOV w celowaniu jako ułamek bazowego (domyślnie `tuning.player.aim.fovScale`). */
  aimFovScale: z.number().finite().min(0.2).max(1).optional(),
  /** Chwyt prawej i podpierającej dłoni dla modelu FPP; brak = chwyt domyślny. */
  grip: weaponGripSchema.optional(),
  aimInScale: z.number().finite().positive().optional(),
  aimSpreadScale: z.number().finite().positive().optional(),
  aimSensitivityScale: z.number().finite().positive().optional(),
  activeCooling: z
    .strictObject({
      windowStartS: z.number().finite().nonnegative().optional(),
      windowDurationS: z.number().finite().positive().optional(),
      bonusS: z.number().finite().positive().optional(),
      penaltyS: z.number().finite().positive().optional(),
    })
    .optional(),
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
  ricochets: z.number().int().nonnegative().optional(),
  pierceCount: z.number().int().min(1).default(1),
  pierceFalloff: z.number().finite().min(0).max(1).default(0),
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
  Object.entries(modules).map(([, data]) => data),
);
const loadedBlaster = weaponDefinitions.get('blaster')!;
if (loadedBlaster.fireMode !== 'projectile')
  throw new Error('Nieprawidłowy tryb blastera');
export const blasterDefinition = loadedBlaster;

export function weaponModelOf(id: string): string | undefined {
  return weaponDefinitions.get(id)?.model;
}

/** Chwyt dla nazwy modelu FPP (pierwsza broń z tym modelem i polem `grip`). */
export function weaponGripOfModel(model: string): WeaponGrip | undefined {
  for (const definition of weaponDefinitions.values())
    if (definition.model === model && definition.grip) return definition.grip;
  return undefined;
}
