import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle } from './materials';
import { applyFppSurfaces } from './fppMaterials';

/** Model, na który wraca widok broni, gdy brakuje pliku. */
export const FALLBACK_WEAPON_MODEL = 'blaster';

/**
 * Wczytuje `/assets/models/<name>.glb` i nakłada materiały jak w widoku FPP
 * (styl gry + powierzchnie broni). Błąd ładowania przechodzi do wołającego.
 */
export async function loadWeaponScene(name: string): Promise<Object3D> {
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}.glb`);
  applyStyle(gltf.scene);
  applyFppSurfaces(gltf.scene);
  return gltf.scene;
}
