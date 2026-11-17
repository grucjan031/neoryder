import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { moduleDefinitions } from '../progression/moduleSchema';
import type { ModuleDefinition } from '../progression/moduleSchema';
import { fppMaterial } from './fppMaterials';

type Shape = ModuleDefinition['visual']['shape'];
type Color = ModuleDefinition['visual']['color'];
const ACCENTS = { amber: '#ffae1a', white: '#fff1d6', green: '#6dff4a' };

/** Własne materiały; tekstura gradientu pozostaje współdzielona z FPP. */
export function createModuleVisual(shape: Shape, color: Color): Object3D {
  const root = new Group();
  root.name = `module_${shape}`;
  const source = fppMaterial('armor');
  const armor = source.clone();
  armor.onBeforeCompile = source.onBeforeCompile;
  armor.customProgramCacheKey = source.customProgramCacheKey;
  const accent = armor.clone();
  accent.onBeforeCompile = source.onBeforeCompile;
  accent.customProgramCacheKey = source.customProgramCacheKey;
  accent.color.set(ACCENTS[color]);
  accent.emissive.set(ACCENTS[color]);
  accent.emissiveIntensity = 0.25;
  const add = (
    geometry: BufferGeometry,
    x: number,
    y: number,
    z: number,
    bright = false,
  ) => {
    const mesh = new Mesh(geometry, bright ? accent : armor);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x = 0,
    y = 0,
    z = 0,
    bright = false,
  ) => add(new BoxGeometry(w, h, d), x, y, z, bright);
  const tube = (
    radius: number,
    length: number,
    y = 0,
    z = 0,
    bright = false,
  ) => {
    const mesh = add(
      new CylinderGeometry(radius, radius, length, 10),
      0,
      y,
      z,
      bright,
    );
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const ring = (radius: number, y: number, z: number, bright = false) =>
    add(new TorusGeometry(radius, 0.065, 4, 12), 0, y, z, bright);
  switch (shape) {
    case 'brake':
      // Otwarty kanał wzdłuż -Z; przerwy między pierścieniami pełnią rolę portów.
      for (const z of [-0.12, -0.5, -0.88]) {
        ring(0.42, 0, z);
        ring(0.43, 0, z - 0.025, true).scale.z = 0.3;
      }
      for (const x of [-0.39, 0.39]) box(0.12, 0.22, 1, x, 0, -0.5);
      break;
    case 'rail':
      box(0.95, 0.12, 1, 0, -0.28, -0.5);
      for (const x of [-0.38, 0.38]) box(0.14, 0.35, 1, x, -0.05, -0.5, true);
      break;
    case 'coil':
      tube(0.38, 1);
      for (let i = 0; i < 5; i++) {
        ring(0.42, 0, -0.4 + i * 0.2);
        ring(0.43, 0, -0.4 + i * 0.2, true).scale.z = 0.35;
      }
      break;
    case 'canister':
      tube(0.4, 1);
      tube(0.42, 0.09, 0, 0, true);
      for (const z of [-0.5, 0.5]) ring(0.35, 0, z);
      break;
    case 'reddot':
      box(0.9, 0.12, 0.65, 0, 0.06);
      for (const x of [-0.37, 0.37]) box(0.12, 0.7, 0.16, x, 0.45);
      box(0.86, 0.12, 0.16, 0, 0.8);
      {
        const glass = armor.clone();
        glass.color.set('#91b5ac');
        glass.transparent = true;
        glass.opacity = 0.18;
        glass.depthWrite = false;
        const pane = add(new BoxGeometry(0.62, 0.58, 0.025), 0, 0.45, 0);
        pane.material = glass;
        pane.name = 'optic_glass';
      }
      add(new SphereGeometry(0.045, 8, 6), 0, 0.43, 0.02, true);
      break;
    case 'scope':
      tube(0.43, 2, 0.7).name = 'scope_tube';
      for (const z of [-0.55, 0.55]) {
        box(0.65, 0.3, 0.18, 0, 0.15, z);
        ring(0.44, 0.7, z).name = 'scope_mount';
      }
      for (const z of [-1, 1]) {
        ring(0.44, 0.7, z);
        const lens = tube(0.37, 0.015, 0.7, z, true);
        lens.name = z < 0 ? 'scope_front_lens' : 'scope_rear_lens';
      }
      break;
  }
  // Jednostkowe osie: X/Y = przekrój, Z = lufa. Optyka stoi podstawą na Y=0.
  const boxBounds = new Box3().setFromObject(root);
  const center = boxBounds.getCenter(new Vector3());
  const optic = shape === 'scope' || shape === 'reddot';
  const muzzle = shape === 'brake' || shape === 'rail';
  for (const child of root.children)
    child.position.sub(
      new Vector3(
        center.x,
        optic ? boxBounds.min.y : center.y,
        muzzle ? boxBounds.max.z : center.z,
      ),
    );
  return root;
}

/** Muzzle w GLB jest pustym zaczepem: przekrój bierzemy z końcowych 8% korpusu. */
function barrelDiameter(
  frame: Object3D,
  gunRoot: Object3D,
  frameBox: Box3,
): number {
  const tip = new Box3();
  const inverse = gunRoot.matrixWorld.clone().invert();
  const point = new Vector3();
  const cutoff = frameBox.min.z + (frameBox.max.z - frameBox.min.z) * 0.08;
  frame.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const positions = part.geometry.getAttribute('position');
    const matrix = new Matrix4().multiplyMatrices(inverse, part.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      if (point.z <= cutoff) tip.expandByPoint(point);
    }
  });
  const size = (tip.isEmpty() ? frameBox : tip).getSize(new Vector3());
  return Math.max(size.x, size.y);
}

