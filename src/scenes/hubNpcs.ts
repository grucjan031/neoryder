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
  AnimationAction,
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
import { npcRootPosition, wrapAngle } from '../world/hubNpcs';
import type { NpcRuntime } from '../world/hubNpcs';
import type { HubNpcDef, NpcAccent, NpcAnimation } from '../world/hubSchema';

/** Akcenty z palety ADR 0006 (bez czerwieni, cyanu i magenty). */
const ACCENT_COLORS: Record<NpcAccent, string> = {
  amber: '#ffae1a',
  green: '#6dff4a',
  violet: '#8a5cff',
  blue: '#3d7bff',
  white: '#fff1d6',
};
/** Pierwsze pięć odcieni zachowuje wygląd kluczowych NPC; dalej oliwka, brąz i śliwka. */
const BODY_COLORS = [
  '#3b4254',
  '#2f3f66',
  '#424856',
  '#2c3f63',
  '#4a4e5a',
  '#4b5040',
  '#50463c',
  '#383c34',
  '#55585c',
  '#484052',
];
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
  state: NpcRuntime;
  actions: Map<string, AnimationAction>;
  action?: AnimationAction;
  animation?: NpcAnimation;
  animDt: number;
  animFrames: number;
  material: MeshToonMaterial;
  mixer?: AnimationMixer;
  neck?: Object3D;
  head?: Object3D;
  skins: SkinnedMesh[];
  /** Materiały akcesoriów (geometrie są współdzielone w HubNpcs). */
  owned: Material[];
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
  private readonly geometries = new Map<string, BufferGeometry>();
  private disposed = false;
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly rootPosition = { x: 0, y: 0, z: 0 };

  constructor(
    states: readonly NpcRuntime[],
    private readonly tuning: Tuning,
  ) {
    states.forEach((state, index) => {
      const def = state.def;
      const root = new Group();
      root.name = `npc:${def.id}`;
      const baseYaw = (def.rotationDeg * Math.PI) / 180;
      root.position.copy(npcRootPosition(def));
      root.rotation.y = baseYaw;
      root.scale.setScalar(def.scale ?? 1);
      this.root.add(root);
      this.views.push({
        def,
        root,
        state,
        actions: new Map(),
        animDt: 0,
        animFrames:
          index % Math.max(1, Math.round(tuning.hub.npcAnimFarFrames)),
        material: this.material(def.accent, def.look?.shade ?? index % 5),
        skins: [],
        owned: [],
      });
    });
  }

  private geometry(
    geometry: BoxGeometry | SphereGeometry | CylinderGeometry | TorusGeometry,
  ): BufferGeometry {
    const key = `${geometry.type}:${JSON.stringify(geometry.parameters)}`;
    const shared = this.geometries.get(key);
    if (shared) {
      geometry.dispose();
      return shared;
    }
    this.geometries.set(key, geometry);
    return geometry;
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
      const mixer = new AnimationMixer(instance);
      for (const clip of clips) {
        const action = mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity);
        action.time = hash(view.def.id) * clip.duration;
        action.setEffectiveTimeScale(0.92 + hash(`${view.def.id}!`) * 0.16);
        view.actions.set(clip.name, action);
      }
      view.animation = view.state.animation(false);
      view.action = view.actions.get(view.animation);
      view.action?.play();
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
      geometry: BoxGeometry | SphereGeometry | CylinderGeometry | TorusGeometry,
      material: Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
      rz = 0,
    ): void => {
      const mesh = new Mesh(this.geometry(geometry), material);
      mesh.name = `headwear:${view.def.look?.headwear ?? view.def.id}`;
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
    const headwear = view.def.look?.headwear ?? view.def.id;
    switch (headwear) {
      case 'mira':
        add(new BoxGeometry(0.215, 0.03, 0.2), cloth, 0, 0.158, 0.0);
        add(new BoxGeometry(0.11, 0.014, 0.004), accent, 0, 0.158, 0.102);
        break;
      case 'wolan':
      case 'goggles':
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
      case 'cap_stripe':
        cap(true);
        break;
      case 'bajt':
      case 'headphones':
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
      case 'cap':
        cap(false);
        if (headwear === 'tomasz')
          add(new BoxGeometry(0.17, 0.03, 0.02), accent, 0, 0.07, 0.108);
        break;
      case 'beanie':
        add(
          new SphereGeometry(0.116, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          cloth,
          0,
          0.12,
          -0.004,
        );
        add(
          new CylinderGeometry(0.117, 0.117, 0.035, 14),
          cloth,
          0,
          0.125,
          -0.004,
        );
        add(new BoxGeometry(0.045, 0.02, 0.006), accent, 0.04, 0.13, 0.108);
        break;
      case 'glasses':
        for (const side of [-1, 1]) {
          add(
            new TorusGeometry(0.033, 0.006, 6, 12),
            accent,
            side * 0.04,
            0.11,
            0.108,
          );
          add(
            new BoxGeometry(0.007, 0.007, 0.1),
            cloth,
            side * 0.078,
            0.11,
            0.06,
          );
        }
        add(new BoxGeometry(0.02, 0.008, 0.008), cloth, 0, 0.11, 0.108);
        break;
      case 'bandana':
        add(
          new CylinderGeometry(0.113, 0.113, 0.042, 14, 1, true),
          cloth,
          0,
          0.155,
          0,
        );
        add(new BoxGeometry(0.12, 0.018, 0.008), accent, 0, 0.155, 0.11);
        add(
          new BoxGeometry(0.045, 0.09, 0.025),
          cloth,
          0.075,
          0.11,
          -0.1,
          0,
          0.3,
        );
        break;
      case 'hood':
        add(
          new SphereGeometry(0.143, 14, 10, Math.PI, Math.PI),
          cloth,
          0,
          0.1,
          -0.015,
        );
        for (const side of [-1, 1])
          add(
            new BoxGeometry(0.035, 0.18, 0.11),
            cloth,
            side * 0.115,
            0.07,
            0.035,
          );
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
    const shade = view.material.color.clone();
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
      geometry: BoxGeometry,
      material: Material,
      position: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
      name = `prop:${view.def.look?.prop ?? view.def.id}`,
    ): void => {
      const bone = instance.getObjectByName(boneName);
      if (!bone) return;
      const mesh = new Mesh(this.geometry(geometry), material);
      mesh.name = name;
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
    const torso = view.def.look?.torso ?? 'vest';
    const garment = (
      bone: string,
      size: [number, number, number],
      material: Material,
      position: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
    ): void =>
      add(
        bone,
        new BoxGeometry(...size),
        material,
        position,
        rotation,
        `torso:${torso}`,
      );
    if (torso !== 'none') {
      garment(chest, [0.34, 0.3, 0.25], jacket, [0, 1.3, 0.01]);
      garment(chest, [0.26, 0.07, 0.22], cloth, [0, 1.47, -0.005]);
      garment(hips, [0.33, 0.055, 0.23], cloth, [0, 0.99, 0.01]);
      if (accent) {
        garment(hips, [0.05, 0.035, 0.01], accent, [0, 0.99, 0.13]);
        garment(chest, [0.012, 0.2, 0.01], accent, [0.09, 1.31, 0.14]);
      }
    }
    if (torso === 'apron') {
      garment(chest, [0.25, 0.28, 0.025], cloth, [0, 1.27, 0.15]);
      garment(hips, [0.34, 0.53, 0.025], cloth, [0, 0.72, 0.15]);
    }
    if (torso === 'jacket') {
      for (const side of [-1, 1]) {
        garment(chest, [0.13, 0.12, 0.22], jacket, [side * 0.2, 1.42, 0]);
        garment(
          chest,
          [0.06, 0.24, 0.025],
          cloth,
          [side * 0.055, 1.34, 0.15],
          [0, 0, side * 0.18],
        );
      }
    }
    if (torso === 'coat') {
      garment(
        hips,
        [0.36, 0.62, 0.03],
        jacket,
        [0, 0.66, -0.14],
        [-0.08, 0, 0],
      );
      for (const side of [-1, 1])
        garment(
          hips,
          [0.13, 0.55, 0.03],
          jacket,
          [side * 0.12, 0.7, 0.13],
          [0.06, 0, 0],
        );
    }
    const prop = view.def.look?.prop ?? view.def.id;
    switch (prop) {
      case 'mira':
      case 'pouches':
        for (const side of [-1, 1])
          add(hips, new BoxGeometry(0.07, 0.1, 0.06), cloth, [
            side * 0.13,
            0.94,
            0.08,
          ]);
        if (prop === 'mira')
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
      case 'backpack':
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
      case 'satchel':
        add(
          chest,
          new BoxGeometry(0.035, 0.43, 0.025),
          cloth,
          [0, 1.23, 0.155],
          [0, 0, -0.55],
        );
        add(hips, new BoxGeometry(0.16, 0.2, 0.12), cloth, [0.22, 0.87, 0]);
        if (accent)
          add(
            hips,
            new BoxGeometry(0.05, 0.025, 0.012),
            accent,
            [0.22, 0.88, 0.065],
          );
        break;
      case 'wrench':
        add(
          hips,
          new BoxGeometry(0.025, 0.18, 0.025),
          jacket,
          [0.19, 0.89, 0.03],
        );
        for (const side of [-1, 1])
          add(hips, new BoxGeometry(0.018, 0.045, 0.025), jacket, [
            0.19 + side * 0.025,
            0.99,
            0.03,
          ]);
        break;
      case 'toolbelt':
        add(hips, new BoxGeometry(0.37, 0.07, 0.25), cloth, [0, 0.98, 0]);
        for (const side of [-1, 1]) {
          add(hips, new BoxGeometry(0.09, 0.12, 0.07), cloth, [
            side * 0.14,
            0.9,
            0.11,
          ]);
          add(hips, new BoxGeometry(0.025, 0.19, 0.025), jacket, [
            side * 0.2,
            0.9,
            0.02,
          ]);
          if (accent)
            add(hips, new BoxGeometry(0.06, 0.025, 0.03), accent, [
              side * 0.2,
              1,
              0.02,
            ]);
        }
        break;
    }
  }

  /** Interpolacja stanu symulacji i kosmetyczne mixery. Bez alokacji w pętli widoków. */
  render(
    alpha: number,
    dt: number,
    camera: Vec3,
    speaker: string | null,
  ): void {
    const t = this.tuning.hub;
    for (const view of this.views) {
      const state = view.state;
      const yaw =
        state.previousBodyYaw +
        wrapAngle(state.look.bodyYaw - state.previousBodyYaw) * alpha;
      this.position.x =
        state.previousPosition.x +
        (state.position.x - state.previousPosition.x) * alpha;
      this.position.y =
        state.previousPosition.y +
        (state.position.y - state.previousPosition.y) * alpha;
      this.position.z =
        state.previousPosition.z +
        (state.position.z - state.previousPosition.z) * alpha;
      view.root.rotation.y = yaw;
      npcRootPosition(view.def, yaw, this.position, this.rootPosition);
      view.root.position.copy(this.rootPosition);
      const animation = state.animation(speaker === view.def.id);
      if (animation !== view.animation) {
        const action = view.actions.get(animation);
        if (action) {
          action.reset().setEffectiveWeight(1).play();
          view.action?.crossFadeTo(action, t.npcAnimFadeS, false);
          view.action = action;
          view.animation = animation;
        }
      }
      if (!view.mixer) continue;
      view.animDt += dt;
      view.animFrames++;
      const far =
        Math.hypot(
          camera.x - this.position.x,
          camera.y - this.position.y,
          camera.z - this.position.z,
        ) > t.npcAnimFarM;
      if (far && view.animFrames < Math.max(1, Math.round(t.npcAnimFarFrames)))
        continue;
      view.mixer.update(view.animDt);
      view.animDt = 0;
      view.animFrames = 0;
      const headYaw =
        state.previousHeadYaw +
        (state.look.headYaw - state.previousHeadYaw) * alpha;
      view.root.updateMatrixWorld(true);
      if (view.neck) yawBone(view.neck, headYaw * NECK_SHARE);
      if (view.head) yawBone(view.head, headYaw * (1 - NECK_SHARE));
      for (const skin of view.skins) skin.skeleton.update();
    }
  }

  bodyYaw(id: string): number | undefined {
    return this.views.find((view) => view.def.id === id)?.state.look.bodyYaw;
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
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
