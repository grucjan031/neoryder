import {
  BoxGeometry,
  Color,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { EntityId, EventBus } from '../core/events';
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
const COLD = new Color(palette.cyan);
const HOT = new Color(palette.enemy);

/**
 * Blaster w widoku FPP (lewa ręka). Otwory chłodzenia (heat_vents, heat_cell z blaster.glb)
 * zmieniają kolor z cyan na czerwień wraz z ciepłem, przegrzanie pulsuje; strzał gracza
 * daje krótki odrzut. Dane wyłącznie ze zdarzeń heat_changed / weapon_fired.
 */
export class FppBlaster {
  readonly root = new Group();
  private readonly heatMaterial = new MeshBasicMaterial({
    color: COLD.clone(),
    toneMapped: false,
  });
  private readonly fallback = new Mesh(
    new BoxGeometry(0.06, 0.1, 0.32),
    getMaterial('interactive'),
  );
  private heat = 0;
  private overheated = false;
  private recoil = 0;
  private time = 0;
  private readonly off: (() => void)[] = [];
  private readonly tmp = {
    m: new Matrix4(),
    q: new Quaternion(),
    e: new Euler(0, 0, 0, 'YXZ'),
    v: new Vector3(),
    s: new Vector3(1, 1, 1),
  };

  constructor(bus: EventBus, owner: EntityId) {
    this.root.matrixAutoUpdate = false;
    this.root.add(this.fallback);
    this.off.push(
      bus.on('heat_changed', ({ id, current, max, overheated }) => {
        if (id !== owner) return;
        this.heat = max > 0 ? current / max : 0;
        this.overheated = overheated;
      }),
      bus.on('weapon_fired', ({ owner: who }) => {
        if (who === owner) this.recoil = 1;
      }),
    );
  }

  async load(loadModels = true): Promise<void> {
    if (!loadModels) return;
    try {
      const gltf = await new GLTFLoader().loadAsync(
        '/assets/models/blaster.glb',
      );
      applyStyle(gltf.scene);
      // Własny materiał dla elementów ciepła — współdzielony materiał gracza zostaje cyan.
      gltf.scene.traverse((node: Object3D) => {
        if (
          (node.name === 'heat_vents' || node.name === 'heat_cell') &&
          node instanceof Mesh
        )
          node.material = this.heatMaterial;
      });
      this.root.remove(this.fallback);
      this.root.add(gltf.scene);
    } catch {
      // Bryła zastępcza wystarcza.
    }
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
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.heatMaterial.dispose();
    this.fallback.geometry.dispose();
    // Materiał bryły zastępczej jest współdzielony (getMaterial) — nie zwalniamy go.
    this.root.removeFromParent();
  }
}
