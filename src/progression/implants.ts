import type { EventBus, GameEvents } from '../core/events';
import type { Rarity } from '../core/runTypes';
import { Stats } from '../core/stats';
import {
  implantModifierSchema,
  implantSchema,
  implantTriggerSchema,
  loadImplant,
  loadImplantDefinition,
  nextRarity,
  registerImplantRarities,
  type ImplantDefinition,
  type ImplantModifier,
  type ImplantTrigger,
} from './implantSchema';

export {
  implantModifierSchema,
  implantSchema,
  implantTriggerSchema,
  loadImplant,
  loadImplantDefinition,
  nextRarity,
  registerImplantRarities,
  type ImplantDefinition,
  type ImplantModifier,
  type ImplantTrigger,
};

export const IMPLANT_SOURCE_PREFIX = 'implant:';

/** Zwraca identyfikator źródła modyfikatora dla `Stats` (`implant:<id>`). */
export function implantSource(id: string): string {
  return `${IMPLANT_SOURCE_PREFIX}${id}`;
}

export type ImplantAcquireSource = GameEvents['implant_acquired']['source'];

export interface ImplantHealthTarget {
  readonly current: number;
  readonly dead?: boolean;
  set(n: number): void;
}

export interface ImplantSystemOptions {
  stats?: Stats | readonly Stats[];
  health?: ImplantHealthTarget;
  bus?: EventBus;
  definitions?:
    ReadonlyMap<string, ImplantDefinition> | readonly ImplantDefinition[];
  onChange?: () => void;
}

export interface ImplantSetOptions {
  /** Czy zmiana `maxHealth` ma automatycznie skorygować bieżące zdrowie (domyślnie true). */
  adjustHealth?: boolean;
  /** Czy wyemitować `implant_acquired` dla nowo dodanych implantów (domyślnie false). */
  emit?: boolean;
  source?: ImplantAcquireSource;
}

/**
 * Waliduje i buduje mapę definicji implantów.
 * Odrzuca powtórzone id, nieznane `upgradesTo` oraz `upgradesTo` o rzadkości innej niż dokładnie następna.
 */
export function loadImplantDefinitions(
  data: readonly unknown[],
): ReadonlyMap<string, ImplantDefinition> {
  const definitions = new Map<string, ImplantDefinition>();
  registerImplantRarities(null);
  try {
    for (const raw of data) {
      const definition = loadImplant(raw);
      if (definitions.has(definition.id))
        throw new Error(`Powtórzone id implantu: ${definition.id}`);
      definitions.set(definition.id, definition);
    }
    for (const definition of definitions.values()) {
      if (definition.upgradesTo === undefined) continue;
      const target = definitions.get(definition.upgradesTo);
      if (!target)
        throw new Error(
          `Nieznany implant docelowy upgradesTo: ${definition.upgradesTo} (w ${definition.id})`,
        );
      const expected = nextRarity(definition.rarity);
      if (expected === null || target.rarity !== expected)
        throw new Error(
          `Niepoprawna rzadkość upgradesTo dla ${definition.id}: oczekiwano ${expected ?? 'brak'}, otrzymano ${target.rarity}`,
        );
    }
    return definitions;
  } finally {
    if (defaultRarities) registerImplantRarities(defaultRarities);
  }
}

let defaultRarities: ReadonlyMap<string, Rarity> | null = null;

const modules = import.meta.glob('../data/implants/*.json', {
  eager: true,
  import: 'default',
});

export const implantDefinitions: ReadonlyMap<string, ImplantDefinition> =
  loadImplantDefinitions(Object.values(modules));

defaultRarities = new Map(
  [...implantDefinitions.values()].map((def) => [def.id, def.rarity]),
);
registerImplantRarities(defaultRarities);

function toDefinitionsMap(
  defs?: ReadonlyMap<string, ImplantDefinition> | readonly ImplantDefinition[],
): ReadonlyMap<string, ImplantDefinition> {
  if (!defs) return implantDefinitions;
  if (Array.isArray(defs))
    return new Map(defs.map((def) => [def.id, def] as const));
  return defs as ReadonlyMap<string, ImplantDefinition>;
}

function isHealthTarget(value: unknown): value is ImplantHealthTarget {
  return (
    typeof value === 'object' &&
    value !== null &&
    'current' in value &&
    typeof (value as ImplantHealthTarget).current === 'number' &&
    'set' in value &&
    typeof (value as ImplantHealthTarget).set === 'function'
  );
}

function isStatsList(value: unknown): value is readonly Stats[] {
  return Array.isArray(value);
}

