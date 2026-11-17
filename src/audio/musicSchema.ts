import { z } from 'zod';

/** Stany muzyki (poza „off”, który oznacza ciszę). */
export const MUSIC_LOOPS = ['calm', 'combat', 'boss'] as const;
export type MusicLoopId = (typeof MUSIC_LOOPS)[number];
export type MusicState = MusicLoopId | 'off';

const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;
const SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Numer MIDI z nazwy nuty (`A1`, `C#3`, `Bb2`); NaN dla błędnej nazwy. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) return Number.NaN;
  const shift = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + (SEMITONE[m[1] as string] as number) + shift;
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const filterSchema = z
  .object({
    type: z.enum(['lowpass', 'highpass', 'bandpass']),
    freq: z.number().finite().positive(),
    /** Przemiatanie częstotliwości w trakcie nuty (otwarcie/zamknięcie filtra). */
    freqEnd: z.number().finite().positive().optional(),
    q: z.number().finite().positive().optional(),
  })
  .strict();

const trackBase = {
  id: z.string().min(1),
  gain: z.number().finite().positive().max(2),
  /**
   * Wzorzec: jeden napis na takt (cyklicznie, długość tablicy musi dzielić liczbę taktów),
   * w każdym dokładnie `stepsPerBeat × beatsPerBar` tokenów rozdzielonych spacją.
   */
  pattern: z.array(z.string().min(1)).min(1),
};

export const toneTrackSchema = z
  .object({
    ...trackBase,
    kind: z.literal('tone'),
    wave: z.enum(['sine', 'square', 'sawtooth', 'triangle']),
    /** Drugi oscylator rozstrojony o tyle centów (gruby, „chorusowy” pad). */
    detuneCents: z.number().finite().min(0).max(100).optional(),
    attackS: z.number().finite().min(0.001).max(4),
    releaseS: z.number().finite().min(0.01).max(6),
    filter: filterSchema.optional(),
    /** Pan −1..1 (stereo przez StereoPanner). */
    pan: z.number().finite().min(-1).max(1).optional(),
  })
  .strict();

export const drumTrackSchema = z
  .object({
    ...trackBase,
    kind: z.enum(['kick', 'snare', 'hat']),
  })
  .strict();

export const musicTrackSchema = z.discriminatedUnion('kind', [
  toneTrackSchema,
  drumTrackSchema,
]);
export type MusicTrack = z.infer<typeof musicTrackSchema>;
export type ToneTrack = z.infer<typeof toneTrackSchema>;

export const musicLoopSchema = z
  .object({
    bpm: z.number().finite().min(40).max(220),
    beatsPerBar: z.number().int().min(1).max(8),
    stepsPerBeat: z.number().int().min(1).max(8),
    bars: z.number().int().min(8).max(16),
    tracks: z.array(musicTrackSchema).min(1),
  })
  .strict();
export type MusicLoop = z.infer<typeof musicLoopSchema>;

/** Zdarzenie zagrane w pętli (krok liczony od początku pętli). */
export interface MusicEvent {
  step: number;
  /** Długość w krokach (nuty tonowe); 1 dla perkusji. */
  lenSteps: number;
  /** Częstotliwości (akord = kilka). Puste dla perkusji. */
  freqs: number[];
  vel: number;
}

const DRUM_TOKEN: Record<string, number> = { x: 1, o: 0.5 };

/** Parsuje token tonowy `A1`, `A3+C4+E4*8@0.7`; null = pauza, string = błąd. */
function parseToneToken(
  token: string,
): { freqs: number[]; len: number; vel: number } | null | string {
  if (token === '.') return null;
  const m = /^([^*@]+)(?:\*(\d+))?(?:@([0-9.]+))?$/.exec(token);
  if (!m) return `zły token „${token}”`;
  const freqs: number[] = [];
  for (const name of (m[1] as string).split('+')) {
    const midi = noteToMidi(name);
    if (!Number.isFinite(midi)) return `zła nuta „${name}”`;
    freqs.push(midiToHz(midi));
  }
  const len = m[2] ? Number(m[2]) : 1;
  const vel = m[3] ? Number(m[3]) : 1;
  if (len < 1 || !(vel > 0 && vel <= 1)) return `zły token „${token}”`;
  return { freqs, len, vel };
}

