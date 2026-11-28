import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Wspólne zasoby postaci kryjówki, sojuszników i cywilów. Instancje klonują szkielet. */
const loader = new GLTFLoader();
const templates = new Map<string, Promise<Object3D | null>>();
let clipLibrary: Promise<AnimationClip[]> | undefined;
export function loadBody(
  path = '/assets/models/npc_civilian.glb',
): Promise<Object3D | null> {
  let template = templates.get(path);
  if (!template) {
    template = loader
      .loadAsync(path)
      .then(({ scene }) => scene)
      .catch(() => null);
    templates.set(path, template);
  }
  return template;
}
export const loadClips = (): Promise<AnimationClip[]> =>
  (clipLibrary ??= loader
    .loadAsync('/assets/models/npc_anims.glb')
    .then(({ animations }) => animations)
    .catch(() => []));

export const inOutfit = (name: string, parts: readonly string[]): boolean =>
  parts.some((part) => name === part || name.startsWith(`${part}_`));
