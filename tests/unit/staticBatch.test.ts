import { expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Matrix3,
  Vector3,
} from 'three';
import { batchStaticGeometry } from '../../src/render/staticBatch';
import { hideNoOutline } from '../../src/render/noOutline';
import { Scene } from 'three';

it('zachowuje światowe pozycje, normalne, UV, materiał i zasoby cache', () => {
  const root = new Group();
  root.position.set(3, 5, 7);
  root.rotation.y = 0.7;
  const parent = new Group();
  parent.rotation.x = 0.3;
  parent.scale.set(2, 3, 4);
  root.add(parent);
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  material.userData.bloom = true;
  const original = geometry.getAttribute('position').array.slice();
  const first = new Mesh(geometry, material);
  const second = new Mesh(geometry, material);
  second.position.set(4, 1, 2);
  parent.add(first, second);
  root.updateMatrixWorld(true);
  const worldPositions = [first, second].flatMap((mesh) =>
    Array.from(
      { length: geometry.getAttribute('position').count },
      (_, index) =>
        new Vector3()
          .fromBufferAttribute(geometry.getAttribute('position'), index)
          .applyMatrix4(mesh.matrixWorld),
    ),
  );
  const worldNormals = [first, second].flatMap((mesh) =>
    Array.from({ length: geometry.getAttribute('normal').count }, (_, index) =>
      new Vector3()
        .fromBufferAttribute(geometry.getAttribute('normal'), index)
        .applyNormalMatrix(new Matrix3().getNormalMatrix(mesh.matrixWorld)),
    ),
  );
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeMaterial = vi.spyOn(material, 'dispose');
  const owned = new Set<BufferGeometry>();
  batchStaticGeometry(root, owned);
  const merged = root.children.find((child) => child instanceof Mesh) as Mesh;
  root.updateMatrixWorld(true);
  expect(owned.size).toBe(1);
  expect(merged.material).toBe(material);
  expect(geometry.getAttribute('position').array).toEqual(original);
  const position = merged.geometry.getAttribute('position');
  for (const [index, expected] of worldPositions.entries()) {
    expect(
      new Vector3()
        .fromBufferAttribute(position, index)
        .applyMatrix4(merged.matrixWorld)
        .distanceTo(expected),
    ).toBeLessThan(0.00001);
    expect(
      new Vector3()
        .fromBufferAttribute(merged.geometry.getAttribute('normal'), index)
        .applyNormalMatrix(new Matrix3().getNormalMatrix(merged.matrixWorld))
        .distanceTo(worldNormals[index]!),
    ).toBeLessThan(0.00001);
    const uv = merged.geometry.getAttribute('uv');
    const sourceIndex = index % geometry.getAttribute('uv').count;
    expect(uv.getX(index)).toBe(geometry.getAttribute('uv').getX(sourceIndex));
    expect(uv.getY(index)).toBe(geometry.getAttribute('uv').getY(sourceIndex));
  }
  expect(merged.geometry.getAttribute('normal').count).toBe(position.count);
  for (const output of owned) output.dispose();
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeMaterial).not.toHaveBeenCalled();
});

it('rozdziela warstwy i flagi, dziedziczy noOutline oraz bloom rodzica', () => {
  const root = new Scene();
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  for (const variant of ['plain', 'layer', 'outline', 'bloom']) {
    const parent = new Group();
    if (variant === 'outline') parent.userData.noOutline = true;
    if (variant === 'bloom') parent.userData.bloom = false;
    for (let i = 0; i < 2; i++) {
      const mesh = new Mesh(geometry, material);
      if (variant === 'layer') mesh.layers.set(1);
      parent.add(mesh);
    }
    root.add(parent);
  }
  const owned = new Set<BufferGeometry>();
  batchStaticGeometry(root, owned);
  expect(owned.size).toBe(4);
  const meshes = root.children.filter((child) => child instanceof Mesh);
  expect(meshes.filter((mesh) => mesh.layers.mask === 2)).toHaveLength(1);
  expect(meshes.filter((mesh) => mesh.userData.bloom === false)).toHaveLength(
    1,
  );
  const restore = hideNoOutline(root);
  expect(meshes.filter((mesh) => !mesh.visible)).toHaveLength(1);
  restore();
  expect(meshes.every((mesh) => mesh.visible)).toBe(true);
});

it('pozostawia przezroczystości, instancje, niewidoczne i odbite obiekty oraz callbacki', () => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const transparent = new MeshBasicMaterial({ transparent: true });
  const objects = [
    new Mesh(geometry, transparent),
    new InstancedMesh(geometry, material, 2),
    new Mesh(geometry, material),
    new Mesh(geometry, material),
    new Mesh(geometry, material),
  ];
  objects[2]!.visible = false;
  objects[3]!.scale.x = -1;
  objects[4]!.onBeforeRender = () => {};
  root.add(...objects);
  const owned = new Set<BufferGeometry>();
  batchStaticGeometry(root, owned);
  expect(root.children).toEqual(objects);
  expect(owned.size).toBe(0);
});
