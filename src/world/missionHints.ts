import type { HintEvent, MissionHint } from './missionSchema';

/** Czas, kolejka i postęp dotyczą jednej próby. Historia wyświetleń przychodzi z profilu. */
export class MissionHints {
  private clock = 0;
  private nextAt = 0;
  private until = 0;
  private queue: { hint: MissionHint; at: number }[] = [];
  private counts = new Map<HintEvent, number>();
  readonly seen: Set<string>;
  current: MissionHint | null = null;

  constructor(
    private readonly hints: readonly MissionHint[],
    seen: readonly string[] = [],
  ) {
    this.seen = new Set(seen);
  }

  trigger(trigger: string): void {
    for (const hint of this.hints) {
      if (
        hint.trigger === trigger &&
        !this.seen.has(hint.id) &&
        !this.done(hint) &&
        !this.queue.some((entry) => entry.hint === hint)
      )
        this.queue.push({ hint, at: this.clock + hint.delayS });
    }
  }

  event(event: HintEvent): void {
    this.counts.set(event, (this.counts.get(event) ?? 0) + 1);
    if (this.current && this.done(this.current)) this.hide();
    this.trigger(`event:${event}`);
  }

  step(dt: number): void {
    if (dt <= 0) return;
    this.clock += dt;
    if (this.current && this.clock >= this.until) this.hide();
    if (this.current || this.clock < this.nextAt) return;
    while (this.queue.length && this.queue[0]!.at <= this.clock) {
      const { hint } = this.queue.shift()!;
      if (this.done(hint)) continue;
      this.current = hint;
      this.seen.add(hint.id);
      this.until = this.clock + hint.timeoutS;
      break;
    }
  }

  clear(): void {
    this.queue = [];
    if (this.current) this.hide();
  }

  private done(hint: MissionHint): boolean {
    return (
      hint.doneOn?.some(
        ({ event, count }) => (this.counts.get(event) ?? 0) >= count,
      ) ?? false
    );
  }

  private hide(): void {
    this.current = null;
    this.nextAt = this.clock + 0.6;
  }
}
