import type { Object3D, Scene } from 'three';

/** Flaga `userData.noOutline`: obiekt (efekt, przezroczysty quad) nie trafia do przebiegu normalnych/głębi konturu. */
export function hideNoOutline(scene: Scene): () => void {
  const hidden: Object3D[] = [];
  scene.traverseVisible((object) => {
    if (object.userData.noOutline === true) hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  return () => {
    for (const object of hidden) object.visible = true;
  };
}
