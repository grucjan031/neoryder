import {
  AdditiveBlending,
  BufferAttribute,
  CapsuleGeometry,
  Color,
  DataTexture,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Object3D,
  RGBAFormat,
  RingGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TetrahedronGeometry,
} from 'three';
import type { Camera } from 'three';
import { tuning as defaultTuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { getMaterial } from '../render/materials';
import type { CombatFlash, DebrisSystem } from './debris';

const ENEMY_HOT = new Color('#ff3b2f');
const POWER_HOT = new Color('#ff2bd6');
const WHITE_HOT = new Color('#fff1d6');
/** Pula błysków (sylwetka, rdzeń, pierścień, iskra) — zgodna z pulą zdarzeń w DebrisSystem. */
const FLASH_VIEWS = 24;

const edgeVertex = /* glsl */ `
  attribute vec3 aBary;
  attribute vec2 aHeat;
  varying vec3 vBary;
  varying vec2 vHeat;
  void main() {
    vBary = aBary;
    vHeat = aHeat;
    // Lekko powiększona skorupa leży nad bryłą: krawędzie nie migoczą z powierzchnią.
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position * 1.04, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const edgeFragment = /* glsl */ `
  uniform vec3 uEnemy, uPower, uWhite;
  uniform float uCool, uBright;
  varying vec3 vBary;
  varying vec2 vHeat;
  void main() {
    float e = min(min(vBary.x, vBary.y), vBary.z);
    float aa = max(fwidth(e), 1e-4);
    float edge = 1.0 - smoothstep(0.02, 0.07 + aa * 1.5, e);
    // Żar: biały w chwili cięcia, stygnie do barwy wroga (albo magenty Rezonansu) i tli się.
    float heat = exp(-vHeat.x / max(uCool, 1e-3));
    vec3 base = mix(uEnemy, uPower, vHeat.y);
    vec3 color = mix(base, uWhite, heat * heat * 0.85);
    float glow = edge * (0.35 + heat * 1.4) + (1.0 - edge) * heat * 0.45;
    gl_FragColor = vec4(color * uBright, clamp(glow, 0.0, 1.0));
  }
`;

const rimVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const rimFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    // Tylko obrys sylwetki: środek bryły zostaje czytelny.
    float rim = pow(1.0 - facing, 2.2);
    gl_FragColor = vec4(uColor * 1.3, clamp(rim * uOpacity, 0.0, 1.0));
  }
`;

/** Gwiazdka iskry trafienia: jasny środek i cztery promienie (bez DOM, działa w testach). */
function starTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const r = Math.hypot(dx, dy);
      const core = Math.max(0, 1 - r * 2.2) ** 1.5;
      const rays =
        Math.max(0, 1 - Math.abs(dx) * 14) * Math.max(0, 1 - Math.abs(dy)) +
        Math.max(0, 1 - Math.abs(dy) * 14) * Math.max(0, 1 - Math.abs(dx));
      const halo = Math.max(0, 1 - r) ** 3 * 0.35;
      const v = Math.min(1, core + rays * 0.8 + halo);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(v * 255);
    }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

interface FlashView {
  rim: Mesh<CapsuleGeometry, ShaderMaterial>;
  core: Mesh<IcosahedronGeometry, MeshBasicMaterial>;
  ring: Mesh<RingGeometry, MeshBasicMaterial>;
  star: Sprite;
}

export class DebrisRenderer {
  readonly root: InstancedMesh;
  private readonly geometry = new TetrahedronGeometry(1, 0);
  private readonly transform = new Object3D();
  /** Żarzące się krawędzie cięcia nad odłamkami (addytywna skorupa instancji). */
  private readonly edges: InstancedMesh;
  private readonly edgeMaterial: ShaderMaterial;
  private readonly heat: InstancedBufferAttribute;
  private readonly flashRoot = new Group();
  private readonly flashViews: FlashView[] = [];
  private readonly rimGeometry = new CapsuleGeometry(1, 1, 4, 14);
  private readonly coreGeometry = new IcosahedronGeometry(1, 1);
  private readonly ringGeometry = new RingGeometry(0.82, 1, 40);
  private readonly starMap = starTexture();
  private camera: Camera | null = null;
  /**
   * Rozgrzewka programów: w pierwszych klatkach rysujemy niewidoczne (krycie 0) błyski
   * i jedną zerową instancję żaru, żeby kompilacja shaderów nie przypadła na pierwsze zabicie.
   */
  private warmFrames = 2;

