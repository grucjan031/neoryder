import type { SfxLayer } from './sfxSchema';

/** Podzbiór BaseAudioContext używany przez syntezę (atrapa w testach). */
export interface AudioBackend {
  readonly currentTime: number;
  readonly state: string;
  readonly sampleRate: number;
  readonly destination: AudioNode;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  createBiquadFilter(): BiquadFilterNode;
  createBufferSource(): AudioBufferSourceNode;
  createBuffer(
    channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer;
  createStereoPanner(): StereoPannerNode;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

/** Najcichszy poziom dla ramp wykładniczych (nie mogą dojść do 0). */
const SILENCE = 0.0001;

export interface PlayedLayers {
  sources: AudioScheduledSourceNode[];
  /** Czas końca najdłuższej warstwy (czas kontekstu). */
  endTime: number;
}

/**
 * Odtwarza warstwy dźwięku: oscylator lub szum → (filtr) → obwiednia → out.
 * pitch mnoży częstotliwości oscylatorów, filtrów i prędkość szumu.
 */
export function playLayers(
  ctx: AudioBackend,
  out: AudioNode,
  layers: readonly SfxLayer[],
  pitch: number,
  noise: AudioBuffer,
  startAt = ctx.currentTime,
): PlayedLayers {
  const sources: AudioScheduledSourceNode[] = [];
  let endTime = startAt;
  for (const layer of layers) {
    const start = startAt + (layer.delayS ?? 0);
    const end = start + layer.durationS;
    endTime = Math.max(endTime, end);

    let source: AudioScheduledSourceNode;
    if (layer.wave === 'noise') {
      const buffer = ctx.createBufferSource();
      buffer.buffer = noise;
      buffer.loop = true;
      buffer.playbackRate.setValueAtTime(pitch, start);
      source = buffer;
    } else {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      const freq = (layer.freq ?? 440) * pitch;
      osc.frequency.setValueAtTime(freq, start);
      if (layer.freqEnd !== undefined)
        osc.frequency.exponentialRampToValueAtTime(layer.freqEnd * pitch, end);
      source = osc;
    }

    const env = ctx.createGain();
    const attack = Math.min(layer.attackS ?? 0.003, layer.durationS * 0.5);
    env.gain.setValueAtTime(SILENCE, start);
    env.gain.linearRampToValueAtTime(
      Math.max(SILENCE, layer.gain),
      start + attack,
    );
    env.gain.exponentialRampToValueAtTime(SILENCE, end);

    let head: AudioNode = source;
    if (layer.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter.type;
      filter.frequency.setValueAtTime(layer.filter.freq * pitch, start);
      if (layer.filter.freqEnd !== undefined)
        filter.frequency.exponentialRampToValueAtTime(
          layer.filter.freqEnd * pitch,
          end,
        );
      if (layer.filter.q !== undefined)
        filter.Q.setValueAtTime(layer.filter.q, start);
      source.connect(filter);
      head = filter;
    }
    head.connect(env);
    env.connect(out);
    source.start(start);
    source.stop(end + 0.02);
    sources.push(source);
  }
  return { sources, endTime };
}

/** Bufor białego szumu (mono, 1 s) z kosmetycznego generatora. */
export function createNoiseBuffer(
  ctx: AudioBackend,
  random: () => number,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
  return buffer;
}
