import {
  BoxGeometry,
  Color,
  DoubleSide,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
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
import { applyStyle, getMaterial } from './materials';
import { palette } from './palette';

/** Położenie blastera w lewej dłoni (układ kamery) i odrzut po strzale. */
const POSE = {
  pos: new Vector3(-0.3, -0.27, -0.5),
  rot: new Euler(0.04, 0.06, 0.02, 'YXZ'),
};
const RECOIL_BACK = 0.06;
const RECOIL_PITCH = 0.12;
const RECOIL_RECOVER = 14;
const FALLBACK_MODEL = 'blaster';
const FLASH_POINTS = 8;
const FLASH_INNER = 0.3;
const COLD = new Color(palette.cyan);
const HOT = new Color(palette.enemy);

export interface FppBlasterOptions {
  /** Nazwa modelu (`<nazwa>.glb`) dla id broni; brak = model blastera. */
  modelOf?: (weaponId: string) => string | undefined;
  tuning?: Pick<Tuning, 'weapons'>;
}

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
 * Broń gracza w widoku FPP (lewa ręka). Model bieżącej broni (pole `model` danych, cache per model,
 * podmiana przy weapon_switched; fallback blaster.glb, potem bryła zastępcza). Otwory chłodzenia
 * (heat_vents, heat_cell) zmieniają kolor z cyan na czerwień wraz z ciepłem, przegrzanie pulsuje;
 * strzał gracza daje krótki odrzut i cyjanowy błysk wylotu w węźle muzzle. Dane wyłącznie ze
 * zdarzeń heat_changed / weapon_fired / weapon_switched.
 */
export class FppBlaster {
  readonly root = new Group();
  private readonly heatMaterial = new MeshBasicMaterial({
    color: COLD.clone(),
    toneMapped: false,
  });
  private readonly flashMaterial = new MeshBasicMaterial({
    color: COLD.clone(),
    toneMapped: false,
    side: DoubleSide,
  });
  private readonly flashGeometry = starGeometry();
  private readonly fallback = new Mesh(
    new BoxGeometry(0.06, 0.1, 0.32),
    getMaterial('interactive'),
  );
  private readonly models = new Map<string, Promise<Object3D | null>>();
  private readonly flashes = new Map<Object3D, Object3D>();
  private readonly tuning: Pick<Tuning, 'weapons'>;
  private readonly modelOf: (weaponId: string) => string | undefined;
  private loadModels = false;
  private current: Object3D | null = null;
  private wanted = FALLBACK_MODEL;
  private heat = 0;
  private overheated = false;
  private recoil = 0;
  private flashLeft = 0;
  private time = 0;
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
    this.root.matrixAutoUpdate = false;
    this.root.add(this.fallback);
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
      }),
      bus.on('weapon_switched', ({ owner: who, weapon }) => {
        if (who !== owner) return;
        this.wanted = this.modelOf(weapon) ?? FALLBACK_MODEL;
        void this.show(this.wanted);
      }),
    );
  }

  async load(loadModels = true): Promise<void> {
    this.loadModels = loadModels;
    if (!loadModels) return;
    await this.show(this.wanted);
  }

  private async show(name: string): Promise<void> {
    if (!this.loadModels) return;
    let model = await this.fetchModel(name);
    if (!model && name !== FALLBACK_MODEL)
      model = await this.fetchModel(FALLBACK_MODEL);
    if (name !== this.wanted || !model || model === this.current) return;
    this.setCurrent(model);
  }

  private setCurrent(model: Object3D): void {
    if (this.current) this.root.remove(this.current);
    this.root.remove(this.fallback);
    this.current = model;
    this.root.add(model);
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

  private attachFlash(model: Object3D, muzzle: Object3D): void {
    const flash = new Group();
    flash.visible = false;
    // Gwiazda w płaszczyźnie XY (do kamery) i druga, obrócona o pół ramienia.
    const front = new Mesh(this.flashGeometry, this.flashMaterial);
    const back = new Mesh(this.flashGeometry, this.flashMaterial);
    back.rotation.z = Math.PI / FLASH_POINTS;
    back.scale.setScalar(0.6);
    flash.add(front, back);
    muzzle.add(flash);
    this.flashes.set(model, flash);
  }

  /** frameDt: czas rzeczywisty klatki (odrzut i puls działają też w hitstopie). */
  place(cameraMatrix: Matrix4, frameDt: number): void {
    const dt = Math.max(0, Math.min(frameDt, 0.1));
    this.time += dt;
    this.recoil *= Math.exp(-RECOIL_RECOVER * dt);
    const pulse = this.overheated ? 0.5 + 0.5 * Math.sin(this.time * 18) : 0;
    this.heatMaterial.color
      .copy(COLD)
      .lerp(HOT, Math.min(1, this.heat + pulse * 0.4));

    const { m, q, e, v, s } = this.tmp;
    e.set(
      POSE.rot.x + this.recoil * RECOIL_PITCH,
      POSE.rot.y,
      POSE.rot.z,
      'YXZ',
    );
    q.setFromEuler(e);
    v.copy(POSE.pos);
    v.z += this.recoil * RECOIL_BACK;
    m.compose(v, q, s);
    this.root.matrix.multiplyMatrices(cameraMatrix, m);
    this.root.matrixWorldNeedsUpdate = true;

    const flash = this.current ? this.flashes.get(this.current) : undefined;
    if (flash) {
      flash.visible = this.flashLeft > 0;
      if (flash.visible)
        flash.scale.setScalar(
          this.tuning.weapons.muzzleFlashSize *
            (0.6 + 0.4 * (this.flashLeft / this.tuning.weapons.muzzleFlashS)),
        );
    }
    this.flashLeft = Math.max(0, this.flashLeft - dt);
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.heatMaterial.dispose();
    this.flashMaterial.dispose();
    this.flashGeometry.dispose();
    this.fallback.geometry.dispose();
    // Materiał bryły zastępczej jest współdzielony (getMaterial) — nie zwalniamy go.
    this.root.removeFromParent();
  }
}
