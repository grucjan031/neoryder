import { afterEach, describe, expect, it } from 'vitest';
import {
  Box3,
  InstancedMesh,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { tuning } from '../../src/core/tuning';
import { worldEnvelope } from '../../src/render/horizon';
import { getMaterial } from '../../src/render/materials';
import { Panorama } from '../../src/render/panorama';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { buildSkyline, SKY_PALETTE } from '../../src/render/skyline';
import { HorizonTest, horizonTestLayout } from '../../src/scenes/horizonTest';

const defaults = { ...tuning.render };
const defaultHorizonElevated = { ...tuning.horizon.elevated };
const defaultCityElevated = { ...tuning.city.elevated };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  Object.assign(tuning.horizon.elevated, defaultHorizonElevated);
  Object.assign(tuning.city.elevated, defaultCityElevated);
});

const options = { floorY: 0, density: 0.65, height: 32, traffic: 0.6 };

it('panorama jest deterministyczna i ma punkty orientacyjne z bursztynowym światłem', () => {
  const a = buildSkyline('seed', options);
  expect(buildSkyline('seed', options)).toEqual(a);
  expect(buildSkyline('inny', options)).not.toEqual(a);
  // Trzy maszty (wieże orientacyjne), każdy z bursztynowym światłem na szczycie.
  const masts = a.buildings.filter((b) => b.kind === 1);
  expect(masts).toHaveLength(3);
  for (const mast of masts) {
    const top = mast.baseY + mast.height;
    expect(
      a.beacons.some(
        (b) =>
          b.color === 0 &&
          Math.abs(b.x - mast.x) < 1e-6 &&
          Math.abs(b.y - top) < 1,
      ),
    ).toBe(true);
  }
  expect(a.ads).toHaveLength(3);
  expect(a.lanes.length).toBeGreaterThan(0);
  expect(buildSkyline('seed', { ...options, traffic: 0 }).lanes).toHaveLength(
    0,
  );
});

it('warstwy rosną z odległością, a bryły nie wchodzą w pokój', () => {
  const { buildings } = buildSkyline('seed', options);
  const radius = (layer: number) =>
    buildings.filter((b) => b.layer === layer).map((b) => Math.hypot(b.x, b.z));
  for (let layer = 0; layer < 4; layer++)
    expect(radius(layer).length).toBeGreaterThan(5);
  expect(Math.min(...radius(0))).toBeGreaterThan(55);
  expect(Math.max(...radius(3))).toBeLessThan(180);
  expect(Math.min(...radius(3))).toBeGreaterThan(Math.max(...radius(0)));
});

it('kolory panoramy pochodzą tylko z palety otoczenia (bez czerwieni, cyanu i magenty)', () => {
  expect(SKY_PALETTE).toEqual([
    '#ffae1a',
    '#fff1d6',
    '#3d7bff',
    '#8a5cff',
    '#6dff4a',
  ]);
  const layout = buildSkyline('seed', options);
  const indices = [
    ...layout.buildings.flatMap((b) => [b.windowColor, b.accent]),
    ...layout.beacons.map((b) => b.color),
    ...layout.ads.map((a) => a.color),
  ].filter((i) => i >= 0);
  for (const i of indices) expect(i).toBeLessThan(SKY_PALETTE.length);
});

it('Panorama: 7 meshy, efekty bez konturu, kopuła nieba w podgrupie', () => {
  tuning.render.panoramaEnabled = 1;
  const panorama = new Panorama('seed', 0);
  panorama.sync(0);
  let meshes = 0;
  panorama.traverse((o) => {
    if (o instanceof Mesh) meshes++;
  });
  expect(meshes).toBe(7);
  const sky = panorama.getObjectByName('sky-dome') as Mesh;
  expect(sky.parent).not.toBe(panorama);
  expect(sky.userData.noOutline).toBe(true);
  for (const name of ['skyline-beacons', 'skyline-traffic'])
    expect(panorama.getObjectByName(name)?.userData.noOutline).toBe(true);
  const buildings = panorama.getObjectByName(
    'skyline-buildings',
  ) as InstancedMesh;
  expect(buildings.count).toBeGreaterThan(50);
  expect(buildings.material).toHaveProperty('userData.bloomMaterial');
  panorama.dispose();
  expect(panorama.children).toHaveLength(0);
});

