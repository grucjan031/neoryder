import {
  Box3,
  BoxGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { plasmaBladeDefinition } from '../combat/melee/bladeSchema';
import type { BladeDefinition } from '../combat/melee/bladeSchema';
import type { BladeView } from '../combat/melee/plasmaBlade';
import { applyStyle, getMaterial } from './materials';
import { HandRig } from './handRig';
import { bladeGrip } from './handPoses';
import { FppBladeFx } from './fppBladeFx';
import type { BladeFxItem } from './fppBladeFx';
import { applyFppSurfaces } from './fppMaterials';

/** Poza ostrza w układzie kamery (pozycja, kąty Euler 'YXZ' w radianach). */
interface BladePose {
  pos: [number, number, number];
  rot: [number, number, number];
}

type Hand = 'main' | 'off';

const POSE_IDLE: BladePose = {
  pos: bladeGrip.idlePosition,
  rot: bladeGrip.idleRotation,
};
/** Garda: ostrze ukośnie przez kadr (rękojeść z prawego dołu, czubek w lewym górnym), środek wolny. */
const POSE_BLOCK: BladePose = {
  pos: [0.17, -0.22, -0.4],
  rot: [0.5, 0.89, 1.0],
};
/** Lewa dłoń bliźniaczych ostrzy: niżej, między bronią palną a środkiem ekranu. */
const OFF_IDLE: BladePose = {
  pos: [
    -POSE_IDLE.pos[0],
    POSE_IDLE.pos[1] - bladeGrip.offhandDropM,
    POSE_IDLE.pos[2],
  ],
  rot: [POSE_IDLE.rot[0], -POSE_IDLE.rot[1], -POSE_IDLE.rot[2]],
};
const OFF_BLOCK_DROP_M = 0.08;
/**
 * Ostrze dwustronne trzymane w środku: model wysuwany do przodu tylko na obrót, gdy dłoń jest
 * ukryta (w spoczynku i ładowaniu dłoń zostaje blisko, by koniec rękawa nie wchodził w kadr).
 */
const DOUBLE_ENDED_FORWARD_M = -0.2;
/**
 * Poza obrotu 360°; sam obrót to kąt wokół pionowej osi kamery. Przechył w prawo:
 * przedramię wchodzi z prawej krawędzi, nie przecina środka ekranu.
 */
const SPIN_POSE: BladePose = {
  pos: [0.3, -0.24, -0.48],
  rot: [0.05, 0, 1.2],
};
const FULL_TURN = Math.PI * 2;

/** Początek i koniec zamachu dla etapów combo i ciężkiego ciosu. */
const SWINGS: Record<string, [BladePose, BladePose]> = {
  1: [
    { pos: [0.45, -0.1, -0.5], rot: [0.5, 0.9, -1.2] },
    { pos: [-0.35, -0.3, -0.55], rot: [0.5, -0.9, -1.4] },
  ],
  2: [
    { pos: [-0.4, -0.1, -0.5], rot: [0.5, -0.9, 1.2] },
    { pos: [0.4, -0.3, -0.55], rot: [0.5, 0.9, 1.4] },
  ],
  3: [
    { pos: [0.15, 0.15, -0.45], rot: [1.9, 0.1, -0.1] },
    { pos: [0.05, -0.45, -0.6], rot: [-0.4, 0, -0.1] },
  ],
  heavy: [
    { pos: [0.35, 0.2, -0.35], rot: [2.2, 0.3, -0.4] },
    { pos: [0, -0.5, -0.65], rot: [-0.6, 0, 0] },
  ],
};
const HEAVY_SWING = SWINGS.heavy as [BladePose, BladePose];

/** Bliźniacze: etapy combo prowadzą naprzemiennie prawym i lewym ostrzem. */
const TWIN_STAGES: Record<number, { hand: Hand; swing: string }> = {
  1: { hand: 'main', swing: '1' },
  2: { hand: 'off', swing: '1' },
  3: { hand: 'main', swing: '2' },
  4: { hand: 'off', swing: '3' },
};

function lerpPose(a: BladePose, b: BladePose, t: number): BladePose {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    pos: [l(a.pos[0], b.pos[0]), l(a.pos[1], b.pos[1]), l(a.pos[2], b.pos[2])],
    rot: [l(a.rot[0], b.rot[0]), l(a.rot[1], b.rot[1]), l(a.rot[2], b.rot[2])],
  };
}

