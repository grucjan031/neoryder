import { afterEach, expect, it, vi } from 'vitest';
import {
  AmbientLight,
  Color,
  DepthTexture,
  Group,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector2,
  Vector3,
} from 'three';
import type { ShaderMaterial, WebGLRenderTarget, WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import { createRenderPipeline } from '../../src/render/outline';
import {
  invalidateViewmodelLights,
  registerViewmodel,
  renderWithViewmodel,
  VIEWMODEL_LAYER,
  viewmodelAnchor,
  viewmodelNear,
} from '../../src/render/viewmodelLayer';
import { WetNormals } from '../../src/render/reflections';

const defaults = { ...tuning.render };
const cameraDefaults = { ...tuning.camera };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  Object.assign(tuning.camera, cameraDefaults);
  vi.restoreAllMocks();
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  const renderer = {
    autoClear: false,
    clearDepth: vi.fn(),
    shadowMap: { autoUpdate: true, needsUpdate: false },
    getSize: (out: Vector2) => out.set(320, 180),
    getPixelRatio: () => 1,
    getDrawingBufferSize: (out: Vector2) => out.set(320, 180),
    getRenderTarget: () => target,
    setRenderTarget: (value: WebGLRenderTarget | null) => {
      target = value;
    },
    getClearColor: (out: Color) => out.set(0),
    getClearAlpha: () => 0,
    setClearColor: vi.fn(),
    render: vi.fn(),
  };
  const gpu = renderer as unknown as WebGLRenderer;
  return { renderer, gpu, pipeline: createRenderPipeline(gpu) };
}

type Pass = { material: ShaderMaterial };

function shaders(pipeline: object) {
  return {
    composite: (Reflect.get(pipeline, 'composite') as Pass).material,
    edge: (Reflect.get(pipeline, 'edgePass') as Pass).material,
  };
}

it('shader obrysu: obiekty viewmodelu bez konturu nie dostają linii ani efektów świata', () => {
  const { pipeline } = fixture();
  const { composite, edge } = shaders(pipeline);
  for (const shader of [composite.fragmentShader, edge.fragmentShader]) {
    expect(shader).toContain('bool inkSuppressedAt(vec2 uv)');
    expect(shader).toContain('texture2D(viewmodelNormalDepthMap, uv).x - 5e-4');
  }
  const f = composite.fragmentShader;
  // Piksel viewmodelu w kolorze nie jest powierzchnią świata: bez odbić, cel-shadingu i mgły.
  expect(f).toContain(
    'bool worldSurface = rawDepth >= 0.0 && rawDepth < 1.0 && !viewmodelColor;',
  );
  expect(f).toContain(
    'if (viewmodelColor && inkSuppressedAt(vUv)) edge = 0.0;',
  );
  expect(edge.fragmentShader).toContain(
    'if (suppressed) gl_FragColor = vec4(0.0, 0.0, 0.0, nearest);',
  );
  pipeline.dispose();
});

it('shader obrysu: zewnętrzny tusz rąk liczy odległość i mgłę po stronie viewmodelu', () => {
  const { pipeline } = fixture();
  const { composite, edge } = shaders(pipeline);
  const f = composite.fragmentShader;
  expect(f).toMatch(
    /float inkNear = 1\.0 - smoothstep\(outlineFadeNear \* 0\.5, [^;]*, nearest\);/,
  );
  expect(f).not.toMatch(/outlineFadeNear \* 0\.5 \+ 1e-3\), centerDepth\)/);
  expect(f).toContain('if (!viewmodelInk) line = mix(line, flashedFog, fog);');
  // Dylatacja tuszu rąk nie czerpie z dalekich krawędzi tła.
  expect(edge.fragmentShader).toContain(
    'float viewmodelLine = (rawDepth < 0.0 || layerEdge) ? max(depthLine, normalLine) : 0.0;',
  );
  expect(f).toContain(
    'edge = max(edge, ink * (1.0 - smoothstep(0.5, 0.8, hits / 24.0)));',
  );
  pipeline.dispose();
});

