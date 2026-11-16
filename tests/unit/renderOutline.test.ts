import { afterEach, expect, it, vi } from 'vitest';
import {
  Color,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import {
  createRenderPipeline,
  SKY_BACKGROUND_ORDER,
  skyBackgroundFragment,
} from '../../src/render/outline';
import { getMaterial, syncMaterials } from '../../src/render/materials';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  syncMaterials();
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  const clearColor = new Color('#123456');
  let alpha = 0.5;
  const renderer = {
    autoClear: false,
    getSize: (out: Vector2) => out.set(320, 180),
    getPixelRatio: () => 2,
    getDrawingBufferSize: (out: Vector2) => out.set(640, 360),
    getRenderTarget: () => target,
    setRenderTarget: (value: WebGLRenderTarget | null) => {
      target = value;
    },
    getClearColor: (out: Color) => out.copy(clearColor),
    getClearAlpha: () => alpha,
    setClearColor: (color: Color | number, value: number) => {
      clearColor.set(color);
      alpha = value;
    },
    render: vi.fn(),
  };
  const pipeline = createRenderPipeline(renderer as unknown as WebGLRenderer);
  return { renderer, pipeline, clearColor };
}

it('wyłączenie obrysu pomija cele pośrednie i nadal synchronizuje paletę', () => {
  const { renderer, pipeline } = fixture();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const material = getMaterial('world');
  tuning.render.outline = 0;
  tuning.render.world = '#654321';
  pipeline.render(scene, camera);
  expect(renderer.render).toHaveBeenCalledExactlyOnceWith(scene, camera);
  expect(renderer.getRenderTarget()).toBeNull();
  expect(material.color.getHexString()).toBe('654321');
  pipeline.dispose();
});

it('rysuje kolor, normalne z głębią i kompozycję; przywraca stan i skaluje cele przez DPR', () => {
  const { renderer, pipeline, clearColor } = fixture();
  tuning.render.bloom = 0;
  tuning.render.postFx = 0;
  const scene = new Scene();
  const background = new Color('#ffffff');
  scene.background = background;
  const override = getMaterial('world');
  scene.overrideMaterial = override;
  const targets: (WebGLRenderTarget | null)[] = [];
  renderer.render.mockImplementation((rendered: Scene) => {
    targets.push(renderer.getRenderTarget());
    if (targets.length === 2) {
      expect(rendered.overrideMaterial).toBeInstanceOf(MeshNormalMaterial);
      expect(rendered.background).toBeNull();
    }
  });
  pipeline.render(scene, new PerspectiveCamera());
  expect(renderer.render).toHaveBeenCalledTimes(3);
  expect(targets[0]?.width).toBe(640);
  expect(targets[0]?.height).toBe(360);
  expect(targets[1]?.depthTexture).toBeDefined();
  expect(targets[2]).toBeNull();
  expect(scene.overrideMaterial).toBe(override);
  expect(scene.background).toBe(background);
  expect(clearColor.getHexString()).toBe('123456');
  expect(renderer.getClearAlpha()).toBe(0.5);
  expect(renderer.autoClear).toBe(false);
  const disposeColor = vi.spyOn(targets[0]!, 'dispose');
  const disposeNormal = vi.spyOn(targets[1]!, 'dispose');
  pipeline.setSize(100, 50);
  expect(targets[0]?.width).toBe(200);
  expect(targets[1]?.height).toBe(100);
  disposeColor.mockClear();
  disposeNormal.mockClear();
  pipeline.dispose();
  expect(disposeColor).toHaveBeenCalledOnce();
  expect(disposeNormal).toHaveBeenCalledOnce();
});

it('przywraca stan sceny i renderera także przy błędzie przebiegu normalnych', () => {
  const { renderer, pipeline, clearColor } = fixture();
  const scene = new Scene();
  const background = new Color('#ffffff');
  scene.background = background;
  const target = new WebGLRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw new Error('render failed');
    });
  expect(() => pipeline.render(scene, new PerspectiveCamera())).toThrow(
    'render failed',
  );
  expect(scene.background).toBe(background);
  expect(scene.overrideMaterial).toBeNull();
  expect(renderer.getRenderTarget()).toBe(target);
  expect(renderer.autoClear).toBe(false);
  expect(clearColor.getHexString()).toBe('123456');
  pipeline.dispose();
  target.dispose();
});

it('gradient nieba jest tłem przebiegu koloru przed przezroczystymi, kompozycja go nie nadpisuje', () => {
  const { renderer, pipeline } = fixture();
  tuning.render.bloom = 0;
  tuning.render.postFx = 0;
  tuning.render.skyGradient = 1;
  const scene = new Scene();
  const passes: { sky: boolean }[] = [];
  renderer.render.mockImplementation((rendered: Scene) => {
    passes.push({
      sky: rendered.children.includes(pipeline.skyBackground),
    });
  });
  pipeline.render(scene, new PerspectiveCamera());
  // Tylko przebieg koloru widzi tło nieba; normalne i kompozycja już nie.
  expect(passes.map((p) => p.sky)).toEqual([true, false, false]);
  expect(scene.children).not.toContain(pipeline.skyBackground);
  const sky = pipeline.skyBackground;
  expect(sky.renderOrder).toBe(SKY_BACKGROUND_ORDER);
  expect(sky.material.depthWrite).toBe(false);
  expect(sky.material.transparent).toBe(true);
  expect(sky.userData.noOutline).toBe(true);
  expect(sky.userData.bloom).toBe(false);
  expect(skyBackgroundFragment).toContain('skyGradient');
  // Kompozycja: na niebie tylko błysk, bez podmiany koloru gradientem i bez odzyskiwania nakładek.
  const composite = Reflect.get(pipeline, 'composite') as {
    material: { fragmentShader: string };
  };
  expect(composite.material.fragmentShader).not.toMatch(
    /uniform vec3 skyBackground|skyKeepOverlay|mix\(rgb, sky/,
  );
  passes.length = 0;
  tuning.render.skyGradient = 0;
  pipeline.render(scene, new PerspectiveCamera());
  expect(passes.map((p) => p.sky)).toEqual([false, false, false]);
  pipeline.dispose();
});
