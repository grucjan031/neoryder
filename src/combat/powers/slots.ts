import type { InputSnapshot } from '../../core/input';
import type { Power } from './power';

export class PowerSlots {
  private readonly slots: readonly (Power | null)[];

  constructor(slots: readonly (Power | null)[]) {
    this.slots = slots.slice(0, 2);
  }

  get(slot: number): Power | null {
    return this.slots[slot] ?? null;
  }

  step(dt: number, input: InputSnapshot): void {
    for (const [slot, action] of (['power', 'power2'] as const).entries()) {
      this.get(slot)?.step(dt, {
        pressed: input.pressed.has(action),
        held: input.held.has(action),
        released: input.released.has(action),
      });
    }
  }

  reset(): void {
    for (const power of this.slots) power?.reset();
  }
}
