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
import { getLiteFx } from '../render/fxMode';
import type { CombatFlash, DebrisSystem } from './debris';

const ENEMY_HOT = new Color('#ff3b2f');
const POWER_HOT = new Color('#ff2bd6');
const WHITE_HOT = new Color('#fff1d6');
/** Odłamki otoczenia (`DEBRIS_TINT` 2–5): barwa bryły i żar krawędzi. Bez czerwieni, cyanu i magenty. */
const ENV_BODY = [
  new Color('#2b303c'),
  new Color('#4a5260'),
  new Color('#5c4a38'),
  new Color('#8ab4f8'),
];
const ENV_HOT = [
  new Color('#ffd9a0'),
  new Color('#ffae1a'),
  new Color('#d98a1f'),
  new Color('#ffae1a'),
];
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
  uniform vec3 uEnv[4];
  uniform float uCool, uBright;
  varying vec3 vBary;
  varying vec2 vHeat;
  void main() {
    float e = min(min(vBary.x, vBary.y), vBary.z);
    float aa = max(fwidth(e), 1e-4);
    float edge = 1.0 - smoothstep(0.02, 0.07 + aa * 1.5, e);
    // Żar: biały w chwili cięcia, stygnie do barwy wroga (albo magenty Rezonansu) i tli się.
    float heat = exp(-vHeat.x / max(uCool, 1e-3));
    int envIndex = int(clamp(vHeat.y - 1.5, 0.0, 3.0) + 0.5);
    vec3 base = vHeat.y < 1.5 ? mix(uEnemy, uPower, vHeat.y) : uEnv[envIndex];
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
  /** Warstwa odłamków otoczenia (tint >= 2): własny materiał z kolorem instancji i własny żar. */
  private readonly envGeometry = new TetrahedronGeometry(1, 0);
  private readonly envRoot: InstancedMesh;
  private readonly envEdges: InstancedMesh;
  private readonly envHeat: InstancedBufferAttribute;
  private readonly envMaterial = new MeshBasicMaterial({ toneMapped: false });
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
        uEnv: { value: ENV_HOT.map((c) => c.clone()) },
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

    const envVertices = this.envGeometry.getAttribute('position').count;
    const envBary = new Float32Array(envVertices * 3);
    for (let i = 0; i < envVertices; i++) envBary[i * 3 + (i % 3)] = 1;
    this.envGeometry.setAttribute('aBary', new BufferAttribute(envBary, 3));
    this.envHeat = new InstancedBufferAttribute(
      new Float32Array(system.maxDebris * 2),
      2,
    );
    this.envHeat.setUsage(DynamicDrawUsage);
    this.envGeometry.setAttribute('aHeat', this.envHeat);
    this.envRoot = new InstancedMesh(
      this.envGeometry,
      this.envMaterial,
      system.maxDebris,
    );
    this.envRoot.name = 'debris-env';
    this.envRoot.count = 0;
    this.envRoot.frustumCulled = false;
    this.envRoot.instanceMatrix.setUsage(DynamicDrawUsage);
    this.envRoot.userData.noOutline = true;
    this.envRoot.userData.vfxPool = true;
    this.envRoot.setColorAt(0, ENV_BODY[0]!);
    this.envEdges = new InstancedMesh(
      this.envGeometry,
      this.edgeMaterial,
      system.maxDebris,
    );
    this.envEdges.name = 'debris-env-edges';
    this.envEdges.count = 0;
    this.envEdges.frustumCulled = false;
    this.envEdges.instanceMatrix = this.envRoot.instanceMatrix;
    this.envEdges.userData.noOutline = true;
    this.envEdges.userData.vfxPool = true;
    this.envEdges.renderOrder = 2;
    this.envRoot.add(this.envEdges);
    this.root.add(this.envRoot);

    this.flashRoot.name = 'combat-flashes';
    for (let i = 0; i < FLASH_VIEWS; i++) this.flashViews.push(this.makeView());
    this.root.add(this.flashRoot);
    // fx=lite: jedno miejsce decyzji — bez żaru, błysków i rozgrzewki shaderów.
    if (getLiteFx()) {
      this.warmFrames = 0;
      this.edges.visible = false;
      this.envRoot.visible = false;
      this.flashRoot.visible = false;
    }
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
    let envCount = 0;
    const heat = this.heat.array as Float32Array;
    const envHeat = this.envHeat.array as Float32Array;
    this.system.forEachActive((pos, quat, scale, _a, age = 0, tint = 0) => {
      this.transform.position.set(pos.x, pos.y, pos.z);
      this.transform.quaternion.set(quat.x, quat.y, quat.z, quat.w);
      this.transform.scale.set(scale.x, scale.y, scale.z);
      this.transform.updateMatrix();
      if (tint >= 1.5) {
        envHeat[envCount * 2] = age;
        envHeat[envCount * 2 + 1] = tint;
        const body =
          ENV_BODY[Math.min(3, Math.round(tint) - 2)] ?? ENV_BODY[0]!;
        this.envRoot.setColorAt(envCount, body);
        this.envRoot.setMatrixAt(envCount++, this.transform.matrix);
        return;
      }
      heat[count * 2] = age;
      heat[count * 2 + 1] = tint;
      this.root.setMatrixAt(count++, this.transform.matrix);
    }, alpha);
    this.root.count = count;
    this.edges.count = count;
    this.envRoot.count = envCount;
    this.envEdges.count = envCount;
    const warming = this.warmFrames > 0;
    if (warming) this.warmFrames--;
    if (warming && envCount === 0 && !getLiteFx()) {
      this.transform.scale.setScalar(0);
      this.transform.updateMatrix();
      this.envRoot.setMatrixAt(0, this.transform.matrix);
      this.envRoot.setColorAt(0, ENV_BODY[0]!);
      this.envRoot.count = this.envEdges.count = 1;
      envCount = 1;
    }
    if (envCount > 0 || warming) {
      this.envRoot.instanceMatrix.needsUpdate = true;
      if (this.envRoot.instanceColor)
        this.envRoot.instanceColor.needsUpdate = true;
      this.envHeat.needsUpdate = true;
    }
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
      (flash.kind === 'kill' ? 1.6 : v.hitFlashBrightness) *
      fade *
      fade *
      (flash.muted ? 0.35 : 1);

    if (flash.kind === 'hit') {
      view.core.visible = view.ring.visible = false;
      const point = flash.point;
      view.star.visible = point !== null && !flash.muted;
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
    view.core.visible = coreK < 1 && !flash.muted;
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
    view.ring.material.opacity = fade * fade * (flash.muted ? 0.3 : 0.9);
    view.ring.material.color.copy(hot);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.edges.removeFromParent();
    this.edges.dispose();
    this.envEdges.dispose();
    this.envRoot.dispose();
    this.root.dispose();
    this.geometry.dispose();
    this.envGeometry.dispose();
    this.envMaterial.dispose();
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
