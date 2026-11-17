import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { NpcConversation } from './hubNpcs';

export interface ChatterLine {
  conversation: string;
  npc: string;
  text: string;
}
interface Conversation {
  def: NpcConversation;
  positions: readonly Vec3[];
  lines: ChatterLine[];
  cooldown: number;
}

/** Deterministyczny zegar rozmów. Pozycje uczestników są referencjami do stanu symulacji. */
export class HubChatter {
  private readonly conversations: Conversation[];
  private active: Conversation | null = null;
  private current: ChatterLine | null = null;
  private lastSpeaker = -1;
  private index = 0;
  private left = 0;
  private gap = false;
  private forced = false;

  constructor(
    defs: readonly NpcConversation[],
    positions: ReadonlyMap<string, Vec3>,
    private readonly tuning: Tuning['hub'],
    private readonly bus?: EventBus,
  ) {
    this.conversations = defs.map((def) => ({
      def,
      positions: def.npcs.map((id) => {
        const position = positions.get(id);
        if (!position)
          throw new Error(`Nieznany NPC w rozmowie ${def.id}: ${id}.`);
        return position;
      }),
      lines: def.lines.map(({ npc, text }) => ({
        conversation: def.id,
        npc,
        text,
      })),
      cooldown: 0,
    }));
  }

  get activeId(): string | null {
    return this.active?.def.id ?? null;
  }

  get line(): ChatterLine | null {
    return this.current;
  }

  interrupt(cooldown = false): void {
    if (cooldown && this.active)
      this.active.cooldown = this.tuning.chatterCooldownS;
    this.active = null;
    this.current = null;
    this.lastSpeaker = -1;
    this.forced = false;
  }

  /**
   * Cel spojrzenia uczestnika podsłuchanej rozmowy wieloosobowej: słuchacz patrzy na mówiącego
   * (także w przerwie między kwestiami), mówiący na najbliższego innego uczestnika.
   * `null` = rozmowa jednoosobowa, powitanie albo NPC spoza rozmowy (patrzy jak dotąd na gracza).
   */
  lookTargetFor(npcId: string): Vec3 | null {
    const entry = this.active;
    if (!entry || entry.positions.length < 2 || this.lastSpeaker < 0)
      return null;
    const own = entry.def.npcs.indexOf(npcId);
    if (own < 0) return null;
    if (own !== this.lastSpeaker) return entry.positions[this.lastSpeaker]!;
    const from = entry.positions[own]!;
    let best: Vec3 | null = null;
    let bestDistance = Infinity;
    for (let i = 0; i < entry.positions.length; i++) {
      if (i === own) continue;
      const other = entry.positions[i]!;
      const distance = Math.hypot(other.x - from.x, other.z - from.z);
      if (distance < bestDistance) {
        best = other;
        bestDistance = distance;
      }
    }
    return best;
  }

  force(id: string): boolean {
    const entry = this.conversations.find(({ def }) => def.id === id);
    if (!entry) return false;
    this.start(entry, true);
    return true;
  }

  say(line: ChatterLine): void {
    this.start(
      {
        def: {
          id: line.conversation,
          npcs: [line.npc],
          lines: [{ npc: line.npc, text: line.text }],
        },
        positions: [],
        lines: [line],
        cooldown: 0,
      },
      true,
    );
  }

  private distance(entry: Conversation, player: Vec3): number {
    let x = 0,
      z = 0;
    for (const position of entry.positions) {
      x += position.x;
      z += position.z;
    }
    return Math.hypot(
      player.x - x / entry.positions.length,
      player.z - z / entry.positions.length,
    );
  }

  private start(entry: Conversation, forced: boolean): void {
    this.active = entry;
    this.forced = forced;
    this.index = 0;
    this.showLine();
  }

  private showLine(): void {
    this.current = this.active!.lines[this.index]!;
    this.lastSpeaker = this.active!.def.npcs.indexOf(this.current.npc);
    this.gap = false;
    this.left =
      this.tuning.chatterLineBaseS +
      this.tuning.chatterLineCharS * this.current.text.length;
    this.bus?.emit('hub_chatter_line', this.current);
  }

  step(dt: number, player: Vec3, blocked: boolean): void {
    if (!(dt > 0)) return;
    for (const entry of this.conversations)
      entry.cooldown = Math.max(0, entry.cooldown - dt);
    if (blocked) {
      this.interrupt();
      return;
    }
    if (!this.active) {
      let nearest: Conversation | null = null;
      let nearestDistance = Infinity;
      for (const entry of this.conversations) {
        if (entry.cooldown > 0) continue;
        const distance = this.distance(entry, player);
        if (
          distance <= (entry.def.radiusM ?? this.tuning.chatterRadiusM) &&
          distance < nearestDistance
        ) {
          nearest = entry;
          nearestDistance = distance;
        }
      }
      if (nearest) this.start(nearest, false);
      return;
    }
    if (
      !this.forced &&
      this.distance(this.active, player) >
        (this.active.def.radiusM ?? this.tuning.chatterRadiusM) +
          this.tuning.chatterExitMarginM
    ) {
      this.interrupt();
      return;
    }
    let remaining = dt;
    while (this.active && remaining >= this.left) {
      remaining -= this.left;
      if (this.gap) {
        this.index++;
        this.showLine();
      } else if (this.index === this.active.lines.length - 1) {
        this.active.cooldown = this.tuning.chatterCooldownS;
        this.interrupt();
      } else {
        this.current = null;
        this.gap = true;
        this.left = this.tuning.chatterGapS;
      }
    }
    if (this.active) this.left -= remaining;
  }
}
