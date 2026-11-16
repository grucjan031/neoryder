import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import type { GrabBeam } from '../combat/powers/grab';
import type { Tuning } from '../core/tuning';
import { frameStep } from './frameClock';
import { getLiteFx } from './fxMode';

const UP = new Vector3(0, 1, 0);

const flowVertex = /* glsl */ `
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

const flowFragment = /* glsl */ `
  uniform vec3 uColor, uCore;
  uniform float uTime, uLength, uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Środek rurki (patrząc wprost) jasny, brzegi miękko gasną; pasy płyną od celu do dłoni.
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float body = pow(facing, 1.8);
    float bands = 0.55 + 0.45 * sin((vUv.y * uLength * 3.2 + uTime * 9.0));
    float coil = pow(abs(sin(vUv.x * 6.2832 + vUv.y * uLength * 4.0 - uTime * 6.0)), 10.0);
    vec3 color = mix(uColor, uCore, body * body * 0.6 + coil * 0.4);
    float a = body * (0.45 + 0.55 * bands) + coil * 0.6;
    gl_FragColor = vec4(color * 1.2, clamp(a * uOpacity, 0.0, 1.0));
  }
`;

/** Render czyta snapshot wiązki; położenie dłoni jest wyłącznie kosmetyczne. */
export class GrabRenderer {
  readonly root = new Group();
  private readonly positions = new Float32Array(6);
  private readonly geometry = new BufferGeometry();
  private readonly material = new LineBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  private readonly line = new Line(this.geometry, this.material);
  private readonly hand = new Vector3();
  private readonly target = new Vector3();
  private readonly dir = new Vector3();
  /** Magentowa poświata Rezonansu wokół wiązki (cyan rdzeń = ręka gracza). */
  private readonly tubeGeometry = new CylinderGeometry(1, 1, 1, 12, 1, true);
  private readonly flow = new ShaderMaterial({
    vertexShader: flowVertex,
    fragmentShader: flowFragment,
    uniforms: {
      uColor: { value: new Color() },
      uCore: { value: new Color('#ffd6f5') },
      uTime: { value: 0 },
      uLength: { value: 1 },
      uOpacity: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly tube = new Mesh(this.tubeGeometry, this.flow);
  private readonly orbGeometry = new IcosahedronGeometry(1, 2);
  private readonly orbMaterial = new MeshBasicMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly orb = new Mesh(this.orbGeometry, this.orbMaterial);
  private time = 0;

  constructor(private readonly tuning: Tuning) {
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.positions, 3),
    );
    this.line.frustumCulled = false;
    this.line.name = 'grab-beam';
    this.line.visible = false;
    this.root.add(this.line);
    this.flow.userData.bloom = true;
    this.orbMaterial.userData.bloom = true;
    for (const mesh of [this.tube, this.orb]) {
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.userData.noOutline = true;
      mesh.userData.vfxPool = true;
      mesh.renderOrder = 18;
      this.line.add(mesh);
    }
  }

  /** Zegar animacji: czas klatki (s), nie zegar ścienny. */
  advance(frameDt: number): void {
    this.time += frameStep(frameDt);
  }

  render(
    beam: Readonly<GrabBeam> | null,
    alpha: number,
    camera?: Camera,
  ): void {
    this.line.visible = beam !== null;
    if (!beam) return;
    const t = this.tuning.vfx;
    const { previous, current } = beam;
    this.hand.set(
      previous.from.x + (current.from.x - previous.from.x) * alpha,
      previous.from.y + (current.from.y - previous.from.y) * alpha,
      previous.from.z + (current.from.z - previous.from.z) * alpha,
    );
    if (camera) {
      this.hand
        .set(t.grabHandSideM, -t.grabHandDownM, -t.grabHandForwardM)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
    }
    this.target.set(
      previous.to.x + (current.to.x - previous.to.x) * alpha,
      previous.to.y + (current.to.y - previous.to.y) * alpha,
      previous.to.z + (current.to.z - previous.to.z) * alpha,
    );
    this.positions.set([
      this.hand.x,
      this.hand.y,
      this.hand.z,
      this.target.x,
      this.target.y,
      this.target.z,
    ]);
    this.geometry.getAttribute('position').needsUpdate = true;
    this.material.color.set(t.grabBeamColor);
    this.material.opacity = t.grabBeamOpacity;
    this.renderGlow(t);
  }

  private renderGlow(t: Tuning['vfx']): void {
    if (getLiteFx()) {
      this.tube.visible = this.orb.visible = false;
      return;
    }
    this.dir.subVectors(this.target, this.hand);
    const length = this.dir.length();
    this.tube.visible = this.orb.visible = length > 1e-3;
    if (!this.tube.visible) return;
    this.dir.divideScalar(length);
    // Pozycje wiązki są w świecie; linia ma tożsamościową transformację, więc dzieci też.
    this.tube.position.addVectors(this.hand, this.target).multiplyScalar(0.5);
    this.tube.quaternion.setFromUnitVectors(UP, this.dir);
    const pulse = 1 + 0.12 * Math.sin(this.time * 18);
    this.tube.scale.set(
      t.grabGlowRadiusM * pulse,
      length,
      t.grabGlowRadiusM * pulse,
    );
    const u = this.flow.uniforms;
    (u.uColor!.value as Color).set(t.grabGlowColor);
    u.uTime!.value = this.time;
    u.uLength!.value = length;
    u.uOpacity!.value = t.grabGlowOpacity;
    this.orb.position.copy(this.target);
    this.orb.scale.setScalar(
      t.grabOrbM * (1 + 0.18 * Math.sin(this.time * 11)),
    );
    this.orbMaterial.color.set(t.grabGlowColor).multiplyScalar(0.55);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.tubeGeometry.dispose();
    this.flow.dispose();
    this.orbGeometry.dispose();
    this.orbMaterial.dispose();
    this.line.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
