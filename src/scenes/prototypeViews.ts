import {
  AnimationMixer,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  RingGeometry,
  SkinnedMesh,
} from 'three';
import type {
  AnimationAction,
  BufferGeometry,
  Material,
  Object3D,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { cloneCityModel } from '../render/cityModels';
import { getMaterial, gradientMap } from '../render/materials';
import type { EscortMotion, EscortState } from '../world/escortNpc';
import { inOutfit, loadBody, loadClips } from './hubNpcs';

export interface ViewPose {
  position: Vec3;
  yaw: number;
}

/** Części `npc_civilian.glb` więźnia: skóra, strój roboczy, bez rekwizytów. */
const PRISONER_PARTS = ['civ_skin', 'civ_pants', 'civ_boots', 'top_shirt'];

const CLIP_BY_MOTION: Record<EscortMotion, string> = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
};
const CLIP_WAITING = 'Crouch_Idle_Loop';

/**
 * Znacznik strefy: płaski pierścień i słup światła w neonie z palety ADR 0006
 * (ciepła biel albo bursztyn; bez czerwieni, cyanu i magenty). Materiały są wspólne.
 */
export class ZoneMarker {
  readonly root = new Group();
  private readonly ring: BufferGeometry;
  private readonly pole: BufferGeometry;

  constructor(
    radiusM: number,
    heightM: number,
    kind: 'neon_white' | 'neon_amber',
  ) {
    this.ring = new RingGeometry(Math.max(0.05, radiusM - 0.15), radiusM, 48);
    this.pole = new CylinderGeometry(0.06, 0.06, heightM, 8);
    const material = getMaterial(kind);
    const ring = new Mesh(this.ring, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.userData.noOutline = true;
    const pole = new Mesh(this.pole, material);
    pole.position.y = heightM / 2;
    pole.userData.noOutline = true;
    this.root.add(ring, pole);
  }

  place(position: Vec3): void {
    this.root.position.set(position.x, position.y, position.z);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.ring.dispose();
    this.pole.dispose();
  }
}

/** Więzień: `npc_civilian.glb` z klipami `npc_anims.glb`; bez modeli kapsuła zastępcza. */
export class EscortNpcView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials = new Map<string, MeshToonMaterial>();
  private readonly actions = new Map<string, AnimationAction>();
  private mixer?: AnimationMixer;
  private current: string | null = null;
  private disposed = false;

  constructor(
    private readonly tuning: Tuning,
    heightM: number,
    radiusM: number,
  ) {
    this.root.add(this.body);
    const geometry = new CapsuleGeometry(
      radiusM,
      Math.max(0.01, heightM - 2 * radiusM),
      4,
      10,
    );
    this.geometries.push(geometry);
    const capsule = new Mesh(geometry, getMaterial('interactive'));
    capsule.name = 'escortFallback';
    capsule.position.y = heightM / 2;
    this.body.add(capsule);
  }

  /** Podmienia kapsułę na model; przy błędzie wczytania zostaje kapsuła. */
  async load(): Promise<void> {
    const [template, clips] = await Promise.all([loadBody(), loadClips()]);
    if (this.disposed || !template) return;
    const instance = clone(template);
    const unused: Object3D[] = [];
    instance.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!inOutfit(node.name, PRISONER_PARTS)) {
        unused.push(node);
        return;
      }
      node.material = this.cloth((node.material as Material).name);
      if (node instanceof SkinnedMesh) node.frustumCulled = false;
    });
    for (const node of unused) node.removeFromParent();
    this.body.clear();
    this.body.add(instance);
    const mixer = new AnimationMixer(instance);
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      this.actions.set(clip.name, action);
    }
    this.mixer = mixer;
    this.current = null;
  }

  update(
    pose: ViewPose,
    state: EscortState,
    motion: EscortMotion,
    dt: number,
  ): void {
    this.root.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.root.rotation.y = pose.yaw;
    this.root.visible = state !== 'evacuated';
    // Poległy leży; bez modelu kapsuła też się przewraca.
    this.body.rotation.x = state === 'dead' ? -Math.PI / 2 : 0;
    this.body.position.y = state === 'dead' ? 0.25 : 0;
    this.play(
      state === 'dead'
        ? null
        : state === 'waiting'
          ? CLIP_WAITING
          : CLIP_BY_MOTION[motion],
    );
    this.mixer?.update(dt);
  }

  private play(clip: string | null): void {
    if (clip === this.current || !this.mixer) return;
    const fade = this.tuning.prototypes.escort.animFadeS;
    this.actions.get(this.current ?? '')?.fadeOut(fade);
    this.current = clip;
    if (clip) this.actions.get(clip)?.reset().fadeIn(fade).play();
  }

  /** Materiał tkaniny po nazwie materiału z modelu; kolory z tuning kryjówki (te same co cywile). */
  private cloth(name: string): MeshToonMaterial {
    const t = this.tuning.hub;
    const color =
      name === 'mat_npc_pants'
        ? t.npcPantsColors[0]!
        : name === 'mat_npc_boots'
          ? t.npcBootsColor
          : name === 'mat_npc_skin'
            ? t.npcSkinColor
            : name === 'mat_npc_shirt' || name === 'mat_npc_outer'
              ? t.npcShirtColors[0]!
              : t.npcGearColor;
    let material = this.materials.get(color);
    if (!material) {
      material = new MeshToonMaterial({
        color: new Color(color),
        gradientMap,
        side: DoubleSide,
      });
      this.materials.set(color, material);
    }
    return material;
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
  }
}

/** Wagon: `port_flatcar.glb` (14 m wzdłuż X, podstawa y = 0); bez modelu bryła zastępcza. */
export class PayloadView {
  readonly root = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly ring: Mesh;
  private disposed = false;

  constructor(tuning: Tuning['prototypes']['payload']) {
    const t = tuning;
    const box = new BoxGeometry(
      t.bodyHalfLengthM * 2,
      t.bodyHalfHeightM * 2,
      t.bodyHalfWidthM * 2,
    );
    const ringGeometry = new RingGeometry(
      t.pushRadiusM - 0.2,
      t.pushRadiusM,
      64,
    );
    this.geometries.push(box, ringGeometry);
    const fallback = new Mesh(box, getMaterial('world'));
    fallback.name = 'payloadFallback';
    fallback.position.y = t.bodyHalfHeightM;
    this.root.add(fallback);
    this.ring = new Mesh(ringGeometry, getMaterial('neon_amber'));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    this.ring.userData.noOutline = true;
    this.root.add(this.ring);
  }

  async load(): Promise<void> {
    const model = await cloneCityModel('port_flatcar');
    if (this.disposed || !model) return;
    this.root.getObjectByName('payloadFallback')?.removeFromParent();
    this.root.add(model);
  }

  /** Pierścień zasięgu pchania widoczny, gdy wagon czeka na gracza. */
  update(pose: ViewPose, showRing: boolean): void {
    this.root.position.set(pose.position.x, pose.position.y, pose.position.z);
    // Model leży wzdłuż X; yaw jazdy to atan2(dx, dz).
    this.root.rotation.y = pose.yaw - Math.PI / 2;
    this.ring.visible = showRing;
  }

  dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    for (const g of this.geometries) g.dispose();
  }
}
