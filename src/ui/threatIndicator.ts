import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';

/** Snapshot tylko do odczytu ze sceny; bez zależności od kontrolerów AI. */
export interface ThreatSource {
  readonly id: EntityId;
  readonly removed: boolean;
  readonly current: {
    readonly position: Vec3;
    readonly state: string;
    readonly stateTimeS: number;
  };
}

export interface ThreatTelegraph {
  kind: string;
  durationS: number;
}

export interface ThreatIndicator {
  id: EntityId;
  kind: string;
  angleDeg: number;
  distanceM: number;
  progress: number;
}

export function selectThreatIndicators(
  sources: readonly ThreatSource[],
  telegraphs: ReadonlyMap<EntityId, ThreatTelegraph>,
  origin: Vec3,
  yaw: number,
  options: { radiusM: number; halfAngleDeg: number; maxIndicators: number },
): ThreatIndicator[] {
  const result: ThreatIndicator[] = [];
  for (const source of sources) {
    const { position, state, stateTimeS } = source.current;
    const telegraph = telegraphs.get(source.id);
    if (
      source.removed ||
      (state !== 'telegraph' && state !== 'aim') ||
      !telegraph ||
      !(telegraph.durationS > 0) ||
      stateTimeS >= telegraph.durationS
    )
      continue;
    const x = position.x - origin.x;
    const z = position.z - origin.z;
    const distanceM = Math.hypot(x, position.y - origin.y, z);
    if (!(distanceM > 0 && distanceM <= options.radiusM)) continue;
    const forward = -x * Math.sin(yaw) - z * Math.cos(yaw);
    const right = x * Math.cos(yaw) - z * Math.sin(yaw);
    const angleDeg = (Math.atan2(right, forward) * 180) / Math.PI;
    if (Math.abs(angleDeg) <= options.halfAngleDeg) continue;
    result.push({
      id: source.id,
      kind: telegraph.kind,
      angleDeg,
      distanceM,
      progress: Math.max(0, Math.min(1, stateTimeS / telegraph.durationS)),
    });
  }
  return result
    .sort((a, b) => a.distanceM - b.distanceM || a.id - b.id)
    .slice(0, Math.max(0, Math.min(4, Math.floor(options.maxIndicators))));
}
