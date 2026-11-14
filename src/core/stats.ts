export const STAT_IDS = [
  'maxHealth',
  'moveSpeed',
  'damage',
  'attackSpeed',
  'maxEnergy',
  'energyRegen',
  'heatCapacity',
  'coolingRate',
  /** Mnożnik otrzymywanych obrażeń; baza zawsze 1 (patrz DamageSystem). Blok = mult 0.3. */
  'damageTaken',
  /** Odnowienie dashu w sekundach; baza z tuning.player.dashCooldownS (synergia „Tancerz ostrzy” = mult < 1). */
  'dashCooldown',
] as const;
export type StatId = (typeof STAT_IDS)[number];
export type ModifierType = 'flat' | 'percent' | 'mult';
export interface StatModifier {
  stat: StatId;
  type: ModifierType;
  value: number;
  source: string;
}

export function computeStat(
  base: number,
  mods: readonly StatModifier[],
): number {
  let flat = 0;
  let percent = 0;
  let mult = 1;
  for (const mod of mods) {
    if (mod.type === 'flat') flat += mod.value;
    if (mod.type === 'percent') percent += mod.value;
    if (mod.type === 'mult') mult *= mod.value;
  }
  return Math.max(0, (base + flat) * (1 + percent) * mult);
}

export class Stats {
  private readonly base: Partial<Record<StatId, number>>;
  private mods: Readonly<StatModifier>[] = [];
  private readonly cache = new Map<StatId, number>();

  constructor(base: Partial<Record<StatId, number>>) {
    this.base = { ...base };
  }
  get(stat: StatId): number {
    let value = this.cache.get(stat);
    if (value === undefined) {
      value = computeStat(this.getBase(stat), this.modifiers(stat));
      this.cache.set(stat, value);
    }
    return value;
  }
  getBase(stat: StatId): number {
    return this.base[stat] ?? 0;
  }
  setBase(stat: StatId, value: number): void {
    this.base[stat] = value;
    this.cache.delete(stat);
  }
  add(mod: StatModifier): void {
    this.mods.push(Object.freeze({ ...mod }));
    this.cache.delete(mod.stat);
  }
  removeBySource(source: string): number {
    const removed = this.mods.filter((mod) => mod.source === source);
    this.mods = this.mods.filter((mod) => mod.source !== source);
    for (const mod of removed) this.cache.delete(mod.stat);
    return removed.length;
  }
  modifiers(stat?: StatId): readonly StatModifier[] {
    return this.mods.filter((mod) => stat === undefined || mod.stat === stat);
  }
}
