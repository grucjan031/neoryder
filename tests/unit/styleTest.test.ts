import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { getMaterial } from '../../src/render/materials';
import { StyleTest } from '../../src/scenes/styleTest';

const active: StyleTest[] = [];
afterEach(() => {
  for (const scene of active.splice(0)) scene.dispose();
  vi.restoreAllMocks();
});

async function init(loadModels: boolean) {
  const scene = new StyleTest(loadModels);
  const three = new ThreeScene();
  const background = new Color('#abcdef');
  three.background = background;
  const camera = new PerspectiveCamera();
  active.push(scene);
  await scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('style-test'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning,
      debug: false,
      camera,
    },
    three,
  );
  return { scene, three, camera, background };
}

it('fallback pokazuje wszystkie role kolorów, instancje i statyczną kamerę bez symulacji', async () => {
  const { scene, three, camera, background } = await init(false);
  expect(scene.id).toBe('style-test');
  const materials = new Set();
  const instances: InstancedMesh[] = [];
  three.traverse((object) => {
    if (object instanceof Mesh) {
      const list = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of list) materials.add(material);
    }
    if (object instanceof InstancedMesh) instances.push(object);
  });
  for (const kind of [
    'world',
    'enemy',
    'enemyGlow',
    'interactive',
    'player',
    'power',
  ] as const) {
    expect(materials.has(getMaterial(kind))).toBe(true);
  }
  expect(instances.map((mesh) => mesh.count)).toEqual([3, 2, 2]);
  for (const name of [
    'enemy_trooper',
    'enemy_gunner',
    'plasma_blade',
    'blaster',
    'enemy_projectile',
    'weapon-stand',
  ]) {
    expect(three.getObjectByName(name)).toBeDefined();
  }
  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  scene.step();
  scene.render();
  expect(camera.position).toEqual(position);
  expect(camera.quaternion.equals(quaternion)).toBe(true);
  const materialDispose = vi.spyOn(getMaterial('world'), 'dispose');
  const geometryDispose = vi.spyOn(instances[0]!.geometry, 'dispose');
  scene.dispose();
  expect(three.children).toHaveLength(0);
  expect(three.background).toBe(background);
  expect(geometryDispose).toHaveBeenCalledOnce();
  expect(materialDispose).not.toHaveBeenCalled();
});

it('błąd ładowania GLB pozostawia komplet fallbacków bez błędów konsoli', async () => {
  const load = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockRejectedValue(new Error('missing'));
  const error = vi.spyOn(console, 'error');
  const { three } = await init(true);
  expect(load).toHaveBeenCalledTimes(10);
  expect(three.getObjectByName('enemy_trooper')).toBeDefined();
  expect(three.getObjectByName('crate_small')).toBeDefined();
  expect(error).not.toHaveBeenCalled();
});

it('ładuje GLB, podmienia materiał i współdzieli geometrię powtarzalnych modeli', async () => {
  const originals: MeshBasicMaterial[] = [];
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => {
    const source = new Group();
    const material = new MeshBasicMaterial();
    material.name = 'mat_interactive';
    vi.spyOn(material, 'dispose');
    originals.push(material);
    source.add(new Mesh(new BoxGeometry(), material));
    return { scene: source } as GLTF;
  });
  const { three } = await init(true);
  const walls = three.getObjectByName('wall_segment') as InstancedMesh;
  expect(walls).toBeInstanceOf(InstancedMesh);
  expect(walls.count).toBe(3);
  expect(walls.material).toBe(getMaterial('interactive'));
  const trooper = three.getObjectByName('enemy_trooper')!;
  expect((trooper.children[0] as Mesh).material).toBe(
    getMaterial('interactive'),
  );
  for (const material of originals)
    expect(material.dispose).toHaveBeenCalledOnce();
});
