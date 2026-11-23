import {
  AdditiveBlending,
  AnimationMixer,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry as PointsGeometry,
  CylinderGeometry,
  Color,
  Euler,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SkinnedMesh,
  Sphere,
  TorusGeometry,
  Vector3,
} from 'three';
import type {
  AnimationAction,
  BufferGeometry,
  Object3D,
  Material,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { tuning } from '../core/tuning';
import { loadSettings } from '../core/save';
import { PIERCE_BLOCK_TAG } from '../combat/damage';
import { gaitWeights, rifleman, selectEnemyAnimation } from './enemyAnimation';
import { angleDelta } from './locomotion';
import { knockdownFrame } from './enemyKnockdown';
import { HeldShield, ShieldHeadClearance } from './heldShield';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle, getMaterial } from '../render/materials';
import type { Enemy } from './types';

const laserLocal = new Vector3();
/** Boss: przezroczystość tarczy energetycznej i grubość jej ramy [m]. */
const BOSS_SHIELD_OPACITY = 0.18;
const BOSS_SHIELD_BAR_M = 0.07;
/** Pierścień korony bossa w metrach modelu Egzekutora: promień, wysokość środka, odsunięcie w tył. */
const BOSS_HALO: [number, number, number] = [0.36, 2.02, -0.3];
const laserFrom = new Vector3();
const knockAxis = new Vector3();
const knockPivot = new Vector3();
const knockQuat = new Quaternion();
const spineWorld = new Quaternion();
const aimAxis = new Vector3();

const up = new Vector3(0, 1, 0);
const templates = new Map<string, Promise<Object3D | null>>();
/** Domyślny model archetypu, gdy dane nie podają pola model. */
const defaultModel = (kind: string): string =>
  rifleman({ kind }) ? 'enemy_gunner' : 'enemy_trooper';
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
      markGlowNoOutline(scene);
      for (const material of materials) material.dispose();
      return scene;
    })
    .catch(() => null);
  templates.set(name, template);
  return template;
}

/**
 * Świecące akcenty (wizjery, linie światła, ostrze, laser) nie dostają konturu: ciemna obwódka
 * gasiła je z odległości, a bez niej czytają się jak źródło światła z bloomem.
 */
export function markGlowNoOutline(root: Object3D): void {
  const glow = getMaterial('enemyGlow');
  root.traverse((node) => {
    if (node instanceof Mesh && node.material === glow)
      node.userData.noOutline = true;
  });
}

