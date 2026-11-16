import { afterEach, expect, it } from 'vitest';
import { InstancedMesh, Mesh } from 'three';
import { tuning } from '../../src/core/tuning';
import { Panorama } from '../../src/render/panorama';
import { buildSkyline, SKY_PALETTE } from '../../src/render/skyline';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
});

const options = { floorY: 0, density: 0.65, height: 32, traffic: 0.6 };

it('panorama jest deterministyczna i ma punkty orientacyjne z bursztynowym światłem', () => {
  const a = buildSkyline('seed', options);
  expect(buildSkyline('seed', options)).toEqual(a);
  expect(buildSkyline('inny', options)).not.toEqual(a);
  // Trzy maszty (wieże orientacyjne), każdy z bursztynowym światłem na szczycie.
  const masts = a.buildings.filter((b) => b.kind === 1);
  expect(masts).toHaveLength(3);
  for (const mast of masts) {
    const top = mast.baseY + mast.height;
    expect(
      a.beacons.some(
        (b) =>
          b.color === 0 &&
          Math.abs(b.x - mast.x) < 1e-6 &&
          Math.abs(b.y - top) < 1,
      ),
    ).toBe(true);
  }
  expect(a.ads).toHaveLength(3);
  expect(a.lanes.length).toBeGreaterThan(0);
  expect(buildSkyline('seed', { ...options, traffic: 0 }).lanes).toHaveLength(
    0,
  );
});

it('warstwy rosną z odległością, a bryły nie wchodzą w pokój', () => {
  const { buildings } = buildSkyline('seed', options);
  const radius = (layer: number) =>
    buildings.filter((b) => b.layer === layer).map((b) => Math.hypot(b.x, b.z));
  for (let layer = 0; layer < 4; layer++)
    expect(radius(layer).length).toBeGreaterThan(5);
  expect(Math.min(...radius(0))).toBeGreaterThan(55);
  expect(Math.max(...radius(3))).toBeLessThan(180);
  expect(Math.min(...radius(3))).toBeGreaterThan(Math.max(...radius(0)));
});

it('kolory panoramy pochodzą tylko z palety otoczenia (bez czerwieni, cyanu i magenty)', () => {
  expect(SKY_PALETTE).toEqual([
    '#ffae1a',
    '#fff1d6',
    '#3d7bff',
    '#8a5cff',
    '#6dff4a',
  ]);
  const layout = buildSkyline('seed', options);
  const indices = [
    ...layout.buildings.flatMap((b) => [b.windowColor, b.accent]),
    ...layout.beacons.map((b) => b.color),
    ...layout.ads.map((a) => a.color),
  ].filter((i) => i >= 0);
  for (const i of indices) expect(i).toBeLessThan(SKY_PALETTE.length);
});

it('Panorama: 7 meshy, efekty bez konturu, kopuła nieba w podgrupie', () => {
  tuning.render.panoramaEnabled = 1;
  const panorama = new Panorama('seed', 0);
  panorama.sync(0);
  let meshes = 0;
  panorama.traverse((o) => {
    if (o instanceof Mesh) meshes++;
  });
  expect(meshes).toBe(7);
  const sky = panorama.getObjectByName('sky-dome') as Mesh;
  expect(sky.parent).not.toBe(panorama);
  expect(sky.userData.noOutline).toBe(true);
  for (const name of ['skyline-beacons', 'skyline-traffic'])
    expect(panorama.getObjectByName(name)?.userData.noOutline).toBe(true);
  const buildings = panorama.getObjectByName(
    'skyline-buildings',
  ) as InstancedMesh;
  expect(buildings.count).toBeGreaterThan(50);
  expect(buildings.material).toHaveProperty('userData.bloomMaterial');
  panorama.dispose();
  expect(panorama.children).toHaveLength(0);
});
