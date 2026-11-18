import { expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Scene } from 'three';
import { worldEnvelope, horizonParameters } from '../../src/render/horizon';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { buildSkyline } from '../../src/render/skyline';
import { loadRoom } from '../../src/world/roomSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { levelDefinitions } from '../../src/world/levels';
import { resolveTheme } from '../../src/render/themes';
import { weatherDefinitions } from '../../src/render/weatherSchema';
import hideout from '../../src/data/hub/hideout.json';
import data from '../../src/data/scenes/horizonTest.json';

const room = loadRoom(data);
const profile = weatherDefinitions.get('clearNight')!;

it('zachowuje parametry małego pokoju i kryjówki', () => {
  for (const layout of [roomDefinitions.get('combatRing')!, hideout]) {
    const fog = { nearM: 18, farM: 135 };
    const horizon = horizonParameters(
      worldEnvelope(layout.blocks, layout.playerSpawn),
      fog,
    );
    expect(horizon).toMatchObject({
      expanded: false,
      near: 0.1,
      far: 220,
      domeRadiusM: 100,
      ringsM: [66, 92, 124, 162],
      fogNear: 18,
      fogFar: 135,
    });
  }
});

it('uwzględnia przesunięcie, obrót i wysokość brył', () => {
  const position = { x: 100, y: 20, z: -300 };
  const bounds = worldEnvelope(
    [
      {
        position,
        size: { x: 20, y: 10, z: 2 },
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
      },
    ],
    position,
  );
  expect(bounds.center).toEqual(position);
  expect(bounds.heightM).toBe(10);
  expect(bounds.radiusM).toBeCloseTo(11);
  expect(bounds.bounds).toBeInstanceOf(Box3);
});

it('trzyma budynki poza obwiednią i przywraca projekcję po wyjściu', () => {
  const envelope = worldEnvelope(room.blocks, room.playerSpawn);
  const limits = horizonParameters(envelope, profile.fog);
  expect(limits.radiusM).toBeCloseTo(600 / Math.sqrt(2));
  expect(limits.ringsM[0]).toBeGreaterThan(envelope.radiusM);
  expect(limits.domeRadiusM).toBeLessThan(limits.far);
  expect(limits.fogFar).toBeLessThan(limits.far);
  expect(
    horizonParameters(envelope, { nearM: 1000, farM: 2000 }).fogFar,
  ).toBeLessThan(limits.far);
  expect(limits.far / limits.near).toBeLessThanOrEqual(2200);
  const layout = buildSkyline('horizon-test', {
    floorY: 0,
    density: 0.5,
    traffic: 1,
    height: 20,
    ringsM: limits.ringsM,
    ringOffsetM: limits.ringOffsetM,
  });
  for (const b of layout.buildings)
    expect(
      Math.hypot(b.x, b.z) - Math.hypot(b.width, b.depth) / 2,
    ).toBeGreaterThan(envelope.radiusM);
  const scene = new Scene();
  const camera = new PerspectiveCamera(70, 1, 0.3, 300);
  const atmosphere = new SceneAtmosphere(
    scene,
    'neonStreet',
    room.id,
    0,
    undefined,
    envelope,
    camera,
  );
  expect(camera.far).toBe(limits.far);
  expect(scene.getObjectByName('outer-ground')).toBeDefined();
  atmosphere.dispose();
  expect(camera.far).toBe(300);
  expect(camera.near).toBe(0.3);
  expect(scene.getObjectByName('outer-ground')).toBeUndefined();
});

it('wylicza parametry dla scen referencyjnych', () => {
  const layouts = [
    ...[
      'combatRing',
      'arenaContainerPort',
      'arenaOverpass',
      'arenaRooftops',
      'arenaConstructionSite',
    ].map((id) => roomDefinitions.get(id)!),
    levelDefinitions.get('m01-maszty')!,
    hideout,
    room,
  ];
  console.table(
    layouts.map((layout) => {
      const render = resolveTheme(layout.theme).render;
      const weather =
        'weather' in layout && layout.weather
          ? weatherDefinitions.get(layout.weather)
          : undefined;
      const h = horizonParameters(
        worldEnvelope(layout.blocks, layout.playerSpawn),
        weather?.fog ?? { nearM: render.fogNear, farM: render.fogFar },
      );
      expect(h.fogFar).toBeLessThan(h.far);
      return {
        scene: layout.id,
        far: h.far.toFixed(2),
        near: h.near.toFixed(3),
        radius: h.radiusM.toFixed(2),
        firstRing: h.ringsM[0]?.toFixed(2),
        fogFar: h.fogFar.toFixed(2),
      };
    }),
  );
});
