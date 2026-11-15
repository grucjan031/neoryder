import { z } from 'zod';
import type { DamageSystem } from '../combat/damage';
import type { StatusApplication } from '../combat/damage/types';
import type { StatusQuery } from '../combat/status';
import { statusDefinitions } from '../combat/status/statusSchema';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import { STAT_IDS } from '../core/stats';
import type { Stats } from '../core/stats';

/** Tag obrażeń zadawanych przez synergie — zdarzenia z nim nigdy nie wyzwalają synergii (brak pętli). */
export const SYNERGY_TAG = '#synergy';

const tag = z.string().min(1);
const positive = z.number().finite().positive();

export const SYNERGY_EVENTS = [
  'enemy_killed',
  'damage_dealt',
  'parry_success',
  'power_used',
  'projectile_reflected',
  'dash_used',
] as const;
export type SynergyEvent = (typeof SYNERGY_EVENTS)[number];

export const effectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('heal'), amount: positive }),
  z.object({
    kind: z.literal('explode'),
    at: z.enum(['target', 'user']),
    radiusM: positive,
    damage: z.number().finite().nonnegative(),
    knockback: z.number().finite().nonnegative().optional(),
    tags: z.array(tag),
  }),
  z.object({
    kind: z.literal('apply_status_area'),
    at: z.enum(['target', 'user']),
    radiusM: z.number().finite().nonnegative(),
    status: tag.refine((id) => statusDefinitions.has(id), 'Nieznany status'),
    durationS: positive,
    stacks: z.number().int().min(1).optional(),
  }),
  z.object({ kind: z.literal('add_energy'), amount: z.number().finite() }),
  z.object({
    kind: z.literal('cool_weapon'),
    amount: z.union([z.number().finite().positive(), z.literal('full')]),
  }),
  z.object({
    kind: z.literal('stat_modifier_timed'),
    stat: z.enum(STAT_IDS),
    type: z.enum(['flat', 'percent', 'mult']),
    value: z.number().finite(),
    durationS: positive,
  }),
  z.object({
    kind: z.literal('chain_on_hit'),
    jumpRangeM: positive,
    damageMult: z.number().finite().nonnegative(),
    tags: z.array(tag),
  }),
]);
export type SynergyEffect = z.infer<typeof effectSchema>;

export const whenSchema = z
  .object({
    event: z.enum(SYNERGY_EVENTS),
    /** Tagi zdarzenia (enemy_killed, damage_dealt): wystarczy jeden. */
    tagsAny: z.array(tag).min(1).optional(),
    /** Status celu zdarzenia (enemy_killed, damage_dealt). */
    targetStatus: tag.optional(),
    targetIsUser: z.boolean().optional(),
  })
  .superRefine((when, ctx) => {
    if (when.targetIsUser !== undefined && when.event !== 'damage_dealt')
      ctx.addIssue({
        code: 'custom',
        message: 'targetIsUser tylko przy damage_dealt',
      });
  });
export type SynergyWhen = z.infer<typeof whenSchema>;

/** Definicja synergii z src/data/synergies/*.json. Liczby balansu tylko tutaj. */
export const synergySchema = z
  .object({
    id: tag,
    /** Nazwa w UI (pl). */
    name: tag,
    /** Wszystkie tagi muszą być w tagach ekwipunku. */
    requires: z.array(tag),
    /** F3: opcjonalny próg liczby wystąpień tagów (np. { "#melee": 2 }). */
    requiresCount: z.record(tag, z.number().int().min(1)).optional(),
    when: whenSchema,
    effects: z.array(effectSchema).min(1),
    cooldownS: positive.optional(),
  })
  .superRefine((def, ctx) => {
    const { event, tagsAny, targetStatus } = def.when;
    const hasTarget = event === 'enemy_killed' || event === 'damage_dealt';
    if (!hasTarget && def.effects.some((e) => 'at' in e && e.at === 'target'))
      ctx.addIssue({
        code: 'custom',
        message: "at: 'target' wymaga zdarzenia z celem",
      });
    if (!hasTarget && (tagsAny || targetStatus))
      ctx.addIssue({
        code: 'custom',
        message: `tagsAny i targetStatus tylko dla enemy_killed i damage_dealt (event: ${event})`,
      });
    if (
      event !== 'damage_dealt' &&
      def.effects.some((e) => e.kind === 'chain_on_hit')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'chain_on_hit tylko przy damage_dealt',
      });
  });