function mirrorPose(p: BladePose): BladePose {
  return {
    pos: [-p.pos[0], p.pos[1], p.pos[2]],
    rot: [p.rot[0], -p.rot[1], -p.rot[2]],
  };
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => t * t * (3 - 2 * t);

const MODEL_DIR = '/assets/models/';
const FALLBACK_MODEL = 'plasma_blade';

/** Wczytane i ostylowane sceny modeli (jedno wczytanie na plik; null = brak pliku). */
const modelCache = new Map<string, Promise<Object3D | null>>();

function loadModel(name: string): Promise<Object3D | null> {
  let cached = modelCache.get(name);
  if (!cached) {
    cached = new GLTFLoader()
      .loadAsync(`${MODEL_DIR}${name}.glb`)
      .then((gltf) => {
        applyStyle(gltf.scene);
        applyFppSurfaces(gltf.scene);
        return gltf.scene;
      })
      .catch(() => null);
    modelCache.set(name, cached);
  }
  return cached;
}

/**
 * Ostrze w widoku FPP: model z `def.model` (albo `plasma_blade.glb`, albo bryła zastępcza)
 * ustawiany co klatkę w układzie kamery według stanu ostrza. Bliźniacze rysują drugą,
 * lustrzaną instancję po lewej; dwustronne mają ostrze z obu stron rękojeści i obrót 360°
 * w ciężkim ataku. Kod renderu — logika ostrza jest w src/combat/melee.
 */
export class FppBlade {
  readonly root = new Group();
  readonly mainHand = new HandRig('R');
  readonly offHand = new HandRig('L');
  private readonly hands: Record<Hand, Group> = {
    main: new Group(),
    off: new Group(),
  };
  private readonly fx = new FppBladeFx();
  private readonly fxItems: BladeFxItem[] = [
    { key: 'main', model: null, visible: false, slashing: false },
    { key: 'off', model: null, visible: false, slashing: false },
  ];
  private def: BladeDefinition;
  private animationTimeS: number | undefined;
  private generation = 0;
  private readonly tmp = {
    m: new Matrix4(),
    spin: new Matrix4(),
    q: new Quaternion(),
    e: new Euler(0, 0, 0, 'YXZ'),
    v: new Vector3(),
    s: new Vector3(1, 1, 1),
    mirror: new Vector3(-1, 1, 1),
    up: new Vector3(0, 1, 0),
    box: new Box3(),
  };

  constructor(def: BladeDefinition = plasmaBladeDefinition) {
    this.def = def;
    this.root.matrixAutoUpdate = false;
    for (const hand of [this.hands.main, this.hands.off]) {
      hand.matrixAutoUpdate = false;
      this.root.add(hand);
    }
    this.root.add(this.mainHand.root, this.offHand.root, this.fx.root);
    this.setModel(def, null, false);
  }

  /** Ładuje model wariantu; przy braku pliku `plasma_blade.glb`, a potem bryła zastępcza. */
  async load(
    loadModels = true,
    def: BladeDefinition = this.def,
  ): Promise<void> {
    const generation = ++this.generation;
    this.setModel(def, null, false);
    await Promise.all([
      this.mainHand.load(loadModels),
      this.offHand.load(loadModels),
    ]);
    if (!loadModels) return;
    const wanted = def.model ?? FALLBACK_MODEL;
    let scene = await loadModel(wanted);
    let fallback = false;
    if (!scene && wanted !== FALLBACK_MODEL) {
      scene = await loadModel(FALLBACK_MODEL);
      fallback = true;
    }
    if (scene && generation === this.generation)
      this.setModel(def, scene, fallback);
  }

  /** Zmiana wariantu w trakcie sceny (nowy run, komenda debug). */
  setDefinition(def: BladeDefinition, loadModels = true): Promise<void> {
    return this.load(loadModels, def);
  }

  private setModel(
    def: BladeDefinition,
    scene: Object3D | null,
    fallback: boolean,
  ): void {
    this.def = def;
    for (const hand of Object.values(this.hands)) {
      for (const child of hand.children.slice()) {
        this.disposeBuilt(child);
        hand.remove(child);
      }
    }
    this.hands.main.add(this.build(scene, fallback));
    if (def.offhand) this.hands.off.add(this.build(scene, fallback));
    this.hands.off.visible = def.offhand;
  }

  /** Zwalnia tylko geometrię brył zastępczych (modele z cache są współdzielone). */
  private disposeBuilt(node: Object3D): void {
    if (node.userData.fallbackShape === true)
      node.traverse((child) => {
        if (child instanceof Mesh) child.geometry.dispose();
      });
  }

  private build(scene: Object3D | null, fallback: boolean): Object3D {
    const def = this.def;
    const length = def.lengthScale;
    if (!scene) {
      const group = new Group();
      group.userData.fallbackShape = true;
      const bar = (z: number) => {
        const blade = new Mesh(
          new BoxGeometry(0.03, 0.03, 1.1 * length),
          getMaterial('player'),
        );
        blade.position.z = z;
        return blade;
      };
      group.add(bar(-0.55 * length));
      if (def.doubleEnded) group.add(bar(0.55 * length));
      return group;
    }
    const model = scene.clone(true);
    this.fx.styleModel(model);
    const front = model.getObjectByName('blade');
    if (fallback && front) front.scale.z = length;
    if (def.doubleEnded && front && !model.getObjectByName('blade_back')) {
      // Brak tylnego ostrza w modelu: kopia przedniego, obrócona o 180°, od tyłu rękojeści.
      const back = front.clone(true);
      back.name = 'blade_back';
      const renames = [
        ['blade_core', 'blade_back_core'],
        ['blade_tip', 'blade_back_tip'],
      ] as const;
      for (const [from, to] of renames) {
        const node = back.getObjectByName(from);
        if (node) node.name = to;
      }
      this.tmp.box.setFromObject(model);
      back.position.z = this.tmp.box.max.z;
      back.rotation.y = Math.PI;
      front.parent?.add(back);
    }
    return model;
  }

  private poseFor(view: BladeView, hand: Hand): BladePose {
    const main = hand === 'main';
    const idle = main ? POSE_IDLE : OFF_IDLE;
    const adapt = (p: BladePose): BladePose => (main ? p : mirrorPose(p));
    const spin = this.def.heavyShape === 'spin';
    const heavyStart = spin ? SPIN_POSE : HEAVY_SWING[0];
    const heavyEnd = spin ? SPIN_POSE : HEAVY_SWING[1];
    if (view.state === 'blocking') {
      const block = adapt(POSE_BLOCK);
      return main
        ? block
        : {
            pos: [block.pos[0], block.pos[1] - OFF_BLOCK_DROP_M, block.pos[2]],
            rot: block.rot,
          };
    }
    if (view.state === 'charging')
      return lerpPose(idle, adapt(heavyStart), easeOut(view.charge));
    if (view.state === 'heavy')
      return this.swingPose(view, idle, adapt(heavyStart), adapt(heavyEnd));
    if (view.state === 'light') {
      let key = String(view.stage);
      if (this.def.offhand) {
        const step = TWIN_STAGES[view.stage] ?? TWIN_STAGES[1];
        if (step && step.hand !== hand) return idle;
        key = step?.swing ?? '1';
      } else if (!main) return idle;
      const [start, end] = (SWINGS[key] ?? SWINGS[1]) as [BladePose, BladePose];
      // Lewe ostrze w bliźniaczych tnie lustrzanie do prawego.
      return this.swingPose(view, idle, adapt(start), adapt(end));
    }
    return idle;
  }

  private swingPose(
    view: BladeView,
    idle: BladePose,
    start: BladePose,
    end: BladePose,
  ): BladePose {
    if (view.phase === 'windup')
      return lerpPose(idle, start, easeOut(view.phaseT));
    if (view.phase === 'active')
      return lerpPose(start, end, easeOut(view.phaseT));
    return lerpPose(end, idle, view.phaseT * view.phaseT);
  }

  /** Wysunięcie kija do przodu, płynnie wraz z ładowaniem i powrotem po obrocie. */
  private doubleEndedForward(view: BladeView): number {
    if (!this.def.doubleEnded || view.flight !== null) return 0;
    if (view.state !== 'heavy') return 0;
    if (view.phase === 'windup')
      return DOUBLE_ENDED_FORWARD_M * easeOut(view.phaseT);
    if (view.phase === 'recovery')
      return DOUBLE_ENDED_FORWARD_M * (1 - view.phaseT * view.phaseT);
    return DOUBLE_ENDED_FORWARD_M;
  }

  /** Czy dłoń prowadzi teraz cięcie (aktywna faza) — dla smugi. */
  private slashing(view: BladeView, hand: Hand): boolean {
    if (view.flight !== null || view.phase !== 'active') return false;
    if (view.state === 'heavy') return hand === 'main' || this.def.offhand;
    if (view.state !== 'light') return false;
    if (!this.def.offhand) return hand === 'main';
    return (TWIN_STAGES[view.stage] ?? TWIN_STAGES[1])?.hand === hand;
  }

  /** `fxActive`: false, gdy ostrze nie jest pokazywane — efekty są wtedy tylko chowane. */
  place(
    cameraMatrix: Matrix4,
    view: BladeView,
    frameDt = 1 / 60,
    fxActive = true,
  ): void {
    const fxDt =
      view.animationTimeS === undefined
        ? frameDt
        : this.animationTimeS === undefined
          ? 0
          : Math.max(0, view.animationTimeS - this.animationTimeS);
    this.animationTimeS = view.animationTimeS;
    if (view.state === 'idle' && view.execution)
      view = { ...view, state: 'light', stage: 1, ...view.execution };
    this.root.visible = true;
    const spinning =
      view.state === 'heavy' &&
      this.def.heavyShape === 'spin' &&
      view.phase === 'active';
    const turn = spinning ? easeInOut(view.phaseT) * FULL_TURN : 0;
    for (const name of ['main', 'off'] as const) {
      const hand = this.hands[name];
      hand.visible =
        view.flight === null && (name === 'main' || this.def.offhand);
      const rig = name === 'main' ? this.mainHand : this.offHand;
      rig.root.visible = !spinning && (name === 'main' || this.def.offhand);
      const pose =
        view.flight !== null
          ? name === 'main'
            ? POSE_IDLE
            : OFF_IDLE
          : this.poseFor(view, name);
      const { m, spin, q, e, v, s, mirror, up } = this.tmp;
      e.set(pose.rot[0], pose.rot[1], pose.rot[2], 'YXZ');
      q.setFromEuler(e);
      v.set(
        pose.pos[0],
        pose.pos[1],
        pose.pos[2] + this.doubleEndedForward(view),
      );
      // Dłoń L ma własną geometrię i gniazdo; lustro dotyczy wyłącznie ostrza.
      m.compose(v, q, s).premultiply(cameraMatrix);
      rig.setPose(
        view.flight !== null ? 'open' : 'gripBlade',
        view.flight !== null ? 'open' : 'gripBlade',
        0,
      );
      rig.placeAt(m, 'socket_blade');
      m.compose(v, q, name === 'off' ? mirror : s);
      if (turn !== 0) {
        // Obrót 360° wokół pionowej osi kamery: ostrze zatacza koło dookoła gracza.
        spin.makeRotationAxis(up, turn);
        m.premultiply(spin);
      }
      hand.matrix.multiplyMatrices(cameraMatrix, m);
      hand.matrixWorldNeedsUpdate = true;
      const item = this.fxItems[name === 'main' ? 0 : 1]!;
      item.model = hand.children[0] ?? null;
      item.visible = hand.visible && this.root.visible;
      item.slashing = this.slashing(view, name);
    }
    this.root.matrixWorldNeedsUpdate = true;
    if (!fxActive) this.fx.hide();
    else
      this.fx.update(
        cameraMatrix,
        Math.max(0, Math.min(fxDt, 0.1)),
        this.fxItems,
      );
  }

  dispose(): void {
    this.generation++;
    this.mainHand.dispose();
    this.offHand.dispose();
    this.fx.dispose();
    for (const hand of Object.values(this.hands))
      for (const child of hand.children) this.disposeBuilt(child);
    this.root.removeFromParent();
  }
}
