import type { Vec3 } from '../core/math';
import { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import { spatialize } from './audioSystem';
import type { Listener } from './audioSystem';
import type { AmbienceSource } from './ambienceSchema';
import { AmbienceSynth } from './ambienceSynth';
import type { AmbienceGraph } from './ambienceSynth';
import type { AudioBackend } from './synth';

/** Smoothstep do dokładnego zera na granicy zasięgu, także w osi Y. */
export function ambienceAttenuation(
  position: Vec3,
  listener: Vec3,
  radiusM: number,
): number {
  if (!(radiusM > 0)) return 0;
  const d = Math.min(
    1,
    Math.hypot(
      position.x - listener.x,
      position.y - listener.y,
      position.z - listener.z,
    ) / radiusM,
  );
  return (1 - d) ** 2 * (1 + 2 * d);
}

export function selectAmbience(
  sources: readonly AmbienceSource[],
  listener: Vec3,
  maxActive: number,
): number[] {
  return sources
    .map((source, index) => ({
      index,
      distance: Math.hypot(
        source.position.x - listener.x,
        source.position.y - listener.y,
        source.position.z - listener.z,
      ),
    }))
    .filter(
      ({ index, distance }) =>
        distance < sources[index]!.radiusM && (sources[index]!.gain ?? 1) > 0,
    )
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, Math.max(0, Math.floor(maxActive)))
    .map(({ index }) => index);
}

/** Źródła zasilane z sieci: przy spadku napięcia cichną proporcjonalnie do poziomu zasilania. */
export const POWERED_AMBIENCE = new Set([
  'generator',
  'screens',
  'jukebox',
  'radio',
]);

export class Ambience {
  private readonly bus: GainNode;
  private readonly synth: AmbienceSynth;
  private readonly graphs = new Map<number, AmbienceGraph>();
  private sources: readonly AmbienceSource[] = [];
  private train: AmbienceGraph | null = null;
  private active: { kind: string; gain: number }[] = [];

  constructor(
    private readonly ctx: AudioBackend,
    master: AudioNode,
    noise: AudioBuffer,
    private readonly t: Tuning['audio'],
    seed: string,
  ) {
    this.bus = ctx.createGain();
    this.bus.connect(master);
    this.synth = new AmbienceSynth(ctx, noise, t, new Rng(seed));
  }

  setSources(sources: readonly AmbienceSource[] | null): void {
    this.stop();
    this.sources = sources ?? [];
  }

  get snapshot(): { kind: string; gain: number }[] {
    return this.active.map((s) => ({ ...s }));
  }

  update(
    listener: Listener | null,
    paused: boolean,
    trainProgress: number | null,
    hub?: Tuning['hub'],
    power = 1,
  ): void {
    const now = this.ctx.currentTime;
    this.bus.gain.setValueAtTime(this.t.ambienceGain, now);
    if (paused || !listener || this.ctx.state !== 'running') {
      this.stop();
      return;
    }
    const selected = selectAmbience(
      this.sources,
      listener.position,
      this.t.ambienceMaxActive,
    );
    for (const [index, graph] of this.graphs)
      if (!selected.includes(index)) {
        graph.dispose();
        this.graphs.delete(index);
      }
    this.active = [];
    for (const index of selected) {
      const source = this.sources[index]!;
      let graph = this.graphs.get(index);
      if (!graph) {
        graph = this.synth.create(
          source.kind,
          this.bus,
          undefined,
          source.track ?? 0,
        );
        this.graphs.set(index, graph);
      }
      const gain =
        (source.gain ?? this.t.ambienceProfiles[source.kind].gain) *
        ambienceAttenuation(
          source.position,
          listener.position,
          source.radiusM,
        ) *
        (POWERED_AMBIENCE.has(source.kind) ? power : 1);
      graph.gain.gain.setValueAtTime(gain, now);
      graph.pan.pan.setValueAtTime(
        spatialize(source.position, listener, this.t.refDistance, this.t.maxPan)
          .pan,
        now,
      );
      this.active.push({ kind: source.kind, gain });
    }
    if (trainProgress !== null && hub) {
      this.train ??= this.synth.create('train', this.bus, hub);
      this.train.gain.gain.setValueAtTime(
        hub.trainGain * Math.sin(Math.PI * trainProgress) ** 2,
        now,
      );
      this.train.pan.pan.setValueAtTime(
        (trainProgress * 2 - 1) * Math.cos(listener.yaw) * this.t.maxPan,
        now,
      );
    } else {
      this.train?.dispose();
      this.train = null;
    }
  }

  private stop(): void {
    for (const graph of this.graphs.values()) graph.dispose();
    this.graphs.clear();
    this.active = [];
    this.train?.dispose();
    this.train = null;
  }

  dispose(): void {
    this.stop();
    this.sources = [];
    this.bus.disconnect();
  }
}