describe('żywe miasto (wysoko położone mapy)', () => {
  const towerFacade = { minX: -30, maxX: 30, minZ: -42, maxZ: 30 };
  const elevatedOptions = {
    floorY: -180,
    dropM: 180,
    facadeBounds: towerFacade,
    density: 0.65,
    height: 32,
    traffic: 0.6,
  };

  it('nie zmienia układu ani outer-ground dla map poniżej progu panoramaDropM', () => {
    const base = buildSkyline('same-seed', options);
    const lowDrop = buildSkyline('same-seed', {
      ...options,
      dropM: tuning.horizon.elevated.minDropM - 1,
    });
    expect(lowDrop).toEqual(base);
    expect(lowDrop.flybys).toHaveLength(0);
    expect(lowDrop.ads).toHaveLength(3);

    const envelope = worldEnvelope(
      [
        {
          position: { x: 0, y: -0.5, z: 0 },
          size: { x: 200, y: 1, z: 200 },
        },
      ],
      { x: 0, y: 0, z: 0 },
    );
    const scene = new Scene();
    const camera = new PerspectiveCamera(70, 1, 0.1, 220);
    const atmo = new SceneAtmosphere(
      scene,
      'neonStreet',
      'low-drop',
      0,
      envelope.bounds,
      envelope,
      camera,
      undefined,
      false,
      40,
    );
    const ground = scene.getObjectByName('outer-ground') as Mesh;
    expect(ground).toBeDefined();
    expect(ground.position.y).toBeCloseTo(
      envelope.bounds.min.y - tuning.horizon.groundOffsetM,
    );
    atmo.dispose();
  });

  it('obniża outer-ground o panoramaDropM po przekroczeniu progu', () => {
    const envelope = worldEnvelope(
      [
        {
          position: { x: 0, y: -0.5, z: 0 },
          size: { x: 200, y: 1, z: 200 },
        },
      ],
      { x: 0, y: 0, z: 0 },
    );
    const scene = new Scene();
    const camera = new PerspectiveCamera(70, 1, 0.1, 220);
    const atmo = new SceneAtmosphere(
      scene,
      'neonStreet',
      'high-drop',
      0,
      envelope.bounds,
      envelope,
      camera,
      undefined,
      false,
      180,
    );
    const ground = scene.getObjectByName('outer-ground') as Mesh;
    expect(ground).toBeDefined();
    expect(ground.position.y).toBeCloseTo(
      envelope.bounds.min.y - 180 - tuning.horizon.groundOffsetM,
    );
    atmo.dispose();
  });

  it('generuje 6–8 bliskich cyber-wieżowców, 6 billboardów, 3 pułapy ruchu i wyłącznie bursztyn/ciepłą biel na światłach ostrzegawczych', () => {
    const a = buildSkyline('run4-city', elevatedOptions);
    expect(buildSkyline('run4-city', elevatedOptions)).toEqual(a);
    expect(buildSkyline('other-city', elevatedOptions)).not.toEqual(a);

    // 3 stare maszty punktów orientacyjnych + 8 masztów bliskich cyber-wieżowców.
    const masts = a.buildings.filter((b) => b.kind === 1);
    expect(masts).toHaveLength(3 + tuning.horizon.elevated.towerCount);
    const nearbyMain = a.buildings.filter(
      (b) =>
        b.kind === 0 &&
        b.layer === 4 &&
        b.baseY === elevatedOptions.floorY - 24 &&
        b.baseY + b.height >= tuning.horizon.elevated.crownMinY,
    );
    expect(nearbyMain.length).toBeGreaterThanOrEqual(6);
    expect(nearbyMain.length).toBeLessThanOrEqual(8);
    for (const tower of nearbyMain) {
      const r = Math.hypot(tower.x, tower.z);
      expect(r).toBeGreaterThanOrEqual(tuning.horizon.elevated.towerNearM);
      expect(r).toBeLessThanOrEqual(tuning.horizon.elevated.towerFarM);
      expect(tower.baseY + tower.height).toBeLessThanOrEqual(
        tuning.horizon.elevated.crownMaxY + 1e-6,
      );
      expect(tower.accent).toBeGreaterThanOrEqual(0);
      expect(tower.accent).toBeLessThan(SKY_PALETTE.length);
    }

    // 6 billboardów na wysokości pięter gry.
    expect(a.ads).toHaveLength(6);
    for (const ad of a.ads) {
      expect(ad.y).toBeGreaterThanOrEqual(tuning.horizon.elevated.adMinY);
      expect(ad.y).toBeLessThanOrEqual(tuning.horizon.elevated.adMaxY);
      expect(ad.color).toBeGreaterThanOrEqual(0);
      expect(ad.color).toBeLessThan(SKY_PALETTE.length);
    }

    // 3 pułapy pojazdów: dno kanionu, wysokość okien i 2 tory bliskiego przelotu (9–15 m za szybą).
    const canyonLanes = a.lanes.filter((l) => l.tier === 'canyon');
    const windowLanes = a.lanes.filter((l) => l.tier === 'window');
    expect(canyonLanes.length).toBeGreaterThan(0);
    expect(windowLanes.length).toBeGreaterThan(0);
    for (const lane of canyonLanes) {
      expect(lane.height).toBeGreaterThanOrEqual(
        elevatedOptions.floorY + tuning.horizon.elevated.canyonTrafficMinY,
      );
      expect(lane.height).toBeLessThanOrEqual(
        elevatedOptions.floorY + tuning.horizon.elevated.canyonTrafficMaxY,
      );
    }
    for (const lane of windowLanes) {
      expect(lane.height).toBeGreaterThanOrEqual(
        tuning.horizon.elevated.windowTrafficMinY,
      );
      expect(lane.height).toBeLessThanOrEqual(
        tuning.horizon.elevated.windowTrafficMaxY,
      );
    }
    expect(a.flybys).toHaveLength(2);
    const north = a.flybys.find((f) => f.side === 'north')!;
    const west = a.flybys.find((f) => f.side === 'west')!;
    expect(towerFacade.minZ - north.startZ).toBeGreaterThanOrEqual(9);
    expect(towerFacade.minZ - north.startZ).toBeLessThanOrEqual(15);
    expect(towerFacade.minX - west.startX).toBeGreaterThanOrEqual(9);
    expect(towerFacade.minX - west.startX).toBeLessThanOrEqual(15);
    expect(north.height).toBeGreaterThanOrEqual(2.2);
    expect(north.height).toBeLessThanOrEqual(11.5);
    expect(west.height).toBeGreaterThanOrEqual(2.2);
    expect(west.height).toBeLessThanOrEqual(11.5);

    const noTraffic = buildSkyline('run4-city', {
      ...elevatedOptions,
      traffic: 0,
    });
    expect(noTraffic.lanes).toHaveLength(0);
    expect(noTraffic.flybys).toHaveLength(0);

    // Światła ostrzegawcze wyłącznie bursztyn (#ffae1a = 0) i ciepła biel (#fff1d6 = 1), ZERO czerwieni.
    expect(a.beacons.length).toBeGreaterThan(0);
    for (const beacon of a.beacons) {
      expect([0, 1]).toContain(beacon.color);
      expect(['#ffae1a', '#fff1d6']).toContain(SKY_PALETTE[beacon.color]);
    }
    expect(a.beacons.some((b) => b.color === 0)).toBe(true);
    expect(a.beacons.some((b) => b.color === 1)).toBe(true);
  });

  it('Panorama buduje osobne pule InstancedMesh (1 draw call na pulę), 6 billboardów i zwalnia zasoby', () => {
    tuning.render.panoramaEnabled = 1;
    const exclusion = new Box3(
      new Vector3(-30, -1, -42),
      new Vector3(30, 15, 30),
    );
    const panorama = new Panorama('run4-city', -180, exclusion, 180);
    panorama.sync(0.5);
    const traffic = panorama.getObjectByName(
      'skyline-traffic',
    ) as InstancedMesh;
    const flyby = panorama.getObjectByName('skyline-flyby') as InstancedMesh;
    const ads: Mesh[] = [];
    panorama.traverse((node) => {
      if (node instanceof Mesh && node.name === 'skyline-ad') ads.push(node);
    });
    expect(traffic).toBeInstanceOf(InstancedMesh);
    expect(flyby).toBeInstanceOf(InstancedMesh);
    expect(traffic.count).toBeGreaterThan(20);
    expect(flyby.count).toBe(2);
    expect(flyby.userData.noOutline).toBe(true);
    expect(ads).toHaveLength(6);
    panorama.dispose();
    expect(panorama.children).toHaveLength(0);
  });

  it('scena horizonTest w profilu kuroganeOfficeTower ma drop 180 m, otwarty widok na 60. piętrze, rozszerzony zasięg kamery i materiały off_*', () => {
    const layout = horizonTestLayout(
      '?scene=horizonTest&profile=kuroganeOfficeTower&debug=1',
    );
    expect(layout.weather).toBe('kuroganeOfficeTower');
    expect(layout.panoramaDropM).toBe(180);
    expect(layout.rainShelters?.length).toBeGreaterThan(0);

    // Gracz stoi tuż przy północnej krawędzi tarasu (<= 4 m), bez sufitu zasłaniającego widok na miasto i wieżowce.
    const floor = layout.blocks[0]!;
    const northEdgeZ = floor.position.z - floor.size.z / 2;
    expect(layout.playerSpawn.z - northEdgeZ).toBeLessThanOrEqual(4);
    const overheadAtSpawn = layout.blocks.some(
      (b) =>
        b.ceiling === true &&
        Math.abs(layout.playerSpawn.x - b.position.x) <= b.size.x / 2 &&
        Math.abs(layout.playerSpawn.z - b.position.z) <= b.size.z / 2,
    );
    expect(overheadAtSpawn).toBe(false);

    // Instancja sceny HorizonTest przekazuje panoramaDropM=180 i profil kuroganeOfficeTower.
    const sceneInstance = new HorizonTest(
      '?scene=horizonTest&profile=kuroganeOfficeTower&debug=1',
    );
    expect(sceneInstance.query('panoramaDropM')).toBe(180);
    expect(sceneInstance.query('horizonProfile')).toBe('kuroganeOfficeTower');
    const defaultInstance = new HorizonTest('?scene=horizonTest&debug=1');
    expect(defaultInstance.query('panoramaDropM')).toBe(0);
    expect(defaultInstance.query('horizonProfile')).toBe('default');

    // SceneAtmosphere dla tego tarasu (mimo radiusM < 50 m) rozszerza camera.far na głęboki kanion,
    // obniża outer-ground na dno kanionu (-180 m) i tworzy pełne żywe miasto.
    const envelope = worldEnvelope(layout.blocks, layout.playerSpawn);
    const three = new Scene();
    const camera = new PerspectiveCamera(90, 1, 0.1, 220);
    const atmo = new SceneAtmosphere(
      three,
      layout.theme,
      layout.id,
      layout.playerSpawn.y,
      envelope.bounds,
      envelope,
      camera,
      undefined,
      false,
      layout.panoramaDropM,
    );
    expect(camera.far).toBeGreaterThan(300);
    const ground = three.getObjectByName('outer-ground') as Mesh;
    expect(ground).toBeDefined();
    expect(ground.visible).toBe(true);
    expect(ground.position.y).toBeCloseTo(
      envelope.bounds.min.y - 180 - tuning.horizon.groundOffsetM,
    );
    expect(three.getObjectByName('skyline-flyby')).toBeInstanceOf(
      InstancedMesh,
    );
    const ads: Mesh[] = [];
    three.traverse((node) => {
      if (node instanceof Mesh && node.name === 'skyline-ad') ads.push(node);
    });
    expect(ads).toHaveLength(6);
    atmo.dispose();

    for (const kind of [
      'off_carpet_tile',
      'off_polished_granite',
      'off_wood_slat_wall',
    ] as const) {
      const material = getMaterial(kind);
      expect(material.name).toBe(`mat_${kind}`);
    }
  });
});
