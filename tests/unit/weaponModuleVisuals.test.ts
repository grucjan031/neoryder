import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  Box2,
  Box3,
  BoxGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Triangle,
  Vector2,
  Vector3,
} from 'three';
import type { MeshToonMaterial, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { attachModuleVisuals } from '../../src/render/weaponModuleVisuals';
import {
  moduleDefinitions,
  moduleFitsWeapon,
} from '../../src/progression/moduleSchema';
import { weaponDefinitions } from '../../src/combat/weapons/weaponSchema';
import { fppMaterial } from '../../src/render/fppMaterials';
import { FppBlaster } from '../../src/render/fppBlaster';
import { FppBlade } from '../../src/render/fppBlade';
import { FppViewModel } from '../../src/render/fppViewModel';
import { EventBus } from '../../src/core/events';
import { HandRig } from '../../src/render/handRig';
import { viewmodelFov } from '../../src/render/viewmodelLayer';
import { tuning } from '../../src/core/tuning';
import { frameModuleSide } from '../../tools/screens/moduleSideCamera';

const loadModel = (model: string) =>
  new GLTFLoader().parseAsync(
    new Uint8Array(readFileSync(`public/assets/models/${model}.glb`)).buffer,
    '',
  );

function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((part) => {
    if (part instanceof Mesh && !part.userData.noOutline) meshes.push(part);
  });
  return meshes;
}

function projectedBounds(meshes: Mesh[], camera: PerspectiveCamera): Box2 {
  const box = new Box2();
  const point = new Vector3();
  for (const mesh of meshes) {
    for (let i = 0; i < mesh.geometry.attributes.position!.count; i++) {
      mesh
        .getVertexPosition(i, point)
        .applyMatrix4(mesh.matrixWorld)
        .project(camera);
      box.expandByPoint(new Vector2(point.x, point.y));
    }
  }
  return box;
}

const pairs = [...weaponDefinitions.values()].flatMap((weapon) =>
  [...moduleDefinitions.values()].map((module) => ({
    weapon: weapon.id,
    model: weapon.model!,
    id: module.id,
    slot: module.slot,
    shape: module.visual.shape,
    compatible: moduleFitsWeapon(module, weapon.id),
  })),
);
const compatiblePairs = pairs.filter((pair) => pair.compatible);

