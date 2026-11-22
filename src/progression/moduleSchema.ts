import { z } from 'zod';
import type { DefinitionPatch } from '../core/metaTypes';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { Loadout } from './loadout';
import { PATCH_OPS } from './patchSchema';
import progression from '../data/meta/progression.json';

export const MODULE_SLOTS = ['muzzle', 'cell', 'optic'] as const;
export type ModuleSlot = (typeof MODULE_SLOTS)[number];
export const MODULE_SHAPES = [
  'brake',
  'rail',
  'coil',
  'canister',
  'reddot',
  'scope',
] as const;
const shapesBySlot: Record<ModuleSlot, readonly string[]> = {
  muzzle: ['brake', 'rail'],
  cell: ['coil', 'canister'],
  optic: ['reddot', 'scope'],
};

export const modulePatchSchema = z
  .object({
    op: z.enum(PATCH_OPS),
    path: z.string().min(1),
    value: z.unknown(),
  })
  .strict()
  .superRefine((patch, ctx) => {
    if (
      (patch.op === 'add' || patch.op === 'mul') &&
      !(typeof patch.value === 'number' && Number.isFinite(patch.value))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Operacja wymaga liczby skończonej.',
      });
    if (patch.op === 'append' && !Array.isArray(patch.value))
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Operacja append wymaga tablicy.',
      });
  });

export const moduleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    slot: z.enum(MODULE_SLOTS),
    visual: z
      .object({
        shape: z.enum(MODULE_SHAPES),
        color: z.enum(['amber', 'white', 'green']),
      })
      .strict(),
    tags: z.array(z.string()),
    weaponKinds: z.array(z.string().min(1)).optional(),
    patches: z.array(modulePatchSchema).min(1),
  })
  .strict()
  .superRefine((module, ctx) => {
    if (!shapesBySlot[module.slot].includes(module.visual.shape))
      ctx.addIssue({
        code: 'custom',
        path: ['visual', 'shape'],
        message: 'Kształt nie pasuje do slotu.',
      });
  });

export type ModuleDefinition = z.infer<typeof moduleSchema>;

export function loadModuleDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, ModuleDefinition> {
  const definitions = new Map<string, ModuleDefinition>();
  for (const raw of data) {
    const definition = moduleSchema.parse(raw);
    if (definitions.has(definition.id))
      throw new Error(`Powtórzone id modułu: ${definition.id}`);
    definitions.set(definition.id, definition);
  }
  return definitions;
}

const modules = import.meta.glob('../data/modules/*.json', {
  eager: true,
  import: 'default',
});
export const moduleDefinitions = loadModuleDefinitions(Object.values(modules));

export const moduleLootSchema = z
  .array(
    z.string().refine((id) => moduleDefinitions.has(id), 'Nieznany moduł.'),
  )
  .refine((ids) => new Set(ids).size === ids.length, 'Powtórzony moduł.');

export function moduleFitsWeapon(
  module: ModuleDefinition,
  weaponId: string,
): boolean {
  const weapon = weaponDefinitions.get(weaponId);
  return (
    weapon !== undefined &&
    (module.weaponKinds === undefined ||
      module.weaponKinds.includes(weapon.fireMode))
  );
}

export function sanitizeModules(
  weapons: readonly string[],
  modules: Record<string, readonly string[]> | undefined,
): Record<string, string[]> {
  return Object.fromEntries(
    weapons.flatMap((weaponId) => {
      const installed = modules?.[weaponId];
      if (!installed) return [];
      const slots = new Set<ModuleSlot>();
      const ids = installed.filter((id) => {
        const module = moduleDefinitions.get(id);
        if (
          !module ||
          !moduleFitsWeapon(module, weaponId) ||
          slots.has(module.slot) ||
          slots.size >= progression.moduleSlotsPerWeapon
        )
          return false;
        slots.add(module.slot);
        return true;
      });
      return [[weaponId, ids]];
    }),
  );
}

/** Cele łatek wynikają z broni; sloty określają stabilną kolejność łatek. */
export function modulePatches(
  loadout: Pick<Loadout, 'weapons' | 'modules'>,
): DefinitionPatch[] {
  const modules = sanitizeModules(loadout.weapons, loadout.modules);
  return loadout.weapons.flatMap((weaponId) =>
    (modules[weaponId] ?? [])
      .flatMap((id) => moduleDefinitions.get(id) ?? [])
      .sort(
        (a, b) => MODULE_SLOTS.indexOf(a.slot) - MODULE_SLOTS.indexOf(b.slot),
      )
      .flatMap((module) =>
        module.patches.map((patch): DefinitionPatch => ({
          ...structuredClone(patch),
          target: `weapon:${weaponId}`,
        })),
      ),
  );
}
