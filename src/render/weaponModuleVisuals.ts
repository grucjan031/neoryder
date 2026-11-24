import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import {
  MODULE_SHAPES_BY_SLOT,
  MODULE_SLOTS,
  moduleDefinitions,
} from '../progression/moduleSchema';
import type { ModuleDefinition, ModuleSlot } from '../progression/moduleSchema';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tuning } from '../core/tuning';
import { fppGlowMaterial } from './fppMaterials';

type ModuleVisual = ModuleDefinition['visual'];
const ACCENTS = { amber: '#ffae1a', white: '#fff1d6', green: '#6dff4a' };
const layout = tuning.weaponModuleVisuals;
const templates = new Map<string, { root: Object3D; users: number }>();

function moduleArmor(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#303744',
    metalness: 0.65,
    roughness: 0.38,
    emissive: '#151b25',
    emissiveIntensity: 0.25,
  });
}

/** Scalanie detali tego samego materiału; nazwane zaczepy pozostają osobno. */
function batchDetails(root: Group): void {
  const batches = new Map<Material, Mesh[]>();
  for (const node of root.children) {
    if (!(node instanceof Mesh) || Array.isArray(node.material)) continue;
    if (node.name && node.name !== 'holo_reticle') continue;
    const batch = batches.get(node.material) ?? [];
    batch.push(node);
    batches.set(node.material, batch);
  }
  for (const [material, meshes] of batches) {
    const parts = meshes.map((mesh) => {
      mesh.updateMatrix();
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error('Incompatible module geometry');
    const merged = new Mesh(geometry, material);
    merged.name = meshes[0]!.name;
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      root.remove(mesh);
    }
    root.add(merged);
  }
}

/** Własne materiały PBR; geometrie współdzielone do odpięcia ostatniej instancji. */
export function createModuleVisual({
  shape,
  color,
  sight,
}: ModuleVisual): Object3D {
  const key = JSON.stringify([shape, color, sight]);
  const cached = templates.get(key);
  if (cached) {
    cached.users++;
    const copy = cached.root.clone(true);
    const materials = new Map<Material, Material>();
    copy.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const source = node.material as Material;
      let material = materials.get(source);
      if (!material) {
        material = source.clone();
        materials.set(source, material);
      }
      node.material = material;
    });
    return copy;
  }
  const root = new Group();
  root.name = `module_${shape}`;
  const armor = moduleArmor();
  const accent = armor.clone();
  const tint =
    shape === 'pulse'
      ? '#8a5cff'
      : shape === 'extended'
        ? ACCENTS.amber
        : shape === 'laser'
          ? ACCENTS.green
          : ACCENTS[color];
  accent.color.set(tint);
  accent.emissive.set(tint);
  accent.emissiveIntensity = MODULE_SHAPES_BY_SLOT.muzzle.includes(shape)
    ? layout.muzzle.accentIntensity
    : 0.65;
  accent.metalness = 0.25;
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
  ) =>
    add(
      new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.18),
      x,
      y,
      z,
      bright,
    );
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
  /** Walec pionowy (oś Y): trzon chwytu i jego opaski. */
  const post = (
    top: number,
    bottom: number,
    height: number,
    y: number,
    bright = false,
  ) => add(new CylinderGeometry(top, bottom, height, 10), 0, y, 0, bright);
  switch (shape) {
    case 'suppressor': {
      // Przekrój tulei zawraca po wewnętrznej ściance, zostawiając otwarty kanał.
      const wall = new LatheGeometry(
        [
          new Vector2(0.31, 0),
          new Vector2(0.42, 0),
          new Vector2(0.42, -2.06),
          new Vector2(0.35, -2.2),
          new Vector2(0.31, -2.2),
          new Vector2(0.31, 0),
        ].reverse(),
        20,
      );
      add(wall.rotateX(Math.PI / 2), 0, 0, 0);
      for (const z of [-0.12, -0.96, -1.88])
        ring(0.42, 0, z, true).scale.z = 0.45;
      break;
    }
    case 'choke':
      for (let i = 0; i < 4; i++) {
        const wall = new CylinderGeometry(
          0.37,
          0.49,
          0.8,
          6,
          1,
          true,
          (i * Math.PI) / 2 + 0.08,
          Math.PI / 2 - 0.16,
        );
        add(wall.rotateX(Math.PI / 2), 0, 0, -0.4);
      }
      ring(0.37, 0, 0);
      ring(0.49, 0, -0.8, true);
      break;
    case 'drum':
      box(0.52, 0.2, 0.54, 0, -0.1).name = 'module_foot';
      add(
        new CylinderGeometry(0.53, 0.53, 0.48, 20).rotateZ(Math.PI / 2),
        0,
        -0.66,
        0,
      );
      for (const x of [-0.245, 0.245])
        box(0.025, 0.18, 0.56, x, -0.66, 0, true);
      break;
    case 'overload':
      box(0.72, 0.62, 1, 0, -0.12);
      for (const z of [-0.27, 0.27]) box(0.28, 0.45, 0.14, 0, 0.35, z);
      box(0.09, 0.09, 0.45, 0, 0.49, 0, true);
      break;
    case 'stun':
      tube(0.33, 0.76);
      for (const z of [-0.38, 0.38])
        add(new SphereGeometry(0.33, 12, 8), 0, 0, z).scale.z = 0.55;
      for (const z of [-0.29, 0, 0.29]) ring(0.33, 0, z, true);
      break;
    case 'radiator':
      box(0.62, 0.29, 1);
      for (let i = 0; i < 8; i++)
        box(0.67, 0.46, 0.055, 0, 0.06, -0.44 + i * 0.125, i === 7);
      break;
    case 'prism': {
      box(0.86, 0.12, 1, 0, 0.06).name = 'module_foot';
      box(0.8, 0.08, 0.91, 0, 0.14).name = 'scope_mount';
      for (const side of [-1, 1]) {
        const cheek = box(0.09, 0.57, 0.91, side * 0.355, 0.38);
        cheek.rotation.z = side * 0.22;
      }
      box(0.66, 0.085, 0.91, 0, 0.66);
      const pane = add(new BoxGeometry(0.62, 0.52, 0.024), 0, 0.38, 0.3);
      pane.rotation.x = -Math.PI / 8;
      const glass = accent.clone();
      glass.transparent = true;
      glass.opacity = 0.18;
      glass.depthWrite = false;
      pane.material = glass;
      pane.name = 'optic_glass';
      const dot = add(new SphereGeometry(0.028, 10, 8), ...sight!.target, true);
      accent.emissiveIntensity = layout.optic.reticleIntensity;
      dot.name = 'optic_reticle';
      break;
    }
    case 'angled':
      box(0.8, 0.16, 1.5, 0, -0.08).name = 'module_foot';
      box(0.58, 1.55, 0.48, 0, -0.83).rotation.x = Math.PI / 6;
      box(0.61, 0.12, 0.52, 0, -0.94, -0.09, true).rotation.x = Math.PI / 6;
      box(0.74, 0.16, 0.65, 0, -1.46, -0.4, true);
      break;
    case 'brake':
      // Otwarty kanał wzdłuż -Z; przerwy między pierścieniami pełnią rolę portów.
      for (const z of [-0.12, -0.5, -0.88]) {
        ring(0.42, 0, z, z === -0.12);
        ring(0.43, 0, z - 0.025, true).scale.z = 0.3;
      }
      for (const x of [-0.39, 0.39]) box(0.12, 0.22, 1, x, 0, -0.5);
      break;
    case 'rail':
      box(0.95, 0.12, 1, 0, -0.28, -0.5);
      for (const x of [-0.38, 0.38]) box(0.14, 0.35, 1, x, -0.05, -0.5, true);
      for (const z of [-0.15, -0.4, -0.65, -0.9])
        box(0.96, 0.08, 0.08, 0, -0.2, z, z === -0.15);
      break;
    case 'compensator':
      // Pełna tuleja z portami u góry i po bokach (hamulec jest ażurowy).
      add(
        new CylinderGeometry(0.36, 0.36, 1, 16, 1, true),
        0,
        0,
        -0.5,
      ).rotation.x = Math.PI / 2;
      for (const z of [-0.04, -0.96]) ring(0.37, 0, z, true);
      for (const z of [-0.24, -0.5, -0.76]) {
        ring(0.39, 0, z);
        for (const x of [-0.35, 0.35]) box(0.08, 0.2, 0.13, x, 0, z, true);
      }
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
      for (const x of [-0.39, 0.39]) {
        box(0.06, 0.25, 0.68, x, 0, 0);
        box(0.07, 0.12, 0.5, x, 0, 0, true);
      }
      break;
    case 'extended':
      // Dłuższy zasobnik z kołnierzami i świecącymi listwami po bokach.
      tube(0.33, 1);
      for (const z of [-0.43, 0.43]) tube(0.42, 0.14, 0, z);
      box(0.18, 0.9, 0.6);
      for (const x of [-0.34, 0.34]) box(0.05, 0.14, 0.62, x, 0, 0, true);
      break;
    case 'pulse':
      // Trzy kondensatory na świecącym rdzeniu: przerwy odsłaniają rdzeń.
      tube(0.17, 1, 0, 0, true);
      for (const z of [-0.37, 0, 0.37]) {
        tube(0.42, 0.2, 0, z);
        ring(0.4, 0, z);
      }
      break;
    case 'reddot':
      box(0.9, 0.12, 0.65, 0, 0.06).name = 'module_foot';
      for (const x of [-0.37, 0.37]) box(0.12, 0.7, 0.16, x, 0.45);
      box(0.86, 0.12, 0.16, 0, 0.8);
      {
        const glass = armor.clone();
        glass.color.set('#91b5ac');
        glass.transparent = true;
        glass.opacity = 0.18;
        glass.depthWrite = false;
        glass.metalness = 0;
        glass.roughness = 0.08;
        const pane = add(new BoxGeometry(0.62, 0.58, 0.025), 0, 0.45, 0);
        pane.material = glass;
        pane.name = 'optic_glass';
      }
      {
        const dot = add(new SphereGeometry(0.045, 8, 6), ...sight!.target);
        const sign = accent.clone();
        sign.emissiveIntensity = layout.optic.reticleIntensity;
        dot.material = sign;
        dot.name = 'optic_reticle';
      }
      break;
    case 'scope':
      {
        const body = add(
          new CylinderGeometry(0.43, 0.43, 2, 16, 1, true),
          0,
          0.7,
          0,
        );
        body.rotation.x = Math.PI / 2;
        body.name = 'scope_tube';
      }
      post(0.17, 0.19, 0.18, 1.18);
      for (const z of [-0.8, -0.7, 0.7, 0.8]) ring(0.44, 0.7, z);
      for (const z of [-0.55, 0.55]) {
        box(0.65, 0.3, 0.18, 0, 0.15, z).name = 'module_foot';
        ring(0.44, 0.7, z).name = 'scope_mount';
      }
      for (const z of [-1, 1]) ring(0.44, 0.7, z);
      add(
        new TorusGeometry(
          layout.optic.scopeReticleRadius,
          layout.optic.scopeReticleStroke,
          6,
          24,
        ),
        ...sight!.target,
        true,
      ).name = 'optic_reticle';
      break;
    case 'holo':
      // Zamknięta obudowa z okapem: emiter z tyłu, szyba ze znakiem celowniczym z przodu.
      box(0.84, 0.14, 1, 0, 0.07).name = 'module_foot';
      box(0.72, 0.3, 0.36, 0, 0.29, 0.32);
      box(0.34, 0.05, 0.2, 0, 0.46, 0.32, true);
      for (const x of [-0.38, 0.38]) box(0.08, 0.76, 0.18, x, 0.52, -0.24);
      box(0.84, 0.08, 0.24, 0, 0.94, -0.24);
      {
        const glass = armor.clone();
        glass.color.set(ACCENTS[color]);
        glass.transparent = true;
        glass.opacity = 0.22;
        glass.depthWrite = false;
        glass.metalness = 0;
        glass.roughness = 0.08;
        const pane = add(new BoxGeometry(0.68, 0.7, 0.025), 0, 0.53, -0.24);
        pane.material = glass;
        pane.name = 'optic_glass';
        // Znak: okrąg z kropką i czterema kreskami, jaśniejszy od akcentu obudowy.
        const sign = accent.clone();
        sign.emissiveIntensity = layout.optic.reticleIntensity;
        const [cx, cy, cz] = sight!.target;
        const mark = (geometry: BufferGeometry, x: number, y: number) => {
          const mesh = add(geometry, cx + x, cy + y, cz);
          mesh.material = sign;
          mesh.name = 'holo_reticle';
        };
        mark(new TorusGeometry(0.17, 0.018, 4, 20), 0, 0);
        mark(new SphereGeometry(0.035, 8, 6), 0, 0);
        for (const [x, y] of [
          [0, 0.24],
          [0, -0.24],
          [0.24, 0],
          [-0.24, 0],
        ] as const)
          mark(
            new BoxGeometry(x === 0 ? 0.025 : 0.1, x === 0 ? 0.1 : 0.025, 0.01),
            x,
            y,
          );
      }
      break;
    case 'laser':
      // Moduł pod lufą: obejma, korpus i jasna soczewka; wiązkę dodaje `attachModuleVisuals`.
      box(0.7, 0.14, 0.9, 0, -0.07).name = 'module_foot';
      tube(0.3, 1, -0.42);
      ring(0.3, -0.42, 0.28, true);
      box(0.16, 0.12, 0.3, 0, -0.76, 0.1, true);
      tube(0.2, 0.06, -0.42, -0.52, true).name = 'laser_lens';
      break;
    case 'foregrip':
      // Pionowy uchwyt pod łożem: obejma szyny, zwężany trzon z opaską i stopka.
      box(0.8, 0.16, 1, 0, -0.08).name = 'module_foot';
      post(0.3, 0.36, 1.5, -0.9);
      post(0.34, 0.35, 0.1, -0.5, true);
      for (const y of [-0.85, -1.1, -1.35]) post(0.37, 0.37, 0.05, y);
      post(0.42, 0.42, 0.12, -1.7);
      break;
  }
  if (sight) {
    const target = new Group();
    target.name = 'module_ads_sight';
    target.position.set(...sight.target);
    const rear = new Group();
    rear.name = 'module_ads_rear';
    rear.position.copy(target.position).setZ(sight.rearZ);
    rear.userData.eyeReliefM = sight.eyeReliefM;
    root.add(target, rear);
  }
  // Jednostkowe osie: X/Y = przekrój, Z = lufa. Optyka stoi podstawą na Y=0,
  // podwieszenie wisi od Y=0 w dół, wylot kończy się na Z=0.
  const boxBounds = new Box3().setFromObject(root);
  const center = boxBounds.getCenter(new Vector3());
  const slot = MODULE_SLOTS.find((id) =>
    MODULE_SHAPES_BY_SLOT[id].includes(shape),
  );
  const y =
    slot === 'optic'
      ? boxBounds.min.y
      : slot === 'grip' || shape === 'drum'
        ? boxBounds.max.y
        : center.y;
  for (const child of root.children)
    child.position.sub(
      new Vector3(center.x, y, slot === 'muzzle' ? boxBounds.max.z : center.z),
    );
  batchDetails(root);
  if (
    !root.children.some(
      (node) => node instanceof Mesh && node.material === accent,
    )
  )
    accent.dispose();
  root.userData.moduleTemplate = key;
  const template = root.clone(true);
  template.traverse((node) => {
    if (node instanceof Mesh)
      node.material = (node.material as Material).clone();
  });
  templates.set(key, { root: template, users: 1 });
  return root;
}

