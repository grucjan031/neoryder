import { afterEach, expect, it, vi } from 'vitest';
import {
  Color,
  Mesh,
  BoxGeometry,
  PerspectiveCamera,
  Scene,
  ShaderLib,
  Vector2,
} from 'three';
import type {
  WebGLRenderer,
  WebGLRenderTarget,
  WebGLProgramParametersWithUniforms,
} from 'three';
import { tuning } from '../../src/core/tuning';
import {
  applyTheme,
  loadThemeDefinitions,
  resolveTheme,
  themeDefinitions,
} from '../../src/render/themes';
import { themeSchema } from '../../src/render/themeSchema';
import { getMaterial } from '../../src/render/materials';
import { SceneAtmosphere } from '../../src/render/sceneAtmosphere';
import { createRenderPipeline } from '../../src/render/outline';
import { WetNormals } from '../../src/render/reflections';
import { loadRoom } from '../../src/world/roomSchema';
import { roomDefinitions } from '../../src/world/rooms';
import { arenaLayoutSchema } from '../../src/scenes/arena';
import arenaData from '../../src/data/scenes/arena.json';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  vi.restoreAllMocks();
});

it('waliduje oba motywy, zachowuje white i odrzuca niepoprawne parametry', () => {
  expect([...themeDefinitions.keys()].sort()).toEqual([
    'hideout',
    'kuroganeFusion',
    'kuroganeResidence',
    'neonStreet',
    'white',
  ]);
  for (const theme of themeDefinitions.values())
    expect(themeSchema.safeParse(theme).success).toBe(true);
  const white = themeDefinitions.get('white')!;
  const { fusionReactor, ...themeDefaults } = defaults;
  expect(white.render).toEqual(themeDefaults);
  expect(tuning.render.fusionReactor).toBe(fusionReactor);
  expect(() => loadThemeDefinitions([white, white])).toThrow('Powtórzony');
  expect(
    themeSchema.safeParse({ ...white, rain: { ...white.rain, density: 2 } })
      .success,
  ).toBe(false);
  expect(themeDefinitions.get('neonStreet')!.rain.storm).toBe(true);
  expect(white.rain.storm).toBeUndefined();
  expect(
    themeSchema.safeParse({ ...white, rain: { ...white.rain, storm: 1 } })
      .success,
  ).toBe(false);
  expect(
    themeSchema.safeParse({
      ...white,
      render: { ...white.render, skyTop: 'red' },
    }).success,
  ).toBe(false);
  expect(
    themeSchema.safeParse({ ...white, render: { ...white.render, fogFar: 0 } })
      .success,
  ).toBe(false);
});

it('applyTheme przywraca także strojenie użytkownika i jest idempotentne', () => {
  tuning.render.bloomRadius = 3.25;
  const previous = { ...tuning.render };
  const restore = applyTheme(themeDefinitions.get('neonStreet')!);
  expect(tuning.render.interactive).toBe('#d9dde3');
  expect(tuning.render.reflectionStrength).toBeGreaterThan(0);
  tuning.render.fogNear = 4;
  restore();
  expect(tuning.render).toEqual(previous);
  tuning.render.fogNear = 6;
  restore();
  expect(tuning.render.fogNear).toBe(6);
});

it('URL nadpisuje układ, brak motywu wybiera white, nieznany motyw ostrzega raz', () => {
  expect(resolveTheme(undefined, '').id).toBe('white');
  expect(resolveTheme('neonStreet', '?theme=white').id).toBe('white');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(resolveTheme('bad-theme', '').id).toBe('white');
  resolveTheme('bad-theme', '');
  expect(warning).toHaveBeenCalledOnce();
});

const dressing = {
  theme: 'neonStreet',
  signs: [
    {
      kind: 'neon',
      texture: 'test',
      position: { x: 0, y: 2, z: 0 },
      size: { w: 1, h: 1 },
      yaw: 0,
      tint: '#ffae1a',
    },
  ],
  lights: [
    {
      position: { x: 0, y: 2, z: 0 },
      color: '#6dff4a',
      intensity: 10,
      range: 8,
    },
  ],
  decals: [
    {
      texture: 'test',
      position: { x: 0, y: 0, z: 0 },
      size: { w: 1, h: 1 },
      yaw: 0,
      surface: 'floor',
    },
  ],
  ambientFx: [{ kind: 'steam', position: { x: 0, y: 0, z: 0 } }],
  decor: [
    { model: 'city_ac', position: { x: 0, y: 2, z: 0 }, yaw: 1, scale: 2 },
  ],
};

