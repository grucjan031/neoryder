import { RepeatWrapping, SRGBColorSpace, Texture } from 'three';
import { resolveTextureKey } from './comicSurfaces';

export type SurfaceTexture =
  | 'off_carpet_tile'
  | 'off_polished_granite'
  | 'off_wood_slat_wall'
  | 'med_resin_floor'
  | 'med_wall_panel'
  | 'med_atrium_terrazzo'
  | 'lab_epoxy_floor'
  | 'lab_bunker_concrete'
  | 'lab_cleanroom_wall'
  | 'mall_stone_floor'
  | 'mall_terrazzo_inlay'
  | 'mall_acoustic_ceiling'
  | 'container_corrugated_navy'
  | 'container_corrugated_olive'
  | 'container_corrugated_ochre'
  | 'container_corrugated_graphite'
  | 'crane_paint'
  | 'quay_concrete'
  | 'quay_lines'
  | 'rubber_fender'
  | 'steel_grating'
  | 'overpass_concrete'
  | 'smog_soot_wall'
  | 'roof_tar'
  | 'roof_hvac_metal'
  | 'market_tarp'
  | 'hazard_stripes_worn'
  | 'formwork_plywood'
  | 'concrete_raw_cast'
  | 'slag_heap'
  | 'cooling_tower_concrete'
  | 'turbine_hall_floor'
  | 'ship_hull_paint'
  | 'ship_deck_steel'
  | 'rail_ballast'
  | 'rail_sleeper_concrete'
  | 'snow_asphalt'
  | 'snow_concrete'
  | 'maglev_body_panel'
  | 'snow'
  | 'gas_station_tiles'
  | 'highway_asphalt_worn'
  | 'scaffold_planks'
  | 'hazard_stripes_worn'
  | 'flood_brick_algae'
  | 'boardwalk_planks'
  | 'canal_stone_wall'
  | 'excavation_dirt'
  | 'scaffold_planks'
  | 'hazard_stripes_worn'
  | 'concrete'
  | 'asphalt'
  | 'asphalt_puddles'
  | 'metal_panel'
  | 'brick'
  | 'grime'
  | 'painted_metal'
  | 'rust_metal'
  | 'corrugated'
  | 'plastic'
  | 'rubber'
  | 'wood_planks'
  | 'tarp'
  | 'tread_plate'
  | 'tiles_wall'
  | 'paving'
  | 'tech_panel'
  | 'plaster';
/** Foldery tekstur ładowanych przez materiały (powierzchnie i nadruki modeli). */
export type TextureFolder = 'surfaces' | 'labels' | 'screens' | 'atlas';
export interface TextureEntry {
  map: { value: Texture | null };
  ready: { value: number };
}
const entries = new Map<string, TextureEntry>();
const readyListeners = new Map<string, Array<(texture: Texture) => void>>();
// Lista z Vite pozwala pominąć żądanie brakującego pliku (bez błędów HTTP w konsoli).
const available = new Set(
  Object.keys(
    import.meta.glob(
      '/public/assets/textures/{surfaces,labels,screens,atlas}/*.webp',
    ),
  ).map((path) => path.slice('/public'.length)),
);
for (const path of Object.keys(
  import.meta.glob('/public/assets/textures/komiks/surfaces/*.webp'),
))
  available.add(path.slice('/public'.length));

/**
 * Leniwe ładowanie współdzielonej tekstury; testy headless i motyw white nie
 * wykonują żądań. Tekstury żyją przez całą sesję (jak cache materiałów).
 */
export function assetTexture(
  folder: TextureFolder,
  id: string,
  onReady?: (texture: Texture) => void,
): TextureEntry {
  const key = `${folder}/${id}`;
  let entry = entries.get(key);
  if (entry) {
    if (onReady) {
      if (entry.map.value) onReady(entry.map.value);
      else readyListeners.get(key)?.push(onReady);
    }
    return entry;
  }
  entry = { map: { value: null }, ready: { value: 0 } };
  entries.set(key, entry);
  readyListeners.set(key, onReady ? [onReady] : []);
  if (typeof window !== 'undefined') {
    const target = entry;
    const path = `/assets/textures/${resolveTextureKey(folder, id)}.webp`;
    if (!available.has(path)) {
      console.warn(`Brak tekstury ${path}; użyto wzoru zastępczego.`);
      readyListeners.delete(key);
      return entry;
    }
    void fetch(path)
      .then(async (response) => {
        if (
          !response.ok ||
          !response.headers.get('content-type')?.startsWith('image/')
        )
          throw new Error(path);
        const bitmap = await createImageBitmap(await response.blob());
        const texture = new Texture(bitmap);
        if (folder === 'surfaces')
          texture.wrapS = texture.wrapT = RepeatWrapping;
        if (id !== 'asphalt_puddles') texture.colorSpace = SRGBColorSpace;
        // ImageBitmap i tak nie jest odwracany przez WebGL; UV glTF zakładają brak odwrócenia.
        texture.flipY = false;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        target.map.value = texture;
        target.ready.value = 1;
        for (const listener of readyListeners.get(key) ?? []) listener(texture);
        readyListeners.delete(key);
      })
      .catch(() => {
        readyListeners.delete(key);
        console.warn(`Brak tekstury ${path}; użyto wzoru zastępczego.`);
      });
  }
  return entry;
}

export function surfaceTexture(name: SurfaceTexture): TextureEntry {
  return assetTexture('surfaces', name);
}
