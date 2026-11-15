import { z } from 'zod';
import { TREE_IDS, type TreeId } from '../core/metaTypes';
import { implantModifierSchema, implantTriggerSchema } from './implantSchema';
import { definitionPatchSchema } from './patchSchema';

const treeIdSchema = z.enum(TREE_IDS);

export const talentEffectsSchema = z
  .object({
    /** StatModifier ze źródłem `talent:<id>`. */
    modifiers: z.array(implantModifierSchema).optional(),
    /** Te same wyzwalacze co implanty (SynergySystem). */
    triggers: z.array(implantTriggerSchema).optional(),
    tags: z.array(z.string().startsWith('#')).optional(),
    patches: z.array(definitionPatchSchema).optional(),
    runStart: z
      .object({ credits: z.number().int().min(0).optional() })
      .strict()
      .optional(),
  })
  .strict();
export type TalentEffects = z.infer<typeof talentEffectsSchema>;

export const talentNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    /** Koszt w punktach talentów. */
    cost: z.number().int().min(1).max(3),
    /** Wszystkie wymagane węzły (dowolne drzewo). */
    requires: z.array(z.string().min(1)),
    /** Dla węzłów hybrydowych: punkty wydane w drzewkach. */
    requiresTreePoints: z
      .partialRecord(treeIdSchema, z.number().int().min(1))
      .optional(),
    effects: talentEffectsSchema,
  })
  .strict()
  .refine((node) => !node.requires.includes(node.id), {
    message: 'Węzeł nie może wymagać samego siebie.',
    path: ['requires'],
  });
export type TalentNode = z.infer<typeof talentNodeSchema>;

export const talentTreeSchema = z
  .object({
    tree: treeIdSchema,
    name: z.string().min(1),
    /** Punkty wydane w drzewku wymagane dla progu 1..4, np. [0, 2, 5, 8]. */
    tierThresholds: z
      .array(z.number().int().min(0))
      .length(4)
      .refine(
        (values) =>
          values.every((v, i) => i === 0 || v >= (values[i - 1] ?? 0)),
        'Progi muszą być niemalejące.',
      ),
    nodes: z.array(talentNodeSchema),
  })
  .strict()
  .refine(
    (tree) => new Set(tree.nodes.map((n) => n.id)).size === tree.nodes.length,
    { message: 'Powtórzone id węzła w drzewku.', path: ['nodes'] },
  );
export type TalentTree = z.infer<typeof talentTreeSchema>;

export function loadTalentTree(data: unknown): TalentTree {
  return talentTreeSchema.parse(data);
}

/** Ładuje komplet drzewek; działa na pustym zbiorze. Id węzłów są unikalne w całym komplecie, a `requires` wskazuje istniejące węzły. */
export function loadTalentTrees(
  data: readonly unknown[],
): ReadonlyMap<TreeId, TalentTree> {
  const trees = new Map<TreeId, TalentTree>();
  const nodeIds = new Set<string>();
  for (const raw of data) {
    const tree = loadTalentTree(raw);
    if (trees.has(tree.tree))
      throw new Error(`Powtórzone drzewko talentów: ${tree.tree}`);
    for (const node of tree.nodes) {
      if (nodeIds.has(node.id))
        throw new Error(`Powtórzone id talentu: ${node.id}`);
      nodeIds.add(node.id);
    }
    trees.set(tree.tree, tree);
  }
  for (const tree of trees.values())
    for (const node of tree.nodes)
      for (const required of node.requires)
        if (!nodeIds.has(required))
          throw new Error(
            `Talent ${node.id} wymaga nieznanego węzła: ${required}`,
          );
  return trees;
}

const modules = import.meta.glob('../data/talents/*.json', {
  eager: true,
  import: 'default',
});
export const talentTrees = loadTalentTrees(Object.values(modules));
