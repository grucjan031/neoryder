import { z } from 'zod';

const positive = z.number().finite().positive();
const unit = z.number().finite().min(0).max(1);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const weatherSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_]+$/),
  title: z.string().min(1),
  precipitation: z.object({
    kind: z.enum(['rain', 'drizzle', 'none']),
    density: unit,
    speed: positive,
    color,
    opacity: unit,
    exposureS: positive,
    widthM: positive,
  }),
  wind: z.object({
    direction: z
      .object({ x: z.number().finite(), z: z.number().finite() })
      .refine(
        (v) => Math.hypot(v.x, v.z) > 0,
        'Kierunek wiatru nie może być zerowy.',
      ),
    strength: z.number().finite().nonnegative(),
    gustStrength: unit,
    gustPeriodS: positive,
  }),
  fog: z
    .object({
      color,
      density: z.number().finite().nonnegative(),
      heightM: positive,
      strength: unit,
      nearM: z.number().finite().nonnegative(),
      farM: positive,
    })
    .refine((v) => v.farM > v.nearM, 'Mgła wymaga farM > nearM.'),
  surface: z.object({ gloss: unit, reflections: unit, puddles: unit }),
  lightning: z
    .object({
      enabled: z.boolean(),
      minIntervalS: positive,
      maxIntervalS: positive,
      brightness: z.number().finite().nonnegative(),
      color: z.literal('#fff1d6'),
      decayS: positive,
    })
    .refine(
      (v) => v.maxIntervalS >= v.minIntervalS,
      'Odwrócony zakres wyładowań.',
    ),
  dust: z.object({
    density: unit,
    sizeM: positive,
    opacity: unit,
    color,
    lifeS: positive,
  }),
  ambience: z.array(
    z.object({
      kind: z.enum(['rain', 'wind']),
      gain: unit,
      radiusM: positive,
    }),
  ),
});
export type WeatherProfile = z.infer<typeof weatherSchema>;

export function loadWeatherDefinitions(
  data: readonly unknown[],
): Map<string, WeatherProfile> {
  const result = new Map<string, WeatherProfile>();
  for (const raw of data) {
    const profile = weatherSchema.parse(raw);
    if (result.has(profile.id))
      throw new Error(`Powtórzona pogoda: ${profile.id}`);
    result.set(profile.id, profile);
  }
  return result;
}

export const weatherDefinitions = loadWeatherDefinitions(
  Object.values(
    import.meta.glob('../data/weather/*.json', {
      eager: true,
      import: 'default',
    }),
  ),
);
