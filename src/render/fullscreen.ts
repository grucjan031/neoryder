import { Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three';
import type { ShaderMaterial, WebGLRenderTarget, WebGLRenderer } from 'three';

export const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Pełnoekranowy trójkąt-quad z własnym materiałem; rysuje do celu lub na ekran. */
export class FullscreenPass {
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly scene = new Scene();
  private readonly quad: Mesh;

  constructor(readonly material: ShaderMaterial) {
    this.quad = new Mesh(new PlaneGeometry(2, 2), material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  render(renderer: WebGLRenderer, target: WebGLRenderTarget | null): void {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.material.dispose();
    this.quad.geometry.dispose();
    this.scene.clear();
  }
}
