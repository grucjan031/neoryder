import { z } from 'zod';
import type { StatModifier } from '../core/stats';
import type { WavesDefinition } from '../world/waves';
import { allyDefinitions } from './allySchema';
import type { AllyDefinition } from './allySchema';

/** Stan członka drużyny w zapisie runu: zdrowie bezwzględne, 0 = powalony. */
export interface SquadMemberState {
  id: string;
  hp: number;
}

export const squadMemberStateSchema: z.ZodType<SquadMemberState> = z.object({
  id: z.string().min(1),
  hp: z.number().finite().nonnegative(),
});

export const squadStateSchema = z.array(squadMemberStateSchema);

/** Czy sojusznik jest dostępny przy danej liście ukończonych misji kampanii. */
export function isAllyUnlocked(
  definition: Pick<AllyDefinition, 'unlock'>,
  completed: readonly string[],
): boolean {
  return !definition.unlock || completed.includes(definition.unlock.mission);
}

export function unlockedAllyIds(
  completed: readonly string[],
  definitions: ReadonlyMap<string, AllyDefinition> = allyDefinitions,
): string[] {
  return [...definitions.values()]
    .filter((definition) => isAllyUnlocked(definition, completed))
    .map((definition) => definition.id);
}

/**
 * Wybór drużyny po sprawdzeniu: znani, odblokowani (`allowAll` pomija odblokowanie, np. tryb
 * debug), bez powtórzeń, najwyżej `max`; kolejność wyboru zostaje.
 */
export function sanitizeSquad(
  ids: readonly string[],
  completed: readonly string[],
  max: number,
  allowAll = false,
  definitions: ReadonlyMap<string, AllyDefinition> = allyDefinitions,
): string[] {
  const result: string[] = [];
  for (const id of ids) {
    const definition = definitions.get(id);
    if (
      !definition ||
      result.includes(id) ||
      (!allowAll && !isAllyUnlocked(definition, completed))
    )
      continue;
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
}

/** Parametr URL `squad=nadia,szron` (puste i brak dają pustą drużynę). */
export function parseSquadParam(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function squadParam(ids: readonly string[]): string {
  return ids.join(',');
}

/** Mnożnik liczby wrogów w falach dla drużyny o danym rozmiarze (1 = bez drużyny). */
export function squadCountScale(size: number, perAlly: number): number {
  return 1 + Math.max(0, size) * Math.max(0, perAlly);
}

/** Kopia planu fal z większymi grupami; bez zmiany skali zwraca ten sam obiekt. */
export function scaleWavesForSquad(
  waves: WavesDefinition,
  scale: number,
): WavesDefinition {
  if (!(scale > 1)) return waves;
  return {
    ...waves,
    waves: waves.waves.map((wave) => ({
      ...wave,
      groups: wave.groups.map((group) => ({
        ...group,
        count: Math.max(group.count, Math.round(group.count * scale)),
      })),
    })),
  };
}

/** Wzmocnienie zdrowia wrogów w trybach bez fal; źródło `squad` do usunięcia po nazwie. */
export function squadHealthModifiers(
  size: number,
  perAlly: number,
): StatModifier[] {
  const value = Math.max(0, size) * Math.max(0, perAlly);
  return value > 0
    ? [{ stat: 'maxHealth', type: 'percent', value, source: 'squad' }]
    : [];
}

/** Leczenie drużyny jak gracza: ten sam ułamek maksymalnego zdrowia, powalony wstaje. */
export function healSquad(
  squad: readonly SquadMemberState[],
  fraction: number,
  definitions: ReadonlyMap<string, AllyDefinition> = allyDefinitions,
): SquadMemberState[] {
  return squad.map((member) => {
    const max = definitions.get(member.id)?.hp;
    if (max === undefined || !(fraction > 0)) return { ...member };
    return { ...member, hp: Math.min(max, member.hp + max * fraction) };
  });
}

/** Stan drużyny zapisany w stanie runu (brak pola = brak drużyny). */
export function squadOf(run: object): readonly SquadMemberState[] {
  return (run as { squad?: SquadMemberState[] }).squad ?? [];
}
