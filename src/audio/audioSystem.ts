import type { EntityId, EventBus, GameEvents, Team } from '../core/events';
import type { Vec3 } from '../core/math';
import { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import { SFX_EVENTS } from './sfxSchema';
import type { SfxDefinition, SfxEvent, SfxWhen } from './sfxSchema';
import { createNoiseBuffer, playLayers } from './synth';
import type { AudioBackend } from './synth';
import { Ambience } from './ambience';
import type { AmbienceSource } from './ambienceSchema';

export interface Listener {
  position: Vec3;
  /** Obrót kamery wokół osi Y (rad); przód = (−sin yaw, 0, −cos yaw). */
  yaw: number;
}

export interface AudioSystemOptions {
  /** Tworzy kontekst audio (null = brak Web Audio, np. testy bez atrapy). */
  createContext: () => AudioBackend | null;
  tuning: Pick<Tuning, 'audio'>;
  /** Głośność główna z ustawień gracza (Settings.masterVolume, 0..1). */
  masterVolume: () => number;
  sfxVolume?: () => number;
  listener?: () => Listener | null;
  /** Kosmetyczny generator (warianty, pitch, szum) — nie wpływa na symulację. */
  seed?: string;
}

interface Voice {
  sound: string;
  endTime: number;
  gain: GainNode;
  panner?: StereoPannerNode;
  sources: AudioScheduledSourceNode[];
}

/** Pola zdarzenia użyte w warunkach reguł. */
interface EventFacts {
  kind?: GameEvents['hub_prop_used']['kind'];
  faunaKind?: 'meow' | 'rat';
  tags?: readonly string[];
  killed?: boolean;
  target?: EntityId | null;
  source?: EntityId | null;
  actor?: EntityId | null;
  team?: Team;
  speed?: number;
  overheatRising?: boolean;
  heatWarningRising?: boolean;
  lowHealthRising?: boolean;
  telegraphKind?: string;
  positiveDelta?: boolean;
  point?: Vec3 | null;
}

/**
 * Dźwięki gry (F1 #14): syntezowane w locie z przepisów w src/data/audio/sfx.json.
 * Słucha zdarzeń EventBus i wybiera dźwięk pierwszą pasującą regułą. Jedyne miejsce
 * obsługi odblokowania audio (attachUnlock). Gracza rozpoznaje po entity_spawned kind='player'.
 */
export class AudioSystem {
  private ctx: AudioBackend | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly rng: Rng;
  private readonly voices: Voice[] = [];
  private readonly lastPlayed = new Map<string, number>();
  private readonly overheated = new Map<EntityId, boolean>();
  private heatWarning = false;
  private lowHealth = false;
  private playerId: EntityId | null = null;
  private readonly off: (() => void)[] = [];
  private unlockCleanup: (() => void) | null = null;
  private ambience: Ambience | null = null;
  private ambienceSources: readonly AmbienceSource[] | null = null;
  private trainProgress: number | null = null;
  private powerLevel = 1;
  private trainTuning: Tuning['hub'] | undefined;
  private disposed = false;
  /** Ostatnio odtworzony dźwięk (debug, testy). */
  lastSound: string | null = null;
  /** Ostatnie odtworzone dźwięki, najnowszy na końcu (debug, testy). */
  readonly recentSounds: string[] = [];

  constructor(
    bus: EventBus,
    private readonly def: SfxDefinition,
    private readonly opts: AudioSystemOptions,
  ) {
    this.rng = new Rng(opts.seed ?? 'audio');
    this.off.push(
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind === 'player') {
          this.resetAlerts();
          this.playerId = id;
        }
      }),
      bus.on('entity_despawned', ({ id }) => {
        this.overheated.delete(id);
        if (id === this.playerId) {
          this.playerId = null;
          this.resetAlerts();
        }
      }),
      bus.on('scene_loaded', () => {
        this.resetAlerts();
      }),
      bus.on('run_started', () => this.resetAlerts()),
      bus.on('weapon_switched', ({ owner }) => {
        if (owner === this.playerId) {
          this.heatWarning = false;
          this.overheated.delete(owner);
        }
      }),
    );
    for (const event of SFX_EVENTS)
      this.off.push(
        bus.on(event, (payload) =>
          this.onEvent(event, payload as GameEvents[typeof event]),
        ),
      );
  }

  /** Wspólny kontekst dla MusicSystem (tworzony leniwie; null = brak Web Audio). */
  getContext(): AudioBackend | null {
    return this.disposed ? null : this.ensureContext();
  }

  /** Stan kontekstu: 'none' (brak), 'suspended', 'running', 'closed'. */
  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  get activeVoices(): number {
    this.prune();
    return this.voices.length;
  }

  get soundNames(): string[] {
    return Object.keys(this.def.sounds);
  }

  setAmbience(sources: readonly AmbienceSource[] | null): void {
    this.ambienceSources =
      sources?.map((s) => ({ ...s, position: { ...s.position } })) ?? null;
    this.ambience?.dispose();
    this.ambience = null;
    this.trainProgress = null;
  }

  updateAmbienceSource(index: number, position: Vec3, gain: number): void {
    const source = this.ambienceSources?.[index];
    if (!source) return;
    Object.assign(source.position, position);
    source.gain = Math.max(0, gain);
  }

  /** Poziom zasilania (0-1): mnoży głośność źródeł zasilanych z sieci. */
  setPowerLevel(level: number): void {
    this.powerLevel = Math.max(0, Math.min(1, level));
  }

  get activeAmbience(): { kind: string; gain: number }[] {
    return this.ambience?.snapshot ?? [];
  }

  setTrainPass(progress: number | null, hubTuning: Tuning['hub']): void {
    this.trainProgress =
      progress === null ? null : Math.max(0, Math.min(1, progress));
    this.trainTuning = hubTuning;
  }

  updateAmbience(paused = false): void {
    if (
      this.disposed ||
      (!this.ambienceSources && this.trainProgress === null && !this.ambience)
    )
      return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master || !this.noise) return;
    this.updateVolume();
    if (!this.ambience) {
      this.ambience = new Ambience(
        ctx,
        this.master,
        this.noise,
        this.opts.tuning.audio,
        `${this.opts.seed ?? 'audio'}:ambience`,
      );
      this.ambience.setSources(this.ambienceSources);
    }
    this.ambience.update(
      this.opts.listener?.() ?? null,
      paused,
      this.trainProgress,
      this.trainTuning,
      this.powerLevel,
    );
  }

  /** Odblokowanie po pierwszej interakcji (polityka autoodtwarzania przeglądarek). */
  attachUnlock(
    target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  ): void {
    this.unlockCleanup?.();
    const unlock = (): void => {
      void this.ensureContext()
        ?.resume()
        .catch(() => undefined);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) target.addEventListener(e, unlock);
    this.unlockCleanup = () => {
      for (const e of events) target.removeEventListener(e, unlock);
    };
  }

  /** Odtwarza dźwięk po nazwie; point = źródło w świecie (panorama, odległość). */
  updateVolume(): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.setValueAtTime(
      Math.max(
        0,
        this.opts.tuning.audio.masterGain *
          this.opts.masterVolume() *
          (this.opts.sfxVolume?.() ?? 1),
      ),
      this.ctx.currentTime,
    );
  }

  play(name: string, opts: { point?: Vec3 | null } = {}): boolean {
    const sound = this.def.sounds[name];
    if (this.disposed) return false;
    const ctx = this.ensureContext();
    if (!sound || !ctx || !this.master || !this.noise) return false;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name);
    if (
      sound.cooldownS !== undefined &&
      last !== undefined &&
      now - last < sound.cooldownS
    )
      return false;

    const a = this.opts.tuning.audio;
    this.updateVolume();
    this.prune();
    while (this.voices.length >= Math.max(1, Math.floor(a.maxVoices)))
      this.steal();

    const voiceGain = ctx.createGain();
    let level = sound.volume;
    let out: AudioNode = voiceGain;
    let panner: StereoPannerNode | undefined;
    const listener = this.opts.listener?.() ?? null;
    if (sound.spatial && opts.point && listener) {
      const { pan, attenuation } = spatialize(
        opts.point,
        listener,
        a.refDistance,
        a.maxPan,
      );
      level *= attenuation;
      panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, now);
      voiceGain.connect(panner);
      out = panner;
    }
    voiceGain.gain.setValueAtTime(level, now);
    out.connect(this.master);

    const variant = this.rng.pick(sound.variants);
    // Pitch z zakresu danych: [min, max) z kosmetycznego generatora (min == max — bez zmian).
    const [low, high] = sound.pitch;
    const pitch = high > low ? this.rng.float(low, high) : low;
    const played = playLayers(ctx, voiceGain, variant, pitch, this.noise, now);
    this.voices.push({
      sound: name,
      endTime: played.endTime,
      gain: voiceGain,
      panner,
      sources: played.sources,
    });
    this.lastPlayed.set(name, now);
    this.lastSound = name;
    this.recentSounds.push(name);
    if (this.recentSounds.length > 16) this.recentSounds.shift();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.setAmbience(null);
    for (const off of this.off.splice(0)) off();
    this.unlockCleanup?.();
    this.unlockCleanup = null;
    for (const voice of this.voices.splice(0)) stopVoice(voice);
    void this.ctx?.close?.().catch(() => undefined);
    this.ctx = null;
  }

  // ------------------------------------------------------------------ reguły

  private resetAlerts(): void {
    this.overheated.clear();
    this.heatWarning = false;
    this.lowHealth = false;
    this.lastPlayed.clear();
  }

  private onEvent(event: SfxEvent, payload: GameEvents[SfxEvent]): void {
    const facts = this.facts(event, payload);
    for (const rule of this.def.rules) {
      if (rule.event !== event) continue;
      if (rule.when && !this.matches(rule.when, facts)) continue;
      this.play(rule.sound, { point: facts.point ?? null });
      return;
    }
  }

  private facts(event: SfxEvent, p: GameEvents[SfxEvent]): EventFacts {
    switch (event) {
      case 'enemy_telegraph':
        return { telegraphKind: (p as GameEvents['enemy_telegraph']).kind };
      case 'currency_changed':
        return {
          positiveDelta: (p as GameEvents['currency_changed']).delta > 0,
        };
      case 'health_changed': {
        const e = p as GameEvents['health_changed'];
        const alerts = this.def.alerts;
        if (e.id !== this.playerId || !alerts || e.max <= 0) return {};
        const ratio = e.current / e.max;
        const was = this.lowHealth;
        if (ratio >= alerts.healthReset) this.lowHealth = false;
        else if (ratio < alerts.healthThreshold) this.lowHealth = true;
        return {
          actor: e.id,
          lowHealthRising: e.current > 0 && !was && this.lowHealth,
        };
      }
      case 'hub_prop_used':
        return { kind: (p as GameEvents['hub_prop_used']).kind };
      case 'hub_fauna_sound': {
        const e = p as GameEvents['hub_fauna_sound'];
        return { faunaKind: e.kind, point: e.point };
      }
      case 'damage_dealt': {
        const e = p as GameEvents['damage_dealt'];
        return {
          tags: e.tags,
          killed: e.killed,
          target: e.target,
          source: e.source,
          point: e.point,
        };
      }
      case 'melee_swing':
        return { actor: (p as GameEvents['melee_swing']).attacker };
      case 'weapon_fired':
        return { actor: (p as GameEvents['weapon_fired']).owner };
      case 'projectile_spawned': {
        const e = p as GameEvents['projectile_spawned'];
        return { actor: e.owner, team: e.team };
      }
      case 'power_used':
        return { actor: (p as GameEvents['power_used']).user };
      case 'power_denied':
        return { actor: (p as GameEvents['power_denied']).user };
      case 'dash_used':
        return { actor: (p as GameEvents['dash_used']).user };
      case 'player_landed': {
        const e = p as GameEvents['player_landed'];
        return { actor: e.id, speed: e.speed };
      }
      case 'heat_changed': {
        const e = p as GameEvents['heat_changed'];
        if (e.id !== this.playerId || e.max <= 0) return {};
        const was = this.overheated.get(e.id) ?? false;
        this.overheated.set(e.id, e.overheated);
        const alerts = this.def.alerts;
        const warned = this.heatWarning;
        if (alerts) {
          if (e.current / e.max <= alerts.heatReset) this.heatWarning = false;
          else if (e.current / e.max >= alerts.heatThreshold)
            this.heatWarning = true;
        }
        return {
          actor: e.id,
          overheatRising: e.overheated && !was,
          heatWarningRising: !e.overheated && !warned && this.heatWarning,
        };
      }
      default:
        return {};
    }
  }

  private matches(when: SfxWhen, f: EventFacts): boolean {
    const player = this.playerId;
    for (const key of [
      'heatWarningRising',
      'lowHealthRising',
      'positiveDelta',
    ] as const)
      if (when[key] !== undefined && (f[key] ?? false) !== when[key])
        return false;
    if (
      when.telegraphKind !== undefined &&
      f.telegraphKind !== when.telegraphKind
    )
      return false;
    if (when.kind !== undefined && f.kind !== when.kind) return false;
    if (when.faunaKind !== undefined && when.faunaKind !== f.faunaKind)
      return false;
    if (when.tagsAny && !when.tagsAny.some((t) => f.tags?.includes(t)))
      return false;
    if (when.tagsNone && when.tagsNone.some((t) => f.tags?.includes(t)))
      return false;
    if (when.killed !== undefined && (f.killed ?? false) !== when.killed)
      return false;
    if (
      when.targetIsPlayer !== undefined &&
      (player !== null && f.target === player) !== when.targetIsPlayer
    )
      return false;
    if (
      when.sourceIsPlayer !== undefined &&
      (player !== null && f.source === player) !== when.sourceIsPlayer
    )
      return false;
    if (
      when.actorIsPlayer !== undefined &&
      (player !== null && f.actor === player) !== when.actorIsPlayer
    )
      return false;
    if (when.team !== undefined && f.team !== when.team) return false;
    if (when.minSpeed !== undefined && !((f.speed ?? 0) >= when.minSpeed))
      return false;
    if (
      when.overheatRising !== undefined &&
      (f.overheatRising ?? false) !== when.overheatRising
    )
      return false;
    return true;
  }

  // ------------------------------------------------------------------ głosy

  private ensureContext(): AudioBackend | null {
    if (this.ctx) return this.ctx;
    const ctx = this.opts.createContext();
    if (!ctx) return null;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.noise = createNoiseBuffer(ctx, () => this.rng.next());
    return ctx;
  }

  private prune(): void {
    const now = this.ctx?.currentTime ?? 0;
    for (let i = this.voices.length - 1; i >= 0; i--)
      if ((this.voices[i] as Voice).endTime + 0.05 <= now) {
        disconnectVoice(this.voices[i] as Voice);
        this.voices.splice(i, 1);
      }
  }

  /** Zwalnia najstarszy głos (limit maxVoices). */
  private steal(): void {
    const oldest = this.voices.shift();
    if (oldest) stopVoice(oldest, this.ctx?.currentTime ?? 0);
  }
}

/** Odpina głos od szyny master, żeby zakończone węzły nie zostawały w grafie. */
function disconnectVoice(voice: Voice): void {
  try {
    voice.panner?.disconnect();
    voice.gain.disconnect();
  } catch {
    // Kontekst mógł zostać już zamknięty.
  }
}

function stopVoice(voice: Voice, now = 0): void {
  try {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0, now);
    for (const s of voice.sources) s.stop(now);
  } catch {
    // Źródło mogło się już zakończyć.
  }
  disconnectVoice(voice);
}

/** Panorama z kąta względem prawej osi słuchacza i tłumienie 1/odległość (≤ 1 w promieniu ref). */
export function spatialize(
  point: Vec3,
  listener: Listener,
  refDistance: number,
  maxPan: number,
): { pan: number; attenuation: number } {
  const dx = point.x - listener.position.x;
  const dz = point.z - listener.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return { pan: 0, attenuation: 1 };
  const rightX = Math.cos(listener.yaw);
  const rightZ = -Math.sin(listener.yaw);
  const side = (dx * rightX + dz * rightZ) / dist;
  return {
    pan: Math.max(-1, Math.min(1, side)) * maxPan,
    attenuation: Math.min(1, refDistance / dist),
  };
}
