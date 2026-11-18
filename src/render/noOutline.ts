import { AdditiveBlending } from 'three';
import type { Material, Object3D, Scene } from 'three';

/**
 * Obiekty bez konturu nie trafiają do przebiegu normalnych/głębi:
 * - jawna flaga `userData.noOutline` (efekt, przezroczysty quad),
 * - automatycznie: przezroczyste materiały addytywne albo bez zapisu głębi (poświaty, stożki
 *   światła, halo) — gruby tusz stylu komiksowego rysowałby im twardą krawędź.
 */
const hidden: Object3D[] = [];

const restore = (): void => {
  for (const object of hidden) object.visible = true;
  hidden.length = 0;
};

const glowLike = (material: Material): boolean =>
  material.transparent &&
  (material.blending === AdditiveBlending || !material.depthWrite);

export function skipsOutline(object: Object3D): boolean {
  if (object.userData.noOutline === true) return true;
  const material = (object as { material?: Material | Material[] }).material;
  if (!material) return false;
  return Array.isArray(material)
    ? material.length > 0 && material.every(glowLike)
    : glowLike(material);
}

export function hideNoOutline(scene: Scene): () => void {
  hidden.length = 0;
  scene.traverseVisible((object) => {
    if (skipsOutline(object)) hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  return restore;
}
