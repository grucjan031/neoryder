import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import type { Tuning } from '../core/tuning';

/** Moc stożkowa widziana przez render: tylko odczyt definicji i odnowienia. */
interface ConeLike {
  readonly def: {
    readonly kind: string;
    readonly coneAngleDeg?: number;
    readonly range?: number;
  };
  readonly cooldownRemaining: number;
}

const MAGENTA = new Color('#ff2bd6');
const PALE = new Color('#ffd6f5');
const Y = new Vector3(0, 1, 0);
const SLOTS = 6;
/** Fale w jednej salwie (echo za czołem fali). */
const RIPPLES = 3;

const capVertex = /* glsl */ `
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

const capFragment = /* glsl */ `
  uniform vec3 uColor, uPale;
  uniform float uOpacity, uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // uv.y = 0 na brzegu czaszy: jasna krawędź fali, środek prawie przezroczysty.
    float rim = 1.0 - smoothstep(0.0, 0.32, vUv.y);
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float fres = pow(1.0 - facing, 1.6);
    float streaks = pow(abs(sin((vUv.x * 22.0 + uTime * 1.5) * 3.14159)), 18.0);
    float a = rim * 0.95 + fres * 0.18 + streaks * rim * 0.5 + 0.015;
    vec3 color = mix(uColor, uPale, rim * rim * 0.7);
    gl_FragColor = vec4(color * 1.2, clamp(a * uOpacity, 0.0, 1.0));
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uColor, uPale;
  uniform float uOpacity, uTime;
  varying vec2 vUv;
  void main() {
    // RingGeometry: uv promieniowo od wnętrza; jasne czoło na zewnętrznym brzegu.
    float r = length(vUv - 0.5) * 2.0;
    float front = smoothstep(0.55, 0.98, r) * (1.0 - smoothstep(0.98, 1.0, r));
    vec3 color = mix(uColor, uPale, front * 0.6);
    gl_FragColor = vec4(color * 1.2, clamp((front * 1.2 + 0.08) * uOpacity, 0.0, 1.0));
  }
