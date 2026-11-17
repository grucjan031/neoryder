import {
  BoxGeometry,
  Color,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  ShapeGeometry,
  Shape,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EntityId, EventBus } from '../core/events';
import { tuning as defaultTuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import { applyStyle, getMaterial } from './materials';
import { palette } from './palette';
import { HandRig } from './handRig';
import { attachModuleVisuals } from './weaponModuleVisuals';
import {
  applyFppSurfaces,
  fppGlowMaterial,
  fppGlowTexture,
  markGlow,
} from './fppMaterials';

/** Broń w prawej dłoni: pozycja w metrach, obrót YXZ i odrzut po strzale. */
const POSE = {
  pos: new Vector3(0.23, -0.17, -0.41),
  rot: new Euler(0.08, 0.15, -0.04, 'YXZ'),
};
/** Broń dwuręczna (węzeł support daleko przed chwytem): bardziej w lewo i wyżej, by obie dłonie były w kadrze. */
const TWO_HAND_POSE = {
  pos: new Vector3(0.15, -0.27, -0.45),
  rot: new Euler(0.1, 0.11, -0.15, 'YXZ'),
};
/** Celowanie: broń na środku kadru, lufa wzdłuż osi widoku („przy oku”). */
const AIM_POSE = {
  pos: new Vector3(0.0, -0.145, -0.4),
  rot: new Euler(0, 0, 0, 'YXZ'),
};
const AIM_TWO_HAND_POSE = {
  pos: new Vector3(0.0, -0.215, -0.44),
  rot: new Euler(0.02, 0, 0, 'YXZ'),
};
/** Obrót lewej dłoni wokół osi Y węzła support: przedramię od lewego dołu kadru. */
const TWO_HAND_SUPPORT_YAW = -1.4;
/** Przesunięcie lewej dłoni do przodu (pod lufę) i obrót przedramienia w dół, w osiach węzła support. */
const TWO_HAND_SUPPORT_FORWARD = -0.08;
const TWO_HAND_SUPPORT_PITCH = 0.8;
const TWO_HAND_SUPPORT_Z = -0.15;
const RECOIL_BACK = 0.06;
const RECOIL_PITCH = 0.12;
const RECOIL_RECOVER = 14;
const FALLBACK_MODEL = 'blaster';
const FLASH_POINTS = 8;
const FLASH_INNER = 0.3;
/** Ciepło: cyan -> biel rozgrzanego metalu (czerwień jest zarezerwowana dla wrogów). */
const COLD = new Color(palette.cyan);
const HOT = new Color('#ffffff').multiplyScalar(1.6);
const OVERHEAT_DIM = new Color(palette.cyan).multiplyScalar(0.6);
/** Poświata wylotu rośnie z ciepłem (rozmiar względem błysku). */
const HEAT_GLOW_SIZE = 0.09;

export interface FppBlasterOptions {
  /** Nazwa modelu (`<nazwa>.glb`) dla id broni; brak = model blastera. */
  modelOf?: (weaponId: string) => string | undefined;
  modulesOf?: (weaponId: string) => readonly string[];
  tuning?: Pick<Tuning, 'weapons' | 'player'>;
  /** Ustawienia dostępności (domyślnie zapisane ustawienia gracza). */
  settings?: Pick<Settings, 'flashes'>;
}

/** Krycie płatków błysku: pełne i przygaszone przy wyłączonych „Błyskach ekranu”. */
const FLASH_CONE_OPACITY = 0.9;
const FLASH_CONE_DIM_OPACITY = 0.3;

function starGeometry(): ShapeGeometry {
  const shape = new Shape();
  for (let i = 0; i < FLASH_POINTS * 2; i++) {
    const r = i % 2 === 0 ? 1 : FLASH_INNER;
    const a = (i / (FLASH_POINTS * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new ShapeGeometry(shape);
}

/**
 * Broń gracza w widoku FPP (prawa ręka). Model bieżącej broni (pole `model` danych, cache per model,
 * podmiana przy weapon_switched; fallback blaster.glb, potem bryła zastępcza). Otwory chłodzenia
 * (heat_vents, heat_cell) zmieniają kolor z cyan na czerwień wraz z ciepłem, przegrzanie pulsuje;
 * strzał gracza daje krótki odrzut i cyjanowy błysk wylotu w węźle muzzle. Dane wyłącznie ze
 * zdarzeń heat_changed / weapon_fired / weapon_switched.
 */
export class FppBlaster {
  readonly root = new Group();
  readonly hand = new HandRig('R');
  private readonly heatMaterial = new MeshBasicMaterial({
    color: COLD.clone(),
    toneMapped: false,
  });
  private readonly flashMaterial = fppGlowMaterial(palette.cyan, 0.85);
  private readonly flashCoreMaterial = fppGlowMaterial(
    '#ffffff',
    1,
    fppGlowTexture(),
  );
  private readonly flashConeMaterial = fppGlowMaterial(
    '#8ff6ff',
    FLASH_CONE_OPACITY,
    fppGlowTexture(),
  );
  private readonly heatGlowMaterial = fppGlowMaterial(
    '#ffffff',
    0,
    fppGlowTexture(),
  );
  private readonly flashGeometry = starGeometry();
  private readonly quadGeometry = new PlaneGeometry(1, 1);
  private readonly heatGlows = new Map<Object3D, Object3D>();
  private readonly fallback = new Mesh(
    new BoxGeometry(0.06, 0.1, 0.32),
    getMaterial('interactive'),
  );
  private readonly models = new Map<string, Promise<Object3D | null>>();
  private readonly flashes = new Map<Object3D, Object3D>();
  private readonly tuning: Pick<Tuning, 'weapons' | 'player'>;
  private readonly settings: Pick<Settings, 'flashes'> | undefined;
  private readonly modelOf: (weaponId: string) => string | undefined;
  private loadModels = false;
  private current: Object3D | null = null;
  private wanted = FALLBACK_MODEL;
  private weaponId: string | undefined;
  private readonly modulesOf: (weaponId: string) => readonly string[];
  private detachModules: (() => void) | undefined;
  private heat = 0;
  private overheated = false;
  private recoil = 0;
  private flashLeft = 0;
  private time = 0;
  private disposed = false;
  private readonly off: (() => void)[] = [];
  private readonly tmp = {
    m: new Matrix4(),
    q: new Quaternion(),
    e: new Euler(0, 0, 0, 'YXZ'),
    v: new Vector3(),
    s: new Vector3(1, 1, 1),
  };

  constructor(bus: EventBus, owner: EntityId, options: FppBlasterOptions = {}) {
    this.tuning = options.tuning ?? defaultTuning;
    this.modelOf = options.modelOf ?? (() => undefined);
    this.modulesOf = options.modulesOf ?? (() => []);
    this.settings = options.settings;
    this.root.matrixAutoUpdate = false;
    this.root.add(this.fallback);
    this.root.add(this.hand.root);
    this.off.push(
      bus.on('heat_changed', ({ id, current, max, overheated }) => {
        if (id !== owner) return;
        this.heat = max > 0 ? current / max : 0;
        this.overheated = overheated;
      }),
      bus.on('weapon_fired', ({ owner: who }) => {
        if (who !== owner) return;
        this.recoil = 1;
        this.flashLeft = this.tuning.weapons.muzzleFlashS;
        this.applyFlashSetting();
      }),
      bus.on('weapon_switched', ({ owner: who, weapon }) => {
        if (who !== owner) return;
        this.weaponId = weapon;
        this.wanted = this.modelOf(weapon) ?? FALLBACK_MODEL;
        void this.show(this.wanted);
      }),
    );
  }

  async load(loadModels = true): Promise<void> {
    this.loadModels = loadModels;
    await this.hand.load(loadModels);
    if (!loadModels) return;
    await this.show(this.wanted);
  }

  private async show(name: string): Promise<void> {
    if (!this.loadModels) return;
    let model = await this.fetchModel(name);
    if (!model && name !== FALLBACK_MODEL)
      model = await this.fetchModel(FALLBACK_MODEL);
    if (this.disposed || name !== this.wanted || !model) return;
    this.setCurrent(model);
  }

  private setCurrent(model: Object3D): void {
    this.detachModules?.();
    if (this.current) this.root.remove(this.current);
    this.root.remove(this.fallback);
    this.current = model;
    this.root.add(model);
    this.detachModules =
      this.weaponId === undefined
        ? undefined
        : attachModuleVisuals(model, this.modulesOf(this.weaponId));
    this.flashLeft = 0;
  }

  private fetchModel(name: string): Promise<Object3D | null> {
    let promise = this.models.get(name);
    if (!promise) {
      promise = this.loadModel(name);
      this.models.set(name, promise);
    }
    return promise;
  }

  private async loadModel(name: string): Promise<Object3D | null> {
    try {
      const gltf = await new GLTFLoader().loadAsync(
        `/assets/models/${name}.glb`,
      );
      applyStyle(gltf.scene);
      applyFppSurfaces(gltf.scene);
      // Własny materiał dla elementów ciepła — współdzielony materiał gracza zostaje cyan.
      let muzzle: Object3D | null = null;
      gltf.scene.traverse((node: Object3D) => {
        if (node.name === 'muzzle') muzzle = node;
        if (
          (node.name === 'heat_vents' || node.name === 'heat_cell') &&
          node instanceof Mesh
        )
          node.material = this.heatMaterial;
      });
      if (muzzle) this.attachFlash(gltf.scene, muzzle);
      return gltf.scene;
    } catch {
      return null;
    }
  }

  /**
   * „Błyski ekranu” wyłączone: bez białego rdzenia i jasnej gwiazdy, zostaje przygaszony
   * cyjanowy płatek (strzał nadal czytelny). Sprawdzane przy każdym strzale, jak w wybuchach.
   */
  private applyFlashSetting(): void {
    const bright = (this.settings ?? loadSettings()).flashes;
    this.flashMaterial.visible = bright;
    this.flashCoreMaterial.visible = bright;
    this.flashConeMaterial.opacity = bright
      ? FLASH_CONE_OPACITY
      : FLASH_CONE_DIM_OPACITY;
  }

  private attachFlash(model: Object3D, muzzle: Object3D): void {
    const flash = new Group();
    flash.name = 'module_muzzle_flash';
    flash.visible = false;
    // Gwiazda (addytywna, bez konturu) w płaszczyźnie XY, miękki biały rdzeń
    // i dwa skrzyżowane „płatki” wzdłuż lufy, widoczne z boku broni.
    const front = new Mesh(this.flashGeometry, this.flashMaterial);
    front.name = 'flash_star';
    const back = new Mesh(this.flashGeometry, this.flashMaterial);
    back.rotation.z = Math.PI / FLASH_POINTS;
    back.scale.setScalar(0.6);
    back.name = 'flash_star';
    const core = new Mesh(this.quadGeometry, this.flashCoreMaterial);
    core.name = 'flash_core';
    core.scale.setScalar(1.3);
    flash.add(front, back, core);
    for (const roll of [0, Math.PI / 2]) {
      const cone = new Mesh(this.quadGeometry, this.flashConeMaterial);
      cone.name = 'flash_cone';
      cone.rotation.set(Math.PI / 2, 0, 0);
      cone.rotateY(roll);
      cone.scale.set(0.9, 2.6, 1);
      cone.position.z = -0.9;
      flash.add(cone);
    }
    flash.traverse((node) => {
      if (node instanceof Mesh) node.renderOrder = 3;
    });
    markGlow(flash);
    muzzle.add(flash);
    this.flashes.set(model, flash);
    const heat = new Mesh(this.quadGeometry, this.heatGlowMaterial);
    heat.name = 'heat_glow';
    heat.scale.setScalar(HEAT_GLOW_SIZE);
    heat.renderOrder = 3;
    markGlow(heat);
    muzzle.add(heat);
    this.heatGlows.set(model, heat);
  }

  /**
   * frameDt: czas rzeczywisty klatki (odrzut i puls działają też w hitstopie); `aim` 0–1
   * przesuwa broń do pozycji przy oku i zmniejsza odrzut (`tuning.player.aim.recoil`).
   */
  place(cameraMatrix: Matrix4, frameDt: number, aim = 0): void {
    const dt = Math.max(0, Math.min(frameDt, 0.1));
    this.time += dt;
    this.recoil *= Math.exp(-RECOIL_RECOVER * dt);
    const pulse = this.overheated ? 0.5 + 0.5 * Math.sin(this.time * 18) : 0;
    const heat = Math.min(1, this.heat);
    if (this.overheated)
      this.heatMaterial.color.copy(OVERHEAT_DIM).lerp(HOT, pulse);
    else this.heatMaterial.color.copy(COLD).lerp(HOT, heat * heat);
    // Rozgrzany wylot: biało-cyjanowa poświata, przy przegrzaniu pulsuje.
    this.heatGlowMaterial.opacity = this.overheated
      ? 0.35 + 0.45 * pulse
      : 0.7 * heat * heat;
    this.heatGlowMaterial.color.copy(COLD).lerp(HOT, 0.4 + 0.6 * heat);

    const { m, q, e, v, s } = this.tmp;
    const pose = this.twoHanded ? TWO_HAND_POSE : POSE;
    const sight = this.twoHanded ? AIM_TWO_HAND_POSE : AIM_POSE;
    const k = Math.min(1, Math.max(0, aim));
    const recoil = this.recoil * (1 + (this.tuning.player.aim.recoil - 1) * k);
    const mix = (a: number, b: number): number => a + (b - a) * k;
    e.set(
      mix(pose.rot.x, sight.rot.x) + recoil * RECOIL_PITCH,
      mix(pose.rot.y, sight.rot.y),
      mix(pose.rot.z, sight.rot.z),
      'YXZ',
    );
    q.setFromEuler(e);
    v.copy(pose.pos).lerp(sight.pos, k);
    v.z += recoil * RECOIL_BACK;
    m.compose(v, q, s);
    this.root.matrix.multiplyMatrices(cameraMatrix, m);
    this.root.matrixWorldNeedsUpdate = true;
    this.hand.setPose('gripGun', 'gripGunFire', recoil);
    this.hand.placeAt(m.identity(), 'socket_gun');

    const flash = this.current ? this.flashes.get(this.current) : undefined;
    if (flash) {
      const wasVisible = flash.visible;
      flash.visible = this.flashLeft > 0;
      // Każdy strzał: losowy obrót gwiazdy (kosmetyka, poza symulacją).
      if (flash.visible && !wasVisible) flash.rotation.z = Math.random() * 6.28;
      if (flash.visible)
        flash.scale.setScalar(
          this.tuning.weapons.muzzleFlashSize *
            (0.6 + 0.4 * (this.flashLeft / this.tuning.weapons.muzzleFlashS)),
        );
    }
    const glow = this.current ? this.heatGlows.get(this.current) : undefined;
    if (glow) glow.visible = this.heatGlowMaterial.opacity > 0.02;
    this.flashLeft = Math.max(0, this.flashLeft - dt);
  }

  private get twoHanded(): boolean {
    const support = this.current?.getObjectByName('support');
    return !!support && support.position.z < TWO_HAND_SUPPORT_Z;
  }

  supportMatrix(): Matrix4 | null {
    const support = this.current?.getObjectByName('support');
    if (!support) return null;
    support.updateWorldMatrix(true, false);
    const matrix = support.matrixWorld.clone();
    if (this.twoHanded)
      matrix
        .multiply(this.tmp.m.makeTranslation(0, 0, TWO_HAND_SUPPORT_FORWARD))
        .multiply(this.tmp.m.makeRotationY(TWO_HAND_SUPPORT_YAW))
        .multiply(this.tmp.m.makeRotationX(TWO_HAND_SUPPORT_PITCH));
    return matrix;
  }

  dispose(): void {
    this.disposed = true;
    this.detachModules?.();
    this.hand.dispose();
    for (const off of this.off.splice(0)) off();
    this.heatMaterial.dispose();
    this.flashMaterial.dispose();
    this.flashCoreMaterial.dispose();
    this.flashConeMaterial.dispose();
    this.heatGlowMaterial.dispose();
    this.flashGeometry.dispose();
    this.quadGeometry.dispose();
    this.fallback.geometry.dispose();
    // Materiał bryły zastępczej jest współdzielony (getMaterial) — nie zwalniamy go.
    this.root.removeFromParent();
  }
}
