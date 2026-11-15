import {
  AnimationMixer,
  BoxGeometry,
  CylinderGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
} from 'three';
import type { AnimationAction, Object3D } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { tuning } from '../core/tuning';
import { selectEnemyAnimation } from './enemyAnimation';
import { HeldShield } from './heldShield';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle, getMaterial } from '../render/materials';
import type { Enemy } from './types';

const laserLocal = new Vector3();
const laserFrom = new Vector3();

/** Humanoid z karabinem: Strzelec i Snajper (F2-13) dzielą model i animację. */
const rifleman = (kind: string): boolean =>
  kind === 'gunner' || kind === 'sniper';
const up = new Vector3(0, 1, 0);
const templates = new Map<string, Promise<Object3D | null>>();
/** Domyślny model archetypu, gdy dane nie podają pola model. */
const defaultModel = (kind: string): string =>
  rifleman(kind) ? 'enemy_gunner' : 'enemy_trooper';
/** Wczytuje i stylizuje model GLB wroga (cache po nazwie); null przy błędzie. */
export function loadEnemyModel(name: string): Promise<Object3D | null> {
  const cached = templates.get(name);
  if (cached) return cached;
  const template = new GLTFLoader()
    .loadAsync(`/assets/models/${name}.glb`)
    .then(({ scene, animations }) => {
      scene.animations = animations ?? [];
      const materials = new Set<import('three').Material>();
      scene.traverse((node) => {
        if (node instanceof Mesh)
          for (const material of Array.isArray(node.material)
            ? node.material
            : [node.material])
            materials.add(material);
      });
      applyStyle(scene);
      for (const material of materials) material.dispose();
      return scene;
    })
    .catch(() => null);
  templates.set(name, template);
  return template;
}

/** Geometria GLB i materiały stylu należą do cache, pozy węzłów do pojedynczego widoku. */
export class EnemyView {
  readonly root = new Group();
  private model = new Group();
  private disposed = false;
  private mixer?: AnimationMixer;
  private action?: AnimationAction;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly skins: SkinnedMesh[] = [];
  private animationState?: Enemy['current']['state'];
  private animationTimeS = 0;
  private shotTimeS?: number;
  private pendingAnimationS = 0;
  private animationPending = false;
  private readonly laser?: Mesh;
  private shield?: Object3D;
  private fallbackShield?: Mesh;
  private heldShield?: HeldShield;
  private readonly fallbackGeometries: BoxGeometry[] = [];
  private readonly rest = new Map<
    Object3D,
    {
      x: number;
      y: number;
      z: number;
      position: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    }
  >();

