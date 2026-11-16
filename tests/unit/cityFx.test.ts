import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene as ThreeScene,
  ShaderMaterial,
  Texture,
  Vector3,
} from 'three';
import type { BufferGeometry, Material } from 'three';
import { tuning } from '../../src/core/tuning';
import { EventBus } from '../../src/core/events';
import { GameLoop } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { CityLights, selectCityLights } from '../../src/render/city/lights';
import { SignRenderer } from '../../src/render/city/signs';
import { DecalRenderer } from '../../src/render/city/decals';
import { CityTextures } from '../../src/render/city/resources';
import type { TextureLoad } from '../../src/render/city/resources';
import { AmbientFx } from '../../src/vfx/ambientFx';
import { Weather, wrapRainAxis } from '../../src/vfx/weather';
import { CityFxTest } from '../../src/scenes/cityFxTest';
import { CommandRegistry } from '../../src/ui/debugCommands';
import type { CityLightDef, SignDef } from '../../src/world/dressingSchema';

const originalCity = { ...tuning.city };
const disposables: { dispose(): void }[] = [];
afterEach(() => {
  for (const item of disposables.splice(0)) item.dispose();
  Object.assign(tuning.city, originalCity);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function own<T extends { dispose(): void }>(item: T): T {
  disposables.push(item);
  return item;
}
function camera(): PerspectiveCamera {
  const result = new PerspectiveCamera(60, 1, 0.1, 100);
  result.position.set(0, 2, 0);
  result.updateMatrixWorld();
  return result;
}
function light(x: number, z: number): CityLightDef {
  return {
    position: { x, y: 2, z },
    color: '#ffae1a',
    intensity: 10,
    range: 1,
  };
}
const sign: SignDef = {
  kind: 'neon',
  texture: 'missing_city_unit',
  position: { x: 0, y: 2, z: -4 },
  size: { w: 3, h: 1 },
  yaw: 0,
  tint: '#6dff4a',
  flicker: 0.8,
};
const failLoad: TextureLoad = (_url, _ok, fail) => fail();

describe('światła miasta', () => {
  it('wybiera najbliższe widoczne z zachowaniem limitu, pomija światła za kamerą', () => {
    const defs = [
      light(0, -12),
      light(0, -3),
      light(0, 4),
      light(40, -4),
      light(0, -6),
    ];
    expect(selectCityLights(defs, camera(), 2)).toEqual([1, 4]);
    expect(selectCityLights(defs, camera(), 0)).toEqual([]);
    expect(selectCityLights(defs, camera(), 99)).toEqual([1, 4, 0]);
  });

  it('zachowuje tę samą pulę i plamy dla wszystkich definicji; wygasza przed przestawieniem', () => {
    tuning.city.maxLights = 1;
    const system = own(new CityLights([light(0, -3), light(0, 3)], -2));
    const cam = camera();
    const pool = [...system.pool];
    system.update(1, 1, cam);
    expect(system.pool).toHaveLength(1);
    expect(system.pool[0]!.position.z).toBe(-3);
    const initial = system.pool[0]!.intensity;
    cam.rotation.y = Math.PI;
    system.update(0, 0.02, cam);
    expect(system.pool[0]!.position.z).toBe(-3);
    expect(system.pool[0]!.intensity).toBeLessThan(initial);
    for (let i = 0; i < 200; i++) system.update(0, 0.05, cam);
    expect(system.pool).toEqual(pool);
    expect(system.pool[0]!.position.z).toBe(3);
    expect(
      system.root.children.filter((child) => child instanceof Mesh),
    ).toHaveLength(2);
    for (const child of system.root.children)
      if (child instanceof Mesh) {
        expect(child.position.y).toBeCloseTo(-2 + tuning.city.surfaceOffsetM);
        expect(child.material.userData.bloom).toBe(false);
      }
  });

  it('nie tworzy nowych świateł po zmianie limitu w GUI', () => {
    tuning.city.maxLights = 2;
    const system = own(
      new CityLights([light(0, -3), light(0, -4), light(0, -5)]),
    );
    tuning.city.maxLights = 30;
    system.update(1, 1, camera());
    expect(system.pool).toHaveLength(2);
  });
});

describe('deszcz', () => {
  it('zawija wielokrotne przekroczenia granic w obu kierunkach', () => {
    expect(wrapRainAxis(101, 0, 10)).toBe(1);
    expect(wrapRainAxis(-101, 0, 10)).toBe(-1);
    expect(wrapRainAxis(15, 10, 10)).toBe(5);
  });

  it('utrzymuje pozycje w objętości po teleportacji kamery i dużym dt', () => {
    tuning.city.rainMax = 40;
    const weather = own(new Weather({ density: 1, speed: 100, windX: -200 }));
    const cam = camera();
    cam.position.set(100, 40, -80);
    weather.update(50, 50, cam);
    const matrix = new Matrix4();
    const position = new Vector3();
    for (let i = 0; i < weather.rain.count; i++) {
      weather.rain.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      expect(Math.abs(position.x - cam.position.x)).toBeLessThanOrEqual(
        tuning.city.rainWidthM / 2,
      );
      expect(Math.abs(position.y - cam.position.y)).toBeLessThanOrEqual(
        tuning.city.rainHeightM / 2,
      );
      expect(Math.abs(position.z - cam.position.z)).toBeLessThanOrEqual(
        tuning.city.rainDepthM / 2,
      );
    }
  });

  it('respektuje gęstość, enabled, limit rozbryzgów i zatrzymanie czasu świata', () => {
    tuning.city.rainMax = 60;
    tuning.city.rainSplashMax = 10;
    const weather = own(new Weather({ density: 1 }, 0, 'rain-limits'));
    const cam = camera();
    for (let i = 0; i < 200; i++) {
      weather.update(1 / 30, 1 / 30, cam);
      expect(weather.splashCount).toBeLessThanOrEqual(10);
    }
    expect(weather.splashCount).toBeGreaterThan(0);
    const matrices = Array.from(weather.rain.instanceMatrix.array);
    weather.update(0, 10, cam);
    expect(Array.from(weather.rain.instanceMatrix.array)).toEqual(matrices);
    weather.params.density = 0.5;
    weather.update(0, 0, cam);
    expect(weather.rain.count).toBe(30);
    weather.params.density = 5;
    weather.update(0, 0, cam);
    expect(weather.rain.count).toBe(60);
    weather.params.enabled = false;
    weather.update(0, 0, cam);
    expect(weather.rain.count).toBe(0);
  });

  it('jest powtarzalny z seedem, także z rozbryzgami', () => {
    tuning.city.rainMax = 20;
    const a = own(new Weather({}, 0, 'same')),
      b = own(new Weather({}, 0, 'same'));
    const cam = camera();
    for (let i = 0; i < 50; i++) {
      a.update(0.1, 0.1, cam);
      b.update(0.1, 0.1, cam);
    }
    expect(a.rain.instanceMatrix.array).toEqual(b.rain.instanceMatrix.array);
    expect(a.splashes.pool.particles).toEqual(b.splashes.pool.particles);
  });

  it('przelicza i wysyła tylko rysowane krople, z macierzą jak z Object3D', () => {
    tuning.city.rainMax = 40;
    const params = { density: 0.5, speed: 18, windX: 1 };
    const weather = own(new Weather(params, -100, 'range'));
    const cam = camera();
    cam.position.set(3, 2, -4);
    cam.updateMatrixWorld(true);
    weather.update(0, 0, cam);
    const attribute = weather.rain.instanceMatrix;
    const idle = Array.from(attribute.array.subarray(20 * 16));
    for (let i = 0; i < 3; i++) weather.update(1 / 60, 1 / 60, cam);
    expect(weather.rain.count).toBe(20);
    expect(attribute.updateRanges).toEqual([{ start: 0, count: 20 * 16 }]);
    expect(Array.from(attribute.array.subarray(20 * 16))).toEqual(idle);
    const dummy = new Object3D();
    const direction = new Vector3(-params.windX, params.speed, 0).normalize();
    const length =
      Math.hypot(params.windX, params.speed) * tuning.city.rainExposureS;
    const matrix = new Matrix4();
    for (let i = 0; i < weather.rain.count; i++) {
      weather.rain.getMatrixAt(i, matrix);
      dummy.position.setFromMatrixPosition(matrix);
      dummy.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
      dummy.rotateY(
        Math.atan2(
          cam.position.x - dummy.position.x,
          cam.position.z - dummy.position.z,
        ),
      );
      dummy.scale.set(tuning.city.rainStreakWidthM, length, 1);
      dummy.updateMatrix();
      for (let k = 0; k < 16; k++)
        expect(matrix.elements[k]).toBeCloseTo(dummy.matrix.elements[k]!, 5);
    }
  });
});

describe('pule atmosfery', () => {
  it('nie przekracza limitów przy bardzo wysokiej emisji i tworzy rozbryzgi kapania', () => {
    tuning.city.steamMax = 5;
    tuning.city.sparkMax = 7;
    tuning.city.dripMax = 6;
    tuning.city.dripSplashMax = 4;
    const fx = own(
      new AmbientFx(
        ['steam', 'sparks', 'drip'].map((kind) => ({
          kind: kind as 'steam' | 'sparks' | 'drip',
          position: { x: 0, y: 1, z: -3 },
          rate: 1000,
        })),
      ),
    );
    const cam = camera();
    let sawSplash = false;
    for (let i = 0; i < 100; i++) {
      fx.update(0.1, 0.1, cam);
      for (const batch of [fx.steam, fx.sparks, fx.drips, fx.splashes]) {
        expect(batch.pool.count).toBeLessThanOrEqual(batch.pool.capacity);
        expect(batch.mesh.count).toBeLessThanOrEqual(batch.pool.capacity);
      }
      sawSplash ||= fx.splashes.pool.count > 0;
    }
    // Przy nasyceniu pula zastępuje krople przed dotarciem do podłogi.
    const drip = own(
      new AmbientFx([
        { kind: 'drip', position: { x: 0, y: 0.3, z: -3 }, rate: 3 },
      ]),
    );
    for (let i = 0; i < 100; i++) {
      drip.update(0.05, 0.05, cam);
      sawSplash ||= drip.splashes.pool.count > 0;
    }
    expect(sawSplash).toBe(true);
    const before = structuredClone(fx.steam.pool.particles);
    fx.update(0, 5, cam);
    expect(fx.steam.pool.particles).toEqual(before);
    expect(fx.sparks.mesh.material).toMatchObject({
      userData: { bloom: true },
      toneMapped: false,
    });
  });

  it('rate=0 wyłącza emiter', () => {
    const fx = own(
      new AmbientFx([
        { kind: 'steam', position: { x: 0, y: 0, z: 0 }, rate: 0 },
      ]),
    );
    fx.update(10, 10, camera());
    expect(fx.steam.pool.count).toBe(0);
  });
});

describe('tekstury i własność zasobów', () => {
  it('flicker=0 daje stałą jasność, seed odtwarza migotanie i maskę UV', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const steady = own(
      new SignRenderer([{ ...sign, flicker: 0 }], 10, failLoad),
    );
    const a = own(new SignRenderer([sign], 11, failLoad));
    const b = own(new SignRenderer([sign], 11, failLoad));
    const shader = (root: Group): ShaderMaterial =>
      (root.children[0]!.children[0] as Mesh<BufferGeometry, ShaderMaterial>)
        .material;
    const cam = camera();
    for (let i = 0; i < 100; i++) {
      steady.update(0, 0.1, cam);
      a.update(0, 0.1, cam);
      b.update(0, 0.1, cam);
      expect(shader(steady.root).uniforms.brightness!.value).toBe(
        tuning.city.signBrightness,
      );
      for (const key of [
        'time',
        'brightness',
        'partial',
        'noiseSeed',
        'glitch',
      ])
        expect(shader(a.root).uniforms[key]!.value).toEqual(
          shader(b.root).uniforms[key]!.value,
        );
    }
  });

  it('brak pliku zostawia canvas z id, ostrzega raz na id, a tint mnoży białe litery', () => {
    const fillText = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ clearRect: vi.fn(), strokeRect: vi.fn(), fillText }),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = own(
      new SignRenderer(
        [
          { ...sign, texture: 'fallback_unique_test' },
          { ...sign, texture: 'fallback_unique_test', kind: 'holo' },
        ],
        42,
        failLoad,
      ),
    );
    expect(
      fillText.mock.calls.some((call) => call[0] === 'fallback_unique_test'),
    ).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    const shaders: ShaderMaterial[] = [];
    renderer.root.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.material instanceof ShaderMaterial &&
        object.material.uniforms.map
      )
        shaders.push(object.material);
    });
    expect(shaders).toHaveLength(2);
    for (const material of shaders) {
      expect(material.uniforms.map!.value).toBeInstanceOf(CanvasTexture);
      expect(material.uniforms.tint!.value).toEqual(new Color('#6dff4a'));
      expect(material).toMatchObject({
        toneMapped: false,
        depthWrite: false,
        blending: AdditiveBlending,
        userData: { bloom: true },
      });
    }
    renderer.update(0, 0.1, camera());
    expect(shaders[0]!.uniforms.time!.value).toBeGreaterThan(0);
  });

  it('utylizuje teksturę załadowaną po dispose i nie dotyka odbiorcy', () => {
    let complete: ((texture: Texture) => void) | undefined;
    const textures = own(
      new CityTextures((_url, ok) => {
        complete = ok;
      }),
    );
    const accept = vi.fn();
    textures.request('signs', 'late', accept);
    const fallback = accept.mock.calls[0]![0] as Texture;
    const disposeFallback = vi.spyOn(fallback, 'dispose');
    textures.dispose();
    textures.dispose();
    expect(disposeFallback).toHaveBeenCalledTimes(1);
    const late = new Texture();
    const disposeLate = vi.spyOn(late, 'dispose');
    complete!(late);
    expect(disposeLate).toHaveBeenCalledTimes(1);
    expect(accept).toHaveBeenCalledTimes(1);
  });

  it('naklejki mają alfę, offset właściwej powierzchni, brak bloom i depthWrite', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = own(
      new DecalRenderer(
        ['floor', 'wall'].map((surface) => ({
          texture: 'unit_decal',
          position: { x: 0, y: 0, z: 0 },
          size: { w: 1, h: 2 },
          yaw: Math.PI / 2,
          surface: surface as 'floor' | 'wall',
          opacity: 0.4,
        })),
        failLoad,
      ),
    );
    const floor = renderer.root.children[0] as Mesh;
    const wall = renderer.root.children[1] as Mesh;
    expect(floor.position.y).toBe(tuning.city.surfaceOffsetM);
    expect(wall.position.x).toBeCloseTo(tuning.city.surfaceOffsetM);
    expect(floor.material).toMatchObject({
      opacity: 0.4,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      userData: { bloom: false },
    });
    expect(new Vector3(0, 0, 1).applyEuler(floor.rotation).y).toBeCloseTo(1);
  });

  it.each(['signs', 'decals', 'lights', 'weather', 'ambient'])(
    '%s zwalnia każdą geometrię, materiał, teksturę i instancję raz',
    (kind) => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const successful: TextureLoad = (_url, ok) => ok(new Texture());
      const system = own(
        kind === 'signs'
          ? new SignRenderer([sign, { ...sign, kind: 'holo' }], 1, successful)
          : kind === 'decals'
            ? new DecalRenderer(
                [
                  {
                    texture: 'decal',
                    position: sign.position,
                    size: sign.size,
                    yaw: 0,
                    surface: 'floor',
                  },
                ],
                successful,
              )
            : kind === 'lights'
              ? new CityLights([light(0, -2)])
              : kind === 'weather'
                ? new Weather()
                : new AmbientFx([{ kind: 'steam', position: sign.position }]),
      );
      const root: Group = system.root;
      const resources = new Set<
        BufferGeometry | Material | Texture | InstancedMesh
      >();
      root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        resources.add(object.geometry);
        if (object instanceof InstancedMesh) resources.add(object);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          resources.add(material);
          if ('map' in material && material.map instanceof Texture)
            resources.add(material.map);
          if (
            material instanceof ShaderMaterial &&
            material.uniforms.map?.value instanceof Texture
          )
            resources.add(material.uniforms.map.value);
        }
      });
      const spies = [...resources].map((resource) =>
        vi.spyOn(resource, 'dispose'),
      );
      system.dispose();
      system.dispose();
      expect(root.children).toHaveLength(0);
      for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    },
  );
});

