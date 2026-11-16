import { afterEach, expect, it, vi } from 'vitest';
import {
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
} from 'three';
import type { WebGLRenderer, WebGLRenderTarget } from 'three';
import { tuning } from '../../src/core/tuning';
import { loadSettings } from '../../src/core/save';
import { applyQuality, getQuality } from '../../src/render/quality';
import { createRenderPipeline } from '../../src/render/outline';
import { applyTheme, resolveTheme } from '../../src/render/themes';
import { CityDressing } from '../../src/render/city/dressing';
import { CityLights } from '../../src/render/city/lights';
import { CityParticleBatch } from '../../src/render/city/particles';
import { configureFx, isLiteFx, preserveLiteFx } from '../../src/render/fxMode';
import { EventBus } from '../../src/core/events';
import { ExplosionRenderer } from '../../src/render/explosionRenderer';

const original = { ...tuning.render };
afterEach(() => {
  configureFx(new URLSearchParams());
  applyQuality('high');
  Object.assign(tuning.render, original);
});

it.each([
  ['', false],
  ['fx=lite', false],
  ['debug=0&fx=lite', false],
  ['debug=1', false],
  ['debug=1&fx=full', false],
  ['debug=1&fx=lite', true],
] as const)('flaga renderu %s wymaga jawnego debug=1', (search, enabled) => {
  const params = new URLSearchParams(search);
  expect(isLiteFx(params)).toBe(enabled);
  configureFx(params);
  const f = fixture();
  try {
    applyQuality('high', f.targets);
    expect(getQuality().outline).toBe(enabled ? 0 : 1);
    expect(f.renderer.setPixelRatio).toHaveBeenLastCalledWith(enabled ? 1 : 2);
    const next = new URLSearchParams({ scene: 'hub', debug: '1' });
    preserveLiteFx(params, next);
    expect(next.get('fx')).toBe(enabled ? 'lite' : null);
  } finally {
    f.pipeline.dispose();
  }
});

