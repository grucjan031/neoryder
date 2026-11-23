import { z } from 'zod';
import { bladeDefinitions } from '../../combat/melee/bladeSchema';
import { powerDefinitions } from '../../combat/powers/registry';
import { weaponDefinitions } from '../../combat/weapons/weaponSchema';
import type { WeaponDefinition } from '../../combat/weapons/weaponSchema';
import type { LoadoutChoice } from '../../core/metaTypes';
import { Stats } from '../../core/stats';
import { tuning } from '../../core/tuning';
import type { MetaManager } from '../../progression/meta';
import { achievementDefinitions } from '../../progression/achievementsSchema';
import { unlockDefinitions } from '../../progression/unlocksSchema';
import type { UnlockDefinition } from '../../progression/unlocksSchema';
import {
  MODULE_SLOTS,
  type ModuleSlot,
  moduleDefinitions,
  moduleFitsWeapon,
  sanitizeModules,
} from '../../progression/moduleSchema';
import { moddedWeapon } from '../../progression/moddedWeapon';
import playerData from '../../data/scenes/roomPlayer.json';
import textData from '../../data/ui/workshop.pl.json';

export const workshopText = z
  .object({
    extraction: z.object({
      title: z.string(),
      choose: z.string(),
      claim: z.string(),
      saved: z.string(),
      retry: z.string(),
    }),
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
    preview: z.object({
      title: z.string(),
      unavailable: z.string(),
      switchLabel: z.string(),
    }),
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
      moduleSlots: z.object({
        muzzle: z.string(),
        cell: z.string(),
        optic: z.string(),
        grip: z.string(),
      }),
      emptyModule: z.string(),
      slotLimitHint: z.string(),
    }),
    shop: z.object({
      pickHint: z.string(),
      priceFree: z.string(),
      purchased: z.string(),
      confirm: z.object({
        title: z.string(),
        message: z.string(),
        confirm: z.string(),
        cancel: z.string(),
      }),
      title: z.string(),
      tabsLabel: z.string(),
      tabs: z.object({
        weapon: z.string(),
        module: z.string(),
        equipment: z.string(),
        unlocks: z.string(),
        extraction: z.string(),
      }),
      listLabel: z.object({ weapon: z.string(), module: z.string() }),
      equip: z.string(),
      unequip: z.string(),
      equipWeapon: z.string(),
      unequipWeapon: z.string(),
      state: z.object({
        equipped: z.string(),
        inLoadout: z.string(),
        owned: z.string(),
      }),
      price: z.string(),
      slot: z.string(),
      target: z.string(),
      fits: z.string(),
      tryOn: z.string(),
      slotsLabel: z.string(),
      emptySlot: z.string(),
      compareModule: z.string(),
      compareWeapon: z.string(),
      statsOnly: z.string(),
      noChange: z.string(),
      columns: z.object({
        stat: z.string(),
        before: z.string(),
        after: z.string(),
      }),
      trend: z.object({
        better: z.string(),
        worse: z.string(),
        changed: z.string(),
        same: z.string(),
      }),
      blocked: z.object({
        unfit: z.string(),
        slots: z.string(),
        full: z.string(),
        last: z.string(),
        noWeapon: z.string(),
      }),
    }),
    stats: z.object({
      damage: z.string(),
      fireRate: z.string(),
      dps: z.string(),
      hipSpread: z.string(),
      aimSpread: z.string(),
      aimIn: z.string(),
      zoom: z.string(),
      recoil: z.string(),
      heatPerShot: z.string(),
      heatPerS: z.string(),
      heatCapacity: z.string(),
      shots: z.string(),
      projectileSpeed: z.string(),
      pierce: z.string(),
      ricochets: z.string(),
    }),
    units: z.object({
      perS: z.string(),
      deg: z.string(),
      s: z.string(),
      pct: z.string(),
      times: z.string(),
      mPerS: z.string(),
      none: z.string(),
    }),
    weaponDescriptions: z.record(z.string(), z.string()),
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
      slot: ModuleSlot;
      selected: string;
      /** Puste gniazdo zablokowane limitem dodatków na broń. */
      blocked: boolean;
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
      const selectedOf = (slot: ModuleSlot): string =>
        installed.find((id) => moduleDefinitions.get(id)?.slot === slot) ?? '';
      const used = MODULE_SLOTS.filter((slot) => selectedOf(slot)).length;
      return {
        weaponId,
        weaponName: itemName('weapon', weaponId),
        slots: MODULE_SLOTS.map((slot) => ({
          slot,
          selected: selectedOf(slot),
          blocked: !selectedOf(slot) && used >= view.moduleSlotsPerWeapon,
          options: [...moduleDefinitions.values()]
            .filter(
              (module) =>
                view.isUnlocked(`module:${module.id}`) &&
                moduleFitsWeapon(module, weaponId) &&
                module.slot === slot,
            )
            .map(({ id, name, description }) => ({ id, name, description })),
        })),
      };
    }),
  };
}