  constructor(
    readonly enemy: Enemy,
    loadModels = true,
  ) {
    const body = enemy.definition.body;
    if (!body) throw new Error('Brak geometrii wroga.');
    const part = (
      parent: Object3D,
      name: string,
      position: { x: number; y: number; z: number },
      size: { x: number; y: number; z: number },
      offsetY = 0,
    ): Group => {
      const pivot = new Group();
      pivot.name = name;
      pivot.position.copy(position);
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.fallbackGeometries.push(geometry);
      const mesh = new Mesh(
        geometry,
        getMaterial(
          name === 'baton_tip' || name === 'muzzle' || name === 'visor'
            ? 'enemyGlow'
            : 'enemy',
        ),
      );
      mesh.position.y = offsetY;
      pivot.add(mesh);
      parent.add(pivot);
      return pivot;
    };
    const pelvis = part(
      this.model,
      'pelvis',
      { x: 0, y: body.centerY / 2, z: 0 },
      { x: body.radius * 2, y: body.radius, z: body.radius },
    );
    const torso = part(
      pelvis,
      'torso',
      { x: 0, y: body.centerY / 2, z: 0 },
      { x: body.radius * 2, y: body.halfHeight * 2, z: body.radius * 2 },
    );
    const head = part(
      torso,
      'head',
      { x: 0, y: body.headY - body.centerY, z: 0 },
      {
        x: body.headRadius * 2,
        y: body.headRadius * 2,
        z: body.headRadius * 2,
      },
    );
    if (rifleman(enemy.definition.kind))
      part(
        head,
        'visor',
        { x: 0, y: 0, z: body.headRadius },
        {
          x: body.headRadius * 2,
          y: body.headRadius / 2,
          z: body.headRadius / 2,
        },
      );
    for (const [side, sign] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      const arm = part(
        torso,
        `arm_upper_${side}`,
        { x: sign * body.radius, y: body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.halfHeight, z: body.radius / 2 },
        -body.halfHeight / 2,
      );
      const lower = part(
        arm,
        `arm_lower_${side}`,
        { x: 0, y: -body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.halfHeight, z: body.radius / 2 },
        -body.halfHeight / 2,
      );
      const hand = part(
        lower,
        `hand_${side}`,
        { x: 0, y: -body.halfHeight, z: 0 },
        { x: body.radius / 2, y: body.radius / 2, z: body.radius / 2 },
      );
      if (side === 'R') {
        const baton = part(
          hand,
          rifleman(this.enemy.definition.kind) ? 'rifle' : 'baton',
          { x: 0, y: 0, z: body.halfHeight },
          { x: body.radius / 2, y: body.radius / 2, z: body.halfHeight * 2 },
        );
        part(
          baton,
          rifleman(this.enemy.definition.kind) ? 'muzzle' : 'baton_tip',
          { x: 0, y: 0, z: body.halfHeight },
          { x: body.radius / 2, y: body.radius / 2, z: body.radius / 2 },
        );
      }
      const leg = part(
        pelvis,
        `leg_upper_${side}`,
        { x: (sign * body.radius) / 2, y: 0, z: 0 },
        { x: body.radius / 2, y: body.centerY / 4, z: body.radius / 2 },
        -body.centerY / 8,
      );
      part(
        leg,
        `leg_lower_${side}`,
        { x: 0, y: -body.centerY / 4, z: 0 },
        { x: body.radius / 2, y: body.centerY / 4, z: body.radius / 2 },
        -body.centerY / 8,
      );
    }
    this.equipBlade();
    this.captureRest();
    this.root.add(this.model);
    const shieldSize = enemy.definition.animation?.shieldSizeM;
    if ((enemy.definition.shield || enemy.definition.boss) && shieldSize) {
      const geometry = new BoxGeometry(
        shieldSize.x,
        shieldSize.y,
        shieldSize.z,
      );
      this.fallbackGeometries.push(geometry);
      this.fallbackShield = new Mesh(geometry, getMaterial('enemy'));
      this.shield = this.fallbackShield;
      this.shield.name = 'shield';
      this.shield.position.set(
        body.radius,
        body.centerY,
        body.radius + shieldSize.z / 2,
      );
      this.shield.visible = enemy.current.shieldUp === true;
      this.root.add(this.shield);
    }
    const laserRadius = enemy.definition.animation?.laserRadiusM;
    if (enemy.definition.laserSight && laserRadius) {
      // Jednostkowy cylinder wzdłuż +Y, skalowany do długości lasera w renderze.
      this.laser = new Mesh(
        new CylinderGeometry(laserRadius, laserRadius, 1, 6, 1, true),
        getMaterial('enemyGlow'),
      );
      this.laser.name = 'laser';
      this.laser.visible = false;
      this.root.add(this.laser);
    }
    if (loadModels)
      void loadEnemyModel(
        enemy.definition.model ?? defaultModel(enemy.definition.kind),
      ).then((source) => {
        if (!source || this.disposed) return;
        this.root.remove(this.model);
        this.model = new Group();
        this.model.scale.setScalar(enemy.definition.boss?.modelScale ?? 1);
        const instance = clone(source);
        this.model.add(instance);
        instance.traverse((node) => {
          if (node instanceof SkinnedMesh) this.skins.push(node);
        });
        if (this.skins.length && source.animations.length) {
          this.mixer = new AnimationMixer(instance);
          for (const clip of source.animations)
            this.actions.set(clip.name, this.mixer.clipAction(clip));
          // Konserwatywna sfera obejmuje kończyny także po zmianie pozy.
          for (const skin of this.skins) {
            skin.boundingSphere = new Sphere(
              new Vector3(0, body.height / 2, 0),
              body.height,
            );
          }
          instance.traverse((node) => {
            if (node instanceof Mesh)
              node.onBeforeRender = () => this.advanceAnimation();
          });
        }
        this.root.add(this.model);
        this.useModelShield();
        this.equipBlade();
        this.captureRest();
      });
  }

  /** Model z własnym węzłem shield zastępuje bryłę zastępczą (bez wpływu na dane tarczy). */
  private useModelShield(): void {
    const node = this.model.getObjectByName('shield');
    if (!node || !this.fallbackShield) return;
    this.fallbackShield.removeFromParent();
    this.shield = node;
    node.visible = this.enemy.current.shieldUp === true;
    const hold = this.enemy.definition.animation?.shieldHold;
    const idle = this.actions.get('Idle_Loop');
    if (!hold || !idle || !this.mixer) return;
    // Poza odniesienia: tarcza ma stać w ręce w Idle_Loop i dalej podążać za kością.
    idle.reset().play();
    this.mixer.setTime(0);
    this.heldShield = HeldShield.mount(node, this.root, hold) ?? undefined;
    idle.stop();
  }

