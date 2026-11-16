import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Box3,
  Mesh,
  Scene as ThreeScene,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { createMemorySaveStore } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import * as staticBatch from '../../src/render/staticBatch';
import { HubScene } from '../../src/scenes/hub';
import { HUB_BATCH_CELL_M } from '../../src/scenes/hubDecor';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { HubScreens } from '../../src/ui/hubScreens';

afterEach(() => vi.restoreAllMocks());

const screens: HubScreens = {
  show() {},
  hide() {},
  refresh() {},
  dispose() {},
};

function stats(root: Object3D) {
  let meshes = 0;
  let triangles = 0;
  const materials = new Set<Material>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshes++;
    triangles +=
      (object.geometry.index?.count ??
        object.geometry.getAttribute('position').count) / 3;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  return { meshes, triangles, materials: materials.size };
}

// Pomiar 2026-11-16 (prawdziwe GLB, komórki 10 m), statyczne siatki przed -> po:
//   static-blocks/models/decor + okładziny HubDecor   1645 -> 308 (189 scalonych)
// Progi łapią zepsute scalanie (brak redukcji) i zbyt grube scalanie (całe
// materiały w jednej siatce = koniec frustum cullingu), nie drobne zmiany oprawy.
const MIN_STATIC_REDUCTION = 3;
// Siatka scalona zbiera środki brył z jednej komórki XZ: jej rozpiętość nie przekracza
// komórki powiększonej o największą pojedynczą bryłę (np. posadzkę) po obu stronach.
function largestExtent(root: Object3D): number {
  root.updateWorldMatrix(true, true);
  let largest = 0;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const box = new Box3().setFromObject(object);
    largest = Math.max(largest, box.max.x - box.min.x, box.max.z - box.min.z);
  });
  return largest;
}

it('kryjówka: geometria statyczna scalona w komórkach, bez utraty trójkątów', async () => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      const data = await readFile(`public${url}`);
      return new GLTFLoader().parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        '',
      );
    },
  );
  let before = 0;
  let after = 0;
  let merged = 0;
  const batch = staticBatch.batchStaticGeometry;
  vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
    (root, owned, options) => {
      expect(options?.cellSize).toBe(HUB_BATCH_CELL_M);
      const pre = stats(root);
      const limit = HUB_BATCH_CELL_M + largestExtent(root) + 0.001;
      const bounds = new Box3().setFromObject(root);
      batch(root, owned, options);
      const post = stats(root);
      expect(post.triangles).toBe(pre.triangles);
      expect(post.materials).toBe(pre.materials);
      const afterBounds = new Box3().setFromObject(root);
      if (!bounds.isEmpty()) {
        expect(afterBounds.min.distanceTo(bounds.min)).toBeLessThan(0.0001);
        expect(afterBounds.max.distanceTo(bounds.max)).toBeLessThan(0.0001);
      }
      root.traverse((object) => {
        if (
          !(object instanceof Mesh) ||
          !object.name.startsWith('static:') ||
          !owned.has(object.geometry)
        )
          return;
        merged++;
        const box = object.geometry.boundingBox!;
        expect(box.max.x - box.min.x).toBeLessThanOrEqual(limit);
        expect(box.max.z - box.min.z).toBeLessThanOrEqual(limit);
      });
      before += pre.meshes;
      after += post.meshes;
    },
  );
  const scene = new HubScene({
    screens,
    metaStore: createMemorySaveStore(),
    navigate: () => {},
    params: new URLSearchParams(),
    loadModels: true,
  });
  try {
    await scene.init(
      {
        bus: new EventBus(),
        commands: new CommandRegistry(),
        rng: new Rng('hub-batch'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new ThreeScene(),
    );
    expect(merged).toBeGreaterThan(0);
    expect(after * MIN_STATIC_REDUCTION).toBeLessThanOrEqual(before);
  } finally {
    scene.dispose();
  }
});
