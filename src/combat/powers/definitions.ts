import { powerSchema } from './powerSchema';
import type { PowerDefinition } from './powerSchema';

// Same dane mocy, bez fabryk mechanizmów: menu, zapis i ekwipunek nie wciągają przez nie Rapiera.
export function loadPower(data: unknown): PowerDefinition {
  const result = powerSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane mocy: ${result.error.message}`);
  return result.data;
}

export function loadPowerDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, PowerDefinition> {
  const definitions = new Map<string, PowerDefinition>();
  for (const raw of data) {
    const def = loadPower(raw);
    if (definitions.has(def.id))
      throw new Error(`Powtórzone id mocy: ${def.id}`);
    definitions.set(def.id, def);
  }
  return definitions;
}

const modules = import.meta.glob('../../data/powers/*.json', {
  eager: true,
  import: 'default',
});
export const powerDefinitions = loadPowerDefinitions(Object.values(modules));
