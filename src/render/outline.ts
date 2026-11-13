import {
  Color,
  DepthTexture,
  HalfFloatType,
  Mesh,
  MeshNormalMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { tuning } from '../core/tuning';
import { syncMaterials } from './materials';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

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
  uniform bool perspective;
  varying vec2 vUv;

  float viewDepth(vec2 uv) {
    float depth = texture2D(depthMap, uv).x;
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
    gl_FragColor = vec4(mix(color.rgb, outlineColor, edge), color.a);
    #include <colorspace_fragment>
  }
`;

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
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly screen = new Scene();
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
    perspective: { value: true },
  };
  private readonly compositeMaterial = new ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly quad = new Mesh(
    new PlaneGeometry(2, 2),
    this.compositeMaterial,
  );
  private readonly drawingSize = new Vector2();
  private readonly clearColor = new Color();

  constructor(private readonly renderer: WebGLRenderer) {
    this.screen.add(this.quad);
    const size = renderer.getSize(new Vector2());
    this.setSize(size.x, size.y);
  }

  /** Rozmiar CSS; cele uwzględniają aktualne devicePixelRatio renderera. */
  setSize(width: number, height: number): void {
    const ratio = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * ratio));
    const h = Math.max(1, Math.floor(height * ratio));
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    this.uniforms.texelSize.value.set(1 / w, 1 / h);
  }

  render(scene: Scene, camera: PerspectiveCamera | OrthographicCamera): void {
    syncMaterials();
    if (tuning.render.outline === 0) {
      this.renderer.render(scene, camera);
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
    const uniforms = this.uniforms;
    uniforms.thickness.value = tuning.render.outlineThickness;
    uniforms.depthThreshold.value = tuning.render.outlineDepthThreshold;
    uniforms.normalThreshold.value = tuning.render.outlineNormalThreshold;
    uniforms.outlineColor.value.set(tuning.render.outlineColor);
    uniforms.cameraNear.value = camera.near;
    uniforms.cameraFar.value = camera.far;
    uniforms.perspective.value = 'isPerspectiveCamera' in camera;

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
      renderer.render(scene, camera);
      scene.overrideMaterial = this.normalMaterial;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.normalTarget);
      renderer.render(scene, camera);
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      renderer.setRenderTarget(target);
      renderer.render(this.screen, this.camera);
    } finally {
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.setClearColor(this.clearColor, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(target);
    }
  }

  dispose(): void {
    this.colorTarget.dispose();
    this.normalTarget.depthTexture?.dispose();
    this.normalTarget.dispose();
    this.normalMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quad.geometry.dispose();
    this.screen.clear();
  }
}

export function createRenderPipeline(renderer: WebGLRenderer): StylePipeline {
  return new StylePipeline(renderer);
}
