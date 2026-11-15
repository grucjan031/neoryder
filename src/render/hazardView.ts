import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Hazard } from '../world/roomSchema';
import type { HazardState } from '../world/hazards';
import { getMaterial } from './materials';

interface View {
  root: Group;
  glow: MeshBasicMaterial;
  surface?: Mesh;
  halo?: Mesh<CylinderGeometry, MeshBasicMaterial>;
  field?: ShaderMaterial;
}

const fieldVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fieldFragment = /* glsl */ `
  uniform float uTime, uIntensity;
  uniform vec3 uAmber, uWhite;
  varying vec2 vUv;
  float hash(float p) {
    return fract(sin(p * 127.1) * 43758.5453);
  }
  float jagged(float p, float seed) {
    return mix(hash(floor(p) + seed), hash(floor(p) + seed + 1.0), fract(p));
  }
  void main() {
    float edge = smoothstep(0.0, 0.035,
      min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    float arcs = 0.0;
    float core = 0.0;
    for (int i = 0; i < 4; i++) {
      float seed = float(i) * 19.7 + floor(uTime * 7.0);
      vec2 uv = (i == 1 || i == 3) ? vUv.yx : vUv;
      float center = 0.17 + float(i) * 0.21
        + sin(uTime * 1.8 + float(i) * 2.0) * 0.04;
      float path = center + (jagged(uv.x * 23.0, seed) - 0.5) * 0.15;
      float d = abs(uv.y - path);
      float aa = max(fwidth(d), 0.001);
      arcs = max(arcs, 1.0 - smoothstep(0.004, 0.025 + aa, d));
      core = max(core, 1.0 - smoothstep(0.001, 0.004 + aa, d));
    }
    // W off zostaje mokra tafla; linie pojawiają się dopiero przy ostrzeżeniu.
    float energized = smoothstep(0.08, 0.2, uIntensity);
    vec3 color = mix(uAmber, uWhite, core * energized);
    float alpha = edge * uIntensity * (0.18 + energized * arcs * 0.82);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

/** Tylko prezentacja stanu symulacji; maska bloomu zachowuje test głębi ścian. */
export class HazardView {
  readonly root = new Group();
  private readonly views = new Map<string, View>();
  private readonly geometries: BufferGeometry[] = [];
  private readonly amber = new Color('#ffb84d');
  private readonly warmWhite = new Color('#fff1d6');

  constructor(hazards: readonly Hazard[]) {
    for (const hazard of hazards) {
      const root = new Group();
      root.name = `hazard:${hazard.id}`;
      const glow = new MeshBasicMaterial({
        color: '#ffb84d',
        toneMapped: false,
      });
      glow.userData.bloom = true;
      const view: View = { root, glow };
      this.views.set(hazard.id, view);
      this.root.add(root);
      const mesh = (
        geometry: BufferGeometry,
        material: Material = glow,
      ): Mesh => {
        this.geometries.push(geometry);
        const result = new Mesh(geometry, material);
        root.add(result);
        return result;
      };
      if (hazard.kind === 'explosive_barrel') {
        glow.color.multiplyScalar(0.7);
        const body = mesh(new CylinderGeometry(0.4, 0.4, 1.1, 16));
        body.material = getMaterial('hazard');
        body.position.y = 0.55;
        for (const y of [0.08, 1.02]) {
          const band = mesh(new CylinderGeometry(0.405, 0.405, 0.06, 16));
          band.position.y = y;
        }
        root.position.copy(hazard.position);
      } else if (hazard.kind === 'electric_field') {
        const { x, z } = hazard.size;
        root.position.set(
          hazard.position.x,
          hazard.position.y - hazard.size.y / 2 + 0.025,
          hazard.position.z,
        );
        const plate = mesh(new BoxGeometry(x, 0.015, z), getMaterial('metal'));
        view.field = new ShaderMaterial({
          vertexShader: fieldVertex,
          fragmentShader: fieldFragment,
          uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 0.08 },
            uAmber: { value: this.amber },
            uWhite: { value: this.warmWhite },
          },
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });
        view.field.userData.bloom = false;
        const surface = mesh(new PlaneGeometry(x, z), view.field);
        surface.rotation.x = -Math.PI / 2;
        surface.position.y = plate.position.y + 0.009;
        surface.userData.noOutline = true;
        for (const sign of [-1, 1]) {
          const alongX = mesh(new BoxGeometry(x, 0.025, 0.025));
          alongX.position.z = (sign * z) / 2;
          const alongZ = mesh(new BoxGeometry(0.025, 0.025, z));
          alongZ.position.x = (sign * x) / 2;
        }
      } else {
        const from = new Vector3().copy(hazard.from);
        const to = new Vector3().copy(hazard.to);
        const direction = to.clone().sub(from);
        const length = direction.length();
        if (length > 0) direction.divideScalar(length);
        for (const p of [from, to]) {
          const post = mesh(
            new BoxGeometry(0.1, Math.max(0, p.y), 0.1),
            getMaterial('metal'),
          );
          post.position.set(p.x, p.y / 2, p.z);
          const emitter = mesh(
            new BoxGeometry(0.2, 0.2, 0.2),
            getMaterial('metal'),
          );
          emitter.position.copy(p);
          emitter.lookAt(p === from ? to : from);
          const face = mesh(new BoxGeometry(0.14, 0.14, 0.012));
          face.quaternion.copy(emitter.quaternion);
          face.position
            .copy(p)
            .addScaledVector(direction, p === from ? 0.106 : -0.106);
        }
        view.surface = mesh(new CylinderGeometry(0.03, 0.03, length, 12));
        view.surface.position.copy(from).add(to).multiplyScalar(0.5);
        if (length > 0)
          view.surface.quaternion.setFromUnitVectors(
            new Vector3(0, 1, 0),
            direction,
          );
        const haloMaterial = new MeshBasicMaterial({
          color: '#ffb84d',
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          opacity: 0.35,
          toneMapped: false,
        });
        haloMaterial.userData.bloom = false;
        const haloGeometry = new CylinderGeometry(0.12, 0.12, length, 16);
        this.geometries.push(haloGeometry);
        view.halo = new Mesh(haloGeometry, haloMaterial);
        view.halo.position.copy(view.surface.position);
        view.halo.quaternion.copy(view.surface.quaternion);
        view.halo.userData.noOutline = true;
        view.halo.visible = false;
        root.add(view.halo);
      }
    }
  }

  update(states: readonly HazardState[], _alpha: number): void {
    void _alpha;
    const time = performance.now() / 1000;
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      const view = this.views.get(state.id);
      if (!view) continue;
      view.root.visible = state.alive;
      if (state.kind === 'explosive_barrel') continue;
      const wave = 0.5 + 0.5 * Math.sin(state.phaseT * Math.PI * 12);
      if (view.field) {
        view.field.uniforms.uTime!.value = time;
        view.field.uniforms.uIntensity!.value =
          state.phase === 'off'
            ? 0.08
            : state.phase === 'warn'
              ? 0.2 + wave * 0.4
              : 1;
        view.glow.color
          .copy(this.amber)
          .multiplyScalar(
            state.phase === 'off'
              ? 0.04
              : state.phase === 'warn'
                ? 0.08 + wave * 0.08
                : 0.18,
          );
        view.glow.userData.bloom = false;
        continue;
      }
      const intensity =
        state.phase === 'off'
          ? 0.12
          : state.phase === 'warn'
            ? 0.3 + wave * 0.7
            : 1.2;
      view.glow.color
        .copy(state.phase === 'on' ? this.warmWhite : this.amber)
        .multiplyScalar(intensity);
      view.glow.userData.bloom = state.phase !== 'off';
      if (view.halo) {
        view.halo.visible = state.phase === 'on';
        view.halo.material.opacity = 0.33 + wave * 0.04;
      }
      if (view.surface) {
        view.surface.visible = state.phase !== 'off';
        if (state.kind === 'laser_gate') {
          const scale = state.phase === 'warn' ? 0.4 : 1;
          view.surface.scale.set(scale, 1, scale);
        }
      }
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    for (const view of this.views.values()) {
      view.glow.dispose();
      view.halo?.material.dispose();
      view.field?.dispose();
    }
    this.views.clear();
  }
}
