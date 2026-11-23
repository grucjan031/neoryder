import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
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
          scope: 10,
          holo: 6,
          laser: 7,
          foregrip: 4,
        }[module.visual.shape];
        expect(meshes).toHaveLength(budget);
        expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(budget);
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
          expect(visual.getObjectByName('scope_front_lens')).toBeDefined();
          expect(visual.getObjectByName('scope_rear_lens')).toBeDefined();
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

const compatiblePairs = [...weaponDefinitions.values()].flatMap((weapon) =>
  [...moduleDefinitions.values()]
    .filter((module) => moduleFitsWeapon(module, weapon.id))
    .map((module) => ({
      weapon: weapon.id,
      model: weapon.model!,
      id: module.id,
      slot: module.slot,
      shape: module.visual.shape,
    })),
);

describe('styk z GLB i drożność lufy zgodnych par', () => {
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
              [0.37, 0.4, 0.43, 0.46, 0.49].some((height) => {
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
          const axis = slot === 'cell' ? 'x' : 'y';
          const side = slot === 'optic' ? 1 : -1;
          const direction = new Vector3();
          direction[axis] = -side;
          const shell = accessory.filter(
            (mesh) => mesh.name !== 'module_mount',
          );
          for (const mount of mounts) {
            const box = new Box3().setFromObject(mount, true);
            const origin = box.getCenter(new Vector3());
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
});

describe('widok przez optykę w ADS', () => {
  it.each(compatiblePairs.filter(({ slot }) => slot === 'optic'))(
    '$weapon / $id',
    async ({ weapon, model, id, shape }) => {
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
        expect(ray.intersectObjects(opaque, false)).toHaveLength(0);
      } finally {
        view.dispose();
        blade.mockRestore();
        hand.mockRestore();
        loader.mockRestore();
      }
    },
  );
});