export type SynergyDefinition = z.infer<typeof synergySchema>;

export function loadSynergyDefinitions(
  raws: readonly unknown[],
): SynergyDefinition[] {
  const defs: SynergyDefinition[] = [];
  const ids = new Set<string>();
  for (const raw of raws) {
    const def = synergySchema.parse(raw);
    if (ids.has(def.id)) throw new Error(`Powtórzona synergia: ${def.id}`);
    ids.add(def.id);
    defs.push(def);
  }
  return defs;
}

const files = import.meta.glob<unknown>('../data/synergies/*.json', {
  eager: true,
  import: 'default',
});
export const synergyDefinitions: readonly SynergyDefinition[] =
  loadSynergyDefinitions(Object.values(files));

/** Wszystko, czego synergie potrzebują od sceny. */
export interface SynergyContext {
  user: EntityId;
  addEnergy(n: number): void;
  coolWeapon(amount: number | 'full'): void;
  stats: Stats;
  damage: Pick<DamageSystem, 'deal'>;
  statuses?: StatusQuery;
  targets(): readonly EntityId[];
  position(id: EntityId): Vec3 | null;
  heal?(amount: number): void;
  userPosition?(): Vec3 | null;
  applyStatus?(target: EntityId, app: StatusApplication): void;
}

interface EventFacts {
  source?: EntityId | null;
  tags?: readonly string[];
  target?: EntityId;
  damage?: number;
}

type TimedEffect = Extract<SynergyEffect, { kind: 'stat_modifier_timed' }>;
interface TimedEntry {
  effect: TimedEffect;
  remainingS: number;
}

/**
 * Synergie buildów (F2-16): dane na tagach, wykonawca słucha EventBus (jak AudioSystem).
 * Czas (modyfikatory czasowe, odnowienia) liczony w step(dt) — czasie symulacji.
 */
export class SynergySystem {
  private tags = new Map<string, number>();
  private implantTriggers: SynergyDefinition[] = [];
  private readonly cooldowns = new Map<string, number>();
  private readonly timed = new Map<string, TimedEntry[]>();
  private readonly off: (() => void)[];

  constructor(
    private readonly bus: EventBus,
    private readonly ctx: SynergyContext,
    private readonly defs: readonly SynergyDefinition[] = synergyDefinitions,
  ) {
    const user = ctx.user;
    this.off = [
      bus.on('enemy_killed', (e) => {
        if (e.killer === user)
          this.fire('enemy_killed', { tags: e.tags, target: e.id });
      }),
      bus.on('damage_dealt', (e) => {
        if (e.source === user || e.target === user)
          this.fire('damage_dealt', {
            source: e.source,
            tags: e.tags,
            target: e.target,
            damage: e.amount,
          });
      }),
      bus.on('parry_success', () => this.fire('parry_success', {})),
      bus.on('power_used', (e) => {
        if (e.user === user) this.fire('power_used', {});
      }),
      bus.on('projectile_reflected', (e) => {
        if (e.newOwner === user) this.fire('projectile_reflected', {});
      }),
      bus.on('dash_used', (e) => {
        if (e.user === user) this.fire('dash_used', {});
      }),
    ];
  }

  setTags(tags: readonly string[]): void {
    this.tags.clear();
    for (const tag of tags) this.tags.set(tag, (this.tags.get(tag) ?? 0) + 1);
  }