export interface PreviewTarget {
  weaponId: string;
  /** Moduły widoczne na podglądzie: tylko poprawne, zgodne i w limicie slotów. */
  moduleIds: string[];
}

/**
 * Broń pokazywana w podglądzie 3D: wybrana (`wanted`), o ile jest w ekwipunku,
 * inaczej pierwsza z ekwipunku; `null`, gdy ekwipunek jest pusty.
 */
export function previewTarget(
  view: MetaView,
  wanted?: string,
): PreviewTarget | null {
  const { weapons, modules } = view.state.loadout;
  const weaponId =
    wanted !== undefined && weapons.includes(wanted) ? wanted : weapons[0];
  if (weaponId === undefined) return null;
  return {
    weaponId,
    moduleIds: sanitizeModules([weaponId], modules)[weaponId] ?? [],
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

/** Indeks pola wskazuje stały slot, niezależnie od pustych miejsc w zapisie. */
export function nextModuleLoadout(
  view: MetaView,
  weaponId: string,
  slot: number,
  moduleId: string,
): LoadoutChoice {
  const current = view.state.loadout;
  const target = MODULE_SLOTS[slot];
  if (!target) throw new Error('Nieznany slot modułu.');
  if (moduleId && moduleDefinitions.get(moduleId)?.slot !== target)
    throw new Error('Moduł nie pasuje do slotu.');
  const ids = (current.modules[weaponId] ?? []).filter(
    (id) =>
      moduleDefinitions.has(id) && moduleDefinitions.get(id)?.slot !== target,
  );
  if (moduleId) ids.push(moduleId);
  ids.sort(
    (a, b) =>
      MODULE_SLOTS.findIndex(
        (slot) => moduleDefinitions.get(a)?.slot === slot,
      ) -
      MODULE_SLOTS.findIndex((slot) => moduleDefinitions.get(b)?.slot === slot),
  );
  const modules = { ...current.modules };
  const selected = ids.filter(Boolean);
  if (selected.length) modules[weaponId] = selected;
  else delete modules[weaponId];
  return { ...current, modules };
}

// ------------------------------------------------------------------ sklep

export type ShopTab = 'weapon' | 'module';
export const SHOP_TABS: readonly ShopTab[] = ['weapon', 'module'];

export const STAT_KEYS = [
  'damage',
  'fireRate',
  'dps',
  'hipSpread',
  'aimSpread',
  'aimIn',
  'zoom',
  'recoil',
  'heatPerShot',
  'heatPerS',
  'heatCapacity',
  'shots',
  'projectileSpeed',
  'pierce',
  'ricochets',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type WeaponSheet = Record<StatKey, number | null>;
type Unit = keyof typeof workshopText.units;

/** `core`: wiersz widoczny zawsze, gdy broń ma tę statystykę; pozostałe tylko przy zmianie. */
const STAT_RULES: Record<
  StatKey,
  { better: 'higher' | 'lower' | 'neutral'; core: boolean; unit: Unit }
> = {
  damage: { better: 'higher', core: true, unit: 'none' },
  fireRate: { better: 'higher', core: true, unit: 'perS' },
  dps: { better: 'higher', core: true, unit: 'perS' },
  hipSpread: { better: 'lower', core: true, unit: 'deg' },
  aimSpread: { better: 'lower', core: false, unit: 'deg' },
  aimIn: { better: 'lower', core: false, unit: 's' },
  zoom: { better: 'neutral', core: false, unit: 'times' },
  recoil: { better: 'lower', core: true, unit: 'pct' },
  heatPerShot: { better: 'lower', core: true, unit: 'none' },
  heatPerS: { better: 'lower', core: true, unit: 'perS' },
  heatCapacity: { better: 'higher', core: false, unit: 'none' },
  shots: { better: 'higher', core: true, unit: 'none' },
  projectileSpeed: { better: 'higher', core: false, unit: 'mPerS' },
  pierce: { better: 'higher', core: false, unit: 'none' },
  ricochets: { better: 'higher', core: false, unit: 'none' },
};

/** Bazowa pojemność cieplna gracza: ta sama statystyka `Stats`, z której korzysta broń. */
const playerStats = new Stats({ heatCapacity: playerData.heatCapacity });

const round = (value: number): number => Math.round(value * 100) / 100;

/** Liczby karty broni wyliczone z definicji (po łatkach modułów) i `tuning.player.aim`. */
export function weaponSheet(def: WeaponDefinition): WeaponSheet {
  const aim = tuning.player.aim;
  const capacity =
    playerStats.get('heatCapacity') * (def.heatCapacityScale ?? 1);
  const shared = {
    aimIn: round(aim.inS * (def.aimInScale ?? 1)),
    zoom: round(1 / (def.aimFovScale ?? aim.fovScale)),
    heatCapacity: round(capacity),
  };
  if (def.fireMode === 'beam')
    return {
      ...shared,
      damage: null,
      fireRate: null,
      dps: round(def.dps),
      hipSpread: null,
      aimSpread: null,
      recoil: null,
      heatPerShot: null,
      heatPerS: round(def.heatPerS),
      shots: null,
      projectileSpeed: null,
      pierce: null,
      ricochets: null,
    };
  const perShot =
    def.damage * (def.fireMode === 'spread' ? def.pellets : 1) +
    (def.fireMode === 'lob' ? def.explosionDamage : 0);
  return {
    ...shared,
    damage: round(perShot),
    fireRate: round(def.fireRateHz),
    dps: round(perShot * def.fireRateHz),
    hipSpread: round(def.spreadDeg * (def.hipSpreadScale ?? 1)),
    aimSpread: round(def.spreadDeg * aim.spread * (def.aimSpreadScale ?? 1)),
    recoil: round((def.recoilScale ?? 1) * 100),
    heatPerShot: round(def.heatPerShot),
    heatPerS: null,
    shots: Math.ceil(capacity / def.heatPerShot - 1e-9),
    projectileSpeed: round(def.projectileSpeed),
    pierce: def.pierceCount,
    ricochets: def.ricochets ?? 0,
  };
}

export type StatTrend = 'better' | 'worse' | 'changed' | 'same';

export interface StatLine {
  key: StatKey;
  label: string;
  /** Wartość bazowa z jednostką; `null`, gdy karta nie ma porównania. */
  before: string | null;
  after: string;
  trend: StatTrend;
}

function formatStat(key: StatKey, value: number | null): string {
  if (value === null) return '—';
  const unit = workshopText.units[STAT_RULES[key].unit];
  return `${String(value).replace('.', ',')}${unit}`;
}

/**
 * Wiersze tabeli statystyk. Bez `before` — same wartości podstawowe; z `before` —
 * wartości podstawowe i każda, która się zmieniła, z oceną zmiany.
 */
export function statLines(
  after: WeaponSheet,
  before: WeaponSheet | null,
): StatLine[] {
  const lines: StatLine[] = [];
  for (const key of STAT_KEYS) {
    const rule = STAT_RULES[key];
    const now = after[key];
    const was = before ? before[key] : now;
    const changed = was !== now;
    if (now === null && was === null) continue;
    if (!changed && !(rule.core && now !== null)) continue;
    let trend: StatTrend = 'same';
    if (changed)
      trend =
        rule.better === 'neutral' || now === null || was === null
          ? 'changed'
          : now > was === (rule.better === 'higher')
            ? 'better'
            : 'worse';
    lines.push({
      key,
      label: workshopText.stats[key],
      before: before ? formatStat(key, was) : null,
      after: formatStat(key, now),
      trend,
    });
  }
  return lines;
}

const slotIndex = (moduleId: string): number =>
  MODULE_SLOTS.indexOf(moduleDefinitions.get(moduleId)?.slot ?? 'muzzle');

/** Moduły broni po założeniu `moduleId` w jego gnieździe albo po zdjęciu (`install` = false). */
function withModule(
  installed: readonly string[],
  moduleId: string,
  install: boolean,
): string[] {
  const slot = moduleDefinitions.get(moduleId)?.slot;
  const rest = installed.filter(
    (id) => moduleDefinitions.get(id)?.slot !== slot,
  );
  return (install ? [...rest, moduleId] : rest).sort(
    (a, b) => slotIndex(a) - slotIndex(b),
  );
}

const installedOn = (view: MetaView, weaponId: string): string[] =>
  view.state.loadout.weapons.includes(weaponId)
    ? (sanitizeModules([weaponId], view.state.loadout.modules)[weaponId] ?? [])
    : [];

export interface ShopRow extends UnlockRow {
  key: string;
  /** Gniazdo dodatku (tylko zakładka Dodatki). */
  slot?: ModuleSlot;
  /** Broń w ekwipunku albo dodatek założony w broni z podglądu. */
  equipped: boolean;
}

/** Wiersze zakładki sklepu; `weaponId` to broń z podglądu (stan „założone” dodatków). */
export function shopRows(
  view: MetaView,
  tab: ShopTab,
  weaponId?: string,
): ShopRow[] {
  const installed = weaponId ? installedOn(view, weaponId) : [];
  const rows = (
    groupRows(unlockRows(view)).find((group) => group.kind === tab)?.rows ?? []
  ).map((row): ShopRow => {
    const { key } = splitId(row.id);
    const slot =
      tab === 'module' ? moduleDefinitions.get(key)?.slot : undefined;
    return {
      ...row,
      key,
      ...(slot ? { slot } : {}),
      equipped:
        tab === 'weapon'
          ? view.state.loadout.weapons.includes(key)
          : installed.includes(key),
    };
  });
  if (tab === 'weapon') return rows;
  // Dodatki w kolejności gniazd; w gnieździe zostaje kolejność z listy zakupów.
  return rows.sort((a, b) => slotIndex(a.key) - slotIndex(b.key));
}

export type ShopAction = 'buy' | 'equip' | 'unequip';
export type ShopBlock =
  | 'achievement'
  | 'level'
  | 'data'
  | 'cores'
  | 'unfit'
  | 'slots'
  | 'full'
  | 'last'
  | 'noWeapon';

export interface ShopCard {
  row: ShopRow;
  description: string;
  /** Broń, której dotyczy montaż i porównanie (dodatki) albo sama broń (bronie). */
  weaponId: string | null;
  /** Nazwy broni zgodnych z dodatkiem. */
  fits: string[];
  action: ShopAction;
  blocked: ShopBlock | null;
  /** Nazwa broni odniesienia w porównaniu broni; `null` = same statystyki. */
  baseline: string | null;
  lines: StatLine[];
}

const sheetOf = (
  weaponId: string,
  moduleIds: readonly string[],
): WeaponSheet | null => {
  const def = moddedWeapon(weaponId, moduleIds);
  return def ? weaponSheet(def) : null;
};

/**
 * Karta przedmiotu sklepu: stan, akcja, powód blokady i tabela statystyk. Dla dodatku
 * porównanie liczy broń `weaponId` bez dodatku i z nim (inne gniazda bez zmian; ponad limit
 * gniazd — na broni bez dodatków); dla broni — względem pierwszej broni ekwipunku.
 * `null`, gdy przedmiotu nie ma w sklepie.
 */
export function shopCard(
  view: MetaView,
  itemId: string,
  weaponId?: string,
): ShopCard | null {
  const { kind, key } = splitId(itemId);
  if (kind !== 'weapon' && kind !== 'module') return null;
  const target = kind === 'weapon' ? key : weaponId;
  const row = shopRows(view, kind, target).find((entry) => entry.id === itemId);
  if (!row) return null;
  const { loadout } = view.state;
  const purchase: ShopBlock | null =
    row.status === 'owned' || row.status === 'buyable' ? null : row.status;
  const action: ShopAction =
    row.status !== 'owned' ? 'buy' : row.equipped ? 'unequip' : 'equip';
  if (kind === 'weapon') {
    const first = loadout.weapons[0];
    const baseline = first !== undefined && first !== key ? first : null;
    const sheet = sheetOf(key, installedOn(view, key));
    let blocked: ShopBlock | null = purchase;
    if (row.status === 'owned' && !nextLoadout(view, 'weapons', key))
      blocked = row.equipped ? 'last' : 'full';
    return {
      row,
      description: workshopText.weaponDescriptions[key] ?? '',
      weaponId: key,
      fits: [],
      action,
      blocked,
      baseline: baseline ? itemName('weapon', baseline) : null,
      lines: sheet
        ? statLines(
            sheet,
            baseline ? sheetOf(baseline, installedOn(view, baseline)) : null,
          )
        : [],
    };
  }
  const module = moduleDefinitions.get(key);
  if (!module) return null;
  const inLoadout = target !== undefined && loadout.weapons.includes(target);
  const fitsTarget = target !== undefined && moduleFitsWeapon(module, target);
  const installed = target ? installedOn(view, target) : [];
  const overLimit =
    withModule(installed, key, true).length > view.moduleSlotsPerWeapon;
  let blocked: ShopBlock | null = purchase;
  if (row.status === 'owned' && !row.equipped) {
    if (!inLoadout) blocked = 'noWeapon';
    else if (!fitsTarget) blocked = 'unfit';
    else if (overLimit) blocked = 'slots';
  }
  const base = overLimit ? [] : withModule(installed, key, false);
  const before = target && fitsTarget ? sheetOf(target, base) : null;
  const after =
    target && fitsTarget ? sheetOf(target, withModule(base, key, true)) : null;
  return {
    row,
    description: module.description,
    weaponId: target ?? null,
    fits: [...weaponDefinitions.keys()]
      .filter((id) => moduleFitsWeapon(module, id))
      .map((id) => itemName('weapon', id)),
    action,
    blocked,
    baseline: null,
    lines: before && after ? statLines(after, before) : [],
  };
}

/** Ekwipunek po założeniu albo zdjęciu dodatku w broni (gniazdo wynika z dodatku). */
export function toggleModuleLoadout(
  view: MetaView,
  weaponId: string,
  moduleId: string,
  install: boolean,
): LoadoutChoice {
  const slot = moduleDefinitions.get(moduleId)?.slot;
  if (!slot) throw new Error('Nieznany moduł.');
  return nextModuleLoadout(
    view,
    weaponId,
    MODULE_SLOTS.indexOf(slot),
    install ? moduleId : '',
  );
}

export interface ShopPreview extends PreviewTarget {
  /** Dodatek pokazany na modelu, ale jeszcze niezałożony (przymiarka). */
  tryOn: string | null;
  /** Gniazdo do podświetlenia na modelu i na liście gniazd. */
  highlight: ModuleSlot | null;
  /** Gniazda broni z ekwipunku; puste dla broni spoza ekwipunku. */
  slots: { slot: ModuleSlot; moduleId: string | null; name: string | null }[];
}

/**
 * Co pokazuje podgląd 3D: broń wybrana w sklepie (także niekupiona) albo broń z ekwipunku,
 * z założonymi dodatkami; wybrany dodatek jest przymierzany w swoim gnieździe.
 */
export function shopPreview(
  view: MetaView,
  selected: string | undefined,
  wanted?: string,
): ShopPreview | null {
  const picked = selected ? splitId(selected) : null;
  const base =
    picked?.kind === 'weapon' && weaponDefinitions.has(picked.key)
      ? {
          weaponId: picked.key,
          moduleIds: installedOn(view, picked.key),
        }
      : previewTarget(view, wanted);
  if (!base) return null;
  const module =
    picked?.kind === 'module' ? moduleDefinitions.get(picked.key) : undefined;
  const fits = module !== undefined && moduleFitsWeapon(module, base.weaponId);
  const installed = base.moduleIds;
  const tryOn = module && fits && !installed.includes(module.id);
  return {
    weaponId: base.weaponId,
    moduleIds: tryOn ? withModule(installed, module.id, true) : installed,
    tryOn: tryOn ? module.id : null,
    highlight: module && fits ? module.slot : null,
    slots: view.state.loadout.weapons.includes(base.weaponId)
      ? MODULE_SLOTS.map((slot) => {
          const moduleId =
            installed.find((id) => moduleDefinitions.get(id)?.slot === slot) ??
            null;
          return {
            slot,
            moduleId,
            name: moduleId ? itemName('module', moduleId) : null,
          };
        })
      : [],
  };
}
