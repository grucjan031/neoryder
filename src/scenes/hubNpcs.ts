import {
  AnimationMixer,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Frustum,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
  Quaternion,
  SkinnedMesh,
  Sphere,
  Vector3,
} from 'three';
import type {
  AnimationClip,
  Camera,
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
import { isSeated, npcRootPosition, wrapAngle } from '../world/hubNpcs';
import type { NpcRuntime } from '../world/hubNpcs';
import type { HubNpcDef, NpcAccent, NpcAnimation } from '../world/hubSchema';
import { hubInteractions } from '../world/hubInteractions';
import type { ShotSphere } from './hubCutaway';

const { soup } = hubInteractions;

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
const NECK_SHARE = 0.4;
type NpcTorso = NonNullable<NonNullable<HubNpcDef['look']>['torso']>;
/** Siatki `npc_civilian.glb` widoczne dla każdego wariantu górnej części stroju. */
const TORSO_PARTS: Record<NpcTorso, readonly string[]> = {
  none: ['top_shirt'],
  vest: ['top_shirt', 'over_vest'],
  apron: ['top_shirt', 'over_apron'],
  jacket: ['top_jacket'],
  hoodie: ['top_hoodie'],
  coat: ['top_coat'],
};
/** Pięć kluczowych postaci bez `look`: strój i rekwizyty ról. */
const KEY_OUTFITS: Record<
  string,
  { torso: NpcTorso; parts: readonly string[] }
> = {
  mira: { torso: 'vest', parts: ['prop_pouches', 'prop_wrench'] },
  wolan: { torso: 'coat', parts: [] },
  szron: { torso: 'jacket', parts: ['role_szron'] },
  bajt: { torso: 'vest', parts: ['prop_backpack'] },
  tomasz: { torso: 'vest', parts: ['prop_pouches'] },
};
const ALWAYS_PARTS = ['civ_skin', 'civ_pants', 'civ_boots'];

/** Nazwy części `npc_civilian.glb` w stroju NPC (część obejmuje też węzły `<nazwa>_*`). */
export function npcOutfit(def: HubNpcDef): string[] {
  const key = KEY_OUTFITS[def.id];
  const torso = def.look?.torso ?? key?.torso ?? 'vest';
  const prop = def.look?.prop;
  const props =
    prop === undefined
      ? (key?.parts ?? [])
      : prop === 'none'
        ? []
        : [`prop_${prop}`];
  const head = def.look?.headwear === 'hood' ? ['head_hood'] : [];
  return [...ALWAYS_PARTS, ...TORSO_PARTS[torso], ...props, ...head];
}

/** Czy węzeł modelu należy do którejś z części stroju. */
export const inOutfit = (name: string, parts: readonly string[]): boolean =>
  parts.some((part) => name === part || name.startsWith(`${part}_`));
/** Ciepła biel z palety ADR 0006 (obiekty interaktywne). */
const MARKER_COLOR = '#fff1d6';
const LOW_POSES: readonly NpcAnimation[] = [
  'Crouch_Idle_Loop',
  'Fixing_Kneeling',
];

const loader = new GLTFLoader();
let bodyTemplate: Promise<Object3D | null> | undefined;
let clipLibrary: Promise<AnimationClip[]> | undefined;
export const loadBody = (): Promise<Object3D | null> =>
  (bodyTemplate ??= loader
    .loadAsync('/assets/models/npc_civilian.glb')
    .then(({ scene }) => scene)
    .catch(() => null));
export const loadClips = (): Promise<AnimationClip[]> =>
  (clipLibrary ??= loader
    .loadAsync('/assets/models/npc_anims.glb')
    .then(({ animations }) => animations)
    .catch(() => []));

/** Deterministyczna liczba z [0, 1) z identyfikatora (przesunięcie animacji; to nie losowość symulacji). */
/** Czy mixer NPC ma się teraz zaktualizować (dt sumuje się między aktualizacjami). */
export function npcAnimDue(
  near: boolean,
  visible: boolean,
  frames: number,
  farFrames: number,
  hiddenFrames: number,
): boolean {
  if (visible && near) return true;
  const every = visible || near ? farFrames : hiddenFrames;
  return frames >= Math.max(1, Math.round(every));
}

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
  visible: boolean;
  /** Wierzchnia warstwa stroju w odcieniu NPC z poświatą krawędzi w akcencie. */
  material: MeshToonMaterial;
  accent: MeshBasicMaterial;
  mixer?: AnimationMixer;
  neck?: Object3D;
  head?: Object3D;
  chest?: Object3D;
  skins: SkinnedMesh[];
  marker: Mesh;
  /** Materiały na wyłączność NPC (geometrie i materiały wspólne są w HubNpcs). */
  owned: Material[];
}

