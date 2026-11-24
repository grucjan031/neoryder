import {
  AnimationMixer,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  LoopRepeat,
  Mesh,
  MeshToonMaterial,
  Quaternion,
  SkinnedMesh,
  SphereGeometry,
} from 'three';
import type {
  AnimationAction,
  BufferGeometry,
  Material,
  Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AmbienceSource } from '../audio/ambienceSchema';
import type { GameContext } from '../core/context';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import type { PlayerState } from '../player/playerController';
import { gradientMap } from '../render/materials';
import type { catState } from './hubCutaway';
import { HubFaunaRuntime } from '../world/hubFauna';
import { hubInteractions } from '../world/hubInteractions';
import type { CatRuntime, FaunaPose } from '../world/hubFauna';
import { wrapAngle } from '../world/hubNpcs';
import type { HubLayout } from '../world/hubSchema';
import type { HubFocusBox } from '../world/hubStations';

interface AnimalView {
  root: Group;
  legs: Group[];
  tail: Group[];
}

/** Klipy `hub_cat.glb` (Blender, `build_hub_cat`). */
export type CatClip = 'idle' | 'walk' | 'sit' | 'lie' | 'groom';

/** Klip i tempo odtwarzania dla stanu kota (zachowanie w `HubFaunaRuntime` bez zmian). */
export function catClip(
  cat: Pick<CatRuntime, 'state' | 'moving'>,
  t: Tuning['hub'],
  routeSpeedMS = t.catSpeedMS,
): { clip: CatClip; timeScale: number } {
  switch (cat.state) {
    case 'sit':
    case 'lie':
    case 'groom':
      return { clip: cat.state, timeScale: 1 };
    default: {
      if (!cat.moving) return { clip: 'idle', timeScale: 1 };
      const speed =
        cat.state === 'flee' || cat.state === 'return'
          ? t.catFleeSpeedMS
          : routeSpeedMS;
      return {
        clip: 'walk',
        timeScale: Math.min(
          t.catWalkMaxTimeScale,
          speed / t.catWalkClipSpeedMS,
        ),
      };
    }
  }
}

interface CatView {
  root: Group;
  mixer?: AnimationMixer;
  actions: Map<string, AnimationAction>;
  action?: AnimationAction;
  clip?: CatClip;
  head?: { bone: Object3D; animated: Quaternion };
  /** Czas symulacji (s) ostatniej aktualizacji mixera. */
  time: number;
}

const loader = new GLTFLoader();

/**
 * Kot Węgielek: model `hub_cat.glb` ze szkieletem i klipami (idle, walk, sit, lie, groom).
 * Szczury: proceduralne siatki ze współdzielonych geometrii; dwa szczury są ukrywane, nigdy tworzone podczas ruchu.
 */
export class HubFauna {
  readonly runtime: HubFaunaRuntime;
  readonly sources: AmbienceSource[];
  private readonly root = new Group();
  private readonly geometries: BufferGeometry[];
  private readonly fur: MeshToonMaterial;
  private readonly ratFur: MeshToonMaterial;
  private readonly eyes: MeshToonMaterial;
  private readonly cat: CatView | null;
  private readonly handRotation = new Euler();
  private readonly headTilt = new Quaternion();
  private readonly rats: AnimalView[];
  private readonly off: (() => void)[] = [];
  private disposed = false;

