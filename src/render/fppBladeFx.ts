import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { loadSettings } from '../core/save';
import type { Settings } from '../core/save';
import { tuning as defaultTuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { fppGlowMaterial, fppGlowTexture, markGlow } from './fppMaterials';

/** Szerokość poświaty wokół rdzenia ostrza (m) i jej pulsowanie. */
const GLOW_WIDTH_M = 0.12;
const GLOW_PULSE = 0.07;
const EMITTER_FLARE_M = 0.1;
/** Rdzeń modelu jest mocno zwężany: wąska biała nić w środku, nasycony cyjan daje klinga. */
const CORE_THIN = 0.35;
/** Smuga cięcia: czas życia próbki (s), maks. liczba próbek, punkt startu wzdłuż ostrza. */
const TRAIL_LIFE_S = 0.13;
const TRAIL_SAMPLES = 24;
const TRAIL_INNER = 0.35;
/**
 * Próbka smugi tylko z przodu kamery (oś -Z układu kamery). Ciężki cios startuje z czubkiem
 * ponad i za kamerą; takie próbki rozciągały smugę w perspektywie w stożek do górnej krawędzi.
 */
const TRAIL_MIN_DEPTH_M = 0.35;

/** Rdzeń modelu: biały-gorący; cyjan dają płaskie strefy poświaty. */
const CORE_COLOR = '#e8feff';
/** Strefy klingi (komiks): jasny cyjan wokół rdzenia i ciemniejsza, półprzezroczysta otoczka. */
const BLADE_INNER_COLOR = '#1ef2ff';
const BLADE_OUTER_COLOR = '#00d2f0';
/** Zaokrąglenie końców klingi: ułamek długości quada przy czubku i przy emiterze. */
const BLADE_TIP_ROUND = 0.07;
const BLADE_BASE_ROUND = 0.03;

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

/** Uniformy klingi wspólne dla wszystkich quadów (i wariantu maski bloomu). */
interface BladeUniforms {
  bladePhase: { value: number };
  bladeCore: { value: number };
  bladeInner: { value: number };
  bladeOuter: { value: number };
  bladeOuterAlpha: { value: number };
  bladeBands: { value: number };
  bladeBandWidth: { value: number };
  bladeBandSwell: { value: number };
  bladeInnerColor: { value: Color };
  bladeOuterColor: { value: Color };
}

const bladeVertexHead = /* glsl */ `#include <common>
varying vec2 vBladeUv;`;

const bladeFragmentHead = /* glsl */ `#include <common>
varying vec2 vBladeUv;
uniform float bladePhase;
uniform float bladeCore;
uniform float bladeInner;
uniform float bladeOuter;
uniform float bladeOuterAlpha;
uniform float bladeBands;
uniform float bladeBandWidth;
uniform float bladeBandSwell;
uniform vec3 bladeInnerColor;
uniform vec3 bladeOuterColor;`;

/**
 * Profil klingi: zamiast gładkiego gradientu trzy płaskie strefy z twardą (1 px AA) granicą —
 * biały rdzeń, jasny cyjan, ciemniejsza otoczka. Płaskie pasma (bladeBands na klingę) płyną od
 * emitera do czubka: poszerzają rdzeń i rozjaśniają cyjan. Końce zaokrąglone zwężeniem profilu.
 */
const bladeFragment = /* glsl */ `#include <map_fragment>
{
  float bladeV = vBladeUv.y;
  float bladeTaper = sqrt(clamp(min((1.0 - bladeV) / ${BLADE_TIP_ROUND.toFixed(3)}, bladeV / ${BLADE_BASE_ROUND.toFixed(3)}), 0.0, 1.0));
  float bladeU = abs(vBladeUv.x - 0.5) * 2.0 / max(bladeTaper, 1e-3);
  float bladeAa = fwidth(bladeU) + 1e-4;
  float bladeRun = bladeV * bladeBands - bladePhase;
  float bladeBandAa = fwidth(bladeRun) + 1e-4;
  float bladeBand = 1.0 - smoothstep(bladeBandWidth * 0.5 - bladeBandAa, bladeBandWidth * 0.5 + bladeBandAa, abs(fract(bladeRun) - 0.5));
  float bladeCoreEdge = bladeCore + bladeBand * bladeBandSwell;
  float bladeCoreZone = 1.0 - smoothstep(bladeCoreEdge - bladeAa, bladeCoreEdge + bladeAa, bladeU);
  float bladeInnerZone = 1.0 - smoothstep(bladeInner - bladeAa, bladeInner + bladeAa, bladeU);
  float bladeOuterZone = 1.0 - smoothstep(bladeOuter - bladeAa, bladeOuter + bladeAa, bladeU);
  // Pasmo: jaśniejszy cyjan (#7ff8ff w sRGB; tu w przestrzeni liniowej), nie biel.
  vec3 bladeInnerTint = mix(bladeInnerColor, vec3(0.212, 0.94, 1.0), bladeBand * 0.6);
  vec3 bladeColor = mix(mix(bladeOuterColor, bladeInnerTint, bladeInnerZone), vec3(1.0), bladeCoreZone);
#ifdef BLADE_SOLID
  // Rdzeń i jasny cyjan: nieprzezroczyste, z zapisem głębi (mgła kompozycji ich nie przygasza).
  if (bladeInnerZone < 0.5) discard;
  diffuseColor.rgb *= bladeColor;
#else
  diffuseColor *= vec4(bladeOuterColor, bladeOuterZone * (1.0 - bladeInnerZone) * bladeOuterAlpha);
#endif
}`;

/**
 * Materiał klingi: `solid` = rdzeń i jasny cyjan (nieprzezroczyste, zapis głębi, reszta odrzucona),
 * inaczej półprzezroczysta otoczka. Dwa stałe programy (klucz cache), zmienne tylko w uniformach.
 */
function plasmaBladeMaterial(
  uniforms: BladeUniforms,
  solid: boolean,
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: !solid,
    depthWrite: solid,
    toneMapped: false,
    fog: false,
  });
  if (solid) material.defines = { BLADE_SOLID: '' };
  material.name = solid ? 'fpp_plasma_blade' : 'fpp_plasma_blade_halo';
  material.userData.bloom = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', bladeVertexHead)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBladeUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', bladeFragmentHead)
      .replace('#include <map_fragment>', bladeFragment);
  };
  const key = solid ? 'fppPlasmaBlade:solid' : 'fppPlasmaBlade:halo';
  material.customProgramCacheKey = () => key;
  return material;
}

