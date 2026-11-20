import type { Vec3 } from '../core/math';
import type { MetaState } from '../core/metaTypes';
import { Rng } from '../core/rng';
import type { NpcLine, NpcText } from './hubNpcs';
import type { HubNpcDef } from './hubSchema';

export type HubArrivalKind = 'firstVisit' | 'victory' | 'death';
export interface HubArrivalContext {
  kind: HubArrivalKind;
  key: string;
  /** Ukończona misja, z której wracamy (tylko `victory`); wybiera `reactions.afterMission`. */
  missionId?: string;
}

/** Pula reakcji NPC: przy powrocie z misji wpis `afterMission` zastępuje ogólne `victory`. */
export function reactionPool(
  npc: NpcText | undefined,
  context: HubArrivalContext,
): readonly string[] | undefined {
  const reactions = npc?.reactions;
  if (context.kind === 'victory' && context.missionId) {
    const specific = reactions?.afterMission?.[context.missionId];
    if (specific) return specific;
  }
  return reactions?.[context.kind];
}
export interface HubGreetings {
  last(): string | null;
  mark(key: string): void;
}

export function hubArrivalContext(
  meta: Pick<MetaState, 'stats' | 'lastRuns' | 'campaign'>,
  greeted: string | null,
): HubArrivalContext | null {
  const last = meta.lastRuns[0];
  const context: HubArrivalContext | null =
    meta.stats.runs === 0
      ? { kind: 'firstVisit', key: 'first-visit' }
      : last
        ? { kind: last.outcome, key: last.runId }
        : null;
  const missionId = meta.campaign.pendingDebrief;
  if (
    context?.kind === 'victory' &&
    missionId &&
    meta.campaign.completed.includes(missionId)
  )
    context.missionId = missionId;
  return context?.key === greeted ? null : context;
}

/** Stan jednej wizyty, niezależny od pamięci przeglądarki i zwykłych kwestii NPC. */
export class HubArrival {
  private readonly reacted = new Set<string>();
  private readonly greeter: NpcText | null;
  private greetedNpc: string | null = null;
  private readonly eligible = new Set<string>();

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
      if (!text || !reactionPool(text, context)) continue;
      this.eligible.add(npc.id);
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
      pending: [...this.eligible].filter((id) => !this.reacted.has(id)),
    };
  }

  /** Czy NPC ma jeszcze niewykorzystaną reakcję w tej wizycie (bez alokacji; używane co klatkę). */
  isPending(id: string): boolean {
    return this.eligible.has(id) && !this.reacted.has(id);
  }

  private greetingText(npc: NpcText): string {
    return new Rng(`${this.context.key}:${npc.id}`).pick(
      reactionPool(npc, this.context)!,
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
    const reactions = reactionPool(npc, this.context);
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
