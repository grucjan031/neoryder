import {
  Color,
  DepthTexture,
  HalfFloatType,
  Matrix3,
  Matrix4,
  MeshNormalMaterial,
  NearestFilter,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type {
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { EventBus } from '../core/events';
import { tuning } from '../core/tuning';
import { BloomPass } from './bloom';
import { FullscreenPass, fullscreenVertex } from './fullscreen';
import { syncMaterials } from './materials';
import { PostFxPass, PostFxState } from './postFx';
import { renderWithViewmodel } from './viewmodelLayer';

const fragmentShader = /* glsl */ `
  #include <packing>
  uniform sampler2D colorMap;
  uniform sampler2D normalMap;
  uniform sampler2D depthMap;
  uniform vec2 texelSize;
  uniform float thickness;
  uniform float depthThreshold;
  uniform float normalThreshold;
  uniform vec3 outlineColor;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float viewmodelDepth;
  uniform bool perspective;
  uniform sampler2D bloomMap;
  uniform float bloomStrength;
  uniform float skyGradient;
  uniform float skyHeight;
  uniform vec3 skyTop;
  uniform vec3 skyHorizon;
  uniform mat4 inverseProjection;
  uniform mat3 cameraRotation;
  uniform float fogStrength;
  uniform float fogNear;
  uniform float fogFar;
  uniform vec3 fogColor;
  uniform float aspect;
  uniform float vignetteStrength;
  uniform float vignetteRadius;
  uniform float vignetteSoftness;
  varying vec2 vUv;

  float viewDepth(vec2 uv) {
    float depth = texture2D(depthMap, uv).x;
    // Głębia viewmodelu jest ściśnięta do [0, viewmodelDepth]: przywracamy pełny zakres.
    if (depth < viewmodelDepth) depth /= viewmodelDepth;
    return -(perspective
      ? perspectiveDepthToViewZ(depth, cameraNear, cameraFar)
      : orthographicDepthToViewZ(depth, cameraNear, cameraFar));
  }

  vec3 normalAt(vec2 uv) {
    return texture2D(normalMap, uv).xyz * 2.0 - 1.0;
  }

  void main() {
    vec2 offset = texelSize * thickness;
    float centerDepth = max(viewDepth(vUv), cameraNear);
    float dx = 0.0;
    float dy = 0.0;
    vec3 nx = vec3(0.0);
    vec3 ny = vec3(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 uv = vUv + vec2(float(x), float(y)) * offset;
        float wx = float(x) * (y == 0 ? 2.0 : 1.0);
        float wy = float(y) * (x == 0 ? 2.0 : 1.0);
        // Różnica względem środka ogranicza utratę precyzji daleko od kamery.
        float depth = (viewDepth(uv) - centerDepth) / centerDepth;
        dx += depth * wx;
        dy += depth * wy;
        nx += normalAt(uv) * wx;
        ny += normalAt(uv) * wy;
      }
    }
    float depthEdge = length(vec2(dx, dy)) / 8.0;
    float normalEdge = sqrt(dot(nx, nx) + dot(ny, ny)) / 8.0;
    float edge = max(step(depthThreshold, depthEdge), step(normalThreshold, normalEdge));
    if (thickness <= 0.0) edge = 0.0;
    vec4 color = texture2D(colorMap, vUv);
    vec3 rgb = color.rgb;
    vec3 line = outlineColor;
    // Brak geometrii w buforze głębi = niebo: gradient pionowy zamiast płaskiego tła.
    if (texture2D(depthMap, vUv).x >= 1.0) {
      if (skyGradient > 0.0) {
        vec4 view = inverseProjection * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        float up = (cameraRotation * normalize(view.xyz / view.w)).y;
        vec3 sky = mix(skyHorizon, skyTop, smoothstep(0.0, skyHeight, up));
        rgb = mix(rgb, sky, skyGradient);
      }
    } else if (fogStrength > 0.0) {
      // Mgła ku bieli ściąga też kontury, więc dalekie obiekty odcinają się od bliskich.
      float fog = smoothstep(fogNear, fogFar, centerDepth) * fogStrength;
      rgb = mix(rgb, fogColor, fog);
      line = mix(line, fogColor, fog);
    }
    rgb = mix(rgb, line, edge);
    if (bloomStrength > 0.0) {
      // Halo nakładane "over": widoczne także na bieli, która sama się nie rozmywa.
      vec4 glow = texture2D(bloomMap, vUv);
      rgb = rgb * (1.0 - clamp(glow.a * bloomStrength, 0.0, 1.0)) + glow.rgb * bloomStrength;
    }
    if (vignetteStrength > 0.0) {
      vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
      float radius = length(c) / length(vec2(aspect, 1.0)) * 2.0;
      rgb *= 1.0 - vignetteStrength * smoothstep(vignetteRadius, vignetteRadius + vignetteSoftness, radius);
    }
    gl_FragColor = vec4(rgb, color.a);
    #include <colorspace_fragment>
  }
`;

/**
 * Pipeline stylu: kolor + normalne/głębia (obrys Sobela, niebo, mgła), opcjonalnie bloom
 * selektywny, opcjonalnie końcowy pass kompozycji (winieta, impulsy obrażeń i Skupienia).
 */
export class StylePipeline {
  private readonly colorTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
  });
  private readonly normalTarget = new WebGLRenderTarget(1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthTexture: new DepthTexture(1, 1, UnsignedIntType),
  });
  private readonly normalMaterial = new MeshNormalMaterial({
    toneMapped: false,
  });
  private readonly uniforms = {
    colorMap: { value: this.colorTarget.texture },
    normalMap: { value: this.normalTarget.texture },
    depthMap: { value: this.normalTarget.depthTexture },
    texelSize: { value: new Vector2(1, 1) },
    thickness: { value: 1 },
    depthThreshold: { value: 0 },
    normalThreshold: { value: 0 },
    outlineColor: { value: new Color() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    viewmodelDepth: { value: 0.01 },
    perspective: { value: true },
    bloomMap: { value: this.colorTarget.texture as Texture },
    bloomStrength: { value: 0 },
    skyGradient: { value: 0 },
    skyHeight: { value: 0.5 },
    skyTop: { value: new Color() },
    skyHorizon: { value: new Color() },
    inverseProjection: { value: new Matrix4() },
    cameraRotation: { value: new Matrix3() },
    fogStrength: { value: 0 },
    fogNear: { value: 0 },
    fogFar: { value: 1 },
    fogColor: { value: new Color() },
    aspect: { value: 1 },
    vignetteStrength: { value: 0 },
    vignetteRadius: { value: 0.55 },
    vignetteSoftness: { value: 0.6 },
  };
  private readonly composite = new FullscreenPass(
    new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: fullscreenVertex,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly drawingSize = new Vector2();
  private readonly clearColor = new Color();
  /** Tworzone przy pierwszym użyciu: wyłączone przełączniki nie kosztują pamięci. */
  private bloom: BloomPass | undefined;
  private postFx: PostFxPass | undefined;
  private readonly postFxState = new PostFxState();
  private lastRenderMs = 0;
  private offEvents: (() => void) | undefined;

  constructor(private readonly renderer: WebGLRenderer) {
    const size = renderer.getSize(new Vector2());
    this.setSize(size.x, size.y);
  }

  /** Stan impulsów kompozycji (obrażenia, Skupienie); testy i debug mogą go ustawiać wprost. */
  get fxState(): PostFxState {
    return this.postFxState;
  }

  /** Podpina zdarzenia: spadek HP gracza i `focus`. Odpina `dispose()`. */
  bindEvents(bus: EventBus): void {
    this.offEvents?.();
    this.offEvents = this.postFxState.bind(bus);
  }

  /** Rozmiar CSS; cele uwzględniają aktualne devicePixelRatio renderera. */
  setSize(width: number, height: number): void {
    const ratio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * ratio));
    const h = Math.max(1, Math.floor(height * ratio));
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    this.uniforms.texelSize.value.set(1 / w, 1 / h);
    this.uniforms.aspect.value = w / h;
    this.bloom?.setSize(w, h);
    this.postFx?.setSize(w, h);
  }

  /**
   * `dt` to czas rzeczywisty klatki w s (impulsy kompozycji); bez niego liczony z zegara.
   * `outline = 0` omija cały pipeline stylu: zwykły render bez mgły, bloomu i postFx.
   */
  render(
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
    dt?: number,
  ): void {
    syncMaterials();
    const now = performance.now();
    const frameDt =
      dt ?? (this.lastRenderMs > 0 ? (now - this.lastRenderMs) / 1000 : 0);
    this.lastRenderMs = now;
    this.postFxState.update(Math.min(frameDt, 0.25));
    if (tuning.render.outline === 0) {
      renderWithViewmodel(this.renderer, scene, camera);
      return;
    }
    // Zmiana DPR nie musi wywołać zdarzenia resize.
    this.renderer.getDrawingBufferSize(this.drawingSize);
    if (
      this.colorTarget.width !== this.drawingSize.x ||
      this.colorTarget.height !== this.drawingSize.y
    ) {
      const size = this.renderer.getSize(new Vector2());
      this.setSize(size.x, size.y);
    }
    const t = tuning.render;
    const uniforms = this.uniforms;
    uniforms.thickness.value = t.outlineThickness;
    uniforms.depthThreshold.value = t.outlineDepthThreshold;
    uniforms.normalThreshold.value = t.outlineNormalThreshold;
    uniforms.outlineColor.value.set(t.outlineColor);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.viewmodelDepth.value = Math.min(
      Math.max(t.viewmodelDepth, 1e-5),
      1,
    );
    uniforms.perspective.value = 'isPerspectiveCamera' in camera;
    uniforms.skyGradient.value = t.skyGradient;
    uniforms.skyHeight.value = Math.max(t.skyGradientHeight, 1e-3);
    uniforms.skyTop.value.set(t.skyTop);
    uniforms.skyHorizon.value.set(t.skyHorizon);
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraRotation.value.setFromMatrix4(camera.matrixWorld);
    uniforms.fogStrength.value = t.fogStrength;
    uniforms.fogNear.value = t.fogNear;
    uniforms.fogFar.value = Math.max(t.fogFar, t.fogNear + 1e-3);
    uniforms.fogColor.value.set(t.fogColor);
    const bloomOn = t.bloom > 0 && t.bloomStrength > 0;
    const postFxOn = t.postFx > 0;
    uniforms.vignetteStrength.value = postFxOn ? t.vignetteStrength : 0;
    uniforms.vignetteRadius.value = t.vignetteRadius;
    uniforms.vignetteSoftness.value = t.vignetteSoftness;
    const impulse = postFxOn && this.postFxState.active;

    const renderer = this.renderer;
    const target = renderer.getRenderTarget();
    const override = scene.overrideMaterial;
    const background = scene.background;
    const autoClear = renderer.autoClear;
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    try {
      renderer.autoClear = true;
      renderer.setRenderTarget(this.colorTarget);
      renderWithViewmodel(renderer, scene, camera);
      scene.overrideMaterial = this.normalMaterial;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.normalTarget);
      renderWithViewmodel(renderer, scene, camera);
      if (bloomOn) {
        this.bloom ??= new BloomPass(
          this.colorTarget.width,
          this.colorTarget.height,
        );
        this.bloom.render(renderer, scene, camera);
      }
      uniforms.bloomMap.value = bloomOn
        ? this.bloom!.texture
        : this.colorTarget.texture;
      uniforms.bloomStrength.value = bloomOn ? t.bloomStrength : 0;
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      if (impulse) {
        if (!this.postFx) {
          this.postFx = new PostFxPass(this.postFxState);
          this.postFx.setSize(this.colorTarget.width, this.colorTarget.height);
        }
        this.composite.render(renderer, this.postFx.input);
        this.postFx.render(renderer, target);
      } else {
        this.composite.render(renderer, target);
      }
    } finally {
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(target);
    }
  }

  dispose(): void {
    this.offEvents?.();
    this.offEvents = undefined;
    this.colorTarget.dispose();
    this.normalTarget.depthTexture?.dispose();
    this.normalTarget.dispose();
    this.normalMaterial.dispose();
    this.composite.dispose();
    this.postFx?.dispose();
    this.bloom?.dispose();
  }
}

export function createRenderPipeline(renderer: WebGLRenderer): StylePipeline {
  return new StylePipeline(renderer);
}
