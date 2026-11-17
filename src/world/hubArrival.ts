import type { Vec3 } from '../core/math';
import type { MetaState } from '../core/metaTypes';
import { Rng } from '../core/rng';
import type { NpcLine, NpcText } from './hubNpcs';
import type { HubNpcDef } from './hubSchema';

export type HubArrivalKind = 'firstVisit' | 'victory' | 'death';
export interface HubArrivalContext {
  kind: HubArrivalKind;
  key: string;
}
export interface HubGreetings {
  last(): string | null;
  mark(key: string): void;
}

export function hubArrivalContext(
  meta: Pick<MetaState, 'stats' | 'lastRuns'>,
  greeted: string | null,
): HubArrivalContext | null {
  const last = meta.lastRuns[0];
  const context: HubArrivalContext | null =
    meta.stats.runs === 0
      ? { kind: 'firstVisit', key: 'first-visit' }
      : last
        ? { kind: last.outcome, key: last.runId }
        : null;
  return context?.key === greeted ? null : context;
}

/** Stan jednej wizyty, niezależny od pamięci przeglądarki i zwykłych kwestii NPC. */
export class HubArrival {
  private readonly reacted = new Set<string>();
  private readonly greeter: NpcText | null;
  private greetedNpc: string | null = null;

  constructor(
    private readonly context: HubArrivalContext,
    private readonly texts: readonly NpcText[],
    npcs: readonly HubNpcDef[],
    spawn: Vec3,
  ) {
    let nearestDistance = Infinity;
    this.greeter = null;
    for (const npc of npcs) {
      const text = texts.find(({ id }) => id === npc.id);
      if (!text?.reactions?.[context.kind]) continue;
      const distance = Math.hypot(
        npc.position.x - spawn.x,
        (npc.position.y ?? 0) - spawn.y,
        npc.position.z - spawn.z,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        this.greeter = text;
      }
    }
  }

  get state() {
    return {
      ...this.context,
      greetedNpc: this.greetedNpc,
      reacted: [...this.reacted],
    };
  }

  private greetingText(npc: NpcText): string {
    return new Rng(`${this.context.key}:${npc.id}`).pick(
      npc.reactions![this.context.kind]!,
    );
  }

  greet(): NpcLine | null {
    if (!this.greeter || this.greetedNpc) return null;
    this.greetedNpc = this.greeter.id;
    return this.line(this.greeter, this.greetingText(this.greeter));
  }

  react(id: string): NpcLine | null {
    if (this.reacted.has(id)) return null;
    const npc = this.texts.find((entry) => entry.id === id);
    const reactions = npc?.reactions?.[this.context.kind];
    if (!npc || !reactions) return null;
    this.reacted.add(id);
    const greeting = this.greetingText(npc);
    const choices =
      this.greeter?.id === id && reactions.length > 1
        ? reactions.filter((text) => text !== greeting)
        : reactions;
    const text = new Rng(`${this.context.key}:${id}`).pick(
      choices.length > 0 ? choices : reactions,
    );
    return this.line(npc, text);
  }

  private line(npc: NpcText, text: string): NpcLine {
    return { id: npc.id, name: npc.name, role: npc.role, line: text };
  }
}
