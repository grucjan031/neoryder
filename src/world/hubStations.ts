import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { HubStationId } from '../core/metaTypes';

export interface HubZone {
  id: HubStationId;
  position: { x: number; z: number };
  radius: number;
}

export interface HubFocusBox {
  position: Vec3;
  size: Vec3;
}

/** Odległość trafienia promieniem o jednostkowym kierunku; null przy braku przecięcia. */
export function rayAabbDistance(
  origin: Vec3,
  direction: Vec3,
  box: HubFocusBox,
  padding = 0,
): number | null {
  let near = 0;
  let far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const half = box.size[axis] / 2 + padding;
    const min = box.position[axis] - half;
    const max = box.position[axis] + half;
    if (direction[axis] === 0) {
      if (origin[axis] < min || origin[axis] > max) return null;
      continue;
    }
    const first = (min - origin[axis]) / direction[axis];
    const second = (max - origin[axis]) / direction[axis];
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return null;
  }
  return near;
}

/** Wybiera najbliższe trafienie bryły stacji w zasięgu oka (yaw/pitch w radianach). */
export function selectHubFocus(
  zones: readonly (HubZone & { focus: HubFocusBox })[],
  eye: Vec3,
  yaw: number,
  pitch: number,
  interactRangeM: number,
  focusPaddingM: number,
): HubStationId | null {
  const forward = {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
  let nearest = Infinity;
  let focused: HubStationId | null = null;
  for (const zone of zones) {
    const distance = rayAabbDistance(eye, forward, zone.focus, focusPaddingM);
    if (distance !== null && distance <= interactRangeM && distance < nearest) {
      nearest = distance;
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
