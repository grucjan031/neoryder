import { loadSettings } from '../core/save';

/** Dźwięki interfejsu: krótkie, proceduralne (WebAudio), bez plików. */
export type UiSoundName =
  'hover' | 'confirm' | 'back' | 'tab' | 'error' | 'purchase';

interface Note {
  wave: OscillatorType;
  from: number;
  to?: number;
  durationS: number;
  gain: number;
  delayS?: number;
}

const recipes: Record<UiSoundName, readonly Note[]> = {
  hover: [
    { wave: 'square', from: 1900, to: 1500, durationS: 0.018, gain: 0.3 },
  ],
  confirm: [
    { wave: 'triangle', from: 660, durationS: 0.07, gain: 0.8 },
    { wave: 'triangle', from: 990, durationS: 0.1, gain: 0.7, delayS: 0.05 },
  ],
  back: [{ wave: 'triangle', from: 560, to: 380, durationS: 0.11, gain: 0.7 }],
  tab: [{ wave: 'sine', from: 1200, to: 1500, durationS: 0.05, gain: 0.7 }],
  error: [
    { wave: 'sawtooth', from: 200, durationS: 0.09, gain: 0.5 },
    { wave: 'sawtooth', from: 150, durationS: 0.14, gain: 0.5, delayS: 0.09 },
  ],
  purchase: [
    { wave: 'triangle', from: 880, durationS: 0.06, gain: 0.7 },
    { wave: 'triangle', from: 1175, durationS: 0.06, gain: 0.7, delayS: 0.06 },
    { wave: 'triangle', from: 1760, durationS: 0.16, gain: 0.7, delayS: 0.12 },
  ],
};

/** Zbyt gęste tiki (np. przeciągnięcie myszy po liście) zlewają się w szum. */
const MIN_REPEAT_S: Record<UiSoundName, number> = {
  hover: 0.045,
  confirm: 0.06,
  back: 0.06,
  tab: 0.05,
  error: 0.12,
  purchase: 0.2,
};
const BASE_GAIN = 0.12;

export interface UiAudioContext {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: AudioNode;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export interface UiSoundsOptions {
  createContext?: () => UiAudioContext | null;
  /** Mnożnik głośności 0..1 (domyślnie ustawienia: główna × dźwięki interfejsu). */
  volume?: () => number;
}

export class UiSounds {
  private ctx: UiAudioContext | null = null;
  private readonly last = new Map<UiSoundName, number>();
  private unlockCleanup: (() => void) | null = null;

  constructor(private readonly options: UiSoundsOptions = {}) {}

  private volume(): number {
    if (this.options.volume) return this.options.volume();
    const settings = loadSettings();
    return settings.masterVolume * settings.uiVolume;
  }

  private context(): UiAudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx =
        this.options.createContext?.() ??
        (typeof AudioContext === 'undefined' ? null : new AudioContext());
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  /** Odblokowanie audio po pierwszej interakcji (polityka autoodtwarzania przeglądarek). */
  attachUnlock(
    target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  ): void {
    this.unlockCleanup?.();
    const unlock = (): void => {
      void this.context()
        ?.resume()
        .catch(() => undefined);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const name of events) target.addEventListener(name, unlock);
    this.unlockCleanup = () => {
      for (const name of events) target.removeEventListener(name, unlock);
    };
  }

  play(name: UiSoundName): void {
    const volume = this.volume();
    if (volume <= 0) return;
    const ctx = this.context();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      // Bez wcześniejszej interakcji przeglądarka i tak nie zagra; próba wznowienia jest bezpieczna.
      void ctx.resume().catch(() => undefined);
      return;
    }
    const now = ctx.currentTime;
    const previous = this.last.get(name);
    if (previous !== undefined && now - previous < MIN_REPEAT_S[name]) return;
    this.last.set(name, now);
    for (const note of recipes[name]) {
      const start = now + (note.delayS ?? 0);
      const end = start + note.durationS;
      const osc = ctx.createOscillator();
      osc.type = note.wave;
      osc.frequency.setValueAtTime(note.from, start);
      if (note.to !== undefined)
        osc.frequency.exponentialRampToValueAtTime(note.to, end);
      const gain = ctx.createGain();
      const peak = Math.max(0.0002, BASE_GAIN * note.gain * volume);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  dispose(): void {
    this.unlockCleanup?.();
    this.unlockCleanup = null;
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }
}

let shared: UiSounds | undefined;

/** Wspólna instancja dla interfejsu; własny kontekst, niezależny od AudioSystem sceny. */
export function uiSounds(): UiSounds {
  if (!shared) {
    shared = new UiSounds();
    if (typeof window !== 'undefined') shared.attachUnlock(window);
  }
  return shared;
}

export function playUiSound(name: UiSoundName): void {
  uiSounds().play(name);
}
