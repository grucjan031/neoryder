import type { EventBus } from '../core/events';
import type { HubStationId } from '../core/metaTypes';

export interface HubZone {
  id: HubStationId;
  position: { x: number; z: number };
  radius: number;
}

/**
 * Strefy stacji kryjówki bez DOM i renderu. Wejście w promień otwiera stację
 * (`hub_station_opened`); po zamknięciu ta sama stacja otwiera się ponownie dopiero
 * po wyjściu poza promień powiększony o `exitMarginM` (histereza).
 */
export class HubStations {
  private current: HubStationId | null = null;
  private locked: HubStationId | null = null;

  constructor(
    private readonly zones: readonly HubZone[],
    private readonly bus: EventBus,
    private readonly exitMarginM: number,
  ) {}

  get opened(): HubStationId | null {
    return this.current;
  }

  has(id: HubStationId): boolean {
    return this.zones.some((zone) => zone.id === id);
  }

  /** Stacja, w której promieniu leży punkt (pierwsza z listy), albo `null`. */
  zoneAt(x: number, z: number): HubStationId | null {
    return (
      this.zones.find((zone) => this.distance(zone, x, z) <= zone.radius)?.id ??
      null
    );
  }

  /** Wywołuj co krok symulacji z pozycją gracza; zwraca otwartą stację. */
  update(x: number, z: number): HubStationId | null {
    const locked =
      this.locked && this.zones.find((zone) => zone.id === this.locked);
    if (
      locked &&
      this.distance(locked, x, z) > locked.radius + this.exitMarginM
    )
      this.locked = null;
    if (this.current) return this.current;
    for (const zone of this.zones)
      if (zone.id !== this.locked && this.distance(zone, x, z) <= zone.radius) {
        this.open(zone.id);
        break;
      }
    return this.current;
  }

  /** Otwiera stację niezależnie od położenia gracza (komenda debug); `false`, gdy nieznana albo któraś już otwarta. */
  open(id: HubStationId): boolean {
    if (this.current || !this.has(id)) return false;
    this.current = id;
    this.bus.emit('hub_station_opened', { station: id });
    return true;
  }

  /** Zamyka otwartą stację i blokuje jej ponowne otwarcie do wyjścia ze strefy. */
  close(): HubStationId | null {
    const closed = this.current;
    this.current = null;
    this.locked = closed;
    return closed;
  }

  dispose(): void {
    this.current = null;
    this.locked = null;
  }

  private distance(zone: HubZone, x: number, z: number): number {
    return Math.hypot(x - zone.position.x, z - zone.position.z);
  }
}