/** Geometria GLB i materiały stylu należą do cache, pozy węzłów do pojedynczego widoku. */
export class EnemyView {
  readonly root = new Group();
  private model = new Group();
  private disposed = false;
  private mixer?: AnimationMixer;
  private action?: AnimationAction;
  private gait?: AnimationAction[];
  private gaitFade = 0;
  private spine?: Object3D;
  private torsoYaw = 0;
  private readonly spinePose = new Quaternion();
  private appliedAim = false;
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
  private readonly shieldRest = new Vector3();
  private heldShield?: HeldShield;
  private shieldHeadClearance?: ShieldHeadClearance;
  private readonly fallbackGeometries: BufferGeometry[] = [];
  private readonly heavyMaterials = new Map<
    Mesh,
    {
      original: Material | Material[];
      clones: Material[];
    }
  >();
  private readonly heavyColor = new Color();
  private readonly heavyEndColor = new Color();
  private shieldMaterial?: MeshBasicMaterial;
  /** Iskry lądowania z kip-upu (kosmetyka; prędkości losowane przy każdym lądowaniu). */
  private sparks?: Points<PointsGeometry, PointsMaterial>;
  private sparkVelocity: number[] = [];
  private sparkSeeded = false;
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
    if (rifleman(enemy.definition))
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
          rifleman(this.enemy.definition) ? 'rifle' : 'baton',
          { x: 0, y: 0, z: body.halfHeight },
          { x: body.radius / 2, y: body.radius / 2, z: body.halfHeight * 2 },
        );
        part(
          baton,
          rifleman(this.enemy.definition) ? 'muzzle' : 'baton_tip',
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
      this.fallbackShield = new Mesh(
        geometry,
        enemy.definition.boss
          ? this.energyShieldMaterial()
          : getMaterial('enemy'),
      );
      this.shield = this.fallbackShield;
      this.shield.name = 'shield';
      if (enemy.definition.boss)
        this.frameEnergyShield(this.fallbackShield, shieldSize);
      this.shield.position.set(
        body.radius,
        body.centerY,
        body.radius + shieldSize.z / 2,
      );
      this.shieldRest.copy(this.shield.position);
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
      this.laser.userData.noOutline = true;
      this.laser.visible = false;
      this.root.add(this.laser);
    }
    if (loadModels)
      void loadEnemyModel(
        enemy.definition.model ?? defaultModel(enemy.definition.kind),
      ).then((source) => {
        if (!source || this.disposed) return;
        this.restoreHeavyMaterials();
        this.root.remove(this.model);
        this.model = new Group();
        this.model.scale.setScalar(enemy.definition.boss?.modelScale ?? 1);
        const instance = clone(source);
        this.spine = instance.getObjectByName('DEF-spine003');
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
        if (enemy.definition.boss) {
          if (rifleman(enemy.definition)) {
            for (const name of ['monocle', 'collar', 'shoulder_pad_L']) {
              const plate = instance.getObjectByName(name);
              if (plate instanceof Mesh)
                plate.material = getMaterial('enemyGlow');
            }
            markGlowNoOutline(instance);
          } else this.decorateBoss(instance);
        }
        this.useModelShield();
        this.equipBlade();
        this.captureRest();
      });
  }

  /** Tarcza energetyczna bossa: półprzezroczysta czerwień bez zapisu głębi (gracz widzi bossa za nią). */
  private energyShieldMaterial(): MeshBasicMaterial {
    this.shieldMaterial = new MeshBasicMaterial({
      color: getMaterial('enemyGlow').color,
      transparent: true,
      opacity: BOSS_SHIELD_OPACITY,
      depthWrite: false,
      toneMapped: false,
    });
    return this.shieldMaterial;
  }

  /** Świecąca rama i pasy skanu na krawędziach tarczy (te same wymiary co bryła z danych). */
  private frameEnergyShield(
    shield: Mesh,
    size: { x: number; y: number; z: number },
  ): void {
    shield.userData.noOutline = true;
    const bar = BOSS_SHIELD_BAR_M;
    const depth = size.z * 1.2;
    const bars: [number, number, number, number, number][] = [
      [size.x + bar, bar, 0, size.y / 2, 0],
      [size.x + bar, bar, 0, -size.y / 2, 0],
      [bar, size.y, size.x / 2, 0, 0],
      [bar, size.y, -size.x / 2, 0, 0],
      [size.x, bar * 0.4, 0, size.y / 6, 0],
      [size.x, bar * 0.4, 0, -size.y / 6, 0],
    ];
    for (const [w, h, x, y, z] of bars) {
      const geometry = new BoxGeometry(w, h, depth);
      this.fallbackGeometries.push(geometry);
      const mesh = new Mesh(geometry, getMaterial('enemyGlow'));
      mesh.name = 'shield_frame';
      mesh.userData.noOutline = true;
      mesh.position.set(x, y, z);
      shield.add(mesh);
    }
  }

  /**
   * Boss dzieli model z Egzekutorem; wyróżnia go korona ostrzy z czerwonym pierścieniem za głową
   * i peleryna z płyt. Części siedzą na kości tułowia (ruszają się z klipami), układ w metrach modelu.
   */
  private decorateBoss(instance: Object3D): void {
    instance.updateWorldMatrix(true, true);
    const spine = instance.getObjectByName('DEF-spine003');
    if (!spine) return;
    const toInstance = new Matrix4().copy(instance.matrixWorld).invert();
    const boneInverse = toInstance.multiply(spine.matrixWorld).invert();
    const place = (
      geometry: BufferGeometry,
      kind: 'enemy' | 'enemyDark' | 'enemyGlow',
      position: [number, number, number],
      rotation: [number, number, number] = [0, 0, 0],
      parent?: Object3D,
    ): Mesh => {
      this.fallbackGeometries.push(geometry);
      const mesh = new Mesh(geometry, getMaterial(kind));
      mesh.name = 'boss_decor';
      if (kind === 'enemyGlow') mesh.userData.noOutline = true;
      if (parent) {
        mesh.position.set(...position);
        mesh.rotation.set(...rotation);
        parent.add(mesh);
        return mesh;
      }
      new Matrix4()
        .copy(boneInverse)
        .multiply(
          new Matrix4()
            .makeRotationFromEuler(new Euler(...rotation))
            .setPosition(...position),
        )
        .decompose(mesh.position, mesh.quaternion, mesh.scale);
      spine.add(mesh);
      return mesh;
    };
    const [hx, hy, hz] = BOSS_HALO;
    place(new TorusGeometry(hx, 0.04, 4, 32), 'enemyGlow', [0, hy, hz]);
    place(new TorusGeometry(hx * 0.8, 0.028, 4, 24), 'enemyDark', [0, hy, hz]);
    for (let i = 0; i < 7; i++) {
      const angle = Math.PI * (0.12 + (0.76 * i) / 6);
      const length = i === 3 ? 0.3 : 0.2;
      const r = hx + 0.03 + length / 2;
      place(
        new CylinderGeometry(0.006, 0.045, length, 4),
        'enemy',
        [Math.cos(angle) * r, hy + Math.sin(angle) * r, hz - 0.01],
        [0, 0, angle - Math.PI / 2],
      );
    }
    for (const side of [-1, 1]) {
      const cape = place(
        new BoxGeometry(0.36, 1.05, 0.04),
        'enemyDark',
        [side * 0.19, 1.2, -0.27],
        [0.16, 0, side * 0.05],
      );
      place(
        new BoxGeometry(0.34, 0.03, 0.05),
        'enemyGlow',
        [0, -0.5, 0],
        [0, 0, 0],
        cape,
      );
      place(
        new BoxGeometry(0.03, 0.9, 0.05),
        'enemyGlow',
        [side * 0.16, 0, 0],
        [0, 0, 0],
        cape,
      );
    }
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
    const helmet = this.model.getObjectByName('helmet');
    if (this.heldShield && helmet)
      this.shieldHeadClearance = new ShieldHeadClearance(
        node,
        helmet,
        this.root,
        () => tuning.enemies.shieldHeadClearanceM,
      );
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
    blade.userData.noOutline = true;
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
    // Lufa leży w układzie celowania (aimYaw), a korzeń widoku obraca bodyYaw.
    const sin = Math.sin(this.torsoYaw),
      cos = Math.cos(this.torsoYaw);
    const from = laserFrom.set(
      m.x * cos + m.z * sin,
      m.y,
      m.z * cos - m.x * sin,
    );
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
    const aimYaw = a.yaw + delta * t;
    const oldBody = a.bodyYaw ?? a.yaw;
    const bodyYaw = oldBody + angleDelta(oldBody, b.bodyYaw ?? b.yaw) * t;
    this.root.rotation.y = this.spine || !this.mixer ? bodyYaw : aimYaw;
    this.torsoYaw = angleDelta(this.root.rotation.y, aimYaw);
    if (this.fallbackShield && this.shield === this.fallbackShield) {
      // Tarcza zastępcza blokuje zgodnie z kierunkiem celowania, nie korpusu.
      const sin = Math.sin(this.torsoYaw),
        cos = Math.cos(this.torsoYaw);
      const rest = this.shieldRest;
      this.fallbackShield.position.set(
        rest.x * cos + rest.z * sin,
        rest.y,
        rest.z * cos - rest.x * sin,
      );
      this.fallbackShield.rotation.y = this.torsoYaw;
    }
    this.root.visible = b.state !== 'dead' && !this.enemy.removed;
    this.applyKnockdown();
    if (!b.knockdown && !b.controlled)
      this.model.rotation.z +=
        (a.lean ?? 0) + ((b.lean ?? 0) - (a.lean ?? 0)) * t;
    if (this.shield) this.shield.visible = b.shieldUp === true;
    this.renderLaser();
    const heavy =
      b.state === 'telegraph' &&
      definition.attackTags?.includes(PIERCE_BLOCK_TAG) === true;
    const flashes = loadSettings().flashes;
    this.updateHeavyMaterials(
      heavy,
      b.stateTimeS / Math.max(definition.telegraphS, Number.EPSILON),
    );
    const anim = definition.animation;
    if (this.mixer) this.prepareAnimation(t);
    if (!anim) return;
    for (const [node, rest] of this.rest) {
      if (this.mixer && (node.type === 'Bone' || node instanceof SkinnedMesh))
        continue;
      // Korzeń modelu ustawia przewrócenie (applyKnockdown), nie poza spoczynkowa.
      if (node === this.model) continue;
      node.rotation.set(rest.x, rest.y, rest.z);
      node.position.copy(rest.position);
      node.scale.copy(rest.scale);
    }
    const torso = this.model.getObjectByName('torso');
    if (!this.mixer && torso) torso.rotation.y += this.torsoYaw;
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
      Math.min(1, (a.speed + (b.speed - a.speed) * t) / definition.moveSpeed);
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
      rifleman(definition) &&
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
    // Zapowiedź: rozbłysk wizjera i broni (skala), widoczny także z daleka.
    for (const name of rifleman(definition)
      ? ['muzzle', 'visor']
      : definition.animation?.bladeSizeM
        ? ['executor_blade', 'visor', 'chest_core']
        : ['baton_tip', 'visor']) {
      const tip = this.model.getObjectByName(name);
      const restScale = tip ? this.rest.get(tip)?.scale : undefined;
      if (tip && restScale) {
        const pulse =
          b.state === 'telegraph' || b.state === 'aim'
            ? 1 +
              anim.pulseScale *
                (1 +
                  (flashes
                    ? Math.sin(
                        time *
                          anim.pulseHz *
                          (heavy
                            ? tuning.vfx.heavyTelegraphPulseMultiplier
                            : 1) *
                          Math.PI *
                          2,
                      )
                    : 0))
            : 1;
        tip.scale.set(
          restScale.x * pulse,
          restScale.y * pulse,
          restScale.z * pulse,
        );
      }
    }
  }

  private restoreHeavyMaterials(): void {
    for (const [mesh, { original, clones }] of this.heavyMaterials) {
      mesh.material = original;
      for (const material of clones) material.dispose();
    }
    this.heavyMaterials.clear();
  }

  private updateHeavyMaterials(active: boolean, progress: number): void {
    if (!active) {
      this.restoreHeavyMaterials();
      return;
    }
    const k = tuning.vfx;
    const white = Math.max(
      0,
      Math.min(
        1,
        (progress - (1 - k.heavyTelegraphEndFraction)) /
          Math.max(k.heavyTelegraphEndFraction, Number.EPSILON),
      ),
    );
    this.heavyColor
      .set(k.heavyTelegraphColor)
      .lerp(this.heavyEndColor.set(k.heavyTelegraphEndColor), white);
    for (const name of ['visor', 'baton_tip', 'executor_blade', 'chest_core']) {
      this.model.getObjectByName(name)?.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        let entry = this.heavyMaterials.get(node);
        if (!entry) {
          const original = node.material as Material | Material[];
          const clones = (Array.isArray(original) ? original : [original]).map(
            (material) => {
              const cloned = material.clone();
              cloned.onBeforeCompile = material.onBeforeCompile;
              cloned.customProgramCacheKey = material.customProgramCacheKey;
              return cloned;
            },
          );
          entry = { original, clones };
          this.heavyMaterials.set(node, entry);
          node.material = Array.isArray(original) ? clones : clones[0]!;
        }
        for (const material of entry.clones) {
          if ('color' in material && material.color instanceof Color)
            material.color.copy(this.heavyColor);
          if ('emissive' in material && material.emissive instanceof Color)
            material.emissive.copy(this.heavyColor);
        }
      });
    }
  }

  /**
   * Przewrócenie przy mocnym odrzucie: obrót korzenia modelu wokół bioder w kierunku odrzutu
   * (upadek na plecy), obniżenie do ziemi, potem kip-up z podskokiem i lądowaniem. Poza
   * przewróceniem model wraca do pozy bazowej. Hitbox (kapsuła symulacji) bez zmian.
   */
  private applyKnockdown(): void {
    const { current: b, definition } = this.enemy;
    const k = tuning.vfx.enemyKnockdown;
    const pose = knockdownFrame(definition, b, k);
    const baseScale = definition.boss?.modelScale ?? 1;
    if (!pose || !b.knockdown) {
      this.model.position.set(0, 0, 0);
      this.model.quaternion.identity();
      this.model.scale.setScalar(baseScale);
      this.sparkSeeded = false;
      if (this.sparks) this.sparks.visible = false;
      return;
    }
    // Kierunek odrzutu w układzie korzenia (korzeń obrócony o yaw).
    const yaw = this.root.rotation.y;
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const lx = b.knockdown.x * c - b.knockdown.z * s;
    const lz = b.knockdown.x * s + b.knockdown.z * c;
    // Oś obrotu prostopadła do kierunku: głowa leci w stronę odrzutu.
    knockAxis.set(lz, 0, -lx).normalize();
    const tilt = (pose.tiltDeg * Math.PI) / 180;
    knockQuat.setFromAxisAngle(knockAxis, tilt);
    const hip = definition.body?.centerY ?? 0.9;
    const lower = -(hip - k.lieRestM) * Math.max(0, Math.sin(tilt));
    // Obrót wokół bioder: pozycja = (0, biodra + przesunięcie) − R·(0, biodra, 0).
    knockPivot.set(0, hip, 0).applyQuaternion(knockQuat);
    this.model.quaternion.copy(knockQuat);
    this.model.position.set(
      -knockPivot.x,
      hip + lower + pose.liftM - knockPivot.y,
      -knockPivot.z,
    );
    const widen = 1 + (1 - pose.squash) * 0.5;
    this.model.scale.set(
      baseScale * widen,
      baseScale * pose.squash,
      baseScale * widen,
    );
    this.renderLandingSparks(pose.landedAgoS);
  }

  private renderLandingSparks(agoS: number | null): void {
    const k = tuning.vfx.enemyKnockdown;
    if (agoS === null || agoS > k.sparkS || k.sparks <= 0) {
      if (this.sparks) this.sparks.visible = false;
      if (agoS === null) this.sparkSeeded = false;
      return;
    }
    const count = Math.floor(k.sparks);
    if (!this.sparks || this.sparkVelocity.length !== count * 3) {
      if (this.sparks) {
        this.root.remove(this.sparks);
        this.sparks.geometry.dispose();
        this.sparks.material.dispose();
      }
      const geometry = new PointsGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(count * 3), 3),
      );
      const material = new PointsMaterial({
        color: k.sparkColor,
        size: k.sparkSize,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      this.sparks = new Points(geometry, material);
      this.sparks.frustumCulled = false;
      this.sparks.userData.noOutline = true;
      this.root.add(this.sparks);
      this.sparkVelocity = new Array<number>(count * 3).fill(0);
      this.sparkSeeded = false;
    }
    if (!this.sparkSeeded) {
      // Pył i iskry spod stóp: rozprysk po ziemi, lekko w górę; rozrzut z id wroga (bez Math.random).
      const rand = (n: number): number => {
        const x = Math.sin(n * 12.9898 + this.enemy.id * 78.233) * 43758.5453;
        return x - Math.floor(x);
      };
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand(i * 3 + 0) * 0.4;
        const speed = k.sparkSpeed * (0.55 + 0.45 * rand(i * 3 + 1));
        this.sparkVelocity[i * 3] = Math.cos(angle) * speed;
        this.sparkVelocity[i * 3 + 1] = 0.8 + rand(i * 3 + 2) * 1.2;
        this.sparkVelocity[i * 3 + 2] = Math.sin(angle) * speed;
      }
      this.sparkSeeded = true;
    }
    const position = this.sparks.geometry.getAttribute(
      'position',
    ) as BufferAttribute;
    for (let i = 0; i < count; i++)
      position.setXYZ(
        i,
        this.sparkVelocity[i * 3]! * agoS,
        Math.max(
          0.02,
          0.05 + this.sparkVelocity[i * 3 + 1]! * agoS - 4.9 * agoS * agoS,
        ),
        this.sparkVelocity[i * 3 + 2]! * agoS,
      );
    position.needsUpdate = true;
    this.sparks.material.opacity = 1 - agoS / k.sparkS;
    this.sparks.visible = true;
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
    this.pendingAnimationS = dt;
    this.animationPending = this.root.visible;
    const selection = selectEnemyAnimation(definition, b);
    const locomotion =
      !b.attack &&
      !b.controlled &&
      (b.state === 'idle' || b.state === 'chase' || b.state === 'reposition');
    if (locomotion && !this.gait) {
      const clips = [
        rifleman(definition) ? 'Pistol_Idle_Loop' : 'Idle_Loop',
        'Walk_Loop',
        'Jog_Fwd_Loop',
      ];
      const actions = clips.map((name) => this.actions.get(name));
      if (actions.every((a): a is AnimationAction => !!a)) {
        this.gait = actions;
        // Aktywny klip spoczynkowy jest częścią chodu: bez zanikania, inaczej suma wag spada do 0.
        const inGait = !!this.action && actions.includes(this.action);
        this.gaitFade = this.action && !inGait ? 0 : 1;
        if (!inGait) this.action?.fadeOut(tuning.enemies.animationFadeS);
        const active = this.action;
        this.action = undefined;
        for (const action of actions)
          (action === active && inGait ? action.stopFading() : action.reset())
            .setLoop(LoopRepeat, Infinity)
            .play();
      }
    }
    if (this.gait && locomotion) {
      const speed = a.speed + (b.speed - a.speed) * alpha;
      const weights = gaitWeights(
        speed,
        definition.moveSpeed,
        definition.animation?.jogFromSpeedFrac ?? 0.5,
      );
      this.gaitFade = Math.min(
        1,
        this.gaitFade + dt / Math.max(1e-6, tuning.enemies.animationFadeS),
      );
      this.gait.forEach((action, i) => {
        const clip = action.getClip();
        action.setEffectiveWeight(weights[i]! * this.gaitFade);
        action.setEffectiveTimeScale(
          i === 0 ? 1 : (clip.duration * speed) / this.strideFor(clip.name),
        );
      });
      return;
    }
    if (this.gait) {
      this.action = this.gait[0];
      for (const action of this.gait.slice(1))
        action.fadeOut(
          selection.once
            ? tuning.enemies.animationActionFadeS
            : tuning.enemies.animationFadeS,
        );
      this.gait = undefined;
    }
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
    if (this.spine && this.appliedAim)
      this.spine.quaternion.copy(this.spinePose);
    this.mixer.update(this.pendingAnimationS);
    if (this.spine) {
      this.spinePose.copy(this.spine.quaternion);
      if (this.torsoYaw) {
        this.spine.getWorldQuaternion(spineWorld).invert();
        aimAxis.copy(up).applyQuaternion(spineWorld);
        this.spine.rotateOnAxis(aimAxis, this.torsoYaw);
      }
      this.appliedAim = true;
    }
    this.model.updateWorldMatrix(true, true);
    this.heldShield?.update();
    this.shieldHeadClearance?.update();
    // Renderer zbiera listę obiektów przed onBeforeRender; odśwież też jego macierze skina.
    for (const skin of this.skins) skin.skeleton.update();
  }

  dispose(): void {
    this.disposed = true;
    this.restoreHeavyMaterials();
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
    this.shieldMaterial?.dispose();
    this.sparks?.geometry.dispose();
    this.sparks?.material.dispose();
    this.laser?.geometry.dispose();
    this.rest.clear();
  }
}
