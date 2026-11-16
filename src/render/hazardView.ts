import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  CircleGeometry,
  DataTexture,
  LinearFilter,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Hazard } from '../world/roomSchema';
import type { HazardState } from '../world/hazards';
import { getMaterial } from './materials';

/** Po wybuchu beczki: osmalenie podłogi, żar i dym unoszący się kilka sekund (kosmetyka). */
interface Wreck {
  scorch: Mesh<CircleGeometry, MeshBasicMaterial>;
  ember: Sprite;
  smoke: Sprite[];
  /** Czas od zniszczenia (s); < 0 — beczka cała. */
  age: number;
  lastMs: number;
}

const SMOKE_PUFFS = 6;
const SMOKE_S = 2.6;
const EMBER_S = 1.4;

/** Miękka okrągła plama (bez DOM, działa w testach). */
function puffTexture(size = 32): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c) / c;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(Math.max(0, 1 - r) ** 1.8 * 255);
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface View {
  root: Group;
  glow: MeshBasicMaterial;
  wreck?: Wreck;
  surface?: Mesh;
  halo?: Mesh<CylinderGeometry, ShaderMaterial>;
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

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const beamFragment = /* glsl */ `
  uniform vec3 uAmber, uWhite;
  uniform float uTime, uLength, uIntensity, uDash, uHot;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Miękka wiązka: jasna oś, brzeg rurki gaśnie do zera (bez płaskiego „paska”).
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float soft = pow(facing, 2.2);
    float along = vUv.y * uLength;
    float flow = 0.8 + 0.2 * sin(along * 7.0 - uTime * 40.0);
    // Ostrzeżenie: maszerujące kreski od nadajnika — czytelny telegraf przed włączeniem.
    float dash = mix(1.0, smoothstep(0.35, 0.5, abs(fract(along * 1.6 - uTime * 2.5) - 0.5) * 2.0), uDash);
    vec3 color = mix(uAmber, uWhite, soft * soft * uHot);
    gl_FragColor = vec4(color * 1.3, clamp(soft * flow * dash * uIntensity, 0.0, 1.0));
  }
`;

/** Tylko prezentacja stanu symulacji; maska bloomu zachowuje test głębi ścian. */
export class HazardView {
  readonly root = new Group();
  private readonly views = new Map<string, View>();
  private readonly geometries: BufferGeometry[] = [];
  private readonly amber = new Color('#ffb84d');
  private readonly warmWhite = new Color('#fff1d6');
  private readonly puff = puffTexture();
  /** Dym i żar wraków są poza `root` beczki, bo ten znika razem z beczką. */
  private readonly wrecks = new Group();
  /** Rozgrzewka programów dymu i żaru (krycie 0) w pierwszych klatkach pokoju. */
  private warmFrames = 2;

  constructor(hazards: readonly Hazard[]) {
    this.wrecks.name = 'hazard-wrecks';
    this.root.add(this.wrecks);
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
        view.wreck = this.makeWreck(hazard.position);
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
        const haloMaterial = new ShaderMaterial({
          vertexShader: beamVertex,
          fragmentShader: beamFragment,
          uniforms: {
            uAmber: { value: this.amber },
            uWhite: { value: this.warmWhite },
            uTime: { value: 0 },
            uLength: { value: length },
            uIntensity: { value: 0 },
            uDash: { value: 0 },
            uHot: { value: 1 },
          },
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        });
        haloMaterial.userData.bloom = true;
        const haloGeometry = new CylinderGeometry(
          0.14,
          0.14,
          length,
          16,
          1,
          true,
        );
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

  private makeWreck(position: { x: number; y: number; z: number }): Wreck {
    const scorchGeometry = new CircleGeometry(1.15, 24);
    this.geometries.push(scorchGeometry);
    const scorch = new Mesh(
      scorchGeometry,
      new MeshBasicMaterial({
        color: '#05070c',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(position.x, position.y + 0.02, position.z);
    scorch.userData.noOutline = true;
    scorch.userData.vfxPool = true;
    scorch.visible = false;
    const ember = new Sprite(
      new SpriteMaterial({
        map: this.puff,
        color: '#ffae1a',
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ember.material.userData.bloom = true;
    ember.position.set(position.x, position.y + 0.25, position.z);
    ember.visible = false;
    const smoke = Array.from({ length: SMOKE_PUFFS }, () => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: this.puff,
          color: '#4a5266',
          transparent: true,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      return sprite;
    });
    for (const object of [scorch, ember, ...smoke]) {
      // Kontur z postprocessu obrysowałby prostokąty sprite'ów.
      object.userData.noOutline = true;
      this.wrecks.add(object);
    }
    return { scorch, ember, smoke, age: -1, lastMs: -1 };
  }

  private updateWreck(
    wreck: Wreck,
    alive: boolean,
    origin: Vector3,
    nowMs: number,
  ): void {
    if (alive) {
      wreck.age = -1;
      const warm = this.warmFrames > 0;
      wreck.scorch.visible = wreck.ember.visible = warm;
      wreck.scorch.material.opacity = wreck.ember.material.opacity = 0;
      for (const s of wreck.smoke) {
        s.visible = warm;
        s.material.opacity = 0;
      }
      return;
    }
    if (wreck.age < 0) {
      wreck.age = 0;
      wreck.lastMs = nowMs;
    }
    wreck.age += Math.min(0.1, Math.max(0, nowMs - wreck.lastMs) / 1000);
    wreck.lastMs = nowMs;
    const age = wreck.age;
    wreck.scorch.visible = true;
    wreck.scorch.material.opacity = 0.7 * Math.min(1, age / 0.15);
    const emberK = age / EMBER_S;
    wreck.ember.visible = emberK < 1;
    if (wreck.ember.visible) {
      const flicker = 0.8 + 0.2 * Math.sin(age * 31) * Math.sin(age * 13);
      wreck.ember.material.opacity = (1 - emberK) ** 1.5 * flicker;
      const size = 1.3 * (1 - emberK * 0.5);
      wreck.ember.scale.set(size * 1.4, size * 0.7, 1);
    }
    for (let i = 0; i < wreck.smoke.length; i++) {
      const puff = wreck.smoke[i]!;
      const start = i * 0.14;
      const k = (age - start) / SMOKE_S;
      puff.visible = k > 0 && k < 1;
      if (!puff.visible) continue;
      const side = ((i * 2.399) % (Math.PI * 2)) - Math.PI;
      const rise = 0.4 + k * 3.2;
      puff.position.set(
        origin.x + Math.cos(side) * (0.25 + k * 0.6),
        origin.y + rise,
        origin.z + Math.sin(side) * (0.25 + k * 0.6),
      );
      const size = 0.8 + k * 2.4;
      puff.scale.set(size, size, 1);
      puff.material.rotation = side + k * 0.8;
      // Ciemny dym nie zasłania pola walki: niskie krycie, szybkie zanikanie u góry.
      puff.material.opacity = 0.5 * Math.min(1, k * 6) * (1 - k) ** 1.4;
    }
  }

  update(states: readonly HazardState[], _alpha: number): void {
    void _alpha;
    const nowMs = performance.now();
    const time = nowMs / 1000;
    if (this.warmFrames > 0) this.warmFrames--;
    for (let i = 0; i < states.length; i++) {
      const state = states[i]!;
      const view = this.views.get(state.id);
      if (!view) continue;
      view.root.visible = state.alive;
      if (state.kind === 'explosive_barrel') {
        if (view.wreck)
          this.updateWreck(view.wreck, state.alive, view.root.position, nowMs);
        continue;
      }
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
        // Włączony: gorąca wiązka; ostrzeżenie: przerywana, pulsująca bursztynowa smuga.
        view.halo.visible = state.phase !== 'off';
        const u = view.halo.material.uniforms;
        u.uTime!.value = time;
        u.uDash!.value = state.phase === 'warn' ? 1 : 0;
        u.uHot!.value = state.phase === 'on' ? 1 : 0;
        u.uIntensity!.value = state.phase === 'on' ? 1.25 : 0.55 + wave * 0.6;
        view.halo.scale.set(
          state.phase === 'on' ? 1 : 0.55,
          1,
          state.phase === 'on' ? 1 : 0.55,
        );
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
    this.puff.dispose();
    for (const view of this.views.values()) {
      if (view.wreck) {
        view.wreck.scorch.material.dispose();
        view.wreck.ember.material.dispose();
        for (const s of view.wreck.smoke) s.material.dispose();
      }
      view.glow.dispose();
      view.halo?.material.dispose();
      view.field?.dispose();
    }
    this.views.clear();
  }
}
