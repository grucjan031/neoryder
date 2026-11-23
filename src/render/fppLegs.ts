import {
  AnimationClip,
  AnimationMixer,
  FrontSide,
  Group,
  MathUtils,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
} from 'three';
import type {
  AnimationAction,
  BufferGeometry,
  Material,
  Object3D,
} from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { Tuning } from '../core/tuning';
import type { PlayerState } from '../player/playerController';
import { loadBody, loadClips } from '../scenes/hubNpcs';

const clips = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  jog: 'Jog_Fwd_Loop',
  crouch: 'Crouch_Idle_Loop',
  slide: 'Sitting_Idle_Loop',
  air: 'Jog_Fwd_Loop',
} as const;
type Pose = keyof typeof clips;
type Weights = Record<Pose, number>;
type LegState = Pick<
  PlayerState,
  | 'position'
  | 'velocity'
  | 'yaw'
  | 'height'
  | 'grounded'
  | 'sliding'
  | 'crouched'
>;
const poses = Object.keys(clips) as Pose[];
const unit = (value: number) => MathUtils.clamp(value, 0, 1);

export function legWeights(
  speed: number,
  state: Pick<PlayerState, 'grounded' | 'sliding' | 'crouched'>,
  t: Tuning,
): Weights {
  const move = unit(speed / Math.max(Number.EPSILON, t.fppLegs.idleBlendSpeed));
  const run = unit(
    (speed - t.player.walkSpeed) /
      Math.max(Number.EPSILON, t.player.sprintSpeed - t.player.walkSpeed),
  );
  const weights = { idle: 0, walk: 0, jog: 0, crouch: 0, slide: 0, air: 0 };
  if (!state.grounded) weights.air = 1;
  else if (state.sliding) weights.slide = 1;
  else if (state.crouched) {
    weights.walk = move * unit(t.fppLegs.crouchWalkWeight);
    weights.crouch = 1 - weights.walk;
  } else {
    weights.idle = 1 - move;
    weights.walk = move * (1 - run);
    weights.jog = move * run;
  }
  return weights;
}

/** Model patrzy w +Z. Przy cofaniu biodra pozostają zwrócone do przodu. */
export function legDirection(vx: number, vz: number, yaw: number) {
  const forward = -vx * Math.sin(yaw) - vz * Math.cos(yaw);
  const right = vx * Math.cos(yaw) - vz * Math.sin(yaw);
  const sign = forward < 0 ? -1 : 1;
  return { turn: Math.atan2(-right * sign, Math.abs(forward)), sign };
}

/** Wspólna faza obu nóg podczas przenikania klipów, również przy spowolnieniu symulacji. */
export function legPhaseDelta(
  distance: number,
  weights: Weights,
  t: Tuning['fppLegs'],
) {
  const stride = weights.walk * t.walkStrideM + weights.jog * t.jogStrideM;
  return stride > 0 ? distance / stride : 0;
}

export class FppLegs {
  private readonly root = new Group();
  private readonly actions = new Map<Pose, AnimationAction>();
  private readonly materials: Material[] = [];
  private pants?: BufferGeometry;
  private readonly waistRing: number[] = [];
  private waistY = 0;
  private waistLift = NaN;
  private skeleton?: SkinnedMesh['skeleton'];
  private mixer?: AnimationMixer;
  private lastX?: number;
  private lastZ = 0;
  private phase = 0;
  private turn = 0;
  private disposed = false;

  constructor(
    world: Object3D,
    private readonly t: Tuning,
  ) {
    this.root.name = 'fppLegs';
    world.add(this.root);
    void this.load();
  }

