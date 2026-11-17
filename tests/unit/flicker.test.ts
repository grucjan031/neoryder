import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  ShaderMaterial,
} from 'three';
import type { BufferGeometry } from 'three';
import * as save from '../../src/core/save';
import { Rng } from '../../src/core/rng';
import { tuning } from '../../src/core/tuning';
import { flickerIntensity, sourceFlicker } from '../../src/render/city/flicker';
import { CityLights } from '../../src/render/city/lights';
import { SignRenderer } from '../../src/render/city/signs';
import { HubDecor } from '../../src/scenes/hubDecor';
import {
  cityLightSchema,
  flickerSchema,
  signSchema,
} from '../../src/world/dressingSchema';
import type {
  CityLightDef,
  FlickerDef,
  SignDef,
} from '../../src/world/dressingSchema';
import {
  hubStationSchema,
  hubStationSignSchema,
} from '../../src/world/hubSchema';

const patterns = ['buzz', 'fail', 'pulse'] as const;
const originalCity = { ...tuning.city };
const owned: { dispose(): void }[] = [];
function own<T extends { dispose(): void }>(item: T): T {
  owned.push(item);
  return item;
}
afterEach(() => {
  for (const item of owned.splice(0)) item.dispose();
  Object.assign(tuning.city, originalCity);
  vi.restoreAllMocks();
});

const light: CityLightDef = {
  position: { x: 0, y: 2, z: -4 },
  color: '#ffae1a',
  intensity: 10,
  range: 2,
};
const sign: SignDef = {
  kind: 'neon',
  texture: 'ramen',
  position: light.position,
  size: { w: 2, h: 1 },
  yaw: 0,
};
function camera(): PerspectiveCamera {
  const result = new PerspectiveCamera(60, 1, 0.1, 100);
  result.position.y = 2;
  result.updateMatrixWorld();
  return result;
}
function settings(): save.Settings {
  const result = save.loadSettings();
  vi.spyOn(save, 'loadSettings').mockReturnValue(result);
  return result;
}
function shader(renderer: SignRenderer, index = 0): ShaderMaterial {
  return (
    renderer.root.children[index]!.children[0] as Mesh<
      BufferGeometry,
      ShaderMaterial
    >
  ).material;
}