/** Błąd wzorca albo null. */
function patternError(loop: MusicLoop, track: MusicTrack): string | null {
  const perBar = loop.beatsPerBar * loop.stepsPerBeat;
  if (loop.bars % track.pattern.length !== 0)
    return `ścieżka ${track.id}: liczba wzorców (${track.pattern.length}) nie dzieli liczby taktów (${loop.bars})`;
  for (const [b, bar] of track.pattern.entries()) {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== perBar)
      return `ścieżka ${track.id}, takt ${b}: ${tokens.length} tokenów zamiast ${perBar}`;
    for (const [s, token] of tokens.entries()) {
      if (track.kind === 'tone') {
        const parsed = parseToneToken(token);
        if (typeof parsed === 'string')
          return `ścieżka ${track.id}, takt ${b}: ${parsed}`;
        if (parsed && s + parsed.len > perBar * 4)
          return `ścieżka ${track.id}, takt ${b}: nuta za długa`;
      } else if (token !== '.' && DRUM_TOKEN[token] === undefined)
        return `ścieżka ${track.id}, takt ${b}: zły token „${token}” (. x o)`;
    }
  }
  return null;
}

export const musicSchema = z
  .object({
    /** Czas crossfade'u między pętlami (s). */
    fadeS: z.number().finite().min(0.2).max(6),
    loops: z
      .object({
        calm: musicLoopSchema,
        combat: musicLoopSchema,
        boss: musicLoopSchema,
      })
      .strict(),
  })
  .strict()
  .superRefine((def, ctx) => {
    for (const id of MUSIC_LOOPS) {
      const loop = def.loops[id];
      const ids = new Set<string>();
      for (const track of loop.tracks) {
        if (ids.has(track.id))
          ctx.addIssue({
            code: 'custom',
            message: `pętla ${id}: powtórzona ścieżka ${track.id}`,
          });
        ids.add(track.id);
        const error = patternError(loop, track);
        if (error)
          ctx.addIssue({ code: 'custom', message: `pętla ${id}: ${error}` });
      }
    }
  });
export type MusicDefinition = z.infer<typeof musicSchema>;

export function loadMusic(data: unknown): MusicDefinition {
  return musicSchema.parse(data);
}

/** Płaska lista zdarzeń ścieżki dla całej pętli (kroki rosnąco). */
export function compileTrack(loop: MusicLoop, track: MusicTrack): MusicEvent[] {
  const perBar = loop.beatsPerBar * loop.stepsPerBeat;
  const events: MusicEvent[] = [];
  for (let bar = 0; bar < loop.bars; bar++) {
    const tokens = (track.pattern[bar % track.pattern.length] as string)
      .trim()
      .split(/\s+/);
    for (const [s, token] of tokens.entries()) {
      const step = bar * perBar + s;
      if (track.kind === 'tone') {
        const parsed = parseToneToken(token);
        if (parsed && typeof parsed !== 'string')
          events.push({
            step,
            lenSteps: parsed.len,
            freqs: parsed.freqs,
            vel: parsed.vel,
          });
      } else if (token !== '.')
        events.push({
          step,
          lenSteps: 1,
          freqs: [],
          vel: DRUM_TOKEN[token] as number,
        });
    }
  }
  return events;
}

export function loopSteps(loop: MusicLoop): number {
  return loop.bars * loop.beatsPerBar * loop.stepsPerBeat;
}

/** Czas jednego kroku (s). */
export function stepSeconds(loop: MusicLoop): number {
  return 60 / loop.bpm / loop.stepsPerBeat;
}
