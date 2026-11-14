import {
  BoxGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
} from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStyle, getMaterial } from './materials';
import { handNodes, handPoses } from './handPoses';
import type { HandPose, HandSocket } from './handPoses';

// Przybliżona geometria zastępcza i położenia przegubów zgodne z osiami GLB (metry).
const FINGERS = [
  {
    name: 'index',
    x: 0.029,
    z: -0.1,
    lengths: [0.041, 0.025, 0.023],
    spread: -0.045,
  },
  {
    name: 'middle',
    x: 0.009,
    z: -0.098,
    lengths: [0.043, 0.027, 0.025],
    spread: -0.01,
  },
  {
    name: 'ring',
    x: -0.012,
    z: -0.1,
    lengths: [0.04, 0.025, 0.023],
    spread: 0.025,
  },
  {
    name: 'pinky',
    x: -0.031,
    z: -0.101,
    lengths: [0.036, 0.021, 0.02],
    spread: 0.09,
  },
  {
    name: 'thumb',
    x: 0.042,
    z: -0.032,
    lengths: [0.032, 0.026, 0.022],
    spread: 0,
  },
] as const;
const SOCKETS = {
  socket_blade: { pos: [0, 0.033, -0.11], q: [-0.5, -0.5, 0.5, 0.5] },
  socket_gun: {
    pos: [0.049, 0.038, -0.12],
    q: [0, 0, -Math.SQRT1_2, Math.SQRT1_2],
  },
  socket_support: { pos: [0, 0.024, -0.108], q: [0, 0.4617486, 0, 0.8870108] },
} as const;
const GLOW_RADIUS_M = 0.012;
const cache = new Map<string, Promise<Object3D | null>>();

function modelFor(side: 'R' | 'L'): Promise<Object3D | null> {
  let pending = cache.get(side);
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(`/assets/models/player_arm_${side}.glb`)
      .then(({ scene }) => {
        applyStyle(scene);
        return scene;
      })
      .catch(() => null);
    cache.set(side, pending);
  }
  return pending;
}

function fallbackHand(side: 'R' | 'L'): Group {
  const root = new Group();
  const sign = side === 'R' ? 1 : -1;
  const forearm = new Group();
  forearm.name = 'forearm';
  root.add(forearm);
  const box = (
    parent: Object3D,
    name: string,
    size: [number, number, number],
    pos: [number, number, number],
  ) => {
    const node = new Mesh(new BoxGeometry(...size), getMaterial('interactive'));
    node.name = name;
    node.position.set(...pos);
    parent.add(node);
    return node;
  };
  box(forearm, 'armor', [0.085, 0.07, 0.3], [0, 0, 0.18]);
  const wrist = new Group();
  wrist.name = 'wrist';
  forearm.add(wrist);
  const palm = box(wrist, 'palm', [0.08, 0.035, 0.1], [0, 0, 0]);
  // Geometria dłoni biegnie od pivotu nadgarstka w -Z.
  palm.geometry.translate(0, 0, -0.05);
  for (const finger of FINGERS) {
    let parent: Object3D = palm;
    for (let i = 0; i < 3; i++) {
      const joint = new Group();
      joint.name = `${finger.name}_${i + 1}`;
      if (i === 0) {
        joint.position.set(
          sign * finger.x,
          finger.name === 'thumb' ? -0.004 : 0,
          finger.z,
        );
        joint.rotation.y = finger.spread * sign;
        if (finger.name === 'thumb')
          joint.quaternion.set(-0.1, -0.3 * sign, 0.3 * sign, 0.9).normalize();
      } else joint.position.z = -finger.lengths[i - 1]!;
      parent.add(joint);
      const length = finger.lengths[i]!;
      box(
        joint,
        `${finger.name}_phalanx_${i + 1}`,
        [0.016, 0.018, length],
        [0, 0, -length / 2],
      );
      parent = joint;
    }
  }
  for (const [name, transform] of Object.entries(SOCKETS)) {
    const node = new Group();
    node.name = name;
    const [x, y, z] = transform.pos;
    node.position.set(x * sign, y, z);
    const [qx, qy, qz, qw] = transform.q;
    node.quaternion.set(qx, qy * sign, qz * sign, qw).normalize();
    palm.add(node);
  }
  const core = box(
    palm,
    'resonance_core',
    [0.025, 0.009, 0.025],
    [0, -0.024, -0.05],
  );
  core.material = getMaterial('power');
  const center = new Group();
  center.name = 'palm_center';
  center.position.set(0, 0.024, -0.06);
  center.rotation.x = Math.PI / 2;
  palm.add(center);
  return root;
}

