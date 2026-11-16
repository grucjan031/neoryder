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
import { renderWithViewmodel } from './viewmodelLayer';
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

/**
 * Bloom selektywny: maska to scena, w której tylko materiały emisyjne mają kolor,
 * a reszta zapisuje głębię i zerową emisję (zasłania neony, sama nie świeci). Maska jest
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
  ): void {
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

  private renderMask(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
  ): void {
    const override = scene.overrideMaterial;
    const background = scene.background;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    scene.traverseVisible((object) => {
      const { material } = object as Renderable;
      if (!material) return;
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
    try {
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
    this.blur.dispose();
  }
}
