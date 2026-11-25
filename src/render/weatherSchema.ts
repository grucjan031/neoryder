import { z } from 'zod';

const positive = z.number().finite().positive();
const unit = z.number().finite().min(0).max(1);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const weatherSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_]+$/),
    title: z.string().min(1),
    precipitation: z.object({
      kind: z.enum(['rain', 'drizzle', 'none', 'snow', 'ash']),
      density: unit,
      speed: positive,
      color,
      opacity: unit,
      exposureS: positive,
      widthM: positive,
      flakes: z
        .object({
          sizeM: positive,
          swayM: z.number().finite().nonnegative(),
          swayPeriodS: positive,
          windScatter: z.number().finite().nonnegative(),
          secondaryColor: color,
        })
        .optional(),
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
    surface: z.object({
      gloss: unit,
      reflections: unit,
      puddles: unit,
      snowCoverage: unit.default(0),
      snowColor: color.default('#ffffff'),
    }),
    lighting: z
      .object({
        hemiIntensity: z.number().finite().nonnegative(),
        keyIntensity: z.number().finite().nonnegative(),
        panoramaEnabled: z.boolean(),
      })
      .optional(),
    sky: z.object({ horizonColor: color }).optional(),
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
        kind: z.enum(['rain', 'wind', 'generator']),
        gain: unit,
        radiusM: positive,
      }),
    ),
  })
  .superRefine((profile, ctx) => {
    if (
      (profile.precipitation.kind === 'snow' ||
        profile.precipitation.kind === 'ash') &&
      !profile.precipitation.flakes
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['precipitation', 'flakes'],
        message: 'Opad płatków wymaga parametrów flakes.',
      });
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
