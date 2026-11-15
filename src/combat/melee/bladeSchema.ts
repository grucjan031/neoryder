import { z } from 'zod';

const strikeSchema = z.object({
  damage: z.number().finite().nonnegative(),
  /** Impuls odrzutu (N·s) przekazywany w DamageInfo.knockback. */
  knockback: z.number().finite().nonnegative(),
  /** Zasięg łuku cięcia od oczu gracza (m); dla obrotu `spin` promień kuli. */
  reach: z.number().finite().positive(),
  /** Szerokość łuku (m); dla obrotu `spin` nieużywana przez zapytanie (informacyjnie: średnica). */
  width: z.number().finite().positive(),
});

export const bladeSchema = z.object({
  id: z.string().min(1),
  /** Nazwa modelu FPP (`/assets/models/<model>.glb`); brak = `plasma_blade`. */
  model: z.string().min(1).optional(),
  combo: z.array(strikeSchema).min(1).max(5),
  heavy: strikeSchema,
  /** Kształt trafienia ciężkiego ataku: `arc` (łuk przed graczem) albo `spin` (obrót 360°). */
  heavyShape: z.enum(['arc', 'spin']).default('arc'),
  /** Mnożnik czasu faz ciosu (lekki i ciężki): < 1 szybciej, > 1 wolniej. */
  timeScale: z.number().finite().positive().default(1),
  /** Kąt odbijania pocisków w parowaniu (stopnie); brak = `tuning.melee.parryArcDeg`. */
  parryArcDeg: z.number().finite().positive().max(360).optional(),
  /** Widok FPP: druga instancja ostrza w lewej dłoni (bliźniacze). */
  offhand: z.boolean().default(false),
  /** Widok FPP: ostrze z obu stron rękojeści (dwustronne). */
  doubleEnded: z.boolean().default(false),
  /** Widok FPP: skala długości klingi modelu zastępczego (1 = plazmowe). */
  lengthScale: z.number().finite().positive().default(1),
  throw: z
    .object({
      damage: z.number().finite().nonnegative(),
      speed: z.number().finite().positive(),
      rangeM: z.number().finite().positive(),
      radiusM: z.number().finite().positive(),
      returnSpeed: z.number().finite().positive(),
    })
    .optional(),
  dashCut: z
    .object({
      damage: z.number().finite().nonnegative(),
      widthM: z.number().finite().positive(),
      knockback: z.number().finite().nonnegative(),
    })
    .optional(),
  /** Mnożnik otrzymywanych obrażeń w bloku (0.3 = −70%). */
  blockDamageMult: z.number().finite().min(0).max(1),
  /** Energia zużywana przez każdy zablokowany cios: stała + proporcjonalna do obrażeń. */
  blockEnergyPerHit: z.number().finite().nonnegative(),
  blockEnergyPerDamage: z.number().finite().nonnegative(),
  tags: z.array(z.string().startsWith('#')),
});
export type BladeDefinition = z.infer<typeof bladeSchema>;
export type StrikeDefinition = z.infer<typeof strikeSchema>;
export type HitShape = BladeDefinition['heavyShape'];

export function loadBlade(data: unknown): BladeDefinition {
  const result = bladeSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane ostrza: ${result.error.message}`);
  return result.data;
}

export function loadBladeDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, BladeDefinition> {
  const definitions = new Map<string, BladeDefinition>();
  for (const raw of data) {
    const definition = loadBlade(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id ostrza: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../../data/blades/*.json', {
  eager: true,
  import: 'default',
});
export const bladeDefinitions = loadBladeDefinitions(Object.values(modules));

function requireBlade(id: string): BladeDefinition {
  const definition = bladeDefinitions.get(id);
  if (!definition) throw new Error(`Brak danych ostrza: ${id}`);
  return definition;
}

export const DEFAULT_BLADE_ID = 'plasmaBlade';
export const plasmaBladeDefinition = requireBlade(DEFAULT_BLADE_ID);
export const twinBladesDefinition = requireBlade('twinBlades');
export const staffBladeDefinition = requireBlade('staffBlade');

/**
 * Wariant ostrza na run: nadpisanie (`?blade=`, ekran buildu) wygrywa z ostrzem ekwipunku;
 * nieznane id nadpisania jest ignorowane, nieznane id ekwipunku daje ostrze plazmowe.
 */
export function resolveBlade(
  loadoutBlade: string,
  override?: string | null,
): BladeDefinition {
  return (
    (override ? bladeDefinitions.get(override) : undefined) ??
    bladeDefinitions.get(loadoutBlade) ??
    plasmaBladeDefinition
  );
}

/** Jak `resolveBlade`, ale dla ostrza ekwipunku już rozwiązanego (np. z łatkami): ważne nadpisanie je zastępuje. */
export function withBladeOverride(
  base: BladeDefinition,
  override?: string | null,
): BladeDefinition {
  return (override ? bladeDefinitions.get(override) : undefined) ?? base;
}
