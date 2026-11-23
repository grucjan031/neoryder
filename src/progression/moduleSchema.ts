import { z } from 'zod';
import type { DefinitionPatch } from '../core/metaTypes';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { Loadout } from './loadout';
import { PATCH_OPS } from './patchSchema';
import progression from '../data/meta/progression.json';

/** Kolejność slotów = kolejność łatek; `grip` to podwieszenie pod lufą. */
export const MODULE_SLOTS = ['muzzle', 'cell', 'optic', 'grip'] as const;
export type ModuleSlot = (typeof MODULE_SLOTS)[number];
export const MODULE_SHAPES = [
  'brake',
  'rail',
  'compensator',
  'coil',
  'canister',
  'extended',
  'pulse',
  'reddot',
  'scope',
  'holo',
  'laser',
  'foregrip',
] as const;
export type ModuleShape = (typeof MODULE_SHAPES)[number];
export const MODULE_SHAPES_BY_SLOT: Record<ModuleSlot, readonly ModuleShape[]> =
  {
    muzzle: ['brake', 'rail', 'compensator'],
    cell: ['coil', 'canister', 'extended', 'pulse'],
    optic: ['reddot', 'scope', 'holo'],
    grip: ['laser', 'foregrip'],
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
        sight: z
          .strictObject({
            target: z.tuple([z.number(), z.number(), z.number()]),
            rearZ: z.number(),
            eyeReliefM: z.number().positive(),
          })
          .refine(({ target, rearZ }) => rearZ > target[2], {
            message: 'Okular musi być za punktem celowania.',
          })
          .optional(),
      })
      .strict(),
    tags: z.array(z.string()),
    weaponKinds: z.array(z.string().min(1)).optional(),
    patches: z.array(modulePatchSchema).min(1),
  })
  .strict()
  .superRefine((module, ctx) => {
    if (!MODULE_SHAPES_BY_SLOT[module.slot].includes(module.visual.shape))
      ctx.addIssue({
        code: 'custom',
        path: ['visual', 'shape'],
        message: 'Kształt nie pasuje do slotu.',
      });
    if ((module.slot === 'optic') !== (module.visual.sight !== undefined))
      ctx.addIssue({
        code: 'custom',
        path: ['visual', 'sight'],
        message: 'Tylko optyka wymaga punktu celowania i położenia okularu.',
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
