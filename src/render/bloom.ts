import {
  Color,
  Material,
  HalfFloatType,
  MeshBasicMaterial,
  NoBlending,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type {
  Mesh,
  Object3D,
  PerspectiveCamera,
  OrthographicCamera,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import { tuning } from '../core/tuning';
import { getQuality } from './quality';
import { FullscreenPass, fullscreenVertex } from './fullscreen';
import { renderWithViewmodel, VIEWMODEL_LAYER } from './viewmodelLayer';
import { frameProfiler } from './frameProfiler';
import type { FrameStage } from './frameProfiler';

/** Maska w 1/2 rozdzielczości bufora, rozmycie w 1/4. */
const MASK_SCALE = 0.5;
const BLUR_SCALE = 0.25;

type Unlit = Material & { color?: Color };

function isEmissiveOne(material: Material): boolean {
  // Jawna flaga ma pierwszeństwo (materiały neonów z rejestru i ich klony).
  const flag: unknown = material.userData.bloom;
  if (typeof flag === 'boolean') return flag;
  const unlit = material as Unlit;
  const unlitKind =
    'isMeshBasicMaterial' in material ||
    'isLineBasicMaterial' in material ||
    'isSpriteMaterial' in material ||
    'isPointsMaterial' in material;
  if (!unlitKind || !unlit.color) return false;
  const { r, g, b } = unlit.color;
  // Nasycony materiał unlit to neon; biel, szarość i czerń nie świecą.
  return Math.max(r, g, b) - Math.min(r, g, b) > 0.5;
}

export function isEmissive(material: Material | Material[]): boolean {
  return Array.isArray(material)
    ? material.some(isEmissiveOne)
    : isEmissiveOne(material);
}

/** Przezroczysty lub niezapisujący głębi, nieemisyjny: nie może zasłaniać neonów w masce. */
export function isSeeThrough(material: Material): boolean {
  if (material.userData.bloomMaterial instanceof Material) return false;
  if (isEmissiveOne(material)) return false;
  return material.transparent || !material.depthWrite;
}

const blurFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec2 stepSize;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(map, vUv) * 0.2270270270;
    sum += (texture2D(map, vUv + stepSize * 1.3846153846) + texture2D(map, vUv - stepSize * 1.3846153846)) * 0.3162162162;
    sum += (texture2D(map, vUv + stepSize * 3.2307692308) + texture2D(map, vUv - stepSize * 3.2307692308)) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

type Renderable = Object3D & { material?: Material | Material[] };

const depthDeclarations = /* glsl */ `
  uniform sampler2D bloomColorDepth;
  uniform vec2 bloomColorSize;
  uniform vec2 bloomMaskSize;
`;
const depthComparison = /* glsl */ `
  vec2 bloomUv = gl_FragCoord.xy / bloomMaskSize;
  vec2 bloomSampleUv = (floor(bloomUv * bloomColorSize) + 0.5) / bloomColorSize;
  // Porównujemy tę samą powierzchnię w środku teksela koloru, nie maski.
  vec2 bloomDelta = (bloomSampleUv - bloomUv) * bloomMaskSize;
  float bloomDepth = gl_FragCoord.z + dot(
    vec2(dFdx(gl_FragCoord.z), dFdy(gl_FragCoord.z)), bloomDelta);
  // Tolerancja kwantyzacji bufora DEPTH_COMPONENT24, nie bias odległości.
  if (bloomDepth > texture2D(bloomColorDepth, bloomSampleUv).r + 2.0 / 16777215.0) discard;
`;

// Wariant ma własną tożsamość/program, ale na bieżąco czyta stan źródła.
const variantOwnProperties = new Set([
  'id',
  'uuid',
  'version',
  '_listeners',
  'onBeforeCompile',
  'customProgramCacheKey',
]);

/**
 * Bloom świata rysuje tylko emisję, porównując głębię z teksturą koloru.
 * Odbicia, viewmodel i wywołania bez głębi koloru zachowują własne zasłony.
 * Maska jest
 * rozmywana w niskiej rozdzielczości; kompozycja nakłada ją "over", więc halo jest
 * widoczne także na białym świecie, który nigdy się nie rozmywa.
 */
export class BloomPass {
  private readonly mask = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  private readonly blurA = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  private readonly blurB = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    depthBuffer: false,
  });
  // Zerowa alfa i kolor usuwają także emisję narysowaną przed bliższą zasłoną.
  // Sam colorWrite=false pozostawiał kolor dalekiego neonu w masce.
  private readonly occluder = new MeshBasicMaterial({
    color: 0x000000,
    opacity: 0,
    // NormalBlending przy transparent=false wymusza w Three.js alfę 1 (OPAQUE).
    blending: NoBlending,
    transparent: false,
    fog: false,
    toneMapped: false,
    depthTest: true,
    depthWrite: true,
  });
  private readonly blurUniforms = {
    map: { value: this.mask.texture as Texture },
    stepSize: { value: new Vector2() },
  };
  private readonly blur = new FullscreenPass(
    new ShaderMaterial({
      uniforms: this.blurUniforms,
      vertexShader: fullscreenVertex,
      fragmentShader: blurFragment,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly swappedMeshes: Mesh[] = [];
  private readonly swappedMaterials: (Material | Material[])[] = [];
  private readonly hidden: Object3D[] = [];
  private readonly clearColor = new Color();
  private readonly omitted = new MeshBasicMaterial({ visible: false });
  private readonly variants = new Map<
    Material,
    { material: Material; version: number; release: () => void }
  >();
  private readonly materialArrays = new WeakMap<Object3D, Material[]>();
  private readonly depthUniforms = {
    bloomColorDepth: { value: null as Texture | null },
    bloomColorSize: { value: new Vector2() },
    bloomMaskSize: { value: new Vector2() },
  };

  constructor(
    width: number,
    height: number,
    private readonly reflection = false,
  ) {
    this.setSize(width, height);
  }

  /** Rozmiar w pikselach bufora rysowania. */
  setSize(width: number, height: number): void {
    const resolution = this.reflection ? 1 : getQuality().bloomResolution;
    const scaled = (scale: number, value: number): number =>
      Math.max(1, Math.floor(value * scale * resolution));
    this.mask.setSize(scaled(MASK_SCALE, width), scaled(MASK_SCALE, height));
    for (const target of [this.blurA, this.blurB])
      target.setSize(
        scaled(this.reflection ? MASK_SCALE : BLUR_SCALE, width),
        scaled(this.reflection ? MASK_SCALE : BLUR_SCALE, height),
      );
  }

  /** Wynik: rgb premultiplikowane, alfa = pokrycie. */
  get texture(): Texture {
    return this.blurB.texture;
  }

  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
    colorTarget?: WebGLRenderTarget,
  ): void {
    this.depthUniforms.bloomColorDepth.value =
      !this.reflection && colorTarget ? colorTarget.depthTexture : null;
    if (colorTarget)
      this.depthUniforms.bloomColorSize.value.set(
        colorTarget.width,
        colorTarget.height,
      );
    this.depthUniforms.bloomMaskSize.value.set(
      this.mask.width,
      this.mask.height,
    );
    if (!this.reflection) frameProfiler?.begin('bloom');
    try {
      this.renderPasses(renderer, scene, camera);
    } finally {
      if (!this.reflection) frameProfiler?.end();
    }
  }

  private renderPasses(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
  ): void {
    frameProfiler?.begin(this.reflection ? 'reflectionMask' : 'bloomMask');
    try {
      this.renderMask(renderer, scene, camera);
    } finally {
      frameProfiler?.end();
    }
    const radius = tuning.render.bloomRadius;
    const texel = (
      target: WebGLRenderTarget,
      scale: number,
      horizontal: boolean,
    ) =>
      this.blurUniforms.stepSize.value.set(
        horizontal ? (scale * radius) / target.width : 0,
        horizontal ? 0 : (scale * radius) / target.height,
      );
    const run = (
      source: Texture,
      target: WebGLRenderTarget,
      scale: number,
      horizontal: boolean,
      stage: FrameStage,
    ): void => {
      this.blurUniforms.map.value = source;
      texel(target, scale, horizontal);
      this.blur.render(renderer, target, stage);
    };
    run(
      this.mask.texture,
      this.blurA,
      1,
      true,
      this.reflection ? 'reflectionBlurX' : 'bloomBlurX1',
    );
    run(
      this.blurA.texture,
      this.blurB,
      1,
      false,
      this.reflection ? 'reflectionBlurY' : 'bloomBlurY1',
    );
    if (!this.reflection) {
      run(this.blurB.texture, this.blurA, 2.5, true, 'bloomBlurX2');
      run(this.blurA.texture, this.blurB, 2.5, false, 'bloomBlurY2');
    }
  }

  private readonly maskMaterial = (source: Material): Material => {
    const emission: unknown = source.userData.bloomMaterial;
    if (emission instanceof Material) return emission;
    return isEmissive(source) ? source : this.occluder;
  };

  private selectiveMaterial(source: Material): Material {
    const emission = this.maskMaterial(source);
    if (!source.visible || emission === this.occluder) return this.omitted;
    let cached = this.variants.get(emission);
    if (!cached) {
      const variant = emission.clone();
      variant.onBeforeCompile = (shader, renderer) => {
        emission.onBeforeCompile.call(variant, shader, renderer);
        shader.uniforms = { ...shader.uniforms, ...this.depthUniforms };
        shader.fragmentShader =
          depthDeclarations +
          shader.fragmentShader.replace(
            /void\s+main\s*\(\s*\)\s*\{/,
            (main) => main + depthComparison,
          );
      };
      variant.customProgramCacheKey = () =>
        emission.customProgramCacheKey() + ':colorDepthBloom';
      const release = (): void => {
        variant.dispose();
        this.variants.delete(emission);
        emission.removeEventListener('dispose', release);
      };
      emission.addEventListener('dispose', release);
      cached = { material: variant, version: emission.version, release };
      this.variants.set(emission, cached);
    }
    const variant = cached.material;
    // Bez Material.copy(): ShaderMaterial.copy klonuje uniformy, a Material.copy
    // serializuje userData. Referencje zachowują też animowane uniformy i kolory.
    const from = emission as unknown as Record<string, unknown>;
    const to = variant as unknown as Record<string, unknown>;
    for (const key in emission)
      if (!variantOwnProperties.has(key)) to[key] = from[key];
    if (cached.version !== emission.version) {
      variant.needsUpdate = true;
      cached.version = emission.version;
    }
    variant.depthTest = true;
    variant.depthWrite = false;
    return variant;
  }

  private renderMask(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
  ): void {
    const override = scene.overrideMaterial;
    const background = scene.background;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    try {
      scene.traverseVisible((object) => {
        const { material } = object as Renderable;
        if (!material) return;
        if (
          this.depthUniforms.bloomColorDepth.value &&
          !object.layers.isEnabled(VIEWMODEL_LAYER)
        ) {
          this.swappedMeshes.push(object as Mesh);
          this.swappedMaterials.push(material);
          if (Array.isArray(material)) {
            let selected = this.materialArrays.get(object);
            if (!selected) {
              selected = [];
              this.materialArrays.set(object, selected);
            }
            selected.length = material.length;
            for (let i = 0; i < material.length; i++)
              selected[i] = this.selectiveMaterial(material[i]!);
            (object as Renderable).material = selected;
          } else {
            (object as Renderable).material = this.selectiveMaterial(material);
          }
          return;
        }
        if ('isMesh' in object) {
          const sources = Array.isArray(material) ? material : [material];
          if (sources.every(isSeeThrough)) {
            this.hidden.push(object);
            object.visible = false;
            return;
          }
          this.swappedMeshes.push(object as Mesh);
          this.swappedMaterials.push(material);
          (object as Mesh).material = Array.isArray(material)
            ? material.map(this.maskMaterial)
            : this.maskMaterial(material);
        } else if (!isEmissive(material)) {
          this.hidden.push(object);
          object.visible = false;
        }
      });
      scene.overrideMaterial = null;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.mask);
      if (this.reflection) renderer.render(scene, camera);
      else renderWithViewmodel(renderer, scene, camera);
    } finally {
      for (let i = 0; i < this.swappedMeshes.length; i++)
        this.swappedMeshes[i]!.material = this.swappedMaterials[i]!;
      for (const object of this.hidden) object.visible = true;
      this.swappedMeshes.length = 0;
      this.swappedMaterials.length = 0;
      this.hidden.length = 0;
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
    }
  }

  dispose(): void {
    this.mask.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.occluder.dispose();
    this.omitted.dispose();
    for (const variant of this.variants.values()) variant.release();
    this.variants.clear();
    this.blur.dispose();
  }
}
