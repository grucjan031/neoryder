import { afterEach, describe, expect, it } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import type {
  BufferAttribute,
  WebGLProgramParametersWithUniforms,
} from 'three';
import { tuning } from '../../src/core/tuning';
import {
  RAIN_VERTEX_DECLARATIONS,
  RAIN_VERTEX_POSITION,
  Weather,
  wrapRainAxis,
} from '../../src/vfx/weather';
import { weatherDefinitions } from '../../src/render/weatherSchema';

const saved = { ...tuning.city };
const owned: Weather[] = [];
afterEach(() => {
  Object.assign(tuning.city, saved);
  for (const weather of owned.splice(0)) weather.dispose();
});
const make = (...args: ConstructorParameters<typeof Weather>): Weather => {
  const weather = new Weather(...args);
  owned.push(weather);
  return weather;
};
const camera = (): PerspectiveCamera => {
  const cam = new PerspectiveCamera();
  cam.updateMatrixWorld(true);
  return cam;
};

describe('deszcz w shaderze wierzchołków', () => {
  it('geometria ma stałe atrybuty instancji, a liczba instancji to liczba rysowanych kropli', () => {
    tuning.city.rainMax = 50;
    const weather = make({ density: 0.4 });
    const { geometry } = weather.rain;
    const start = geometry.getAttribute('rainStart') as BufferAttribute;
    const seed = geometry.getAttribute('rainSeed') as BufferAttribute;
    expect(geometry.isInstancedBufferGeometry).toBe(true);
    expect([start.count, start.itemSize]).toEqual([50, 3]);
    expect([seed.count, seed.itemSize]).toEqual([50, 3]);
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.instanceCount).toBe(0);
    expect(weather.rain.visible).toBe(false);
    weather.update(1 / 60, 1 / 60, camera());
    expect(geometry.instanceCount).toBe(20);
    expect(weather.rainCount).toBe(20);
    expect(weather.rain.visible).toBe(true);
    // Brak instanceMatrix: ruch nie wymaga bufora zapisywanego co klatkę.
    expect(geometry.getAttribute('instanceMatrix')).toBeUndefined();
    weather.params.enabled = false;
    weather.update(1 / 60, 1 / 60, camera());
    expect(weather.rain.visible).toBe(false);
    // Położenia początkowe mieszczą się w objętości, nasiona mają parzystość indeksu.
    for (let i = 0; i < 50; i++) {
      expect(Math.abs(start.getX(i))).toBeLessThanOrEqual(
        tuning.city.rainWidthM / 2,
      );
      expect(Math.abs(start.getY(i))).toBeLessThanOrEqual(
        tuning.city.rainHeightM / 2,
      );
      expect(Math.abs(start.getZ(i))).toBeLessThanOrEqual(
        tuning.city.rainDepthM / 2,
      );
      expect(seed.getZ(i)).toBe(i % 2);
      expect(seed.getY(i)).toBeCloseTo(Math.sin(i), 6);
    }
  });

  it('po pierwszej klatce atrybuty się nie zmieniają, zmieniają się tylko uniformy', () => {
    tuning.city.rainMax = 30;
    const weather = make({ density: 1, windX: 2 });
    const cam = camera();
    weather.update(0.016, 0.016, cam);
    const start = weather.rain.geometry.getAttribute(
      'rainStart',
    ) as BufferAttribute;
    const snapshot = Array.from(start.array);
    const version = start.version;
    const shift = weather.rainUniforms.rainShift.value.clone();
    for (let i = 0; i < 20; i++) weather.update(0.016, 0.016, cam);
    expect(start.version).toBe(version);
    expect(Array.from(start.array)).toEqual(snapshot);
    expect(weather.rainUniforms.rainShift.value.equals(shift)).toBe(false);
    // Pauza (dt = 0) zatrzymuje ruch.
    const frozen = weather.rainUniforms.rainShift.value.clone();
    weather.update(0, 5, cam);
    expect(weather.rainUniforms.rainShift.value.equals(frozen)).toBe(true);
  });

  it('pozycja kropli to początek + przebyta droga, zawinięta wokół kamery', () => {
    tuning.city.rainMax = 20;
    const params = { density: 1, speed: 12, windX: 3 };
    const weather = make(params, 0, 'closed-form');
    const cam = camera();
    cam.position.set(10, 5, -7);
    cam.updateMatrixWorld(true);
    weather.update(0, 0, cam);
    const start = weather.rain.geometry.getAttribute(
      'rainStart',
    ) as BufferAttribute;
    const anchor = cam.position.clone();
    const dt = 0.05;
    const steps = 40;
    for (let i = 0; i < steps; i++) weather.update(dt, dt, cam);
    const out = new Vector3();
    for (let i = 0; i < 20; i++) {
      weather.dropCenter(i, out);
      const t = dt * steps;
      const expected = new Vector3(
        wrapRainAxis(
          anchor.x + start.getX(i) + params.windX * t,
          cam.position.x,
          tuning.city.rainWidthM,
        ),
        wrapRainAxis(
          anchor.y + start.getY(i) - params.speed * t,
          cam.position.y,
          tuning.city.rainHeightM,
        ),
        wrapRainAxis(
          anchor.z + start.getZ(i),
          cam.position.z,
          tuning.city.rainDepthM,
        ),
      );
      expect(out.distanceTo(expected)).toBeLessThan(1e-3);
    }
    // Teleportacja kamery: krople dalej w objętości wokół nowej pozycji.
    cam.position.set(500, -300, 200);
    cam.updateMatrixWorld(true);
    weather.update(dt, dt, cam);
    for (let i = 0; i < 20; i++) {
      weather.dropCenter(i, out);
      expect(Math.abs(out.x - 500)).toBeLessThanOrEqual(
        tuning.city.rainWidthM / 2,
      );
      expect(Math.abs(out.y + 300)).toBeLessThanOrEqual(
        tuning.city.rainHeightM / 2,
      );
      expect(Math.abs(out.z - 200)).toBeLessThanOrEqual(
        tuning.city.rainDepthM / 2,
      );
    }
  });

  it('płatki: rozrzut i kołysanie z indeksu kropli, tint naprzemienny', () => {
    tuning.city.rainMax = 12;
    const weather = make({}, 0, 'flakes');
    const profile = weatherDefinitions.get('snow')!;
    weather.setProfile(profile);
    const cam = camera();
    for (let i = 0; i < 90; i++) weather.update(1 / 60, 1 / 60, cam);
    const u = weather.rainUniforms;
    expect(u.rainTintMode.value).toBe(1);
    expect(u.rainSway.value.x).toBe(profile.precipitation.flakes!.swayM);
    expect(u.rainNearSq.value).toBeCloseTo(tuning.weather.flakeNearM ** 2, 6);
    expect(u.rainTintA.value.getHexString()).not.toBe(
      u.rainTintB.value.getHexString(),
    );
    // Rozrzut płatka zależy od sin(i): różne indeksy rozchodzą się z czasem.
    const start = weather.rain.geometry.getAttribute(
      'rainStart',
    ) as BufferAttribute;
    const a = weather.dropCenter(1, new Vector3());
    const b = weather.dropCenter(2, new Vector3());
    const relA = a.clone().sub(u.rainCenter.value);
    const relB = b.clone().sub(u.rainCenter.value);
    expect(relA.x - start.getX(1)).not.toBeCloseTo(relB.x - start.getX(2), 3);
    // Powrót do deszczu zeruje tint i rozrzut.
    weather.setProfile(weatherDefinitions.get('rain')!);
    weather.update(1 / 60, 1 / 60, cam);
    expect(u.rainTintMode.value).toBe(0);
    expect(u.rainSway.value.x).toBe(0);
    expect(u.rainScatter.value.length()).toBe(0);
  });

  it('strefy bez deszczu trafiają do tekstury: środek i połowa wymiarów', () => {
    const weather = make({}, 0, 'shelters', [
      { position: { x: 1, y: 2, z: 3 }, size: { x: 4, y: 6, z: 8 } },
      { position: { x: -5, y: 0, z: 9 }, size: { x: 2, y: 2, z: 2 } },
    ]);
    const texture = weather.rainUniforms.rainShelters.value!;
    expect([texture.image.width, texture.image.height]).toEqual([2, 2]);
    expect(Array.from(texture.image.data as Float32Array)).toEqual([
      1, 2, 3, 0, 2, 3, 4, 0, -5, 0, 9, 0, 1, 1, 1, 0,
    ]);
    expect(weather.rainUniforms.rainShelterCount.value).toBe(2);
  });

  it('shader: podmienia begin_vertex, deklaruje atrybuty i uniformy, tint trafia do fragmentu', () => {
    const weather = make();
    const shader = {
      uniforms: {},
      vertexShader:
        '#include <common>\n#include <uv_vertex>\n#include <begin_vertex>\n#include <project_vertex>',
      fragmentShader:
        '#include <common>\n#include <color_fragment>\n#include <alphamap_fragment>',
    } as unknown as WebGLProgramParametersWithUniforms;
    weather.rain.material.onBeforeCompile(shader, null as never);
    expect(shader.vertexShader).toContain(RAIN_VERTEX_DECLARATIONS);
    expect(shader.vertexShader).toContain(RAIN_VERTEX_POSITION);
    expect(shader.vertexShader).not.toContain('#include <begin_vertex>');
    expect(shader.vertexShader).toContain('#include <project_vertex>');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= vRainTint;');
    for (const name of Object.keys(weather.rainUniforms)) {
      expect(shader.uniforms).toHaveProperty(name);
      expect(RAIN_VERTEX_DECLARATIONS).toMatch(
        new RegExp('uniform \\w+ ' + name + ';'),
      );
    }
    for (const name of ['rainStart', 'rainSeed'])
      expect(RAIN_VERTEX_DECLARATIONS).toContain(
        'attribute vec3 ' + name + ';',
      );
  });

  it('referencyjna macierz kropli ma skalę zero dla kropel w strefie bez deszczu', () => {
    tuning.city.rainMax = 40;
    const weather = make({ density: 1 }, 0, 'hidden', [
      { position: { x: 0, y: 0, z: 0 }, size: { x: 1000, y: 1000, z: 1000 } },
    ]);
    weather.update(0, 0, camera());
    const matrix = new Matrix4();
    for (let i = 0; i < weather.rainCount; i++)
      expect(weather.dropMatrix(i, matrix).determinant()).toBe(0);
  });
});
