import { tuning } from '../core/tuning';
import type { HubLayout, HubZoneColor } from './hubSchema';

export interface HubMapPoint {
  x: number;
  y: number;
}
/** Podpis strefy w rogu jej prostokąta; `anchor` start = lewy górny róg, end = prawy górny. */
export interface HubMapCaption extends HubMapPoint {
  anchor: 'start' | 'end';
}
export interface HubMapZone {
  id: string;
  label: string;
  color: HubZoneColor;
  x: number;
  y: number;
  w: number;
  h: number;
  /** `null`: strefa za mała na podpis (zostaje tylko `<title>` w UI). */
  caption: HubMapCaption | null;
}
export interface HubMapMarker {
  id: string;
  label: string;
  point: HubMapPoint;
}
export interface HubMapStation extends HubMapMarker {
  color: HubZoneColor;
}
export interface HubMapModel {
  /** Szerokość / wysokość obszaru planu (z marginesem); współrzędne x i y są w 0..1 niezależnie. */
  aspect: number;
  /** Od największej do najmniejszej, więc strefy zagnieżdżone rysują się nad rodzicem. */
  zones: HubMapZone[];
  stations: HubMapStation[];
  props: HubMapMarker[];
  player: HubMapPlayer;
}
export interface HubMapPlayer {
  point: HubMapPoint;
  headingRad: number;
}

/** Kolor znacznika stacji = kolor jej neonowego napisu w hali. */
export const HUB_MAP_STATION_COLORS: Record<string, HubZoneColor> = {
  missions: 'amber',
  workshop: 'green',
  talents: 'violet',
  arena: 'blue',
};

type MapLayout = Pick<HubLayout, 'blocks' | 'stations'> &
  Partial<Pick<HubLayout, 'zones' | 'props'>>;

interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Przekształcenie świata w 0..1 (osobno dla osi), wyznaczone raz na układ. */
export interface HubMapFrame {
  left: number;
  top: number;
  width: number;
  depth: number;
}

