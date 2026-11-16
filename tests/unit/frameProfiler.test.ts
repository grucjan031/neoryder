import { afterEach, expect, it, vi } from 'vitest';
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector2,
} from 'three';
import type { WebGLRenderer, WebGLRenderTarget } from 'three';
import {
  FrameProfiler,
  setFrameProfiler,
} from '../../src/render/frameProfiler';
import { tuning } from '../../src/core/tuning';
import { createRenderPipeline } from '../../src/render/outline';
import { applyQuality } from '../../src/render/quality';
import { CityDressing } from '../../src/render/city/dressing';
import { resolveTheme } from '../../src/render/themes';

const renderDefaults = { ...tuning.render };

afterEach(() => {
  setFrameProfiler(undefined);
  Object.assign(tuning.render, renderDefaults);
  applyQuality('high');
  vi.restoreAllMocks();
});

function fixture(gpu = false) {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  let active = false;
  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    getExtension: vi.fn(() =>
      gpu ? { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb } : null,
    ),
    getParameter: vi.fn(() => false),
    isContextLost: vi.fn(() => false),
    createQuery: vi.fn(() => ({})),
    deleteQuery: vi.fn(),
    beginQuery: vi.fn(() => {
      expect(active).toBe(false);
      active = true;
    }),
    endQuery: vi.fn(() => {
      expect(active).toBe(true);
      active = false;
    }),
    getQueryParameter: vi.fn(
      (_query: unknown, parameter: number): boolean | number =>
        parameter === 0x8867 ? true : 1_000_000,
    ),
  };
  const info = {
    autoReset: true,
    render: { calls: 0, triangles: 0 },
    programs: [{}, {}],
    reset: vi.fn(() => {
      info.render.calls = 0;
      info.render.triangles = 0;
    }),
  };
  const renderer = { getContext: vi.fn(() => gl), info };
  const profiler = new FrameProfiler(renderer as unknown as WebGLRenderer);
  const scene = new Scene();
  return {
    profiler,
    gl,
    renderer,
    scene,
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    frame: (ms = 1) => {
      profiler.begin('step');
      now += ms;
      profiler.end();
      profiler.endFrame(scene, 1 / 60);
    },
  };
}

it('wyłączony: zero odczytów zegara, GL, liczników i alokacji na ścieżce klatki', () => {
  const { profiler, renderer, scene, clock } = fixture();
  const traverse = vi.spyOn(scene, 'traverseVisible');
  const arrayFrom = vi.spyOn(Array, 'from');
  const query = profiler.averages;
  for (let i = 0; i < 240; i++) {
    profiler.begin('step');
    profiler.end();
    profiler.endFrame(scene, 1 / 60);
    expect(profiler.averages).toBe(query);
  }
  expect(clock).not.toHaveBeenCalled();
  expect(renderer.getContext).not.toHaveBeenCalled();
  expect(renderer.info.reset).not.toHaveBeenCalled();
  expect(traverse).not.toHaveBeenCalled();
  expect(arrayFrom).not.toHaveBeenCalled();
  expect(profiler.averages.frames).toBe(0);
});

it('sumuje kroki symulacji w klatce i uśrednia tylko ostatnie 120 klatek', () => {
  const { profiler, frame, advance, scene } = fixture();
  profiler.setEnabled(true);
  frame(999);
  for (let i = 0; i < 119; i++) frame(2);
  profiler.begin('step');
  advance(1);
  profiler.end();
  profiler.begin('step');
  advance(3);
  profiler.end();
  profiler.endFrame(scene, 1 / 60);
  expect(profiler.averages.frames).toBe(120);
  expect(profiler.averages.totalFrames).toBe(121);
  expect(profiler.averages.stages.step.cpuMs).toBeCloseTo(242 / 120);
  expect(profiler.averages.frameMs).toBeCloseTo(1000 / 60);
});

it('brak rozszerzenia GPU daje null dla wszystkich etapów', () => {
  const { profiler, frame, gl } = fixture();
  profiler.setEnabled(true);
  frame();
  expect(profiler.averages.gpuAvailable).toBe(false);
  expect(profiler.averages.gpuFrames).toBe(0);
  for (const stage of Object.values(profiler.averages.stages))
    expect(stage.gpuMs).toBeNull();
  expect(gl.createQuery).not.toHaveBeenCalled();
});

it('GPU: dzieli zagnieżdżone etapy na rozłączne odcinki i sumuje rodzica', () => {
  const { profiler, gl, scene, advance } = fixture(true);
  profiler.setEnabled(true);
  profiler.begin('pipeline');
  advance(2);
  profiler.begin('color');
  advance(3);
  profiler.end();
  advance(4);
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(gl.beginQuery).toHaveBeenCalledTimes(3);
  expect(gl.endQuery).toHaveBeenCalledTimes(3);
  expect(profiler.averages.stages.pipeline).toEqual({ cpuMs: 9, gpuMs: 3 });
  expect(profiler.averages.stages.color).toEqual({ cpuMs: 3, gpuMs: 1 });
  expect(profiler.averages.stages.bloom).toEqual({ cpuMs: 0, gpuMs: 0 });
  profiler.dispose();
  expect(gl.deleteQuery).toHaveBeenCalledTimes(3);
});

