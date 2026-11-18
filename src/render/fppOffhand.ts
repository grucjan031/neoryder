import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { EventBus, EntityId } from '../core/events';
import type { HeldKind } from '../combat/heldItem';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';
import { HandRig } from './handRig';
import type { HandPose } from './handPoses';

// Układ kamery, metry i radiany YXZ: spoczynek poza dolną krawędzią kadru; gest wnętrzem dłoni do przodu.
const REST = {
  pos: new Vector3(-0.31, -0.8, -0.38),
  rot: new Euler(0.15, -0.18, -0.2, 'YXZ'),
};
const CAST = {
  pos: new Vector3(-0.2, -0.2, -0.5),
  rot: new Euler(1.25, 0.1, -0.12, 'YXZ'),
};

export class FppOffhand {
  readonly rig = new HandRig('L');
  readonly root = this.rig.root;
  private elapsed = Infinity;
  private enabled = false;
  private readonly off: () => void;
  private readonly base = new Matrix4();
  private readonly cast = new Matrix4();
  private readonly position = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly castPosition = new Vector3();
  private readonly castQuaternion = new Quaternion();
  private readonly castScale = new Vector3();

  constructor(
    bus: EventBus,
    owner: EntityId,
    private readonly t: Pick<Tuning, 'hands'> = tuning,
  ) {
    this.off = bus.on('power_used', ({ user }) => {
      if (user === owner && this.enabled) this.elapsed = 0;
    });
  }

  load(loadModels = true): Promise<void> {
    return this.rig.load(loadModels);
  }

  place(
    camera: Matrix4,
    frameDt: number,
    shown: HeldKind,
    twin: boolean,
    support: Matrix4 | null = null,
    supportPose: HandPose = 'support',
  ): void {
    this.enabled = shown !== 'blade' || !twin;
    if (!this.enabled) this.elapsed = Infinity;
    this.elapsed += Math.max(0, frameDt);
    const h = this.t.hands;
    const active = this.elapsed < h.castS;
    this.root.visible =
      this.enabled && ((shown === 'gun' && support !== null) || active);
    const t = active ? this.elapsed / Math.max(h.castS, Number.EPSILON) : 1;
    const peak = Math.max(
      Number.EPSILON,
      Math.min(1 - Number.EPSILON, h.castOutFraction),
    );
    // Szybkie wysunięcie i łagodniejszy powrót; zerowa prędkość na szczycie.
    const amount = active
      ? t < peak
        ? 1 - (1 - t / peak) ** 2
        : (1 - (t - peak) / (1 - peak)) ** 2
      : 0;
    const basePose = shown === 'gun' ? supportPose : 'relaxed';
    this.rig.setPose(basePose, 'open', amount);
    if (shown === 'gun' && support) {
      this.base
        .copy(support)
        .multiply(this.rig.socketMatrix('socket_support').invert());
    } else {
      this.quaternion.setFromEuler(REST.rot);
      this.base
        .compose(REST.pos, this.quaternion, this.scale)
        .premultiply(camera);
    }
    this.quaternion.setFromEuler(CAST.rot);
    this.cast
      .compose(CAST.pos, this.quaternion, this.scale)
      .premultiply(camera);
    this.base.decompose(this.position, this.quaternion, this.scale);
    this.cast.decompose(this.castPosition, this.castQuaternion, this.castScale);
    this.position.lerp(this.castPosition, amount);
    this.quaternion.slerp(this.castQuaternion, amount);
    this.root.matrix.compose(this.position, this.quaternion, this.scale);
    this.root.matrixWorldNeedsUpdate = true;
    this.rig.setGlow(amount, h.castGlow);
  }

  dispose(): void {
    this.off();
    this.rig.dispose();
  }
}
