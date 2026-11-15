import { expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { Vec3 } from '../../src/core/math';
import type { HubStationId } from '../../src/core/metaTypes';
import { tuning } from '../../src/core/tuning';
import { HubStations, selectHubFocus } from '../../src/world/hubStations';
import type { HubZone } from '../../src/world/hubStations';

const zones: HubZone[] = [
  { id: 'missions', position: { x: -6, z: 0 }, radius: 2 },
  { id: 'talents', position: { x: 6, z: 0 }, radius: 2 },
];
const focusY = tuning.hub.focusHeightM;
const eye = (x: number, z: number, y = focusY): Vec3 => ({ x, y, z });
const focus = (
  position: Vec3,
  yaw = 0,
  pitch = 0,
  stations = zones,
  targetY = focusY,
) =>
  selectHubFocus(
    stations,
    position,
    yaw,
    pitch,
    targetY,
    tuning.hub.interactAngleDeg,
  );

it('wybór wymaga zasięgu poziomego i patrzenia na stację, uwzględnia granicę promienia', () => {
  expect(focus(eye(6, 2))).toBe('talents');
  expect(focus(eye(6, 2.001))).toBeNull();
  expect(focus(eye(6, 1), Math.PI)).toBeNull();
  expect(focus(eye(0, 0))).toBeNull();
  expect(focus(eye(0, 0), 0, 0, [])).toBeNull();
});

it('yaw 0 patrzy w −Z; poprawnie wybiera stacje po obu stronach gracza', () => {
  expect(focus(eye(5, 0), -Math.PI / 2)).toBe('talents');
  expect(focus(eye(-5, 0), Math.PI / 2)).toBe('missions');
});

it('granica kąta jest włączona, a przekroczenie jej odrzuca stację', () => {
  const angle = (tuning.hub.interactAngleDeg * Math.PI) / 180;
  expect(focus(eye(6, 1), angle)).toBe('talents');
  expect(focus(eye(6, 1), angle + 0.001)).toBeNull();
  expect(focus(eye(6, 1), -angle - 0.001)).toBeNull();
});

it('pitch i wysokość oka decydują o kącie do punktu stacji', () => {
  const above = eye(6, 1, focusY + 1);
  expect(focus(above)).toBeNull();
  expect(focus(above, 0, -Math.PI / 4)).toBe('talents');
  expect(focus(above, 0, Math.PI / 4)).toBeNull();
  const below = eye(6, 1, focusY - 1);
  expect(focus(below, 0, Math.PI / 4)).toBe('talents');
  expect(focus(above, 0, 0, zones, focusY + 1)).toBe('talents');
});

it('porównuje pełny kąt 3D, a nie osobne limity yaw i pitch', () => {
  const angle = (25 * Math.PI) / 180;
  expect(focus(eye(6, 1), angle, angle)).toBeNull();
});

it('wybiera najmniejszy kąt zamiast najbliższej stacji lub pierwszej z listy', () => {
  const overlapping: HubZone[] = [
    { id: 'missions', position: { x: 0.3, z: -1 }, radius: 3 },
    { id: 'talents', position: { x: 0, z: -2 }, radius: 3 },
  ];
  expect(focus(eye(0, 0), 0, 0, overlapping)).toBe('talents');
  expect(focus(eye(0, 0), -Math.atan2(0.3, 1), 0, overlapping)).toBe(
    'missions',
  );
});

it('pomija punkt pokrywający się z okiem, bez NaN ani otwierania stacji', () => {
  expect(focus(eye(6, 0))).toBeNull();
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
