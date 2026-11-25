import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import {
  Box3,
  Euler,
  Matrix4,
  Vector3,
  type BufferGeometry,
  type Group,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRoomTest, testRoomById } from '../../src/scenes/roomTest';
import { initPhysics } from '../../src/physics';
import { roomDefinitions } from '../../src/world/rooms';
import * as staticBatch from '../../src/render/staticBatch';

// Proste bryły rozciągane do kolizji bloku (docs/assets.md, „Montaż bloków”).
const STRETCH = new Set(['pillar', 'cover_low', 'wall_segment']);
const STRETCH_TOLERANCE = 0.02;
// Rekwizyty city_* mają stałe proporcje; tolerancja wymiarów z docs/assets.md.
const PROP_TOLERANCE = 0.05;

function checksBlock(model: string | undefined): boolean {
  return !!model && (STRETCH.has(model) || /^(city|bw)_/.test(model));
}

beforeAll(() => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      const data = await readFile(`public${url}`);
      return new GLTFLoader().parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        '',
      );
    },
  );
});
afterAll(() => vi.restoreAllMocks());

const rooms = [...roomDefinitions.values()].filter((room) =>
  room.blocks.some((block) => checksBlock(block.model)),
);

it.each([...rooms.map((room) => room.id), 'indoorTest'])(
  '%s: widoczny model bloku wypełnia jego kolizję',
  async (id) => {
    const room = testRoomById(id)!;
    const boxes: Box3[] = [];
    const batch = staticBatch.batchStaticGeometry;
    const spy = vi
      .spyOn(staticBatch, 'batchStaticGeometry')
      .mockImplementation((root, owned) => {
        if (root.name === 'static-models') {
          root.updateWorldMatrix(true, true);
          for (const child of root.children)
            boxes.push(new Box3().setFromObject(child));
        }
        batch(root, owned);
      });
    const scene = createRoomTest();
    Reflect.set(scene, 'layout', { ...room, decor: [], doors: [] });
    const rapier = await initPhysics();
    const world = new rapier.World({ x: 0, y: 0, z: 0 });
    Reflect.set(scene, 'rapier', rapier);
    Reflect.set(scene, 'world', world);
    const layout = scene as unknown as {
      buildLayout(): Promise<void>;
      root: Group;
      geometries: Set<BufferGeometry>;
    };
    try {
      await layout.buildLayout();
      const failures: string[] = [];
      for (const block of room.blocks) {
        const { model, size, position } = block;
        if (!model || !checksBlock(model)) continue;
        const centre = new Vector3(position.x, position.y, position.z);
        // Model należy do bloku, jeśli jego środek w XZ i spód pokrywają się z blokiem.
        const box = boxes.find((candidate) => {
          const c = candidate.getCenter(new Vector3());
          return (
            Math.hypot(c.x - centre.x, c.z - centre.z) < 0.05 &&
            Math.abs(candidate.min.y - (position.y - size.y / 2)) < 0.02
          );
        });
        const label = `${model} @ (${position.x}, ${position.y}, ${position.z})`;
        if (!box) {
          failures.push(`${label}: brak modelu ze spodem i środkiem bloku`);
          continue;
        }
        const extent = box.getSize(new Vector3());
        const r = block.rotation;
        const expectedExtent = new Box3()
          .setFromCenterAndSize(
            new Vector3(),
            new Vector3(size.x, size.y, size.z),
          )
          .applyMatrix4(
            new Matrix4().makeRotationFromEuler(
              new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0),
            ),
          )
          .getSize(new Vector3());
        const tolerance = STRETCH.has(model)
          ? STRETCH_TOLERANCE
          : PROP_TOLERANCE;
        for (const axis of ['x', 'y', 'z'] as const) {
          const delta =
            Math.abs(extent[axis] - expectedExtent[axis]) /
            expectedExtent[axis];
          if (delta > tolerance)
            failures.push(
              `${label}: oś ${axis} model ${extent[axis].toFixed(3)} m, blok ${expectedExtent[axis]} m (${(delta * 100).toFixed(0)}%)`,
            );
        }
      }
      expect(failures).toEqual([]);
    } finally {
      spy.mockRestore();
      for (const owned of layout.geometries) owned.dispose();
      world.free();
    }
  },
);