const frustum = new Frustum();
const frustumMatrix = new Matrix4();
const cullSphere = new Sphere();

function npcInFrustum(
  frustum: Frustum,
  view: NpcView,
  t: Tuning['hub'],
): boolean {
  const scale = view.root.scale.y;
  cullSphere.center.set(
    view.root.position.x,
    view.root.position.y + t.npcBoundsCenterM * scale,
    view.root.position.z,
  );
  cullSphere.radius = t.npcBoundsRadiusM * scale + t.npcCullMarginM;
  return frustum.intersectsSphere(cullSphere);
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
 * Postacie kryjówki: cywil `npc_civilian.glb` na szkielecie UAL (skórowane warianty stroju wybierane
 * przez `look`, rekwizyty na kościach), animacje z `npc_anims.glb`. Wierzchnia warstwa w odcieniu NPC
 * ze słabą poświatą krawędzi w akcencie z palety neonów. Obrót głowy i tułowia: `updateNpcLook`.
 */
export class HubNpcs {
  readonly root = new Group();
  private readonly views: NpcView[] = [];
  private readonly geometries = new Map<string, BufferGeometry>();
  private serving?: AnimationAction;
  /** Zakończone klipy podawania do zwolnienia po crossfadzie z powrotem do animacji bazowej. */
  private readonly retiring: {
    mixer: AnimationMixer;
    action: AnimationAction;
    leftS: number;
  }[] = [];
  /** Materiały wspólne dla wszystkich NPC (skóra, buty, koszule, spodnie, rekwizyty), klucz: kolor. */
  private readonly shared = new Map<string, MeshToonMaterial>();
  private disposed = false;
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly rootPosition = { x: 0, y: 0, z: 0 };
  private readonly markerGeometry = new OctahedronGeometry(0.5);
  private readonly markerMaterial = new MeshBasicMaterial({
    color: new Color(MARKER_COLOR),
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    fog: false,
  });
  private time = 0;
  private alpha = 1;

  constructor(
    states: readonly NpcRuntime[],
    private readonly tuning: Tuning,
  ) {
    this.markerMaterial.color.multiplyScalar(tuning.hub.markerGlow);
    // Biel jest za mało nasycona dla heurystyki bloomu, a kontur rysowałby wokół znacznika ciemną obwódkę.
    this.markerMaterial.userData.bloom = true;
    states.forEach((state, index) => {
      const def = state.def;
      const root = new Group();
      root.name = `npc:${def.id}`;
      const baseYaw = (def.rotationDeg * Math.PI) / 180;
      root.position.copy(npcRootPosition(def));
      root.rotation.y = baseYaw;
      root.scale.setScalar(def.scale ?? 1);
      this.root.add(root);
      const marker = new Mesh(this.markerGeometry, this.markerMaterial);
      marker.name = `npcMarker:${def.id}`;
      marker.visible = false;
      marker.userData.noOutline = true;
      marker.position.y =
        tuning.hub.markerHeightM -
        (isSeated(def)
          ? tuning.hub.markerSeatedDropM
          : def.animation && LOW_POSES.includes(def.animation)
            ? tuning.hub.markerLowDropM
            : 0);
      root.add(marker);
      this.views.push({
        marker,
        def,
        root,
        state,
        actions: new Map(),
        animDt: 0,
        visible: true,
        animFrames:
          index % Math.max(1, Math.round(tuning.hub.npcAnimFarFrames)),
        material: this.material(def.accent, def.look?.shade ?? index % 5),
        accent: this.accentMaterial(def.accent),
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

  private accentMaterial(accent: NpcAccent): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      color: new Color(ACCENT_COLORS[accent]),
      toneMapped: false,
    });
    material.userData.bloom = true;
    return material;
  }

  /** Wspólny materiał tkaniny/rekwizytu w danym kolorze (dwustronny: otwarte rękawy i brzegi). */
  private cloth(color: string): MeshToonMaterial {
    let material = this.shared.get(color);
    if (!material) {
      material = new MeshToonMaterial({
        color: new Color(color),
        gradientMap,
        side: DoubleSide,
      });
      this.shared.set(color, material);
    }
    return material;
  }

  /** Materiał części stroju po nazwie materiału z Blendera. */
  private partMaterial(view: NpcView, name: string): Material {
    const t = this.tuning.hub;
    const pick = (colors: readonly string[], salt: string): string =>
      colors[Math.floor(hash(`${view.def.id}${salt}`) * colors.length)]!;
    switch (name) {
      case 'mat_npc_outer':
        return view.material;
      case 'mat_npc_accent':
        return view.accent;
      case 'mat_npc_shirt':
        return this.cloth(pick(t.npcShirtColors, ':shirt'));
      case 'mat_npc_pants':
        return this.cloth(pick(t.npcPantsColors, ':pants'));
      case 'mat_npc_boots':
        return this.cloth(t.npcBootsColor);
      case 'mat_npc_skin':
        return this.cloth(t.npcSkinColor);
      case 'mat_npc_metal':
        return this.cloth(t.npcMetalColor);
      default:
        return this.cloth(t.npcGearColor);
    }
  }

  private material(accent: NpcAccent, index: number): MeshToonMaterial {
    const material = new MeshToonMaterial({
      color: new Color(BODY_COLORS[index % BODY_COLORS.length]!),
      gradientMap,
      side: DoubleSide,
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
      const parts = npcOutfit(view.def);
      const unused: Object3D[] = [];
      instance.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        if (!inOutfit(node.name, parts)) {
          unused.push(node);
          return;
        }
        const name = (node.material as Material).name;
        node.material = this.partMaterial(view, name);
        if (name === 'mat_npc_accent') node.userData.noOutline = true;
        if (node instanceof SkinnedMesh) {
          node.frustumCulled = true;
          node.boundingSphere = new Sphere(
            new Vector3(0, this.tuning.hub.npcBoundsCenterM, 0),
            this.tuning.hub.npcBoundsRadiusM,
          );
          view.skins.push(node);
        }
      });
      for (const node of unused) node.removeFromParent();
      // Skórowane części stroju dzielą jeden szkielet: jedna aktualizacja macierzy kości na NPC.
      const [first, ...rest] = view.skins;
      if (first)
        for (const skin of rest) skin.bind(first.skeleton, skin.bindMatrix);
      view.skins.length = Math.min(view.skins.length, 1);
      view.root.add(instance);
      view.head = instance.getObjectByName('DEF-head');
      view.chest = instance.getObjectByName('DEF-spine003');
      if (view.head) this.dress(view, view.head);
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
   * +Y w górę, +Z do przodu; głowa ma środek w y ≈ 0,1 m i promień ≈ 0,1 m. Kaptur jest częścią
   * `npc_civilian.glb` (`head_hood`).
   */
  private dress(view: NpcView, head: Object3D): void {
    const accent = view.accent;
    const cloth = new MeshToonMaterial({
      color: new Color('#262b36'),
      gradientMap,
    });
    view.owned.push(cloth);
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
        add(
          new CylinderGeometry(0.11, 0.11, 0.03, 14, 1, true),
          cloth,
          0,
          0.155,
          0,
        );
        add(new BoxGeometry(0.11, 0.014, 0.004), accent, 0, 0.155, 0.111);
        break;
      case 'wolan':
      case 'goggles':
        add(
          new CylinderGeometry(0.112, 0.112, 0.02, 14, 1, true),
          cloth,
          0,
          0.106,
          0,
        );
        for (const side of [-1, 1])
          add(
            new CylinderGeometry(0.024, 0.024, 0.014, 10),
            accent,
            side * 0.042,
            0.106,
            0.108,
            Math.PI / 2,
          );
        add(new BoxGeometry(0.02, 0.008, 0.008), accent, 0, 0.108, 0.112);
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
    }
  }

  get helaHead() {
    return this.views.find(({ def }) => def.id === soup.npc)?.head;
  }

  shotObstacles(focus: Vector3): ShotSphere[] {
    const result: ShotSphere[] = [];
    for (const view of this.views) {
      if (view.root.position.distanceToSquared(focus) > 25) continue;
      for (const bone of [view.head, view.chest]) {
        if (bone)
          result.push({
            owner: view.def.id,
            center: bone.getWorldPosition(new Vector3()),
            radius: this.tuning.hub.cutaway.npcSphereM * view.root.scale.x,
          });
      }
    }
    return result;
  }

  get servingHand() {
    return (
      this.serving &&
      this.views
        .find(({ def }) => def.id === soup.npc)
        ?.root.getObjectByName('DEF-handL')
    );
  }

  private beginServing(): void {
    if (this.serving) return;
    const view = this.views.find(({ def }) => def.id === soup.npc);
    const clip = view?.actions.get(soup.clip)?.getClip();
    if (!view?.mixer || !clip) return;
    // Osobna akcja, bo ten sam klip jest też wykorzystywany w pętli bezczynności.
    const action = view.mixer.clipAction(clip.clone());
    // Czas klipu ustawia symulacja (`step`), mixer go nie przesuwa.
    action.paused = true;
    action.clampWhenFinished = true;
    this.serving = action.setLoop(LoopOnce, 1).play();
    view.action?.crossFadeTo(action, this.tuning.hub.npcAnimFadeS, false);
    view.action = action;
  }

  faceCounter(active: boolean): void {
    const hela = this.views.find(({ def }) => def.id === soup.npc);
    if (hela) hela.state.faceBase = active;
  }

  /** Interpolacja stanu symulacji i kosmetyczne mixery. Bez alokacji w pętli widoków. */
  render(
    alpha: number,
    dt: number,
    camera: Vec3,
    speaker: string | null,
    pending: ((id: string) => boolean) | null = null,
    gesture: number | null = null,
  ): void {
    const t = this.tuning.hub;
    this.time += dt;
    this.alpha = alpha;
    this.releaseRetired(dt);
    if (gesture !== null) this.beginServing();
    const pulse =
      1 +
      Math.sin(this.time * t.markerPulseHz * Math.PI * 2) * t.markerPulseAmp;
    this.markerMaterial.opacity = Math.min(1, 0.75 + (pulse - 1) * 1.4);
    for (const view of this.views) {
      const state = view.state;
      const showMarker =
        pending !== null && speaker !== view.def.id && pending(view.def.id);
      view.marker.visible = showMarker;
      if (showMarker) {
        const s = t.markerSizeM * pulse;
        view.marker.scale.set(
          s * t.markerWidthRatio,
          s,
          s * t.markerWidthRatio,
        );
      }
      const serving = view.def.id === soup.npc && this.serving;
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
      if (serving) {
        if (gesture === null && view.mixer) {
          // Klip skończony: akcja zostaje w `view.action`, by crossfade wrócił do animacji bazowej.
          this.retiring.push({
            mixer: view.mixer,
            action: serving,
            leftS: t.npcAnimFadeS,
          });
          this.serving = undefined;
          view.animation = undefined;
        } else if (gesture !== null)
          serving.time = gesture * serving.getClip().duration;
      }
      if (!this.serving || view.def.id !== soup.npc) {
        const action = view.actions.get(animation);
        if (action && animation !== view.animation) {
          action.reset().setEffectiveWeight(1).play();
          view.action?.crossFadeTo(action, t.npcAnimFadeS, false);
          view.action = action;
          view.animation = animation;
        }
      }
      if (!view.mixer) continue;
      view.animDt += dt;
      view.animFrames++;
      const near =
        Math.hypot(
          camera.x - this.position.x,
          camera.y - this.position.y,
          camera.z - this.position.z,
        ) <= t.npcAnimFarM;
      if (
        !npcAnimDue(
          near,
          view.visible,
          view.animFrames,
          t.npcAnimFarFrames,
          t.npcAnimHiddenFrames,
        )
      )
        continue;
      this.pose(view);
    }
  }

  private releaseRetired(dt: number): void {
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const entry = this.retiring[i]!;
      entry.leftS -= dt;
      if (entry.leftS > 0) continue;
      const clip = entry.action.getClip();
      entry.mixer.uncacheAction(clip);
      entry.mixer.uncacheClip(clip);
      this.retiring.splice(i, 1);
    }
  }

  /**
   * Test kadru NPC po ustawieniu kamery w bieżącej klatce. NPC wracający do kadru z zaległym dt
   * dostaje od razu aktualną pozę, więc po powrocie nie ma skoku animacji.
   */
  cull(camera: Camera): void {
    const t = this.tuning.hub;
    frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustum.setFromProjectionMatrix(frustumMatrix);
    for (const view of this.views) {
      const visible = npcInFrustum(frustum, view, t);
      if (visible && !view.visible && view.mixer && view.animDt > 0)
        this.pose(view);
      view.visible = visible;
    }
  }

  private pose(view: NpcView): void {
    const state = view.state;
    const alpha = this.alpha;
    view.mixer!.update(view.animDt);
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

  /** Liczba NPC aktualnie w kadrze (debug). */
  get visibleCount(): number {
    return this.views.reduce((sum, view) => sum + (view.visible ? 1 : 0), 0);
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
      view.accent.dispose();
      for (const resource of view.owned) resource.dispose();
    }
    this.views.length = 0;
    for (const material of this.shared.values()) material.dispose();
    this.shared.clear();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
  }
}