  setImplantTriggers(
    entries: readonly {
      implantId: string;
      trigger: {
        when: SynergyWhen;
        effects: SynergyEffect[];
        cooldownS?: number;
      };
    }[],
  ): void {
    const counts = new Map<string, number>();
    const next = entries.map(({ implantId, trigger }) => {
      const index = counts.get(implantId) ?? 0;
      counts.set(implantId, index + 1);
      return {
        ...trigger,
        id: `implant:${implantId}:${index}`,
        name: implantId,
        requires: [],
      };
    });
    const ids = new Set(next.map((def) => def.id));
    for (const def of this.implantTriggers) {
      if (ids.has(def.id)) continue;
      this.cooldowns.delete(def.id);
      this.timed.delete(def.id);
      this.rebuildModifiers(def.id);
    }
    this.implantTriggers = next;
  }

  /** Id synergii, których `requires` zawierają się w tagach ekwipunku. */
  active(): string[] {
    return this.defs.filter((d) => this.isActive(d)).map((d) => d.id);
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const [id, left] of [...this.cooldowns]) {
      if (left - dt <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, left - dt);
    }
    for (const [id, entries] of [...this.timed]) {
      for (const entry of entries) entry.remainingS -= dt;
      const alive = entries.filter((entry) => entry.remainingS > 0);
      if (alive.length === entries.length) continue;
      if (alive.length > 0) this.timed.set(id, alive);
      else this.timed.delete(id);
      this.rebuildModifiers(id);
    }
  }

  reset(): void {
    for (const id of [...this.timed.keys()]) {
      this.timed.delete(id);
      this.rebuildModifiers(id);
    }
    this.cooldowns.clear();
  }

  dispose(): void {
    for (const off of this.off) off();
    this.off.length = 0;
    this.reset();
  }

  private isActive(def: SynergyDefinition): boolean {
    return (
      def.requires.every((t) => this.tags.has(t)) &&
      Object.entries(def.requiresCount ?? {}).every(
        ([tag, count]) => (this.tags.get(tag) ?? 0) >= count,
      )
    );
  }

  private fire(event: SynergyEvent, facts: EventFacts): void {
    if (facts.tags?.includes(SYNERGY_TAG)) return;
    for (const def of [...this.defs, ...this.implantTriggers]) {
      if (def.when.event !== event || !this.isActive(def)) continue;
      if (this.cooldowns.has(def.id)) continue;
      if (!this.matches(def, facts)) continue;
      // Wyzwolenie liczy się tylko, gdy choć jeden efekt zadziałał (np. łańcuch bez celu — nie).
      let applied = false;
      for (const effect of def.effects)
        applied = this.apply(def, effect, facts) || applied;
      if (!applied) continue;
      if (def.cooldownS !== undefined)
        this.cooldowns.set(def.id, def.cooldownS);
      this.bus.emit('synergy_triggered', {
        synergy: def.id,
        user: this.ctx.user,
      });
    }
  }

  private matches(def: SynergyDefinition, facts: EventFacts): boolean {
    if (def.when.event === 'damage_dealt') {
      if (def.when.targetIsUser === true) {
        if (facts.target !== this.ctx.user) return false;
      } else if (facts.source !== this.ctx.user) return false;
    }
    const { tagsAny, targetStatus } = def.when;
    if (tagsAny && !tagsAny.some((t) => facts.tags?.includes(t))) return false;
    if (targetStatus) {
      if (facts.target === undefined || !this.ctx.statuses) return false;
      if (!this.ctx.statuses.has(facts.target, targetStatus)) return false;
    }
    return true;
  }

  private apply(
    def: SynergyDefinition,
    effect: SynergyEffect,
    facts: EventFacts,
  ): boolean {
    switch (effect.kind) {
      case 'heal':
        if (!this.ctx.heal) return false;
        this.ctx.heal(effect.amount);
        return true;
      case 'explode':
      case 'apply_status_area':
        return this.area(effect, facts);
      case 'add_energy':
        this.ctx.addEnergy(effect.amount);
        return true;
      case 'cool_weapon':
        this.ctx.coolWeapon(effect.amount);
        return true;
      case 'stat_modifier_timed': {
        const entries = (this.timed.get(def.id) ?? []).filter(
          (entry) => entry.effect !== effect,
        );
        entries.push({ effect, remainingS: effect.durationS });
        this.timed.set(def.id, entries);
        this.rebuildModifiers(def.id);
        return true;
      }
      case 'chain_on_hit':
        return this.chain(effect, facts);
    }
  }

  private area(
    effect: Extract<SynergyEffect, { kind: 'explode' | 'apply_status_area' }>,
    facts: EventFacts,
  ): boolean {
    if (effect.kind === 'apply_status_area' && !this.ctx.applyStatus)
      return false;
    const application =
      effect.kind === 'apply_status_area'
        ? {
            id: effect.status,
            durationS: effect.durationS,
            stacks: effect.stacks,
          }
        : null;
    if (effect.kind === 'apply_status_area' && effect.radiusM === 0) {
      if (facts.target === undefined || !application) return false;
      this.ctx.applyStatus?.(facts.target, application);
      return true;
    }
    const origin =
      effect.at === 'user'
        ? this.ctx.userPosition?.()
        : facts.target === undefined
          ? null
          : this.ctx.position(facts.target);
    if (!origin) return false;
    // Kopia pozycji i listy: obrażenia mogą synchronicznie usunąć wroga.
    const point = { ...origin };
    const targets = [...this.ctx.targets()];
    let applied = false;
    for (const target of targets) {
      const position = this.ctx.position(target);
      if (!position) continue;
      const x = position.x - point.x;
      const y = position.y - point.y;
      const z = position.z - point.z;
      const distance = Math.hypot(x, y, z);
      if (distance > effect.radiusM) continue;
      if (effect.kind === 'explode') {
        this.ctx.damage.deal(target, {
          amount: effect.damage,
          source: this.ctx.user,
          tags: [...effect.tags, SYNERGY_TAG],
          point,
          dir:
            distance > 0
              ? { x: x / distance, y: y / distance, z: z / distance }
              : { x: 0, y: 0, z: 0 },
          knockback: effect.knockback,
        });
      } else if (application) {
        this.ctx.applyStatus?.(target, application);
        applied = true;
      }
    }
    if (effect.kind === 'explode') {
      this.bus.emit('explosion', {
        point,
        radiusM: effect.radiusM,
        owner: this.ctx.user,
        tags: [...effect.tags, SYNERGY_TAG],
      });
      return true;
    }
    return applied;
  }

  private chain(
    effect: Extract<SynergyEffect, { kind: 'chain_on_hit' }>,
    facts: EventFacts,
  ): boolean {
    if (facts.target === undefined) return false;
    const origin = this.ctx.position(facts.target);
    if (!origin) return false;
    let best: EntityId | null = null;
    let bestD = effect.jumpRangeM;
    for (const id of this.ctx.targets()) {
      if (id === facts.target || id === this.ctx.user) continue;
      const p = this.ctx.position(id);
      if (!p) continue;
      const d = Math.hypot(p.x - origin.x, p.y - origin.y, p.z - origin.z);
      if (d <= bestD) {
        best = id;
        bestD = d;
      }
    }
    if (best === null) return false;
    this.ctx.damage.deal(best, {
      amount: (facts.damage ?? 0) * effect.damageMult,
      source: this.ctx.user,
      tags: [...effect.tags, SYNERGY_TAG],
    });
    return true;
  }

  /** Zdejmuje i zakłada od nowa modyfikatory synergii wg aktywnych wpisów (odświeżenie bez kumulacji). */
  private rebuildModifiers(id: string): void {
    const source = `synergy:${id}`;
    this.ctx.stats.removeBySource(source);
    for (const { effect } of this.timed.get(id) ?? [])
      this.ctx.stats.add({
        stat: effect.stat,
        type: effect.type,
        value: effect.value,
        source,
      });
  }
}