it('lite omija maski i postprocessing mimo motywu i zmiany jakości', () => {
  configureFx(new URLSearchParams('debug=1&fx=lite'));
  const f = fixture();
  const restore = applyTheme(resolveTheme('neonStreet', ''));
  const dressing = new CityDressing(
    new Group(),
    {},
    resolveTheme('neonStreet', ''),
    0,
    'lite',
  );
  try {
    for (const profile of ['low', 'medium', 'high'] as const) {
      applyQuality(profile, f.targets);
      f.renderer.render.mockClear();
      f.widths.length = 0;
      f.pipeline.render(new Scene(), new PerspectiveCamera(), 0);
      expect(f.renderer.render).toHaveBeenCalledOnce();
      expect(f.widths).toEqual([0]);
      expect(f.renderer.shadowMap.enabled).toBe(false);
      expect(f.renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
      expect(getQuality()).toMatchObject({
        bloom: 0,
        reflections: 0,
        rainDensity: 0,
        particleDensity: 0,
      });
    }
    expect(dressing.weather).toBeUndefined();
  } finally {
    dressing.dispose();
    restore();
    f.pipeline.dispose();
  }
});

it('lite pomija wizualne warstwy wybuchu, zachowując hitstop i wstrząs', () => {
  configureFx(new URLSearchParams('debug=1&fx=lite'));
  const bus = new EventBus();
  const burstSparks = vi.fn();
  const hitstop = vi.fn();
  const shake = vi.fn();
  bus.on('hitstop', hitstop);
  bus.on('camera_shake', shake);
  const view = new ExplosionRenderer(bus, {
    burstSparks,
    playerPosition: () => ({ x: 0, y: 0, z: 0 }),
    settings: { flashes: true, screenShake: 1 },
  });
  try {
    bus.emit('explosion', {
      point: { x: 0, y: 0, z: 0 },
      radiusM: 4,
      owner: 1,
      tags: ['#fire'],
    });
    view.render(0.01);
    expect(view.root.children.every((mesh) => !mesh.visible)).toBe(true);
    expect(burstSparks).not.toHaveBeenCalled();
    expect(hitstop).toHaveBeenCalledExactlyOnceWith({
      ms: tuning.vfx.explosionHitstopMs,
    });
    expect(shake).toHaveBeenCalledOnce();
  } finally {
    view.dispose();
  }
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  let ratio = 1;
  const widths: number[] = [];
  const renderer = {
    autoClear: false,
    shadowMap: { enabled: false },
    setPixelRatio: vi.fn((value: number) => {
      ratio = value;
    }),
    getPixelRatio: () => ratio,
    getSize: (out: Vector2) => out.set(320, 180),
    getDrawingBufferSize: (out: Vector2) => out.set(320 * ratio, 180 * ratio),
    getRenderTarget: () => target,
    setRenderTarget: (value: WebGLRenderTarget | null) => {
      target = value;
    },
    getClearColor: (out: Color) => out.set('#123456'),
    getClearAlpha: () => 1,
    setClearColor: vi.fn(),
    render: vi.fn((_scene: Scene) => {
      void _scene;
      widths.push(target?.width ?? 0);
    }),
  };
  const pipeline = createRenderPipeline(renderer as unknown as WebGLRenderer);
  const targets = {
    renderer,
    pipeline,
    width: 320,
    height: 180,
    devicePixelRatio: 2,
  };
  return { renderer, pipeline, targets, widths };
}

it.each([
  ['low', 0.75, 1, 0],
  ['medium', 1, 8, 80],
  ['high', 2, 11, 320],
] as const)(
  'applyQuality %s zmienia prawdziwy pipeline bez WebGL',
  (profile, ratio, passes, maskWidth) => {
    const f = fixture();
    applyQuality(profile, f.targets);
    const restore = applyTheme(resolveTheme('neonStreet', ''));
    try {
      f.pipeline.render(new Scene(), new PerspectiveCamera(), 0);
      expect(f.renderer.setPixelRatio).toHaveBeenCalledWith(ratio);
      expect(f.renderer.shadowMap.enabled).toBe(false);
      expect(f.renderer.render).toHaveBeenCalledTimes(passes);
      if (profile !== 'low') {
        expect(f.widths).toContain(maskWidth);
        const composition = f.renderer.render.mock.calls.at(-1)![0];
        const quad = composition.children[0] as Mesh;
        const uniforms = (quad.material as ShaderMaterial).uniforms;
        expect(uniforms.heightFogDensity!.value).toBe(
          tuning.render.heightFogDensity,
        );
        expect(uniforms.reflectionStrength!.value).toBe(
          profile === 'high' ? tuning.render.reflectionStrength : 0,
        );
      }
    } finally {
      restore();
      f.pipeline.dispose();
    }
  },
);

it('high zachowuje zapisane wartości sprzed Z9, motyw i pełne DPR', () => {
  expect(tuning.render.outline).toBe(1);
  expect(tuning.render.bloom).toBe(1);
  expect(tuning.city.maxLights).toBe(8);
  expect(tuning.city.rainMax).toBe(4000);
  expect(tuning.city.rainDensity).toBe(0.7);
  expect(getQuality()).toEqual({
    pixelRatio: 0,
    outline: 1,
    bloom: 1,
    bloomResolution: 1,
    reflections: 1,
    maxLights: 8,
    rainDensity: 1,
    particleDensity: 1,
    heightFog: 1,
    shadows: 0,
  });
  const f = fixture();
  const before = { ...tuning.render };
  for (const quality of ['low', 'medium', 'high'] as const)
    applyQuality(quality, { ...f.targets, devicePixelRatio: 3 });
  expect(f.renderer.setPixelRatio).toHaveBeenLastCalledWith(3);
  expect(tuning.render).toEqual(before);
  expect(Object.keys(tuning.quality.low)).toEqual(
    Object.keys(tuning.quality.high),
  );
  expect(Object.keys(tuning.quality.medium)).toEqual(
    Object.keys(tuning.quality.high),
  );
  f.pipeline.dispose();
});

it('przełącza low/medium/high na tej samej instancji, także przy stałym DPR', () => {
  const f = fixture();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  for (const [profile, widths] of [
    ['high', [320, 320, 160, 80, 80, 80, 80, 0]],
    ['medium', [320, 320, 80, 40, 40, 40, 40, 0]],
    ['low', [0]],
    ['high', [320, 320, 160, 80, 80, 80, 80, 0]],
  ] as const) {
    applyQuality(profile, { ...f.targets, devicePixelRatio: 1 });
    f.widths.length = 0;
    f.pipeline.render(scene, camera, 0);
    expect(f.widths).toEqual(widths);
  }
  f.pipeline.dispose();
});

it('światła, cząsteczki i deszcz reagują na żywo', () => {
  const camera = new PerspectiveCamera();
  const lights = new CityLights(
    Array.from({ length: 8 }, () => ({
      position: { x: 0, y: 0, z: -3 },
      color: '#ffae1a',
      intensity: 10,
      range: 5,
    })),
  );
  const particles = new CityParticleBatch(8, 'steam', 1);
  for (let i = 0; i < 8; i++) particles.pool.spawn(1);
  const theme = resolveTheme('neonStreet', '');
  const dressing = new CityDressing(new Group(), {}, theme, 0, 'quality');
  for (const [profile, count, density] of [
    ['low', 2, 0.25],
    ['medium', 4, 0.5],
    ['high', 8, 1],
  ] as const) {
    applyQuality(profile);
    lights.update(1, 1, camera);
    expect(lights.pool.filter((light) => light.visible)).toHaveLength(count);
    particles.render(camera);
    expect(particles.mesh.count).toBe(count);
    dressing.render(0, camera);
    expect(dressing.weather!.rain.count).toBe(
      Math.floor(tuning.city.rainMax * theme.rain.density * density),
    );
    expect(dressing.weather!.params.density).toBe(theme.rain.density);
  }
  dressing.dispose();
  lights.dispose();
  particles.mesh.geometry.dispose();
  const material = particles.mesh.material;
  if (!Array.isArray(material)) material.dispose();
});

it('brak zapisu daje medium; istniejący high i stare ustawienia pozostają high', () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw } as unknown as Storage;
  expect(loadSettings(storage).quality).toBe('medium');
  raw = '{"quality":"high"}';
  expect(loadSettings(storage).quality).toBe('high');
  raw = '{"masterVolume":0.4}';
  expect(loadSettings(storage).quality).toBe('high');
});