/** Wiązka lasera wzdłuż -Z od soczewki: addytywna, wygasa ku końcowi (kolory wierzchołków). */
function laserBeam(color: ModuleVisual['color']): Mesh {
  const geometry = new BoxGeometry(1, 1, 1).translate(0, 0, -0.5);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++)
    colors.fill(positions.getZ(i) < -0.5 ? 0 : 1, i * 3, i * 3 + 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const material = fppGlowMaterial(ACCENTS[color], 0.75);
  material.vertexColors = true;
  const beam = new Mesh(geometry, material);
  beam.name = 'laser_beam';
  beam.userData.noOutline = true;
  beam.renderOrder = 3;
  return beam;
}

/** Bbox wierzchołków węzła w układzie broni, ograniczony do odcinka osi Z. */
function zoneBox(
  node: Object3D,
  gunRoot: Object3D,
  zMin: number,
  zMax: number,
): Box3 {
  const zone = new Box3();
  const inverse = gunRoot.matrixWorld.clone().invert();
  const point = new Vector3();
  node.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const positions = part.geometry.getAttribute('position');
    const matrix = new Matrix4().multiplyMatrices(inverse, part.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      if (point.z >= zMin && point.z <= zMax) zone.expandByPoint(point);
    }
  });
  return zone;
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

