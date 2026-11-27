import { Mesh } from 'three';
import type { Material, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { DecorDef } from '../world/dressingSchema';
import { applyStyle } from './materials';

/** Prefiksy zestawów modeli miasta (public/assets/models/city/<model>.glb); nowy zestaw dopisz tutaj. */
export const CITY_MODEL_PREFIXES = [
  'city_',
  'port_',
  'rail_',
  'build_',
  'power_',
  'hw_',
  'roof_',
  'dock_',
  'wh_',
  'bw_',
  'mall_',
  'lab_',
  'off_',
] as const;
export function isCityModelFile(model: string | undefined): boolean {
  return (
    model !== undefined && CITY_MODEL_PREFIXES.some((p) => model.startsWith(p))
  );
}

/** Cache posiada geometrię i materiały; sceny usuwają tylko instancje dekoracji. */
const templates = new Map<string, Promise<Object3D | null>>();
export async function cloneCityModel(model: string): Promise<Object3D | null> {
  if (!/^[a-z0-9_]+$/.test(model)) return null;
  let template = templates.get(model);
  if (!template) {
    const path = `/assets/models/city/${model}.glb`;
    template = new GLTFLoader()
      .loadAsync(path)
      .then(({ scene }) => {
        const originals = new Set<Material>();
        scene.traverse((object) => {
          if (object instanceof Mesh)
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              originals.add(material);
        });
        applyStyle(scene);
        for (const material of originals) material.dispose();
        return scene;
      })
      .catch(() => {
        console.warn(`Brak modelu ${path}; użyto oprawy zastępczej.`);
        return null;
      });
    templates.set(model, template);
  }
  return (await template)?.clone(true) ?? null;
}

export async function loadDecor(
  root: Object3D,
  decor: readonly DecorDef[] | undefined,
  enabled: boolean,
): Promise<void> {
  if (!enabled) return;
  await Promise.all(
    (decor ?? []).map(async (def) => {
      const model = await cloneCityModel(def.model);
      if (!model) return;
      model.position.copy(def.position);
      model.rotation.y = def.yaw ?? 0;
      model.scale.setScalar(def.scale ?? 1);
      root.add(model);
    }),
  );
}
