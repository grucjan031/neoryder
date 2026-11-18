import { describe, expect, it } from 'vitest';
import { Sprite } from 'three';
import hideout from '../../src/data/hub/hideout.json';
import { HubStationMarkers } from '../../src/render/hubStationMarkers';
import { loadHubLayout } from '../../src/world/hubSchema';

describe('znaczniki stacji kryjówki', () => {
  const layout = loadHubLayout(hideout);
  const floorY = layout.playerSpawn.y;

  it('tworzy znacznik dla każdej stacji, także warsztatu', () => {
    const markers = new HubStationMarkers(layout.stations, floorY);
    const sprites = markers.root.children.flatMap((group) =>
      group.children.filter(
        (child): child is Sprite => child instanceof Sprite,
      ),
    );
    expect(sprites.map((sprite) => sprite.name).sort()).toEqual(
      layout.stations.map(({ id }) => `hub-station-marker:${id}`).sort(),
    );
    expect(layout.stations.some(({ id }) => id === 'workshop')).toBe(true);
    markers.dispose();
  });

  it('jest mocniejszy z daleka niż przy stacji', () => {
    const markers = new HubStationMarkers(layout.stations, floorY);
    const workshop = layout.stations.find(({ id }) => id === 'workshop')!;
    const sprite = (): Sprite =>
      markers.root.getObjectByName('hub-station-marker:workshop') as Sprite;
    markers.update(1 / 60, {
      x: workshop.position.x,
      y: 1.6,
      z: workshop.position.z,
    });
    const near = sprite().material.opacity;
    markers.update(1 / 60, {
      x: workshop.position.x + 40,
      y: 1.6,
      z: workshop.position.z,
    });
    const far = sprite().material.opacity;
    expect(far).toBeGreaterThan(near);
    expect(far).toBeCloseTo(1, 5);
    expect(near).toBeGreaterThan(0);
    markers.dispose();
    expect(markers.root.parent).toBeNull();
  });
});
