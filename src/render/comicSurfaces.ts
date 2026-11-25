import { activeLook } from './lookPresets';

/**
 * Tekstury komiksowe (`public/assets/textures/komiks/surfaces/komiks_<id>.webp`) zastępują
 * powierzchnie o tym samym id, gdy aktywny jest styl komiksowy (`?look=a|b|c`, domyślnie b).
 * `?look=off` zostawia dawne tekstury. Maski (`grime`, `asphalt_puddles`) i barwne
 * powierzchnie zestawów (kontenery, dźwigi) nie mają odpowiedników i zostają bez zmian.
 */
export const COMIC_SURFACES = new Set([
  'mall_stone_floor',
  'mall_terrazzo_inlay',
  'mall_acoustic_ceiling',
  'concrete',
  'asphalt',
  'brick',
  'metal_panel',
  'rust_metal',
  'corrugated',
  'plaster',
  'wood_planks',
  'tread_plate',
  'tiles_wall',
  'roof_tar',
  'paving',
]);

/** Powierzchnie dużych aren rysowane komiksowym odpowiednikiem innego materiału. */
export const COMIC_ALIASES: Readonly<Record<string, string>> = {
  overpass_concrete: 'concrete',
  quay_concrete: 'concrete',
};

/** Ścieżka pliku tekstury względem `/assets/textures/` (bez rozszerzenia). */
export function resolveTextureKey(
  folder: string,
  id: string,
  comic = activeLook() !== null,
): string {
  if (comic && folder === 'surfaces') {
    const target = COMIC_ALIASES[id] ?? id;
    if (COMIC_SURFACES.has(target)) return `komiks/surfaces/komiks_${target}`;
  }
  return `${folder}/${id}`;
}
