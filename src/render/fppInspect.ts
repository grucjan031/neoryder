import { Euler, Matrix4 } from 'three';
import type { HeldKind } from '../combat/heldItem';

type Triple = [number, number, number];
type Pose = { pos: Triple; rot: Triple };

export interface InspectKey {
  t: number;
  pos: Triple;
  rot: Triple;
}

export interface InspectTuning {
  durationS: number;
  cancelS: number;
  pivot: Triple;
  gun: InspectKey[];
  blade: InspectKey[];
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function blend(a: Triple, b: Triple, t: number): Triple {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

const zero: Triple = [0, 0, 0];

/** Pozycja w metrach i obrót YXZ w radianach, w układzie dłoni. */
export function inspectPose(p: number, keys: readonly InspectKey[]): Pose {
  if (p > 0 && p < 1) {
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1]!;
      const b = keys[i]!;
      if (p < a.t || p > b.t || b.t <= a.t) continue;
      const t = smoothstep((p - a.t) / (b.t - a.t));
      return { pos: blend(a.pos, b.pos, t), rot: blend(a.rot, b.rot, t) };
    }
  }
  return { pos: [...zero], rot: [...zero] };
}

export class FppInspect {
  private kind: HeldKind | null = null;
  private elapsed = 0;
  private cancelElapsed = 0;
  private cancelFrom: Pose | null = null;
  private pose: Pose = { pos: zero, rot: zero };
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');
  private readonly offset = new Matrix4();

  constructor(private readonly t: InspectTuning) {}

  get active(): boolean {
    return this.kind !== null;
  }

  start(kind: HeldKind): void {
    if (this.active && this.elapsed <= this.t.durationS / 2) return;
    this.kind = kind;
    this.elapsed = 0;
    this.cancelFrom = null;
    this.pose = { pos: zero, rot: zero };
  }

  cancel(): void {
    if (!this.active || this.cancelFrom) return;
    this.cancelFrom = this.pose;
    this.cancelElapsed = 0;
  }

  update(dt: number, kind: HeldKind): void {
    if (!this.active) return;
    if (kind !== this.kind) this.cancel();
    const step = Math.max(0, dt);
    if (this.cancelFrom) {
      this.cancelElapsed += step;
      if (this.cancelElapsed >= this.t.cancelS) {
        this.kind = null;
        this.cancelFrom = null;
        return;
      }
      const t = smoothstep(this.cancelElapsed / this.t.cancelS);
      this.pose = {
        pos: blend(this.cancelFrom.pos, zero, t),
        rot: blend(this.cancelFrom.rot, zero, t),
      };
    } else {
      this.elapsed += step;
      if (this.elapsed >= this.t.durationS) this.kind = null;
      else
        this.pose = inspectPose(this.elapsed / this.t.durationS, this.t[kind]);
    }
  }

  matrix(target: Matrix4): Matrix4 {
    if (!this.active) return target.identity();
    const [x, y, z] = this.t.pivot;
    const [dx, dy, dz] = this.pose.pos;
    this.rotation.set(...this.pose.rot, 'YXZ');
    return target
      .makeRotationFromEuler(this.rotation)
      .setPosition(x + dx, y + dy, z + dz)
      .multiply(this.offset.makeTranslation(-x, -y, -z));
  }
}