function solidMeshes(node: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  node.traverse((part) => {
    if (part instanceof Mesh && !part.userData.noOutline) meshes.push(part);
  });
  return meshes;
}

type MountAxis = 'x' | 'y';
type Surface = (
  axis: MountAxis,
  side: -1 | 1,
  point: Vector3,
) => number | undefined;

/** Próbki padają na trójkąty GLB, także między wierzchołkami modelu. */
function surfaceProbe(gun: Object3D, parts: Mesh[], box: Box3): Surface {
  const ray = new Raycaster();
  ray.layers.enableAll();
  const origin = new Vector3();
  const direction = new Vector3();
  const inverse = gun.matrixWorld.clone().invert();
  return (axis, side, point) => {
    origin.copy(point);
    origin[axis] = side > 0 ? box.max[axis] + 1 : box.min[axis] - 1;
    direction.set(0, 0, 0);
    direction[axis] = -side;
    ray.set(
      origin.applyMatrix4(gun.matrixWorld),
      direction.transformDirection(gun.matrixWorld),
    );
    return ray.intersectObjects(parts, false)[0]?.point.applyMatrix4(inverse)[
      axis
    ];
  };
}

function findSeat<T>(
  preferredZ: number,
  frame: Box3,
  depth: number,
  tryAt: (z: number) => T | undefined,
): T | undefined {
  const span = frame.max.z - frame.min.z;
  const step = span * layout.mount.searchStep;
  const inset = Math.min(depth, span) / 2;
  for (let i = 0; i <= layout.mount.searchSteps; i++) {
    const offset = Math.ceil(i / 2) * (i % 2 ? step : -step);
    const z = Math.max(
      frame.min.z + inset,
      Math.min(frame.max.z - inset, preferredZ + offset),
    );
    const seat = tryAt(z);
    if (seat !== undefined) return seat;
  }
}