/** Quad klingi razem z dzieckiem-otoczką (widoczność obu flag, także dla testów i zrzutów). */
function showQuad(mesh: Mesh, visible: boolean): void {
  mesh.visible = visible;
  for (const child of mesh.children) child.visible = visible;
}

export interface FppBladeFxOptions {
  /** Ustawienia gracza (testy); domyślnie loadSettings() co klatkę. */
  settings?: Pick<Settings, 'flashes'>;
  tuning?: Pick<Tuning, 'vfx'>;
}

interface TrailSample {
  base: Vector3;
  tip: Vector3;
  age: number;
}

/** Smuga: stała pula próbek jako bufor pierścieniowy (`start` = najstarsza). */
interface Trail {
  mesh: Mesh;
  geometry: BufferGeometry;
  ring: TrailSample[];
  start: number;
  count: number;
}

/** Krawędzie modelu liczone raz na model (model ostrza nie zmienia hierarchii). */
const edgeCache = new WeakMap<Object3D, BladeEdge[]>();
function cachedEdges(model: Object3D): BladeEdge[] {
  let edges = edgeCache.get(model);
  if (!edges) {
    edges = bladeEdges(model);
    edgeCache.set(model, edges);
  }
  return edges;
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
  private readonly bladeUniforms: BladeUniforms = {
    bladePhase: { value: 0 },
    bladeCore: { value: 0.07 },
    bladeInner: { value: 0.3 },
    bladeOuter: { value: 0.44 },
    bladeOuterAlpha: { value: 0.85 },
    bladeBands: { value: 4 },
    bladeBandWidth: { value: 0.35 },
    bladeBandSwell: { value: 0.02 },
    bladeInnerColor: { value: new Color(BLADE_INNER_COLOR) },
    bladeOuterColor: { value: new Color(BLADE_OUTER_COLOR) },
  };
  private readonly glowMaterial = plasmaBladeMaterial(this.bladeUniforms, true);
  private readonly haloMaterial = plasmaBladeMaterial(
    this.bladeUniforms,
    false,
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
  private readonly settings: Pick<Settings, 'flashes'> | undefined;
  private readonly tuning: Pick<Tuning, 'vfx'>;
  private readonly tmp = {
    a: new Vector3(),
    b: new Vector3(),
    cam: new Vector3(),
    axis: new Vector3(),
    side: new Vector3(),
    normal: new Vector3(),
    mid: new Vector3(),
    sx: new Vector3(),
    ax: new Vector3(),
    base: new Vector3(),
    tip: new Vector3(),
    m: new Matrix4(),
    inv: new Matrix4(),
    camInv: new Matrix4(),
  };

  constructor(options: FppBladeFxOptions = {}) {
    this.settings = options.settings;
    this.tuning = options.tuning ?? defaultTuning;
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
      if (!flare) {
        // Otoczka klingi: ten sam quad (dziecko z macierzą jednostkową), osobny materiał.
        const halo = new Mesh(this.quadGeometry, this.haloMaterial);
        halo.matrixAutoUpdate = false;
        halo.frustumCulled = false;
        halo.userData.noOutline = true;
        halo.renderOrder = 2;
        mesh.add(halo);
      }
      list.push(mesh);
      this.root.add(mesh);
    }
    showQuad(mesh, true);
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
      const ring = Array.from({ length: TRAIL_SAMPLES }, () => ({
        base: new Vector3(),
        tip: new Vector3(),
        age: 0,
      }));
      trail = { mesh, geometry, ring, start: 0, count: 0 };
      this.trails.set(key, trail);
    }
    return trail;
  }

  /** Ukrywa wszystkie efekty i czyści smugi (ostrze niewidoczne — bez liczenia). */
  hide(): void {
    for (const mesh of this.glows) showQuad(mesh, false);
    for (const mesh of this.flares) mesh.visible = false;
    for (const trail of this.trails.values()) {
      trail.count = 0;
      trail.mesh.visible = false;
    }
  }

  private sample(trail: Trail, i: number): TrailSample {
    return trail.ring[(trail.start + i) % TRAIL_SAMPLES]!;
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
    const flashes = (this.settings ?? loadSettings()).flashes;
    // Bez błysków: szerokość stała (bez migotania), pasma tylko powoli dryfują.
    const pulse = flashes
      ? 1 +
        GLOW_PULSE *
          (Math.sin(this.time * 37) * 0.6 +
            Math.sin(this.time * 91 + 1.3) * 0.4)
      : 1;
    this.updateBlade(
      dt,
      flashes,
      items.some((item) => item.visible && item.slashing),
    );
    for (const item of items) {
      const trail = this.trail(item.key);
      for (let i = 0; i < trail.count; i++) this.sample(trail, i).age += dt;
      while (trail.count && this.sample(trail, 0).age > TRAIL_LIFE_S) {
        trail.start = (trail.start + 1) % TRAIL_SAMPLES;
        trail.count--;
      }
      if (!item.visible || !item.model) {
        trail.count = 0;
        this.writeTrail(trail);
        continue;
      }
      item.model.updateWorldMatrix(true, true);
      const edges = cachedEdges(item.model);
      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e]!;
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
          t.sx.copy(t.side).multiplyScalar(width),
          t.ax.copy(t.axis).multiplyScalar(length + width * 0.5),
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
          const base = t.base.copy(t.a).lerp(t.b, TRAIL_INNER);
          base.applyMatrix4(t.camInv);
          const tip = t.tip.copy(t.b).applyMatrix4(t.camInv);
          const last = trail.count ? this.sample(trail, trail.count - 1) : null;
          if (
            -tip.z > TRAIL_MIN_DEPTH_M &&
            -base.z > TRAIL_MIN_DEPTH_M &&
            (!last ||
              last.base.distanceToSquared(base) > 1e-8 ||
              last.tip.distanceToSquared(tip) > 1e-8)
          ) {
            if (trail.count === TRAIL_SAMPLES)
              trail.start = (trail.start + 1) % TRAIL_SAMPLES;
            else trail.count++;
            const slot = this.sample(trail, trail.count - 1);
            slot.base.copy(base);
            slot.tip.copy(tip);
            slot.age = 0;
          }
        }
      }
      this.writeTrail(trail);
    }
    for (let i = glow; i < this.glows.length; i++)
      showQuad(this.glows[i]!, false);
    for (let i = flare; i < this.flares.length; i++)
      this.flares[i]!.visible = false;
  }

  /** Uniformy klingi z tuningu; faza pasm narasta płynnie (zmiana prędkości bez skoku). */
  private updateBlade(dt: number, flashes: boolean, slashing: boolean): void {
    const vfx = this.tuning.vfx;
    const u = this.bladeUniforms;
    const speed =
      (flashes ? vfx.bladeBandSpeed : vfx.bladeBandSpeedCalm) *
      (slashing && flashes ? vfx.bladeBandSlashBoost : 1);
    u.bladePhase.value = (u.bladePhase.value + dt * speed) % 1;
    u.bladeCore.value = vfx.bladeCoreFrac;
    u.bladeInner.value = vfx.bladeInnerFrac;
    u.bladeOuter.value = vfx.bladeOuterFrac;
    u.bladeOuterAlpha.value = vfx.bladeOuterOpacity;
    u.bladeBands.value = vfx.bladeBands;
    u.bladeBandWidth.value = vfx.bladeBandWidth;
    u.bladeBandSwell.value = vfx.bladeBandSwell;
  }

  private writeTrail(trail: Trail): void {
    trail.mesh.visible = trail.count >= 2;
    if (!trail.mesh.visible) return;
    const position = trail.geometry.getAttribute('position') as BufferAttribute;
    const color = trail.geometry.getAttribute('color') as BufferAttribute;
    const last = trail.count - 1;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      const s = this.sample(trail, Math.min(i, last));
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
    this.haloMaterial.dispose();
    this.flareMaterial.dispose();
    this.coreMaterial.dispose();
    this.trailMaterial.dispose();
    for (const trail of this.trails.values()) trail.geometry.dispose();
    this.root.removeFromParent();
  }
}
