import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cloneRoomModel } from '../../src/scenes/roomModels';

afterEach(() => vi.restoreAllMocks());

it('wczytuje GLB raz, współdzieli geometrię i daje każdemu pokojowi osobne węzły', async () => {
  const scene = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  scene.add(new Mesh(geometry, material));
  const dispose = vi.spyOn(material, 'dispose');
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockResolvedValue({ scene } as Awaited<
      ReturnType<GLTFLoader['loadAsync']>
    >);
  const [first, second] = await Promise.all([
    cloneRoomModel('unit-room-cache'),
    cloneRoomModel('unit-room-cache'),
  ]);
  expect(load).toHaveBeenCalledExactlyOnceWith(
    '/assets/models/unit-room-cache.glb',
  );
  expect(dispose).toHaveBeenCalledOnce();
  expect(first).not.toBe(second);
  expect(first?.children[0]).not.toBe(second?.children[0]);
  expect((first?.children[0] as Mesh).geometry).toBe(geometry);
  first!.position.x = 10;
  expect(second?.position.x).toBe(0);
  expect(await cloneRoomModel('unit-room-cache')).not.toBe(first);
  expect(load).toHaveBeenCalledOnce();
  geometry.dispose();
});

it('cache błędu pozostawia bryłę zastępczą bez ponawiania pobrania w następnym pokoju', async () => {
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockRejectedValue(new Error('brak pliku'));
  expect(await cloneRoomModel('unit-missing-room-model')).toBeNull();
  expect(await cloneRoomModel('unit-missing-room-model')).toBeNull();
  expect(load).toHaveBeenCalledOnce();
});
