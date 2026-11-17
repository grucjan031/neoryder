import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Object3D } from 'three';
import { weaponModelOf } from '../combat/weapons/weaponSchema';
import { attachModuleVisuals } from './weaponModuleVisuals';
import { FALLBACK_WEAPON_MODEL, loadWeaponScene } from './weaponModelLoader';

/** Domyślny rozmiar podglądu w CSS px (warsztat kryjówki). */
export const PREVIEW_WIDTH = 360;
export const PREVIEW_HEIGHT = 220;

const FOV = 28;
/** Ile szerokości kadru zajmuje broń (przekątna rzutu na poziom). */
const FILL = 0.7;
/** Widok z boku 3/4: lufa lekko do kamery, bok z ogniwem (-x) zwrócony ku niej. */
const BASE_YAW = Math.PI / 2 + 0.45;
const BASE_PITCH = 0.12;
const MAX_PITCH = MathUtils.degToRad(25);
const DRAG_YAW = 0.011;
const DRAG_PITCH = 0.006;
const IDLE_BEFORE_SPIN_S = 3;
const SPIN_RAD_PER_S = MathUtils.degToRad(15);
/** Powrót nachylenia po puszczeniu (1/s). */
const PITCH_RETURN = 2.5;

/** Czy środowisko ma WebGL2 (jsdom i testy go nie mają: wtedy podgląd się nie tworzy). */
export function canCreateWeaponPreview(): boolean {
  return typeof WebGL2RenderingContext !== 'undefined';
}

/**
 * Obracany podgląd 3D broni z założonymi modułami (warsztat kryjówki). Własny renderer
 * na podanym canvasie; klatki powstają tylko gdy canvas jest widoczny i coś się zmienia
 * (przeciąganie, autoobrót, nowa broń albo rozmiar). Model jak w FPP, moduły na klonie.
 */
