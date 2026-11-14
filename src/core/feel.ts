import type { EventBus } from './events';
import type { GameLoop } from './loop';
import type { Tuning } from './tuning';

type LoopControl = Pick<GameLoop, 'hitstop' | 'paused' | 'timeScale'>;

interface Slowmo {
  scale: number;
  /** Pozostały czas pełnego spowolnienia (s, czas rzeczywisty). */
  holdS: number;
}

/**
 * Jedyny właściciel czasu gry (ADR 0003 pkt 5): hitstop i spowolnienia.
 * Systemy walki tylko emitują zdarzenia `hitstop`, `slowmo`, `wave_last_kill`.
 * Spowolnienie liczy czas rzeczywisty (update z frameDt), więc 0,3 s to 0,3 s dla gracza.
 * Po spowolnieniu skala czasu wraca płynnie do `baseTimeScale` w `slowmoRecoverS`.
 */
export class FeelSystem {
  /** Skala czasu poza efektami (komenda debug `timescale` zmienia ją, nie loop.timeScale). */
  baseTimeScale = 1;
  private slowmo: Slowmo | null = null;
  private recover: { from: number; t: number } | null = null;
  private readonly off: (() => void)[] = [];

  constructor(
    bus: EventBus,
    private readonly loop: LoopControl,
    private readonly tuning: Tuning,
  ) {
    this.off.push(
      bus.on('hitstop', ({ ms }) => {
        // Pauza ma pierwszeństwo — hitstop nałożony w pauzie "zjadłby" pierwsze klatki po wznowieniu.
        if (!this.loop.paused && ms > 0) this.loop.hitstop(ms);
      }),
      bus.on('slowmo', ({ timeScale, durationS }) =>
        this.startSlowmo(timeScale, durationS),
      ),
      bus.on('wave_last_kill', () =>
        this.startSlowmo(
          this.tuning.time.lastKillTimeScale,
          this.tuning.time.lastKillSlowmoS,
        ),
      ),
    );
    this.apply(this.baseTimeScale);
  }

  /** Bieżąca docelowa skala (do testów i HUD debug). */
  get timeScale(): number {
    return this.loop.timeScale;
  }

  startSlowmo(scale: number, durationS: number): void {
    if (!(scale > 0) || !(durationS > 0)) return;
    const current = this.slowmo;
    // Kumulacja: mocniejsze spowolnienie wygrywa, czas trwania jako max.
    this.slowmo = {
      scale: current ? Math.min(current.scale, scale) : scale,
      holdS: current ? Math.max(current.holdS, durationS) : durationS,
    };
    this.recover = null;
    this.apply(this.slowmo.scale);
  }

  /** Woła main.ts co klatkę z czasem rzeczywistym. */
  update(frameDt: number): void {
    const dt = Math.max(0, Math.min(frameDt, 0.25));
    if (this.loop.paused || dt === 0) return;
    if (this.slowmo) {
      this.slowmo.holdS -= dt;
      if (this.slowmo.holdS <= 0) {
        this.recover = { from: this.slowmo.scale, t: 0 };
        this.slowmo = null;
      } else {
        this.apply(this.slowmo.scale);
        return;
      }
    }
    if (this.recover) {
      const span = Math.max(1e-3, this.tuning.time.slowmoRecoverS);
      this.recover.t = Math.min(1, this.recover.t + dt / span);
      // Wygładzone wyjście (ease-in) — czas „przyspiesza” z powrotem.
      const k = this.recover.t * this.recover.t;
      this.apply(
        this.recover.from + (this.baseTimeScale - this.recover.from) * k,
      );
      if (this.recover.t >= 1) this.recover = null;
      return;
    }
    this.apply(this.baseTimeScale);
  }

  /** Reset przy zmianie sceny. */
  reset(): void {
    this.slowmo = null;
    this.recover = null;
    this.apply(this.baseTimeScale);
  }

  private apply(scale: number): void {
    this.loop.timeScale = scale;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.reset();
  }
}
