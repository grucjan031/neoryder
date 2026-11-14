import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { HeldItemView, HeldKind } from '../combat/heldItem';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';

// Ograniczenie kroku sprężyny po powrocie z nieaktywnej karty.
const MAX_FRAME_S = 0.1;
const SPRING_STEP_S = 1 / 120;

export function shownHeld(view: HeldItemView): HeldKind {
  return view.swapping && view.swapT >= 0.5 ? view.target : view.held;
}

/** Tylko render: opad zamiany, sprężyste opóźnienie obrotu i kołysanie od prędkości. */
export class FppMotion {
  private previous: { yaw: number; pitch: number } | null = null;
  private yaw = 0;
  private pitch = 0;
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private phase = 0;
  private speed = 0;
  private readonly e = new Euler(0, 0, 0, 'YXZ');
  private readonly q = new Quaternion();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly local = new Matrix4();
  private readonly result = new Matrix4();

  constructor(private readonly t: Pick<Tuning, 'hands'> = tuning) {}

  place(
    camera: Matrix4,
    frameDt: number,
    horizontalSpeed: number,
    held?: HeldItemView,
  ): Matrix4 {
    const dt = Math.min(MAX_FRAME_S, Math.max(0, frameDt));
    const h = this.t.hands;
    this.e.setFromRotationMatrix(camera, 'YXZ');
    if (this.previous && dt > 0) {
      const delta = this.e.y - this.previous.yaw;
      this.yaw -= Math.atan2(Math.sin(delta), Math.cos(delta)) * h.swayAmount;
      this.pitch -= (this.e.x - this.previous.pitch) * h.swayAmount;
    }
    this.previous = { yaw: this.e.y, pitch: this.e.x };
    const limit = (value: number) =>
      Math.max(-h.swayMax, Math.min(h.swayMax, value));
    this.yaw = limit(this.yaw);
    this.pitch = limit(this.pitch);
    const spring = Math.max(0, h.swayReturn);
    for (let left = dt; left > 0;) {
      const step = Math.min(left, SPRING_STEP_S);
      this.yawVelocity +=
        (-spring * this.yaw - 2 * Math.sqrt(spring) * this.yawVelocity) * step;
      this.pitchVelocity +=
        (-spring * this.pitch - 2 * Math.sqrt(spring) * this.pitchVelocity) *
        step;
      this.yaw = limit(this.yaw + this.yawVelocity * step);
      this.pitch = limit(this.pitch + this.pitchVelocity * step);
      left -= step;
    }
    this.speed +=
      (Math.max(0, horizontalSpeed) - this.speed) *
      (1 - Math.exp(-h.bobReturn * dt));
    this.phase =
      (this.phase + this.speed * h.bobFrequency * dt) % (Math.PI * 2);
    const bob =
      h.bobAmount *
      Math.min(1, this.speed / Math.max(h.bobSpeed, Number.EPSILON));
    let lower = 0;
    if (held?.swapping) {
      const t = Math.max(0, Math.min(1, held.swapT));
      lower = (t < 0.5 ? t * 2 : (1 - t) * 2) ** 2;
    }
    this.position.set(
      Math.sin(this.phase) * bob,
      Math.cos(this.phase * 2) * bob - lower * h.swapDropM,
      0,
    );
    this.e.set(this.pitch + lower * h.swapAngle, this.yaw, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.local.compose(this.position, this.q, this.scale);
    return this.result.multiplyMatrices(camera, this.local);
  }
}
