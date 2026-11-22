import type { Object3D } from 'three';
import { Mesh, MeshStandardMaterial, MeshToonMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle } from './materials';
import { applyFppSurfaces } from './fppMaterials';

/** Model, na który wraca widok broni, gdy brakuje pliku. */
export const FALLBACK_WEAPON_MODEL = 'blaster';
const surfaces = new Map<MeshToonMaterial, MeshStandardMaterial>();

/**
 * Wczytuje `/assets/models/<name>.glb` i nakłada materiały jak w widoku FPP
 * (styl gry + powierzchnie broni). Błąd ładowania przechodzi do wołającego.
 */
export async function loadWeaponScene(name: string): Promise<Object3D> {
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}.glb`);
  applyStyle(gltf.scene);
  applyFppSurfaces(gltf.scene);
  gltf.scene.traverse((node) => {
    if (!(node instanceof Mesh) || !(node.material instanceof MeshToonMaterial))
      return;
    const source = node.material;
    if (!source.name.startsWith('fpp_')) return;
    let material = surfaces.get(source);
    if (!material) {
      const grip = source.name === 'fpp_grip';
      material = new MeshStandardMaterial({
        color: source.color,
        emissive: source.emissive,
        metalness: grip ? 0.05 : 0.55,
        roughness: grip ? 0.8 : 0.4,
      });
      material.name = source.name;
      material.onBeforeCompile = source.onBeforeCompile;
      material.customProgramCacheKey = () => 'weaponPbrRim';
      surfaces.set(source, material);
    }
    node.material = material;
  });
  return gltf.scene;
}
