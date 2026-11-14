import { RepeatWrapping, SRGBColorSpace, Texture } from 'three';

export type SurfaceTexture =
  | 'concrete'
  | 'asphalt'
  | 'asphalt_puddles'
  | 'metal_panel'
  | 'brick'
  | 'grime';
const entries = new Map<
  SurfaceTexture,
  { map: { value: Texture | null }; ready: { value: number } }
>();
// Lista z Vite pozwala pominąć żądanie brakującego pliku (bez błędów HTTP w konsoli).
const available = new Set(
  Object.keys(import.meta.glob('/public/assets/textures/surfaces/*.webp')).map(
    (path) => path.slice('/public'.length),
  ),
);

/** Ładowanie jest leniwe: testy headless i motyw white nie wykonują żądań. */
export function surfaceTexture(name: SurfaceTexture) {
  let entry = entries.get(name);
  if (entry) return entry;
  entry = { map: { value: null }, ready: { value: 0 } };
  entries.set(name, entry);
  if (typeof window !== 'undefined') {
    const target = entry;
    const path = `/assets/textures/surfaces/${name}.webp`;
    if (!available.has(path)) {
      console.warn(`Brak tekstury ${path}; użyto wzoru proceduralnego.`);
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
        texture.wrapS = texture.wrapT = RepeatWrapping;
        if (name !== 'asphalt_puddles') texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        target.map.value = texture;
        target.ready.value = 1;
      })
      .catch(() =>
        console.warn(`Brak tekstury ${path}; użyto wzoru proceduralnego.`),
      );
  }
  return entry;
}
