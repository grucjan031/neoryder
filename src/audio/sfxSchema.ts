import { z } from 'zod';

/** Zdarzenia, które moduł audio umie obsłużyć (podzbiór GameEvents). */
export const SFX_EVENTS = [
  'hub_prop_used',
  'execute_performed',
  'explosion',
  'damage_dealt',
  'melee_swing',
  'melee_blocked',
  'parry_success',
  'weapon_fired',
  'projectile_spawned',
  'heat_changed',
  'power_used',
  'power_denied',
  'player_landed',
  'dash_used',
  'enemy_telegraph',
  'wave_started',
  'wave_cleared',
] as const;
export type SfxEvent = (typeof SFX_EVENTS)[number];

const filter = z.object({
  type: z.enum(['lowpass', 'highpass', 'bandpass']),
  freq: z.number().positive(),
  /** Przemiatanie częstotliwości filtra do tej wartości w czasie warstwy. */
  freqEnd: z.number().positive().optional(),
  q: z.number().positive().optional(),
});

/** Jedna warstwa syntezy: oscylator albo szum, z obwiednią i opcjonalnym filtrem. */
export const layerSchema = z.object({
  wave: z.enum(['sine', 'square', 'sawtooth', 'triangle', 'noise']),
  /** Częstotliwość startowa (Hz); dla szumu ignorowana. */
  freq: z.number().positive().optional(),
  /** Przemiatanie (wykładnicze) do tej częstotliwości. */
  freqEnd: z.number().positive().optional(),
  durationS: z.number().positive().max(3),
  attackS: z.number().nonnegative().max(1).optional(),
  gain: z.number().min(0).max(2),
  delayS: z.number().nonnegative().max(2).optional(),
  filter: filter.optional(),
});
export type SfxLayer = z.infer<typeof layerSchema>;

export const soundSchema = z.object({
  /** Warianty — przy odtworzeniu losowany jeden (kosmetyczny Rng). */
  variants: z.array(z.array(layerSchema).min(1)).min(1),
  volume: z.number().min(0).max(2),
  /** Zakres mnożnika wysokości [min, max]. */
  pitch: z.tuple([z.number().positive(), z.number().positive()]),
  /** Panorama i tłumienie z odległości od słuchacza (wymaga punktu zdarzenia). */
  spatial: z.boolean().optional(),
  /** Minimalny odstęp między odtworzeniami tego dźwięku (s) — przeciw spamowi. */
  cooldownS: z.number().nonnegative().optional(),
});
export type SfxSound = z.infer<typeof soundSchema>;

/** Warunki reguły; wszystkie podane muszą być spełnione. */
const whenSchema = z
  .object({
    kind: z.enum(['jukebox', 'noodles', 'radio', 'bag']).optional(),
    tagsAny: z.array(z.string()).optional(),
    tagsNone: z.array(z.string()).optional(),
    killed: z.boolean().optional(),
    targetIsPlayer: z.boolean().optional(),
    sourceIsPlayer: z.boolean().optional(),
    /** Właściciel / użytkownik / atakujący to gracz (weapon_fired, power_used, melee_swing, dash_used). */
    actorIsPlayer: z.boolean().optional(),
    team: z.enum(['player', 'enemy', 'neutral']).optional(),
    minSpeed: z.number().optional(),
    /** heat_changed: tylko przejście przegrzania false → true. */
    overheatRising: z.boolean().optional(),
  })
  .strict();
export type SfxWhen = z.infer<typeof whenSchema>;

export const sfxSchema = z
  .object({
    sounds: z.record(z.string(), soundSchema),
    /** Reguły sprawdzane po kolei; dla zdarzenia gra pierwsza pasująca. */
    rules: z.array(
      z
        .object({
          event: z.enum(SFX_EVENTS),
          when: whenSchema.optional(),
          sound: z.string().min(1),
        })
        .strict(),
    ),
  })
  .superRefine((data, ctx) => {
    data.rules.forEach((rule, i) => {
      if (!(rule.sound in data.sounds))
        ctx.addIssue({
          code: 'custom',
          message: `Reguła ${i} wskazuje nieznany dźwięk: ${rule.sound}`,
          path: ['rules', i, 'sound'],
        });
    });
    for (const [name, sound] of Object.entries(data.sounds))
      if (sound.pitch[0] > sound.pitch[1])
        ctx.addIssue({
          code: 'custom',
          message: `Dźwięk ${name}: pitch min > max`,
          path: ['sounds', name, 'pitch'],
        });
  });
export type SfxDefinition = z.infer<typeof sfxSchema>;

export function loadSfx(data: unknown): SfxDefinition {
  const result = sfxSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane dźwięków: ${result.error.message}`);
  return result.data;
}
