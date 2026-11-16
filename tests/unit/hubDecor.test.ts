import { FrontSide, Mesh, MeshBasicMaterial } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import { tuning } from '../../src/core/tuning';
import { HubDecor } from '../../src/scenes/hubDecor';
import { loadHubLayout } from '../../src/world/hubSchema';

afterEach(() => vi.unstubAllGlobals());

it('okładziny kryjówki są jednostronne i zwrócone od ściany do wnętrza', () => {
  const panels = loadHubLayout(hideoutData).panels!.filter(
    (panel) => panel.kind === 'tiles',
  );
  const decor = new HubDecor(panels, []);
  // Po scalaniu geometrii siatek jest mniej niż paneli: materiały sprawdzamy
  // na wszystkich siatkach, a orientację na każdym panelu z danych.
  let meshes = 0;
  decor.root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    const material = (object as Mesh<Mesh['geometry'], MeshBasicMaterial>)
      .material;
    expect(material.side).toBe(FrontSide);
    expect(material.depthTest).toBe(true);
  });
  expect(meshes).toBeGreaterThan(0);
  for (const panel of panels) {
    const nx = Math.sin(panel.yaw);
    const nz = Math.cos(panel.yaw);
    if (Math.abs(panel.position.x) > 19)
      expect(panel.position.x * nx).toBeLessThan(0);
    if (Math.abs(panel.position.z) > 6 && Math.abs(nz) > 0.9)
      expect(panel.position.z * nz).toBeLessThan(0);
  }
  decor.dispose();
});

it('płomień ma mały zasięg, ograniczoną jasność i test głębi również po migotaniu', () => {
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => null }),
  });
  const hub = structuredClone(tuning.hub);
  const decor = new HubDecor([], [], hideoutData.fires, hub);
  expect(decor.root.children).toHaveLength(hub.firePlanes);
  for (const dt of [0, 0.1, 0.5, 1]) {
    decor.update(dt);
    for (const object of decor.root.children) {
      const mesh = object as Mesh<Mesh['geometry'], MeshBasicMaterial>;
      const material = mesh.material;
      expect(material.depthTest).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.opacity).toBe(hub.fireOpacity);
      expect(material.color.r).toBe(hub.fireBrightness);
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox!;
      expect((bounds.max.x - bounds.min.x) * mesh.scale.x).toBeLessThan(0.5);
      expect((bounds.max.y - bounds.min.y) * mesh.scale.y).toBeLessThan(0.75);
    }
  }
  hub.fireBrightness = 0.2;
  decor.update(0);
  expect(
    (decor.root.children[0] as Mesh<Mesh['geometry'], MeshBasicMaterial>)
      .material.color.r,
  ).toBe(0.2);
  decor.dispose();
});
