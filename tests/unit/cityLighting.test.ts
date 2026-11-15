import { afterEach, describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh, ShaderMaterial } from 'three';
import { tuning } from '../../src/core/tuning';
import {
  LAMP_MODEL,
  LampCones,
  lampFixtures,
  lampLightDefs,
} from '../../src/render/city/lamps';
import {
  CityLights,
  lightScore,
  selectCityLights,
} from '../../src/render/city/lights';
import { signGlowColor } from '../../src/render/city/signs';
import type { CityLightDef } from '../../src/world/dressingSchema';

const originalCity = { ...tuning.city };
afterEach(() => Object.assign(tuning.city, originalCity));

function def(
  z: number,
  intensity = 4,
  range = 10,
  color = '#ffae1a',
): CityLightDef {
  return { position: { x: 0, y: 3, z }, color, intensity, range };
}
function camera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(70, 1, 0.1, 100);
  cam.updateMatrixWorld();
  return cam;
}

describe('ważność świateł miasta', () => {
  it('bez priorytetu liczy tylko odległość', () => {
    expect(lightScore(9, def(0, 99, 99), undefined, false)).toBe(9);
    expect(
      lightScore(9, def(0, 99, 99), { importance: 0, keepBonus: 1 }, true),
    ).toBe(9);
  });

  it('jasne źródło o większym zasięgu wygrywa z bliższym słabym', () => {
    const defs = [def(-4, 1, 4), def(-8, 6, 14)];
    expect(selectCityLights(defs, camera(), 1)).toEqual([0]);
    expect(
      selectCityLights(defs, camera(), 1, [], {
        importance: 1,
        keepBonus: 0,
      }),
    ).toEqual([1]);
  });

  it('histereza utrzymuje przydzielone światło przy remisie odległości', () => {
    const defs = [def(-6), def(-6.2)];
    const priority = { importance: 0.6, keepBonus: 0.5 };
    expect(selectCityLights(defs, camera(), 1, [], priority)).toEqual([0]);
    expect(
      selectCityLights(defs, camera(), 1, [], {
        ...priority,
        keep: new Set([1]),
      }),
    ).toEqual([1]);
  });

  it('CityLights nigdy nie przekracza limitu świateł z puli', () => {
    tuning.city.maxLights = 3;
    const lights = new CityLights(
      Array.from({ length: 12 }, (_, i) => def(-3 - i)),
    );
    lights.update(1, 1, camera());
    const lit = lights.pool.filter((light) => light.intensity > 0.01);
    expect(lights.pool).toHaveLength(3);
    expect(lit.length).toBeLessThanOrEqual(3);
    for (const light of lights.pool)
      expect(light.decay).toBe(tuning.city.lightDecay);
    lights.dispose();
  });
});

describe('poświata napisów', () => {
  const position = { x: 0, y: 3, z: 0 };
  it('własny tint ma pierwszeństwo', () => {
    expect(signGlowColor({ tint: '#6dff4a', position }, [def(0)], 3)).toBe(
      '#6dff4a',
    );
  });
  it('bez tintu bierze kolor najbliższego światła w zasięgu', () => {
    const lights = [
      def(5, 4, 10, '#8a5cff'),
      def(1, 4, 10, '#3d7bff'),
      def(2, 4, 10, '#6dff4a'),
    ];
    expect(signGlowColor({ position }, lights, 3)).toBe('#3d7bff');
  });
  it('bez światła w zasięgu wraca do ciepłej bieli', () => {
    expect(signGlowColor({ position }, [def(20)], 3)).toBe('#fff1d6');
  });
});

describe('latarnie', () => {
  const decor = [
    { model: LAMP_MODEL, position: { x: 2, y: 0, z: 3 } },
    { model: 'city_crates', position: { x: 0, y: 0, z: 0 } },
    {
      model: LAMP_MODEL,
      position: { x: -1, y: 0.5, z: 4 },
      yaw: Math.PI / 2,
      scale: 2,
    },
  ];

  it('wybiera tylko latarnie i liczy punkt lampy z obrotem i skalą', () => {
    const fixtures = lampFixtures(decor);
    expect(fixtures).toHaveLength(2);
    const t = tuning.city;
    expect(fixtures[0]!.head.x).toBeCloseTo(2);
    expect(fixtures[0]!.head.y).toBeCloseTo(t.lampHeadHeightM);
    expect(fixtures[0]!.head.z).toBeCloseTo(3 + t.lampHeadForwardM);
    expect(fixtures[1]!.head.x).toBeCloseTo(-1 + 2 * t.lampHeadForwardM);
    expect(fixtures[1]!.head.y).toBeCloseTo(0.5 + 2 * t.lampHeadHeightM);
    expect(fixtures[1]!.baseY).toBe(0.5);
    expect(lampFixtures(undefined)).toEqual([]);
  });

  it('światła latarni pochodzą z tuningu i leżą tuż pod głowicą', () => {
    const fixtures = lampFixtures(decor);
    const defs = lampLightDefs(fixtures);
    expect(defs).toHaveLength(2);
    expect(defs[0]!.color).toBe(tuning.city.lampColor);
    expect(defs[0]!.position.y).toBeLessThan(fixtures[0]!.head.y);
    expect(defs[0]!.range).toBe(tuning.city.lampLightRange);
  });

  it('stożki: jeden InstancedMesh, macierze zależą od kąta, dispose idempotentne', () => {
    const cones = new LampCones(lampFixtures(decor));
    cones.update(0, 0, camera());
    const mesh = cones.root.children[0] as InstancedMesh<
      BufferGeometry,
      ShaderMaterial
    >;
    expect(cones.root.children).toHaveLength(1);
    expect(mesh.material.uniforms.slope!.value).toBeCloseTo(
      Math.tan((tuning.city.lampConeAngleDeg * Math.PI) / 180),
    );
    expect(mesh.material.userData.bloom).toBe(false);
    const matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    expect(position.y).toBeCloseTo(tuning.city.lampHeadHeightM);
    expect(matrix.getMaxScaleOnAxis()).toBeGreaterThan(
      tuning.city.lampHeadHeightM - 0.01,
    );
    cones.dispose();
    cones.dispose();
    expect(new LampCones([]).root.children).toHaveLength(0);
  });
});