describe('elementy modułów na siedmiu modelach GLB', () => {
  it('współdzieli geometrie, izoluje materiały i zwalnia cache po ostatnim widoku', () => {
    const gun = () => {
      const root = new Group();
      const frame = new Mesh(new BoxGeometry(1, 1, 3));
      frame.name = 'frame';
      root.add(frame);
      return root;
    };
    const first = gun();
    const second = gun();
    const detachFirst = attachModuleVisuals(first, ['holo']);
    const detachSecond = attachModuleVisuals(second, ['holo']);
    const a = first.getObjectByName('holo_reticle') as Mesh;
    const b = second.getObjectByName('holo_reticle') as Mesh;
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).not.toBe(b.material);
    expect(a.material).toBeInstanceOf(MeshStandardMaterial);
    const disposal = vi.spyOn(a.geometry, 'dispose');
    detachFirst();
    expect(disposal).not.toHaveBeenCalled();
    expect(new Box3().setFromObject(second).isEmpty()).toBe(false);
    detachSecond();
    expect(disposal).toHaveBeenCalledTimes(1);
    for (const root of [first, second]) {
      const frame = root.getObjectByName('frame') as Mesh;
      frame.geometry.dispose();
      (frame.material as MeshStandardMaterial).dispose();
    }
  });
  it('FppBlaster odświeża moduły przy wspólnym modelu, zmianie broni i dispose', async () => {
    const bytes = readFileSync('public/assets/models/blaster.glb');
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const loader = vi
      .spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockImplementation(async () => ({
        ...gltf,
        scene: gltf.scene.clone(true),
      }));
    const hand = vi
      .spyOn(HandRig.prototype, 'load')
      .mockResolvedValue(undefined);
    const bus = new EventBus();
    const modulesOf = vi.fn((id: string) =>
      id === 'blaster' ? ['pierce', 'incendiary'] : ['scope'],
    );
    const gun = new FppBlaster(bus, 1, {
      modelOf: () => 'blaster',
      modulesOf,
    });
    try {
      await gun.load();
      expect(modulesOf).not.toHaveBeenCalled();
      expect(gun.root.getObjectByName('module_rail')).toBeUndefined();
      bus.emit('weapon_switched', { owner: 2, weapon: 'blaster', slot: 0 });
      expect(modulesOf).not.toHaveBeenCalled();
      bus.emit('weapon_switched', { owner: 1, weapon: 'pistol', slot: 0 });
      await vi.waitFor(() =>
        expect(gun.root.getObjectByName('module_scope')).toBeDefined(),
      );
      expect(modulesOf).toHaveBeenCalledWith('pistol');
      expect(gun.root.getObjectByName('module_rail')).toBeUndefined();
      bus.emit('weapon_switched', { owner: 1, weapon: 'blaster', slot: 1 });
      await vi.waitFor(() =>
        expect(gun.root.getObjectByName('module_rail')).toBeDefined(),
      );
      const rail = gun.root.getObjectByName('module_rail')!;
      expect(rail).toBeDefined();
      const mesh = rail.children.find((node) => node instanceof Mesh) as Mesh;
      const dispose = vi.spyOn(mesh.geometry, 'dispose');
      bus.emit('weapon_switched', { owner: 1, weapon: 'pistol', slot: 1 });
      await vi.waitFor(() =>
        expect(gun.root.getObjectByName('module_scope')).toBeDefined(),
      );
      expect(gun.root.getObjectByName('module_rail')).toBeUndefined();
      expect(dispose).toHaveBeenCalledTimes(1);
      const scope = gun.root.getObjectByName('module_scope')!;
      gun.dispose();
      expect(scope.parent).toBeNull();
      expect(loader).toHaveBeenCalledTimes(1);
    } finally {
      gun.dispose();
      hand.mockRestore();
      loader.mockRestore();
    }
  });
  it.each([
    'blaster',
    'pistol',
    'rifle',
    'scatter',
    'sniper_rifle',
    'emp_launcher',
    'beam',
  ])(
    '%s: kształty wszystkich modułów, położenie, usunięcie i zwolnienie zasobów',
    async (name) => {
      const bytes = readFileSync(`public/assets/models/${name}.glb`);
      const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        '',
      );
      const root = gltf.scene;
      const modelLength = new Box3()
        .setFromObject(root)
        .getSize(new Vector3()).z;
      const muzzle = root.getObjectByName('muzzle')!;
      const flash = new Group();
      flash.name = 'module_muzzle_flash';
      muzzle.add(flash);
      const glow = new Group();
      glow.name = 'heat_glow';
      glow.position.set(0.001, -0.002, 0.003);
      muzzle.add(glow);
      const originalFlash = flash.position.clone();
      const originalGlow = glow.position.clone();
      const childCount = root.children.length;
      for (let cycle = 0; cycle < 5; cycle++) {
        for (const ids of [
          ['pierce', 'ricochet'],
          ['ricochet', 'pierce'],
        ]) {
          const detach = attachModuleVisuals(root, ids);
          expect(root.children).toHaveLength(childCount + 1);
          expect(
            root.getObjectByName(
              ids[0] === 'pierce' ? 'module_rail' : 'module_brake',
            ),
          ).toBeDefined();
          expect(
            root.getObjectByName(
              ids[0] === 'pierce' ? 'module_brake' : 'module_rail',
            ),
          ).toBeUndefined();
          expect(flash.position.equals(originalFlash)).toBe(false);
          expect(glow.position.equals(originalGlow)).toBe(false);
          detach();
          detach();
          expect(flash.position).toEqual(originalFlash);
          expect(glow.position).toEqual(originalGlow);
          expect(root.children).toHaveLength(childCount);
        }
      }
      const shared = vi.spyOn(fppMaterial('armor'), 'dispose');
      for (const module of moduleDefinitions.values()) {
        const detach = attachModuleVisuals(root, [module.id]);
        expect(root.children.length).toBe(childCount + 1);
        const visual = root.getObjectByName(`module_${module.visual.shape}`)!;
        expect(visual.userData.moduleSlot).toBe(module.slot);
        const meshes: Mesh[] = [];
        visual.traverse((node) => {
          if (node instanceof Mesh) meshes.push(node);
        });
        const budget = {
          brake: 3,
          rail: 3,
          compensator: 3,
          coil: 4,
          canister: 4,
          extended: 4,
          pulse: 4,
          reddot: 5,
          scope: 9,
          holo: 6,
          laser: 7,
          foregrip: 4,
        }[module.visual.shape];
        const count =
          budget +
          Number(name === 'scatter' && module.visual.shape === 'laser');
        expect(meshes).toHaveLength(count);
        expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(count);
        if (
          module.visual.shape === 'pulse' ||
          module.visual.shape === 'extended'
        ) {
          const color = module.visual.shape === 'pulse' ? '8a5cff' : 'ffae1a';
          expect(
            meshes.some(
              (mesh) =>
                (
                  mesh.material as MeshStandardMaterial
                ).emissive.getHexString() === color,
            ),
          ).toBe(true);
        }
        // Wiązka lasera jest efektem: nie liczy się do wymiarów modułu.
        const beam = visual.getObjectByName('laser_beam');
        beam?.removeFromParent();
        const box = new Box3().setFromObject(visual);
        if (beam) visual.add(beam);
        expect(box.isEmpty()).toBe(false);
        expect(
          box
            .getSize(new Vector3())
            .toArray()
            .every((n) => Number.isFinite(n) && n > 0),
        ).toBe(true);
        if (module.slot === 'muzzle') expect(flash.position.z).toBeLessThan(0);
        if (module.visual.shape === 'scope') {
          expect(
            visual.children.filter((part) => part.name === 'scope_mount'),
          ).toHaveLength(2);
          expect(visual.getObjectByName('optic_reticle')).toBeDefined();
        }
        if (module.visual.shape === 'reddot') {
          const glass = visual.getObjectByName('optic_glass') as Mesh;
          expect(glass.material).toMatchObject({
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          });
        }
        if (module.visual.shape === 'holo') {
          expect(
            (visual.getObjectByName('optic_glass') as Mesh).material,
          ).toMatchObject({ transparent: true, opacity: 0.22 });
          const reticle = visual.getObjectByName('holo_reticle') as Mesh;
          // Znak celownika: bursztyn, nie kolory zarezerwowane (ADR 0006).
          expect(
            (reticle.material as MeshToonMaterial).emissive.getHexString(),
          ).toBe('ffae1a');
        }
        if (module.visual.shape === 'laser') {
          expect(beam).toBeDefined();
          expect(beam!.userData.noOutline).toBe(true);
          const beamBox = new Box3().setFromObject(beam!);
          expect(beamBox.min.z).toBeLessThan(box.min.z - modelLength);
          expect(beamBox.max.z).toBeLessThanOrEqual(box.max.z);
        }
        const camera = new PerspectiveCamera(
          tuning.camera.fov,
          16 / 9,
          0.01,
          100,
        );
        frameModuleSide(camera, root);
        const projected = projectedBounds(meshesOf(root), camera);
        expect(projected.getSize(new Vector2()).x / 2).toBeCloseTo(0.6, 2);
        expect(projected.getCenter(new Vector2()).x).toBeCloseTo(0, 2);
        expect(projected.min.y).toBeGreaterThan(-1);
        expect(projected.max.y).toBeLessThan(1);
        const resources = new Set<{ dispose(): void }>();
        visual.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          resources.add(node.geometry);
          for (const material of Array.isArray(node.material)
            ? node.material
            : [node.material])
            resources.add(material);
        });
        const spies = [...resources].map((resource) =>
          vi.spyOn(resource, 'dispose'),
        );
        detach();
        detach();
        expect(root.children.length).toBe(childCount);
        expect(flash.position.toArray()).toEqual([0, 0, 0]);
        expect(glow.position).toEqual(originalGlow);
        for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
        expect(shared).not.toHaveBeenCalled();
      }
      shared.mockRestore();
    },
  );
});

