import {
  BoxGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { BladeView } from '../combat/melee/plasmaBlade';
import { applyStyle, getMaterial } from './materials';

/** Poza ostrza w układzie kamery (pozycja, kąty Euler 'YXZ' w radianach). */
interface BladePose {
  pos: [number, number, number];
  rot: [number, number, number];
}

const POSE_IDLE: BladePose = {
  pos: [0.3, -0.3, -0.55],
  rot: [0.9, 0.15, -0.25],
};
const POSE_BLOCK: BladePose = {
  pos: [0.05, -0.12, -0.5],
  rot: [0.15, 0, -1.45],
};

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

function lerpPose(a: BladePose, b: BladePose, t: number): BladePose {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    pos: [l(a.pos[0], b.pos[0]), l(a.pos[1], b.pos[1]), l(a.pos[2], b.pos[2])],
    rot: [l(a.rot[0], b.rot[0]), l(a.rot[1], b.rot[1]), l(a.rot[2], b.rot[2])],
  };
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * Ostrze plazmowe w widoku FPP: model plasma_blade.glb (albo bryła zastępcza) ustawiany
 * co klatkę w układzie kamery według stanu ostrza (poza spoczynku, zamachy etapów combo,
 * ładowanie ciężkiego, blok). Kod renderu — logika ostrza jest w src/combat/melee.
 */
export class FppBlade {
  readonly root = new Group();
  private readonly fallback = new Mesh(
    new BoxGeometry(0.03, 0.03, 1.1),
    getMaterial('player'),
  );
  private readonly tmp = {
    m: new Matrix4(),
    q: new Quaternion(),
    e: new Euler(0, 0, 0, 'YXZ'),
    v: new Vector3(),
    s: new Vector3(1, 1, 1),
  };

  constructor() {
    this.fallback.position.z = -0.55;
    this.root.add(this.fallback);
    this.root.matrixAutoUpdate = false;
  }

  /** Ładuje model; przy błędzie zostaje bryła zastępcza. */
  async load(loadModels = true): Promise<void> {
    if (!loadModels) return;
    try {
      const blade = await new GLTFLoader().loadAsync(
        '/assets/models/plasma_blade.glb',
      );
      applyStyle(blade.scene);
      this.root.remove(this.fallback);
      this.root.add(blade.scene);
    } catch {
      // Bryła zastępcza wystarcza do gry.
    }
  }

  place(cameraMatrix: Matrix4, view: BladeView): void {
    let pose = POSE_IDLE;
    if (view.state === 'blocking') pose = POSE_BLOCK;
    else if (view.state === 'charging') {
      const [start] = SWINGS.heavy as [BladePose, BladePose];
      pose = lerpPose(POSE_IDLE, start, easeOut(view.charge));
    } else if (view.state === 'light' || view.state === 'heavy') {
      const key = view.state === 'heavy' ? 'heavy' : String(view.stage);
      const [start, end] = (SWINGS[key] ?? SWINGS[1]) as [BladePose, BladePose];
      if (view.phase === 'windup')
        pose = lerpPose(POSE_IDLE, start, easeOut(view.phaseT));
      else if (view.phase === 'active')
        pose = lerpPose(start, end, easeOut(view.phaseT));
      else pose = lerpPose(end, POSE_IDLE, view.phaseT * view.phaseT);
    }
    const { m, q, e, v, s } = this.tmp;
    e.set(pose.rot[0], pose.rot[1], pose.rot[2], 'YXZ');
    q.setFromEuler(e);
    v.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    m.compose(v, q, s);
    this.root.matrix.multiplyMatrices(cameraMatrix, m);
    this.root.matrixWorldNeedsUpdate = true;
  }

  dispose(): void {
    this.fallback.geometry.dispose();
    this.root.removeFromParent();
  }
}
