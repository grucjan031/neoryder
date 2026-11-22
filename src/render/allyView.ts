import {
  AnimationMixer,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  RingGeometry,
  SkinnedMesh,
  SphereGeometry,
  Vector3,
} from 'three';
import type {
  AnimationAction,
  AnimationClip,
  BufferGeometry,
  Material,
  Object3D,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AllySnapshot } from '../allies/ally';
import type { AllyDefinition } from '../allies/allySchema';
import type { AllyPose } from '../allies/squad';
import type { Tuning } from '../core/tuning';
import { loadEnemyModel } from '../enemies/enemyView';
import { inOutfit, loadBody, loadClips } from '../scenes/hubNpcs';
import { getMaterial, gradientMap } from './materials';
import { loadWeaponScene } from './weaponModelLoader';

/** Siatki `npc_civilian.glb` noszone przez każdego sojusznika i warianty góry stroju. */
const BASE_PARTS = ['civ_skin', 'civ_pants', 'civ_boots'];
const TORSO_PARTS: Record<AllyDefinition['look']['torso'], readonly string[]> =
  {
    none: ['top_shirt'],
    vest: ['top_shirt', 'over_vest'],
    jacket: ['top_jacket'],
    hoodie: ['top_hoodie'],
    coat: ['top_coat'],
  };
/** Klipy bojowe pochodzą z modelu Strzelca (ten sam szkielet co `npc_civilian.glb`). */
const COMBAT_MODEL = 'enemy_gunner';
const CLIP = {
  idle: 'Idle_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  aim: 'Pistol_Aim_Neutral',
  ready: 'Pistol_Idle_Loop',
  reviving: 'Crouch_Idle_Loop',
} as const;
const HAND_BONE = 'DEF-hand.R';

/**
 * Widok sojusznika: postać z `npc_civilian.glb` w stroju z danych, broń w dłoni, cyanowy znacznik
 * drużyny nad głową, pasek zdrowia tylko gdy ranny, bursztynowy pierścień przy powalonym.
 * Bez modeli (testy, błąd wczytania) zostaje kapsuła zastępcza.
 */
