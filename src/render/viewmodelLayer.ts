import type {
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { tuning } from '../core/tuning';

/** Warstwa Three.js, na której rysowane są ręce i trzymany przedmiot. */
export const VIEWMODEL_LAYER = 1;

const roots = new Set<Object3D>();

/** Rejestruje korzeń viewmodelu: dopóki jakiś istnieje, pipeline robi dodatkowy przebieg. */
export function registerViewmodel(root: Object3D): () => void {
  roots.add(root);
  return () => {
    roots.delete(root);
  };
}

/** Ustawia warstwę viewmodelu na korzeniu i wszystkich potomkach (także wczytanych później). */
export function applyViewmodelLayer(root: Object3D): void {
  root.traverse((object) => {
    if (object.layers.mask !== 1 << VIEWMODEL_LAYER)
      object.layers.set(VIEWMODEL_LAYER);
  });
}

const savedProjection = [0, 0, 0, 0];

export function hasViewmodel(): boolean {
  return roots.size > 0;
}

/**
 * Rysuje scenę, a potem warstwę viewmodelu tym samym celem bez czyszczenia. Głębia viewmodelu
 * jest ściśnięta do pierwszych `tuning.render.viewmodelDepth` zakresu bufora (macierz projekcji
 * kamery tylko w tym przebiegu), więc zawsze wygrywa ze światem, a między sobą zachowuje
 * poprawną kolejność. Działa z materiałami nadpisanymi (normalne, maska bloomu).
 */
export function renderWithViewmodel(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera | OrthographicCamera,
): void {
  if (!hasViewmodel()) {
    renderer.render(scene, camera);
    return;
  }
  const mask = camera.layers.mask;
  const autoClear = renderer.autoClear;
  const background = scene.background;
  const e = camera.projectionMatrix.elements;
  savedProjection[0] = e[2]!;
  savedProjection[1] = e[6]!;
  savedProjection[2] = e[10]!;
  savedProjection[3] = e[14]!;
  try {
    camera.layers.mask = 1;
    renderer.render(scene, camera);
    const s = Math.min(Math.max(tuning.render.viewmodelDepth, 1e-5), 1);
    // z' = s * z + (s - 1) * w: głębia NDC z [-1, 1] trafia do [-1, -1 + 2s].
    e[2] = s * e[2]! + (s - 1) * e[3]!;
    e[6] = s * e[6]! + (s - 1) * e[7]!;
    e[10] = s * e[10]! + (s - 1) * e[11]!;
    // Zachowaj bliskie odcięcie FPP przy skalowaniu obu płaszczyzn świata.
    const clipScale =
      'isPerspectiveCamera' in camera
        ? Math.min(1, tuning.horizon.legacyNearM / camera.near)
        : 1;
    e[14] = s * e[14]! * clipScale + (s - 1) * e[15]!;
    // Światła są zbierane z tą samą maską warstw co obiekty, więc viewmodel potrzebuje ich na swojej warstwie.
    scene.traverse((object) => {
      if ('isLight' in object) object.layers.enable(VIEWMODEL_LAYER);
    });
    camera.layers.mask = 1 << VIEWMODEL_LAYER;
    renderer.autoClear = false;
    // Tło z koloru wymusza czyszczenie bufora, a viewmodel ma dojść do istniejącego obrazu.
    scene.background = null;
    renderer.render(scene, camera);
  } finally {
    e[2] = savedProjection[0]!;
    e[6] = savedProjection[1]!;
    e[10] = savedProjection[2]!;
    e[14] = savedProjection[3]!;
    camera.layers.mask = mask;
    renderer.autoClear = autoClear;
    scene.background = background;
  }
}