  constructor(
    private readonly system: DebrisSystem,
    private readonly tuning: Pick<Tuning, 'vfx'> = defaultTuning,
  ) {
    this.root = new InstancedMesh(
      this.geometry,
      getMaterial('enemy'),
      system.maxDebris,
    );
    this.root.count = 0;
    this.root.frustumCulled = false;
    this.root.instanceMatrix.setUsage(DynamicDrawUsage);

    const vertices = this.geometry.getAttribute('position').count;
    const bary = new Float32Array(vertices * 3);
    for (let i = 0; i < vertices; i++) bary[i * 3 + (i % 3)] = 1;
    this.geometry.setAttribute('aBary', new BufferAttribute(bary, 3));
    this.heat = new InstancedBufferAttribute(
      new Float32Array(system.maxDebris * 2),
      2,
    );
    this.heat.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('aHeat', this.heat);
    this.edgeMaterial = new ShaderMaterial({
      vertexShader: edgeVertex,
      fragmentShader: edgeFragment,
      uniforms: {
        uEnemy: { value: ENEMY_HOT.clone() },
        uPower: { value: POWER_HOT.clone() },
        uWhite: { value: WHITE_HOT.clone() },
        uCool: { value: this.tuning.vfx.debrisEdgeCoolS },
        uBright: { value: this.tuning.vfx.debrisEdgeBrightness },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.edgeMaterial.userData.bloom = true;
    this.edges = new InstancedMesh(
      this.geometry,
      this.edgeMaterial,
      system.maxDebris,
    );
    this.edges.name = 'debris-edges';
    this.edges.count = 0;
    this.edges.frustumCulled = false;
    this.edges.instanceMatrix = this.root.instanceMatrix;
    this.edges.userData.noOutline = true;
    this.edges.userData.vfxPool = true;
    this.edges.renderOrder = 2;
    this.root.add(this.edges);

    this.flashRoot.name = 'combat-flashes';
    for (let i = 0; i < FLASH_VIEWS; i++) this.flashViews.push(this.makeView());
    this.root.add(this.flashRoot);
  }

  private makeView(): FlashView {
    const additive = (color: Color): MeshBasicMaterial => {
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
      material.userData.bloom = true;
      return material;
    };
    const rimMaterial = new ShaderMaterial({
      vertexShader: rimVertex,
      fragmentShader: rimFragment,
      uniforms: {
        uColor: { value: new Color() },
        uOpacity: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    rimMaterial.userData.bloom = true;
    const rim = new Mesh(this.rimGeometry, rimMaterial);
    const core = new Mesh(this.coreGeometry, additive(WHITE_HOT.clone()));
    const ring = new Mesh(this.ringGeometry, additive(ENEMY_HOT.clone()));
    // Pierścień zwykłym mieszaniem: czytelny także na jasnym motywie `white`.
    ring.material.blending = NormalBlending;
    const starMaterial = new SpriteMaterial({
      map: this.starMap,
      color: WHITE_HOT.clone(),
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    starMaterial.userData.bloom = true;
    const star = new Sprite(starMaterial);
    for (const object of [rim, core, ring, star]) {
      object.visible = false;
      object.frustumCulled = false;
      object.userData.noOutline = true;
      object.userData.vfxPool = true;
      object.renderOrder = 3;
      this.flashRoot.add(object);
    }
    // Pierścień rozpadu zwrócony do kamery (płaszczyzna ekranu), gdy kamera jest znana.
    ring.onBeforeRender = (_r, _s, camera) => {
      ring.quaternion.copy(camera.quaternion);
      ring.updateMatrixWorld();
      this.camera = camera;
    };
    return { rim, core, ring, star };
  }

  render(alpha = 1): void {
    let count = 0;
    const heat = this.heat.array as Float32Array;
    this.system.forEachActive((pos, quat, scale, _a, age = 0, tint = 0) => {
      this.transform.position.set(pos.x, pos.y, pos.z);
      this.transform.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      this.transform.scale.set(scale.x, scale.y, scale.z);
      this.transform.updateMatrix();
      heat[count * 2] = age;
      heat[count * 2 + 1] = tint;
      this.root.setMatrixAt(count++, this.transform.matrix);
    }, alpha);
    this.root.count = count;
    this.edges.count = count;
    const warming = this.warmFrames > 0;
    if (warming) this.warmFrames--;
    if (warming && count === 0) {
      this.transform.scale.setScalar(0);
      this.transform.updateMatrix();
      this.root.setMatrixAt(0, this.transform.matrix);
      this.edges.count = 1;
    }
    this.root.instanceMatrix.needsUpdate = true;
    this.heat.needsUpdate = true;
    const v = this.tuning.vfx;
    this.edgeMaterial.uniforms.uCool!.value = v.debrisEdgeCoolS;
    this.edgeMaterial.uniforms.uBright!.value = v.debrisEdgeBrightness;
    this.renderFlashes(alpha);
  }

  private renderFlashes(alpha: number): void {
    let n = 0;
    this.system.forEachFlash((flash, age) => {
      const view = this.flashViews[n++];
      if (view) this.drawFlash(view, flash, age);
    }, alpha);
    for (let i = n; i < this.flashViews.length; i++) {
      const view = this.flashViews[i]!;
      view.rim.visible = view.core.visible = false;
      view.ring.visible = view.star.visible = false;
    }
    const spare = this.flashViews[this.flashViews.length - 1];
    if (this.warmFrames > 0 && spare && n < this.flashViews.length) {
      spare.rim.visible = spare.core.visible = true;
      spare.ring.visible = spare.star.visible = true;
      spare.rim.material.uniforms.uOpacity!.value = 0;
      spare.core.material.opacity = 0;
      spare.ring.material.opacity = 0;
      spare.star.material.opacity = 0;
    }
  }

  private drawFlash(
    view: FlashView,
    flash: Readonly<CombatFlash>,
    age: number,
  ): void {
    const v = this.tuning.vfx;
    const k = Math.min(1, age / Math.max(1e-3, flash.life));
    const fade = 1 - k;
    const { origin } = flash;
    const hot = flash.tint > 0.5 ? POWER_HOT : ENEMY_HOT;
    // Sylwetka: obrys bryły rozjaśniony na biało, gaśnie do barwy wroga.
    const rimMaterial = view.rim.material;
    const capLength = Math.max(0, flash.height - flash.radius * 2);
    const swell = flash.kind === 'kill' ? 1 + k * 0.35 : 1 + k * 0.08;
    view.rim.visible = true;
    view.rim.position.set(origin.x, origin.y, origin.z);
    // CapsuleGeometry(1, 1): wysokość całkowita 3 przy promieniu 1.
    view.rim.scale.set(
      flash.radius * swell,
      ((capLength + flash.radius * 2) / 3) * swell,
      flash.radius * swell,
    );
    (rimMaterial.uniforms.uColor!.value as Color)
      .copy(hot)
      .lerp(WHITE_HOT, fade * 0.8);
    rimMaterial.uniforms.uOpacity!.value =
      (flash.kind === 'kill' ? 1.6 : v.hitFlashBrightness) * fade * fade;

    if (flash.kind === 'hit') {
      view.core.visible = view.ring.visible = false;
      const point = flash.point;
      view.star.visible = point !== null;
      if (point) {
        view.star.position.set(point.x, point.y, point.z);
        const size = v.hitFlashStarSizeM * (0.6 + 0.6 * Math.sqrt(k));
        view.star.scale.set(size, size, 1);
        view.star.material.rotation =
          (origin.x * 7.3 + origin.z * 3.1) % Math.PI;
        view.star.material.opacity = fade;
        view.star.material.color.copy(WHITE_HOT).lerp(hot, k);
      }
      return;
    }
    // Zabicie: krótki biały rdzeń i pierścień fali w barwie rozpadu.
    view.star.visible = false;
    const coreK = Math.min(1, k * 2.4);
    view.core.visible = coreK < 1;
    view.core.position.set(origin.x, origin.y, origin.z);
    view.core.scale.setScalar(
      v.killFlashCoreM * (0.45 + 0.55 * Math.sqrt(coreK)),
    );
    view.core.material.opacity = (1 - coreK) ** 1.5;
    view.core.material.color.copy(WHITE_HOT).lerp(hot, coreK);
    view.ring.visible = true;
    view.ring.position.set(origin.x, origin.y, origin.z);
    if (this.camera) view.ring.quaternion.copy(this.camera.quaternion);
    view.ring.scale.setScalar(v.killFlashRingM * (0.25 + 0.75 * Math.sqrt(k)));
    view.ring.material.opacity = fade * fade * 0.9;
    view.ring.material.color.copy(hot);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.edges.removeFromParent();
    this.edges.dispose();
    this.root.dispose();
    this.geometry.dispose();
    this.edgeMaterial.dispose();
    for (const view of this.flashViews) {
      view.rim.material.dispose();
      view.core.material.dispose();
      view.ring.material.dispose();
      view.star.material.dispose();
    }
    this.flashRoot.clear();
    this.rimGeometry.dispose();
    this.coreGeometry.dispose();
    this.ringGeometry.dispose();
    this.starMap.dispose();
  }
}