/** Nakładka jest w układzie dodatku, geometria i materiał należą do jego instancji. */
function addMount(
  visual: Object3D,
  geometry: BufferGeometry,
  center: Vector3,
  size: Vector3,
): void {
  const mesh = new Mesh(geometry, moduleArmor());
  mesh.name = 'module_mount';
  mesh.position.copy(center).sub(visual.position).divide(visual.scale);
  mesh.scale.copy(size).divide(visual.scale);
  visual.add(mesh);
}

function addPad(
  visual: Object3D,
  axis: MountAxis,
  contact: Vector3,
  base: number,
  size: Vector3,
): void {
  const center = contact.clone();
  center[axis] = (contact[axis] + base) / 2;
  size[axis] = Math.abs(base - contact[axis]) + 2 * layout.mount.seatDepthM;
  addMount(visual, new BoxGeometry(), center, size);
}

function verticalSeat(
  visual: Object3D,
  frame: Box3,
  model: Box3,
  surface: Surface,
  x: number,
  preferredZ: number,
  side: -1 | 1,
): boolean {
  visual.updateWorldMatrix(true, true);
  const feet = visual.children
    .filter((part) => part.name === 'module_foot')
    .map((part) => new Box3().setFromObject(part, true));
  const envelope = new Box3().setFromObject(visual, true);
  const marker = visual.getObjectByName('module_ads_sight');
  const seat = findSeat(
    preferredZ,
    frame,
    envelope.max.z - envelope.min.z,
    (z) => {
      const contacts = feet.map((foot) => {
        const point = foot.getCenter(new Vector3()).add(new Vector3(x, 0, z));
        const y = surface('y', side, point);
        if (y === undefined) return;
        return point.setY(y);
      });
      if (contacts.some((point) => !point)) return;
      let edge = Math.max(...contacts.map((point) => side * point!.y));
      const extent = envelope.getSize(new Vector3());
      for (const dx of [-extent.x / 2, 0, extent.x / 2]) {
        for (const dz of [
          -extent.z / 2,
          -extent.z / 4,
          0,
          extent.z / 4,
          extent.z / 2,
        ]) {
          const y = surface('y', side, new Vector3(x + dx, 0, z + dz));
          if (y !== undefined) edge = Math.max(edge, side * y);
        }
      }
      let base = side * (edge + layout.optic.railHeightM);
      if (marker)
        base = Math.max(
          base,
          model.max.y +
            layout.optic.sightClearanceM -
            marker.position.y * visual.scale.y,
        );
      return { z, base, contacts };
    },
  );
  if (!seat) return false;
  visual.position.set(x, seat.base, seat.z);
  feet.forEach((foot, i) => {
    const size = foot.getSize(new Vector3());
    size.x *= layout.mount.padWidth;
    size.z *= layout.mount.padLength;
    addPad(visual, 'y', seat.contacts[i]!, seat.base, size);
  });
  return true;
}

