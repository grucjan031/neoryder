import type { EventBus } from './events';
import { SIM_DT } from './loop';
import type { GameLoop } from './loop';
import type { Tuning } from './tuning';

type LoopControl = Pick<GameLoop, 'hitstop' | 'paused' | 'timeScale'>;

interface Slowmo {
  scale: number;
  /** Pozostały czas pełnego spowolnienia (s, czas rzeczywisty). */
  holdS: number;
}

/** Skupienie (F2-06): czy gracz jest teraz wyjęty spod spowolnienia świata. */
export interface FocusControl {
  readonly focusActive: boolean;
}

/**
 * Jedyny właściciel czasu gry (ADR 0003 pkt 5): hitstop i spowolnienia.
 * Systemy walki tylko emitują zdarzenia `hitstop`, `slowmo`, `wave_last_kill`.
 * Spowolnienie liczy czas rzeczywisty (update z frameDt), więc 0,3 s to 0,3 s dla gracza.
 * Po spowolnieniu skala czasu wraca płynnie do `baseTimeScale` w `slowmoRecoverS`.
 */
export class FeelSystem implements FocusControl {
  /** Skala czasu poza efektami (komenda debug `timescale` zmienia ją, nie loop.timeScale). */
  baseTimeScale = 1;
  /** Skala czasu gracza w Skupieniu względem czasu rzeczywistego (1 = normalnie). */
  playerTimeScale = 1;
  private slowmo: Slowmo | null = null;
  private recover: { from: number; t: number } | null = null;
  /** Pozostały czas Skupienia (s, czas rzeczywisty); po nim powrót świata też nie spowalnia gracza. */
  private focusHoldS = 0;
  private focusRecover = false;
  private focusHitstopS = 0;
  private readonly off: (() => void)[] = [];

  constructor(
    bus: EventBus,
    private readonly loop: LoopControl,
    private readonly tuning: Tuning,
  ) {
    this.off.push(
      bus.on('hitstop', ({ ms }) => {
        // Pauza ma pierwszeństwo — hitstop nałożony w pauzie "zjadłby" pierwsze klatki po wznowieniu.
        if (!this.loop.paused && Number.isFinite(ms) && ms > 0) {
          this.loop.hitstop(ms);
          this.focusHitstopS = Math.max(this.focusHitstopS, ms / 1000);
        }
      }),
      bus.on('slowmo', ({ timeScale, durationS }) =>
        this.startSlowmo(timeScale, durationS),
      ),
      bus.on('focus', ({ worldScale, durationS }) =>
        this.startFocus(worldScale, durationS),
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

  /** Skupienie aktywne: świat zwalnia, gracz (playerDt) porusza się w czasie rzeczywistym. */
  get focusActive(): boolean {
    return this.focusHoldS > 0 || this.focusRecover;
  }

  /**
   * dt gracza (ruch, ostrze, broń, moce, energia) dla kroku świata `dtSim`. Poza Skupieniem = dtSim.
   * W Skupieniu: dtSim / skala świata × playerTimeScale, najwyżej SIM_DT × 2; hitstop (0) zostaje 0.
   */
  playerDt(dtSim: number): number {
    if (!(dtSim > 0)) return 0;
    if (!this.focusActive) return dtSim;
    const world = Math.max(this.loop.timeScale, 1e-3);
    return Math.min((dtSim / world) * this.playerTimeScale, SIM_DT * 2);
  }

  /** `durationS` ≤ 0 kończy Skupienie (np. brak energii) i zaczyna powrót świata. */
  startFocus(worldScale: number, durationS: number): void {
    if (!(durationS > 0)) {
      if (this.focusHoldS <= 0) return;
      this.focusHoldS = 0;
      this.focusRecover = true;
      if (this.slowmo) this.slowmo.holdS = 0;
      return;
    }
    if (!(worldScale > 0)) return;
    this.focusHoldS = Math.max(this.focusHoldS, durationS);
    this.focusRecover = false;
    this.startSlowmo(worldScale, durationS);
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
    // GameLoop nie udostępnia zegara hitstopu; śledzimy te same zdarzenia.
    const focusDt = Math.max(0, Math.min(frameDt - this.focusHitstopS, dt));
    this.focusHitstopS = Math.max(0, this.focusHitstopS - frameDt);
    const holdDt = this.focusHoldS > 0 ? focusDt : dt;
    if (this.focusHoldS > 0) {
      this.focusHoldS = Math.max(0, this.focusHoldS - holdDt);
      if (this.focusHoldS === 0) this.focusRecover = true;
    }
    if (this.slowmo) {
      this.slowmo.holdS -= holdDt;
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
      if (this.recover.t >= 1) {
        this.recover = null;
        this.focusRecover = false;
      }
      return;
    }
    this.focusRecover = false;
    this.apply(this.baseTimeScale);
  }

  /** Reset przy zmianie sceny. */
  reset(): void {
    this.slowmo = null;
    this.recover = null;
    this.focusHoldS = 0;
    this.focusRecover = false;
    this.focusHitstopS = 0;
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
