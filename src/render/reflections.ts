import { Matrix4, Mesh, MeshNormalMaterial, Plane, Vector3 } from 'three';
import type {
  Material,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { BloomPass } from './bloom';
import { renderWithViewmodel } from './viewmodelLayer';

/** RGB = normalna, A = podatność materiału na odbicie; ten sam pass geometrii. */
export class WetNormals {
  private readonly materials = new Map<number, MeshNormalMaterial>();
  private material(source: Material): MeshNormalMaterial {
    const wetness =
      typeof source.userData.wetness === 'number' ? source.userData.wetness : 0;
    let material = this.materials.get(wetness);
    if (!material) {
      material = new MeshNormalMaterial({ toneMapped: false });
      material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          'gl_FragColor.a = 1.0;',
          `gl_FragColor.a = ${wetness.toFixed(4)};`,
        );
      };
      material.customProgramCacheKey = () => `wetNormal:${wetness}`;
      this.materials.set(wetness, material);
    }
    return material;
  }
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
  ): void {
    const swapped: [Mesh, Material | Material[]][] = [];
    const override = scene.overrideMaterial;
    try {
      scene.overrideMaterial = null;
      scene.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        swapped.push([object, object.material]);
        object.material = Array.isArray(object.material)
          ? object.material.map((m) => this.material(m))
          : this.material(object.material);
      });
      renderWithViewmodel(renderer, scene, camera);
    } finally {
      for (const [mesh, material] of swapped) mesh.material = material;
      scene.overrideMaterial = override;
    }
  }
  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
  }
}

/** Odbita kamera, tylko emisja i zasłanianie, bez warstwy dłoni. 3 passy w 1/2. */
export class ReflectionPass {
  readonly projection = new Matrix4();
  private readonly bloom: BloomPass;
  private readonly plane = new Plane(new Vector3(0, 1, 0));
  constructor(width: number, height: number) {
    this.bloom = new BloomPass(width, height, true);
  }
  setSize(width: number, height: number): void {
    this.bloom.setSize(width, height);
  }
  get texture() {
    return this.bloom.texture;
  }
  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera | OrthographicCamera,
    floorY: number,
  ): void {
    camera.updateMatrixWorld();
    const mirror = camera.clone();
    const position = camera.getWorldPosition(new Vector3());
    const direction = camera.getWorldDirection(new Vector3());
    const up = new Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    position.y = 2 * floorY - position.y;
    direction.y *= -1;
    up.y *= -1;
    mirror.position.copy(position);
    mirror.up.copy(up);
    mirror.lookAt(position.clone().add(direction));
    mirror.layers.set(0);
    mirror.updateMatrixWorld();
    this.projection.multiplyMatrices(
      mirror.projectionMatrix,
      mirror.matrixWorldInverse,
    );
    const clipping = renderer.clippingPlanes;
    const target = renderer.getRenderTarget();
    this.plane.constant = -floorY - 0.001;
    try {
      renderer.clippingPlanes = [...(clipping ?? []), this.plane];
      this.bloom.render(renderer, scene, mirror);
    } finally {
      renderer.clippingPlanes = clipping;
      renderer.setRenderTarget(target);
    }
  }
  dispose(): void {
    this.bloom.dispose();
  }
}