  private equipBlade(): void {
    const size = this.enemy.definition.animation?.bladeSizeM;
    const hand = this.model.getObjectByName('hand_R');
    if (!size || !hand) return;
    const baton = this.model.getObjectByName('baton');
    if (baton) baton.visible = false;
    const geometry = new BoxGeometry(size.x, size.y, size.z);
    this.fallbackGeometries.push(geometry);
    const blade = new Mesh(geometry, getMaterial('enemyGlow'));
    blade.name = 'executor_blade';
    blade.position.z = size.z / 2;
    hand.add(blade);
  }

  private captureRest(): void {
    this.rest.clear();
    this.model.traverse((node) =>
      this.rest.set(node, {
        x: node.rotation.x,
        y: node.rotation.y,
        z: node.rotation.z,
        position: {
          x: node.position.x,
          y: node.position.y,
          z: node.position.z,
        },
        scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z },
      }),
    );
  }

  /** Linia lasera Snajpera w przestrzeni widoku: od lufy z danych do punktu celowania. */
  private renderLaser(): void {
    const laser = this.laser;
    if (!laser) return;
    const { current: b, definition } = this.enemy;
    const m = definition.muzzle;
    laser.visible = b.state === 'aim' && b.aim !== undefined && m !== undefined;
    if (!laser.visible || !b.aim || !m) return;
    const yaw = this.root.rotation.y;
    const wx = b.aim.x - this.root.position.x,
      wz = b.aim.z - this.root.position.z;
    const local = laserLocal.set(
      Math.cos(yaw) * wx - Math.sin(yaw) * wz,
      b.aim.y - this.root.position.y,
      Math.sin(yaw) * wx + Math.cos(yaw) * wz,
    );
    const from = laserFrom.set(m.x, m.y, m.z);
    const dir = local.sub(from);
    const length = dir.length();
    if (length <= 1e-6) {
      laser.visible = false;
      return;
    }
    const lock = definition.aimLockS ?? 0;
    const locked =
      definition.aimTelegraphS !== undefined &&
      b.stateTimeS + 1e-6 >= definition.aimTelegraphS - lock;
    const width = locked ? (definition.animation?.laserLockScale ?? 1) : 1;
    laser.position.copy(from).addScaledVector(dir, 0.5);
    laser.quaternion.setFromUnitVectors(up, dir.normalize());
    laser.scale.set(width, length, width);
  }

  render(alpha: number): void {
    const { previous: a, current: b, definition } = this.enemy;
    const t = Math.max(0, Math.min(1, alpha));
    this.root.position.set(
      a.position.x + (b.position.x - a.position.x) * t,
      a.position.y + (b.position.y - a.position.y) * t,
      a.position.z + (b.position.z - a.position.z) * t,
    );
    const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    this.root.rotation.y = a.yaw + delta * t;
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    if (this.shield) this.shield.visible = b.shieldUp === true;
    this.renderLaser();
    const anim = definition.animation;
    if (this.mixer) this.prepareAnimation(t);
    if (!anim) return;
    for (const [node, rest] of this.rest) {
      if (this.mixer && (node.type === 'Bone' || node instanceof SkinnedMesh))
        continue;
      node.rotation.set(rest.x, rest.y, rest.z);
      node.position.copy(rest.position);
      node.scale.copy(rest.scale);
    }
    const rotate = (name: string, axis: 'x' | 'z', angle: number): void => {
      const node = this.model.getObjectByName(name);
      if (node && !this.mixer) node.rotation[axis] += angle;
    };
    const phase =
      ((a.distance + (b.distance - a.distance) * t) / anim.strideM) *
      Math.PI *
      2;
    const walk =
      Math.sin(phase) *
      anim.walkAngle *
      Math.min(1, b.speed / definition.moveSpeed);
    for (const [side, sign] of [
      ['L', 1],
      ['R', -1],
    ] as const) {
      rotate(`leg_upper_${side}`, 'x', walk * sign);
      rotate(`leg_lower_${side}`, 'x', Math.max(0, -walk * sign));
      rotate(`arm_upper_${side}`, 'x', -walk * sign);
    }
    const time =
      a.state === b.state
        ? a.stateTimeS + (b.stateTimeS - a.stateTimeS) * t
        : b.stateTimeS;
    if (
      rifleman(definition.kind) &&
      ['aim', 'burst', 'cooldown'].includes(b.state)
    ) {
      const angle = anim.aimAngle ?? 0;
      for (const side of ['L', 'R']) rotate(`arm_upper_${side}`, 'x', angle);
      rotate('rifle', 'x', -angle);
    }
    const rifle = this.model.getObjectByName('rifle');
    if (rifle && anim.recoilS && b.shotTimeS !== undefined) {
      const recoil =
        (anim.recoilM ?? 0) * Math.max(0, 1 - b.shotTimeS / anim.recoilS);
      // Kierunek lokalny kompensuje uniesienie ramion: odrzut wzdłuż osi karabinu.
      rifle.position.y += recoil * Math.sin(rifle.rotation.x);
      rifle.position.z -= recoil * Math.cos(rifle.rotation.x);
    }
    if (b.state === 'telegraph') {
      rotate(
        'arm_upper_R',
        'x',
        anim.telegraphAngle * Math.min(1, time / definition.telegraphS),
      );
      rotate('arm_lower_R', 'x', anim.elbowAngle);
    } else if (b.state === 'swing') {
      rotate(
        'arm_upper_R',
        'x',
        anim.telegraphAngle +
          (anim.swingAngle - anim.telegraphAngle) *
            Math.min(1, time / definition.swingActiveS),
      );
    } else if (b.state === 'recovery') {
      rotate(
        'arm_upper_R',
        'x',
        anim.swingAngle *
          Math.max(0, 1 - time / Math.max(definition.recoveryS, 1e-6)),
      );
    } else if (b.state === 'stunned') rotate('pelvis', 'z', anim.stunAngle);
    for (const name of rifleman(definition.kind)
      ? ['muzzle', 'visor']
      : definition.animation?.bladeSizeM
        ? ['executor_blade']
        : ['baton_tip']) {
      const tip = this.model.getObjectByName(name);
      const restScale = tip ? this.rest.get(tip)?.scale : undefined;
      if (tip && restScale) {
        const pulse =
          b.state === 'telegraph' || b.state === 'aim'
            ? 1 +
              anim.pulseScale *
                (1 + Math.sin(time * anim.pulseHz * Math.PI * 2))
            : 1;
        tip.scale.set(
          restScale.x * pulse,
          restScale.y * pulse,
          restScale.z * pulse,
        );
      }
    }
  }

  private strideFor(name: string): number {
    const anim = this.enemy.definition.animation;
    const perClip = anim?.clipStrideM?.[name as 'Walk_Loop' | 'Jog_Fwd_Loop'];
    return perClip ?? anim?.strideM ?? this.enemy.definition.moveSpeed;
  }

  /** Zegar snapshotu pochodzi z dt świata, już po Skupieniu i hitstopie. */
  private prepareAnimation(alpha: number): void {
    const { previous: a, current: b, definition } = this.enemy;
    const time =
      a.state === b.state
        ? a.stateTimeS + (b.stateTimeS - a.stateTimeS) * alpha
        : b.stateTimeS;
    const sameState = this.animationState === b.state;
    const dt = sameState
      ? Math.max(0, time - this.animationTimeS)
      : Math.max(0, time);
    this.animationState = b.state;
    this.animationTimeS = time;
    const selection = selectEnemyAnimation(definition, b);
    const next = this.actions.get(selection.clip);
    if (!next) return;
    const clip = next.getClip();
    const shot =
      b.state === 'burst' &&
      b.shotTimeS !== undefined &&
      (this.shotTimeS === undefined || b.shotTimeS < this.shotTimeS);
    this.shotTimeS = b.shotTimeS;
    const continued = selection.continues === true && next === this.action;
    if (!continued && (next !== this.action || !sameState || shot)) {
      const old = this.action;
      next.reset();
      if (selection.segment) next.time = selection.segment.from * clip.duration;
      next.setLoop(selection.once ? LoopOnce : LoopRepeat, Infinity);
      next.clampWhenFinished = selection.once;
      next.setEffectiveWeight(1).play();
      if (old && old !== next)
        next.crossFadeFrom(
          old,
          selection.once
            ? tuning.enemies.animationActionFadeS
            : tuning.enemies.animationFadeS,
          false,
        );
      this.action = next;
    }
    const segment = selection.segment;
    next.setEffectiveTimeScale(
      segment
        ? ((segment.to - segment.from) * clip.duration) /
            Math.max(segment.spanS, 1e-6)
        : selection.moving
          ? (clip.duration * b.speed) / this.strideFor(selection.clip)
          : selection.durationS && selection.once
            ? clip.duration / selection.durationS
            : 1,
    );
    // Nie nadrabiamy czasu poza kadrem. Callback wykonuje się tylko dla widocznej siatki,
    // raz na render, także gdy outline i bloom rysują tę samą siatkę ponownie.
    this.pendingAnimationS = dt;
    this.animationPending = this.root.visible;
  }

  private advanceAnimation(): void {
    if (!this.animationPending || !this.mixer) return;
    this.animationPending = false;
    this.mixer.update(this.pendingAnimationS);
    this.model.updateWorldMatrix(true, true);
    this.heldShield?.update();
    // Renderer zbiera listę obiektów przed onBeforeRender; odśwież też jego macierze skina.
    for (const skin of this.skins) skin.skeleton.update();
  }

  dispose(): void {
    this.disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
    for (const skin of this.skins) skin.skeleton.dispose();
    this.actions.clear();
    this.skins.length = 0;
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.fallbackGeometries) geometry.dispose();
    this.laser?.geometry.dispose();
    this.rest.clear();
  }
}
