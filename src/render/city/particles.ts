import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
} from 'three';
import type { Camera } from 'three';
import { ParticlePool } from '../../vfx/fxPool';
import { tuning } from '../../core/tuning';

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    vUv = uv; vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform float opacity;
  varying vec2 vUv;
  varying vec3 vColor;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float cloud = pow(max(0.0, 1.0 - r * r), 3.0);
    float wisps = 0.8 + 0.2 * sin(vUv.x * 24.0 + sin(vUv.y * 18.0));
    gl_FragColor = vec4(vColor, cloud * wisps * opacity);
    #include <colorspace_fragment>
  }
`;

/** Jedna geometria, materiał i bufor instancji na pulę; brak alokacji w renderze. */
export class CityParticleBatch {
  readonly pool: ParticlePool;
  readonly mesh: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly color = new Color();

  constructor(
    capacity: number,
    readonly kind: 'steam' | 'spark' | 'drop' | 'ring',
    opacity: number,
  ) {
    this.pool = new ParticlePool(Math.max(1, Math.floor(capacity)));
    const material =
      kind === 'steam'
        ? new ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            uniforms: { opacity: { value: opacity } },
            transparent: true,
            blending: AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
          })
        : new MeshBasicMaterial({
            transparent: true,
            opacity,
            blending: AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
          });
    material.userData.bloom = kind === 'spark';
    this.mesh = new InstancedMesh(
      kind === 'ring' ? new RingGeometry(0.72, 1, 16) : new PlaneGeometry(1, 1),
      material,
      this.pool.capacity,
    );
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.renderOrder = tuning.city.glowRenderOrder;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // Bufor koloru musi istnieć przed pierwszą kompilacją shadera.
    this.mesh.setColorAt(0, this.color);
  }

  render(camera: Camera, growth = 0): void {
    let count = 0;
    for (const p of this.pool.particles) {
      if (p.life === 0) continue;
      const age = p.age / p.life;
      const size = p.size * (1 + age * growth);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.quaternion.copy(camera.quaternion);
      if (this.kind === 'ring') this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.set(
        size,
        size * (this.kind === 'drop' ? 4 : this.kind === 'spark' ? 2 : 1),
        1,
      );
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);
      const fade = this.kind === 'steam' ? Math.sin(Math.PI * age) : 1 - age;
      this.color.setHex(p.color).multiplyScalar(Math.max(0, fade));
      this.mesh.setColorAt(count++, this.color);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setOpacity(opacity: number): void {
    const material = this.mesh.material;
    if (material instanceof ShaderMaterial)
      material.uniforms.opacity!.value = opacity;
    else if (!Array.isArray(material)) material.opacity = opacity;
  }
}
