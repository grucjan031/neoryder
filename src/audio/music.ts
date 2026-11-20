import { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import {
  ALL_MUSIC_LOOPS,
  compileTrack,
  loopSteps,
  stepSeconds,
} from './musicSchema';
import type {
  MusicDefinition,
  MusicEvent,
  MusicLoop,
  MusicLoopId,
  MusicState,
  MusicTrack,
  ToneTrack,
} from './musicSchema';
import { createNoiseBuffer } from './synth';
import type { AudioBackend } from './synth';

/** Wstrzykiwany zegar harmonogramu (testy; domyślnie setInterval). */
export interface MusicTimer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface MusicSystemOptions {
  /** Ten sam kontekst co AudioSystem (null = brak Web Audio). */
  getContext: () => AudioBackend | null;
  tuning: Pick<Tuning, 'audio'>;
  /** Settings.masterVolume (0..1). */
  masterVolume: () => number;
  /** Settings.musicVolume (0..1). */
  musicVolume: () => number;
  seed?: string;
  timer?: MusicTimer;
  /** Wołane na każdym tyknięciu harmonogramu (dyrektor liczy histerezę). */
  onTick?: () => void;
  /** Jak daleko w przód planujemy nuty (s). */
  lookaheadS?: number;
  /** Okres tyknięcia harmonogramu (ms). */
  intervalMs?: number;
}

interface ScheduledEvent {
  track: MusicTrack;
  event: MusicEvent;
}

interface CompiledLoop {
  loop: MusicLoop;
  stepS: number;
  total: number;
  byStep: ScheduledEvent[][];
}

interface Run {
  id: MusicLoopId;
  compiled: CompiledLoop;
  bus: GainNode;
  /** Licznik kroków od startu (modulo długość pętli przy odczycie). */
  step: number;
  /** Czas kontekstu następnego kroku. */
  time: number;
}

const SILENCE = 0.0001;

/**
 * Muzyka syntezowana w locie (S7-02): trzy pętle (calm / combat / boss) opisane danymi
 * (src/data/audio/music.json), harmonogram z wyprzedzeniem na AudioContext.currentTime
 * i crossfade między pętlami. Używa kontekstu AudioSystem; własna szyna idzie wprost do
 * destination (głośność: masterGain × masterVolume × musicVolume × musicGain, bez sfxVolume).
 */
export class MusicSystem {
  private ctx: AudioBackend | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly rng: Rng;
  private readonly compiled = new Map<MusicLoopId, CompiledLoop>();
  private run: Run | null = null;
  private fading: { bus: GainNode; endTime: number }[] = [];
  private wanted: MusicState = 'off';
  private timerHandle: unknown = null;
  private disposed = false;
  /** Liczba zaplanowanych zdarzeń (debug, testy). */
  scheduledEvents = 0;

  constructor(
    private readonly def: MusicDefinition,
    private readonly opts: MusicSystemOptions,
  ) {
    this.rng = new Rng(opts.seed ?? 'music');
    for (const id of ALL_MUSIC_LOOPS) {
      const loop = def.loops[id];
      const total = loopSteps(loop);
      const byStep: ScheduledEvent[][] = Array.from(
        { length: total },
        () => [],
      );
      for (const track of loop.tracks)
        for (const event of compileTrack(loop, track))
          byStep[event.step]?.push({ track, event });
      this.compiled.set(id, { loop, stepS: stepSeconds(loop), total, byStep });
    }
    this.timerHandle = this.timer.set(
      () => this.update(),
      opts.intervalMs ?? 250,
    );
  }

  private get timer(): MusicTimer {
    return (
      this.opts.timer ?? {
        set: (fn, ms) => setInterval(fn, ms),
        clear: (h) => clearInterval(h as ReturnType<typeof setInterval>),
      }
    );
  }

  /** Stan docelowy ('off' = cisza). */
  get state(): MusicState {
    return this.wanted;
  }

  /** Aktualnie grana pętla (null przy ciszy). */
  get playing(): MusicLoopId | null {
    return this.run?.id ?? null;
  }

  /** Przełącza pętlę z crossfade'em. Powtórzenie tego samego stanu nic nie zmienia. */
  setState(state: MusicState): void {
    if (this.disposed || state === this.wanted) return;
    this.wanted = state;
    this.syncRun();
  }

  /** Tyknięcie harmonogramu: głośność, start/stop pętli, planowanie nut, sprzątanie. */
  update(): void {
    if (this.disposed) return;
    this.opts.onTick?.();
    this.syncRun();
    const ctx = this.ctx;
    if (!ctx) return;
    this.updateVolume();
    // Zawieszony kontekst ma zamrożony czas; nuty zaplanowane teraz zagrałyby się naraz po wznowieniu.
    if (ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    this.fading = this.fading.filter((f) => {
      if (f.endTime > now) return true;
      f.bus.disconnect();
      return false;
    });
    const run = this.run;
    if (!run) return;
    const horizon = now + (this.opts.lookaheadS ?? 1.5);
    const lag = now - run.time;
    if (lag > this.opts.tuning.audio.musicMaxCatchUpS) {
      const skipped = Math.floor(
        (lag - this.opts.tuning.audio.musicMaxCatchUpS) / run.compiled.stepS,
      );
      run.step += skipped;
      run.time += skipped * run.compiled.stepS;
    }
    while (run.time < horizon) {
      this.scheduleStep(run);
      run.step++;
      run.time += run.compiled.stepS;
    }
  }

  updateVolume(): void {
    const ctx = this.ctx;
    if (!this.out || !ctx) return;
    const a = this.opts.tuning.audio;
    this.out.gain.setValueAtTime(
      Math.max(
        0,
        a.masterGain *
          this.opts.masterVolume() *
          this.opts.musicVolume() *
          a.musicGain,
      ),
      ctx.currentTime,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timerHandle !== null) {
      this.timer.clear(this.timerHandle);
      this.timerHandle = null;
    }
    const buses = [this.run?.bus, ...this.fading.map((f) => f.bus)];
    this.run = null;
    this.fading = [];
    for (const bus of buses) {
      try {
        bus?.disconnect();
      } catch {
        // Kontekst mógł zostać już zamknięty.
      }
    }
    try {
      const now = this.ctx?.currentTime ?? 0;
      this.out?.gain.cancelScheduledValues(now);
      this.out?.gain.setValueAtTime(0, now);
      this.out?.disconnect();
    } catch {
      // Kontekst mógł zostać już zamknięty.
    }
    this.out = null;
  }

  // ------------------------------------------------------------------ pętle

  private ensureContext(): AudioBackend | null {
    if (this.ctx) return this.ctx;
    const ctx = this.opts.getContext();
    if (!ctx) return null;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    this.noise = createNoiseBuffer(ctx, () => this.rng.next());
    this.updateVolume();
    return ctx;
  }

  /** Doprowadza uruchomioną pętlę do stanu `wanted` (crossfade). */
  private syncRun(): void {
    if (this.wanted === 'off' && !this.run) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.out) return;
    if (this.run && this.run.id === this.wanted) return;
    const now = ctx.currentTime;
    const fade = this.def.fadeS;
    if (this.run) {
      const old = this.run.bus;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + fade);
      this.fading.push({ bus: old, endTime: now + fade + 0.1 });
      this.run = null;
    }
    if (this.wanted === 'off') return;
    const compiled = this.compiled.get(this.wanted);
    if (!compiled) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + fade);
    bus.connect(this.out);
    this.run = { id: this.wanted, compiled, bus, step: 0, time: now + 0.05 };
  }

  private scheduleStep(run: Run): void {
    const hits = run.compiled.byStep[run.step % run.compiled.total];
    if (!hits) return;
    for (const { track, event } of hits) {
      this.playEvent(run, track, event, run.time);
      this.scheduledEvents++;
    }
  }

  private playEvent(
    run: Run,
    track: MusicTrack,
    event: MusicEvent,
    t: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = track.gain * event.vel;
    switch (track.kind) {
      case 'tone':
        this.tone(ctx, run.bus, track, event, t, g, run.compiled.stepS);
        return;
      case 'kick':
        this.kick(ctx, run.bus, t, g);
        return;
      case 'snare':
        this.snare(ctx, run.bus, t, g);
        return;
      case 'hat':
        this.hat(ctx, run.bus, t, g);
        return;
    }
  }

  private tone(
    ctx: AudioBackend,
    bus: AudioNode,
    track: ToneTrack,
    event: MusicEvent,
    t: number,
    g: number,
    stepS: number,
  ): void {
    const attack = track.attackS;
    const end = t + Math.max(event.lenSteps * stepS, attack);
    const stop = end + track.releaseS + 0.05;
    const peak = Math.max(
      SILENCE,
      g / Math.sqrt(event.freqs.length * (track.detuneCents ? 2 : 1)),
    );
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENCE, t);
    env.gain.linearRampToValueAtTime(peak, t + attack);
    env.gain.setValueAtTime(peak, end);
    env.gain.exponentialRampToValueAtTime(SILENCE, end + track.releaseS);
    let head: AudioNode = env;
    if (track.pan !== undefined) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(track.pan, t);
      env.connect(panner);
      head = panner;
    }
    head.connect(bus);
    let input: AudioNode = env;
    if (track.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = track.filter.type;
      filter.frequency.setValueAtTime(track.filter.freq, t);
      if (track.filter.freqEnd !== undefined)
        filter.frequency.exponentialRampToValueAtTime(
          track.filter.freqEnd,
          end,
        );
      if (track.filter.q !== undefined)
        filter.Q.setValueAtTime(track.filter.q, t);
      filter.connect(env);
      input = filter;
    }
    let lastOsc: OscillatorNode | undefined;
    const cents = track.detuneCents ? [0, track.detuneCents] : [0];
    for (const freq of event.freqs) {
      for (const c of cents) {
        const osc = ctx.createOscillator();
        osc.type = track.wave;
        osc.frequency.setValueAtTime(freq, t);
        if (c) osc.detune.setValueAtTime(c, t);
        osc.connect(input);
        osc.start(t);
        osc.stop(stop);
        lastOsc = osc;
      }
    }
    if (lastOsc) {
      const chain = [lastOsc, env, head, input];
      lastOsc.onended = () => {
        for (const node of new Set(chain)) node.disconnect();
      };
    }
  }

  private kick(ctx: AudioBackend, bus: AudioNode, t: number, g: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENCE, t);
    env.gain.linearRampToValueAtTime(Math.max(SILENCE, g), t + 0.004);
    env.gain.exponentialRampToValueAtTime(SILENCE, t + 0.32);
    osc.connect(env);
    env.connect(bus);
    osc.start(t);
    osc.stop(t + 0.35);
    this.disconnectOnEnd(osc, env);
  }

  private snare(ctx: AudioBackend, bus: AudioNode, t: number, g: number): void {
    this.noiseHit(ctx, bus, t, g, 0.17, 'bandpass', 1900, 0.8);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENCE, t);
    env.gain.linearRampToValueAtTime(Math.max(SILENCE, g * 0.5), t + 0.003);
    env.gain.exponentialRampToValueAtTime(SILENCE, t + 0.12);
    osc.connect(env);
    env.connect(bus);
    osc.start(t);
    osc.stop(t + 0.14);
    this.disconnectOnEnd(osc, env);
  }

  private hat(ctx: AudioBackend, bus: AudioNode, t: number, g: number): void {
    this.noiseHit(ctx, bus, t, g, 0.05, 'highpass', 7500, 0.7);
  }

  private noiseHit(
    ctx: AudioBackend,
    bus: AudioNode,
    t: number,
    g: number,
    decay: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
  ): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(q, t);
    const env = ctx.createGain();
    env.gain.setValueAtTime(SILENCE, t);
    env.gain.linearRampToValueAtTime(Math.max(SILENCE, g), t + 0.002);
    env.gain.exponentialRampToValueAtTime(SILENCE, t + decay);
    src.connect(filter);
    filter.connect(env);
    env.connect(bus);
    src.start(t, this.rng.float(0, 0.8));
    src.stop(t + decay + 0.02);
    this.disconnectOnEnd(src, filter, env);
  }

  /** Po zakończeniu źródła odpina jego węzły od szyny (nuty nie zostają w grafie). */
  private disconnectOnEnd(
    source: AudioScheduledSourceNode,
    ...rest: AudioNode[]
  ): void {
    source.onended = () => {
      source.disconnect();
      for (const node of rest) node.disconnect();
    };
  }
}
