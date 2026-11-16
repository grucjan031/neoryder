import { expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Box3,
  Color,
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Matrix3,
  Matrix4,
  SkinnedMesh,
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

it.each([
  'transparent',
  'instances',
  'skinned',
  'callback',
  'array',
  'negative',
  'hidden',
])('nie scala pary: %s', (kind) => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  material.transparent = kind === 'transparent';
  const objects = Array.from({ length: 2 }, (_, index) => {
    const mesh =
      kind === 'instances'
        ? new InstancedMesh(geometry, material, 2)
        : kind === 'skinned'
          ? new SkinnedMesh(geometry, material)
          : new Mesh(geometry, kind === 'array' ? [material] : material);
    mesh.position.x = index * 20;
    if (kind === 'negative') mesh.scale.x = -1;
    if (kind === 'callback') mesh.onBeforeRender = () => {};
    if (kind === 'hidden') mesh.visible = false;
    if (mesh instanceof InstancedMesh) {
      mesh.setMatrixAt(0, new Matrix4().makeTranslation(3, 2, 1));
      mesh.setMatrixAt(1, new Matrix4().makeTranslation(8, 4, 6));
      mesh.setColorAt(0, new Color(0xffaa00));
      mesh.setColorAt(1, new Color(0x00aa00));
    }
    return mesh;
  });
  root.add(...objects);
  const bounds =
    kind === 'instances' ? new Box3().setFromObject(root).clone() : null;
  const matrices = objects.map((mesh) =>
    mesh instanceof InstancedMesh ? mesh.instanceMatrix.array.slice() : null,
  );
  const colors = objects.map((mesh) =>
    mesh instanceof InstancedMesh ? mesh.instanceColor!.array.slice() : null,
  );
  const owned = new Set<BufferGeometry>();
  batchStaticGeometry(root, owned);
  expect(root.children).toHaveLength(2);
  objects.forEach((mesh, index) => expect(root.children[index]).toBe(mesh));
  expect(owned.size).toBe(0);
  if (bounds) expect(new Box3().setFromObject(root)).toEqual(bounds);
  objects.forEach((mesh, index) => {
    if (mesh instanceof InstancedMesh) {
      expect(mesh.count).toBe(2);
      expect(mesh.instanceMatrix.array).toEqual(matrices[index]);
      expect(mesh.instanceColor!.array).toEqual(colors[index]);
      expect(new Box3().setFromObject(mesh).min.toArray()).toEqual([
        index * 20 + 2.5,
        1.5,
        0.5,
      ]);
      expect(new Box3().setFromObject(mesh).max.toArray()).toEqual([
        index * 20 + 8.5,
        4.5,
        6.5,
      ]);
    }
  });
});

it('cellSize scala tylko w obrębie komórki XZ, żeby frustum culling dalej działał', () => {
  const root = new Group();
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const at = (x: number, z: number) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, 0, z);
    root.add(mesh);
  };
  // Komórka (0,0): dwie siatki; komórka (2,0): dwie; komórka (0,-1): jedna (zostaje).
  at(1, 1);
  at(3, 2);
  at(21, 1);
  at(24, 4);
  at(2, -3);
  const owned = new Set<BufferGeometry>();
  batchStaticGeometry(root, owned, { cellSize: 10 });
  const meshes = root.children.filter((child) => child instanceof Mesh);
  expect(owned.size).toBe(2);
  expect(meshes).toHaveLength(3);
  for (const geometry of owned) {
    const box = geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeLessThan(10);
    expect(box.max.z - box.min.z).toBeLessThan(10);
  }
});
