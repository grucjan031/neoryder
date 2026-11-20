import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Box3,
  InstancedMesh,
  Matrix4,
  Mesh,
  Scene,
  Vector3,
  type Material,
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

const originalBatch = staticBatch.batchStaticGeometry;
afterEach(() => vi.restoreAllMocks());

interface Totals {
  drawObjects: number;
  /** Instancje modeli bloków wg nazwy partii `instances:<kształt>:<węzeł>` (suma count). */
  instances: Map<string, number>;
  /** Nazwy partii, które zostały `InstancedMesh` (reszta scaliła się ze statyką). */
  instanced: Set<string>;
  triangles: Map<string, number>;
  layers: Map<string, Set<number>>;
  flags: Map<string, Set<string>>;
  bounds: Map<string, Box3>;
}

function collect(root: Object3D): Totals {
  const totals: Totals = {
    drawObjects: 0,
    instances: new Map(),
    instanced: new Set(),
    triangles: new Map(),
    layers: new Map(),
    flags: new Map(),
    bounds: new Map(),
  };
  root.updateWorldMatrix(true, true);
  const corner = new Vector3();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    totals.drawObjects++;
    const material = object.material as Material;
    const key = material.uuid;
    const geometry = object.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const triangles =
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    const count = object instanceof InstancedMesh ? object.count : 1;
    if (object instanceof InstancedMesh) totals.instanced.add(object.name);
    if (object.name.startsWith('instances:'))
      totals.instances.set(
        object.name,
        (totals.instances.get(object.name) ?? 0) + count,
      );
    totals.triangles.set(
      key,
      (totals.triangles.get(key) ?? 0) + triangles * count,
    );
    (totals.layers.get(key) ?? totals.layers.set(key, new Set()).get(key)!).add(
      object.layers.mask,
    );
    (totals.flags.get(key) ?? totals.flags.set(key, new Set()).get(key)!).add(
      `${object.userData.noOutline === true}:${JSON.stringify(object.userData.bloom ?? null)}:${object.castShadow}:${object.receiveShadow}`,
    );
    const bounds = totals.bounds.get(key) ?? new Box3();
    totals.bounds.set(key, bounds);
    const transform = new Matrix4();
    for (let i = 0; i < count; i++) {
      if (object instanceof InstancedMesh) object.getMatrixAt(i, transform);
      else transform.identity();
      transform.premultiply(object.matrixWorld);
      for (const x of [
        geometry.boundingBox!.min.x,
        geometry.boundingBox!.max.x,
      ])
        for (const y of [
          geometry.boundingBox!.min.y,
          geometry.boundingBox!.max.y,
        ])
          for (const z of [
            geometry.boundingBox!.min.z,
            geometry.boundingBox!.max.z,
          ])
            bounds.expandByPoint(corner.set(x, y, z).applyMatrix4(transform));
    }
  });
  return totals;
}

async function build(id: string, budget: number): Promise<Totals> {
  const room = roomDefinitions.get(id)!;
  const bus = new EventBus();
  const manager = new RunManager(bus, {
    generateMap: () => ({ sectorId: 'unused', layers: [] }),
  });
  manager.newRun('draw-budget', 'classic', { modeId: 'conquest', arenaId: id });
  manager.selectNode('conquest');
  const scene = new RoomScene(
    room,
    manager.state,
    loadWaves({ ...wavesData, spawnPoints: room.spawnPoints }),
  );
  const copy = structuredClone(tuning);
  copy.arena.batchTriangleBudget = budget;
  let root: Object3D | undefined;
  vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
    (r, owned, options) => {
      root = r;
      originalBatch(r, owned, options);
    },
  );
  try {
    await scene.init(
      {
        bus,
        rng: new Rng('draw-budget'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: copy,
        debug: false,
      },
      new Scene(),
    );
    expect(root?.name).toBe('static-world');
    return collect(root!);
  } finally {
    scene.dispose();
  }
}

it.each(['arenaContainerPort', 'arenaFloodedDocks'])(
  '%s: budżet trójkątów zmniejsza liczbę obiektów rysowania bez zmiany geometrii, warstw i flag',
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
    const grid = await build(id, 0);
    const budgeted = await build(id, tuning.arena.batchTriangleBudget);
    expect(budgeted.drawObjects).toBeLessThan(grid.drawObjects * 0.35);
    // Rzadkie, tanie modele scalają się ze statyką; instancje zostają przy dużej liczbie kopii.
    const merged = [...budgeted.instanced].filter(
      (name) =>
        name.startsWith('instances:city_dumpster') ||
        name.startsWith('instances:city_kiosk'),
    );
    expect(merged).toEqual([]);
    if (id === 'arenaContainerPort')
      expect(
        [...budgeted.instanced].some((name) =>
          name.startsWith('instances:port_container_20'),
        ),
      ).toBe(true);
    // Tyle samo instancji modeli z danych: sumy po wszystkich partiach i komórkach.
    for (const size of ['20', '40']) {
      const blocks = roomDefinitions
        .get(id)!
        .blocks.filter((b) => b.model?.startsWith(`port_container_${size}_`));
      const sums = [...budgeted.instances]
        .filter(([name]) =>
          name.startsWith(`instances:port_container_${size}:`),
        )
        .map(([, count]) => count);
      if (blocks.length) expect(Math.max(...sums)).toBe(blocks.length);
    }
    expect([...budgeted.triangles.keys()].sort()).toEqual(
      [...grid.triangles.keys()].sort(),
    );
    for (const [material, triangles] of grid.triangles) {
      expect(budgeted.triangles.get(material), material).toBe(triangles);
      expect(budgeted.layers.get(material)).toEqual(grid.layers.get(material));
      expect(budgeted.flags.get(material)).toEqual(grid.flags.get(material));
      const a = grid.bounds.get(material)!;
      const b = budgeted.bounds.get(material)!;
      expect(b.min.distanceTo(a.min)).toBeLessThan(1e-3);
      expect(b.max.distanceTo(a.max)).toBeLessThan(1e-3);
    }
  },
  120_000,
);
