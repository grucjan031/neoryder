import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { HubStationId } from '../core/metaTypes';

export interface HubZone {
  id: HubStationId;
  position: { x: number; z: number };
  radius: number;
}

/** Wybiera stację w zasięgu o najmniejszym kącie od kierunku patrzenia (yaw/pitch w radianach). */
export function selectHubFocus(
  zones: readonly HubZone[],
  eye: Vec3,
  yaw: number,
  pitch: number,
  focusY: number,
  interactAngleDeg: number,
): HubStationId | null {
  const forward = {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
  const minDot = Math.cos((interactAngleDeg * Math.PI) / 180);
  let bestDot = -Infinity;
  let focused: HubStationId | null = null;
  for (const zone of zones) {
    const dx = zone.position.x - eye.x;
    const dz = zone.position.z - eye.z;
    if (Math.hypot(dx, dz) > zone.radius) continue;
    const dy = focusY - eye.y;
    const length = Math.hypot(dx, dy, dz);
    if (length === 0) continue;
    const dot = (forward.x * dx + forward.y * dy + forward.z * dz) / length;
    if (dot >= minDot && dot > bestDot) {
      bestDot = dot;
      focused = zone.id;
    }
  }
  return focused;
}

/** Stan nakładki stacji bez DOM i renderu; otwarcie wyłącznie na żądanie. */
export class HubStations {
  private current: HubStationId | null = null;

  constructor(
    private readonly zones: readonly HubZone[],
    private readonly bus: EventBus,
  ) {}

  get opened(): HubStationId | null {
    return this.current;
  }

  has(id: HubStationId): boolean {
    return this.zones.some((zone) => zone.id === id);
  }

  /** Otwiera stację niezależnie od położenia gracza (komenda debug); `false`, gdy nieznana albo któraś już otwarta. */
  open(id: HubStationId): boolean {
    if (this.current || !this.has(id)) return false;
    this.current = id;
    this.bus.emit('hub_station_opened', { station: id });
    return true;
  }

  /** Zamyka otwartą stację; kolejne naciśnięcie interakcji może otworzyć ją ponownie. */
  close(): HubStationId | null {
    const closed = this.current;
    this.current = null;
    return closed;
  }

  dispose(): void {
    this.current = null;
  }
}
