import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Mesh, Scene, type Object3D, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Arena } from '../../src/scenes/arena';
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

// Budżety są bezwzględne i wspólne dla wszystkich pokoi, więc nie rosną same przy
// kolejnych zmianach oprawy. Podnoś je tylko świadomie, z nowym pomiarem w komentarzu.
// Pomiar 2026-11-16 (integracja szlifu, cała scena po init, prawdziwe GLB):
//   pokój            siatki sceny   pule vfxPool   statyczne przed -> po scaleniu
//   alleyMarket      327            99              1554 -> 42
//   combatWarehouse  324            103             456 -> 26
//   eliteFoundry     340            101             461 -> 25
// Wszystkie siatki sceny, także ukryte pule VFX i viewmodel: max 340 + ok. 15% zapasu.
// Pokoje runu, pomiar 2026-11-23 (siatki sceny, statyka przed -> po scaleniu): alleyMarket 419 (2039 -> 60),
// combatWarehouse 512 (7107 -> 59), eliteFoundry 606 (4730 -> 56), plazaHolo 630 (5747 -> 55; max): 630 + ok. 10% zapasu.
const RUN_SCENE_MESH_BUDGET = 700;
// Ukryte pule oznaczone `userData.vfxPool`: max 103 + ok. 15% zapasu. Pule wliczają się
// też do SCENE_MESH_BUDGET, więc oznaczenie siatki flagą niczego nie omija.
const VFX_POOL_BUDGET = 118;
// Scalanie statycznej geometrii (bloki + modele + dekoracje). Dziś redukcja 17-37x
// i dokładnie jedna siatka na materiał; progi łapią zepsute scalanie, nie drobne zmiany.
const MIN_STATIC_REDUCTION = 5;
const MAX_STATIC_MESHES_PER_MATERIAL = 2;
// Pokoje runu (blok `arena`) scalają całą statykę w komórkach jednym korzeniem `static-world`.
const staticSources = ['static-world'];

// Pokoje runu (partie A–C) są areną z instancjami i komórkami batchowania: mierzymy je jak dawne pokoje,
// ale statyka to jeden korzeń `static-world`, a budżet siatek sceny jest większy (RUN_SCENE_MESH_BUDGET).
it.each([
  'alleyMarket',
  'combatCorridor',
  'combatFloodedTunnel',
  'combatLaserYard',
  'combatPillars',
  'combatPlatforms',
  'combatSubstation',
  'combatWarehouse',
  'combatYard',
  'eliteChemPlant',
  'eliteCourtyard',
  'eliteFoundry',
  'eliteHall',
  'plazaHolo',
] as const)(
  '%s: scalona geometria statyczna i budżet siatek po init z prawdziwymi GLB',
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
      expect(after.meshes).toBeLessThanOrEqual(RUN_SCENE_MESH_BUDGET);
      // Sama geometria statyczna: niezależnie od pul VFX, viewmodelu i oprawy.
      const staticRows = rows.slice(0, staticSources.length);
      expect(staticRows.map((row) => row.source)).toEqual(staticSources);
      const sum = (pick: (row: (typeof rows)[number]) => number) =>
        staticRows.reduce((total, row) => total + pick(row), 0);
      const staticBefore = sum((row) => row.before.meshes);
      const staticAfter = sum((row) => row.after.meshes);
      expect(staticAfter).toBeGreaterThan(0);
      expect(staticAfter * MIN_STATIC_REDUCTION).toBeLessThanOrEqual(
        staticBefore,
      );
      expect(staticAfter).toBeLessThanOrEqual(
        sum((row) => row.after.materials) * MAX_STATIC_MESHES_PER_MATERIAL,
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
      // Ukryte pule efektów walki (żar odłamków, błyski, fale Rezonansu, siatka
      // Bariery) mają własny limit, żeby flaga `vfxPool` nie stała się furtką.
      let vfxPools = 0;
      three.traverse((object) => {
        if (object instanceof Mesh && object.userData.vfxPool === true)
          vfxPools++;
      });
      expect(vfxPools).toBeLessThanOrEqual(VFX_POOL_BUDGET);
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
          sceneMeshes: after,
          vfxPools,
          staticBefore,
          staticAfter,
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

// Arena (po init, prawdziwe GLB). Pomiar 2026-11-16: static-blocks 5 -> 1,
// static-models 11 -> 2, wszystkie siatki sceny 217. Budżet: 217 + ok. 20% zapasu;
// podnoś go tylko świadomie, z nowym pomiarem w komentarzu.
const ARENA_SCENE_MESH_BUDGET = 260;
it('arena: scalone statyczne bloki i modele bloków, budżet siatek', async () => {
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
  vi.spyOn(staticBatch, 'batchStaticGeometry').mockImplementation(
    (root, owned) => {
      const before = counts([root]);
      const bounds = new Box3().setFromObject(root);
      batch(root, owned);
      const afterBounds = new Box3().setFromObject(root);
      expect(afterBounds.min.distanceTo(bounds.min)).toBeLessThan(0.0001);
      expect(afterBounds.max.distanceTo(bounds.max)).toBeLessThan(0.0001);
      expect(counts([root]).materials).toBe(before.materials);
      rows.push({ source: root.name, before, after: counts([root]) });
    },
  );
  const scene = new Arena(true);
  const three = new Scene();
  try {
    await scene.init(
      {
        bus: new EventBus(),
        rng: new Rng('static-batch'),
        loop: new GameLoop({ step() {}, render() {} }),
        tuning: structuredClone(tuning),
        debug: false,
      },
      three,
    );
    const blocks = rows.filter((row) =>
      ['static-blocks', 'static-models'].includes(row.source),
    );
    expect(blocks.map((row) => row.source)).toEqual([
      'static-blocks',
      'static-models',
    ]);
    for (const row of blocks) {
      expect(row.after.meshes).toBeGreaterThan(0);
      expect(row.after.meshes).toBeLessThan(row.before.meshes);
      expect(row.after.meshes).toBeLessThanOrEqual(
        row.after.materials * MAX_STATIC_MESHES_PER_MATERIAL,
      );
    }
    const after = counts([three]);
    expect(after.meshes).toBeLessThanOrEqual(ARENA_SCENE_MESH_BUDGET);
    console.log(JSON.stringify({ room: 'arena', sceneMeshes: after, rows }));
  } finally {
    scene.dispose();
  }
});