export class WeaponPreview {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.01, 50);
  private readonly pivot = new Group();
  private readonly models = new Map<string, Promise<Object3D | null>>();
  private readonly loaded: Object3D[] = [];
  private readonly motion: MediaQueryList | null;
  private readonly observer: IntersectionObserver | null;
  private current: Object3D | null = null;
  private detachModules: (() => void) | null = null;
  private radius = 0.3;
  private width = PREVIEW_WIDTH;
  private height = PREVIEW_HEIGHT;
  private yaw = BASE_YAW;
  private pitch = BASE_PITCH;
  private idle = IDLE_BEFORE_SPIN_S;
  private dragging: { id: number; x: number; y: number } | null = null;
  private dirty = true;
  private running = false;
  private visible = true;
  private frame = 0;
  private last = 0;
  private token = 0;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      // Piksele zostają w buforze: odczyt z canvasa (testy) i brak migania przy braku klatki.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.scene.add(this.pivot);
    // Klucz: ciepła biel z prawej-góry; wypełnienie: chłodny błękit z lewej-tyłu.
    const key = new DirectionalLight('#fff1dc', 2.4);
    key.position.set(2, 3, 3);
    const fill = new DirectionalLight('#6ea8ff', 1.1);
    fill.position.set(-3, 0.6, -2);
    this.scene.add(key, fill, new AmbientLight('#8aa0c8', 0.7));

    this.motion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            this.visible = entry.isIntersecting;
            if (this.visible) this.start();
            else this.stop();
          })
        : null;
    this.observer?.observe(canvas);
    this.placeCamera();
    this.start();
  }

  /** Wczytuje broń i nakłada moduły; poprzedni model znika dopiero po załadowaniu nowego. */
  async show(weaponId: string, moduleIds: readonly string[]): Promise<void> {
    if (this.disposed) return;
    const token = ++this.token;
    const name = weaponModelOf(weaponId) ?? FALLBACK_WEAPON_MODEL;
    let source = await this.fetchModel(name);
    if (!source && name !== FALLBACK_WEAPON_MODEL)
      source = await this.fetchModel(FALLBACK_WEAPON_MODEL);
    if (this.disposed || token !== this.token || !source) return;
    this.clearCurrent();
    // Klon współdzieli geometrie i materiały z oryginałem; moduły dodajemy tylko na klonie.
    const model = source.clone(true);
    this.detachModules = attachModuleVisuals(model, moduleIds);
    model.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(model);
    if (!box.isEmpty()) {
      const size = box.getSize(new Vector3());
      model.position.sub(box.getCenter(new Vector3()));
      this.radius =
        Math.max(Math.hypot(size.x, size.z), size.y * 1.4, 0.01) / 2;
    }
    this.current = model;
    // Po zmianie broni/modułu wracamy do kadru 3/4, żeby zmiana była od razu widoczna.
    this.yaw = BASE_YAW;
    this.pitch = BASE_PITCH;
    this.idle = 0;
    this.pivot.add(model);
    this.placeCamera();
    this.dirty = true;
    this.start();
  }

  setSize(width: number, height: number): void {
    if (this.disposed || width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.placeCamera();
    this.dirty = true;
  }

  /** Włącza pętlę klatek (panel otwarty). Powtórne wywołanie nic nie zmienia. */
  start(): void {
    if (this.disposed || this.running || !this.visible) return;
    this.running = true;
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Zatrzymuje pętlę klatek (panel zamknięty lub canvas niewidoczny). */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.observer?.disconnect();
    const { canvas } = this;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onUp);
    this.clearCurrent();
    // Materiały modeli są współdzielone z grą (getMaterial/fppMaterial) i zostają;
    // własne geometrie wczytanych oryginałów i materiały modułów zwalniamy.
    const geometries = new Set<BufferGeometry>();
    for (const root of this.loaded)
      root.traverse((node) => {
        if (node instanceof Mesh) geometries.add(node.geometry);
      });
    for (const geometry of geometries) geometry.dispose();
    this.loaded.length = 0;
    this.models.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private clearCurrent(): void {
    this.detachModules?.();
    this.detachModules = null;
    if (this.current) this.pivot.remove(this.current);
    this.current = null;
  }

  private fetchModel(name: string): Promise<Object3D | null> {
    let promise = this.models.get(name);
    if (!promise) {
      promise = loadWeaponScene(name).then(
        (scene) => {
          if (this.disposed) {
            scene.traverse((node) => {
              if (node instanceof Mesh) node.geometry.dispose();
            });
            return null;
          }
          this.loaded.push(scene);
          return scene;
        },
        () => null,
      );
      this.models.set(name, promise);
    }
    return promise;
  }

  /** Kamera na osi Z tak, by przekątna broni zajmowała ~70% szerokości (i mieściła się w pionie). */
  private placeCamera(): void {
    const half = Math.tan(MathUtils.degToRad(FOV / 2));
    const fitWidth = this.radius / FILL / (half * this.camera.aspect);
    const fitHeight = this.radius / FILL / half / 1.6;
    this.camera.position.set(0, 0, Math.max(fitWidth, fitHeight));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (this.dragging) return;
    this.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.idle = 0;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.start();
  };

  private readonly onMove = (event: PointerEvent): void => {
    const drag = this.dragging;
    if (!drag || drag.id !== event.pointerId) return;
    this.yaw += (event.clientX - drag.x) * DRAG_YAW;
    this.pitch = MathUtils.clamp(
      this.pitch + (event.clientY - drag.y) * DRAG_PITCH,
      -MAX_PITCH,
      MAX_PITCH,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
    this.idle = 0;
    this.dirty = true;
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (this.dragging?.id !== event.pointerId) return;
    this.dragging = null;
    this.idle = 0;
    this.canvas.releasePointerCapture?.(event.pointerId);
  };

  private readonly tick = (time: number): void => {
    if (!this.running || this.disposed) return;
    const dt = this.last ? Math.min((time - this.last) / 1000, 0.1) : 0;
    this.last = time;
    if (!this.dragging) {
      this.idle += dt;
      if (this.idle >= IDLE_BEFORE_SPIN_S) {
        if (!this.motion?.matches) {
          this.yaw += SPIN_RAD_PER_S * dt;
          this.dirty = true;
        }
        if (Math.abs(this.pitch - BASE_PITCH) > 0.001) {
          this.pitch +=
            (BASE_PITCH - this.pitch) * Math.min(1, PITCH_RETURN * dt);
          this.dirty = true;
        }
      }
    }
    if (this.dirty) {
      this.dirty = false;
      this.pivot.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.renderer.render(this.scene, this.camera);
    }
    this.frame = requestAnimationFrame(this.tick);
  };
}