function boundsOf(layout: MapLayout): Rect {
  const rects: Rect[] = layout.zones?.length
    ? layout.zones.map((zone) => zone.rect)
    : layout.blocks.map((b) => ({
        x0: b.position.x - b.size.x / 2,
        z0: b.position.z - b.size.z / 2,
        x1: b.position.x + b.size.x / 2,
        z1: b.position.z + b.size.z / 2,
      }));
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    z0: Math.min(...rects.map((r) => r.z0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    z1: Math.max(...rects.map((r) => r.z1)),
  };
}

export function hubMapFrame(
  layout: MapLayout,
  paddingM: number = tuning.hub.mapPaddingM,
): HubMapFrame {
  const b = boundsOf(layout);
  return {
    left: b.x0 - paddingM,
    top: b.z0 - paddingM,
    width: b.x1 - b.x0 + paddingM * 2,
    depth: b.z1 - b.z0 + paddingM * 2,
  };
}

/** Gracz na planie: punkt 0..1 i kąt zgodny z ruchem wskazówek zegara od góry ekranu (yaw 0 patrzy w −Z, więc −yaw). */
export function hubMapPlayer(
  frame: HubMapFrame,
  playerPos: { x: number; z: number },
  playerYaw: number,
): HubMapPlayer {
  return {
    point: {
      x: (playerPos.x - frame.left) / frame.width,
      y: (playerPos.z - frame.top) / frame.depth,
    },
    headingRad: -playerYaw,
  };
}

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x0 >= outer.x0 &&
  inner.z0 >= outer.z0 &&
  inner.x1 <= outer.x1 &&
  inner.z1 <= outer.z1;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const area = (r: Rect): number => (r.x1 - r.x0) * (r.z1 - r.z0);

/**
 * Podpis w lewym górnym rogu; gdy róg zajmuje strefa zagnieżdżona albo stacja, w prawym górnym.
 * Strefa węższa albo płytsza niż próg nie dostaje podpisu.
 */
function captionFor(
  zone: { label: string; rect: Rect },
  all: { rect: Rect }[],
  stations: { position: { x: number; z: number } }[],
): { x: number; z: number; anchor: 'start' | 'end' } | null {
  const t = tuning.hub;
  const r = zone.rect;
  if (r.x1 - r.x0 < t.mapLabelMinWidthM || r.z1 - r.z0 < t.mapLabelMinDepthM)
    return null;
  const textW = Math.min(
    zone.label.length * t.mapLabelCharM,
    r.x1 - r.x0 - t.mapLabelMarginM * 2,
  );
  const top = r.z0 + t.mapLabelMarginM;
  const boxAt = (x0: number): Rect => ({
    x0,
    z0: r.z0,
    x1: x0 + textW + t.mapLabelMarginM,
    z1: top + t.mapLabelHeightM,
  });
  const left = boxAt(r.x0);
  const right = boxAt(r.x1 - textW - t.mapLabelMarginM);
  const children = all.filter(
    (other) => other.rect !== r && inside(other.rect, r),
  );
  const hitsChild = (box: Rect): boolean =>
    children.some((c) => overlaps(c.rect, box));
  const hitsStation = (box: Rect): boolean =>
    stations.some(
      ({ position }) =>
        position.x > box.x0 - 1 &&
        position.x < box.x1 + 1 &&
        position.z > box.z0 - 1 &&
        position.z < box.z1 + 1,
    );
  const leftAt = {
    x: r.x0 + t.mapLabelMarginM,
    z: top,
    anchor: 'start',
  } as const;
  const rightAt = {
    x: r.x1 - t.mapLabelMarginM,
    z: top,
    anchor: 'end',
  } as const;
  // Najpierw róg wolny od dzieci i stacji, potem tylko od dzieci, na końcu lewy.
  for (const clear of [
    (box: Rect) => !hitsChild(box) && !hitsStation(box),
    (box: Rect) => !hitsChild(box),
  ]) {
    if (clear(left)) return leftAt;
    if (clear(right)) return rightAt;
  }
  return leftAt;
}

/**
 * Model planu stacji (bez DOM i three). Plan północą w górę: oś −Z to góra ekranu, +X prawo.
 * Współrzędne x i y są w 0..1 względem obszaru stref z marginesem; proporcje zachowuje `aspect`.
 */
export function hubMapModel(
  layout: MapLayout,
  playerPos: { x: number; z: number },
  playerYaw: number,
  paddingM: number = tuning.hub.mapPaddingM,
): HubMapModel {
  const frame = hubMapFrame(layout, paddingM);
  const nx = (x: number): number => (x - frame.left) / frame.width;
  const ny = (z: number): number => (z - frame.top) / frame.depth;
  const point = (x: number, z: number): HubMapPoint => ({
    x: nx(x),
    y: ny(z),
  });
  const source = layout.zones ?? [];
  const zones = source
    .map((zone, index) => ({ zone, index }))
    .sort((a, b) => area(b.zone.rect) - area(a.zone.rect) || a.index - b.index)
    .map(({ zone }): HubMapZone => {
      const { id, label, rect, color } = zone;
      const cap = captionFor(zone, source, layout.stations);
      return {
        id,
        label,
        color: color ?? 'white',
        x: nx(rect.x0),
        y: ny(rect.z0),
        w: (rect.x1 - rect.x0) / frame.width,
        h: (rect.z1 - rect.z0) / frame.depth,
        caption: cap && { ...point(cap.x, cap.z), anchor: cap.anchor },
      };
    });
  return {
    aspect: frame.width / frame.depth,
    zones,
    stations: layout.stations.map((station) => ({
      id: station.id,
      label: station.label,
      color: HUB_MAP_STATION_COLORS[station.id] ?? 'white',
      point: point(station.position.x, station.position.z),
    })),
    props: (layout.props ?? [])
      .filter((prop) => prop.kind !== 'seat')
      .map((prop) => ({
        id: prop.id,
        label: prop.label,
        point: point(prop.focus.position.x, prop.focus.position.z),
      })),
    player: hubMapPlayer(frame, playerPos, playerYaw),
  };
}
