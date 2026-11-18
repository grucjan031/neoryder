export const SIM_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
const TIME_EPSILON_MS = 1e-9;

export interface LoopCallbacks {
  step(dt: number, tick: number): void;
  render(alpha: number, frameDt: number): void;
}

export interface Clock {
  now(): number;
}

export interface FrameScheduler {
  request(cb: (timeMs: number) => void): number;
  cancel(id: number): void;
}

export class GameLoop {
  private isPaused = false;

  get paused(): boolean {
    return this.isPaused;
  }

  set paused(value: boolean) {
    if (value === this.isPaused) return;
    this.isPaused = value;
    // Ukryta karta może nie dostać ani jednej klatki przed wznowieniem.
    this.lastMs = this.clock.now();
  }
  timeScale = 1;
  private ticks = 0;
  private accumulator = 0;
  private hitstopMs = 0;
  private running = false;
  private frameId: number | undefined;
  private lastMs = 0;
  private readonly clock: Clock;
  private readonly scheduler: FrameScheduler;
  private readonly maxSteps: number;

  constructor(
    private readonly cb: LoopCallbacks,
    opts: {
      clock?: Clock;
      scheduler?: FrameScheduler;
      /** Limit kroków na klatkę; większy tylko dla testów na wolnym renderze (`fx=lite`). */
      maxStepsPerFrame?: number;
    } = {},
  ) {
    this.maxSteps = Math.max(
      1,
      Math.floor(opts.maxStepsPerFrame ?? MAX_STEPS_PER_FRAME),
    );
    this.clock = opts.clock ?? { now: () => performance.now() };
    this.scheduler = opts.scheduler ?? {
      request: (callback) => requestAnimationFrame(callback),
      cancel: (id) => cancelAnimationFrame(id),
    };
  }

  get tick(): number {
    return this.ticks;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastMs = this.clock.now();
    this.frameId = this.scheduler.request(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.frameId !== undefined) this.scheduler.cancel(this.frameId);
    this.frameId = undefined;
  }

  private readonly frame = (): void => {
    if (!this.running) return;
    const now = this.clock.now();
    this.advance(now - this.lastMs);
    this.lastMs = now;
    if (this.running) this.frameId = this.scheduler.request(this.frame);
  };

  hitstop(ms: number): void {
    if (Number.isFinite(ms)) this.hitstopMs = Math.max(this.hitstopMs, ms, 0);
  }

  advance(realMs: number): number {
    const frameMs = Number.isFinite(realMs) ? Math.max(0, realMs) : 0;
    if (this.paused) {
      this.cb.render(this.accumulator / SIM_DT, frameMs / 1000);
      return 0;
    }
    // Hitstop zużywa czas rzeczywisty, także czas odrzucony przez limit kroków.
    const previousAccumulator = this.accumulator;
    this.accumulator += frameMs / 1000;
    let steps = 0;
    let consumedMs = 0;
    while (this.accumulator >= SIM_DT && steps < this.maxSteps) {
      const boundaryMs = ((steps + 1) * SIM_DT - previousAccumulator) * 1000;
      const frozen = this.hitstopMs > TIME_EPSILON_MS;
      this.hitstopMs = Math.max(0, this.hitstopMs - (boundaryMs - consumedMs));
      consumedMs = boundaryMs;
      this.cb.step(frozen ? 0 : SIM_DT * this.timeScale, ++this.ticks);
      this.accumulator -= SIM_DT;
      steps++;
    }
    this.hitstopMs = Math.max(
      0,
      this.hitstopMs - Math.max(0, frameMs - consumedMs),
    );
    if (steps === this.maxSteps) this.accumulator %= SIM_DT;
    this.cb.render(this.accumulator / SIM_DT, frameMs / 1000);
    return steps;
  }
}