// Sprawdza siatkę dłoni po zgięciu palców w pozie broni.
function handTouchesBox(hand: Object3D, box: Box3, toLocal: Matrix4): boolean {
  return meshesOf(hand).some((mesh) => {
    const matrix = new Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld);
    const geometry = mesh.geometry;
    const vertices = Array.from(
      { length: geometry.attributes.position!.count },
      (_, i) => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(matrix),
    );
    const indices = geometry.index;
    const at = (i: number) => vertices[indices ? indices.getX(i) : i]!;
    const triangle = new Triangle();
    for (let i = 0; i < (indices?.count ?? vertices.length); i += 3) {
      if (box.intersectsTriangle(triangle.set(at(i), at(i + 1), at(i + 2))))
        return true;
    }
    return false;
  });
}

describe('widoczność bryły modułu z biodra', () => {
  it.each(
    compatiblePairs.filter(
      ({ slot, weapon }) =>
        slot === 'muzzle' ||
        (slot === 'grip' && (weapon === 'rifle' || weapon === 'scatter')),
    ),
  )('$weapon / $id', async ({ weapon, id, model }) => {
    const loader = vi
      .spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockImplementation(async (url) =>
        new GLTFLoader().parseAsync(
          new Uint8Array(readFileSync(`public${url}`)).buffer,
          '',
        ),
      );
    const blade = vi
      .spyOn(FppBlade.prototype, 'load')
      .mockResolvedValue(undefined);
    const bus = new EventBus();
    const view = new FppViewModel(bus, 1, {
      modelOf: () => model,
      modulesOf: () => [id],
    });
    try {
      bus.emit('weapon_switched', { owner: 1, weapon, slot: 0 });
      await view.load();
      const camera = new PerspectiveCamera(tuning.camera.fov, 16 / 9, 0.01, 10);
      camera.fov = viewmodelFov(camera);
      camera.updateProjectionMatrix();
      view.place(camera.matrixWorld, 0, { held: 'gun', horizontalSpeed: 0 });
      view.root.updateMatrixWorld(true);
      const module = moduleDefinitions.get(id)!;
      const visual = view.root.getObjectByName(
        `module_${module.visual.shape}`,
      )!;
      const casing = meshesOf(visual).filter(
        (mesh) =>
          !['module_mount', 'module_foot', 'laser_lens'].includes(mesh.name),
      );
      const opaque: Mesh[] = [];
      view.root.traverseVisible((node) => {
        if (node instanceof Mesh && !node.userData.noOutline) opaque.push(node);
      });
      const bounds = projectedBounds(casing, camera);
      bounds.intersect(new Box2(new Vector2(-1, -1), new Vector2(1, 1)));
      const ray = new Raycaster();
      ray.layers.enableAll();
      let visibleSamples = 0;
      let accentSamples = 0;
      // Co drugi piksel kadru 1280 × 720. Liczy się pierwsze trafienie od oka.
      scan: for (let y = bounds.min.y; y <= bounds.max.y; y += 4 / 720) {
        for (let x = bounds.min.x; x <= bounds.max.x; x += 4 / 1280) {
          ray.setFromCamera(new Vector2(x, y), camera);
          const hit = ray.intersectObjects(opaque, false)[0]?.object as
            Mesh | undefined;
          if (!hit || !casing.includes(hit)) continue;
          visibleSamples++;
          if ((hit.material as MeshStandardMaterial).emissiveIntensity >= 0.6)
            accentSamples++;
          if (visibleSamples > 12 && accentSamples > 2) break scan;
        }
      }
      expect(visibleSamples, 'bryła widoczna z biodra').toBeGreaterThan(12);
      expect(accentSamples, 'widoczny akcent modułu').toBeGreaterThan(2);
      if (module.slot === 'grip') {
        const toLocal = visual.matrixWorld.clone().invert();
        const box = new Box3();
        for (const mesh of meshesOf(visual)) {
          const matrix = new Matrix4().multiplyMatrices(
            toLocal,
            mesh.matrixWorld,
          );
          mesh.geometry.computeBoundingBox();
          box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
        }
        expect(
          handTouchesBox(view.root.getObjectByName('hand_L')!, box, toLocal),
        ).toBe(false);
      }
    } finally {
      view.dispose();
      blade.mockRestore();
      loader.mockRestore();
    }
  });
});

