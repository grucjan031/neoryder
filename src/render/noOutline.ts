import type { Object3D, Scene } from 'three';

/** Flaga `userData.noOutline`: obiekt (efekt, przezroczysty quad) nie trafia do przebiegu normalnych/głębi konturu. */
const hidden: Object3D[] = [];

const restore = (): void => {
  for (const object of hidden) object.visible = true;
  hidden.length = 0;
};

export function hideNoOutline(scene: Scene): () => void {
  hidden.length = 0;
  scene.traverseVisible((object) => {
    if (object.userData.noOutline === true) hidden.push(object);
  });
  for (const object of hidden) object.visible = false;
  return restore;
}
