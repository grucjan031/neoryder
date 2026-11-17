import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';

/** Zegar symulacji; render i audio jedynie odczytują postęp. */
export class HubTrain {
  private remainingS: number;
  private ageS: number | null = null;
  private peaked = false;

  constructor(
    private readonly rng: Rng,
    private readonly t: Tuning['hub'],
    private readonly bus: EventBus,
  ) {
    this.remainingS = rng.float(t.trainFirstS.min, t.trainFirstS.max);
  }

  get progress(): number | null {
    return this.ageS === null
      ? null
      : Math.min(1, this.ageS / this.t.trainDurationS);
  }

  /** Odstęp liczony od początku przejazdu, także po komendzie debug. */
  force(): void {
    this.ageS = 0;
    this.peaked = false;
    this.remainingS = this.rng.float(
      this.t.trainIntervalS.min,
      this.t.trainIntervalS.max,
    );
    this.bus.emit('hub_train_passed', { durationS: this.t.trainDurationS });
  }

  /** Zwraca true w jednym kroku szczytu przejazdu (emisja pyłu). */
  step(dt: number): boolean {
    if (!(dt > 0) || !Number.isFinite(dt)) return false;
    this.remainingS -= dt;
    if (this.remainingS <= 0) this.force();
    if (this.ageS === null) return false;
    this.ageS += dt;
    let peak = false;
    if (!this.peaked && this.ageS >= this.t.trainDurationS / 2) {
      this.peaked = true;
      peak = true;
      this.bus.emit('camera_shake', {
        intensity: this.t.trainShakeIntensity,
        durationS: this.t.trainShakeS,
        dir: null,
      });
    }
    if (this.ageS >= this.t.trainDurationS) this.ageS = null;
    return peak;
  }
}
