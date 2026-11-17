import { Box3, Euler, Matrix4, Vector3 } from 'three';
import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';

interface HorizonBlock {
  position: Vec3;
  size: Vec3;
  rotation?: Vec3 | undefined;
}

export function worldEnvelope(blocks: readonly HorizonBlock[], origin: Vec3) {
  const bounds = new Box3().expandByPoint(
    new Vector3(origin.x, origin.y, origin.z),
  );
  const box = new Box3();
  const center = new Vector3();
  const size = new Vector3();
  const transform = new Matrix4();
  const angles = new Euler();
  for (const { position, size: dimensions, rotation } of blocks) {
    size.set(dimensions.x, dimensions.y, dimensions.z);
    box.setFromCenterAndSize(center, size);
    transform.makeRotationFromEuler(
      angles.set(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0),
    );
    transform.setPosition(position.x, position.y, position.z);
    bounds.union(box.applyMatrix4(transform));
  }
  bounds.getCenter(center);
  bounds.getSize(size);
  return {
    center: { x: center.x, y: center.y, z: center.z },
    radiusM: Math.hypot(size.x, size.z) / 2,
    heightM: size.y,
    bounds,
  };
}

export type WorldEnvelope = ReturnType<typeof worldEnvelope>;

export function horizonParameters(
  envelope: WorldEnvelope,
  fog: { nearM: number; farM: number },
) {
  const t = tuning.horizon;
  const expanded =
    envelope.radiusM > t.legacyRadiusM || envelope.heightM > t.legacyRadiusM;
  const ringOffsetM = expanded
    ? Math.max(0, envelope.radiusM + t.ringClearanceM - t.firstRingM)
    : 0;
  const ringsM = [t.firstRingM, t.secondRingM, t.thirdRingM, t.fourthRingM].map(
    (radius) => radius + ringOffsetM,
  );
  const domeRadiusM = expanded
    ? Math.hypot(ringsM[3]! + t.domeClearanceM, envelope.heightM) +
      envelope.radiusM
    : t.legacyDomeM;
  const far = expanded
    ? Math.max(t.legacyFarM, domeRadiusM + t.clipClearanceM)
    : t.legacyFarM;
  const fogScale = expanded
    ? Math.min(far / t.legacyFarM, (far - t.clipClearanceM) / fog.farM)
    : 1;
  return {
    expanded,
    center: envelope.center,
    radiusM: envelope.radiusM,
    heightM: envelope.heightM,
    ringsM,
    ringOffsetM,
    domeRadiusM,
    near: expanded ? Math.max(t.legacyNearM, far / t.nearRatio) : t.legacyNearM,
    far,
    fogNear: fog.nearM * fogScale,
    fogFar: fog.farM * fogScale,
  };
}