it('GPU: odczytuje wynik dopiero po dostępności i uwzględnia zera pominiętych etapów', () => {
  const { profiler, gl, frame } = fixture(true);
  profiler.setEnabled(true);
  gl.getQueryParameter.mockImplementation((_query, parameter) =>
    parameter === gl.QUERY_RESULT_AVAILABLE ? false : 2_000_000,
  );
  frame();
  expect(profiler.averages.gpuFrames).toBe(0);
  expect(profiler.averages.stages.step.gpuMs).toBeNull();
  expect(
    gl.getQueryParameter.mock.calls.every(([, p]) => p !== gl.QUERY_RESULT),
  ).toBe(true);
  gl.getQueryParameter.mockImplementation((_query, parameter) =>
    parameter === gl.QUERY_RESULT_AVAILABLE ? true : 2_000_000,
  );
  frame();
  expect(profiler.averages.gpuFrames).toBe(2);
  expect(profiler.averages.stages.step.gpuMs).toBe(2);
});

it('GPU: disjoint unieważnia pomiary; kolejne poprawne klatki wracają do raportu', () => {
  const { profiler, gl, frame } = fixture(true);
  profiler.setEnabled(true);
  frame();
  gl.getParameter.mockReturnValue(true);
  frame();
  expect(profiler.averages.gpuFrames).toBe(0);
  expect(profiler.averages.stages.step.gpuMs).toBeNull();
  gl.getParameter.mockReturnValue(false);
  frame();
  expect(profiler.averages.gpuFrames).toBe(1);
  expect(profiler.averages.stages.step.gpuMs).toBe(1);
});

it('liczy widoczne światła i obiekty transparentne raz na obiekt oraz cały potok', () => {
  const { profiler, renderer, scene } = fixture();
  scene.add(new PointLight());
  const hidden = new Group();
  hidden.visible = false;
  hidden.add(new PointLight());
  scene.add(hidden);
  const transparent = new MeshBasicMaterial({ transparent: true });
  scene.add(new Mesh(undefined, [transparent, transparent]));
  profiler.setEnabled(true);
  expect(renderer.info.autoReset).toBe(false);
  profiler.begin('pipeline');
  renderer.info.render.calls += 5;
  renderer.info.render.triangles += 100;
  renderer.info.render.calls += 2;
  renderer.info.render.triangles += 20;
  profiler.end();
  profiler.endFrame(scene, 0.02);
  expect(profiler.averages.counters).toEqual({
    calls: 7,
    triangles: 120,
    lights: 1,
    programs: 2,
    transparent: 1,
  });
  expect(renderer.info.render.calls).toBe(0);
  profiler.dispose();
  expect(renderer.info.autoReset).toBe(true);
  transparent.dispose();
});

it('off zwalnia oczekujące zapytania, zachowuje raport i ponownie nie mierzy', () => {
  const { profiler, gl, frame, clock } = fixture(true);
  profiler.setEnabled(true);
  gl.getQueryParameter.mockReturnValue(false);
  frame(3);
  const query = profiler.averages;
  profiler.setEnabled(false);
  clock.mockClear();
  frame(100);
  expect(clock).not.toHaveBeenCalled();
  expect(profiler.averages).toBe(query);
  expect(query.enabled).toBe(false);
  expect(query.stages.step.cpuMs).toBe(3);
  expect(gl.deleteQuery).toHaveBeenCalledTimes(1);
  profiler.setEnabled(true);
  expect(profiler.averages.totalFrames).toBe(0);
  frame(2);
  expect(profiler.averages.stages.step.cpuMs).toBe(2);
  profiler.dispose();
});

it('GPU: pamięć zapytań jest ograniczona, a brak wyniku nie blokuje CPU', () => {
  const { profiler, gl, scene } = fixture(true);
  profiler.setEnabled(true);
  gl.getQueryParameter.mockReturnValue(false);
  for (let i = 0; i < 2200; i++) {
    profiler.begin('step');
    profiler.end();
  }
  profiler.endFrame(scene, 0.016);
  expect(gl.createQuery).toHaveBeenCalledTimes(2048);
  expect(profiler.averages.frames).toBe(1);
  expect(profiler.averages.gpuFrames).toBe(0);
  profiler.dispose();
  expect(gl.deleteQuery).toHaveBeenCalledTimes(2048);
});

it('GPU: opóźnione wyniki spoza okna nie trafiają do ponownie użytego miejsca', () => {
  const { profiler, gl, frame } = fixture(true);
  profiler.setEnabled(true);
  gl.getQueryParameter.mockReturnValue(false);
  for (let i = 0; i < 121; i++) frame();
  expect(profiler.averages.gpuFrames).toBe(0);
  gl.getQueryParameter.mockImplementation((_query, parameter) =>
    parameter === gl.QUERY_RESULT_AVAILABLE ? true : 2_000_000,
  );
  frame();
  expect(profiler.averages.frames).toBe(120);
  expect(profiler.averages.gpuFrames).toBe(120);
  expect(profiler.averages.stages.step.gpuMs).toBe(2);
  profiler.dispose();
});

