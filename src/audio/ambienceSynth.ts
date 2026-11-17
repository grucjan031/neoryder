import { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { AmbienceKind } from './ambienceSchema';
import type { AudioBackend } from './synth';

export interface AmbienceGraph {
  gain: GainNode;
  pan: StereoPannerNode;
  dispose(): void;
}

/** Bufory i grafy współdzielą kontekst AudioSystem; brak timerów i własnego zegara. */
export class AmbienceSynth {
  private readonly buffers = new Map<AmbienceKind, AudioBuffer>();

  constructor(
    private readonly ctx: AudioBackend,
    private readonly noise: AudioBuffer,
    private readonly t: Tuning['audio'],
    private readonly rng: Rng,
  ) {}

  create(
    kind: AmbienceKind | 'train',
    out: AudioNode,
    hub?: Tuning['hub'],
  ): AmbienceGraph {
    const { ctx, t } = this;
    const nodes: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const gain = ctx.createGain();
    const pan = ctx.createStereoPanner();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.connect(pan);
    pan.connect(out);
    nodes.push(gain, pan);
    const layer = (
      wave: OscillatorType | 'noise' | 'buffer',
      hz: number,
      filterType: BiquadFilterType,
      filterHz: number,
      level = 1,
      q = t.ambienceFilterQ,
    ): void => {
      let source: OscillatorNode | AudioBufferSourceNode;
      if (wave === 'noise' || wave === 'buffer') {
        source = ctx.createBufferSource();
        source.buffer =
          wave === 'buffer' && kind !== 'train'
            ? this.buffer(kind)
            : this.noise;
        source.loop = true;
      } else {
        source = ctx.createOscillator();
        source.type = wave;
        source.frequency.setValueAtTime(hz, ctx.currentTime);
      }
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterHz, ctx.currentTime);
      filter.Q.setValueAtTime(q, ctx.currentTime);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(
        level *
          (1 -
            (kind === 'purr' ? t.ambiencePurrDepth / 2 : t.ambienceLfoDepth)),
        ctx.currentTime,
      );
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(
        kind === 'purr'
          ? t.ambiencePurrPulseHz
          : t.ambienceLfoHz *
              this.rng.float(t.ambienceLfoRateMin, t.ambienceLfoRateMax),
        ctx.currentTime,
      );
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(
        level *
          (kind === 'purr' ? t.ambiencePurrDepth / 2 : t.ambienceLfoDepth),
        ctx.currentTime,
      );
      lfo.connect(depth);
      depth.connect(amp.gain);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(gain);
      source.start();
      lfo.start();
      sources.push(source, lfo);
      nodes.push(source, filter, amp, lfo, depth);
    };
    if (kind === 'train' && hub) {
      layer('noise', 0, 'lowpass', hub.trainFilterHz);
      layer(
        'sine',
        hub.trainLowHz,
        'lowpass',
        hub.trainFilterHz,
        hub.trainToneGain,
      );
    } else if (kind !== 'train') {
      const p = t.ambienceProfiles[kind];
      switch (kind) {
        case 'purr':
          layer('noise', 0, 'lowpass', p.filterHz);
          break;
        case 'generator':
          layer('sawtooth', p.toneHz, 'lowpass', p.filterHz);
          break;
        case 'screens':
          layer('square', p.toneHz, 'lowpass', p.filterHz);
          break;
        case 'steam':
        case 'cooking':
          layer('noise', 0, 'highpass', p.filterHz);
          break;
        case 'crowd':
          for (const hz of [
            t.ambienceCrowdBands.lowHz,
            t.ambienceCrowdBands.midHz,
            t.ambienceCrowdBands.highHz,
          ])
            layer(
              'noise',
              0,
              'bandpass',
              hz,
              t.ambienceCrowdBands.gain,
              t.ambienceCrowdBands.q,
            );
          break;
        case 'radio':
          layer('buffer', 0, 'bandpass', p.filterHz);
          break;
        case 'fire':
          layer(
            'noise',
            0,
            'lowpass',
            t.ambienceFireBodyHz,
            t.ambienceFireBodyGain,
          );
          layer('buffer', 0, 'highpass', p.filterHz);
          break;
        case 'drip':
        case 'jukebox':
          layer('buffer', 0, 'lowpass', p.filterHz);
          break;
      }
    }
    let disposed = false;
    return {
      gain,
      pan,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        for (const source of sources) source.stop();
        for (const node of nodes) node.disconnect();
      },
    };
  }

  private buffer(kind: AmbienceKind): AudioBuffer {
    const cached = this.buffers.get(kind);
    if (cached) return cached;
    const { t, ctx } = this;
    const rng = this.rng.fork(kind);
    const beatS = 60 / t.ambienceJukeboxBpm;
    const barS = beatS * t.ambienceJukeboxBeatsPerBar;
    const duration =
      kind === 'jukebox' ? barS * t.ambienceJukeboxBars : t.ambienceLoopS;
    const length = Math.max(1, Math.ceil(duration * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    if (kind === 'jukebox') {
      // Oryginalna fraza bez melodii: osiem taktów basu i minorowych padów.
      const roots = t.ambienceJukeboxRoots;
      for (let i = 0; i < length; i++) {
        const time = i / ctx.sampleRate;
        const root =
          t.ambienceJukeboxRootHz *
          2 ** (roots[Math.floor(time / barS) % roots.length]! / 12);
        const beat = (time % beatS) / beatS;
        const padEnv = Math.sin((Math.PI * (time % barS)) / barS) ** 2;
        let pad = 0;
        for (const semitone of t.ambienceJukeboxChordSemitones)
          pad += Math.sin(
            2 * Math.PI * root * 2 ** (semitone / 12) * (time % barS),
          );
        data[i] =
          t.ambienceJukeboxBassGain *
            Math.sin(2 * Math.PI * root * (time % beatS)) *
            Math.sin(Math.PI * beat) *
            Math.exp(-t.ambienceJukeboxBassDecay * beat) +
          t.ambienceJukeboxPadGain * pad * padEnv;
      }
    } else {
      for (let i = 0; i < length; i++)
        data[i] =
          (rng.next() * 2 - 1) *
          (kind === 'drip'
            ? 0
            : kind === 'fire'
              ? t.ambienceFireNoiseFloorGain
              : t.ambienceNoiseFloorGain);
      let time = 0;
      while (time < duration) {
        const drip = kind === 'drip';
        const span = drip
          ? t.ambienceDripDecayS * t.ambiencePulseDecay
          : kind === 'fire'
            ? t.ambienceFireCrackleS
            : t.ambienceRadioToneS;
        for (let j = 0; j < span * ctx.sampleRate; j++) {
          const index = Math.floor(time * ctx.sampleRate) + j;
          if (index >= length) break;
          const age = j / ctx.sampleRate;
          const env =
            Math.sin((Math.PI * age) / span) *
            Math.exp((-t.ambiencePulseDecay * age) / span);
          const value = drip
            ? Math.sin(2 * Math.PI * t.ambienceDripHz * age)
            : kind === 'fire'
              ? (rng.next() * 2 - 1) * t.ambienceFireCrackleGain
              : Math.sin(2 * Math.PI * t.ambienceRadioToneHz * age) *
                t.ambienceRadioToneGain;
          data[index]! += value * env;
        }
        time += drip
          ? rng.float(t.ambienceDripMinS, t.ambienceDripMaxS)
          : -Math.log(Math.max(Number.EPSILON, rng.next())) /
            (kind === 'fire'
              ? t.ambienceFireCrackleRate
              : t.ambienceRadioToneRate);
      }
      // Gładka spoina zapętlenia.
      for (let i = 0; i < length; i++)
        data[i]! *= Math.min(
          1,
          i / ctx.sampleRate / t.ambienceFireCrackleS,
          (length - 1 - i) / ctx.sampleRate / t.ambienceFireCrackleS,
        );
    }
    this.buffers.set(kind, buffer);
    return buffer;
  }
}