it('pokój i arena przepuszczają oprawę, odrzucają zły kolor i nieznany materiał', () => {
  const room = roomDefinitions.get('combatYard')!;
  const data = {
    ...room,
    ...dressing,
    blocks: room.blocks.map((b) => ({ ...b, material: 'asphalt' })),
  };
  expect(loadRoom(data)).toMatchObject(dressing);
  expect(arenaLayoutSchema.parse({ ...arenaData, ...dressing })).toMatchObject(
    dressing,
  );
  expect(() =>
    loadRoom({ ...data, lights: [{ ...dressing.lights[0], color: 'cyan' }] }),
  ).toThrow();
  expect(() =>
    loadRoom({ ...data, blocks: [{ ...room.blocks[0], material: 'invalid' }] }),
  ).toThrow();
  expect(() =>
    arenaLayoutSchema.parse({
      ...arenaData,
      blocks: [{ ...arenaData.blocks[0], material: 'invalid' }],
    }),
  ).toThrow();
});

it('atmosfera przywraca tło, wysokość podłogi i motyw; panorama jest deterministyczna', () => {
  const scene = new Scene();
  const background = new Color('#ffffff');
  scene.background = background;
  scene.userData.reflectionFloorY = 7;
  const first = new SceneAtmosphere(scene, 'neonStreet', 'seed', 2);
  const matrices: number[][] = [];
  scene.traverse((o) => {
    if ('instanceMatrix' in o)
      matrices.push(
        Array.from((o as import('three').InstancedMesh).instanceMatrix.array),
      );
  });
  expect(matrices.length).toBeGreaterThan(0);
  first.dispose();
  expect(scene.children).toHaveLength(0);
  expect(scene.background).toBe(background);
  expect(scene.userData.reflectionFloorY).toBe(7);
  expect(tuning.render).toEqual(defaults);
  const second = new SceneAtmosphere(scene, 'neonStreet', 'seed', 2);
  const again: number[][] = [];
  scene.traverse((o) => {
    if ('instanceMatrix' in o)
      again.push(
        Array.from((o as import('three').InstancedMesh).instanceMatrix.array),
      );
  });
  expect(again).toEqual(matrices);
  second.dispose();
});

it('normalne kodują mokry materiał i zawsze przywracają materiały po błędzie GPU', () => {
  const scene = new Scene();
  const mesh = new Mesh(new BoxGeometry(), getMaterial('asphalt'));
  scene.add(mesh);
  const original = mesh.material;
  const pass = new WetNormals();
  const renderer = {
    render: () => {
      const shader = {
        uniforms: {},
        vertexShader: ShaderLib.normal.vertexShader,
        fragmentShader: ShaderLib.normal.fragmentShader,
      } as WebGLProgramParametersWithUniforms;
      mesh.material.onBeforeCompile(
        shader,
        renderer as unknown as WebGLRenderer,
      );
      expect(shader.fragmentShader).toContain('gl_FragColor.a = 1.0000;');
      throw new Error('GPU');
    },
  };
  expect(() =>
    pass.render(
      renderer as unknown as WebGLRenderer,
      scene,
      new PerspectiveCamera(),
    ),
  ).toThrow('GPU');
  expect(mesh.material).toBe(original);
  expect(scene.overrideMaterial).toBeNull();
  pass.dispose();
  mesh.geometry.dispose();
});

it('neon dodaje tylko trzy passy odbić w 1/2, a white nie tworzy ich ani nie renderuje', () => {
  let target: WebGLRenderTarget | null = null;
  const sizes: string[] = [];
  const renderer = {
    autoClear: true,
    clippingPlanes: [],
    getSize: (v: Vector2) => v.set(320, 180),
    getPixelRatio: () => 1,
    getDrawingBufferSize: (v: Vector2) => v.set(320, 180),
    getRenderTarget: () => target,
    setRenderTarget: (t: WebGLRenderTarget | null) => {
      target = t;
    },
    getClearColor: (c: Color) => c.set('#000000'),
    getClearAlpha: () => 1,
    setClearColor: () => {},
    render: () => {
      sizes.push(target ? `${target.width}x${target.height}` : 'screen');
    },
  };
  const pipeline = createRenderPipeline(renderer as unknown as WebGLRenderer);
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  camera.position.y = 2;
  pipeline.render(scene, camera, 0.016);
  expect(sizes).toHaveLength(8);
  sizes.length = 0;
  const restore = applyTheme(themeDefinitions.get('neonStreet')!);
  pipeline.render(scene, camera, 0.016);
  expect(sizes).toHaveLength(11);
  expect(sizes.filter((s) => s === '160x90')).toHaveLength(4);
  expect(renderer.clippingPlanes).toEqual([]);
  expect(scene.overrideMaterial).toBeNull();
  restore();
  sizes.length = 0;
  pipeline.render(scene, camera, 0.016);
  expect(sizes).toHaveLength(8);
  pipeline.dispose();
});
