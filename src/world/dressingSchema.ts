import { z } from 'zod';

/**
 * Kontrakt oprawy wizualnej pokoju i areny (ADR 0006 „Neon Noir”).
 * Wszystko tutaj jest kosmetyczne: nie tworzy colliderów, nie wpływa na walidację
 * osiągalności ani na symulację. Przeszkody to nadal bloki układu.
 */

const finite = z.number().finite();
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const unit = z.number().finite().min(0).max(1);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** Id tekstury: nazwa pliku bez rozszerzenia (np. `ramen_bar`). */
const textureId = z.string().regex(/^[a-z0-9_]+$/);

const vec3 = z.object({ x: finite, y: finite, z: finite });
const size2 = z.object({ w: positive, h: positive });

/** Materiał bloku układu; `world` = dotychczasowy materiał świata. */
export const BLOCK_MATERIALS = [
  'world',
  'concrete',
  'asphalt',
  'metal',
  'facade',
  'trim',
  'glass',
  'paving',
  'plaster',
  'corrugated',
  'rust',
  'hazard',
] as const;
export const blockMaterialSchema = z.enum(BLOCK_MATERIALS);
export type BlockMaterial = z.infer<typeof blockMaterialSchema>;

/**
 * Napis neonowy (`neon`, plik `/assets/textures/signs/<texture>.webp`) albo
 * hologram reklamowy (`holo`, `/assets/textures/holo/<texture>.webp`).
 * Tekstury mają czarne tło i są rysowane addytywnie. `yaw` w radianach, płaszczyzna
 * patrzy w +Z przy yaw = 0. `tint` mnoży kolor tekstury.
 */
export const signSchema = z.object({
  kind: z.enum(['neon', 'holo']),
  texture: textureId,
  position: vec3,
  size: size2,
  yaw: finite,
  tint: hexColor.optional(),
  /** 0 = stałe światło, 1 = mocne migotanie. */
  flicker: unit.optional(),
});
export type SignDef = z.infer<typeof signSchema>;

/** Kolorowe światło punktowe; renderer ogranicza liczbę aktywnych świateł i dorysowuje plamę światła na podłodze. */
export const cityLightSchema = z.object({
  position: vec3,
  color: hexColor,
  intensity: positive,
  range: positive,
});
export type CityLightDef = z.infer<typeof cityLightSchema>;

/** Naklejka na ścianę (graffiti, plakat) lub podłogę (kałuża, oznakowanie): `/assets/textures/decals/<texture>.webp` z kanałem alfa. */
export const decalSchema = z.object({
  texture: textureId,
  position: vec3,
  size: size2,
  yaw: finite,
  surface: z.enum(['wall', 'floor']),
  opacity: unit.optional(),
});
export type DecalDef = z.infer<typeof decalSchema>;

/**
 * Czy cały prostokąt naklejki leży na jednej pionowej ścianie bloku AABB?
 * Nośnik jest rozpoznawany po pozycji i normalnej (yaw), bez zmiany schematu danych.
 * Tolerancja dotyczy wyłącznie odsunięcia od płaszczyzny; nie pozwala wyjść poza jej brzeg.
 * Funkcja nie mutuje danych i może sprawdzać również bloki kryjówki.
 */
export function wallDecalFitsBlock(
  decal: DecalDef,
  block: {
    position: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  },
  surfaceToleranceM = 0.1,
): boolean {
  if (decal.surface !== 'wall') return false;
  const epsilon = 1e-6;
  const normal = { x: Math.sin(decal.yaw), z: Math.cos(decal.yaw) };
  const axis = Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z';
  const along = axis === 'x' ? 'z' : 'x';
  // Dane używają też zaokrąglonych kątów (np. 1.5708).
  if (Math.abs(normal[along]) > 1e-4) return false;
  const face =
    block.position[axis] + (Math.sign(normal[axis]) * block.size[axis]) / 2;
  const gap = Math.abs(decal.position[axis] - face);
  return (
    gap <= surfaceToleranceM + epsilon &&
    Math.abs(decal.position[along] - block.position[along]) +
      decal.size.w / 2 <=
      block.size[along] / 2 + epsilon &&
    Math.abs(decal.position.y - block.position.y) + decal.size.h / 2 <=
      block.size.y / 2 + epsilon
  );
}

/** Efekt otoczenia: para z kratki, iskry z przewodu, kapanie z rynny. */
export const ambientFxSchema = z.object({
  kind: z.enum(['steam', 'sparks', 'drip']),
  position: vec3,
  rate: nonnegative.optional(),
});
export type AmbientFxDef = z.infer<typeof ambientFxSchema>;

/** Model dekoracyjny bez kolizji: `/assets/models/city/<model>.glb`. */
export const decorSchema = z.object({
  model: textureId,
  position: vec3,
  yaw: finite.optional(),
  scale: positive.optional(),
});
export type DecorDef = z.infer<typeof decorSchema>;

/** Pola oprawy dołączane do schematu pokoju i układu areny. */
export const dressingFields = {
  /** Id motywu z `src/data/themes/<id>.json`; brak = `white` (dotychczasowy wygląd). */
  theme: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  signs: z.array(signSchema).optional(),
  lights: z.array(cityLightSchema).optional(),
  decals: z.array(decalSchema).optional(),
  ambientFx: z.array(ambientFxSchema).optional(),
  decor: z.array(decorSchema).optional(),
};
