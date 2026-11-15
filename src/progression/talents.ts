import type { DefinitionPatch, TreeId } from '../core/metaTypes';
import type { Stats, StatModifier } from '../core/stats';
import type { ImplantHealthTarget } from './implants';
import type { ImplantTrigger } from './implantSchema';
import { talentTrees } from './talentSchema';
import type { TalentNode, TalentTree } from './talentSchema';

export const TALENT_SOURCE_PREFIX = 'talent:';

/** Źródło modyfikatora dla `Stats` (`talent:<id>`). */
export function talentSource(id: string): string {
  return `${TALENT_SOURCE_PREFIX}${id}`;
}

export interface TalentTrigger {
  talentId: string;
  trigger: ImplantTrigger;
}

/** Zsumowane efekty zestawu talentów (ADR 0007 pkt 4). */
export interface ResolvedTalents {
  modifiers: StatModifier[];
  triggers: TalentTrigger[];
  tags: string[];
  /** Łatki posortowane po id węzła, w węźle wg tablicy. */
  patches: DefinitionPatch[];
  runStartCredits: number;
}

function nodeIndex(
  trees: ReadonlyMap<TreeId, TalentTree>,
): Map<string, TalentNode> {
  const index = new Map<string, TalentNode>();
  for (const tree of trees.values())
    for (const node of tree.nodes) index.set(node.id, node);
  return index;
}

/**
 * Składa efekty talentów. Węzły są przetwarzane w kolejności posortowanych id
 * (determinizm); powtórzone id liczą się raz, nieznany id to błąd.
 */
export function resolveTalents(
  ids: readonly string[],
  trees: ReadonlyMap<TreeId, TalentTree> = talentTrees,
): ResolvedTalents {
  const index = nodeIndex(trees);
  const result: ResolvedTalents = {
    modifiers: [],
    triggers: [],
    tags: [],
    patches: [],
    runStartCredits: 0,
  };
  for (const id of [...new Set(ids)].sort()) {
    const node = index.get(id);
    if (!node) throw new Error(`Nieznany talent: ${id}`);
    const { effects } = node;
    for (const modifier of effects.modifiers ?? [])
      result.modifiers.push({ ...modifier, source: talentSource(id) });
    for (const trigger of effects.triggers ?? [])
      result.triggers.push({ talentId: id, trigger });
    result.tags.push(...(effects.tags ?? []));
    result.patches.push(...(effects.patches ?? []));
    result.runStartCredits += effects.runStart?.credits ?? 0;
  }
  return result;
}

export interface TalentSystemOptions {
  /** Ma być ta sama para instancji `Stats` co u `ImplantSystem`. */
  stats?: Stats | readonly Stats[];
  health?: ImplantHealthTarget;
  trees?: ReadonlyMap<TreeId, TalentTree>;
  onChange?: () => void;
}

/**
 * Talenty w pokoju (ADR 0007 pkt 4): nakłada i zdejmuje modyfikatory ze źródłem
 * `talent:<id>` na podane instancje `Stats` i udostępnia tagi oraz wyzwalacze
 * dla `SynergySystem`. Łatki stosuje się przy budowie ekwipunku (`resolveLoadout`).
 */
export class TalentSystem {
  private readonly statsList: readonly Stats[];
  private readonly health?: ImplantHealthTarget;
  private readonly trees: ReadonlyMap<TreeId, TalentTree>;
  private readonly onChange?: () => void;
  private readonly ownedIds: string[] = [];

  constructor(options: TalentSystemOptions = {}) {
    const { stats } = options;
    this.statsList = stats ? (Array.isArray(stats) ? [...stats] : [stats]) : [];
    this.health = options.health;
    this.trees = options.trees ?? talentTrees;
    this.onChange = options.onChange;
  }

  has(id: string): boolean {
    return this.ownedIds.includes(id);
  }

  /** Id aktywnych talentów w kolejności nabycia. */
  ids(): string[] {
    return [...this.ownedIds];
  }

  tags(): string[] {
    return this.resolved().tags;
  }

  triggers(): TalentTrigger[] {
    return this.resolved().triggers;
  }

  patches(): DefinitionPatch[] {
    return this.resolved().patches;
  }

  /** Dodaje talent; false dla duplikatu, błąd dla nieznanego id. */
  add(id: string, options: { adjustHealth?: boolean } = {}): boolean {
    if (this.ownedIds.includes(id)) return false;
    const node = this.nodeOf(id);
    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;
    this.ownedIds.push(id);
    this.applyModifiers(node);
    if (options.adjustHealth ?? true)
      this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();
    return true;
  }

  /** Zastępuje cały zestaw talentów (zdejmuje stare modyfikatory, nakłada nowe). */
  set(ids: readonly string[], options: { adjustHealth?: boolean } = {}): void {
    const unique = [...new Set(ids)];
    const nodes = unique.map((id) => this.nodeOf(id));
    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;
    for (const id of this.ownedIds) this.removeModifiers(id);
    this.ownedIds.length = 0;
    for (const node of nodes) {
      this.ownedIds.push(node.id);
      this.applyModifiers(node);
    }
    if (options.adjustHealth ?? true)
      this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();
  }

  /** Zdejmuje wszystkie talenty i ich modyfikatory po źródle. */
  clear(): void {
    if (this.ownedIds.length === 0) return;
    const prevMax = this.readMaxHealth();
    const prevCurrent = this.health?.current ?? 0;
    for (const id of this.ownedIds) this.removeModifiers(id);
    this.ownedIds.length = 0;
    this.adjustHealthForMaxChange(prevMax, prevCurrent);
    this.onChange?.();
  }

  private resolved(): ResolvedTalents {
    return resolveTalents(this.ownedIds, this.trees);
  }

  private nodeOf(id: string): TalentNode {
    const node = nodeIndex(this.trees).get(id);
    if (!node) throw new Error(`Nieznany talent: ${id}`);
    return node;
  }

  private applyModifiers(node: TalentNode): void {
    const source = talentSource(node.id);
    for (const stats of this.statsList)
      for (const modifier of node.effects.modifiers ?? [])
        stats.add({ ...modifier, source });
  }

  private removeModifiers(id: string): void {
    const source = talentSource(id);
    for (const stats of this.statsList) stats.removeBySource(source);
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
