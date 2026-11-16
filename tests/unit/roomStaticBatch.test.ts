import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Mesh, Scene, type Object3D, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomScene } from '../../src/scenes/roomScene';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import type { RunState } from '../../src/core/runTypes';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { roomDefinitions } from '../../src/world/rooms';
import { loadWaves } from '../../src/world/waves';
import wavesData from '../../src/data/waves/roomTest.json';
import * as staticBatch from '../../src/render/staticBatch';

afterEach(() => vi.restoreAllMocks());

function counts(roots: readonly Object3D[]) {
  let meshes = 0;
  const materials = new Set<Material>();
  for (const root of roots)
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      meshes++;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    });
  return { meshes, materials: materials.size };
}

// Pomiar przed Z19: cała scena po init, prawdziwe GLB, także niewidoczne pule/VFX.
const baselines = {
  alleyMarket: 1683,
  combatWarehouse: 529,
  eliteFoundry: 600,
};

it.each(['alleyMarket', 'combatWarehouse', 'eliteFoundry'] as const)(
  '%s: co najmniej 3x mniej siatek po init z prawdziwymi GLB',
  async (id) => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
      async (url) => {
        const data = await readFile(`public${url}`);
        return new GLTFLoader().parseAsync(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
          '',
        );
      },
    );
    const rows: {
      source: string;
      before: ReturnType<typeof counts>;
      after: ReturnType<typeof counts>;
    }[] = [];
    const batch = staticBatch.batchStaticGeometry;
    const outputDisposals: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
      (root, owned) => {
        const before = counts([root]);
        const bounds = new Box3().setFromObject(root);
        const triangles = (object: Object3D) => {
          let total = 0;
          object.traverse((mesh) => {
            if (mesh instanceof Mesh)
              total +=
                (mesh.geometry.index?.count ??
                  mesh.geometry.getAttribute('position').count) / 3;
          });
          return total;
        };
        const triangleCount = triangles(root);
        batch(root, owned);
        root.traverse((object) => {
          if (object instanceof Mesh && object.name.startsWith('static:'))
            outputDisposals.push(
              vi.spyOn(
                object.geometry as import('three').BufferGeometry,
                'dispose',
              ),
            );
        });
        const afterBounds = new Box3().setFromObject(root);
        expect(afterBounds.min.distanceTo(bounds.min)).toBeLessThan(0.0001);
        expect(afterBounds.max.distanceTo(bounds.max)).toBeLessThan(0.0001);
        expect(triangles(root)).toBe(triangleCount);
        expect(counts([root]).materials).toBe(before.materials);
        rows.push({ source: root.name, before, after: counts([root]) });
      },
    );
    const room = roomDefinitions.get(id)!;
    const run: RunState = {
      seed: 'static-batch',
      sectorId: 'test',
      loadoutId: 'classic',
      loadout: loadoutDefinitions.get('classic')!,
      talents: [],
      threatLevel: 0,
      startedAtMs: 0,
      elapsedS: 0,
      map: {
        sectorId: 'test',
        layers: [
          [{ id: 'node', layer: 2, index: 0, type: room.type, next: [] }],
        ],
      },
      currentNodeId: 'node',
      visited: [],
      hp: 100,
      energy: 100,
      credits: 0,
      implants: [],
      stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
    };
    const scene = new RoomScene(
      room,
      run,
      loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
    );
    const three = new Scene();
    try {
      await scene.init(
        {
          bus: new EventBus(),
          rng: new Rng(run.seed),
          loop: new GameLoop({ step() {}, render() {} }),
          tuning: structuredClone(tuning),
          debug: false,
        },
        three,
      );
      const root = Reflect.get(scene, 'root') as Object3D;
      const dressing = Reflect.get(scene, 'dressing') as object;
      for (const source of [
        'signs',
        'lights',
        'lamps',
        'decals',
        'ambient',
        'weather',
      ]) {
        const part = Reflect.get(dressing, source) as
          { root: Object3D } | undefined;
        const count = counts(part ? [part.root] : []);
        rows.push({ source, before: count, after: count });
      }
      const panorama = counts(
        three.children.filter((child) => child.name === 'city-panorama'),
      );
      rows.push({ source: 'panorama', before: panorama, after: panorama });
      const after = counts([three]);
      const saved = rows.reduce(
        (sum, row) => sum + row.before.meshes - row.after.meshes,
        0,
      );
      // Z19 mierzył starą pulę VFX. Z21 dodaje osobny rdzeń i falę na wybuch.
      const explosionDetails: Mesh[] = [];
      three.traverse((object) => {
        if (
          object instanceof Mesh &&
          (object.name === 'explosion-core' || object.name === 'explosion-ring')
        )
          explosionDetails.push(object);
      });
      for (const name of ['explosion-core', 'explosion-ring'])
        expect(
          explosionDetails.filter((mesh) => mesh.name === name),
        ).toHaveLength(tuning.vfx.maxExplosions);
      expect(explosionDetails.every((mesh) => !mesh.visible)).toBe(true);
      const comparableMeshes = after.meshes - explosionDetails.length;
      expect(comparableMeshes + saved).toBe(baselines[id]);
      expect(comparableMeshes).toBeLessThanOrEqual(
        Math.floor(baselines[id] / 3),
      );
      expect(rows.slice(0, 3).map((row) => row.source)).toEqual([
        'static-blocks',
        'static-models',
        'static-decor',
      ]);
      const doors = root.children.filter((child) =>
        child.name.startsWith('door:'),
      );
      expect(doors).toHaveLength(room.doors.length);
      const colliders = scene.query('bodies');
      scene.clear();
      expect(root.getObjectByName('door:exit')?.visible).toBe(false);
      expect(scene.query('bodies')).toBe(colliders);
      console.log(
        JSON.stringify({
          room: id,
          totalBefore: baselines[id],
          totalAfter: after,
          rows,
        }),
      );
    } finally {
      scene.dispose();
      scene.dispose();
      for (const dispose of outputDisposals)
        expect(dispose).toHaveBeenCalledOnce();
    }
  },
);
