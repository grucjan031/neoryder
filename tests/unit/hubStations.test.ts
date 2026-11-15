import { expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import type { HubStationId } from '../../src/core/metaTypes';
import { tuning } from '../../src/core/tuning';
import {
  HubStations,
  selectHubFocus,
  rayAabbDistance,
} from '../../src/world/hubStations';
import type { HubZone } from '../../src/world/hubStations';

const zones = [
  {
    id: 'missions',
    position: { x: -6, z: 0 },
    radius: 2,
    focus: { position: { x: -6, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 } },
  },
  {
    id: 'talents',
    position: { x: 6, z: 0 },
    radius: 2,
    focus: { position: { x: 6, y: 1, z: 0 }, size: { x: 1, y: 2, z: 1 } },
  },
] satisfies (HubZone & { focus: { position: Vec3; size: Vec3 } })[];
const eye = (x: number, z: number, y = 1.6): Vec3 => ({ x, y, z });
const focus = (position: Vec3, yaw = 0, pitch = 0, stations = zones) =>
  selectHubFocus(
    stations,
    position,
    yaw,
    pitch,
    tuning.hub.interactRangeM,
    tuning.hub.focusPaddingM,
  );

it('trafienie z daleka mierzy zasięg do powierzchni bryły, nie środka strefy', () => {
  expect(focus(eye(6, 4.2))).toBe('talents');
  expect(focus(eye(6, 4.201))).toBeNull();
  expect(focus(eye(6, 3))).toBe('talents');
  expect(focus(eye(6, 1.3))).toBe('talents');
  expect(focus(eye(6, 1.3), 0, -0.3)).toBe('talents');
});

it('patrzenie obok lub za siebie nie wybiera stacji', () => {
  expect(focus(eye(6, 1.3), Math.PI)).toBeNull();
  expect(focus(eye(6, 1.3), Math.PI / 2)).toBeNull();
  expect(focus(eye(6, 1.3), 0, Math.PI / 2)).toBeNull();
  expect(focus(eye(0, 0))).toBeNull();
  expect(focus(eye(0, 0), 0, 0, [])).toBeNull();
});

it('yaw 0 patrzy w −Z; wybiera stacje po obu stronach gracza', () => {
  expect(focus(eye(5, 0), -Math.PI / 2)).toBe('talents');
  expect(focus(eye(-5, 0), Math.PI / 2)).toBe('missions');
});

it('wybiera najbliższe trafienie niezależnie od kolejności danych', () => {
  const near = {
    ...zones[0]!,
    focus: {
      position: { x: 6, y: 1, z: 2 },
      size: { x: 1, y: 2, z: 1 },
    },
  };
  expect(focus(eye(6, 4), 0, 0, [zones[1]!, near])).toBe('missions');
  expect(focus(eye(6, 4), 0, 0, [near, zones[1]!])).toBe('missions');
});

it('ray–AABB obsługuje promienie równoległe, padding, oko wewnątrz i bryłę za okiem', () => {
  const box = zones[1]!.focus;
  expect(rayAabbDistance(eye(6, 2), { x: 0, y: 0, z: -1 }, box)).toBe(1.5);
  expect(rayAabbDistance(eye(6.6, 2), { x: 0, y: 0, z: -1 }, box)).toBeNull();
  expect(rayAabbDistance(eye(6.6, 2), { x: 0, y: 0, z: -1 }, box, 0.2)).toBe(
    1.3,
  );
  expect(rayAabbDistance(eye(6, 0), { x: 0, y: 0, z: -1 }, box)).toBe(0);
  expect(rayAabbDistance(eye(6, 2), { x: 0, y: 0, z: 1 }, box)).toBeNull();
});

function setup() {
  const bus = new EventBus();
  const opened: HubStationId[] = [];
  bus.on('hub_station_opened', ({ station }) => opened.push(station));
  return { opened, stations: new HubStations(zones, bus) };
}

it('sam wybór stacji nie otwiera nakładki ani nie emituje zdarzenia', () => {
  const { stations, opened } = setup();
  expect(focus(eye(6, 1))).toBe('talents');
  expect(stations.opened).toBeNull();
  expect(opened).toEqual([]);
});

it('open emituje zdarzenie raz, blokuje inne nakładki i pozwala otworzyć ponownie po close', () => {
  const { stations, opened } = setup();
  expect(stations.open('missions')).toBe(true);
  expect(stations.open('missions')).toBe(false);
  expect(stations.open('talents')).toBe(false);
  expect(stations.opened).toBe('missions');
  expect(stations.close()).toBe('missions');
  expect(stations.open('missions')).toBe(true);
  expect(opened).toEqual(['missions', 'missions']);
});

it('open odrzuca stację spoza układu, close bez otwartej zwraca null, dispose zeruje stan', () => {
  const { stations, opened } = setup();
  expect(stations.open('arena')).toBe(false);
  expect(stations.close()).toBeNull();
  expect(opened).toEqual([]);
  stations.open('talents');
  stations.dispose();
  expect(stations.opened).toBeNull();
});
