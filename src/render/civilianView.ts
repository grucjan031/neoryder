import {
  AnimationMixer,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshToonMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from 'three';
import type { AnimationAction, Material, Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Civilian } from '../civilians/civilian';
import type { CivilianDefinition } from '../civilians/civilianSchema';
import type { Tuning } from '../core/tuning';
import { gradientMap } from './materials';
import { inOutfit, loadBody, loadClips } from './npcAssets';

/** Upadek jest wyłącznie wizualny: symulacja zachowuje kierunek i czas śmierci. */
export class CivilianView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly pivot = new Group();
  private readonly actions = new Map<string, AnimationAction>();
  private readonly materials: Material[] = [];
  private readonly skins: SkinnedMesh[] = [];
  private readonly fallback: Mesh;
  private mixer?: AnimationMixer;
  private action?: AnimationAction;
  private animation?: string;
  private disposed = false;
  private readonly axis = new Vector3();
  private readonly rotation = new Quaternion();

  constructor(
    private readonly def: CivilianDefinition,
    private readonly variant: number,
    private readonly tuning: Tuning,
  ) {
    const t = tuning.civilians;
    this.root.add(this.pivot);
    this.pivot.add(this.body);
    this.body.position.y = -t.bodyHeightM / 2;
    const material = new MeshToonMaterial({ color: '#e3e1d9', gradientMap });
    this.materials.push(material);
    this.fallback = new Mesh(
      new CapsuleGeometry(t.radiusM, t.bodyHeightM - 2 * t.radiusM),
      material,
    );
    this.fallback.position.y = t.bodyHeightM / 2;
    this.body.add(this.fallback);
  }

  async load(): Promise<void> {
    const [template, clips] = await Promise.all([
      loadBody(this.def.model),
      loadClips(),
    ]);
    if (this.disposed || !template) return;
    const outfit = this.def.clothingVariants[this.variant]!;
    const instance = clone(template);
    const unused: Object3D[] = [];
    const colors: Record<string, string> = {
      mat_npc_outer: outfit.coatColor,
      mat_npc_pants: outfit.pantsColor,
      mat_npc_accent: outfit.accent,
      mat_npc_skin: this.tuning.hub.npcSkinColor,
      mat_npc_boots: this.tuning.hub.npcBootsColor,
    };
    const materials = new Map<string, Material>();
    instance.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!inOutfit(node.name, outfit.parts)) {
        unused.push(node);
        return;
      }
      const name = (node.material as Material).name;
      let material = materials.get(name);
      if (!material) {
        material = new MeshToonMaterial({
          color: new Color(colors[name] ?? outfit.coatColor),
          gradientMap,
          side: DoubleSide,
        });
        materials.set(name, material);
        this.materials.push(material);
      }
      node.material = material;
      if (node instanceof SkinnedMesh) {
        node.frustumCulled = false;
        this.skins.push(node);
      }
    });
    for (const node of unused) node.removeFromParent();
    this.fallback.visible = false;
    this.body.add(instance);
    this.mixer = new AnimationMixer(instance);
    for (const clip of clips)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  render(civilian: Civilian, alpha: number, dt: number): void {
    const a = civilian.previous,
      b = civilian.current,
      t = this.tuning.civilians;
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * alpha,
      a.position.y + (b.position.y - a.position.y) * alpha,
      a.position.z + (b.position.z - a.position.z) * alpha,
    );
    let yawDelta = b.yaw - a.yaw;
    yawDelta -= Math.PI * 2 * Math.round(yawDelta / (Math.PI * 2));
    this.body.rotation.y = a.yaw + yawDelta * alpha;
    if (b.state !== 'dead') {
      const clip =
        b.state === 'fleeing'
          ? 'Jog_Fwd_Loop'
          : b.state === 'crouching'
            ? 'Crouch_Idle_Loop'
            : 'Idle_Loop';
      const next = this.actions.get(clip);
      if (next && clip !== this.animation) {
        next.reset().play();
        this.action?.crossFadeTo(next, t.animFadeS, false);
        this.action = next;
        this.animation = clip;
      }
      this.mixer?.update(dt);
      this.pivot.position.set(0, t.bodyHeightM / 2, 0);
      this.pivot.quaternion.identity();
    } else {
      // Jeśli model wczytał się dopiero po śmierci, ustaw bezczynność zamiast pozy bazowej.
      if (!this.action && this.mixer) {
        this.action = this.actions.get('Idle_Loop');
        this.action?.play();
        this.mixer.update(0);
      }
      const time =
        a.state === 'dead'
          ? a.deathS + (b.deathS - a.deathS) * alpha
          : b.deathS * alpha;
      const progress = Math.min(1, time / t.fallDurationS);
      const eased = progress * progress * (3 - 2 * progress);
      const dir = b.fallDirection;
      this.body.position.y = -b.fallHeightM / 2;
      this.axis.set(dir.z, 0, -dir.x).normalize();
      this.rotation.setFromAxisAngle(this.axis, (Math.PI / 2) * eased);
      this.pivot.quaternion.copy(this.rotation);
      this.pivot.position.set(
        dir.x * t.fallSlideM * eased,
        (b.fallHeightM / 2) * (1 - eased) + t.corpseHeightM * eased,
        dir.z * t.fallSlideM * eased,
      );
    }
    for (const skin of this.skins) skin.skeleton.update();
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.mixer) this.mixer.uncacheRoot(this.mixer.getRoot());
    for (const skeleton of new Set(this.skins.map((skin) => skin.skeleton)))
      skeleton.dispose();
    for (const material of this.materials) material.dispose();
    this.fallback.geometry.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