it('scena rejestruje rain, pokazuje efekty i przywraca lokalną atmosferę po dispose', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const scene = own(new CityFxTest());
  const three = new ThreeScene();
  const background = new Color('#333333');
  three.background = background;
  const before = {
    skyGradient: tuning.render.skyGradient,
    fogStrength: tuning.render.fogStrength,
  };
  const commands = new CommandRegistry();
  scene.init(
    {
      bus: new EventBus(),
      rng: new Rng('scene'),
      loop: new GameLoop({ step: () => {}, render: () => {} }),
      tuning,
      debug: true,
      commands,
      camera: camera(),
    },
    three,
  );
  expect(tuning.render.skyGradient).toBe(0);
  expect(three.fog).not.toBeNull();
  expect(commands.execute('rain 2')).toBe('Użycie: rain <0..1>');
  expect(commands.execute('rain 0')).toBe('Deszcz: 0');
  scene.render(1, 0.1);
  expect(scene.query('city')).toMatchObject({ rain: 0, lights: 8 });
  expect(commands.execute('rain 1')).toBe('Deszcz: 1');
  scene.step(1, {
    held: new Set(),
    pressed: new Set(),
    released: new Set(),
    lookDelta: { x: 0, y: 0 },
  });
  scene.render(1, 1);
  expect(scene.query('city')).toMatchObject({ rain: tuning.city.rainMax });
  scene.dispose();
  expect(three.children).toHaveLength(0);
  expect(three.background).toBe(background);
  expect(three.fog).toBeNull();
  expect(tuning.render).toMatchObject(before);
  expect(commands.help()).toBe('');
});
