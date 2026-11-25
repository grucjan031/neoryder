import {
  AnimationMixer,
  Group,
  Mesh,
  DoubleSide,
  MeshToonMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Object3D,
  type AnimationAction,
  PointLight,
} from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { loadBody, loadClips } from '../scenes/hubNpcs';
import {
  catState,
  ease,
  noodlesState,
  type CutawayKind,
  type Shot,
} from '../scenes/hubCutaway';
import type { Tuning } from '../core/tuning';
import { hubInteractions } from '../world/hubInteractions';
import { gradientMap } from './materials';

export class ThirdPersonBody {
  readonly root = new Group();
  /** Ciepłe światło kluczowe ujęcia: postać i miska czytelne w ciemnej kryjówce. */
  private readonly key = new PointLight(0xffe2b8, 0);
  private mixer?: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly bones = new Map<string, Object3D>();
  private action?: AnimationAction;
  private disposed = false;
  private readonly cloth = new MeshToonMaterial({
    color: 0x3d4c63,
    gradientMap,
    side: DoubleSide,
  });
  private readonly pants = new MeshToonMaterial({
    color: 0x2a3240,
    gradientMap,
  });
  private readonly skin = new MeshToonMaterial({ gradientMap });
  private readonly accent = new MeshToonMaterial({
    gradientMap,
    color: 0x36dce7,
    emissive: 0x36dce7,
  });
  private readonly joints: { bone: Object3D; original: Quaternion }[] = [];
  constructor(
    parent: Object3D,
    private readonly hub: Tuning['hub'],
  ) {
    this.root.visible = false;
    this.skin.color.set(hub.npcSkinColor);
    parent.add(this.root);
  }
  async load() {
    const [template, clips] = await Promise.all([loadBody(), loadClips()]);
    if (!template || this.disposed) return;
    const model = clone(template);
    model.traverse((n) => {
      if (n.type === 'Bone') this.bones.set(n.name, n);
      if (!(n instanceof Mesh)) return;
      n.visible = /^(civ_|top_jacket|head_hood)/.test(n.name);
      n.frustumCulled = false;
      if (n.name === 'civ_skin') n.material = this.skin;
      else if (n.name.startsWith('civ_')) n.material = this.pants;
      else if (n.name.endsWith('__accent')) {
        n.material = this.accent;
        n.userData.noOutline = true;
      } else n.material = this.cloth;
    });
    this.root.add(model);
    this.mixer = new AnimationMixer(model);
    for (const clip of clips)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    for (const name of [
      'DEF-forearmR',
      'DEF-upper_armR',
      'DEF-shoulderR',
      'DEF-spine001',
    ]) {
      const bone = this.bone(name);
      if (bone) this.joints.push({ bone, original: bone.quaternion.clone() });
    }
  }
  bone(name: string) {
    return this.bones.get(name);
  }
  get chin() {
    return this.bone('DEF-head')?.localToWorld(
      new Vector3().copy(hubInteractions.soup.chinPosition),
    );
  }
  setClip(name: string, time: number | 'loop') {
    const next = this.actions.get(name);
    if (!next) return;
    if (next !== this.action) {
      this.action?.stop();
      next.reset().play();
      this.action = next;
    }
    next.paused = time !== 'loop';
    if (typeof time === 'number')
      next.time =
        Math.min(1 - Number.EPSILON, Math.max(0, time)) *
        next.getClip().duration;
  }
  update(dt: number) {
    this.mixer?.update(dt);
  }
  private reach(target: Vector3, weight: number, kneeling: boolean) {
    const hand = this.bone('DEF-handR');
    if (!hand || weight <= 0) return;
    const end = new Vector3(),
      origin = new Vector3(),
      toward = new Vector3(),
      rotation = new Quaternion(),
      parent = new Quaternion(),
      inverseParent = new Quaternion();
    target.lerp(hand.getWorldPosition(end), 1 - weight);
    for (
      let i = 0;
      i < 16 && hand.getWorldPosition(end).distanceToSquared(target) > 0.000025;
      i++
    )
      for (const { bone } of this.joints) {
        if (!kneeling && bone.name === 'DEF-spine001') continue;
        bone.getWorldPosition(origin);
        hand.getWorldPosition(end).sub(origin).normalize();
        toward.copy(target).sub(origin).normalize();
        rotation.setFromUnitVectors(end, toward);
        bone.parent!.getWorldQuaternion(parent);
        bone.quaternion.premultiply(
          rotation
            .premultiply(inverseParent.copy(parent).invert())
            .multiply(parent),
        );
      }
  }
  pose(
    kind: CutawayKind,
    shot: Shot,
    t: number,
    blend: number,
    catHead?: Object3D,
  ) {
    this.root.visible = blend > 0;
    if (!this.root.visible) return;
    const s = this.hub.cutaway;
    this.key.intensity = s.keyLight.intensity * blend;
    const contact =
      kind === 'cat' && catHead
        ? catHead.getWorldPosition(new Vector3())
        : new Vector3().copy(shot.targetPos);
    const delta = contact.clone().sub(shot.playerPos);
    delta.y = 0;
    const length = delta.length();
    delta.normalize();
    const phase = noodlesState(t, s.noodlesPhases),
      cat = catState(t, s.catPhases);
    const approach =
      kind === 'cat'
        ? cat.phase === 'kneel'
          ? ease(cat.progress)
          : cat.phase === 'rise'
            ? 1 - ease(cat.progress)
            : 1
        : blend;
    const stand = kind === 'cat' ? s.catStandM : s.bowlStandM;
    this.root.position
      .copy(shot.playerPos)
      .addScaledVector(delta, Math.max(0, length - stand) * approach);
    this.root.rotation.y = Math.atan2(delta.x, delta.z);
    for (const j of this.joints) j.bone.quaternion.copy(j.original);
    let clip = 'Idle_Loop',
      time = t;
    const goal = new Vector3().copy(shot.targetPos);
    let reach: number;
    if (kind === 'cat') {
      clip = 'Fixing_Kneeling';
      time =
        cat.phase === 'stroke' ? cat.progress : cat.phase === 'kneel' ? 0 : 1;
      // Poza klęcząca przenika się ze stojącą również przy pominięciu.
      this.setClip(clip, time);
      const idle = this.actions.get('Idle_Loop');
      idle?.play().setEffectiveWeight(1 - approach);
      this.action?.setEffectiveWeight(approach);
      if (idle) idle.paused = true;
      if (catHead) catHead.getWorldPosition(goal);
      else goal.y += this.hub.catHeightM / 2;
      goal.addScaledVector(
        delta,
        (this.hub.catPetStrokeM / 2) *
          Math.sin(cat.progress * Math.PI * 2 * this.hub.catPetStrokes),
      );
      reach = approach;
    } else {
      const q = phase.progress;
      if (phase.phase === 'pickUp' || phase.phase === 'putDown') {
        clip = 'PickUp_Table';
        time = phase.phase === 'pickUp' ? q : 1 - q;
      }
      if (phase.phase === 'push') {
        clip = 'Push_Loop';
        time = q;
        goal.addScaledVector(delta, s.pushM * q);
      }
      this.setClip(clip, time);
      if (this.action !== this.actions.get('Idle_Loop'))
        this.actions.get('Idle_Loop')?.stop();
      this.action?.setEffectiveWeight(1);
      const lift =
        phase.phase === 'eat'
          ? 1
          : phase.phase === 'pickUp'
            ? ease(q)
            : phase.phase === 'putDown'
              ? 1 - ease(q)
              : 0;
      this.update(0);
      const chin = this.chin ?? goal.clone();
      chin.addScaledVector(delta, hubInteractions.soup.bowlRadiusM / 2);
      chin.y +=
        s.biteBobM * Math.sin(q * Math.PI * 2 * s.biteCount) -
        hubInteractions.soup.bowlHeightM / 2;
      goal.lerp(chin, lift);
      reach =
        phase.phase === 'serve'
          ? ease(q)
          : phase.phase === 'take'
            ? 1 - ease(q)
            : phase.phase === 'return'
              ? 0
              : 1;
    }
    if (kind === 'cat') this.update(0);
    for (const j of this.joints) j.original.copy(j.bone.quaternion);
    this.reach(goal, reach, kind === 'cat');
  }
  dispose() {
    this.disposed = true;
    this.root.removeFromParent();
    this.mixer?.stopAllAction();
    this.root.traverse((n) => {
      if (n instanceof SkinnedMesh) n.skeleton.dispose();
    });
    this.cloth.dispose();
    this.skin.dispose();
    this.pants.dispose();
    this.accent.dispose();
  }
}