/** Stopa w osi wylotu; dwie podpory obejmują przerwę między lufami. */
function forwardGripSeat(
  visual: Object3D,
  frame: Box3,
  surface: Surface,
  socket: Vector3,
  supportZ: number,
  depth: number,
): boolean {
  visual.updateWorldMatrix(true, true);
  const foot = new Box3().setFromObject(
    visual.getObjectByName('module_foot')!,
    true,
  );
  const size = foot.getSize(new Vector3());
  const seat = findSeat(
    supportZ - layout.grip.supportClearanceM - depth / 2,
    frame,
    depth,
    (z) => {
      const contact = (x: number) => {
        const point = new Vector3(x, 0, z);
        const bottom = surface('y', -1, point);
        return bottom === undefined ? undefined : point.setY(bottom);
      };
      const center = contact(socket.x);
      if (center) return [center];
      const offset = size.x * layout.grip.saddleSpacing;
      const left = contact(socket.x - offset);
      const right = contact(socket.x + offset);
      if (left && right) return [left, right];
    },
  );
  const first = seat?.[0];
  if (!seat || !first) return false;
  const envelopeWidth = new Box3()
    .setFromObject(visual, true)
    .getSize(new Vector3()).x;
  const outerEdge = surface('x', -1, socket.clone().setZ(first.z));
  if (outerEdge !== undefined && envelopeWidth > 0) {
    const width = Math.max(
      envelopeWidth,
      2 * (socket.x - outerEdge) * layout.grip.barrelSpanWidth,
    );
    const factor = width / envelopeWidth;
    visual.scale.x *= factor;
    size.x *= factor;
  }
  const bottom = seat.map((point) => {
    const outer = surface(
      'x',
      point.x < socket.x ? -1 : 1,
      socket.clone().setZ(point.z),
    );
    if (outer === undefined) return point.y;
    const below = point.clone().setX((outer + point.x) / 2);
    return Math.min(point.y, surface('y', -1, below) ?? point.y);
  });
  const base = Math.min(...bottom) - layout.grip.bracketDropM;
  visual.position.set(
    socket.x,
    base,
    first.z - foot.getCenter(new Vector3()).z,
  );
  size.x *= layout.mount.padWidth / seat.length;
  size.z *= layout.mount.padLength;
  for (const point of seat) addPad(visual, 'y', point, base, size);
  return true;
}

