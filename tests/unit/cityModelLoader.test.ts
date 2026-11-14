import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { cloneCityModel, loadDecor } from '../../src/render/cityModels';
import { getMaterial } from '../../src/render/materials';

afterEach(() => vi.restoreAllMocks());

it('ładuje city GLB raz, mapuje materiały i zwraca niezależne transformacje', async () => {
  const source = new Group();
  const material = new MeshBasicMaterial();
  material.name = 'mat_metal';
  source.add(new Mesh(new BoxGeometry(), material));
  const dispose = vi.spyOn(material, 'dispose');
  const loader = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockResolvedValue({ scene: source } as GLTF);
  const first = await cloneCityModel('city_unit_test');
  const second = await cloneCityModel('city_unit_test');
  expect(loader).toHaveBeenCalledExactlyOnceWith(
    '/assets/models/city/city_unit_test.glb',
  );
  expect(first).not.toBe(second);
  first!.position.x = 10;
  expect(second!.position.x).toBe(0);
  expect((first!.children[0] as Mesh).material).toBe(getMaterial('metal'));
  expect(dispose).toHaveBeenCalledOnce();
});

it('dekoracje stosują yaw/scale, brak modelu jest pomijany z jednym ostrzeżeniem', async () => {
  const root = new Group();
  const loader = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockResolvedValue({ scene: new Group() } as GLTF);
  await loadDecor(
    root,
    [
      {
        model: 'city_decor_test',
        position: { x: 1, y: 2, z: 3 },
        yaw: 0.7,
        scale: 2,
      },
    ],
    true,
  );
  expect(root.children).toHaveLength(1);
  expect(root.children[0]!.position.toArray()).toEqual([1, 2, 3]);
  expect(root.children[0]!.rotation.y).toBe(0.7);
  expect(root.children[0]!.scale.toArray()).toEqual([2, 2, 2]);
  loader.mockRejectedValue(new Error('404'));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const missing = [
    { model: 'city_missing_test', position: { x: 0, y: 0, z: 0 } },
  ];
  await loadDecor(root, missing, true);
  await loadDecor(root, missing, true);
  expect(warning).toHaveBeenCalledOnce();
  expect(root.children).toHaveLength(1);
  expect(loader).toHaveBeenCalledTimes(2);
});

it('loadModels=false nie wykonuje żadnego requestu dla dekoracji', async () => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync');
  const root = new Group();
  await loadDecor(
    root,
    [{ model: 'city_skipped_test', position: { x: 0, y: 0, z: 0 } }],
    false,
  );
  expect(loader).not.toHaveBeenCalled();
  expect(root.children).toHaveLength(0);
});