describe('flickerIntensity', () => {
  it('zakres, determinizm, różne ziarna i zerowa siła każdego wzoru', () => {
    for (const pattern of patterns) {
      let different = false;
      for (let i = 0; i < 10000; i++) {
        const t = i / 100;
        const value = flickerIntensity(pattern, t, 13, 0.8);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(value).toBe(flickerIntensity(pattern, t, 13, 0.8));
        expect(flickerIntensity(pattern, t, 13, 0)).toBe(1);
        different ||= value !== flickerIntensity(pattern, t, 14, 0.8);
      }
      expect(different).toBe(true);
    }
  });

  it('pulse jest okresowy, ciągły i osiąga oba krańce', () => {
    let min = 1,
      max = 0;
    for (let i = 0; i < 1000; i++) {
      const t = i / 100;
      const value = flickerIntensity('pulse', t, 7, 0.6, 3);
      expect(value).toBeCloseTo(
        flickerIntensity('pulse', t + 3, 7, 0.6, 3),
        12,
      );
      expect(
        Math.abs(value - flickerIntensity('pulse', t + 0.001, 7, 0.6, 3)),
      ).toBeLessThan(0.001);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    expect(min).toBeCloseTo(0.4, 4);
    expect(max).toBeCloseTo(1, 4);
  });

  it('buzz daje drobne szybkie przygasania', () => {
    const samples = Array.from({ length: 100 }, (_, i) =>
      flickerIntensity('buzz', i / 100, 42, 1),
    );
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(
      1 - tuning.city.flickerBuzzDepth,
    );
    expect(new Set(samples).size).toBeGreaterThan(20);
  });

  it('fail ma długie stabilne odcinki, serie 2–5 i okazjonalne wyłączenie 0,3 s', () => {
    let stable = 0;
    let dark = 0;
    let dips = 0;
    let wasDim = false;
    let longestDark = 0,
      darkRun = 0;
    const bursts: number[] = [];
    let lastDim = -100;
    for (let i = 0; i < 12000; i++) {
      const t = i / 100;
      const value = flickerIntensity('fail', t, 42, 0.8, 8);
      if (value === 1) stable++;
      if (value === 0) {
        dark++;
        darkRun++;
      } else darkRun = 0;
      longestDark = Math.max(longestDark, darkRun);
      const dim = value < 1 && value > 0;
      if (dim && !wasDim) {
        if (t - lastDim > 1 && dips) {
          bursts.push(dips);
          dips = 0;
        }
        dips++;
        lastDim = t;
      }
      wasDim = dim;
    }
    expect(stable / 12000).toBeGreaterThan(0.9);
    expect(dark).toBeGreaterThan(0);
    expect(longestDark).toBeGreaterThanOrEqual(29);
    expect(longestDark).toBeLessThanOrEqual(31);
    expect(bursts.length).toBeGreaterThan(5);
    expect(bursts.every((count) => count >= 2 && count <= 5)).toBe(true);
    // Bardzo krótki okres nie usuwa stabilnego odcinka ani nie przekracza zakresu.
    expect(
      Array.from({ length: 1000 }, (_, i) =>
        flickerIntensity('fail', i / 10000, 42, 1, 0.01),
      ).filter((v) => v === 1).length,
    ).toBeGreaterThan(400);
  });

  it('ograniczenie błysków wyłącza buzz/fail, pozostawia pulse', () => {
    for (const pattern of patterns) {
      const def: FlickerDef = { pattern };
      for (let t = 0; t < 20; t += 0.05)
        expect(sourceFlicker(def, t, 3, false)).toBe(
          pattern === 'pulse' ? flickerIntensity(pattern, t, 3) : 1,
        );
    }
  });
});

describe('format danych', () => {
  it('przyjmuje nowy format w lampach, napisach i stacjach, zachowuje stare napisy', () => {
    for (const pattern of patterns) {
      const flicker = { pattern };
      expect(cityLightSchema.parse({ ...light, flicker }).flicker).toEqual(
        flicker,
      );
      expect(signSchema.parse({ ...sign, flicker }).flicker).toEqual(flicker);
      expect(
        hubStationSignSchema.parse({
          position: light.position,
          size: sign.size,
          yaw: 0,
          flicker,
        }).flicker,
      ).toEqual(flicker);
    }
    expect(signSchema.parse({ ...sign, flicker: 0.4 }).flicker).toBe(0.4);
    for (const flicker of [
      { pattern: 'other' },
      { pattern: 'buzz', strength: -0.1 },
      { pattern: 'fail', strength: 1.1 },
      { pattern: 'pulse', periodS: 0 },
      { pattern: 'pulse', periodS: Infinity },
    ])
      expect(flickerSchema.safeParse(flicker).success).toBe(false);
  });
});

describe('integracja renderu', () => {
  it('światła mnożą bazową jasność bez wygładzania migotania i wracają z puli ze swoim czasem', () => {
    settings();
    tuning.city.maxLights = 1;
    tuning.city.lightImportance = 0;
    tuning.city.lightFadeRate = 10000;
    const flicker: FlickerDef = { pattern: 'buzz', strength: 1 };
    const renderer = own(
      new CityLights(
        [
          { ...light, flicker },
          { ...light, position: { x: 30, y: 2, z: -4 } },
        ],
        0,
        17,
      ),
    );
    const cam = camera();
    const seed = new Rng(17).fork('0').getState();
    renderer.update(0, 1, cam);
    expect(renderer.pool[0]!.intensity).toBeCloseTo(
      10 *
        tuning.city.lightIntensityScale *
        sourceFlicker(flicker, 1, seed, true),
    );
    cam.position.x = 30;
    renderer.update(0, 1, cam);
    expect(renderer.pool[0]!.position.x).toBe(30);
    expect(renderer.pool[0]!.intensity).toBe(
      10 * tuning.city.lightIntensityScale,
    );
    cam.position.x = 0;
    renderer.update(0, 1, cam);
    expect(renderer.pool[0]!.position.x).toBe(0);
    expect(renderer.pool[0]!.intensity).toBeCloseTo(
      10 *
        tuning.city.lightIntensityScale *
        sourceFlicker(flicker, 3, seed, true),
    );
  });

  it('napisy mają osobne materiały i fazy; wynik nie zależy od podziału klatek', () => {
    settings();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const defs: SignDef[] = [
      { ...sign, flicker: { pattern: 'pulse' } },
      { ...sign, flicker: { pattern: 'pulse' } },
      sign,
    ];
    const load = (): void => {};
    const a = own(new SignRenderer(defs, 20, load));
    const b = own(new SignRenderer(defs, 20, load));
    const cam = camera();
    a.update(0, 1, cam);
    for (let i = 0; i < 4; i++) b.update(0, 0.25, cam);
    expect(shader(a)).not.toBe(shader(a, 1));
    expect(shader(a).uniforms.brightness!.value).not.toBe(
      shader(a, 1).uniforms.brightness!.value,
    );
    expect(shader(a).uniforms.brightness!.value).toBe(
      shader(b).uniforms.brightness!.value,
    );
    expect(shader(a, 2).uniforms.brightness!.value).toBe(
      tuning.city.signBrightness,
    );
  });

  it('zmiana ustawienia błysków działa od następnej klatki na lampach, napisach i stacjach', () => {
    const prefs = settings();
    tuning.city.lightFadeRate = 10000;
    const cam = camera();
    const flicker: FlickerDef = { pattern: 'buzz', strength: 1 };
    const lights = own(new CityLights([{ ...light, flicker }]));
    const signs = own(
      new SignRenderer(
        [
          { ...sign, flicker },
          { ...sign, flicker: { pattern: 'pulse' } },
        ],
        9,
        () => {},
      ),
    );
    const station = hubStationSchema.parse({
      id: 'arena',
      position: { x: 0, z: 0 },
      radius: 1,
      focus: { position: light.position, size: { x: 1, y: 1, z: 1 } },
      label: 'POLIGON',
      sign: { position: light.position, size: sign.size, yaw: 0, flicker },
    });
    const decor = own(new HubDecor([], [station]));
    const material = (
      decor.root.getObjectByName('label:arena') as Mesh<
        BufferGeometry,
        MeshBasicMaterial
      >
    ).material;
    lights.update(0, 1, cam);
    signs.update(0, 1, cam);
    decor.update(1);
    expect(lights.pool[0]!.intensity).toBeLessThan(
      10 * tuning.city.lightIntensityScale,
    );
    expect(shader(signs).uniforms.brightness!.value).toBeLessThan(
      tuning.city.signBrightness,
    );
    expect(material.color.r).toBeLessThan(1);
    prefs.flashes = false;
    lights.update(0, 0.1, cam);
    signs.update(0, 0.1, cam);
    decor.update(0.1);
    expect(lights.pool[0]!.intensity).toBe(
      10 * tuning.city.lightIntensityScale,
    );
    expect(shader(signs).uniforms.brightness!.value).toBe(
      tuning.city.signBrightness,
    );
    expect(shader(signs, 1).uniforms.brightness!.value).toBeLessThan(
      tuning.city.signBrightness,
    );
    expect(material.color.r).toBe(1);
  });
});
