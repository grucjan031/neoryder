import { z } from 'zod';
import { bladeDefinitions } from '../../combat/melee/bladeSchema';
import { powerDefinitions } from '../../combat/powers/registry';
import { weaponDefinitions } from '../../combat/weapons/weaponSchema';
import type { LoadoutChoice } from '../../core/metaTypes';
import type { MetaManager } from '../../progression/meta';
import { achievementDefinitions } from '../../progression/achievementsSchema';
import { unlockDefinitions } from '../../progression/unlocksSchema';
import type { UnlockDefinition } from '../../progression/unlocksSchema';
import {
  moduleDefinitions,
  moduleFitsWeapon,
} from '../../progression/moduleSchema';
import textData from '../../data/ui/workshop.pl.json';

export const workshopText = z
  .object({
    unlocks: z.object({
      title: z.string(),
      owned: z.string(),
      buy: z.string(),
      requiredLevel: z.string(),
      notEnough: z.object({ data: z.string(), cores: z.string() }),
      groups: z.object({
        weapon: z.string(),
        power: z.string(),
        blade: z.string(),
        slot: z.string(),
        module: z.string(),
      }),
    }),
    header: z.object({
      data: z.string(),
      cores: z.string(),
      level: z.string(),
    }),
    currency: z.object({ data: z.string(), cores: z.string() }),
    equipment: z.object({
      title: z.string(),
      blade: z.string(),
      weapons: z.string(),
      powers: z.string(),
      counter: z.string(),
      slotOrder: z.string(),
      fullHint: z.string(),
      lastHint: z.string(),
      moduleSlot: z.string(),
      emptyModule: z.string(),
    }),
    bladeNames: z.record(z.string(), z.string()),
    slotNames: z.record(z.string(), z.string()),
    errors: z.object({ generic: z.string() }),
  })
  .parse(textData);

export type ItemKind = 'weapon' | 'power' | 'blade' | 'slot' | 'module';
export const ITEM_KINDS: readonly ItemKind[] = [
  'weapon',
  'power',
  'blade',
  'slot',
  'module',
];

/** Podzbiór `MetaManager` potrzebny do stanu warsztatu (tylko publiczne gettery). */
export type MetaView = Pick<
  MetaManager,
  | 'level'
  | 'weaponSlots'
  | 'powerSlots'
  | 'moduleSlotsPerWeapon'
  | 'isUnlocked'
  | 'state'
>;

export type RowStatus =
  'owned' | 'buyable' | 'achievement' | 'level' | 'data' | 'cores';

export interface UnlockRow {
  id: string;
  kind: ItemKind;
  name: string;
  cost: { data: number; cores: number };
  minLevel: number | undefined;
  /** Id i tytuł naszywki, której brakuje do zakupu (status `achievement`). */
  requires?: { id: string; title: string };
  status: RowStatus;
}

export function splitId(id: string): { kind: ItemKind; key: string } {
  const separator = id.indexOf(':');
  return {
    kind: id.slice(0, separator) as ItemKind,
    key: id.slice(separator + 1),
  };
}

export function itemName(kind: ItemKind, key: string): string {
  switch (kind) {
    case 'weapon':
      return weaponDefinitions.get(key)?.name ?? key;
    case 'power':
      return powerDefinitions.get(key)?.name ?? key;
    case 'blade':
      return (
        workshopText.bladeNames[key] ?? bladeDefinitions.get(key)?.id ?? key
      );
    case 'slot':
      return workshopText.slotNames[key] ?? key;
    case 'module':
      return moduleDefinitions.get(key)?.name ?? key;
  }
}

/** Kolejność sprawdzeń jak w `MetaManager.buyUnlock`: naszywka, poziom, Dane, Rdzenie. */
export function rowStatus(
  state: {
    level: number;
    data: number;
    cores: number;
    owned: boolean;
    achievementMissing?: boolean;
  },
  def: UnlockDefinition | undefined,
): RowStatus {
  if (state.owned) return 'owned';
  if (!def) return 'level';
  if (state.achievementMissing) return 'achievement';
  if (def.minLevel !== undefined && state.level < def.minLevel) return 'level';
  if (state.data < (def.cost.data ?? 0)) return 'data';
  if (state.cores < (def.cost.cores ?? 0)) return 'cores';
  return 'buyable';
}

/** Wiersze odblokowań: pozycje z `unlocks.json`, potem posiadane pozycje startowe spoza listy zakupów. */
export function unlockRows(
  view: MetaView,
  defs: ReadonlyMap<string, UnlockDefinition> = unlockDefinitions,
): UnlockRow[] {
  const { data, cores, unlocks } = view.state;
  const ids = [...defs.keys()];
  for (const id of unlocks) if (!defs.has(id)) ids.push(id);
  return ids.map((id) => {
    const def = defs.get(id);
    const { kind, key } = splitId(id);
    const required = def?.requiresAchievement;
    const missing =
      required !== undefined &&
      !view.state.achievements.unlocked.includes(required);
    return {
      id,
      kind,
      name: itemName(kind, key),
      cost: { data: def?.cost.data ?? 0, cores: def?.cost.cores ?? 0 },
      minLevel: def?.minLevel,
      ...(required !== undefined && missing
        ? {
            requires: {
              id: required,
              title: achievementDefinitions.get(required)?.title ?? required,
            },
          }
        : {}),
      status: rowStatus(
        {
          level: view.level,
          data,
          cores,
          owned: view.isUnlocked(id),
          achievementMissing: missing,
        },
        def,
      ),
    };
  });
}