function cellSeat(
  visual: Object3D,
  frame: Box3,
  cell: Box3,
  frameSurface: Surface,
  surface: Surface,
  clearance: Surface,
  axisX: number,
  diameter: number,
  depth: number,
): boolean {
  const center = cell.getCenter(new Vector3());
  const { padSpacing, padLength, padHeight } = layout.cell;
  const seat = findSeat(center.z, frame, depth, (z) => {
    const vertical = new Vector3(axisX, 0, z);
    const top = frameSurface('y', 1, vertical);
    const bottom = frameSurface('y', -1, vertical);
    if (top === undefined || bottom === undefined) return;
    const radius = diameter / 2;
    const half = Math.min(radius, (top - bottom) / 2);
    const y = Math.max(bottom + half, Math.min(top - half, center.y));
    const contacts = [-padSpacing, padSpacing].map((offset) => {
      const point = new Vector3(0, y, z + offset * depth);
      const x = surface('x', -1, point);
      if (x === undefined) return;
      return point.setX(x);
    });
    if (contacts.some((point) => !point)) return;
    let base = Math.min(...contacts.map((point) => point!.x));
    for (const dy of [-radius, 0, radius]) {
      for (const dz of [-depth / 2, -depth / 4, 0, depth / 4, depth / 2]) {
        const x = clearance('x', -1, new Vector3(0, y + dy, z + dz));
        if (x !== undefined) base = Math.min(base, x);
      }
    }
    return { y, z, base, contacts };
  });
  if (!seat) return false;
  visual.position.set(seat.base - diameter / 2, seat.y, seat.z);
  for (const point of seat.contacts)
    addPad(
      visual,
      'x',
      point!,
      seat.base - diameter * layout.cell.padEngagement,
      new Vector3(0, diameter * padHeight, depth * padLength),
    );
  return true;
}

