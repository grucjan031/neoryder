import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { BufferGeometry, Material } from 'three';
import { createRoomTest } from '../../src/scenes/roomTest';
import { initPhysics } from '../../src/physics';
import { roomDefinitions } from '../../src/world/rooms';
import { getMaterial } from '../../src/render/materials';
import * as cityModels from '../../src/render/cityModels';
import * as roomModels from '../../src/scenes/roomModels';

afterEach(() => vi.restoreAllMocks());

it.each([
  'city_stall',
  'city_crates',
  'city_dumpster',
  'city_generator',
  'city_shutter',
  'city_vending',
  'city_kiosk',
  'city_car',
  'pillar',
  'city_missing',
])(
  '%s: material bloku zachowuje kontrakt modeli i fallbacku',
  async (model) => {
    const geometry = new BoxGeometry();
    const paint = new MeshBasicMaterial({ color: 0x334455 });
    const neon = new MeshBasicMaterial({ color: 0xffae1a });
    const original = new Group();
    original.add(new Mesh(geometry, paint), new Mesh(geometry, neon));
    vi.spyOn(cityModels, 'cloneCityModel').mockImplementation(async (name) =>
      name === 'city_missing' ? null : original.clone(true),
    );
    vi.spyOn(roomModels, 'cloneRoomModel').mockResolvedValue(
      original.clone(true),
    );
    const scene = createRoomTest();
    Reflect.set(scene, 'layout', {
      ...roomDefinitions.get('combatYard')!,
      blocks: [
        {
          model,
          material: 'metal',
          size: { x: 2, y: 2, z: 2 },
          position: { x: 0, y: 1, z: 0 },
        },
      ],
      decor: [],
      doors: [],
    });
    const rapier = await initPhysics();
    const world = new rapier.World({ x: 0, y: 0, z: 0 });
    Reflect.set(scene, 'rapier', rapier);
    Reflect.set(scene, 'world', world);
    // Izolujemy budowę bloków od fal, HUD-u i ładowania broni FPP.
    const layout = scene as unknown as {
      buildLayout(): Promise<void>;
      root: Group;
      geometries: Set<BufferGeometry>;
    };
    try {
      await layout.buildLayout();
      const models = layout.root.getObjectByName('static-models')!;
      const blocks = layout.root.getObjectByName('static-blocks')!;
      const materials = new Set<Material | Material[]>();
      models.traverse((node) => {
        if (node instanceof Mesh) materials.add(node.material);
      });
      if (model === 'city_missing') {
        expect(materials.size).toBe(0);
        const fallback = blocks.children.filter((node) => node instanceof Mesh);
        expect(fallback).toHaveLength(1);
        expect(fallback[0]!.material).toBe(getMaterial('metal'));
      } else {
        expect(blocks.children).toHaveLength(0);
        const expected = model.startsWith('city_')
          ? [paint, neon]
          : [getMaterial('metal')];
        expect(materials.size).toBe(expected.length);
        for (const material of expected)
          expect(materials.has(material)).toBe(true);
      }
      expect(original.children.map((node) => (node as Mesh).material)).toEqual([
        paint,
        neon,
      ]);
    } finally {
      for (const owned of layout.geometries) owned.dispose();
      world.free();
      geometry.dispose();
      paint.dispose();
      neon.dispose();
    }
  },
);
