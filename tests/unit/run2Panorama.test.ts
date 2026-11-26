import { InstancedMesh, Scene } from 'three';
import { expect, it } from 'vitest';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { horizonParameters, worldEnvelope } from '../../src/render/horizon';
import { buildSkyline } from '../../src/render/skyline';
import { resolveTheme } from '../../src/render/themes';
import { roomDefinitions } from '../../src/world/rooms';

const room = roomDefinitions.get('run2')!;

function buildings(drop?: number) {
  const scene = new Scene();
  const atmosphere = new SceneAtmosphere(
    scene,
    'neonStreet',
    room.id,
    0,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    drop,
  );
  try {
    const mesh = scene.getObjectByName('skyline-buildings');
    if (!(mesh instanceof InstancedMesh)) throw new Error('Brak panoramy');
    return mesh.instanceMatrix.array.slice();
  } finally {
    atmosphere.dispose();
  }
}

it('pominięcie pola odpowiada zeru, a obniżenie przesuwa tylko wysokość instancji', () => {
  const original = buildings();
  expect(buildings(0)).toEqual(original);
  const drop = room.panoramaDropM!;
  const shifted = buildings(drop);
  expect(shifted.length).toBe(original.length);
  for (let i = 0; i < shifted.length; i++) {
    const delta = i % 16 === 13 ? drop : 0;
    expect(shifted[i]).toBeCloseTo(original[i]! - delta, 4);
  }
});

it('dachy pierwszego pierścienia mieszczą się pod oczami, dalsze wieże wystają ponad balkon', () => {
  const theme = resolveTheme(room.theme).render;
  const h = horizonParameters(worldEnvelope(room.blocks, room.playerSpawn), {
    nearM: theme.fogNear,
    farM: theme.fogFar,
  });
  const { buildings } = buildSkyline(room.id, {
    floorY: room.playerSpawn.y - room.panoramaDropM!,
    ringsM: h.ringsM,
    ringOffsetM: h.ringOffsetM,
    density: theme.panoramaDensity,
    height: theme.panoramaHeight,
    traffic: 0,
  });
  const tops = (layer: number) =>
    buildings.filter((b) => b.layer === layer).map((b) => b.baseY + b.height);
  expect(Math.max(...tops(0))).toBeLessThan(1.7);
  expect(Math.max(...tops(3))).toBeGreaterThan(4.9);
});
