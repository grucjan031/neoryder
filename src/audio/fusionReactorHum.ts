import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';
import type { Listener } from './audioSystem';
import type { AudioBackend } from './synth';

/** Continuous procedural hum routed through AudioSystem's shared master/SFX bus. */
export class FusionReactorHum {
  private readonly gain: GainNode;
  private readonly pan: StereoPannerNode;
  private readonly filter: BiquadFilterNode;
  private readonly low: OscillatorNode;
  private readonly harmonic: OscillatorNode;
  private readonly air: AudioBufferSourceNode;
  private disposed = false;

  constructor(
    private readonly ctx: AudioBackend,
    out: AudioNode,
    noise: AudioBuffer,
    private readonly position: Vec3,
  ) {
    const t = tuning.render.fusionReactor;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.pan = ctx.createStereoPanner();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(t.humFilterHz, ctx.currentTime);
    this.low = ctx.createOscillator();
    this.low.type = 'sine';
    this.low.frequency.setValueAtTime(t.humHz, ctx.currentTime);
    this.harmonic = ctx.createOscillator();
    this.harmonic.type = 'sine';
    this.harmonic.frequency.setValueAtTime(t.humHz * 1.5, ctx.currentTime);
    this.air = ctx.createBufferSource();
    this.air.buffer = noise;
    this.air.loop = true;
    this.low.connect(this.filter);
    this.harmonic.connect(this.filter);
    this.air.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.pan);
    this.pan.connect(out);
    this.low.start();
    this.harmonic.start();
    this.air.start();
  }

  update(listener: Listener | null, paused: boolean): void {
    if (this.disposed) return;
    const t = tuning.render.fusionReactor;
    const now = this.ctx.currentTime;
    const dx = listener ? this.position.x - listener.position.x : 0;
    const dy = listener ? this.position.y - listener.position.y : 0;
    const dz = listener ? this.position.z - listener.position.z : 0;
    const distance = Math.hypot(dx, dy, dz);
    const attenuation = listener
      ? Math.max(0, 1 - distance / Math.max(0.01, t.humRangeM)) ** 2
      : 1;
    this.gain.gain.setTargetAtTime(
      paused ? 0 : t.humGain * attenuation,
      now,
      0.08,
    );
    const yaw = listener?.yaw ?? 0;
    this.pan.pan.setValueAtTime(
      Math.max(
        -1,
        Math.min(
          1,
          (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(1, distance),
        ),
      ),
      now,
    );
    this.low.frequency.setValueAtTime(t.humHz, now);
    this.harmonic.frequency.setValueAtTime(t.humHz * 1.5, now);
    this.filter.frequency.setValueAtTime(t.humFilterHz, now);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.low.stop();
    this.harmonic.stop();
    this.air.stop();
    this.low.disconnect();
    this.harmonic.disconnect();
    this.air.disconnect();
    this.filter.disconnect();
    this.gain.disconnect();
    this.pan.disconnect();
  }
}
