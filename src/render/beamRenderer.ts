import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { Weapon } from '../combat/weapons/weapon';
import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';
import { getMaterial } from './materials';
import { fppGlowMaterial, markGlow } from './fppMaterials';

/**
 * Warstwy wiązki względem promienia z tuning. Tylko biały rdzeń jest bryłą z zapisem głębi;
 * cyan (główny walec) i poświaty są przezroczyste bez zapisu głębi, więc rdzeń widać
 * przez nie z każdej strony.
 */
const LAYERS: readonly { scale: number; color: string; opacity: number }[] = [
  { scale: 0.45, color: '#f2feff', opacity: 1 },
  { scale: 2.6, color: '#00e5ff', opacity: 0.38 },
  { scale: 6, color: '#3fd8ff', opacity: 0.12 },
];
/** Krycie głównego cyjanowego walca (nad rdzeniem daje jasny cyan, na tle pełny kolor). */
const MAIN_OPACITY = 0.6;
/** Najdłuższy krok zegara pulsowania (s): po przestoju pulsowanie nie przeskakuje. */
const MAX_STEP_S = 0.1;

export class BeamRenderer {
  readonly root = new Group();
  private readonly geometry = new CylinderGeometry(1, 1, 1, 8);
  /** Własny materiał: wiązka ma `noOutline`, a współdzielonego materiału gracza nie zwalniamy. */
  private readonly material = new MeshBasicMaterial({
    color: getMaterial('player').color,
    toneMapped: false,
    transparent: true,
    opacity: MAIN_OPACITY,
    depthWrite: false,
  });
  private readonly mesh = new Mesh(this.geometry, this.material);
  private readonly layers: Mesh[] = [];
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private time = 0;

  constructor() {
    this.material.userData.bloom = true;
    this.root.add(this.mesh);
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
    for (const layer of LAYERS) {
      const material =
        layer.opacity >= 1
          ? new MeshBasicMaterial({ color: layer.color, toneMapped: false })
          : fppGlowMaterial(layer.color, layer.opacity);
      material.userData.bloom = true;
      const mesh = new Mesh(this.geometry, material);
      mesh.scale.set(layer.scale, 1.002, layer.scale);
      // Rdzeń przed cyanem i poświatami (kolejność przezroczystych warstw).
      mesh.renderOrder = layer.opacity >= 1 ? 0 : 2;
      this.layers.push(mesh);
      this.mesh.add(mesh);
    }
    // Kontur na cienkim walcu rysował wiązkę jako czarną kreskę.
    markGlow(this.mesh);
  }

  /** Zegar pulsowania: czas klatki (s), niezależnie od liczby wywołań `render`. */
  advance(frameDt: number): void {
    if (Number.isFinite(frameDt) && frameDt > 0)
      this.time += Math.min(frameDt, MAX_STEP_S);
  }

  /** Grubość poświaty względem bazowej (dla testów i kosmetyki). */
  get flicker(): number {
    return (
      1 + 0.12 * Math.sin(this.time * 47) + 0.06 * Math.sin(this.time * 113)
    );
  }

  render(beam: Weapon['beam'], from: Vec3 | undefined = beam?.from): void {
    this.mesh.visible = beam?.active ?? false;
    if (!beam?.active || !from) return;
    this.direction.set(
      beam.to.x - from.x,
      beam.to.y - from.y,
      beam.to.z - from.z,
    );
    const length = this.direction.length();
    this.mesh.position.set(
      (from.x + beam.to.x) / 2,
      (from.y + beam.to.y) / 2,
      (from.z + beam.to.z) / 2,
    );
    this.mesh.scale.set(tuning.vfx.beamRadiusM, length, tuning.vfx.beamRadiusM);
    // Drganie grubości poświaty (kosmetyka, zegar z `advance`).
    const flicker = this.flicker;
    for (const [i, layer] of this.layers.entries()) {
      const base = LAYERS[i]!.scale;
      const s = i === 0 ? base : base * flicker;
      layer.scale.set(s, 1.002, s);
    }
    if (length > 0)
      this.mesh.quaternion.setFromUnitVectors(
        this.up,
        this.direction.divideScalar(length),
      );
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    for (const layer of this.layers)
      (layer.material as MeshBasicMaterial).dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
