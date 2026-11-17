import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { InstancedMesh, Mesh, Scene, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { RoomScene } from '../../src/scenes/roomScene';
import { roomDefinitions } from '../../src/world/rooms';
import { RunManager } from '../../src/world/run';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';
import * as staticBatch from '../../src/render/staticBatch';

afterEach(() => vi.restoreAllMocks());

function meshCount(root: Object3D): number {
  let count = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) count++;
  });
  return count;
}

it('port: jedno scalanie w komórkach 20 m, kontenery jako instancje, rzeczywiste GLB', async () => {
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
    async (url) => {
      const data = await readFile(`public${url}`);
      return new GLTFLoader().parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        '',
      );
    },
  );
  const batch = staticBatch.batchStaticGeometry;
  let before = 0,
    after = 0,
    calls = 0,
    instanced = 0;
  const disposals: ReturnType<typeof vi.spyOn>[] = [];
  vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
    (root, owned, options) => {
      calls++;
      expect(root.name).toBe('static-world');
      expect(options?.cellSize).toBe(20);
      before = meshCount(root);
      root.traverse((o) => {
        if (o instanceof InstancedMesh) {
          instanced++;
          disposals.push(vi.spyOn(o, 'dispose'));
        }
      });
      batch(root, owned, options);
      after = meshCount(root);
    },
  );
  const room = roomDefinitions.get('arenaContainerPort')!;
  const bus = new EventBus();
  const manager = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  manager.newRun('port-static', 'classic', {
    modeId: 'conquest',
    arenaId: room.id,
  });
  manager.selectNode('conquest');
  const scene = new RoomScene(
    room,
    manager.state,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
  );
  try {
    await scene.init(
      {
        bus,
        rng: new Rng('port-static'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      new Scene(),
    );
    expect(scene.query('weather')).toBe('storm');
    expect(calls).toBe(1);
    expect(instanced).toBeGreaterThan(1);
    expect(after).toBeLessThan(before / 2);
    // Pomiar strukturalny, nie renderer.info.render.calls: bez WebGL i bez cullingu.
    console.info(
      JSON.stringify({
        arena: room.id,
        staticMeshesBefore: before,
        staticMeshesAfter: after,
        instancedBatches: instanced,
      }),
    );
  } finally {
    scene.dispose();
  }
  for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
});
