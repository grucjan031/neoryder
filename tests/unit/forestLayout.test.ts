import { describe, expect, it } from 'vitest';
import { Box3, InstancedMesh, Raycaster, Scene, Vector3 } from 'three';
import { tuning } from '../../src/core/tuning';
import {
  buildForestLayout,
  forestTerrainHeight,
} from '../../src/render/forestLayout';
import { worldEnvelope } from '../../src/render/horizon';
import { ForestPanorama } from '../../src/render/forestPanorama';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { CityDressing } from '../../src/render/city/dressing';
import { resolveTheme } from '../../src/render/themes';
import {
  weatherDefinitions,
  weatherSchema,
} from '../../src/render/weatherSchema';
import { horizonTestLayout } from '../../src/scenes/horizonTest';
import { blockMaterialSchema } from '../../src/world/dressingSchema';
import { urbanLooks } from '../../src/render/urbanMaterials';
import { isCityModelFile } from '../../src/render/cityModels';

const exclusion = { minX: -30, maxX: 30, minZ: -43, maxZ: 33 };
const options = { floorY: 0, exclusion };
const t = tuning.forest;

describe('tło lasu rezydencji', () => {
  it('izoluje seed, zachowuje determinizm i budżety trzech warstw', () => {
    const a = buildForestLayout('run7', options);
    expect(a).toEqual(buildForestLayout('run7', options));
    expect(a.conifers).not.toEqual(
      buildForestLayout('other-run', options).conifers,
    );
    expect(a.conifers).toHaveLength(t.conifersMax);
    expect(a.deciduous).toHaveLength(t.deciduousMax);
    expect(a.undergrowth).toHaveLength(t.undergrowthMax);
    expect(a.hills).toHaveLength(t.hillsMax);
    expect(a.mist).toHaveLength(t.mistMax);
    expect(a.perimeterPosts).toHaveLength(t.postsMax);
    expect(a.drones).toHaveLength(t.dronesMax);
    expect(a.flybys).toHaveLength(2);
    expect(a.faunaEyes).toHaveLength(t.faunaMax);
    for (const layer of [0, 1, 2]) {
      const trees = a.conifers.filter((tree) => tree.layer === layer);
      expect(trees).toHaveLength(t.conifersMax / 3);
      expect(trees.every((tree) => tree.y >= options.floorY)).toBe(true);
    }
    expect(a.conifers.some((tree) => tree.y > options.floorY)).toBe(true);
  });

  it.each([0, 1, 7, 41])(
    'całe obrysy i tory omijają budynek oraz margines, seed %s',
    (seed) => {
      const b = { minX: 170, maxX: 230, minZ: -343, maxZ: -267 };
      const a = buildForestLayout(String(seed), { floorY: -4.8, exclusion: b });
      const outside = (p: { x: number; z: number }, radius: number) => {
        const margin = radius + t.clearanceM;
        expect(
          p.x + margin <= b.minX ||
            p.x - margin >= b.maxX ||
            p.z + margin <= b.minZ ||
            p.z - margin >= b.maxZ,
          JSON.stringify(p),
        ).toBe(true);
      };
      for (const tree of [...a.conifers, ...a.deciduous, ...a.undergrowth])
        outside(tree, tree.width + t.swayM);
      for (const hill of a.hills) outside(hill, hill.radius);
      for (const mist of a.mist) outside(mist, t.mistWidthM / 2);
      for (const post of a.perimeterPosts) outside(post, t.fenceWidthM);
      for (const eye of a.faunaEyes) outside(eye, t.eyeSeparationM);
      outside(a.helipad, a.helipad.radius);
      outside(a.watchtower, t.droneSizeM);
      for (const route of [...a.drones, ...a.flybys]) {
        for (let i = 0; i <= 20; i++)
          outside(
            {
              x: route.start.x + ((route.end.x - route.start.x) * i) / 20,
              z: route.start.z + ((route.end.z - route.start.z) * i) / 20,
            },
            t.droneSizeM,
          );
      }
      for (const tree of [...a.conifers, ...a.deciduous])
        expect(
          Math.hypot(tree.x - a.helipad.x, tree.z - a.helipad.z),
        ).toBeGreaterThanOrEqual(tree.width + a.helipad.radius);
    },
  );

  it('profil waliduje się, deszcz zostaje na zewnątrz, a stare profile domyślnie wybierają miasto', () => {
    const profile = weatherSchema.parse(
      weatherDefinitions.get('kuroganeForestResidence'),
    );
    expect(profile.lighting?.panoramaKind).toBe('forest');
    expect(profile.precipitation).toMatchObject({
      kind: 'rain',
      density: 0.52,
    });
    expect(profile.fog.density).toBe(0);
    expect(profile.fog.strength).toBe(0);
    expect(profile.lightning.enabled).toBe(false);
    expect(
      weatherSchema.safeParse({
        ...profile,
        lighting: { ...profile.lighting, panoramaKind: 'unknown' },
      }).success,
    ).toBe(false);
    const scene = new Scene();
    const atmosphere = new SceneAtmosphere(scene, 'neonStreet', 'seed', 0);
    const dressing = new CityDressing(
      scene,
      {},
      resolveTheme('neonStreet'),
      0,
      'seed',
    );
    try {
      expect(scene.getObjectByName('city-panorama')).toBeDefined();
      dressing.setWeather(profile.id);
      atmosphere.sync(0);
      expect(scene.getObjectByName('city-panorama')).toBeUndefined();
      expect(scene.getObjectByName('forest-panorama')).toBeDefined();
      dressing.setWeather('kuroganeOfficeTower');
      atmosphere.sync(0);
      expect(tuning.render.panoramaKind).toBe('city');
      expect(scene.getObjectByName('city-panorama')).toBeDefined();
      expect(scene.getObjectByName('forest-panorama')).toBeUndefined();
      dressing.setWeather(profile.id);
    } finally {
      dressing.dispose();
      expect(tuning.render.panoramaKind).toBe('city');
      atmosphere.dispose();
    }
  });

  it('render trzyma budżet partii i zwalnia zasoby przy zmianie ustawień i wyjściu', () => {
    const previous = tuning.render.panoramaEnabled;
    const previousLayers = t.crownLayers;
    tuning.render.panoramaEnabled = 1;
    const panorama = new ForestPanorama(
      'seed',
      0,
      new Box3(new Vector3(-30, -5, -43), new Vector3(30, 10, 33)),
    );
    try {
      panorama.sync(0);
      expect(panorama.children.length).toBeLessThanOrEqual(t.drawCallsMax);
      expect(
        panorama.children.filter((child) => child instanceof InstancedMesh),
      ).toHaveLength(panorama.children.length - 1);
      const mesh = panorama.getObjectByName('forest-conifers') as InstancedMesh;
      expect(mesh.count).toBe(t.conifersMax * t.crownLayers);
      let released = false;
      mesh.geometry.addEventListener('dispose', () => {
        released = true;
      });
      panorama.sync(1);
      expect(panorama.getObjectByName('forest-conifers')).toBe(mesh);
      t.crownLayers += 1;
      panorama.sync(0);
      expect(released).toBe(true);
      expect(panorama.getObjectByName('forest-conifers')).not.toBe(mesh);
      panorama.dispose();
      expect(released).toBe(true);
      expect(panorama.children).toHaveLength(0);
    } finally {
      panorama.dispose();
      tuning.render.panoramaEnabled = previous;
      t.crownLayers = previousLayers;
    }
  });

  it('ściółka ma relief i nie zasłania piwnicy, a rośliny wyrastają z terenu', () => {
    const layout = buildForestLayout('run7', options);
    for (const tree of [
      ...layout.conifers,
      ...layout.deciduous,
      ...layout.undergrowth,
    ]) {
      expect(tree.y).toBe(forestTerrainHeight(tree, layout.hills, 0));
    }
    const previous = tuning.render.panoramaEnabled;
    tuning.render.panoramaEnabled = 1;
    const panorama = new ForestPanorama(
      'run7',
      0,
      new Box3(new Vector3(-30, -5.4, -43), new Vector3(30, 10, 33)),
    );
    try {
      panorama.sync(0);
      panorama.updateMatrixWorld(true);
      const ground = panorama.getObjectByName('forest-ground') as InstancedMesh;
      const ray = new Raycaster(new Vector3(0, 10, 24), new Vector3(0, -1, 0));
      const belowCellar = ray.intersectObject(ground)[0];
      expect(belowCellar).toBeDefined();
      expect(belowCellar!.point.y).toBeLessThan(-5.4);
      const heights = [-5, 5, 15].map((x) => {
        ray.set(new Vector3(x, 40, -50), new Vector3(0, -1, 0));
        const hit = ray.intersectObject(ground)[0];
        expect(hit).toBeDefined();
        return hit!.point.y;
      });
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.1);
      expect(heights.every((height) => height >= 0)).toBe(true);
    } finally {
      panorama.dispose();
      tuning.render.panoramaEnabled = previous;
    }
  });

  it('las dużej mapy zastępuje płaskie podłoże panoramy miasta', () => {
    const scene = new Scene();
    const room = horizonTestLayout('?profile=kuroganeForestResidence');
    const atmosphere = new SceneAtmosphere(
      scene,
      room.theme,
      'run7',
      0,
      undefined,
      worldEnvelope(
        [{ position: { x: 0, y: 0, z: 0 }, size: { x: 600, y: 10, z: 600 } }],
        room.playerSpawn,
      ),
    );
    const dressing = new CityDressing(
      scene,
      {},
      resolveTheme(room.theme),
      0,
      'run7',
    );
    try {
      dressing.setWeather('kuroganeOfficeTower');
      atmosphere.sync(0);
      const ground = scene.getObjectByName('outer-ground');
      expect(ground?.visible).toBe(true);
      dressing.setWeather('kuroganeForestResidence');
      atmosphere.sync(0);
      expect(ground?.visible).toBe(false);
      expect(scene.getObjectByName('forest-ground')).toBeDefined();
    } finally {
      dressing.dispose();
      atmosphere.dispose();
    }
  });

  it('scena debug pokazuje las i cztery materiały za pełną szybą ze schronieniem od deszczu', () => {
    const room = horizonTestLayout('?profile=kuroganeForestResidence');
    expect(room.weather).toBe('kuroganeForestResidence');
    expect(room.rainShelters).toHaveLength(1);
    expect(room.panoramaDropM ?? 0).toBe(0);
    expect(isCityModelFile('res_forest_glass_facade')).toBe(true);
    for (const name of [
      'res_arch_concrete',
      'res_dark_walnut',
      'res_nero_marble',
      'res_plush_carpet',
    ] as const) {
      expect(blockMaterialSchema.parse(name)).toBe(name);
      expect(urbanLooks[name].texture).toBe(name);
      expect(room.blocks.some((block) => block.material === name)).toBe(true);
    }
  });
});
