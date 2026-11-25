import {
  Box3,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface StaticBatchOptions {
  /** Rozłączne naklejki na wspólnej płaszczyźnie nie wymagają sortowania względem siebie. */
  batchTransparent?: (mesh: Mesh) => boolean;
  /**
   * Bok komórki siatki XZ (m, w układzie korzenia). Siatki scala się tylko w obrębie
   * komórki zawierającej środek ich prostopadłościanu, żeby frustum culling dalej
   * odrzucał to, co poza kadrem. Bez wartości: jedna siatka na materiał.
   */
  cellSize?: number;
  /**
   * Zamiast stałej siatki: grupa o tym samym materiale dzieli się przestrzennie (mediana po
   * dłuższej osi XZ) tylko tak długo, aż jej suma trójkątów mieści się w budżecie, a rozrzut
   * środków przekracza `cellSize`. Mało trójkątów = jedno wywołanie rysowania na całą arenę.
   */
  triangleBudget?: number;
}

export interface PartitionItem {
  x: number;
  z: number;
  triangles: number;
}

/**
 * Dzieli elementy na grupy, z których każda ma co najwyżej `budget` trójkątów albo rozrzut
 * środków nie większy niż `minExtentM` (po obu osiach XZ). Wynik jest deterministyczny.
 */
export function partitionByTriangles<T extends PartitionItem>(
  items: readonly T[],
  budget: number,
  minExtentM: number,
): T[][] {
  const leaves: T[][] = [];
  const stack: T[][] = [[...items]];
  while (stack.length) {
    const group = stack.pop()!;
    if (!group.length) continue;
    let total = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const item of group) {
      total += item.triangles;
      minX = Math.min(minX, item.x);
      maxX = Math.max(maxX, item.x);
      minZ = Math.min(minZ, item.z);
      maxZ = Math.max(maxZ, item.z);
    }
    if (
      group.length < 2 ||
      total <= budget ||
      (maxX - minX <= minExtentM && maxZ - minZ <= minExtentM)
    ) {
      leaves.push(group);
      continue;
    }
    const alongX = maxX - minX >= maxZ - minZ;
    group.sort((a, b) =>
      alongX ? a.x - b.x || a.z - b.z : a.z - b.z || a.x - b.x,
    );
    let sum = 0;
    let cut = group.length - 1;
    for (let i = 0; i < group.length; i++) {
      sum += group[i]!.triangles;
      if (sum >= total / 2) {
        cut = Math.min(Math.max(i + 1, 1), group.length - 1);
        break;
      }
    }
    stack.push(group.slice(cut), group.slice(0, cut));
  }
  return leaves;
}

/** Klon GLB przed instancingiem: jedna geometria na zgodny materiał zamiast na detal. */
export function batchInstancedTemplate(
  root: Object3D,
  ownedGeometries: Set<BufferGeometry>,
): void {
  batchStaticGeometry(root, ownedGeometries);
}

/** Właścicielem płaszczyzn decali jest scena. Po scaleniu zwalniamy źródła. */
export function batchStaticDecals(root: Object3D, decals: Mesh[]): void {
  if (decals.length < 2) return;
  const bounds = decals.map((mesh) => new Box3().setFromObject(mesh));
  // Nakładające się warstwy alfa nadal sortuje renderer dla bieżącej kamery.
  const disjoint = new Set(
    decals.filter(
      (_, i) =>
        !bounds.some((box, j) => i !== j && box.intersectsBox(bounds[i]!)),
    ),
  );
  batchStaticGeometry(root, new Set(), {
    batchTransparent: (mesh) => disjoint.has(mesh),
  });
  for (const mesh of decals) if (!mesh.parent) mesh.geometry.dispose();
}

