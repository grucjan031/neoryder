import { Mesh } from 'three';
import type { Material, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle } from '../render/materials';

// Własność szablonów i geometrii trwa przez sesję; pokoje zwalniają tylko swoje bryły.
const templates = new Map<string, Promise<Object3D | null>>();

export async function cloneRoomModel(name: string): Promise<Object3D | null> {
  let template = templates.get(name);
  if (!template) {
    template = new GLTFLoader()
      .loadAsync(`/assets/models/${name}.glb`)
      .then(({ scene }) => {
        const materials = new Set<Material>();
        scene.traverse((node) => {
          if (node instanceof Mesh)
            for (const material of Array.isArray(node.material)
              ? node.material
              : [node.material])
              materials.add(material);
        });
        applyStyle(scene);
        for (const material of materials) material.dispose();
        return scene;
      })
      .catch(() => null);
    templates.set(name, template);
  }
  return (await template)?.clone(true) ?? null;
}
