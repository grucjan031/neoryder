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

export function lookDirection(yaw: number, pitch: number): Vec3 {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}

/** Cel interakcji w kryjówce: stacja albo NPC. */
export type HubTarget =
  | { kind: 'station'; id: HubStationId }
  | { kind: 'npc'; id: string }
  | { kind: 'prop'; id: string };

/** Cel trafiony promieniem z oka: bryła i odległość wejścia promienia (z marginesem). */
export interface HubTargetCandidate {
  target: HubTarget;
  focus: HubFocusBox;
  distanceM: number;
}

/** Wszystkie cele (stacje, NPC, rekwizyty) trafione promieniem z oka w zasięgu, od najbliższego (yaw/pitch w radianach). */
export function hubTargetCandidates(
  stations: readonly (HubZone & { focus: HubFocusBox })[],
  npcs: readonly { id: string; focus: HubFocusBox }[],
  eye: Vec3,
  yaw: number,
  pitch: number,
  interactRangeM: number,
  focusPaddingM: number,
  props: readonly { id: string; focus: HubFocusBox }[] = [],
): HubTargetCandidate[] {
  const forward = lookDirection(yaw, pitch);
  const found: HubTargetCandidate[] = [];
  const consider = (focus: HubFocusBox, hit: () => HubTarget): void => {
    const distanceM = rayAabbDistance(eye, forward, focus, focusPaddingM);
    if (distanceM !== null && distanceM <= interactRangeM)
      found.push({ target: hit(), focus, distanceM });
  };
  for (const zone of stations)
    consider(zone.focus, () => ({ kind: 'station', id: zone.id }));
  for (const npc of npcs)
    consider(npc.focus, () => ({ kind: 'npc', id: npc.id }));
  for (const prop of props)
    consider(prop.focus, () => ({ kind: 'prop', id: prop.id }));
  return found.sort((a, b) => a.distanceM - b.distanceM);
}

/**
 * Wybiera najbliższy cel (stację, NPC lub rekwizyt) trafiony promieniem z oka w zasięgu. Gdy podano `blocked`
 * (np. przesłona ścianą), pomija zasłonięte cele i bierze kolejny niezasłonięty.
 */
export function selectHubTarget(
  stations: readonly (HubZone & { focus: HubFocusBox })[],
  npcs: readonly { id: string; focus: HubFocusBox }[],
  eye: Vec3,
  yaw: number,
  pitch: number,
  interactRangeM: number,
  focusPaddingM: number,
  props: readonly { id: string; focus: HubFocusBox }[] = [],
  blocked?: (candidate: HubTargetCandidate) => boolean,
): HubTarget | null {
  const candidates = hubTargetCandidates(
    stations,
    npcs,
    eye,
    yaw,
    pitch,
    interactRangeM,
    focusPaddingM,
    props,
  );
  for (const candidate of candidates)
    if (!blocked?.(candidate)) return candidate.target;
  return null;
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
  const target = selectHubTarget(
    zones,
    [],
    eye,
    yaw,
    pitch,
    interactRangeM,
    focusPaddingM,
  );
  return target?.kind === 'station' ? target.id : null;
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