  constructor(
    private readonly ctx: GameContext,
    parent: Object3D,
    private readonly layout: HubLayout,
    private readonly player: () => PlayerState,
  ) {
    this.runtime = new HubFaunaRuntime(
      layout,
      ctx.rng.fork('hub-fauna'),
      ctx.tuning.hub,
      ctx.bus,
    );
    const t = ctx.tuning.hub;
    this.geometries = [
      new SphereGeometry(1, 8, 6),
      new CylinderGeometry(1, 1, 1, 6),
    ];
    this.fur = new MeshToonMaterial({
      color: t.catColor,
      gradientMap: gradientMap,
    });
    this.ratFur = new MeshToonMaterial({
      color: t.ratColor,
      gradientMap: gradientMap,
    });
    const rim = { value: new Color(t.faunaRimColor) };
    const strength = { value: t.catRimGain };
    this.fur.onBeforeCompile = (shader) => {
      shader.uniforms.faunaRimColor = rim;
      shader.uniforms.faunaRimGain = strength;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform vec3 faunaRimColor;\nuniform float faunaRimGain;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
        totalEmissiveRadiance += faunaRimColor * faunaRimGain * pow(max(0.0, 1.0-abs(dot(normal, normalize(vViewPosition)))), 3.0);`,
        );
    };
    this.fur.customProgramCacheKey = () => 'hubFaunaRim';
    this.eyes = new MeshToonMaterial({
      color: t.catEyeColor,
      emissive: t.catEyeColor,
      emissiveIntensity: t.catEyeGain,
    });
    this.cat = this.runtime.cat
      ? { root: new Group(), actions: new Map(), time: 0 }
      : null;
    if (this.cat) {
      this.cat.root.name = 'hub-cat-wegielek';
      this.root.add(this.cat.root);
    }
    this.rats = this.runtime.rats.map(() => this.buildRat());
    this.sources = this.runtime.cat
      ? [
          {
            kind: 'purr',
            position: { ...this.runtime.cat.position },
            radiusM: ctx.tuning.audio.ambienceProfiles.purr.radiusM,
            gain: 0,
          },
        ]
      : [];
    this.root.name = 'hub-fauna';
    parent.add(this.root);
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    register(
      'hub cat',
      'hub cat — pokaż Węgielka 2 m przed graczem',
      (args) => {
        if (args.length) return 'Użycie: hub cat';
        const p = this.player();
        return this.runtime.placeCat(p.position, p.yaw)
          ? 'Węgielek odpoczywa przed graczem.'
          : 'Brak bezpiecznej podłogi i drogi do trasy kota.';
      },
    );
    register(
      'hub rat',
      'hub rat — wymuś przebieg najbliższym wolnym pasem',
      (args) => {
        if (args.length) return 'Użycie: hub rat';
        return this.runtime.forceRat(this.player().position)
          ? 'Szczur przebiega pasem.'
          : 'Pasy zajęte albo gracz stoi przy ich początkach.';
      },
    );
  }

  /** Wczytuje model kota; bez modelu (testy, błąd ładowania) kot nie ma widoku, symulacja i dźwięk działają. */
  async load(): Promise<void> {
    const view = this.cat;
    if (!view) return;
    const gltf = await loader
      .loadAsync('/assets/models/hub_cat.glb')
      .catch(() => null);
    if (!gltf || this.disposed) return;
    const model = gltf.scene;
    const head = model.getObjectByName('head');
    if (head) view.head = { bone: head, animated: head.quaternion.clone() };
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const name = (node.material as Material).name;
      (node.material as Material).dispose();
      node.material = name === 'mat_cat_eye' ? this.eyes : this.fur;
      if (name === 'mat_cat_eye') node.userData.noOutline = true;
      // Kot jest mały: stała sfera zamiast przeliczania granic skórowanej siatki.
      if (node instanceof SkinnedMesh) node.frustumCulled = false;
    });
    view.root.add(model);
    const mixer = new AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      view.actions.set(clip.name, action);
    }
    view.mixer = mixer;
  }

  private buildRat(): AnimalView {
    const root = new Group();
    const material = this.ratFur;
    const add = (
      parent: Object3D,
      geometry: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      mat = material,
    ): Mesh => {
      const mesh = new Mesh(this.geometries[geometry]!, mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };
    add(root, 0, 0, 0.35, 0, 0.16, 0.19, 0.33);
    const head = new Group();
    head.position.set(0, 0.52, 0.28);
    root.add(head);
    add(head, 0, 0, 0, 0, 0.125, 0.12, 0.12);
    for (const side of [-1, 1]) {
      add(head, 0, side * 0.085, 0.115, 0, 0.055, 0.14, 0.045);
      const eye = add(
        head,
        0,
        side * 0.061,
        0.026,
        0.102,
        0.013,
        0.016,
        0.009,
        this.eyes,
      );
      eye.userData.noOutline = true;
    }
    const legs: Group[] = [];
    for (const x of [-0.11, 0.11])
      for (const z of [-0.21, 0.21]) {
        const pivot = new Group();
        pivot.position.set(x, 0.28, z);
        root.add(pivot);
        add(pivot, 0, 0, -0.12, 0, 0.045, 0.15, 0.045);
        legs.push(pivot);
      }
    const tail: Group[] = [];
    let tailParent: Object3D = root;
    for (let i = 0; i < 5; i++) {
      const joint = new Group();
      joint.position.set(0, i === 0 ? 0.4 : 0, i === 0 ? -0.28 : -0.11);
      tailParent.add(joint);
      const segment = add(joint, 1, 0, 0, -0.055, 0.014, 0.12, 0.014);
      segment.rotation.x = Math.PI / 2;
      tail.push(joint);
      tailParent = joint;
    }
    root.scale.setScalar(0.45);
    root.visible = false;
    this.root.add(root);
    return { root, legs, tail };
  }

  step(dt: number, p: PlayerState, petting = false): void {
    const cat = this.runtime.cat;
    if (petting && cat) {
      cat.restLeftS = Math.max(cat.restLeftS, dt * 2);
      cat.fleeCooldownS = Math.max(cat.fleeCooldownS, dt * 2);
    }
    this.runtime.step(dt, p.position, p.velocity);
  }

  petFocus(eye: Vec3): HubFocusBox | null {
    return this.runtime.petFocus(eye);
  }

  get head() {
    return this.cat?.head?.bone;
  }

  pet(): void {
    this.runtime.pet();
  }

  private place(view: { root: Group }, pose: FaunaPose, alpha: number): number {
    view.root.position.set(
      pose.previous.x + (pose.position.x - pose.previous.x) * alpha,
      pose.previous.y + (pose.position.y - pose.previous.y) * alpha,
      pose.previous.z + (pose.position.z - pose.previous.z) * alpha,
    );
    view.root.rotation.y =
      pose.previousYaw + wrapAngle(pose.yaw - pose.previousYaw) * alpha;
    return (
      pose.previousDistance + (pose.distance - pose.previousDistance) * alpha
    );
  }

  render(alpha: number, pet?: ReturnType<typeof catState>): void {
    const t = this.ctx.tuning.hub,
      c = this.runtime.cat,
      view = this.cat;
    this.eyes.emissiveIntensity = t.catEyeGain;
    if (c && view) {
      this.place(view, c, alpha);
      const time = c.previousAgeS + (c.ageS - c.previousAgeS) * alpha;
      const rest =
        c.state === 'sit' || c.state === 'lie' || c.state === 'groom';
      if (view.mixer) {
        const { clip, timeScale } = catClip(
          c,
          t,
          this.layout.fauna?.cat?.speedMS,
        );
        if (clip !== view.clip) {
          const action = view.actions.get(clip);
          if (action) {
            action.reset().setEffectiveWeight(1).play();
            if (view.action)
              view.action.crossFadeTo(action, t.catAnimFadeS, false);
            view.action = action;
            view.clip = clip;
          }
        }
        view.action?.setEffectiveTimeScale(timeScale);
        const head = view.head;
        if (head) head.bone.quaternion.copy(head.animated);
        // Mixer idzie czasem symulacji: pauza gry zatrzymuje kota.
        view.mixer.update(Math.max(0, time - view.time));
        if (head) {
          head.animated.copy(head.bone.quaternion);
          if (pet?.phase === 'stroke') {
            this.handRotation.set(
              Math.sin(pet.progress * Math.PI) *
                hubInteractions.catPet.headTiltRad,
              0,
              0,
            );
            head.bone.quaternion.multiply(
              this.headTilt.setFromEuler(this.handRotation),
            );
          }
        }
      }
      view.time = time;
      const source = this.sources[0]!;
      Object.assign(source.position, view.root.position);
      source.radiusM = this.ctx.tuning.audio.ambienceProfiles.purr.radiusM;
      source.gain = (pet ? pet.phase === 'stroke' : rest)
        ? this.ctx.tuning.audio.ambienceProfiles.purr.gain
        : 0;
    }
    for (let i = 0; i < this.rats.length; i++) {
      const rat = this.runtime.rats[i]!,
        view = this.rats[i]!;
      view.root.visible = rat.active;
      if (!rat.active) continue;
      const distance = this.place(view, rat, alpha);
      for (let j = 0; j < view.legs.length; j++)
        view.legs[j]!.rotation.x =
          Math.sin((distance / t.catStrideM) * Math.PI * 4 + j * Math.PI) *
          t.catLegSwingRad;
      for (let j = 0; j < view.tail.length; j++)
        view.tail[j]!.rotation.y =
          Math.sin(distance * 4 - j) * t.catTailSwingRad;
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.cat?.mixer) {
      this.cat.mixer.stopAllAction();
      this.cat.mixer.uncacheRoot(this.cat.mixer.getRoot());
    }
    this.cat?.root.traverse((node) => {
      if (node instanceof Mesh) node.geometry.dispose();
      if (node instanceof SkinnedMesh) node.skeleton.dispose();
    });
    for (const off of this.off) off();
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.fur.dispose();
    this.ratFur.dispose();
    this.eyes.dispose();
  }
}
