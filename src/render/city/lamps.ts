import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import { tuning } from '../../core/tuning';
import type { CityLightDef, DecorDef } from '../../world/dressingSchema';
import { cityColor, disposeCityGroup } from './resources';
import { getPowerLevel } from '../powerLevel';

/** Model latarni z `public/assets/models/city/`; punkt lampy opisuje `tuning.city.lamp*`. */
export const LAMP_MODEL = 'city_street_lamp';

export interface LampFixture {
  /** Punkt świecenia (spód głowicy lampy) w świecie. */
  head: Vector3;
  /** Wysokość podstawy słupa: koniec stożka światła. */
  baseY: number;
}

/** Położenia lamp z dekoracji pokoju (pozycja, obrót i skala modelu). Czysta funkcja. */
export function lampFixtures(
  decor: readonly DecorDef[] | undefined,
): LampFixture[] {
  const out: LampFixture[] = [];
  for (const def of decor ?? []) {
    if (def.model !== LAMP_MODEL) continue;
    const scale = def.scale ?? 1;
    const yaw = def.yaw ?? 0;
    const forward = tuning.city.lampHeadForwardM * scale;
    out.push({
      head: new Vector3(
        def.position.x + Math.sin(yaw) * forward,
        def.position.y + tuning.city.lampHeadHeightM * scale,
        def.position.z + Math.cos(yaw) * forward,
      ),
      baseY: def.position.y,
    });
  }
  return out;
}

/** Latarnie jako światła punktowe: konkurują o pulę z pozostałymi i dostają plamę pod sobą. */
export function lampLightDefs(
  fixtures: readonly LampFixture[],
): CityLightDef[] {
  return fixtures.map((fixture) => ({
    position: fixture.head.clone().setY(fixture.head.y - 0.25),
    color: tuning.city.lampColor,
    intensity: tuning.city.lampLightIntensity,
    range: tuning.city.lampLightRange,
  }));
}

const vertex = /* glsl */ `
  uniform float slope;
  varying float vHeight;
  varying float vFacing;
  void main() {
    vHeight = -position.y;
    // Normalna stożka o wierzchołku w zerze, otwartego w dół; instancje nie są obracane.
    vec2 radial = normalize(position.xz + vec2(1e-5));
    vec3 n = normalize(vec3(radial.x, slope, radial.y));
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFacing = abs(dot(n, normalize(cameraPosition - world.xyz)));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 tint;
  uniform float opacity, heightPower, edgePower;
  varying float vHeight;
  varying float vFacing;
  void main() {
    // Jasny przy lampie, gaśnie ku ziemi; brzegi sylwetki znikają (miękki wolumen, bez krawędzi).
    float a = pow(clamp(1.0 - vHeight, 0.0, 1.0), heightPower)
      * pow(clamp(vFacing, 0.0, 1.0), edgePower) * opacity;
    gl_FragColor = vec4(tint, a);
    #include <colorspace_fragment>
  }
`;

/** Subtelne stożki światła pod latarniami: jeden InstancedMesh, addytywnie, bez cieni. */
export class LampCones {
  readonly root = new Group();
  private readonly mesh?: InstancedMesh<CylinderGeometry, ShaderMaterial>;
  private readonly matrix = new Matrix4();
  private builtAngle = Number.NaN;
  private disposed = false;

  constructor(private readonly fixtures: readonly LampFixture[]) {
    if (!fixtures.length) return;
    const geometry = new CylinderGeometry(0, 1, 1, 28, 1, true);
    geometry.translate(0, -0.5, 0);
    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        tint: { value: cityColor(tuning.city.lampColor) },
        opacity: { value: tuning.city.lampConeOpacity },
        heightPower: { value: tuning.city.lampConePower },
        edgePower: { value: tuning.city.lampConeEdgePower },
        slope: { value: 1 },
      },
      transparent: true,
      blending: AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      // Kamera może wejść do otwartego stożka światła.
      side: DoubleSide,
      toneMapped: false,
    });
    material.userData.bloom = false;
    this.mesh = new InstancedMesh(geometry, material, fixtures.length);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noOutline = true;
    this.mesh.renderOrder = tuning.city.glowRenderOrder;
    this.root.add(this.mesh);
  }

  update(_dtWorldS: number, _dtRealS: number, _camera: Camera): void {
    void _dtWorldS;
    void _dtRealS;
    void _camera;
    const mesh = this.mesh;
    if (this.disposed || !mesh) return;
    const t = tuning.city;
    const u = mesh.material.uniforms;
    u.opacity!.value = t.lampConeOpacity * getPowerLevel();
    u.heightPower!.value = t.lampConePower;
    u.edgePower!.value = t.lampConeEdgePower;
    const slope = Math.tan((t.lampConeAngleDeg * Math.PI) / 180);
    u.slope!.value = slope;
    if (slope === this.builtAngle) return;
    this.builtAngle = slope;
    this.fixtures.forEach((fixture, i) => {
      const length = Math.max(0.1, fixture.head.y - fixture.baseY);
      this.matrix
        .makeScale(length * slope, length, length * slope)
        .setPosition(fixture.head);
      mesh.setMatrixAt(i, this.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeCityGroup(this.root);
  }
}