/** Sztywne przeguby; orientacje póz zawsze względem zapamiętanego spoczynku. */
export class HandRig {
  readonly root = new Group();
  private model!: Object3D;
  private fallback = true;
  private disposed = false;
  private generation = 0;
  private readonly joints = new Map<
    (typeof handNodes)[number],
    { node: Object3D; rest: Quaternion }
  >();
  private readonly glowMaterial = getMaterial('power').clone();
  private readonly glowGeometry = new SphereGeometry(GLOW_RADIUS_M, 8, 6);
  private readonly glow = new Mesh(this.glowGeometry, this.glowMaterial);
  private from: HandPose = 'relaxed';
  private to: HandPose = 'relaxed';
  private mix = 0;
  private readonly a = new Quaternion();
  private readonly b = new Quaternion();
  private readonly e = new Euler(0, 0, 0, 'XYZ');

  constructor(readonly side: 'R' | 'L') {
    this.root.name = `hand_${side}`;
    this.root.matrixAutoUpdate = false;
    this.install(fallbackHand(side), true);
    this.setGlow(0);
  }

  async load(loadModels = true): Promise<void> {
    const generation = ++this.generation;
    if (this.disposed) return;
    if (!loadModels) {
      if (!this.fallback) this.install(fallbackHand(this.side), true);
      return;
    }
    if (!this.fallback) return;
    const model = await modelFor(this.side);
    if (model && !this.disposed && generation === this.generation)
      this.install(model.clone(true), false);
  }

  private releaseModel(): void {
    this.glow.removeFromParent();
    if (this.fallback)
      this.model?.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
    this.model?.removeFromParent();
  }

  private install(model: Object3D, fallback: boolean): void {
    for (const name of handNodes) {
      if (!model.getObjectByName(name))
        throw new Error(`Brak węzła dłoni: ${name}`);
    }
    this.releaseModel();
    this.model = model;
    this.fallback = fallback;
    this.joints.clear();
    this.root.add(model);
    for (const name of handNodes) {
      const node = model.getObjectByName(name)!;
      this.joints.set(name, { node, rest: node.quaternion.clone() });
    }
    model.getObjectByName('resonance_core')!.traverse((node) => {
      if (node instanceof Mesh) node.material = this.glowMaterial;
    });
    model.getObjectByName('palm_center')!.add(this.glow);
    this.setPose(this.from, this.to, this.mix);
  }

  setPose(from: HandPose, to: HandPose, t: number): void {
    this.from = from;
    this.to = to;
    this.mix = Math.max(0, Math.min(1, t));
    for (const [name, { node, rest }] of this.joints) {
      const anglesA = handPoses[from][name];
      const anglesB = handPoses[to][name];
      this.a.copy(rest).multiply(newRotation(anglesA, this.e, this.b));
      newRotation(anglesB, this.e, this.b).premultiply(rest);
      node.quaternion.copy(this.a).slerp(this.b, this.mix);
    }
  }

  socketMatrix(name: HandSocket): Matrix4 {
    const socket = this.model.getObjectByName(name)!;
    // Lokalne macierze — wynik niezależny od położenia i rodzica root.
    const chain: Object3D[] = [];
    for (
      let node: Object3D | null = socket;
      node && node !== this.root;
      node = node.parent
    )
      chain.push(node);
    const matrix = new Matrix4();
    for (const node of chain.reverse()) {
      node.updateMatrix();
      matrix.multiply(node.matrix);
    }
    return matrix;
  }

  placeAt(itemMatrix: Matrix4, socket: HandSocket): void {
    this.root.matrix
      .copy(itemMatrix)
      .multiply(this.socketMatrix(socket).invert());
    this.root.matrixWorldNeedsUpdate = true;
  }

  setGlow(amount: number, gain = 1): void {
    this.glowMaterial.color
      .copy(getMaterial('power').color)
      .multiplyScalar(1 + amount * gain);
    this.glow.visible = amount > 0;
  }

  dispose(): void {
    this.disposed = true;
    this.releaseModel();
    this.glowGeometry.dispose();
    this.glowMaterial.dispose();
    this.root.removeFromParent();
  }
}

function newRotation(
  angles: readonly [number, number, number] | undefined,
  e: Euler,
  q: Quaternion,
): Quaternion {
  e.set(angles?.[0] ?? 0, angles?.[1] ?? 0, angles?.[2] ?? 0, 'XYZ');
  return q.setFromEuler(e);
}
