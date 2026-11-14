import { PowerBase } from './power';
import type { PowerInput } from './power';
import type { FocusPowerDefinition } from './powerSchema';

export class FocusPower extends PowerBase<FocusPowerDefinition> {
  private remainingS = 0;
  private stopQueued = false;

  override get active(): boolean {
    return this.remainingS > 0;
  }

  override use(): number | null {
    if (this.active) {
      this.end();
      return 0;
    }
    return super.use();
  }

  override step(dt: number, input: PowerInput): void {
    if (input.pressed && this.active) this.stopQueued = true;
    super.step(dt, { ...input, pressed: input.pressed && !this.stopQueued });
    if (dt > 0 && this.stopQueued) {
      this.stopQueued = false;
      if (this.active) this.end();
    }
  }

  protected override get cooldownOnActivation(): boolean {
    return false;
  }

  protected override activate(): number {
    this.remainingS = this.def.durationS;
    this.deps.bus.emit('focus', {
      worldScale: this.def.worldScale,
      durationS: this.def.durationS,
    });
    return 0;
  }

  protected override stepEffect(dt: number): void {
    if (!this.active) return;
    const elapsed = Math.min(dt, this.remainingS);
    const drain = this.def.drainPerS * elapsed;
    if (!this.deps.energy.spend(drain)) {
      this.deps.energy.spend(this.deps.energy.current);
      this.end();
      return;
    }
    this.remainingS = Math.max(0, this.remainingS - elapsed);
    if (this.remainingS <= 1e-9) this.end();
  }

  protected override resetEffect(): void {
    if (this.active) this.emitEnd();
    this.remainingS = 0;
    this.stopQueued = false;
  }

  private end(): void {
    this.remainingS = 0;
    this.startCooldown();
    this.emitEnd();
  }

  private emitEnd(): void {
    this.deps.bus.emit('focus', {
      worldScale: this.def.worldScale,
      durationS: 0,
    });
  }
}
