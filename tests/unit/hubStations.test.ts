import { expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { HubStationId } from '../../src/core/metaTypes';
import { HubStations } from '../../src/world/hubStations';
import type { HubZone } from '../../src/world/hubStations';

const zones: HubZone[] = [
  { id: 'missions', position: { x: -6, z: 0 }, radius: 2 },
  { id: 'talents', position: { x: 6, z: 0 }, radius: 2 },
];

function setup(margin = 0.5) {
  const bus = new EventBus();
  const opened: HubStationId[] = [];
  bus.on('hub_station_opened', ({ station }) => opened.push(station));
  return { bus, opened, stations: new HubStations(zones, bus, margin) };
}

it('wejście w promień otwiera stację i emituje hub_station_opened raz', () => {
  const { stations, opened } = setup();
  expect(stations.update(0, 0)).toBeNull();
  expect(stations.update(3.5, 0)).toBeNull();
  expect(stations.update(4, 0)).toBe('talents');
  stations.update(5, 0);
  stations.update(6, 0);
  expect(opened).toEqual(['talents']);
  expect(stations.opened).toBe('talents');
});

it('przy otwartej stacji inne strefy się nie otwierają', () => {
  const { stations, opened } = setup();
  stations.update(6, 0);
  stations.update(-6, 0);
  expect(opened).toEqual(['talents']);
});

it('histereza: po zamknięciu ta sama stacja nie otwiera się bez wyjścia poza promień z marginesem', () => {
  const { stations, opened } = setup(0.5);
  stations.update(6, 0);
  expect(stations.close()).toBe('talents');
  expect(stations.opened).toBeNull();
  stations.update(6, 0);
  stations.update(4.2, 0); // wciąż w promieniu
  stations.update(3.7, 0); // poza promieniem, ale w marginesie
  stations.update(4.1, 0); // ponowne wejście w promień nadal zablokowane
  expect(opened).toEqual(['talents']);
  stations.update(3.4, 0); // poza promieniem i marginesem: odblokowanie
  expect(opened).toEqual(['talents']);
  stations.update(5, 0);
  expect(opened).toEqual(['talents', 'talents']);
});

it('zamknięcie jednej stacji nie blokuje innej', () => {
  const { stations, opened } = setup();
  stations.update(6, 0);
  stations.close();
  stations.update(-6, 0);
  expect(opened).toEqual(['talents', 'missions']);
});

it('open z komendy debug omija położenie, a close blokuje do wyjścia ze strefy', () => {
  const { stations, opened } = setup();
  expect(stations.open('missions')).toBe(true);
  expect(stations.open('talents')).toBe(false);
  expect(stations.opened).toBe('missions');
  stations.close();
  stations.update(0, 0); // gracz daleko od strefy: blokada zdjęta
  stations.update(-6, 0);
  expect(opened).toEqual(['missions', 'missions']);
});

it('open odrzuca stację spoza układu, a close bez otwartej stacji zwraca null', () => {
  const { stations, opened } = setup();
  expect(stations.open('arena')).toBe(false);
  expect(stations.close()).toBeNull();
  expect(opened).toEqual([]);
});

it('zoneAt wskazuje stację w promieniu, dispose zeruje stan', () => {
  const { stations } = setup();
  expect(stations.zoneAt(-5, 1)).toBe('missions');
  expect(stations.zoneAt(0, 0)).toBeNull();
  stations.open('talents');
  stations.dispose();
  expect(stations.opened).toBeNull();
});
