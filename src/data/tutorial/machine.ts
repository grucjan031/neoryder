import type { EventType, GameEvents } from '../../core/events';
import type { Vec3 } from '../../core/math';
import type { TutorialCondition, TutorialStep } from './schema';

/** Czysty stan ćwiczenia. Zdarzenia tylko oznaczają gotowość, host zatwierdza po ticku. */
export class TutorialMachine {
  private index = 0;
  private counts: number[] = [];
  private overheated = false;
  private cooled = false;
  private readonly reached = new Set<number>();
  private swing: GameEvents['melee_swing']['stage'] | null = null;
  private hitThisSwing = false;
  private restart = false;

  constructor(readonly steps: readonly TutorialStep[]) {
    if (!steps.length) throw new Error('Samouczek wymaga kroków.');
    this.goTo(1);
  }
  get number(): number {
    return this.index + 1;
  }
  get current(): TutorialStep {
    return this.steps[this.index]!;
  }
  get finished(): boolean {
    return this.current.complete;
  }

  goTo(number: number): boolean {
    if (!Number.isInteger(number) || number < 1 || number > this.steps.length)
      return false;
    this.index = number - 1;
    this.counts = this.conditions().map(() => 0);
    this.overheated = this.cooled = this.restart = this.hitThisSwing = false;
    this.reached.clear();
    this.swing = null;
    return true;
  }
  private conditions(): TutorialCondition[] {
    return [this.current.condition, ...this.current.requires];
  }
  event<K extends EventType>(name: K, payload: GameEvents[K]): void {
    if (this.finished) return;
    const data = payload as unknown as Record<string, unknown>;
    if (name === 'player_died' && this.current.restartOnDeath)
      this.restart = true;
    if (name === 'heat_changed') {
      if (data.overheated === true) this.overheated = true;
      if (this.overheated && data.overheated === false && data.current === 0)
        this.cooled = true;
    }
    if (name === 'melee_swing') {
      this.swing = data.stage as GameEvents['melee_swing']['stage'];
      this.hitThisSwing = false;
      if (
        this.current.condition.kind === 'event' &&
        this.current.condition.combo &&
        this.swing === 1
      )
        this.counts[0] = 0;
    }
    this.conditions().forEach((condition, index) => {
      if (condition.kind !== 'event' || condition.event !== name) return;
      if (
        condition.tags &&
        (!Array.isArray(data.tags) ||
          !condition.tags.every((tag) =>
            (data.tags as unknown[]).includes(tag),
          ))
      )
        return;
      if (
        name === 'damage_dealt' &&
        !(typeof data.amount === 'number' && data.amount > 0)
      )
        return;
      if (condition.double !== undefined && data.double !== condition.double)
        return;
      if (condition.held !== undefined && data.held !== condition.held) return;
      if (condition.combo) {
        if (this.hitThisSwing || this.swing !== (this.counts[index] ?? 0) + 1)
          return;
        this.hitThisSwing = true;
      }
      this.counts[index] = (this.counts[index] ?? 0) + 1;
    });
  }
  position(
    feet: Vec3,
    grounded: boolean,
    tolerance: number,
    sliding = false,
  ): void {
    this.conditions().forEach((c, index) => {
      if (c.kind !== 'reach_marker' && c.kind !== 'land_on') return;
      const reached =
        Math.hypot(feet.x - c.position.x, feet.z - c.position.z) <= c.radius &&
        Math.abs(feet.y - c.position.y) <= tolerance &&
        (c.kind !== 'land_on' || grounded) &&
        (c.kind !== 'reach_marker' ||
          c.sliding === undefined ||
          c.sliding === sliding);
      if (reached) this.reached.add(index);
      else if (index === 0) this.reached.delete(index);
    });
  }
  /** Śmierć ma pierwszeństwo przed zaliczeniem ostatniego trafienia w tej samej klatce. */
  flush(): 'advance' | 'restart' | null {
    if (this.restart) {
      this.goTo(this.number);
      return 'restart';
    }
    if (
      this.finished ||
      !this.conditions().every((c, index) =>
        c.kind === 'event'
          ? (this.counts[index] ?? 0) >= c.count
          : c.kind === 'heat_overheated'
            ? this.cooled
            : this.reached.has(index),
      )
    )
      return null;
    if (!this.goTo(this.number + 1)) return null;
    return 'advance';
  }
}
