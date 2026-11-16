import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  Vector3,
} from 'three';
import type { Object3D, Texture } from 'three';
import { fppGlowMaterial, fppGlowTexture, markGlow } from './fppMaterials';

/** Szerokość poświaty wokół rdzenia ostrza (m) i jej pulsowanie. */
const GLOW_WIDTH_M = 0.12;
const GLOW_PULSE = 0.07;
const EMITTER_FLARE_M = 0.1;
/** Rdzeń modelu jest zwężany: biały-gorący środek, cyan daje poświata. */
const CORE_THIN = 0.7;
/** Smuga cięcia: czas życia próbki (s), maks. liczba próbek, punkt startu wzdłuż ostrza. */
const TRAIL_LIFE_S = 0.13;
const TRAIL_SAMPLES = 24;
const TRAIL_INNER = 0.35;
/**
 * Próbka smugi tylko z przodu kamery (oś -Z układu kamery). Ciężki cios startuje z czubkiem
 * ponad i za kamerą; takie próbki rozciągały smugę w perspektywie w stożek do górnej krawędzi.
 */
const TRAIL_MIN_DEPTH_M = 0.35;

const CORE_COLOR = '#7ff5ff';

export interface BladeEdge {
  base: Object3D;
  tip: Object3D;
}

/** Krawędzie ostrza modelu: przednie (blade → blade_tip) i tylne w kiju. */
export function bladeEdges(model: Object3D): BladeEdge[] {
  const edges: BladeEdge[] = [];
  for (const [base, tip] of [
    ['blade', 'blade_tip'],
    ['blade_back', 'blade_back_tip'],
  ] as const) {
    const b = model.getObjectByName(base);
    const t = model.getObjectByName(tip);
    if (b && t) edges.push({ base: b, tip: t });
  }
  return edges;
}

let bladeTexture: Texture | null = null;
/** Profil poprzeczny: biały środek, cyan, miękki zanik; końce zaokrąglone wzdłuż osi. */
function bladeGlowTexture(): Texture {
  if (bladeTexture) return bladeTexture;
  const w = 64;
  const h = 64;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const ends = Math.min(1, Math.min(v, 1 - v) / 0.12);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2;
      const core = Math.exp(-((u / 0.16) ** 2));
      const halo = Math.exp(-((u / 0.55) ** 2)) * 0.55;
      const a = Math.min(1, core + halo) * ends ** 1.5;
      const white = core * ends;
      const i = (y * w + x) * 4;
      data[i] = Math.round(255 * white);
      data[i + 1] = Math.round(255 * (0.9 + 0.1 * white));
      data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a);
    }
  }
  const texture = new DataTexture(data, w, h, RGBAFormat);
  texture.needsUpdate = true;
  bladeTexture = texture;
  return texture;
}

interface Trail {
  mesh: Mesh;
  geometry: BufferGeometry;
  samples: { base: Vector3; tip: Vector3; age: number }[];
}

export interface BladeFxItem {
  key: 'main' | 'off';
  model: Object3D | null;
  visible: boolean;
  /** Aktywna faza cięcia: dopisuje próbki smugi. */
  slashing: boolean;
}

/**
 * Efekty ostrza FPP (czysto wizualne): biały rdzeń, poświata zwrócona do kamery wzdłuż ostrza,
 * rozbłysk emitera i smuga cięcia w układzie kamery. Bez świateł punktowych (limit ADR 0006).
 */
export class FppBladeFx {
  readonly root = new Group();
  private readonly trailRoot = new Group();
  private readonly quadGeometry = new PlaneGeometry(1, 1);
  private readonly glowMaterial = fppGlowMaterial(
    '#ffffff',
    1,
    bladeGlowTexture(),
  );
  private readonly flareMaterial = fppGlowMaterial(
    '#7ff4ff',
    0.9,
    fppGlowTexture(),
  );
  private readonly coreMaterial = new MeshBasicMaterial({
    color: CORE_COLOR,
    toneMapped: false,
  });
  private readonly trailMaterial = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  private readonly glows: Mesh[] = [];
  private readonly flares: Mesh[] = [];
  private readonly trails = new Map<'main' | 'off', Trail>();
  private time = 0;
  private readonly tmp = {
    a: new Vector3(),
    b: new Vector3(),
    cam: new Vector3(),
    axis: new Vector3(),
    side: new Vector3(),
    normal: new Vector3(),
    mid: new Vector3(),
    m: new Matrix4(),
    inv: new Matrix4(),
    camInv: new Matrix4(),
  };

