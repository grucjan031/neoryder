import { MathUtils, Matrix4 } from 'three';
import type {
  Camera,
  DepthTexture,
  Vector3,
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

const savedProjection = new Matrix4();
const savedInverseProjection = new Matrix4();

export function hasViewmodel(): boolean {
  return roots.size > 0;
}

export function viewmodelNear(
  camera: PerspectiveCamera | OrthographicCamera,
): number {
  return 'isPerspectiveCamera' in camera
    ? Math.min(camera.near, Math.max(tuning.camera.viewmodelNearM, 1e-3))
    : camera.near;
}

/** FOV rąk i broni (stopnie): `tuning.camera.viewmodelFov`, a przy 0 bieżący FOV świata. */
export function viewmodelFov(
  camera: PerspectiveCamera | OrthographicCamera,
): number {
  if (!('isPerspectiveCamera' in camera)) return 0;
  const value = tuning.camera.viewmodelFov;
  return value > 0 ? Math.min(Math.max(value, 20), 120) : camera.fov;
}

interface LightScan {
  children: number;
  calls: number;
}
const lightScans = new WeakMap<Scene, LightScan>();
/** Zapasowe ponowne przeszukanie (w wywołaniach przebiegu) na wypadek światła dodanego głębiej w drzewie. */
const LIGHT_RESCAN_CALLS = 180;

/** Wymusza ponowne włączenie warstwy viewmodelu na światłach sceny w następnym przebiegu. */
export function invalidateViewmodelLights(scene: Scene): void {
  lightScans.delete(scene);
}

// Światła są zbierane z tą samą maską warstw co obiekty, więc viewmodel potrzebuje ich na swojej
// warstwie. Przeszukanie drzewa tylko przy pierwszym użyciu, zmianie liczby dzieci sceny
// i okresowo, nie w każdym przebiegu.
function enableViewmodelLights(scene: Scene): void {
  const scan = lightScans.get(scene);
  if (
    scan &&
    scan.children === scene.children.length &&
    ++scan.calls < LIGHT_RESCAN_CALLS
  )
    return;
  scene.traverse((object) => {
    if ('isLight' in object) object.layers.enable(VIEWMODEL_LAYER);
  });
  lightScans.set(scene, { children: scene.children.length, calls: 0 });
}

const anchorInverse = new Matrix4();

/**
 * Przesuwa punkt viewmodelu (np. lufę) tak, by kamera świata rzutowała go tam, gdzie przebieg
 * rąk (przy `viewmodelFov` innym niż FOV świata). Efekty rysowane w warstwie świata zaczynają
 * się wtedy dokładnie przy broni. Zmienia i zwraca podany wektor; macierz kamery musi być aktualna.
 */
export function viewmodelAnchor<T extends Vector3>(
  camera: Camera,
  point: T,
): T {
  if (!('isPerspectiveCamera' in camera)) return point;
  const perspective = camera as PerspectiveCamera;
  const handsFov = viewmodelFov(perspective);
  if (Math.abs(handsFov - perspective.fov) < 1e-3) return point;
  const scale =
    Math.tan(MathUtils.degToRad(perspective.fov) / 2) /
    Math.tan(MathUtils.degToRad(handsFov) / 2);
  point.applyMatrix4(anchorInverse.copy(perspective.matrixWorld).invert());
  point.x *= scale;
  point.y *= scale;
  return point.applyMatrix4(perspective.matrixWorld);
}

/**
 * Rysuje viewmodel na kolorze świata, z czystą głębią. Opcjonalna tekstura
 * głębi zachowuje oba przebiegi do odczytu w postprocessie.
 */
export function renderWithViewmodel(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera | OrthographicCamera,
  viewmodelDepth?: DepthTexture,
): void {
  if (!hasViewmodel()) {
    renderer.render(scene, camera);
    return;
  }
  const mask = camera.layers.mask;
  const autoClear = renderer.autoClear;
  const background = scene.background;
  const matrixAuto = scene.matrixWorldAutoUpdate;
  const near = camera.near;
  const fov = 'isPerspectiveCamera' in camera ? camera.fov : 0;
  const target = viewmodelDepth ? renderer.getRenderTarget() : null;
  const worldDepth = target?.depthTexture ?? null;
  const shadows = renderer.shadowMap;
  let shadowUpdate = shadows.autoUpdate;
  let shadowNeedsUpdate = shadows.needsUpdate;
  savedProjection.copy(camera.projectionMatrix);
  savedInverseProjection.copy(camera.projectionMatrixInverse);
  try {
    camera.layers.mask = 1;
    renderer.render(scene, camera);
    shadowUpdate = shadows.autoUpdate;
    shadowNeedsUpdate = shadows.needsUpdate;
    // Użyj gotowych map świata także do oświetlenia rąk.
    shadows.autoUpdate = false;
    shadows.needsUpdate = false;
    camera.near = viewmodelNear(camera);
    const handsFov = viewmodelFov(camera);
    if (handsFov !== fov && 'isPerspectiveCamera' in camera)
      camera.fov = handsFov;
    if (camera.near !== near || handsFov !== fov)
      camera.updateProjectionMatrix();
    enableViewmodelLights(scene);
    camera.layers.mask = 1 << VIEWMODEL_LAYER;
    renderer.autoClear = false;
    // Tło z koloru wymusza czyszczenie bufora, a viewmodel ma dojść do istniejącego obrazu.
    scene.background = null;
    // Macierze świata policzył pierwszy render tego przebiegu; drugi nie przechodzi drzewa ponownie.
    scene.matrixWorldAutoUpdate = false;
    if (target && viewmodelDepth) {
      target.depthTexture = viewmodelDepth;
      renderer.setRenderTarget(target);
    }
    renderer.clearDepth();
    renderer.render(scene, camera);
  } finally {
    camera.near = near;
    if ('isPerspectiveCamera' in camera) camera.fov = fov;
    camera.projectionMatrix.copy(savedProjection);
    camera.projectionMatrixInverse.copy(savedInverseProjection);
    camera.layers.mask = mask;
    shadows.autoUpdate = shadowUpdate;
    shadows.needsUpdate = shadowNeedsUpdate;
    renderer.autoClear = autoClear;
    scene.background = background;
    scene.matrixWorldAutoUpdate = matrixAuto;
    if (target && target.depthTexture !== worldDepth) {
      target.depthTexture = worldDepth;
      renderer.setRenderTarget(target);
    }
  }
}
