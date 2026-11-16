import { Matrix4, Mesh, Object3D, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Wyłącznie korzenie statyczne. Oryginały należą do cache/modelu, wynik do sceny. */
export function batchStaticGeometry(
  root: Object3D,
  ownedGeometries: Set<BufferGeometry>,
): void {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map<
    string,
    { meshes: Mesh[]; noOutline: boolean; bloom: unknown }
  >();
  root.traverseVisible((object) => {
    if (
      !(object instanceof Mesh) ||
      object.type !== 'Mesh' ||
      Array.isArray(object.material) ||
      object.material.transparent ||
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
  for (const { meshes, noOutline, bloom } of groups.values()) {
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
