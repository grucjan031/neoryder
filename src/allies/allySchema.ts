import { z } from 'zod';

const id = z.string().min(1);
const positive = z.number().finite().positive();
const lines = z.array(z.string().min(1)).min(1);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const ALLY_ROLES = ['rifleman', 'support'] as const;
export const ALLY_BARKS = [
  'contact',
  'reload',
  'downed',
  'revived',
  'objective',
] as const;
export type AllyBark = (typeof ALLY_BARKS)[number];

/** Profil strzału jak u Strzelca: seria pocisków, przerwa, co kilka serii przeładowanie albo chłodzenie. */
export const allyWeaponSchema = z
  .object({
    /** Model z `public/assets/models` trzymany w dłoni (np. `rifle`, `scatter`). */
    model: id,
    damage: positive,
    projectileSpeed: positive,
    projectileLifetimeS: positive,
    burstCount: z.number().int().positive(),
    burstIntervalS: positive,
    cooldownS: positive,
    /** Pociski na strzał (rozpraszacz) i ich dodatkowy rozrzut. */
    pellets: z.number().int().positive().default(1),
    pelletSpreadDeg: z.number().finite().nonnegative().default(0),
    burstsPerReload: z.number().int().positive(),
    reloadS: positive,
    tags: z.array(z.string().startsWith('#')).min(1).default(['#gun']),
  })
  .strict();

export const allySchema = z
  .object({
    id,
    name: id,
    role: z.enum(ALLY_ROLES),
    hp: positive,
    moveSpeed: positive,
    weapon: allyWeaponSchema,
    /** 0–1: 1 = strzał w punkt, 0 = rozrzut `tuning.allies.maxSpreadDeg`. */
    accuracy: z.number().finite().min(0).max(1),
    followDistanceM: positive,
    engageRangeM: positive,
    reviveS: positive,
    /** Strój z części `npc_civilian.glb`; kolory bez czerwieni, cyanu i magenty (ADR 0006). */
    look: z
      .object({
        torso: z.enum(['none', 'vest', 'jacket', 'hoodie', 'coat']),
        parts: z.array(id).default([]),
        outerColor: color,
        pantsColor: color,
        accentColor: color,
      })
      .strict(),
    barks: z.object(
      Object.fromEntries(ALLY_BARKS.map((kind) => [kind, lines])) as Record<
        AllyBark,
        typeof lines
      >,
    ),
  })
  .strict();
export type AllyDefinition = z.infer<typeof allySchema>;
export type AllyWeapon = AllyDefinition['weapon'];

export function loadAlly(data: unknown): AllyDefinition {
  const result = allySchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowy sojusznik: ${result.error.message}`);
  return result.data;
}

export function loadAllyDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, AllyDefinition> {
  const definitions = new Map<string, AllyDefinition>();
  for (const raw of data) {
    const definition = loadAlly(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id sojusznika: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../data/allies/*.json', {
  eager: true,
  import: 'default',
});

export const allyDefinitions = loadAllyDefinitions(Object.values(modules));