it('klatki bez symulacji (pauza) wnoszą zero do średniej kroków', () => {
  const { profiler, frame, scene } = fixture();
  profiler.setEnabled(true);
  frame(4);
  profiler.begin('sceneRender');
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(profiler.averages.stages.step.cpuMs).toBe(2);
});

function pipelineFixture() {
  const setup = fixture(true);
  const { renderer, advance } = setup;
  let target: WebGLRenderTarget | null = null;
  const clearColor = new Color('#123456');
  const drawing = Object.assign(renderer, {
    autoClear: false,
    clippingPlanes: [],
    getSize: (out: Vector2) => out.set(320, 180),
    getPixelRatio: () => 1,
    getDrawingBufferSize: (out: Vector2) => out.set(320, 180),
    getRenderTarget: () => target,
    setRenderTarget: (value: WebGLRenderTarget | null) => {
      target = value;
    },
    getClearColor: (out: Color) => out.copy(clearColor),
    getClearAlpha: () => 1,
    setClearColor: (color: Color | number) => clearColor.set(color),
    render: vi.fn(() => {
      advance(1);
      renderer.info.render.calls++;
      renderer.info.render.triangles += 2;
    }),
  });
  const pipeline = createRenderPipeline(drawing as unknown as WebGLRenderer);
  setFrameProfiler(setup.profiler);
  setup.profiler.setEnabled(true);
  return { ...setup, drawing, pipeline, camera: new PerspectiveCamera() };
}

it('integracja: każdy przebieg high, low i impuls są mierzone bez zmiany liczby renderów', () => {
  const { profiler, pipeline, drawing, scene, camera } = pipelineFixture();
  tuning.render.outline = 1;
  tuning.render.bloom = 1;
  tuning.render.bloomStrength = 1;
  tuning.render.reflectionStrength = 1;
  tuning.render.postFx = 1;
  pipeline.fxState.hit(1);
  const begin = vi.spyOn(profiler, 'begin');
  profiler.begin('pipeline');
  pipeline.render(scene, camera, 0.016);
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(drawing.render).toHaveBeenCalledTimes(12);
  expect(profiler.averages.counters.calls).toBe(12);
  for (const stage of [
    'color',
    'normals',
    'reflectionMask',
    'reflectionBlurX',
    'reflectionBlurY',
    'bloomMask',
    'bloomBlurX1',
    'bloomBlurY1',
    'bloomBlurX2',
    'bloomBlurY2',
    'composite',
    'postFx',
  ] as const) {
    expect(begin).toHaveBeenCalledWith(stage);
    expect(profiler.averages.stages[stage].cpuMs).toBe(1);
  }
  expect(profiler.averages.stages.pipeline.cpuMs).toBe(12);
  expect(profiler.averages.stages.reflections.cpuMs).toBe(3);
  expect(profiler.averages.stages.bloom.cpuMs).toBe(5);
  applyQuality('low');
  begin.mockClear();
  profiler.begin('pipeline');
  pipeline.render(scene, camera, 0.016);
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(begin.mock.calls.map(([stage]) => stage)).toEqual([
    'pipeline',
    'color',
  ]);
  expect(drawing.render).toHaveBeenCalledTimes(13);
  pipeline.dispose();
  profiler.dispose();
});

it('integracja: błąd w przebiegu domyka zakres GPU i przywraca stan renderera', () => {
  const { profiler, pipeline, drawing, scene, camera, gl } = pipelineFixture();
  const background = new Color('#234567');
  scene.background = background;
  drawing.render.mockImplementation(() => {
    throw new Error('draw failed');
  });
  profiler.begin('pipeline');
  expect(() => pipeline.render(scene, camera, 0.016)).toThrow('draw failed');
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(gl.beginQuery.mock.calls.length).toBe(gl.endQuery.mock.calls.length);
  expect(scene.background).toBe(background);
  expect(scene.overrideMaterial).toBeNull();
  expect(drawing.autoClear).toBe(false);
  expect(drawing.getRenderTarget()).toBeNull();
  pipeline.dispose();
  profiler.dispose();
});

it('integracja: aktualizacja miasta jest podzakresem sceneRender', () => {
  const { profiler, scene, advance } = fixture();
  const dressing = new CityDressing(
    scene,
    {},
    resolveTheme('white'),
    0,
    'profile',
  );
  setFrameProfiler(profiler);
  profiler.setEnabled(true);
  const begin = vi.spyOn(profiler, 'begin');
  profiler.begin('sceneRender');
  dressing.render(0.016, new PerspectiveCamera());
  advance(2);
  profiler.end();
  profiler.endFrame(scene, 0.016);
  expect(begin.mock.calls.map(([stage]) => stage)).toEqual([
    'sceneRender',
    'city',
  ]);
  expect(profiler.averages.stages.sceneRender.cpuMs).toBe(2);
  dressing.dispose();
  profiler.dispose();
});