/**
 * Zarządza posiadanymi implantami w pokoju i runie (F3-09, ADR 0005 pkt 4 i 6).
 * Nakłada modyfikatory ze źródłem `implant:<id>` na wskazane instancje `Stats`,
 * pilnuje unikalności, obsługuje łańcuchy `upgradesTo`, koryguje bieżące zdrowie
 * przy wzroście `maxHealth` i emituje `implant_acquired`.
 */
export class ImplantSystem {
  private readonly statsList: readonly Stats[];
  private readonly health?: ImplantHealthTarget;
  private readonly bus?: EventBus;
  private readonly definitions: ReadonlyMap<string, ImplantDefinition>;
  private readonly onChange?: () => void;
  private readonly ownedIds: string[] = [];

  constructor(
    statsOrOptions: Stats | readonly Stats[] | ImplantSystemOptions,
    optionsOrHealth?: Omit<ImplantSystemOptions, 'stats'> | ImplantHealthTarget,
    bus?: EventBus,
    definitions?:
      ReadonlyMap<string, ImplantDefinition> | readonly ImplantDefinition[],
  ) {
    if (statsOrOptions instanceof Stats || isStatsList(statsOrOptions)) {
      this.statsList = isStatsList(statsOrOptions)
        ? [...statsOrOptions]
        : [statsOrOptions];
      if (isHealthTarget(optionsOrHealth)) {
        this.health = optionsOrHealth;
        this.bus = bus;
        this.definitions = toDefinitionsMap(definitions);
      } else {
        const opts = optionsOrHealth ?? {};
        this.health = opts.health;
        this.bus = opts.bus ?? bus;
        this.definitions = toDefinitionsMap(opts.definitions ?? definitions);
        this.onChange = opts.onChange;
      }
    } else {
      const opts = statsOrOptions;
      this.statsList = opts.stats
        ? isStatsList(opts.stats)
          ? [...opts.stats]
          : [opts.stats]
        : [];
      this.health = opts.health;
      this.bus = opts.bus;
      this.definitions = toDefinitionsMap(opts.definitions);
      this.onChange = opts.onChange;
    }
  }

  /** Czy implant o podanym id jest aktualnie założony. */
  has(id: string): boolean {
    return this.ownedIds.includes(id);
  }

  /** Zwraca definicję implantu ze słownika. */
  get(id: string): ImplantDefinition | undefined {
    return this.definitions.get(id);
  }

  /** Kopia id założonych implantów w kolejności nabycia. */
  ids(): string[] {
    return [...this.ownedIds];
  }

  /** Definicje aktualnie założonych implantów w kolejności nabycia. */
  list(): ImplantDefinition[] {
    return this.ownedIds.map((id) => this.definitions.get(id)!);
  }

  /**
   * Wszystkie tagi aktywnych implantów (z zachowaniem krotności wystąpień dla progów `requiresCount` w F3-10).
   */
  tags(): string[] {
    return this.list().flatMap((implant) => implant.tags);
  }

  /** Wyzwalacze aktywnych implantów (dla `SynergySystem` w F3-10). */
  triggers(): { implantId: string; trigger: ImplantTrigger }[] {
    const result: { implantId: string; trigger: ImplantTrigger }[] = [];
    for (const implant of this.list()) {
      for (const trigger of implant.triggers ?? []) {
        result.push({ implantId: implant.id, trigger });
      }
    }
    return result;
  }

