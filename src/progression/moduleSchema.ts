import { z } from 'zod';
import type { DefinitionPatch } from '../core/metaTypes';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';
import type { Loadout } from './loadout';
import { PATCH_OPS } from './patchSchema';

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
    tags: z.array(z.string()),
    weaponKinds: z.array(z.string().min(1)).optional(),
    patches: z.array(modulePatchSchema).min(1),
  })
  .strict();

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

/** Cele łatek wynikają z broni; kolejność tablicy modułów jest kolejnością slotów. */
export function modulePatches(
  loadout: Pick<Loadout, 'weapons' | 'modules'>,
): DefinitionPatch[] {
  return loadout.weapons.flatMap((weaponId) =>
    (loadout.modules?.[weaponId] ?? []).flatMap((id) => {
      const module = moduleDefinitions.get(id);
      if (!module) throw new Error(`Nieznany moduł: ${id}.`);
      if (!moduleFitsWeapon(module, weaponId))
        throw new Error(`Moduł ${id} nie pasuje do broni ${weaponId}.`);
      return module.patches.map((patch): DefinitionPatch => ({
        ...structuredClone(patch),
        target: `weapon:${weaponId}`,
      }));
    }),
  );
}