  private async load(): Promise<void> {
    const [template, library] = await Promise.all([loadBody(), loadClips()]);
    if (this.disposed || !template) return;
    const body = clone(template);
    const unused: Mesh[] = [];
    body.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (
        !(node instanceof SkinnedMesh) ||
        (node.name !== 'civ_pants' && node.name !== 'civ_boots')
      ) {
        unused.push(node);
        return;
      }
      const fabric = (source: Material) => {
        const material = source.clone();
        material.side = FrontSide;
        this.materials.push(material);
        return material;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(fabric)
        : fabric(node.material);
      this.skeleton ??= node.skeleton;
      node.bind(this.skeleton, node.bindMatrix);
      if (node.name === 'civ_pants') {
        // Otwarty brzeg pod koszulą NPC. Przedłużamy tylko ten pierścień kopii FPP.
        const pants: BufferGeometry = node.geometry.clone();
        node.geometry = this.pants = pants;
        pants.computeBoundingBox();
        this.waistY = pants.boundingBox!.max.y;
        const positions = pants.getAttribute('position');
        for (let i = 0; i < positions.count; i++)
          if (positions.getY(i) === this.waistY) this.waistRing.push(i);
      }
      node.castShadow = false;
      node.frustumCulled = true;
      node.boundingSphere = new Sphere(
        new Vector3(0, this.t.hub.npcBoundsCenterM, 0),
        this.t.hub.npcBoundsRadiusM,
      );
    });
    for (const mesh of unused) mesh.removeFromParent();
    this.root.add(body);
    this.mixer = new AnimationMixer(body);
    for (const pose of poses) {
      const clip = library.find((entry) => entry.name === clips[pose]);
      if (!clip) continue;
      // Tylko kości wpływające na spodnie i buty, bez ścieżek dłoni, głowy i tułowia.
      const tracks = clip.tracks.filter((track) =>
        /^(root|DEF-(hips|(thigh|shin|foot|toe)[LR]))\./.test(track.name),
      );
      const action = this.mixer.clipAction(
        new AnimationClip(pose, clip.duration, tracks),
      );
      action.setEffectiveWeight(pose === 'idle' ? 1 : 0).play();
      action.paused = pose === 'walk' || pose === 'jog' || pose === 'air';
      this.actions.set(pose, action);
    }
  }

  update(
    prev: LegState,
    cur: LegState,
    alpha: number,
    dt: number,
    visible = true,
  ): void {
    this.root.visible = this.t.fppLegs.enabled && visible;
    if (!this.root.visible || !this.mixer) {
      this.lastX = undefined;
      return;
    }
    const t = this.t.fppLegs;
    if (this.pants && this.waistLift !== t.waistLiftM) {
      this.waistLift = t.waistLiftM;
      const positions = this.pants.getAttribute('position');
      for (const i of this.waistRing)
        positions.setY(i, this.waistY + this.waistLift);
      positions.needsUpdate = true;
      this.pants.computeVertexNormals();
    }
    const { lerp } = MathUtils;
    const x = lerp(prev.position.x, cur.position.x, alpha);
    const z = lerp(prev.position.z, cur.position.z, alpha);
    const height = lerp(prev.height, cur.height, alpha);
    const feetY = lerp(prev.position.y, cur.position.y, alpha) - height / 2;
    const yaw = lerp(prev.yaw, cur.yaw, alpha);
    const low = unit(
      (this.t.player.capsuleHeight - height) /
        Math.max(
          Number.EPSILON,
          this.t.player.capsuleHeight - this.t.player.slideCapsuleHeight,
        ),
    );
    const back = lerp(t.backOffsetM, t.lowBackOffsetM, low);
    this.root.position.set(
      x + Math.sin(yaw) * back,
      feetY,
      z + Math.cos(yaw) * back,
    );

    const speed = Math.hypot(cur.velocity.x, cur.velocity.z);
    const weights = legWeights(speed, cur, this.t);
    const direction = legDirection(cur.velocity.x, cur.velocity.z, yaw);
    const blend =
      this.lastX === undefined || t.fadeS <= 0 ? 1 : -Math.expm1(-dt / t.fadeS);
    this.turn = lerp(
      this.turn,
      speed > t.idleBlendSpeed ? direction.turn : 0,
      blend,
    );
    this.root.rotation.y = yaw + Math.PI + this.turn;
    for (const [pose, action] of this.actions) {
      weights[pose] = lerp(action.weight, weights[pose], blend);
      action.setEffectiveWeight(weights[pose]);
    }
    const distance =
      this.lastX === undefined ? 0 : Math.hypot(x - this.lastX, z - this.lastZ);
    this.lastX = x;
    this.lastZ = z;
    if (cur.grounded && !cur.sliding)
      this.phase = MathUtils.euclideanModulo(
        this.phase + direction.sign * legPhaseDelta(distance, weights, t),
        1,
      );
    const rise = unit(
      cur.velocity.y / Math.max(Number.EPSILON, this.t.player.jumpVelocity),
    );
    for (const [pose, action] of this.actions) {
      if (!action.paused) continue;
      const phase =
        pose === 'air' ? lerp(t.fallPhase, t.risePhase, rise) : this.phase;
      action.time = phase * action.getClip().duration;
    }
    this.mixer.update(dt);
  }

  dispose(): void {
    this.disposed = true;
    this.root.removeFromParent();
    this.mixer?.stopAllAction();
    this.skeleton?.dispose();
    this.pants?.dispose();
    for (const material of this.materials) material.dispose();
  }
}