describe('styk z GLB i drożność lufy zgodnych par', () => {
  it.each(['ricochet', 'compensator'])(
    'EMP z %s pozostawia wolny widok przez kolimator',
    async (id) => {
      const { scene } = await loadModel(weaponDefinitions.get('emp')!.model!);
      const detach = attachModuleVisuals(scene, ['collimator', id]);
      try {
        scene.updateMatrixWorld(true);
        const sight = scene
          .getObjectByName('module_ads_sight')!
          .getWorldPosition(new Vector3());
        const tip = scene.getObjectByName(
          `module_${moduleDefinitions.get(id)!.visual.shape}`,
        )!;
        const ray = new Raycaster(sight, new Vector3(0, 0, -1));
        expect(ray.intersectObjects(meshesOf(tip), false)).toHaveLength(0);
      } finally {
        detach();
      }
    },
  );

  it.each(compatiblePairs)(
    '$weapon / $id',
    async ({ weapon, model, id, slot, shape }) => {
      const { scene } = await loadModel(model);
      const body = meshesOf(scene);
      const muzzle = scene
        .getObjectByName('muzzle')!
        .getWorldPosition(new Vector3());
      const frameMesh = scene.getObjectByName('frame')!;
      const frame = new Box3().setFromObject(frameMesh, true);
      const detach = attachModuleVisuals(scene, [id]);
      try {
        scene.updateMatrixWorld(true);
        const visual = scene.getObjectByName(`module_${shape}`)!;
        expect(visual).toBeDefined();
        const accessory = meshesOf(visual);
        for (const mesh of accessory)
          (mesh.material as MeshStandardMaterial).side = DoubleSide;
        const mounts = accessory.filter((mesh) => mesh.name === 'module_mount');
        expect(mounts).not.toHaveLength(0);
        if (slot === 'muzzle') {
          const collar = new Box3().setFromObject(mounts[0]!, true);
          // Czoło lufy leży wewnątrz obejmy, która jest otwarta w osi Z.
          expect(collar.max.z).toBeGreaterThan(frame.min.z);
          expect(collar.max.z - frame.min.z).toBeLessThan(0.002);
          expect(collar.min.z).toBeLessThan(frame.min.z);
          const contactX = weapon === 'scatter' ? [-0.03, 0.03] : [muzzle.x];
          for (const x of contactX) {
            const joined = [-1, 1].some((side) =>
              [0.25, 0.3, 0.35, 0.4, 0.45].some((height) => {
                const ray = new Raycaster(
                  new Vector3(
                    x,
                    muzzle.y + side * height * (collar.max.y - collar.min.y),
                    collar.min.z - 1,
                  ),
                  new Vector3(0, 0, 1),
                );
                const rim = ray.intersectObject(frameMesh, true)[0];
                const flange = ray.intersectObject(mounts[0]!, false);
                return (
                  rim &&
                  flange.some(({ point }) => point.z >= rim.point.z) &&
                  flange.some(({ point }) => point.z < rim.point.z)
                );
              }),
            );
            expect(joined).toBe(true);
          }
        } else {
          const side = slot === 'optic' ? 1 : -1;
          const shell = accessory.filter(
            (mesh) => mesh.name !== 'module_mount',
          );
          for (const mount of mounts) {
            const box = new Box3().setFromObject(mount, true);
            const origin = box.getCenter(new Vector3());
            const axis = slot === 'cell' ? 'x' : 'y';
            const direction = new Vector3();
            direction[axis] = -side;
            origin[axis] += side;
            const ray = new Raycaster(origin, direction);
            const touch = ray.intersectObjects(body, false)[0];
            expect(touch).toBeDefined();
            const inside = (side > 0 ? box.min : box.max)[axis];
            expect(side * (touch!.point[axis] - inside)).toBeGreaterThanOrEqual(
              0,
            );
            expect(side * (touch!.point[axis] - inside)).toBeLessThan(0.002);
            const joint = ray
              .intersectObjects(shell, false)
              .some(({ point }) => box.containsPoint(point));
            expect(joint).toBe(true);
          }
        }
        // Rozpraszacz ma dwa równoległe wyloty, gniazdo VFX jest między nimi.
        const barrelOffsets = weapon === 'scatter' ? [-0.03, 0, 0.03] : [0];
        for (const offset of barrelOffsets) {
          const start = muzzle.clone().setZ(frame.max.z);
          start.x += offset;
          const ray = new Raycaster(start, new Vector3(0, 0, -1));
          expect(ray.intersectObjects(accessory, false)).toHaveLength(0);
        }
      } finally {
        detach();
      }
    },
  );

  it.each(compatiblePairs.filter(({ slot }) => slot === 'muzzle'))(
    '$weapon / $id: tylna krawędź styka się z czołem lufy',
    async ({ model, id, shape }) => {
      const { scene } = await loadModel(model);
      scene.updateMatrixWorld(true);
      const muzzle = scene
        .getObjectByName('muzzle')!
        .getWorldPosition(new Vector3());
      const frame = new Box3().setFromObject(
        scene.getObjectByName('frame')!,
        true,
      );
      const trim = scene.getObjectByName('trim');
      const faceRay = new Raycaster(
        muzzle.clone().setZ(frame.min.z - 1),
        new Vector3(0, 0, 1),
      );
      const trimHit = trim ? faceRay.intersectObject(trim, true)[0] : undefined;
      const detach = attachModuleVisuals(scene, [id]);
      try {
        scene.updateMatrixWorld(true);
        const visual = scene.getObjectByName(`module_${shape}`)!;
        const accessory = meshesOf(visual);
        const collar = new Box3().setFromObject(
          accessory.find((mesh) => mesh.name === 'module_mount')!,
          true,
        );
        const collarSize = collar.getSize(new Vector3());
        const maxSleeve =
          Math.min(collarSize.x, collarSize.y) *
          tuning.weaponModuleVisuals.muzzle.maxSleeveDepth;
        const barrelFaceZ =
          trimHit && trimHit.point.z - frame.min.z <= maxSleeve
            ? trimHit.point.z
            : frame.min.z;
        const casing = new Box3();
        for (const mesh of accessory) {
          if (mesh.name !== 'module_mount')
            casing.union(new Box3().setFromObject(mesh, true));
        }
        expect(Math.abs(casing.max.z - barrelFaceZ)).toBeLessThanOrEqual(
          tuning.weaponModuleVisuals.muzzle.rearToleranceM,
        );
      } finally {
        detach();
      }
    },
  );

  it.each(compatiblePairs.filter(({ slot }) => slot === 'grip'))(
    '$weapon / $id: środek w osi lufy (X) i obrys broni',
    async ({ model, id, shape }) => {
      const { scene } = await loadModel(model);
      scene.updateMatrixWorld(true);
      const muzzle = scene
        .getObjectByName('muzzle')!
        .getWorldPosition(new Vector3());
      const modelBox = new Box3().setFromObject(scene, true);
      const detach = attachModuleVisuals(scene, [id]);
      try {
        scene.updateMatrixWorld(true);
        const visual = scene.getObjectByName(`module_${shape}`)!;
        const gripBox = new Box3();
        for (const mesh of meshesOf(visual))
          gripBox.union(new Box3().setFromObject(mesh, true));
        const centerX = gripBox.getCenter(new Vector3()).x;
        const tolerance = tuning.weaponModuleVisuals.grip.centerToleranceM;
        expect(Math.abs(centerX - muzzle.x)).toBeLessThanOrEqual(tolerance);
        expect(gripBox.min.x).toBeGreaterThanOrEqual(modelBox.min.x);
        expect(gripBox.max.x).toBeLessThanOrEqual(modelBox.max.x);
        const beam = visual.getObjectByName('laser_beam');
        if (beam) {
          const beamX = new Box3()
            .setFromObject(beam, true)
            .getCenter(new Vector3()).x;
          expect(Math.abs(beamX - muzzle.x)).toBeLessThanOrEqual(tolerance);
        }
      } finally {
        detach();
      }
    },
  );
});

