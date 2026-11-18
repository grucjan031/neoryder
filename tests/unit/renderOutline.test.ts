import { afterEach, expect, it, vi } from 'vitest';
import {
  Color,
  HalfFloatType,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { tuning } from '../../src/core/tuning';
import {
  createRenderPipeline,
  inkAt,
  outlineFadeAt,
  SKY_BACKGROUND_ORDER,
  skyBackgroundFragment,
} from '../../src/render/outline';
import { getMaterial, syncMaterials } from '../../src/render/materials';
import { applyLookPreset, LOOK_PRESETS } from '../../src/render/lookPresets';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  applyLookPreset('?look=off');
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

it('przekazuje wygaszanie konturu z odległością do kompozycji', () => {
  const { renderer, pipeline } = fixture();
  let composite: ShaderMaterial | undefined;
  renderer.render.mockImplementation((rendered: Scene) => {
    const quad = rendered.children[0];
    if (quad instanceof Mesh && quad.material instanceof ShaderMaterial)
      composite = quad.material;
  });
  Object.assign(tuning.render, {
    outlineFadeNear: 5,
    outlineFadeFar: 18,
    outlineFarNormal: 0.25,
    outlineFarOuter: 0.5,
  });
  pipeline.render(new Scene(), new PerspectiveCamera());
  expect(composite).toBeDefined();
  const uniforms = composite!.uniforms;
  expect(uniforms.outlineFadeNear!.value).toBe(5);
  expect(uniforms.outlineFadeFar!.value).toBe(18);
  expect(uniforms.outlineFarNormal!.value).toBe(0.25);
  expect(uniforms.outlineFarOuter!.value).toBe(0.5);
  // Linie normalnych gasną z odległością, a obrys głębi zostaje po stronie tła.
  const shader = composite!.fragmentShader;
  expect(shader).toContain('smoothstep(outlineFadeNear');
  expect(shader).toContain('1.0 - far * (1.0 - outlineFarNormal)');
  expect(shader).toContain('mix(1.0, behind, far * outlineFarOuter)');
  pipeline.dispose();
});

it('wzór wygaszania: bliskie bez zmian, dalekie bez linii wewnątrz bryły', () => {
  const fade = {
    outlineFadeNear: tuning.render.outlineFadeNear,
    outlineFadeFar: tuning.render.outlineFadeFar,
    outlineFarNormal: tuning.render.outlineFarNormal,
    outlineFarOuter: tuning.render.outlineFarOuter,
  };
  expect(outlineFadeAt(3, fade)).toEqual({ far: 0, normal: 1, depthInside: 1 });
  const mid = outlineFadeAt(10, fade);
  expect(mid.far).toBeCloseTo(0.352, 3);
  expect(mid.normal).toBeCloseTo(0.648, 3);
  expect(mid.depthInside).toBeCloseTo(0.648, 3);
  expect(outlineFadeAt(20, fade)).toEqual({
    far: 1,
    normal: 0,
    depthInside: 0,
  });
  // Dolna granica dalekich linii i wyłączenie efektu.
  expect(
    outlineFadeAt(20, { ...fade, outlineFarNormal: 0.4 }).normal,
  ).toBeCloseTo(0.4);
  expect(
    outlineFadeAt(20, { ...fade, outlineFarNormal: 1, outlineFarOuter: 0 }),
  ).toEqual({ far: 1, normal: 1, depthInside: 1 });
});

it.each(['a', 'b', 'c'] as const)(
  'tusz %s skaluje promień perspektywicznie i zatrzymuje dylatację poniżej pół piksela',
  (look) => {
    const ink = { ...defaults, ...LOOK_PRESETS[look] };
    expect(inkAt(0, ink).radius).toBeCloseTo(ink.inkWidth * ink.inkNearScale);
    expect(inkAt(1, ink).radius).toBeCloseTo(ink.inkWidth * ink.inkNearScale);
    expect(inkAt(ink.inkRefDistanceM, ink).radius).toBe(ink.inkWidth);
    expect(inkAt(8, ink).radius).toBeCloseTo(ink.inkWidth / 2);
    expect(inkAt(12, ink).radius).toBeLessThan(inkAt(8, ink).radius);
    expect(inkAt(100, ink).radius).toBeCloseTo(ink.inkWidth * ink.inkMinScale);
    expect(inkAt(1000, ink).radius).toBe(inkAt(100, ink).radius);
    const subpixel = { ...ink, inkWidth: 1.9 };
    expect(inkAt(8, subpixel).dilation).toBeGreaterThan(0);
    expect(inkAt(16, subpixel).dilation).toBe(0);
    expect(inkAt(16, subpixel).opacity).toBe(1);
  },
);

it('maska sylwetki 1 px słabnie dopiero po progu, a detale są cieńsze i gasną wcześniej', () => {
  const ink = { ...defaults, ...LOOK_PRESETS.b };
  expect(inkAt(ink.inkFadeNearM, ink).opacity).toBe(1);
  expect(
    inkAt((ink.inkFadeNearM + ink.inkFadeFarM) / 2, ink).opacity,
  ).toBeCloseTo(0.5);
  expect(inkAt(ink.inkFadeFarM, ink).opacity).toBe(0);
  expect(inkAt(200, ink).opacity).toBe(0);
  const near = inkAt(4, ink);
  expect(near.normalRadius).toBeCloseTo(near.radius * 0.55);
  expect(near.normalRadius).toBeLessThan(near.radius);
  expect(near.normalOpacity).toBe(1);
  const middle = inkAt(16, ink);
  expect(middle.normalOpacity).toBeCloseTo(0.5);
  expect(middle.normalOpacity).toBeLessThan(middle.opacity);
  expect(middle.normalDilation).toBe(0);
  expect(inkAt(24, ink).normalOpacity).toBe(0);
  expect(inkAt(24, ink).opacity).toBe(1);
});

it('przekazuje strojenie tuszu do obu przebiegów i zachowuje osobny dawny tusz FPP', () => {
  const { renderer, pipeline } = fixture();
  const passes: ShaderMaterial[] = [];
  const targets: (WebGLRenderTarget | null)[] = [];
  renderer.render.mockImplementation((rendered: Scene) => {
    const quad = rendered.children[0];
    if (quad instanceof Mesh && quad.material instanceof ShaderMaterial) {
      passes.push(quad.material);
      targets.push(renderer.getRenderTarget());
    }
  });
  applyLookPreset('?look=b');
  tuning.render.bloom = 0;
  tuning.render.postFx = 0;
  tuning.render.inkRefDistanceM = 5;
  tuning.render.skyGradient = 0;
  tuning.render.inkMinScale = 0.2;
  pipeline.render(new Scene(), new PerspectiveCamera());
  expect(passes).toHaveLength(2);
  expect(targets[0]?.texture.type).toBe(HalfFloatType);
  const keys = [
    'inkWidth',
    'inkNearScale',
    'inkRefDistanceM',
    'inkMinScale',
    'inkDilationMinPx',
    'inkFadeNearM',
    'inkFadeFarM',
    'inkNormalScale',
    'inkNormalFadeNearM',
    'inkNormalFadeFarM',
    'inkViewmodelWidth',
    'inkViewmodelMaxRadiusPx',
  ] as const;
  for (const pass of passes)
    for (const key of keys)
      expect(pass.uniforms[key]?.value).toBe(tuning.render[key]);
  const composite = passes[1]!;
  expect(composite.fragmentShader).toContain('if (viewmodelInk)');
  expect(composite.fragmentShader).toContain(
    'inkViewmodelWidth * mix(1.0, inkNearScale, inkNear)',
  );
  expect(composite.uniforms.inkViewmodelWidth?.value).toBe(2.2);
  expect(composite.uniforms.inkViewmodelMaxRadiusPx?.value).toBe(1.2);
  pipeline.dispose();
});

it('look=off zachowuje dawny kontur i nie uruchamia przebiegu tuszu', () => {
  const { renderer, pipeline } = fixture();
  const before = { ...tuning.render };
  applyLookPreset('?look=off');
  expect(tuning.render).toEqual(before);
  tuning.render.bloom = 0;
  tuning.render.postFx = 0;
  pipeline.render(new Scene(), new PerspectiveCamera());
  expect(renderer.render).toHaveBeenCalledTimes(3);
  pipeline.dispose();
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
