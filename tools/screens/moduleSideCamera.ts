import { Box2, MathUtils, Matrix4, Vector3 } from 'three';
import type { Mesh, Object3D, PerspectiveCamera } from 'three';
import { tuning } from '../../src/core/tuning';

/** Dopasowuje perspektywę 3/4 do sylwetki broni wraz z założonym modułem. */
export function frameModuleSide(
  camera: PerspectiveCamera,
  gun: Object3D,
): void {
  const { direction, fovDeg, widthFraction, heightFraction } =
    tuning.weaponModuleVisuals.sideView;
  camera.fov = fovDeg;
  camera.updateProjectionMatrix();
  camera.position.copy(direction);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  gun.updateWorldMatrix(true, true);
  const tangent = Math.tan(MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
  const slopeX = tangent * camera.aspect * widthFraction;
  const slopeY = tangent * heightFraction;
  const bounds = new Box2();
  let nearestZ = -Infinity;
  const matrix = new Matrix4();
  const point = new Vector3();
  gun.traverseVisible((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || mesh.userData.noOutline) return;
    matrix.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    const vertices = mesh.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
      // Każda krawędź kadru jest płaszczyzną nachyloną o tangens połowy FOV.
      bounds.min.x = Math.min(bounds.min.x, point.x - slopeX * point.z);
      bounds.max.x = Math.max(bounds.max.x, point.x + slopeX * point.z);
      bounds.min.y = Math.min(bounds.min.y, point.y - slopeY * point.z);
      bounds.max.y = Math.max(bounds.max.y, point.y + slopeY * point.z);
      nearestZ = Math.max(nearestZ, point.z);
    }
  });
  const distance = Math.max(
    (bounds.max.x - bounds.min.x) / (2 * slopeX),
    (bounds.max.y - bounds.min.y) / (2 * slopeY),
    nearestZ + camera.near,
  );
  point.set(
    (bounds.max.x + bounds.min.x) / 2,
    (bounds.max.y + bounds.min.y) / 2,
    distance,
  );
  camera.position.copy(point.applyMatrix4(camera.matrixWorld));
  camera.updateMatrixWorld();
}
