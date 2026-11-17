import { AdditiveBlending, FrontSide, Mesh, MeshBasicMaterial } from 'three';
import type { PlaneGeometry } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import hideoutData from '../../src/data/hub/hideout.json';
import { tuning } from '../../src/core/tuning';
import { HubDecor } from '../../src/scenes/hubDecor';
import { loadHubLayout } from '../../src/world/hubSchema';
import { wallDecalFitsBlock } from '../../src/world/dressingSchema';

afterEach(() => vi.unstubAllGlobals());

it('napisy układu i stacji rysują tekst na płótnie i zwalniają zasoby', () => {
  const context = {
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    measureText: () => ({ width: 200 }),
    fillText: vi.fn(),
    fillStyle: '',
  };
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => context }),
  });
  const layout = loadHubLayout(hideoutData);
  const station = layout.stations.find(({ sign }) => sign)!;
  const text = layout.neonTexts![0]!;
  const decor = new HubDecor([], [station], [], tuning.hub, [text]);
  expect(context.fillText.mock.calls.map(([value]) => value)).toEqual([
    station.label,
    text.text,
  ]);
  expect(context.fillStyle).toBe(text.color);
  const mesh = decor.root.getObjectByName(`neonText:${text.text}`) as Mesh<
    PlaneGeometry,
    MeshBasicMaterial
  >;
  expect(mesh).toBeInstanceOf(Mesh);
  expect(mesh.position.toArray()).toEqual([
    text.position.x,
    text.position.y,
    text.position.z,
  ]);
  expect(mesh.rotation.y).toBe(text.yaw);
  expect(mesh.geometry.parameters).toMatchObject({
    width: text.size.w,
    height: text.size.h,
  });
  expect(mesh.material.blending).toBe(AdditiveBlending);
  expect(mesh.material.userData.bloom).toBe(true);
  expect(mesh.material.depthTest).toBe(true);
  expect(mesh.material.depthWrite).toBe(false);
  expect(mesh.material.map).not.toBeNull();
  const disposeGeometry = vi.spyOn(mesh.geometry, 'dispose');
  const disposeMaterial = vi.spyOn(mesh.material, 'dispose');
  const disposeTexture = vi.spyOn(mesh.material.map!, 'dispose');
  decor.dispose();
  expect(disposeGeometry).toHaveBeenCalledOnce();
  expect(disposeMaterial).toHaveBeenCalledOnce();
  expect(disposeTexture).toHaveBeenCalledOnce();
  expect(decor.root.children).toHaveLength(0);
});

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
    // Skrzydła mają własne wnętrza: normalna prowadzi od nośnika w wolną przestrzeń.
    const blocks = loadHubLayout(hideoutData).blocks;
    const support = blocks.find((block) =>
      wallDecalFitsBlock({ ...panel, surface: 'wall' }, block, 0.04),
    );
    expect(support).toBeDefined();
    expect(
      (panel.position.x - support!.position.x) * nx +
        (panel.position.z - support!.position.z) * nz,
    ).toBeGreaterThan(0);
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