/** Wyłącznie korzenie statyczne. Oryginały należą do cache/modelu, wynik do sceny. */
export function batchStaticGeometry(
  root: Object3D,
  ownedGeometries: Set<BufferGeometry>,
  options: StaticBatchOptions = {},
): void {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const cellSize = options.cellSize;
  const triangleBudget = options.triangleBudget;
  const placement = new Map<Mesh, PartitionItem>();
  const bounds = new Box3();
  const center = new Vector3();
  const groups = new Map<
    string,
    { meshes: Mesh[]; noOutline: boolean; bloom: unknown }
  >();
  root.traverseVisible((object) => {
    if (
      !(object instanceof Mesh) ||
      ('isInstancedMesh' in object && object.isInstancedMesh) ||
      ('isSkinnedMesh' in object && object.isSkinnedMesh) ||
      ('isBatchedMesh' in object && object.isBatchedMesh) ||
      Array.isArray(object.material) ||
      (object.material.transparent && !options.batchTransparent?.(object)) ||
      object.morphTargetInfluences ||
      object.children.length ||
      object.onBeforeRender !== Object3D.prototype.onBeforeRender ||
      object.onAfterRender !== Object3D.prototype.onAfterRender ||
      object.customDepthMaterial ||
      object.customDistanceMaterial
    )
      return;
    const geometry: BufferGeometry = object.geometry;
    if (
      geometry.drawRange.start !== 0 ||
      geometry.drawRange.count !== Infinity ||
      Object.keys(geometry.morphAttributes).length
    )
      return;
    const matrix = new Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    // Odbite transformacje wymagają odwrócenia windingu; pozostają osobno.
    if (matrix.determinant() <= 0) return;
    let cell: [number, number] | null = null;
    if (cellSize) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      bounds.copy(geometry.boundingBox!).applyMatrix4(matrix).getCenter(center);
      if (triangleBudget)
        placement.set(object, {
          x: center.x,
          z: center.z,
          triangles:
            (geometry.index?.count ?? geometry.attributes.position!.count) / 3,
        });
      else
        cell = [
          Math.floor(center.x / cellSize),
          Math.floor(center.z / cellSize),
        ];
    }
    let noOutline = false;
    let bloom: unknown = object.userData.bloom;
    for (
      let ancestor: Object3D | null = object;
      ancestor;
      ancestor = ancestor.parent
    ) {
      noOutline ||= ancestor.userData.noOutline === true;
      bloom ??= ancestor.userData.bloom;
      if (ancestor === root) break;
    }
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (
      attributes.some(
        ([, attribute]) => 'isInterleavedBufferAttribute' in attribute,
      )
    )
      return;
    // GLTFLoader kopiuje nazwę węzła do extras; nie jest stanem renderowania.
    const metadata = { ...object.userData };
    delete metadata.name;
    const key = JSON.stringify([
      object.material.uuid,
      object.layers.mask,
      object.renderOrder,
      object.castShadow,
      object.receiveShadow,
      object.frustumCulled,
      cell,
      noOutline,
      bloom,
      metadata,
      !!geometry.index,
      attributes.map(([name, attr]) => [
        name,
        attr.itemSize,
        attr.normalized,
        attr.array.constructor.name,
      ]),
    ]);
    let group = groups.get(key);
    if (!group) {
      group = { meshes: [], noOutline, bloom };
      groups.set(key, group);
    }
    group.meshes.push(object);
  });
  const batches: { meshes: Mesh[]; noOutline: boolean; bloom: unknown }[] = [];
  for (const group of groups.values()) {
    if (!triangleBudget || !cellSize) {
      batches.push(group);
      continue;
    }
    const items = group.meshes.map((mesh) => ({
      mesh,
      ...placement.get(mesh)!,
    }));
    for (const leaf of partitionByTriangles(items, triangleBudget, cellSize))
      batches.push({
        meshes: leaf.map((item) => item.mesh),
        noOutline: group.noOutline,
        bloom: group.bloom,
      });
  }
  for (const { meshes, noOutline, bloom } of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(
        new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
      );
      geometry.clearGroups();
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    for (const temporary of geometries) temporary.dispose();
    if (!geometry) continue;
    const first = meshes[0]!;
    const merged = new Mesh(geometry, first.material);
    merged.name = `static:${Array.isArray(first.material) ? '' : first.material.name}`;
    merged.layers.mask = first.layers.mask;
    merged.renderOrder = first.renderOrder;
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.frustumCulled = first.frustumCulled;
    merged.userData = { ...first.userData, noOutline };
    delete merged.userData.name;
    if (bloom !== undefined) merged.userData.bloom = bloom;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    ownedGeometries.add(geometry);
    root.add(merged);
    for (const mesh of meshes) mesh.removeFromParent();
  }
}
