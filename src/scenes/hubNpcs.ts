import {
  AnimationMixer,
  BoxGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
  Quaternion,
  SkinnedMesh,
  Sphere,
  Vector3,
} from 'three';
import type {
  AnimationClip,
  BufferGeometry,
  Material,
  Object3D,
  WebGLProgramParametersWithUniforms,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { gradientMap } from '../render/materials';
import { isSeated, npcRootPosition, updateNpcLook } from '../world/hubNpcs';
import type { NpcLookState } from '../world/hubNpcs';
import type { HubNpcDef, NpcAccent } from '../world/hubSchema';

/** Akcenty z palety ADR 0006 (bez czerwieni, cyanu i magenty). */
const ACCENT_COLORS: Record<NpcAccent, string> = {
  amber: '#ffae1a',
  green: '#6dff4a',
  violet: '#8a5cff',
  blue: '#3d7bff',
  white: '#fff1d6',
};
/** Stonowane materiały ubioru: grafit i granat (odcień zależy od kolejności NPC). */
const BODY_COLORS = ['#3b4254', '#2f3f66', '#424856', '#2c3f63', '#4a4e5a'];
const RIM_STRENGTH = 0.55;
const RIM_POWER = 2.6;
const BODY_MESH = 'armored_body';
const NECK_SHARE = 0.4;

const loader = new GLTFLoader();
let bodyTemplate: Promise<Object3D | null> | undefined;
let clipLibrary: Promise<AnimationClip[]> | undefined;
const loadBody = (): Promise<Object3D | null> =>
  (bodyTemplate ??= loader
    .loadAsync('/assets/models/enemy_trooper.glb')
    .then(({ scene }) => scene)
    .catch(() => null));
const loadClips = (): Promise<AnimationClip[]> =>
  (clipLibrary ??= loader
    .loadAsync('/assets/models/npc_anims.glb')
    .then(({ animations }) => animations)
    .catch(() => []));

/** Deterministyczna liczba z [0, 1) z identyfikatora (przesunięcie animacji; to nie losowość symulacji). */
const hash = (text: string): number => {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
};

interface NpcView {
  def: HubNpcDef;
  root: Group;
  baseYaw: number;
  look: NpcLookState;
  seated: boolean;
  material: MeshToonMaterial;
  mixer?: AnimationMixer;
  neck?: Object3D;
  head?: Object3D;
  skins: SkinnedMesh[];
  /** Geometrie i materiały akcesoriów (własność widoku). */
  owned: (BufferGeometry | Material)[];
}

const yawAxis = new Vector3(0, 1, 0);
const parentWorld = new Quaternion();
const delta = new Quaternion();

/** Obraca kość o `yaw` wokół osi Y świata (niezależnie od orientacji lokalnych osi kości). */
function yawBone(bone: Object3D, yaw: number): void {
  const parent = bone.parent;
  if (!parent || yaw === 0) return;
  parent.getWorldQuaternion(parentWorld);
  delta.setFromAxisAngle(yawAxis, yaw);
  // lokalnie: inv(parentWorld) * delta * parentWorld * rotacja
  bone.quaternion
    .premultiply(parentWorld)
    .premultiply(delta)
    .premultiply(parentWorld.invert())
    .normalize();
  bone.updateMatrixWorld(true);
}

/**
 * Postacie kryjówki: manekin UAL z modelu wrogów w stonowanym materiale (grafit/granat ze słabym akcentem
 * z palety neonów, bez czerwonej poświaty i bez wyposażenia bojowego), animacje bezczynne z `npc_anims.glb`.
 * Obrót głowy i tułowia w stronę gracza: `updateNpcLook`.
 */
export class HubNpcs {
  readonly root = new Group();
  private readonly views: NpcView[] = [];
  private disposed = false;

  constructor(
    defs: readonly HubNpcDef[],
    private readonly tuning: Tuning,
  ) {
    defs.forEach((def, index) => {
      const root = new Group();
      root.name = `npc:${def.id}`;
      const baseYaw = (def.rotationDeg * Math.PI) / 180;
      root.position.copy(npcRootPosition(def));
      root.rotation.y = baseYaw;
      this.root.add(root);
      this.views.push({
        def,
        root,
        baseYaw,
        look: { bodyYaw: baseYaw, headYaw: 0 },
        seated: isSeated(def),
        material: this.material(def.accent, index),
        skins: [],
        owned: [],
      });
    });
  }

  private material(accent: NpcAccent, index: number): MeshToonMaterial {
    const material = new MeshToonMaterial({
      color: new Color(BODY_COLORS[index % BODY_COLORS.length]!),
      gradientMap,
    });
    const rim = { value: new Color(ACCENT_COLORS[accent]) };
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.npcRimColor = rim;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 npcRimColor;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += npcRimColor * ${RIM_STRENGTH.toFixed(2)} * pow(max(0.0, 1.0 - abs(dot(normal, normalize(vViewPosition)))), ${RIM_POWER.toFixed(2)});`,
        );
    };
    material.customProgramCacheKey = () => `npcRim_${accent}`;
    return material;
  }

  /** Wczytuje model i klipy; bez modelu NPC zostają bez widoku (collider i dialog działają). */
  async load(): Promise<void> {
    const [template, clips] = await Promise.all([loadBody(), loadClips()]);
    if (this.disposed || !template) return;
    for (const view of this.views) {
      const instance = clone(template);
      instance.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        if (node.name !== BODY_MESH) {
          node.visible = false;
          return;
        }
        node.material = view.material;
        node.frustumCulled = false;
        if (node instanceof SkinnedMesh) {
          node.boundingSphere = new Sphere(new Vector3(0, 0.9, 0), 2);
          view.skins.push(node);
        }
      });
      view.root.add(instance);
      view.head = instance.getObjectByName('DEF-head');
      if (view.head) this.dress(view, view.head);
      this.dressBody(view, instance);
      view.neck = instance.getObjectByName('DEF-neck');
      const clip = clips.find(
        ({ name }) => name === (view.def.animation ?? 'Idle_Loop'),
      );
      if (!clip) continue;
      const mixer = new AnimationMixer(instance);
      const action = mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.time = hash(view.def.id) * clip.duration;
      action.setEffectiveTimeScale(0.92 + hash(`${view.def.id}!`) * 0.16);
      action.play();
      view.mixer = mixer;
    }
  }

  /**
   * Niebojowe akcesoria na głowie (czapka, gogle, okulary, słuchawki) w osi lokalnej kości:
   * +Y w górę, +Z do przodu; głowa ma środek w y ≈ 0,1 m i promień ≈ 0,1 m.
   */
  private dress(view: NpcView, head: Object3D): void {
    const accent = new MeshBasicMaterial({
      color: new Color(ACCENT_COLORS[view.def.accent]),
      toneMapped: false,
    });
    accent.userData.bloom = true;
    const cloth = new MeshToonMaterial({
      color: new Color('#262b36'),
      gradientMap,
    });
    view.owned.push(accent, cloth);
    const add = (
      geometry: BufferGeometry,
      material: Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0,
    ): void => {
      view.owned.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.userData.noOutline = true;
      head.add(mesh);
    };
    const cap = (stripe: boolean): void => {
      add(
        new SphereGeometry(0.112, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        cloth,
        0,
        0.115,
        -0.004,
      );
      add(new BoxGeometry(0.17, 0.012, 0.085), cloth, 0, 0.122, 0.105);
      if (stripe)
        add(new BoxGeometry(0.1, 0.012, 0.004), accent, 0, 0.133, 0.15);
    };
    switch (view.def.id) {
      case 'mira':
        add(new BoxGeometry(0.215, 0.03, 0.2), cloth, 0, 0.158, 0.0);
        add(new BoxGeometry(0.11, 0.014, 0.004), accent, 0, 0.158, 0.102);
        break;
      case 'wolan':
        for (const side of [-1, 1])
          add(
            new BoxGeometry(0.072, 0.045, 0.008),
            accent,
            side * 0.042,
            0.106,
            0.106,
          );
        add(new BoxGeometry(0.02, 0.008, 0.008), accent, 0, 0.114, 0.106);
        break;
      case 'szron':
        cap(true);
        break;
      case 'bajt':
        add(
          new TorusGeometry(0.112, 0.01, 6, 18, Math.PI),
          cloth,
          0,
          0.1,
          0,
          0,
          0,
        );
        for (const side of [-1, 1])
          add(
            new CylinderGeometry(0.036, 0.036, 0.03, 12),
            accent,
            side * 0.112,
            0.1,
            0,
            0,
            Math.PI / 2,
          );
        break;
      case 'tomasz':
        cap(false);
        add(new BoxGeometry(0.17, 0.03, 0.02), accent, 0, 0.07, 0.108);
        break;
    }
  }

  /**
   * Ubiór na tułowiu (kamizelka, kołnierz, pas) i rekwizyt roli; części wiszą na kościach
   * `DEF-spine003` / `DEF-hips`, a pozycje podaje się w metrach modelu w pozie spoczynkowej
   * (+Y w górę, +Z przód). Akcenty w kolorze NPC, bez czerwieni wrogów.
   */
  private dressBody(view: NpcView, instance: Object3D): void {
    instance.updateWorldMatrix(true, true);
    const toInstance = new Matrix4().copy(instance.matrixWorld).invert();
    const accent = view.owned.find(
      (resource): resource is MeshBasicMaterial =>
        resource instanceof MeshBasicMaterial,
    );
    const shade = new Color(
      BODY_COLORS[this.views.indexOf(view) % BODY_COLORS.length]!,
    );
    const jacket = new MeshToonMaterial({
      color: shade.multiplyScalar(1.35),
      gradientMap,
    });
    const cloth = new MeshToonMaterial({
      color: new Color('#262b36'),
      gradientMap,
    });
    view.owned.push(jacket, cloth);
    const add = (
      boneName: string,
      geometry: BufferGeometry,
      material: Material,
      position: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
    ): void => {
      const bone = instance.getObjectByName(boneName);
      if (!bone) return;
      view.owned.push(geometry);
      const mesh = new Mesh(geometry, material);
      new Matrix4()
        .copy(toInstance)
        .multiply(bone.matrixWorld)
        .invert()
        .multiply(
          new Matrix4()
            .makeRotationFromEuler(new Euler(...rotation))
            .setPosition(...position),
        )
        .decompose(mesh.position, mesh.quaternion, mesh.scale);
      if (material === accent) mesh.userData.noOutline = true;
      bone.add(mesh);
    };
    const chest = 'DEF-spine003';
    const hips = 'DEF-hips';
    add(chest, new BoxGeometry(0.34, 0.3, 0.25), jacket, [0, 1.3, 0.01]);
    add(chest, new BoxGeometry(0.26, 0.07, 0.22), cloth, [0, 1.47, -0.005]);
    add(hips, new BoxGeometry(0.33, 0.055, 0.23), cloth, [0, 0.99, 0.01]);
    if (accent) {
      add(hips, new BoxGeometry(0.05, 0.035, 0.01), accent, [0, 0.99, 0.13]);
      add(chest, new BoxGeometry(0.012, 0.2, 0.01), accent, [0.09, 1.31, 0.14]);
    }
    switch (view.def.id) {
      case 'mira':
        for (const side of [-1, 1])
          add(hips, new BoxGeometry(0.07, 0.1, 0.06), cloth, [
            side * 0.13,
            0.94,
            0.08,
          ]);
        add(
          hips,
          new BoxGeometry(0.03, 0.16, 0.03),
          jacket,
          [0.17, 0.9, 0.0],
          [0, 0, 0.2],
        );
        break;
      case 'wolan':
        add(
          hips,
          new BoxGeometry(0.36, 0.62, 0.03),
          jacket,
          [0, 0.66, -0.14],
          [-0.08, 0, 0],
        );
        for (const side of [-1, 1])
          add(
            hips,
            new BoxGeometry(0.13, 0.55, 0.03),
            jacket,
            [side * 0.12, 0.7, 0.13],
            [0.06, 0, 0],
          );
        break;
      case 'szron':
        for (const side of [-1, 1])
          add(chest, new BoxGeometry(0.13, 0.04, 0.16), jacket, [
            side * 0.2,
            1.47,
            0,
          ]);
        if (accent)
          add(
            chest,
            new BoxGeometry(0.06, 0.012, 0.01),
            accent,
            [-0.08, 1.38, 0.14],
          );
        break;
      case 'bajt':
        add(chest, new BoxGeometry(0.28, 0.32, 0.12), cloth, [0, 1.28, -0.18]);
        if (accent)
          add(
            chest,
            new BoxGeometry(0.16, 0.08, 0.01),
            accent,
            [0, 1.33, -0.245],
          );
        break;
      case 'tomasz':
        for (const x of [-0.1, 0, 0.1])
          add(chest, new BoxGeometry(0.07, 0.09, 0.05), cloth, [x, 1.22, 0.15]);
        add(chest, new BoxGeometry(0.3, 0.3, 0.06), jacket, [0, 1.3, -0.15]);
        break;
    }
  }

  /** Obrót do gracza i animacja; wołane z renderu. */
  update(dt: number, player: Vec3): void {
    const t = this.tuning.hub;
    for (const view of this.views) {
      view.look = updateNpcLook(
        view.look,
        view.baseYaw,
        { ...view.def.position, y: view.def.position.y ?? 0 },
        player,
        dt,
        {
          rangeM: t.npcTurnRangeM,
          turnSpeedRadS: t.npcTurnSpeedRadS,
          headMaxRad: t.npcHeadMaxRad,
          bodyMaxRad: view.seated
            ? t.npcSeatedBodyMaxRad
            : t.npcStandBodyMaxRad,
        },
      );
      view.root.rotation.y = view.look.bodyYaw;
      view.root.position.copy(npcRootPosition(view.def, view.look.bodyYaw));
      if (!view.mixer) continue;
      view.mixer.update(dt);
      view.root.updateMatrixWorld(true);
      if (view.neck) yawBone(view.neck, view.look.headYaw * NECK_SHARE);
      if (view.head) yawBone(view.head, view.look.headYaw * (1 - NECK_SHARE));
      for (const skin of view.skins) skin.skeleton.update();
    }
  }

  /** Aktualny kierunek patrzenia tułowia NPC (testy, debug). */
  bodyYaw(id: string): number | undefined {
    return this.views.find((view) => view.def.id === id)?.look.bodyYaw;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const view of this.views) {
      view.mixer?.stopAllAction();
      view.mixer?.uncacheRoot(view.mixer.getRoot());
      for (const skin of view.skins) skin.skeleton.dispose();
      view.material.dispose();
      for (const resource of view.owned) resource.dispose();
    }
    this.views.length = 0;
    this.root.removeFromParent();
    this.root.clear();
  }
}