  constructor() {
    this.coreMaterial.userData.bloom = true;
    this.trailMaterial.userData.bloom = true;
    this.root.name = 'blade_fx';
    this.root.matrixAutoUpdate = false;
    this.trailRoot.matrixAutoUpdate = false;
    this.root.add(this.trailRoot);
    markGlow(this.root);
  }

  /** Zwęża rdzeń i nadaje mu biało-gorący materiał; rdzeń nie dostaje konturu. */
  styleModel(model: Object3D): void {
    model.traverse((node) => {
      if (
        node instanceof Mesh &&
        (node.name === 'blade_core' || node.name === 'blade_back_core')
      ) {
        node.material = this.coreMaterial;
        node.scale.x = CORE_THIN;
        node.scale.y = CORE_THIN;
        node.userData.noOutline = true;
      }
    });
  }

  private quad(list: Mesh[], index: number, flare: boolean): Mesh {
    let mesh = list[index];
    if (!mesh) {
      mesh = new Mesh(
        this.quadGeometry,
        flare ? this.flareMaterial : this.glowMaterial,
      );
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.userData.noOutline = true;
      mesh.renderOrder = 2;
      list.push(mesh);
      this.root.add(mesh);
    }
    mesh.visible = true;
    return mesh;
  }

  private trail(key: 'main' | 'off'): Trail {
    let trail = this.trails.get(key);
    if (!trail) {
      const geometry = new BufferGeometry();
      const n = TRAIL_SAMPLES * 2;
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(n * 3), 3),
      );
      geometry.setAttribute(
        'color',
        // RGBA: alfa wierzchołka = zanik (maska bloomu liczy pokrycie z alfy, nie z koloru).
        new BufferAttribute(new Float32Array(n * 4), 4),
      );
      const index: number[] = [];
      for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geometry.setIndex(index);
      const mesh = new Mesh(geometry, this.trailMaterial);
      mesh.frustumCulled = false;
      mesh.userData.noOutline = true;
      mesh.renderOrder = 1;
      this.trailRoot.add(mesh);
      trail = { mesh, geometry, samples: [] };
      this.trails.set(key, trail);
    }
    return trail;
  }

  update(cameraMatrix: Matrix4, dt: number, items: BladeFxItem[]): void {
    const t = this.tmp;
    this.time += dt;
    this.root.updateWorldMatrix(true, false);
    t.inv.copy(this.root.matrixWorld).invert();
    t.cam.setFromMatrixPosition(cameraMatrix);
    t.camInv.copy(cameraMatrix).invert();
    this.trailRoot.matrix.copy(t.inv).multiply(cameraMatrix);
    this.trailRoot.matrixWorldNeedsUpdate = true;
    let glow = 0;
    let flare = 0;
    const pulse =
      1 +
      GLOW_PULSE *
        (Math.sin(this.time * 37) * 0.6 + Math.sin(this.time * 91 + 1.3) * 0.4);
    for (const item of items) {
      const trail = this.trail(item.key);
      for (const sample of trail.samples) sample.age += dt;
      while (trail.samples.length && trail.samples[0]!.age > TRAIL_LIFE_S)
        trail.samples.shift();
      if (!item.visible || !item.model) {
        trail.samples.length = 0;
        this.writeTrail(trail);
        continue;
      }
      item.model.updateWorldMatrix(true, true);
      const edges = bladeEdges(item.model);
      for (const [e, edge] of edges.entries()) {
        t.a.setFromMatrixPosition(edge.base.matrixWorld);
        t.b.setFromMatrixPosition(edge.tip.matrixWorld);
        t.axis.subVectors(t.b, t.a);
        const length = t.axis.length();
        if (length < 1e-4) continue;
        // Koniec ostrza przy/za kamerą (tył kija w obrocie): billboard rozciągnąłby się na pół kadru.
        if (
          -t.mid.copy(t.a).applyMatrix4(t.camInv).z < 0.12 ||
          -t.mid.copy(t.b).applyMatrix4(t.camInv).z < 0.12
        )
          continue;
        t.axis.divideScalar(length);
        t.mid.addVectors(t.a, t.b).multiplyScalar(0.5);
        t.normal.subVectors(t.cam, t.mid).normalize();
        t.side.crossVectors(t.axis, t.normal);
        if (t.side.lengthSq() < 1e-8) t.side.set(1, 0, 0);
        t.side.normalize();
        t.normal.crossVectors(t.side, t.axis);
        const width = GLOW_WIDTH_M * pulse;
        const quad = this.quad(this.glows, glow++, false);
        t.m.makeBasis(
          t.side.clone().multiplyScalar(width),
          t.axis.clone().multiplyScalar(length + width * 0.5),
          t.normal,
        );
        t.m.setPosition(t.mid);
        quad.matrix.multiplyMatrices(t.inv, t.m);
        // Rozbłysk emitera: kwadrat zwrócony do kamery u nasady ostrza.
        const f = this.quad(this.flares, flare++, true);
        t.normal.subVectors(t.cam, t.a).normalize();
        t.side.set(0, 1, 0).cross(t.normal);
        if (t.side.lengthSq() < 1e-8) t.side.set(1, 0, 0);
        t.side.normalize();
        t.mid.crossVectors(t.normal, t.side);
        const size = EMITTER_FLARE_M * pulse;
        t.m.makeBasis(
          t.side.multiplyScalar(size),
          t.mid.multiplyScalar(size),
          t.normal,
        );
        t.m.setPosition(t.a);
        f.matrix.multiplyMatrices(t.inv, t.m);
        if (item.slashing && e === 0) {
          const base = t.a
            .clone()
            .lerp(t.b, TRAIL_INNER)
            .applyMatrix4(t.camInv);
          const tip = t.b.clone().applyMatrix4(t.camInv);
          if (-tip.z > TRAIL_MIN_DEPTH_M && -base.z > TRAIL_MIN_DEPTH_M)
            trail.samples.push({ base, tip, age: 0 });
          if (trail.samples.length > TRAIL_SAMPLES) trail.samples.shift();
        }
      }
      this.writeTrail(trail);
    }
    for (let i = glow; i < this.glows.length; i++)
      this.glows[i]!.visible = false;
    for (let i = flare; i < this.flares.length; i++)
      this.flares[i]!.visible = false;
  }

  private writeTrail(trail: Trail): void {
    const samples = trail.samples;
    trail.mesh.visible = samples.length >= 2;
    if (!trail.mesh.visible) return;
    const position = trail.geometry.getAttribute('position') as BufferAttribute;
    const color = trail.geometry.getAttribute('color') as BufferAttribute;
    const last = samples.length - 1;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      const s = samples[Math.min(i, last)]!;
      const k = Math.max(0, 1 - s.age / TRAIL_LIFE_S) * (i <= last ? 1 : 0);
      const fade = k * k;
      position.setXYZ(i * 2, s.base.x, s.base.y, s.base.z);
      position.setXYZ(i * 2 + 1, s.tip.x, s.tip.y, s.tip.z);
      // Wnętrze smugi słabsze, krawędź przy czubku biało-cyjanowa.
      color.setXYZW(i * 2, 0, 0.55, 0.7, 0.45 * fade);
      color.setXYZW(i * 2 + 1, 0.6, 0.97, 1.0, fade);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
  }

  dispose(): void {
    this.quadGeometry.dispose();
    this.glowMaterial.dispose();
    this.flareMaterial.dispose();
    this.coreMaterial.dispose();
    this.trailMaterial.dispose();
    for (const trail of this.trails.values()) trail.geometry.dispose();
    this.root.removeFromParent();
  }
}