/**
 * Dokłada kształty modułów do modelu broni (FPP i podgląd warsztatu). Każdy kształt ma
 * `userData.moduleSlot`; zwracana funkcja zdejmuje je i zwalnia ich geometrie i materiały.
 */
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
  const parts = solidMeshes(gunRoot);
  const body = parts.filter((part) => part !== grip && part !== cell);
  const surface = surfaceProbe(gunRoot, parts, modelBox);
  const bodySurface = surfaceProbe(gunRoot, body, modelBox);
  const frameSurface = surfaceProbe(gunRoot, solidMeshes(frame), modelBox);
  const socket = muzzle
    ? gunRoot.worldToLocal(muzzle.getWorldPosition(new Vector3()))
    : frameBox.getCenter(new Vector3());
  const added: Object3D[] = [];
  const moved = new Map<Object3D, Vector3>();
  const slots = new Set<ModuleSlot>();
  const cellBox = cell ? bounds(cell, gunRoot) : null;
  for (const id of moduleIds) {
    const module = moduleDefinitions.get(id);
    if (
      !module ||
      slots.has(module.slot) ||
      (module.slot === 'muzzle' && !muzzle) ||
      (module.slot === 'cell' && (!cellBox || cellBox.isEmpty()))
    )
      continue;
    slots.add(module.slot);
    const visual = createModuleVisual(module.visual);
    added.push(visual);
    visual.userData.moduleSlot = module.slot;
    visual.userData.moduleId = id;
    const shape = module.visual.shape;
    const raw = new Box3().setFromObject(visual).getSize(new Vector3());
    const fit = (x: number, y: number, z: number) =>
      visual.scale.set(x / raw.x, y / raw.y, z / raw.z);
    if (muzzle && module.slot === 'muzzle') {
      // Przekrój rzeczywistego czoła lufy, z osią z zaczepu GLB. Wspólna
      // obejma obejmuje też dwa wyloty rozpraszacza.
      const front = frameBox.min.z;
      const rim = zoneBox(
        frame,
        gunRoot,
        front - layout.muzzle.rimToleranceM,
        front + layout.muzzle.rimToleranceM,
      );
      if (rim.isEmpty()) continue;
      const width = 2 * Math.max(socket.x - rim.min.x, rim.max.x - socket.x);
      const height = 2 * Math.max(socket.y - rim.min.y, rim.max.y - socket.y);
      const profile =
        layout.muzzle[
          shape === 'brake' || shape === 'rail' ? shape : 'compensator'
        ];
      const caliber = Math.min(width, height);
      const depth = Math.min(
        Math.max(caliber * profile.length, length * layout.muzzle.minLength),
        length * layout.muzzle.maxLength,
      );
      // Szeroki wylot może sięgać poza obrys broni na boki. Nad nim biegnie linia ADS.
      const availableHeight = Math.max(height, 2 * (modelBox.max.y - socket.y));
      const muzzleHeight = Math.min(height * profile.height, availableHeight);
      let rear = front;
      const trim = gunRoot.getObjectByName('trim');
      if (trim) {
        const lip = zoneBox(
          trim,
          gunRoot,
          modelBox.min.z,
          front + caliber * layout.muzzle.maxSleeveDepth,
        );
        if (
          !lip.isEmpty() &&
          lip.min.x < socket.x &&
          lip.max.x > socket.x &&
          lip.min.y < socket.y &&
          lip.max.y > socket.y
        )
          rear = lip.min.z;
      }
      // Korpus nasuwa się na szyjkę do pierścienia GLB. Błysk pozostaje na wylocie.
      fit(
        width * profile.width,
        muzzleHeight,
        (shape === 'suppressor' ? 2.2 : shape === 'choke' ? 0.8 : 1) * depth +
          Math.max(0, rear - front),
      );
      visual.position.copy(socket).setZ(rear);
      const collarDepth = caliber * layout.muzzle.collarDepth;
      // Otwarta tuleja: zachodzi na czoło i spina je z korpusem dodatku.
      const opening = layout.muzzle.collarOpening / 2;
      const collar = new LatheGeometry(
        [
          new Vector2(opening, -0.5),
          new Vector2(0.5, -0.5),
          new Vector2(0.5, 0.5),
          new Vector2(opening, 0.5),
          new Vector2(opening, -0.5),
        ],
        16,
      );
      collar.rotateX(Math.PI / 2);
      // Tył zachowuje przekrój lufy. Przód rozszerza się do obudowy dodatku.
      const rimVertices = collar.getAttribute('position');
      for (let i = 0; i < rimVertices.count; i++) {
        if (rimVertices.getZ(i) >= 0) continue;
        rimVertices.setXY(
          i,
          (rimVertices.getX(i) * profile.width) / layout.muzzle.collarWidth,
          (rimVertices.getY(i) * muzzleHeight) /
            (height * layout.muzzle.collarWidth),
        );
      }
      collar.computeVertexNormals();
      addMount(
        visual,
        collar,
        visual.position
          .clone()
          .setZ(front + layout.mount.seatDepthM - collarDepth / 2),
        new Vector3(
          width * layout.muzzle.collarWidth,
          height * layout.muzzle.collarWidth,
          collarDepth,
        ),
      );
      gunRoot.add(visual);
      const tip = visual.localToWorld(new Vector3(0, 0, -raw.z));
      for (const child of muzzle.children) {
        if (child.name !== 'module_muzzle_flash' && child.name !== 'heat_glow')
          continue;
        if (!moved.has(child)) moved.set(child, child.position.clone());
        child.position.copy(muzzle.worldToLocal(tip));
      }
    } else if (module.slot === 'cell' && cellBox) {
      const diameter = size.y * layout.cell.diameter;
      const cellLength =
        length *
        (shape === 'extended'
          ? layout.cell.extendedLength
          : layout.cell.length);
      if (shape === 'drum') {
        fit(diameter * 0.6, diameter * 1.1, diameter);
        if (
          verticalSeat(
            visual,
            frameBox,
            modelBox,
            surface,
            socket.x,
            frameBox.min.z + size.z * layout.grip.foregrip.fromFront,
            -1,
          )
        )
          gunRoot.add(visual);
        continue;
      }
      fit(
        diameter,
        shape === 'radiator' ? diameter * 0.55 : diameter,
        cellLength,
      );
      if (
        !cellSeat(
          visual,
          frameBox,
          cellBox,
          frameSurface,
          bodySurface,
          surface,
          socket.x,
          diameter,
          cellLength,
        )
      )
        continue;
      gunRoot.add(visual);
    } else if (module.slot === 'grip') {
      const profile = layout.grip[shape === 'laser' ? shape : 'foregrip'];
      const depth = size.z * profile.length;
      fit(size.x * profile.width, size.y * profile.height, depth);
      const support = gunRoot.getObjectByName('support');
      const supportZ =
        support &&
        gunRoot.worldToLocal(support.getWorldPosition(new Vector3())).z;
      const seated =
        supportZ !== undefined && supportZ < 0
          ? forwardGripSeat(visual, frameBox, surface, socket, supportZ, depth)
          : verticalSeat(
              visual,
              frameBox,
              modelBox,
              surface,
              socket.x,
              frameBox.min.z + size.z * profile.fromFront,
              -1,
            );
      if (!seated) continue;
      gunRoot.add(visual);
      const lens = visual.getObjectByName('laser_lens');
      if (lens) {
        const { laserBeamWidth, laserBeamLength } = layout.grip;
        const beam = laserBeam('green');
        beam.position.copy(lens.position);
        beam.scale.set(
          (length * laserBeamWidth) / visual.scale.x,
          (length * laserBeamWidth) / visual.scale.y,
          (length * laserBeamLength) / visual.scale.z,
        );
        visual.add(beam);
        const dot = new Mesh(
          new SphereGeometry(1.8, 8, 6),
          fppGlowMaterial(ACCENTS.green),
        );
        dot.name = 'laser_dot';
        dot.userData.noOutline = true;
        dot.position.z = -1;
        dot.scale.z = laserBeamWidth / laserBeamLength;
        beam.add(dot);
      }
    } else if (module.slot === 'optic') {
      const profile =
        layout.optic[shape === 'scope' || shape === 'reddot' ? shape : 'holo'];
      if (shape === 'scope') {
        const diameter = Math.min(
          size.x * profile.width,
          size.y * profile.height,
        );
        fit(diameter, (diameter * raw.y) / raw.x, size.z * profile.length);
      } else
        fit(
          size.x * profile.width,
          size.y * profile.height * (shape === 'prism' ? 0.75 : 1),
          size.z * profile.length,
        );
      if (
        !verticalSeat(
          visual,
          frameBox,
          modelBox,
          surface,
          socket.x,
          frameBox.min.z + size.z * layout.optic.fromFront,
          1,
        )
      )
        continue;
      gunRoot.add(visual);
    }
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const [node, position] of moved) node.position.copy(position);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    for (const visual of added) {
      visual.removeFromParent();
      const key = visual.userData.moduleTemplate as string;
      const template = templates.get(key);
      const last = !template || --template.users === 0;
      if (template && last) {
        templates.delete(key);
        template.root.traverse((node) => {
          if (node instanceof Mesh) (node.material as Material).dispose();
        });
      }
      visual.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        if (last || node.userData.noOutline || node.name === 'module_mount')
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