  /**
   * Zakłada implant o podanym id:
   * - odrzuca duplikaty (zwraca false),
   * - rzuca błąd dla nieznanego id,
   * - nakłada modyfikatory ze źródłem `implant:<id>` na wszystkie instancje `Stats`,
   * - przy wzroście `maxHealth` dodaje różnicę do bieżącego zdrowia,
   * - emituje `implant_acquired`.
   */
  add(id: string, source: ImplantAcquireSource = 'reward'): boolean {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Nieznany implant: ${id}`);
    if (this.ownedIds.includes(id)) return false;

    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;

    this.ownedIds.push(id);
    this.applyModifiers(definition);
    this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();

    this.bus?.emit('implant_acquired', {
      id: definition.id,
      rarity: definition.rarity,
      source,
    });
    return true;
  }

  /**
   * Zdejmuje implant i jego modyfikatory ze wszystkich instancji `Stats` po źródle `implant:<id>`.
   * Zwraca false, jeśli implant nie był założony.
   */
  remove(id: string): boolean {
    const index = this.ownedIds.indexOf(id);
    if (index < 0) return false;

    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;

    this.ownedIds.splice(index, 1);
    this.removeModifiers(id);
    this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();
    return true;
  }

  /**
   * Ustawia pełny zestaw aktywnych implantów (usuwa duplikaty z wejścia,
   * zdejmuje poprzednie modyfikatory i nakłada nowe). Zwraca tablicę tagów implantów.
   */
  set(ids: readonly string[], options: ImplantSetOptions = {}): string[] {
    const uniqueIds = [...new Set(ids)];
    const defs: ImplantDefinition[] = [];
    for (const id of uniqueIds) {
      const definition = this.definitions.get(id);
      if (!definition) throw new Error(`Nieznany implant pokoju: ${id}`);
      defs.push(definition);
    }

    const prevOwned = new Set(this.ownedIds);
    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;

    for (const oldId of this.ownedIds) this.removeModifiers(oldId);
    this.ownedIds.length = 0;

    for (const definition of defs) {
      this.ownedIds.push(definition.id);
      this.applyModifiers(definition);
    }

    if (options.adjustHealth ?? true)
      this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();

    if (options.emit) {
      const acquireSource = options.source ?? 'reward';
      for (const definition of defs) {
        if (!prevOwned.has(definition.id)) {
          this.bus?.emit('implant_acquired', {
            id: definition.id,
            rarity: definition.rarity,
            source: acquireSource,
          });
        }
      }
    }

    return this.tags();
  }

  /** Zwraca docelową definicję ulepszenia posiadanego implantu (null, jeśli nie można ulepszyć). */
  upgradeTarget(id: string): ImplantDefinition | null {
    if (!this.ownedIds.includes(id)) return null;
    const fromDef = this.definitions.get(id);
    if (!fromDef?.upgradesTo) return null;
    const toDef = this.definitions.get(fromDef.upgradesTo);
    if (!toDef)
      throw new Error(
        `Nieznany implant docelowy upgradesTo: ${fromDef.upgradesTo} (w ${fromDef.id})`,
      );
    const expected = nextRarity(fromDef.rarity);
    if (expected === null || toDef.rarity !== expected)
      throw new Error(
        `Niepoprawna rzadkość upgradesTo dla ${fromDef.id}: oczekiwano ${expected ?? 'brak'}, otrzymano ${toDef.rarity}`,
      );
    if (this.ownedIds.includes(toDef.id)) return null;
    return toDef;
  }

  /** Czy posiadany implant może zostać ulepszony do `upgradesTo`. */
  canUpgrade(id: string): boolean {
    return this.upgradeTarget(id) !== null;
  }

  /**
   * Zastępuje posiadany implant jego ulepszeniem `upgradesTo` (o jedną rzadkość wyżej),
   * aktualizując modyfikatory na `Stats`, zdrowie oraz emitując `implant_acquired` ze źródłem `'upgrade'`.
   */
  upgrade(id: string): boolean {
    const toDef = this.upgradeTarget(id);
    if (!toDef) return false;
    const index = this.ownedIds.indexOf(id);
    if (index < 0) return false;

    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;

    this.removeModifiers(id);
    this.ownedIds[index] = toDef.id;
    this.applyModifiers(toDef);
    this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();

    this.bus?.emit('implant_acquired', {
      id: toDef.id,
      rarity: toDef.rarity,
      source: 'upgrade',
    });
    return true;
  }

  /** Zdejmuje wszystkie implanty i ich modyfikatory ze `Stats`. */
  clear(): void {
    if (this.ownedIds.length === 0) return;
    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;
    for (const id of this.ownedIds) this.removeModifiers(id);
    this.ownedIds.length = 0;
    this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();
  }

  /** Alias `clear()` dla spójności z innymi systemami. */
  reset(): void {
    this.clear();
  }

  private applyModifiers(definition: ImplantDefinition): void {
    const source = implantSource(definition.id);
    for (const stats of this.statsList) {
      for (const modifier of definition.modifiers) {
        stats.add({ ...modifier, source });
      }
    }
  }

  private removeModifiers(id: string): void {
    const source = implantSource(id);
    for (const stats of this.statsList) {
      stats.removeBySource(source);
    }
  }

  private readMaxHealth(): number {
    for (const stats of this.statsList) {
      const value = stats.get('maxHealth');
      if (value > 0) return value;
    }
    return this.statsList[0]?.get('maxHealth') ?? 0;
  }

  private adjustHealthForMaxChange(prevMax: number, prevCurrent: number): void {
    if (!this.health) return;
    const nextMax = this.readMaxHealth();
    const delta = nextMax - prevMax;
    if (delta > 0) {
      if (!this.health.dead && prevCurrent > 0)
        this.health.set(Math.min(nextMax, prevCurrent + delta));
    } else if (delta < 0) {
      this.health.set(Math.min(prevCurrent, nextMax));
    }
  }
}
