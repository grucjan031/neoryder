import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector2,
} from 'three';
import type { BarrierPower } from '../combat/powers/barrier';
import type { Tuning } from '../core/tuning';
import type { CameraPose } from '../player/fpsCamera';

const latticeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const latticeFragment = /* glsl */ `
  uniform vec3 uColor, uPale;
  uniform vec2 uSize;
  uniform float uTime, uFlash, uOpacity, uCells;
  varying vec2 vUv;
  vec2 hexCell(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec2 a = mod(p, s) - s * 0.5;
    vec2 b = mod(p - s * 0.5, s) - s * 0.5;
    return dot(a, a) < dot(b, b) ? a : b;
  }
  float hexDist(vec2 h) {
    h = abs(h);
    return max(dot(h, vec2(0.5, 0.8660254)), h.x);
  }
  void main() {
    vec2 metres = vUv * uSize;
    vec2 h = hexCell(metres * uCells);
    float d = hexDist(h);
    float aa = max(fwidth(d), 1e-4);
    float lines = smoothstep(0.43 - aa, 0.5, d);
    // Rama płata: jasne krawędzie łuku i góry/dołu.
    vec2 edge = min(vUv, 1.0 - vUv) * uSize;
    float frame = 1.0 - smoothstep(0.0, 0.05, min(edge.x, edge.y));
    // Skan w górę i fala odbicia z środka płata.
    float scan = smoothstep(0.92, 1.0, 1.0 - abs(fract(vUv.y - uTime * 0.6) - 0.5) * 2.0);
    float r = length((vUv - 0.5) * uSize);
    float ripple = uFlash * smoothstep(0.1, 0.0, abs(r - (1.0 - uFlash) * 0.9));
    float a = lines * (0.35 + scan * 0.5 + uFlash * 0.9) + frame * 0.9 + ripple * 1.2;
    vec3 color = mix(uColor, uPale, clamp(frame * 0.25 + ripple + uFlash * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(color * 1.2, clamp(a * uOpacity, 0.0, 1.0));
  }
`;

/** Płat przed kamerą: wyłącznie odczyt stanu symulacji. */
export class BarrierRenderer {
  readonly root = new Group();
  private readonly material = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  private readonly mesh = new Mesh(new CylinderGeometry(), this.material);
  /** Magentowa siatka heksów Rezonansu nad cyjanowym płatem gracza. */
  private readonly lattice = new ShaderMaterial({
    vertexShader: latticeVertex,
    fragmentShader: latticeFragment,
    uniforms: {
      uColor: { value: new Color() },
      uPale: { value: new Color('#ffd6f5') },
      uSize: { value: new Vector2(1, 1) },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uOpacity: { value: 1 },
      uCells: { value: 6 },
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  private readonly latticeMesh = new Mesh(this.mesh.geometry, this.lattice);
  private geometryKey = '';
  private time = 0;
  private lastMs = -1;

  constructor(private readonly tuning: Tuning) {
    this.lattice.userData.bloom = true;
    this.latticeMesh.userData.noOutline = true;
    this.latticeMesh.userData.vfxPool = true;
    this.latticeMesh.name = 'barrier-lattice';
    this.latticeMesh.renderOrder = 1;
    this.root.add(this.mesh, this.latticeMesh);
    this.root.visible = false;
  }

  render(power: BarrierPower, pose: CameraPose): void {
    this.root.visible = power.active;
    if (!power.active) {
      this.lastMs = -1;
      return;
    }
    const now = performance.now();
    if (this.lastMs >= 0)
      this.time += Math.min(0.1, (now - this.lastMs) / 1000);
    this.lastMs = now;
    const vfx = this.tuning.vfx;
    const arc = (power.def.arcDeg * Math.PI) / 180;
    const key = [
      vfx.barrierRadiusM,
      vfx.barrierHeightM,
      vfx.barrierSegments,
      arc,
    ].join();
    if (key !== this.geometryKey) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new CylinderGeometry(
        vfx.barrierRadiusM,
        vfx.barrierRadiusM,
        vfx.barrierHeightM,
        Math.max(3, Math.floor(vfx.barrierSegments)),
        1,
        true,
        Math.PI - arc / 2,
        arc,
      );
      this.latticeMesh.geometry = this.mesh.geometry;
      this.geometryKey = key;
    }
    this.root.position.copy(pose.position);
    this.root.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    this.mesh.position.z = -vfx.barrierDistanceM;
    this.material.color.set(this.tuning.render.player);
    const flash = Math.min(
      1,
      power.reflectionFlashS /
        Math.max(Number.EPSILON, this.tuning.powers.barrierFlashS),
    );
    this.material.opacity =
      vfx.barrierOpacity +
      flash * (vfx.barrierFlashOpacity - vfx.barrierOpacity);
    this.latticeMesh.position.z = this.mesh.position.z;
    const u = this.lattice.uniforms;
    (u.uColor!.value as Color).set(vfx.barrierLatticeColor);
    (u.uSize!.value as Vector2).set(
      vfx.barrierRadiusM * arc,
      vfx.barrierHeightM,
    );
    u.uTime!.value = this.time;
    u.uFlash!.value = flash;
    u.uOpacity!.value = vfx.barrierLatticeOpacity;
    u.uCells!.value = vfx.barrierLatticeCells;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.lattice.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