/** Grupy w kolejności Bronie, Moce, Ostrza, Sloty; w grupie posiadane startowe na początku. */
export function groupRows(
  rows: readonly UnlockRow[],
): { kind: ItemKind; rows: UnlockRow[] }[] {
  return ITEM_KINDS.map((kind) => ({
    kind,
    rows: rows
      .filter((row) => row.kind === kind)
      .sort(
        (a, b) => Number(b.status === 'owned') - Number(a.status === 'owned'),
      ),
  })).filter((group) => group.rows.length > 0);
}

/**
 * Przełącza pozycję na liście wyboru (kolejność = kolejność wyboru).
 * Zwraca nową listę albo `null`, gdy zmiana łamie reguły: ponad limit slotów
 * lub odznaczenie ostatniej pozycji.
 */
export function toggleSelection(
  list: readonly string[],
  key: string,
  slots: number,
): string[] | null {
  if (list.includes(key)) {
    if (list.length <= 1) return null;
    return list.filter((entry) => entry !== key);
  }
  if (list.length >= slots) return null;
  return [...list, key];
}

export interface ChoiceOption {
  key: string;
  name: string;
  selected: boolean;
  /** 1-based pozycja w ekwipunku (tylko wybrane). */
  order: number | null;
  /** `full` (limit slotów), `last` (ostatnia pozycja) albo `null` (zmiana dozwolona). */
  blocked: 'full' | 'last' | null;
}

export interface EquipmentState {
  blades: { key: string; name: string; selected: boolean }[];
  weapons: { options: ChoiceOption[]; used: number; slots: number };
  powers: { options: ChoiceOption[]; used: number; slots: number };
  modules: {
    weaponId: string;
    weaponName: string;
    slots: {
      selected: string;
      options: { id: string; name: string; description: string }[];
    }[];
  }[];
}

function choiceOptions(
  view: MetaView,
  kind: 'weapon' | 'power',
  selected: readonly string[],
  slots: number,
): ChoiceOption[] {
  return view.state.unlocks
    .map(splitId)
    .filter((entry) => entry.kind === kind)
    .map(({ key }) => {
      const index = selected.indexOf(key);
      const isSelected = index >= 0;
      let blocked: ChoiceOption['blocked'] = null;
      if (toggleSelection(selected, key, slots) === null)
        blocked = isSelected ? 'last' : 'full';
      return {
        key,
        name: itemName(kind, key),
        selected: isSelected,
        order: isSelected ? index + 1 : null,
        blocked,
      };
    });
}

export function equipmentState(view: MetaView): EquipmentState {
  const { loadout, unlocks } = view.state;
  const weaponSlots = view.weaponSlots;
  const powerSlots = view.powerSlots;
  return {
    blades: unlocks
      .map(splitId)
      .filter((entry) => entry.kind === 'blade')
      .map(({ key }) => ({
        key,
        name: itemName('blade', key),
        selected: loadout.blade === key,
      })),
    weapons: {
      options: choiceOptions(view, 'weapon', loadout.weapons, weaponSlots),
      used: loadout.weapons.length,
      slots: weaponSlots,
    },
    powers: {
      options: choiceOptions(view, 'power', loadout.powers, powerSlots),
      used: loadout.powers.length,
      slots: powerSlots,
    },
    modules: loadout.weapons.map((weaponId) => {
      const installed = loadout.modules[weaponId] ?? [];
      return {
        weaponId,
        weaponName: itemName('weapon', weaponId),
        slots: Array.from({ length: view.moduleSlotsPerWeapon }, (_, slot) => ({
          selected: installed[slot] ?? '',
          options: [...moduleDefinitions.values()]
            .filter(
              (module) =>
                view.isUnlocked(`module:${module.id}`) &&
                moduleFitsWeapon(module, weaponId) &&
                (!installed.includes(module.id) ||
                  installed[slot] === module.id),
            )
            .map(({ id, name, description }) => ({ id, name, description })),
        })),
      };
    }),
  };
}

export type LoadoutPart = 'weapons' | 'powers';

/** Nowy ekwipunek po przełączeniu pozycji albo `null`, gdy UI musi to zablokować. */
export function nextLoadout(
  view: MetaView,
  part: LoadoutPart,
  key: string,
): LoadoutChoice | null {
  const current = view.state.loadout;
  const slots = part === 'weapons' ? view.weaponSlots : view.powerSlots;
  const list = toggleSelection(current[part], key, slots);
  if (!list) return null;
  const modules =
    part === 'weapons'
      ? Object.fromEntries(
          Object.entries(current.modules).filter(([id]) => list.includes(id)),
        )
      : current.modules;
  return { ...current, [part]: list, modules };
}

/** Puste sloty są usuwane; kolejność pozostałych modułów zostaje zachowana. */
export function nextModuleLoadout(
  view: MetaView,
  weaponId: string,
  slot: number,
  moduleId: string,
): LoadoutChoice {
  const current = view.state.loadout;
  const ids = [...(current.modules[weaponId] ?? [])];
  ids[slot] = moduleId;
  const modules = { ...current.modules };
  const selected = ids.filter(Boolean);
  if (selected.length) modules[weaponId] = selected;
  else delete modules[weaponId];
  return { ...current, modules };
}