/** Bbox geometrii w układzie broni, bez błysków ani innych dzieci węzła. */
function bounds(node: Object3D, gunRoot: Object3D): Box3 {
  const result = new Box3();
  const inverse = gunRoot.matrixWorld.clone().invert();
  node.traverse((part) => {
    if (!(part instanceof Mesh) || part.userData.noOutline) return;
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox)
      result.union(
        part.geometry.boundingBox
          .clone()
          .applyMatrix4(
            new Matrix4().multiplyMatrices(inverse, part.matrixWorld),
          ),
      );
  });
  return result;
}

export function attachModuleVisuals(
  gunRoot: Object3D,
  moduleIds: readonly string[],
): () => void {
  gunRoot.updateWorldMatrix(true, true);
  const frame = gunRoot.getObjectByName('frame');
  const muzzle = gunRoot.getObjectByName('muzzle');
  const cell = gunRoot.getObjectByName('heat_cell');
  if (!frame) return () => {};
  const frameBox = bounds(frame, gunRoot);
  if (frameBox.isEmpty()) return () => {};
  const size = frameBox.getSize(new Vector3());
  const modelBox = bounds(gunRoot, gunRoot);
  const length = modelBox.max.z - modelBox.min.z;
  const grip = gunRoot.getObjectByName('grip');
  const gripBox = grip ? bounds(grip, gunRoot) : null;
  const muzzleBox = muzzle ? bounds(muzzle, gunRoot) : null;
  const barrel =
    muzzleBox && !muzzleBox.isEmpty()
      ? Math.max(
          muzzleBox.max.x - muzzleBox.min.x,
          muzzleBox.max.y - muzzleBox.min.y,
        )
      : barrelDiameter(frame, gunRoot, frameBox);
  const center = frameBox.getCenter(new Vector3());
  const added: Object3D[] = [];
  const moved: { node: Object3D; position: Vector3 }[] = [];
  const cellBox = cell ? bounds(cell, gunRoot) : null;
  for (const id of moduleIds) {
    const module = moduleDefinitions.get(id);
    if (
      !module ||
      (module.slot === 'muzzle' && !muzzle) ||
      (module.slot === 'cell' && (!cellBox || cellBox.isEmpty()))
    )
      continue;
    const visual = createModuleVisual(module.visual.shape, module.visual.color);
    const shape = module.visual.shape;
    const raw = new Box3().setFromObject(visual).getSize(new Vector3());
    const fit = (x: number, y: number, z: number) =>
      visual.scale.set(x / raw.x, y / raw.y, z / raw.z);
    if (module.slot === 'muzzle' && muzzle) {
      if (shape === 'brake') fit(barrel * 1.4, barrel * 1.4, length * 0.15);
      else fit(barrel * 1.3, size.y * 0.18, length * 0.25);
      visual.position.copy(
        gunRoot.worldToLocal(muzzle.getWorldPosition(new Vector3())),
      );
      gunRoot.add(visual);
      for (const child of muzzle.children) {
        if (child.name !== 'module_muzzle_flash' && child.name !== 'heat_glow')
          continue;
        moved.push({ node: child, position: child.position.clone() });
        const tip = visual.localToWorld(new Vector3(0, 0, -raw.z));
        child.position.copy(muzzle.worldToLocal(tip));
      }
    } else if (module.slot === 'cell' && cellBox) {
      const diameter = size.y * 0.42;
      const cellLength = length * 0.25;
      fit(diameter, diameter, cellLength);
      visual.position.copy(cellBox.getCenter(new Vector3()));
      // Kamera widzi lewy bok broni trzymanej po prawej. Podnosimy ogniwo do korpusu.
      visual.position.x = frameBox.min.x - diameter * 0.3;
      visual.position.y = Math.max(
        frameBox.min.y + diameter / 2,
        Math.min(frameBox.max.y - diameter / 2, visual.position.y),
      );
      const envelope = new Box3().setFromCenterAndSize(
        visual.position,
        new Vector3(diameter, diameter, cellLength),
      );
      if (
        gripBox &&
        !gripBox.isEmpty() &&
        envelope.intersectsBox(gripBox.clone().expandByScalar(diameter * 0.3))
      )
        visual.position.z = Math.min(
          visual.position.z,
          gripBox.min.z - cellLength / 2 - diameter * 0.3,
        );
      gunRoot.add(visual);
    } else {
      if (shape === 'scope') {
        const diameter = size.y * 0.38;
        fit(diameter, (diameter * raw.y) / raw.x, length * 0.4);
      } else fit(length * 0.15, size.y * 0.35, length * 0.08);
      visual.position.set(
        center.x,
        frameBox.max.y,
        frameBox.max.z - size.z * 0.6,
      );
      gunRoot.add(visual);
    }
    added.push(visual);
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const { node, position } of moved) node.position.copy(position);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    for (const visual of added) {
      visual.removeFromParent();
      visual.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material])
          materials.add(material);
      });
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  };
}
