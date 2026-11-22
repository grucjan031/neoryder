import {
  weaponDefinitions,
  weaponSchema,
} from '../combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../combat/weapons/weaponSchema';
import { modulePatches } from './moduleSchema';
import { applyPatches } from './patches';

/**
 * Definicja broni po łatkach podanych modułów (bez talentów): podgląd statystyk w warsztacie
 * i odrzut w widoku FPP. Moduły niezgodne, powtórzone w slocie i ponad limit są pomijane.
 */
export function moddedWeapon(
  weaponId: string,
  moduleIds: readonly string[],
): WeaponDefinition | undefined {
  const definition = weaponDefinitions.get(weaponId);
  if (!definition) return undefined;
  return applyPatches(
    definition,
    weaponSchema,
    modulePatches({
      weapons: [weaponId],
      modules: { [weaponId]: [...moduleIds] },
    }),
    `weapon:${weaponId}`,
  );
}