describe('widok przez optykę w ADS', () => {
  it.each(
    pairs.filter(
      ({ slot, shape, compatible }) =>
        slot === 'optic' && (shape === 'scope' || compatible),
    ),
  )('$weapon / $id', async ({ weapon, model, id, shape }) => {
    const gltf = await loadModel(model);
    const loader = vi
      .spyOn(GLTFLoader.prototype, 'loadAsync')
      .mockResolvedValue(gltf);
    const hand = vi
      .spyOn(HandRig.prototype, 'load')
      .mockResolvedValue(undefined);
    const blade = vi
      .spyOn(FppBlade.prototype, 'load')
      .mockResolvedValue(undefined);
    const bus = new EventBus();
    const view = new FppViewModel(bus, 1, {
      modelOf: () => model,
      modulesOf: () => [id],
    });
    try {
      bus.emit('weapon_switched', { owner: 1, weapon, slot: 0 });
      await view.load();
      view.place(new Matrix4(), 1 / 60, {
        held: 'gun',
        horizontalSpeed: 4,
        aim: 0.5,
      });
      const camera = new Matrix4().makeRotationY(0.3).setPosition(3, 2, 1);
      view.place(camera, 1 / 60, { held: 'gun', horizontalSpeed: 4, aim: 1 });
      const visual = view.root.getObjectByName(`module_${shape}`)!;
      const target = visual.getObjectByName('module_ads_sight')!;
      const inCamera = target
        .getWorldPosition(new Vector3())
        .applyMatrix4(camera.clone().invert());
      expect(inCamera.x).toBeCloseTo(0, 5);
      expect(inCamera.y).toBeCloseTo(0, 5);
      expect(inCamera.z).toBeLessThan(0);
      const opaque = meshesOf(visual.parent!).filter(
        (mesh) =>
          !(mesh.material as MeshStandardMaterial).transparent &&
          mesh.name !== 'holo_reticle' &&
          mesh.name !== 'optic_reticle',
      );
      const ray = new Raycaster(
        new Vector3().setFromMatrixPosition(camera),
        new Vector3(0, 0, -1).transformDirection(camera),
      );
      ray.layers.enableAll();
      expect(ray.intersectObjects(opaque, false)).toHaveLength(0);
      if (shape === 'scope') {
        const all = meshesOf(visual.parent!);
        expect(ray.intersectObjects(all, false)).toHaveLength(0);
        const reticle = visual.getObjectByName('optic_reticle')!;
        const sightBox = new Box3().setFromObject(reticle, true);
        const radius = sightBox.getSize(new Vector3()).y / 2;
        // Sprawdzamy też pole wokół znaku, łącznie z powierzchniami przezroczystymi.
        for (const [x, y] of [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ] as const) {
          const sample = inCamera
            .clone()
            .add(new Vector3(x * radius, y * radius, 0))
            .applyMatrix4(camera);
          ray.ray.direction.copy(sample).sub(ray.ray.origin).normalize();
          expect(ray.intersectObjects(all, false)).toHaveLength(0);
        }
      }
    } finally {
      view.dispose();
      blade.mockRestore();
      hand.mockRestore();
      loader.mockRestore();
    }
  });
});