export class AllyView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly marker: Mesh;
  private readonly bar = new Group();
  private readonly barFill: Mesh;
  private readonly ring: Mesh;
  private readonly flash: Mesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials = new Map<string, Material>();
  private readonly actions = new Map<string, AnimationAction>();
  private readonly scratch = new Vector3();
  private mixer?: AnimationMixer;
  private weapon?: Object3D;
  private current: string | null = null;
  private timeS = 0;
  private disposed = false;

  constructor(
    private readonly tuning: Tuning,
    private readonly definition: AllyDefinition,
  ) {
    const t = tuning.allies;
    this.root.name = `ally:${definition.id}`;
    this.root.add(this.body);
    const capsule = new Mesh(
      this.own(
        new CapsuleGeometry(
          t.colliderRadiusM,
          Math.max(0.01, t.colliderHeightM - 2 * t.colliderRadiusM),
          4,
          10,
        ),
      ),
      getMaterial('interactive'),
    );
    capsule.name = 'allyFallback';
    capsule.position.y = t.colliderHeightM / 2;
    this.body.add(capsule);

    this.marker = new Mesh(
      this.own(new OctahedronGeometry(t.markerSizeM)),
      getMaterial('player'),
    );
    this.marker.name = 'allyMarker';
    this.marker.userData.noOutline = true;
    this.root.add(this.marker);

    const back = new Mesh(
      this.own(new PlaneGeometry(t.hpBarWidthM, t.hpBarHeightM)),
      this.flat(t.hpBarBackColor),
    );
    this.barFill = new Mesh(
      this.own(new PlaneGeometry(t.hpBarWidthM, t.hpBarHeightM * 0.6)),
      this.flat(t.hpBarColor),
    );
    this.barFill.position.z = 0.002;
    for (const mesh of [back, this.barFill]) mesh.userData.noOutline = true;
    this.bar.add(back, this.barFill);
    this.bar.name = 'allyHpBar';
    this.bar.position.y = t.markerHeightM - t.markerSizeM * 2.4;
    this.bar.visible = false;
    this.root.add(this.bar);

    this.ring = new Mesh(
      this.own(new RingGeometry(t.downedRingM * 0.86, t.downedRingM, 40)),
      getMaterial('neon_amber'),
    );
    this.ring.name = 'allyDownedRing';
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.05;
    this.ring.userData.noOutline = true;
    this.ring.visible = false;
    this.root.add(this.ring);

    this.flash = new Mesh(
      this.own(new SphereGeometry(t.shotFlashM, 8, 6)),
      getMaterial('neon_white'),
    );
    this.flash.name = 'allyMuzzleFlash';
    this.flash.userData.noOutline = true;
    this.flash.position.set(0, t.muzzleM, t.muzzleForwardM + t.shotFlashM * 2);
    this.flash.visible = false;
    this.root.add(this.flash);
  }

  /** Podmienia kapsułę na postać z bronią; przy błędzie wczytania zostaje kapsuła. */
  async load(): Promise<void> {
    const [template, clips, combat, weapon] = await Promise.all([
      loadBody(),
      loadClips(),
      loadEnemyModel(COMBAT_MODEL),
      loadWeaponScene(this.definition.weapon.model).catch(() => null),
    ]);
    if (this.disposed || !template) return;
    const look = this.definition.look;
    const parts = [...BASE_PARTS, ...TORSO_PARTS[look.torso], ...look.parts];
    const instance = clone(template);
    const unused: Object3D[] = [];
    instance.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!inOutfit(node.name, parts)) {
        unused.push(node);
        return;
      }
      node.material = this.cloth(
        (node.material as Material).name,
        node.name.includes('__accent'),
      );
      if (node instanceof SkinnedMesh) node.frustumCulled = false;
    });
    for (const node of unused) node.removeFromParent();
    this.body.clear();
    this.body.add(instance);
    const mixer = new AnimationMixer(instance);
    const library: AnimationClip[] = [
      ...clips,
      ...(combat?.animations ?? []).filter(
        (clip) => clip.name === CLIP.aim || clip.name === CLIP.ready,
      ),
    ];
    for (const clip of library) {
      if (this.actions.has(clip.name)) continue;
      const action = mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      this.actions.set(clip.name, action);
    }
    this.mixer = mixer;
    this.current = null;
    const hand = instance.getObjectByName(HAND_BONE);
    if (weapon && hand) {
      const grip = this.tuning.allies.weaponGrip;
      const holder = new Group();
      holder.name = 'allyWeapon';
      holder.add(weapon);
      hand.add(holder);
      // Kość ma własną skalę szkieletu: broń wraca do metrów świata.
      hand.updateWorldMatrix(true, false);
      const scale = hand.getWorldScale(this.scratch).x || 1;
      holder.scale.setScalar(grip.scale / scale);
      holder.position.set(grip.x / scale, grip.y / scale, grip.z / scale);
      holder.rotation.set(grip.rotX, grip.rotY, grip.rotZ);
      this.weapon = holder;
    }
  }

  /** `camera`: pozycja kamery do obrócenia paska zdrowia; `frameDt` napędza animacje. */
  update(
    pose: AllyPose,
    snapshot: AllySnapshot,
    frameDt: number,
    camera?: { x: number; y: number; z: number },
  ): void {
    const t = this.tuning.allies;
    this.timeS += frameDt;
    this.root.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.root.rotation.y = pose.yaw;
    this.root.visible = !snapshot.evacuated;
    const lying = snapshot.state === 'downed';
    const kneeling = snapshot.state === 'reviving';
    const down = lying || kneeling;
    // Powalony leży na plecach; podnoszony klęka (klip przykucu).
    this.body.rotation.x = lying ? -Math.PI / 2 : 0;
    this.body.position.y = lying ? t.downedLiftM : 0;
    this.play(
      lying
        ? CLIP.idle
        : kneeling
          ? CLIP.reviving
          : snapshot.motion === 'run'
            ? CLIP.run
            : snapshot.motion === 'walk'
              ? CLIP.walk
              : snapshot.aiming
                ? CLIP.aim
                : snapshot.state === 'engage' || snapshot.state === 'takeCover'
                  ? CLIP.ready
                  : CLIP.idle,
    );
    this.mixer?.update(frameDt);
    if (this.weapon) this.weapon.visible = !down;

    const pulse =
      1 + 0.25 * Math.sin(this.timeS * Math.PI * 2 * t.downedPulseHz);
    this.marker.material = getMaterial(down ? 'neon_amber' : 'player');
    this.marker.position.y = down ? t.downedMarkerM : t.markerHeightM;
    this.marker.rotation.y = this.timeS * 1.5 - pose.yaw;
    this.marker.scale.setScalar(down ? pulse * 1.4 : 1);
    this.ring.visible = down;
    this.ring.scale.setScalar(down ? pulse : 1);
    this.flash.visible =
      !down && snapshot.shotS !== null && snapshot.shotS <= t.shotFlashS;

    const fraction =
      snapshot.maxHp > 0 ? Math.max(0, snapshot.hp / snapshot.maxHp) : 0;
    this.bar.visible = !down && fraction < 1;
    if (this.bar.visible) {
      this.barFill.scale.x = Math.max(0.001, fraction);
      this.barFill.position.x = (-t.hpBarWidthM * (1 - fraction)) / 2;
      if (camera)
        this.bar.rotation.y =
          Math.atan2(camera.x - pose.position.x, camera.z - pose.position.z) -
          pose.yaw;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
  }

  private own<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private play(clip: string): void {
    if (clip === this.current || !this.mixer) return;
    const next = this.actions.get(clip) ?? this.actions.get(CLIP.idle);
    if (!next) return;
    const fade = this.tuning.allies.animFadeS;
    this.actions.get(this.current ?? '')?.fadeOut(fade);
    this.current = clip;
    next.reset().fadeIn(fade).play();
  }

  private flat(color: string): Material {
    const key = `flat:${color}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshBasicMaterial({
        color: new Color(color),
        toneMapped: false,
        side: DoubleSide,
      });
      this.materials.set(key, material);
    }
    return material;
  }

  /** Materiał tkaniny po nazwie materiału z modelu; kolory stroju z danych sojusznika. */
  private cloth(name: string, accent: boolean): Material {
    const hub = this.tuning.hub;
    const look = this.definition.look;
    const color = accent
      ? look.accentColor
      : name === 'mat_npc_pants'
        ? look.pantsColor
        : name === 'mat_npc_boots'
          ? hub.npcBootsColor
          : name === 'mat_npc_skin'
            ? hub.npcSkinColor
            : name === 'mat_npc_shirt' || name === 'mat_npc_outer'
              ? look.outerColor
              : hub.npcGearColor;
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
}
