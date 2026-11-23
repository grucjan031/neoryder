import { Box3, Group, Mesh, Vector3 } from 'three';
import type { BoxGeometry, Material, Object3D } from 'three';
import type { IronSight } from '../combat/weapons/weaponSchema';
import type { Tuning } from '../core/tuning';

/** Uzupełnia brakujące elementy w układzie GLB. Skala detalu pochodzi z korpusu. */
export function createIronSightGeometry(
  model: Object3D,
  sight: IronSight,
  profile: Tuning['player']['aim']['ironGeometry'],
  box: BoxGeometry,
  material: Material,
): Group | undefined {
  const { rear, front, rearBaseY, frontBaseY } = sight;
  if (rearBaseY === undefined && frontBaseY === undefined) return;
  const frame = model.getObjectByName('frame');
  if (!frame) return;
  const width =
    new Box3().setFromObject(frame).getSize(new Vector3()).x *
    profile.widthScale;
  const depth = width * profile.depthScale;
  const result = new Group();
  result.name = 'iron_sights';
  const part = (
    x: number,
    z: number,
    bottom: number,
    top: number,
    w: number,
  ) => {
    const mesh = new Mesh(box, material);
    mesh.position.set(x, (bottom + top) / 2, z);
    mesh.scale.set(w, top - bottom, depth);
    result.add(mesh);
  };
  if (rearBaseY !== undefined) {
    const [x, y, z] = rear;
    const notch = width * profile.notchScale;
    const ear = (width - notch) / 2;
    const shoulder = 2 * y - rearBaseY;
    part(x, z, rearBaseY, y - profile.postClearanceM, width);
    for (const side of [-1, 1])
      part(
        x + (side * (notch + ear)) / 2,
        z,
        y - profile.postClearanceM,
        shoulder,
        ear,
      );
  }
  if (frontBaseY !== undefined) {
    const [x, y, z] = front;
    part(
      x,
      z,
      frontBaseY,
      y - profile.postClearanceM,
      width * profile.postScale,
    );
  }
  return result;
}
