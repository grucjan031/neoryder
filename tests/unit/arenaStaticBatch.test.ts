import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Box3,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Scene,
  Vector3,
  type Object3D,
} from 'three';
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
// Szablony GLB są buforowane między testami: model wczytany przy poprzedniej arenie też się liczy.
const loaded = new Set<string>();

function meshCount(root: Object3D): number {
  let count = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) count++;
  });
  return count;
}

it.each(['arenaContainerPort', 'arenaOverpass', 'arenaRooftops'])(
  '%s: jedno scalanie w komórkach areny, kontenery jako instancje, rzeczywiste GLB',
  async (id) => {
    const warnings = vi.spyOn(console, 'warn');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
      async (url) => {
        loaded.add(String(url));
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
    const containerColors = new Set<string>();
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
      (root, owned, options) => {
        calls++;
        expect(root.name).toBe('static-world');
        expect(options?.cellSize).toBe(
          roomDefinitions.get(id)!.arena!.batchCellM,
        );
        before = meshCount(root);
        root.updateWorldMatrix(true, true);
        const containers = roomDefinitions
          .get(id)!
          .blocks.filter((b) => b.model?.startsWith('port_container_'));
        let renderedContainers = 0;
        root.traverse((o) => {
          if (
            o instanceof Mesh &&
            !Array.isArray(o.material) &&
            o.material.name.startsWith('mat_container_')
          ) {
            expect(o.material.color.getHexString()).not.toBe('ffffff');
            containerColors.add(o.material.name);
            if (o instanceof InstancedMesh) expect(o.instanceColor).toBeNull();
            expect(o.geometry.getAttribute('position').count).toBeGreaterThan(
              24,
            );
            const count = o instanceof InstancedMesh ? o.count : 1;
            for (let i = 0; i < count; i++) {
              const transform = new Matrix4();
              if (o instanceof InstancedMesh) o.getMatrixAt(i, transform);
              transform.premultiply(o.matrixWorld);
              o.geometry.computeBoundingBox();
              const bounds = o.geometry
                .boundingBox!.clone()
                .applyMatrix4(transform);
              const match = containers.find((b) => {
                const r = b.rotation;
                const collider = new Box3(
                  new Vector3(-b.size.x / 2, -b.size.y / 2, -b.size.z / 2),
                  new Vector3(b.size.x / 2, b.size.y / 2, b.size.z / 2),
                ).applyMatrix4(
                  new Matrix4().compose(
                    new Vector3(b.position.x, b.position.y, b.position.z),
                    new Quaternion().setFromEuler(
                      new Euler(r?.x ?? 0, r?.y ?? 0, r?.z ?? 0),
                    ),
                    new Vector3(1, 1, 1),
                  ),
                );
                return (
                  bounds.min.distanceTo(collider.min) < 0.06 &&
                  bounds.max.distanceTo(collider.max) < 0.06
                );
              });
              expect(
                match,
                `Model poza colliderem: ${o.name} ${JSON.stringify(bounds)}`,
              ).toBeDefined();
              renderedContainers++;
            }
          }
          if (o instanceof InstancedMesh) {
            instanced++;
            disposals.push(vi.spyOn(o, 'dispose'));
          }
        });
        expect(renderedContainers).toBe(containers.length);
        batch(root, owned, options);
        after = meshCount(root);
      },
    );
    const room = roomDefinitions.get(id)!;
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
      expect(scene.query('weather')).toBe(room.weather);
      expect(calls).toBe(1);
      if (room.blocks.some((b) => b.instance))
        expect(instanced).toBeGreaterThan(1);
      if (id === 'arenaContainerPort')
        expect([...containerColors].sort()).toEqual([
          'mat_container_graphite',
          'mat_container_navy',
          'mat_container_ochre',
          'mat_container_olive',
        ]);
      for (const model of id === 'arenaContainerPort'
        ? [
            'port_gantry_crane',
            'port_light_tower',
            'port_reach_stacker',
            'port_lashing_platform',
            'port_quay_edge',
            'port_bollard',
            'port_bollard_rope',
          ]
        : [
            ...new Set([
              ...room.blocks.flatMap((b) => (b.model ? [b.model] : [])),
              ...(room.decor ?? []).map((d) => d.model),
            ]),
          ])
        expect(loaded.has(`/assets/models/city/${model}.glb`)).toBe(true);
      expect(
        warnings.mock.calls.filter(([message]) =>
          String(message).includes('Nieznany'),
        ),
      ).toEqual([]);
      // Pomiar strukturalny, nie renderer.info.render.calls: bez WebGL i bez cullingu.
      console.info(
        JSON.stringify({
          arena: room.id,
          staticMeshesBefore: before,
          staticMeshesAfter: after,
          instancedBatches: instanced,
        }),
      );
      expect(after).toBeLessThan(before / 2);
    } finally {
      scene.dispose();
    }
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  },
);
