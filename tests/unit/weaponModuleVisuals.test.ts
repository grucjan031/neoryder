import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import type { MeshToonMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { attachModuleVisuals } from '../../src/render/weaponModuleVisuals';
import { moduleDefinitions } from '../../src/progression/moduleSchema';
import { fppMaterial } from '../../src/render/fppMaterials';
import { FppBlaster } from '../../src/render/fppBlaster';
import { EventBus } from '../../src/core/events';
import { HandRig } from '../../src/render/handRig';

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
      const modelBox = new Box3().setFromObject(root);
      const modelLength = modelBox.max.z - modelBox.min.z;
      const frameBox = new Box3().setFromObject(root.getObjectByName('frame')!);
      const frameHeight = frameBox.max.y - frameBox.min.y;
      const gripBox = new Box3().setFromObject(root.getObjectByName('grip')!);
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
          brake: 2,
          rail: 2,
          compensator: 2,
          coil: 2,
          canister: 2,
          extended: 2,
          pulse: 2,
          reddot: 3,
          scope: 6,
          holo: 4,
          laser: 5,
          foregrip: 2,
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
        const dimensions = box.getSize(new Vector3());
        expect(box.isEmpty()).toBe(false);
        expect(
          box
            .getSize(new Vector3())
            .toArray()
            .every((n) => Number.isFinite(n) && n > 0),
        ).toBe(true);
        if (module.slot === 'muzzle') expect(flash.position.z).toBeLessThan(0);
        const expectedLength = {
          scope: 0.4,
          reddot: 0.08,
          brake: 0.15,
          rail: 0.25,
          coil: 0.25,
          canister: 0.25,
          compensator: 0.2,
          extended: 0.32,
          pulse: 0.25,
          holo: 0.13,
          laser: 0.16,
          foregrip: 0.07,
        }[module.visual.shape];
        expect(dimensions.z / modelLength).toBeCloseTo(expectedLength);
        if (module.visual.shape === 'scope') {
          expect(dimensions.x / frameHeight).toBeCloseTo(0.38);
          expect(
            visual.children.filter((part) => part.name === 'scope_mount'),
          ).toHaveLength(2);
          expect(visual.getObjectByName('scope_front_lens')).toBeDefined();
          expect(visual.getObjectByName('scope_rear_lens')).toBeDefined();
        }
        if (module.visual.shape === 'reddot') {
          expect(dimensions.x / modelLength).toBeCloseTo(0.15);
          expect(dimensions.y / frameHeight).toBeCloseTo(0.35);
          const glass = visual.getObjectByName('optic_glass') as Mesh;
          expect(glass.material).toMatchObject({
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          });
        }
        if (module.visual.shape === 'holo') {
          expect(dimensions.y / frameHeight).toBeCloseTo(0.42);
          expect(
            (visual.getObjectByName('optic_glass') as Mesh).material,
          ).toMatchObject({ transparent: true, opacity: 0.22 });
          const reticle = visual.getObjectByName('holo_reticle') as Mesh;
          // Znak celownika: bursztyn, nie kolory zarezerwowane (ADR 0006).
          expect(
            (reticle.material as MeshToonMaterial).emissive.getHexString(),
          ).toBe('ffae1a');
        }
        if (module.slot === 'grip') {
          // Podwieszenie wisi pod korpusem, w przedniej połowie broni.
          expect(box.max.y).toBeCloseTo(visual.position.y);
          expect(box.max.y).toBeLessThan(frameBox.max.y);
          expect(visual.position.z).toBeLessThan(
            (frameBox.min.z + frameBox.max.z) / 2,
          );
        }
        if (module.visual.shape === 'foregrip')
          expect(dimensions.y / frameHeight).toBeCloseTo(0.8);
        if (module.visual.shape === 'laser') {
          expect(beam).toBeDefined();
          expect(beam!.userData.noOutline).toBe(true);
          const beamBox = new Box3().setFromObject(beam!);
          expect(beamBox.min.z).toBeLessThan(box.min.z - modelLength);
          expect(beamBox.max.z).toBeLessThanOrEqual(box.max.z);
        }
        if (module.slot === 'cell') {
          expect(dimensions.x / frameHeight).toBeCloseTo(0.42);
          expect(visual.position.x).toBeCloseTo(
            frameBox.min.x - dimensions.x * 0.3,
          );
          expect(box.min.x).toBeLessThan(frameBox.min.x);
          expect(box.min.y).toBeGreaterThanOrEqual(frameBox.min.y - 1e-6);
          expect(box.intersectsBox(gripBox)).toBe(false);
        }
        if (module.slot === 'optic') {
          const frameBox = new Box3().setFromObject(
            root.getObjectByName('frame')!,
          );
          expect(box.min.y).toBeCloseTo(frameBox.max.y);
          expect(visual.position.z).toBeCloseTo(
            frameBox.max.z - (frameBox.max.z - frameBox.min.z) * 0.6,
          );
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
