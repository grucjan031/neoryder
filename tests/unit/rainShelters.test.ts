import { afterEach, describe, expect, it } from 'vitest';
import { Group, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { isRainSheltered, Weather } from '../../src/vfx/weather';
import { rainShelterSchema } from '../../src/world/dressingSchema';
import { roomSchema } from '../../src/world/roomSchema';
import { themeSchema } from '../../src/render/themeSchema';
import { CityDressing } from '../../src/render/city/dressing';
import { tuning } from '../../src/core/tuning';
import tunnel from '../../src/data/rooms/combatFloodedTunnel.json';
import underpass from '../../src/data/rooms/alleyUnderpass.json';
import neon from '../../src/data/themes/neonStreet.json';

const active: { dispose(): void }[] = [];
const own = <T extends { dispose(): void }>(item: T): T => {
  active.push(item);
  return item;
};
afterEach(() => {
  for (const item of active.splice(0)) item.dispose();
});
const shelter = {
  position: { x: 0, y: 2, z: 0 },
  size: { x: 12, y: 4, z: 24 },
};

const rainMatrices = (weather: Weather): number[] => {
  const matrix = new Matrix4();
  const out: number[] = [];
  for (let i = 0; i < weather.rainCount; i++)
    out.push(...weather.dropMatrix(i, matrix).elements);
  return out;
};

describe('strefy bez deszczu', () => {
  it('waliduje skończony środek i dodatnie wymiary, pole jest opcjonalne', () => {
    expect(rainShelterSchema.parse(shelter)).toEqual(shelter);
    for (const value of [0, -1, Infinity, NaN])
      expect(
        rainShelterSchema.safeParse({
          ...shelter,
          size: { ...shelter.size, y: value },
        }).success,
      ).toBe(false);
    expect(
      rainShelterSchema.safeParse({
        ...shelter,
        position: { ...shelter.position, x: Infinity },
      }).success,
    ).toBe(false);
    const withoutShelters = { ...tunnel, rainShelters: undefined };
    expect(roomSchema.parse(withoutShelters).rainShelters).toBeUndefined();
    expect(roomSchema.parse(tunnel).rainShelters).toEqual([shelter]);
  });

  it('obejmuje wnętrze i granice 3D, zostawia deszcz poza strefą i nad dachem', () => {
    for (const point of [
      shelter.position,
      { x: -6, y: 0, z: -12 },
      { x: 6, y: 4, z: 12 },
    ])
      expect(isRainSheltered(point, [shelter])).toBe(true);
    for (const point of [
      { x: 6.01, y: 2, z: 0 },
      { x: 0, y: 2, z: 12.01 },
      { x: 0, y: 4.01, z: 0 },
      { x: 0, y: -0.01, z: 0 },
    ])
      expect(isRainSheltered(point, [shelter])).toBe(false);
    expect(isRainSheltered(shelter.position, [])).toBe(false);
    expect(
      isRainSheltered(shelter.position, [
        { ...shelter, position: { x: 100, y: 2, z: 0 } },
        shelter,
      ]),
    ).toBe(true);
  });

  it('chowa również smugę wystającą pod dach, gdy jej środek jest poza strefą', () => {
    const point = { x: 0, y: 4.1, z: 0 };
    expect(isRainSheltered(point, [shelter])).toBe(false);
    expect(
      isRainSheltered(point, [shelter], { x: 0.01, y: 0.23, z: 0.01 }),
    ).toBe(true);
    expect(
      isRainSheltered({ ...point, y: 4.3 }, [shelter], {
        x: 0.01,
        y: 0.23,
        z: 0.01,
      }),
    ).toBe(false);
  });

  it.each([tunnel, underpass])(
    'strefa $id kończy się na spodzie rzeczywistego stropu',
    (data) => {
      const room = roomSchema.parse(data);
      const zone = room.rainShelters![0]!;
      const roof = room.blocks.find(
        ({ position, size }) =>
          position.y - size.y / 2 > 0 &&
          size.x === zone.size.x &&
          size.z === zone.size.z,
      )!;
      expect(roof).toBeDefined();
      expect(zone.position.x).toBe(roof.position.x);
      expect(zone.position.z).toBe(roof.position.z);
      expect(zone.position.y - zone.size.y / 2).toBe(0);
      expect(zone.position.y + zone.size.y / 2).toBe(
        roof.position.y - roof.size.y / 2,
      );
      expect(
        isRainSheltered(
          { x: zone.position.x, y: 1, z: zone.position.z },
          room.rainShelters!,
        ),
      ).toBe(true);
      expect(
        isRainSheltered(
          { x: 0, y: 1, z: room.playerSpawn.z },
          room.rainShelters!,
        ),
      ).toBe(false);
    },
  );

  it('Weather zeruje skalę kropli pod dachem, pozostałe macierze zachowuje i nie zmienia seeda', () => {
    const cam = new PerspectiveCamera();
    cam.position.y = 2;
    const baseline = own(new Weather({ density: 1 }, 0, 'shelter'));
    const weather = own(new Weather({ density: 1 }, 0, 'shelter', [shelter]));
    baseline.update(0, 0, cam);
    weather.update(0, 0, cam);
    const matrix = new Matrix4();
    const actual = new Matrix4();
    const point = new Vector3();
    const scale = new Vector3();
    const halfStreak = {
      x:
        (Math.abs(weather.params.windX) * tuning.city.rainExposureS +
          tuning.city.rainStreakWidthM) /
        2,
      y:
        (weather.params.speed * tuning.city.rainExposureS +
          tuning.city.rainStreakWidthM) /
        2,
      z: tuning.city.rainStreakWidthM / 2,
    };
    let hidden = 0;
    let outside = 0;
    let above = 0;
    for (let i = 0; i < weather.rainCount; i++) {
      baseline.dropMatrix(i, matrix);
      weather.dropMatrix(i, actual);
      point.setFromMatrixPosition(matrix);
      if (isRainSheltered(point, [shelter], halfStreak)) {
        expect(scale.setFromMatrixScale(actual).length()).toBe(0);
        hidden++;
      } else {
        expect(actual.elements).toEqual(matrix.elements);
        outside++;
        if (point.y > 4 && Math.abs(point.x) < 6 && Math.abs(point.z) < 12)
          above++;
      }
    }
    expect(hidden).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
    expect(above).toBeGreaterThan(0);
    const frozen = rainMatrices(weather);
    weather.update(0, 10, cam);
    expect(rainMatrices(weather)).toEqual(frozen);
  });

  it('nie emituje rozbryzgów na osłoniętej podłodze, na otwartej nadal pada', () => {
    const cam = new PerspectiveCamera();
    cam.position.y = 2;
    const roof = {
      position: { x: 0, y: 2, z: 0 },
      size: { x: 1000, y: 4, z: 1000 },
    };
    const sheltered = own(new Weather({ density: 1 }, 0, 'floor', [roof]));
    const exposed = own(new Weather({ density: 1 }, 0, 'floor'));
    let exposedSplashes = 0;
    for (let i = 0; i < 30; i++) {
      sheltered.update(1 / 60, 1 / 60, cam);
      exposed.update(1 / 60, 1 / 60, cam);
      expect(sheltered.splashCount).toBe(0);
      exposedSplashes += exposed.splashCount;
    }
    expect(exposedSplashes).toBeGreaterThan(0);
    expect(sheltered.capacity).toBe(tuning.city.rainMax);
  });

  it('CityDressing przekazuje strefy do pogody', () => {
    const root = new Group();
    const dressing = own(
      new CityDressing(
        root,
        {
          rainShelters: [
            {
              position: { x: 0, y: 0, z: 0 },
              size: { x: 1000, y: 1000, z: 1000 },
            },
          ],
        },
        themeSchema.parse(neon),
        0,
        'dressing',
      ),
    );
    dressing.render(0, new PerspectiveCamera());
    const matrix = new Matrix4();
    const scale = new Vector3();
    expect(dressing.weather!.rainCount).toBeGreaterThan(0);
    for (let i = 0; i < dressing.weather!.rainCount; i++) {
      dressing.weather!.dropMatrix(i, matrix);
      expect(scale.setFromMatrixScale(matrix).length()).toBe(0);
    }
  });
});
