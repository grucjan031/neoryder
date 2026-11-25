import { z } from 'zod';
import { weaponDefinitions } from '../combat/weapons/weaponSchema';

function allowedColor(hex: string): boolean {
  const channel = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const r = channel(1),
    g = channel(3),
    b = channel(5);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const delta = max - min,
    light = (max + min) / 2;
  if (!delta || delta / (1 - Math.abs(2 * light - 1)) <= 0.35) return true;
  const sector =
    max === r
      ? (g - b) / delta
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  const hue = (sector * 60 + 360) % 360;
  return (
    !(hue >= 285 && hue <= 340) &&
    !((hue >= 340 || hue <= 20) && light >= 0.2 && light <= 0.8)
  );
}
const color = z
  .string()
  .regex(/^#[\da-f]{6}$/i)
  .refine(allowedColor, 'Kolor zastrzeżony.');
export const skinSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    rarity: z.enum(['standard', 'rzadki', 'elitarny', 'mistrzowski']),
    weapons: z.union([
      z.literal('*'),
      z.array(z.string().refine((id) => weaponDefinitions.has(id))).min(1),
    ]),
    colors: z
      .object({ armor: color, trim: color, grip: color, accent: color })
      .strict(),
    pattern: z.enum(['none', 'carbon', 'digital', 'hex', 'stripes', 'brushed']),
    patternColor: color.optional(),
    patternScale: z.number().positive().optional(),
    metalness: z.number().min(0).max(1),
    roughness: z.number().min(0).max(1),
  })
  .strict();
export type SkinDefinition = z.infer<typeof skinSchema>;
export function skinFitsWeapon(
  skin: SkinDefinition,
  weaponId: string,
): boolean {
  return (
    weaponDefinitions.has(weaponId) &&
    (skin.weapons === '*' || skin.weapons.includes(weaponId))
  );
}
export function loadSkinDefinitions(
  files: Record<string, unknown>,
): ReadonlyMap<string, SkinDefinition> {
  const definitions = new Map<string, SkinDefinition>();
  for (const [path, raw] of Object.entries(files)) {
    const skin = skinSchema.parse(raw);
    if (path.split('/').pop() !== skin.id + '.json' || definitions.has(skin.id))
      throw new Error(`Błędny identyfikator skina: ${path}`);
    definitions.set(skin.id, skin);
  }
  return definitions;
}
export const skinDefinitions = loadSkinDefinitions(
  import.meta.glob('../data/skins/*.json', { eager: true, import: 'default' }),
);