it('pipeline resetuje uniformy viewmodelu po jego wyrejestrowaniu', () => {
  const { pipeline } = fixture();
  const { composite } = shaders(pipeline);
  const colorTarget = Reflect.get(pipeline, 'colorTarget') as WebGLRenderTarget;
  const normalTarget = Reflect.get(
    pipeline,
    'normalTarget',
  ) as WebGLRenderTarget;
  const scene = new Scene();
  const cam = new PerspectiveCamera();
  const unregister = registerViewmodel(new Group());
  pipeline.render(scene, cam, 0);
  expect(composite.uniforms.viewmodelActive!.value).toBe(true);
  expect(composite.uniforms.viewmodelColorDepthMap!.value).toBeInstanceOf(
    DepthTexture,
  );
  expect(composite.uniforms.viewmodelColorDepthMap!.value).not.toBe(
    colorTarget.depthTexture,
  );
  unregister();
  pipeline.render(scene, cam, 0);
  expect(composite.uniforms.viewmodelActive!.value).toBe(false);
  expect(composite.uniforms.viewmodelColorDepthMap!.value).toBe(
    colorTarget.depthTexture,
  );
  expect(composite.uniforms.viewmodelNormalDepthMap!.value).toBe(
    normalTarget.depthTexture,
  );
  pipeline.dispose();
});

it('przebieg mokrych normalnych dostaje osobną głębię viewmodelu', () => {
  const { pipeline } = fixture();
  tuning.render.reflectionStrength = 1;
  const normalDepth = Reflect.get(pipeline, 'viewmodelNormalDepth');
  const spy = vi.spyOn(WetNormals.prototype, 'render');
  const unregister = registerViewmodel(new Group());
  pipeline.render(new Scene(), new PerspectiveCamera(), 0);
  unregister();
  expect(spy.mock.calls.length).toBeGreaterThan(0);
  expect(spy.mock.calls[0]![3]).toBe(normalDepth);
  pipeline.dispose();
});

it('viewmodelNear: kamera ortograficzna zachowuje near, perspektywiczna nie przekracza near świata', () => {
  tuning.camera.viewmodelNearM = 0.03;
  expect(viewmodelNear(new OrthographicCamera(-1, 1, 1, -1, 0.5, 10))).toBe(
    0.5,
  );
  expect(viewmodelNear(new PerspectiveCamera(70, 1, 0.6, 100))).toBe(0.03);
  expect(viewmodelNear(new PerspectiveCamera(70, 1, 0.01, 100))).toBe(0.01);
  tuning.camera.viewmodelNearM = 0;
  expect(viewmodelNear(new PerspectiveCamera(70, 1, 0.6, 100))).toBe(1e-3);
});

it('viewmodelAnchor rzutuje punkt kamerą świata tam, gdzie przebieg rąk', () => {
  const cam = new PerspectiveCamera(90, 1.5, 0.1, 100);
  cam.position.set(1, 2, 3);
  cam.updateMatrixWorld();
  const world = new Vector3(0.2, -0.1, -0.5).applyMatrix4(cam.matrixWorld);
  tuning.camera.viewmodelFov = 0;
  expect(viewmodelAnchor(cam, world.clone()).distanceTo(world)).toBe(0);
  tuning.camera.viewmodelFov = 60;
  const moved = viewmodelAnchor(cam, world.clone());
  const hands = new PerspectiveCamera(60, 1.5, 0.1, 100);
  hands.position.copy(cam.position);
  hands.updateMatrixWorld();
  const expected = world.clone().project(hands);
  const actual = moved.clone().project(cam);
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  const depth = moved.clone().applyMatrix4(cam.matrixWorldInverse).z;
  expect(depth).toBeCloseTo(-0.5, 6);
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 10);
  const same = world.clone();
  expect(viewmodelAnchor(ortho, same)).toBe(same);
  expect(same.distanceTo(world)).toBe(0);
});

it('warstwa viewmodelu na światłach nie wymaga przeszukania sceny w każdym przebiegu', () => {
  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  const unregister = registerViewmodel(root);
  const light = new AmbientLight();
  scene.add(light);
  const renderer = {
    autoClear: true,
    clearDepth: vi.fn(),
    getRenderTarget: () => null,
    setRenderTarget: vi.fn(),
    render: vi.fn(),
    shadowMap: { autoUpdate: true, needsUpdate: false },
  } as unknown as WebGLRenderer;
  const cam = new PerspectiveCamera();
  const traverse = vi.spyOn(scene, 'traverse');
  renderWithViewmodel(renderer, scene, cam);
  expect(light.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
  expect(traverse).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 20; i++) renderWithViewmodel(renderer, scene, cam);
  expect(traverse).toHaveBeenCalledTimes(1);
  // Nowe światło w korzeniu sceny zmienia liczbę dzieci i wymusza przeszukanie.
  const added = new PointLight();
  scene.add(added);
  renderWithViewmodel(renderer, scene, cam);
  expect(traverse).toHaveBeenCalledTimes(2);
  expect(added.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
  invalidateViewmodelLights(scene);
  renderWithViewmodel(renderer, scene, cam);
  expect(traverse).toHaveBeenCalledTimes(3);
  unregister();
});