`;

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Wave {
  caps: Mesh<SphereGeometry, ShaderMaterial>[];
  ring: Mesh<RingGeometry, ShaderMaterial>;
  age: number;
  life: number;
  range: number;
  full: boolean;
  geometryAngle: number;
}

function material(fragment: string, vertex: string): ShaderMaterial {
  const m = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uColor: { value: MAGENTA.clone() },
      uPale: { value: PALE.clone() },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  m.userData.bloom = true;
  return m;
}

/**
 * Fala Pchnięcia i Fali uderzeniowej Rezonansu (kosmetyka): rozszerzająca się magentowa czasza
 * w kierunku celowania (stożek) albo pierścień przy podłodze (360°). Wykrywa użycie mocy po skoku
 * odnowienia — czyta wyłącznie publiczny stan mocy, nie wpływa na symulację.
 */
export class ResonanceWaveFx {
  readonly root = new Group();
  private readonly waves: Wave[] = [];
  private readonly cooldowns = new WeakMap<object, number>();
  private readonly ringGeometry = new RingGeometry(0.02, 1, 48, 1);
  private readonly capGeometries = new Map<number, SphereGeometry>();
  private lastMs = -1;
  private readonly forward = new Vector3();
  private readonly quat = new Quaternion();

  constructor(private readonly tuning: Pick<Tuning, 'vfx'>) {
    this.root.name = 'resonance-waves';
    for (let i = 0; i < SLOTS; i++) {
      const caps = Array.from({ length: RIPPLES }, () => {
        const cap = new Mesh(
          this.capGeometry(70),
          material(capFragment, capVertex),
        );
        return cap;
      });
      const ring = new Mesh(
        this.ringGeometry,
        material(ringFragment, ringVertex),
      );
      ring.rotation.x = -Math.PI / 2;
      for (const mesh of [...caps, ring]) {
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.userData.noOutline = true;
        mesh.userData.vfxPool = true;
        mesh.renderOrder = 19;
        this.root.add(mesh);
      }
      this.waves.push({
        caps,
        ring,
        age: 0,
        life: 0,
        range: 0,
        full: false,
        geometryAngle: 70,
      });
    }
  }

  private capGeometry(angleDeg: number): SphereGeometry {
    const key = Math.round(angleDeg);
    let g = this.capGeometries.get(key);
    if (!g) {
      const half = (Math.min(170, Math.max(10, key)) / 2) * (Math.PI / 180);
      g = new SphereGeometry(1, 40, 6, 0, Math.PI * 2, 0, half);
      this.capGeometries.set(key, g);
    }
    return g;
  }

  /** Wołane co klatkę z listą mocy i kamerą (bez kamery fale nie startują). */
  update(powers: readonly unknown[], camera: Camera | null): void {
    const now = performance.now();
    const dt = this.lastMs < 0 ? 0 : Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;
    for (const item of powers) {
      if (!isCone(item)) continue;
      const before = this.cooldowns.get(item) ?? 0;
      const after = item.cooldownRemaining;
      this.cooldowns.set(item, after);
      if (camera && after > before + 1e-4) this.spawn(item, camera);
    }
    for (const wave of this.waves) {
      if (wave.life <= 0) continue;
      wave.age += dt;
      this.animate(wave);
    }
  }

  private spawn(power: ConeLike, camera: Camera): void {
    const v = this.tuning.vfx;
    const wave =
      this.waves.find((w) => w.life <= 0) ??
      this.waves.reduce((a, b) => (a.age > b.age ? a : b));
    const angle = power.def.coneAngleDeg ?? 70;
    wave.full = angle >= 360;
    wave.range = power.def.range ?? 5;
    wave.age = 0;
    wave.life = wave.full ? v.resonanceRingS : v.resonanceWaveS;
    camera.getWorldDirection(this.forward);
    const origin = camera.getWorldPosition(new Vector3());
    if (wave.full) {
      for (const cap of wave.caps) cap.visible = false;
      wave.ring.position.set(
        origin.x,
        origin.y - v.resonanceRingDropM,
        origin.z,
      );
    } else {
      wave.ring.visible = false;
      if (wave.geometryAngle !== angle) {
        for (const cap of wave.caps) cap.geometry = this.capGeometry(angle);
        wave.geometryAngle = angle;
      }
      this.quat.setFromUnitVectors(Y, this.forward);
      for (const cap of wave.caps) {
        // Wierzchołek czaszy lekko za okiem: krawędź fali otacza celownik.
        cap.position.copy(origin).addScaledVector(this.forward, -0.15);
        cap.quaternion.copy(this.quat);
      }
    }
    this.animate(wave);
  }

  private animate(wave: Wave): void {
    const k = wave.age / Math.max(1e-3, wave.life);
    if (k >= 1) {
      wave.life = 0;
      for (const cap of wave.caps) cap.visible = false;
      wave.ring.visible = false;
      return;
    }
    if (wave.full) {
      const ease = 1 - (1 - k) ** 3;
      wave.ring.visible = true;
      wave.ring.scale.setScalar(Math.max(0.05, wave.range * ease));
      const u = wave.ring.material.uniforms;
      u.uOpacity!.value = (1 - k) ** 1.5 * 1.3;
      u.uTime!.value = wave.age;
      return;
    }
    for (let i = 0; i < wave.caps.length; i++) {
      const cap = wave.caps[i]!;
      // Echo: kolejne fale startują później i są słabsze.
      const local = (k - i * 0.14) / (1 - i * 0.14);
      cap.visible = local > 0 && local < 1;
      if (!cap.visible) continue;
      const ease = 1 - (1 - local) ** 2.5;
      // Czoło fali biegnie do przodu szybciej, niż rośnie w bok: z oka pierścień zaciska się
      // ku celownikowi (fala odlatuje), zamiast stać na brzegach ekranu.
      const forward = Math.max(0.05, 0.6 + wave.range * 0.85 * ease);
      const lateral = forward * (1 - 0.6 * ease);
      cap.scale.set(lateral, forward, lateral);
      const u = cap.material.uniforms;
      u.uOpacity!.value = (1 - local) ** 1.6 * (i === 0 ? 1 : 0.45);
      u.uTime!.value = wave.age;
    }
  }

  dispose(): void {
    for (const wave of this.waves) {
      for (const cap of wave.caps) cap.material.dispose();
      wave.ring.material.dispose();
    }
    for (const g of this.capGeometries.values()) g.dispose();
    this.capGeometries.clear();
    this.ringGeometry.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}

function isCone(item: unknown): item is ConeLike {
  if (typeof item !== 'object' || item === null) return false;
  const def = (item as { def?: unknown }).def;
  return (
    typeof def === 'object' &&
    def !== null &&
    (def as { kind?: unknown }).kind === 'cone' &&
    typeof (item as { cooldownRemaining?: unknown }).cooldownRemaining ===
      'number'
  );
}
