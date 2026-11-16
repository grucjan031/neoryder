import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  DepthTexture,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderLib,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { BloomPass } from '../../src/render/bloom';
import { createRenderPipeline } from '../../src/render/outline';
import {
  applyViewmodelLayer,
  registerViewmodel,
} from '../../src/render/viewmodelLayer';
import { tuning } from '../../src/core/tuning';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  vi.restoreAllMocks();
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  const renderer = {
    autoClear: true,
    getSize: (out: Vector2) => out.set(321, 181),
    getPixelRatio: () => 1,
    getDrawingBufferSize: (out: Vector2) => out.set(321, 181),
    getRenderTarget: () => target,
    setRenderTarget: (next: WebGLRenderTarget | null) => {
      target = next;
    },
    getClearColor: (out: Color) => out.set(0),
    getClearAlpha: () => 0,
    setClearColor: vi.fn(),
    render: vi.fn(),
  };
  const gpu = renderer as unknown as WebGLRenderer;
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const color = new WebGLRenderTarget(321, 181, {
    depthTexture: new DepthTexture(321, 181),
  });
  const pass = new BloomPass(321, 181);
  return { renderer, gpu, scene, camera, color, pass };
}

function compile(material: Material, gpu: WebGLRenderer) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: ShaderLib.basic.vertexShader,
    fragmentShader: ShaderLib.basic.fragmentShader,
  };
  material.onBeforeCompile(
    shader as Parameters<Material['onBeforeCompile']>[0],
    gpu,
  );
  return shader;
}

it('rysuje tylko emisję, także w grupach materiałów i pod nieemisyjnym rodzicem', () => {
  const f = fixture();
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const glow = new MeshBasicMaterial({
    color: 0xff0000,
    alphaTest: 0.4,
    map: new Texture(),
    alphaMap: new Texture(),
  });
  const child = new Mesh(new BoxGeometry(), glow);
  wall.add(child);
  const mixed = new InstancedMesh(new BoxGeometry(), [wall.material, glow], 2);
  f.scene.add(wall, mixed);
  let firstArray: Material[] | undefined;
  let firstGlow: Material | undefined;
  let frames = 0;
  f.renderer.render.mockImplementation((scene: Scene) => {
    if (scene !== f.scene) return;
    frames++;
    expect(wall.visible).toBe(true);
    expect(wall.material.visible).toBe(false);
    expect(mixed.material[0]!.visible).toBe(false);
    expect(child.material).toMatchObject({
      visible: true,
      depthTest: true,
      depthWrite: false,
      alphaTest: 0.4,
    });
    expect(child.material.map).toBe(glow.map);
    expect(child.material.alphaMap).toBe(glow.alphaMap);
    if (firstArray) {
      expect(mixed.material).toBe(firstArray);
      expect(child.material).toBe(firstGlow);
    }
    firstArray = mixed.material;
    firstGlow = child.material;
    const shader = compile(child.material, f.gpu);
    expect(shader.uniforms.bloomColorDepth!.value).toBe(f.color.depthTexture);
    expect(shader.uniforms.bloomColorSize!.value).toEqual(
      new Vector2(321, 181),
    );
    expect(shader.uniforms.bloomMaskSize!.value).toEqual(new Vector2(160, 90));
    expect(shader.fragmentShader).toContain(
      'texture2D(bloomColorDepth, bloomSampleUv)',
    );
    expect(shader.fragmentShader).toContain('discard;');
    expect(shader.fragmentShader).toContain('#include <alphatest_fragment>');
    expect(shader.fragmentShader).toContain('#include <alphamap_fragment>');
  });
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(frames).toBe(2);
  expect(child.material).toBe(glow);
  expect(glow.depthWrite).toBe(true);
  f.pass.dispose();
});

it('uwzględnia zmianę flagi, koloru, uniformów, dodanie i usunięcie obiektu', () => {
  const f = fixture();
  const source = new ShaderMaterial({ uniforms: { time: { value: 1 } } });
  source.userData.bloom = true;
  const mesh = new Mesh(new BoxGeometry(), source);
  f.scene.add(mesh);
  let selected: Material | undefined;
  let draws = 0;
  f.renderer.render.mockImplementation((scene: Scene) => {
    if (scene !== f.scene) return;
    scene.traverseVisible((object) => {
      if (object instanceof Mesh && object.material.visible) {
        draws++;
        selected = object.material;
      }
    });
  });
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(draws).toBe(1);
  const variant = selected as ShaderMaterial;
  expect(variant.uniforms).toBe(source.uniforms);
  source.userData.bloom = false;
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(draws).toBe(1);
  source.userData.bloom = true;
  source.opacity = 0.3;
  source.uniforms.time!.value = 9;
  source.needsUpdate = true;
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(selected).toBe(variant);
  expect(variant.opacity).toBe(0.3);
  expect(variant.uniforms.time!.value).toBe(9);
  expect(variant.version).toBeGreaterThan(0);
  f.scene.remove(mesh);
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(draws).toBe(2);
  const added = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({ color: 0x00ff00 }),
  );
  f.scene.add(added);
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(draws).toBe(3);
  added.material.color.set(0xffffff);
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(draws).toBe(3);
  f.pass.dispose();
});

it('zachowuje proceduralny bloomMaterial oraz pomija nieemisyjny deszcz', () => {
  const f = fixture();
  const glow = new MeshBasicMaterial();
  glow.onBeforeCompile = (shader) => {
    shader.fragmentShader += '\n// procedural emission';
  };
  glow.customProgramCacheKey = () => 'facadeEmission';
  const source = new MeshBasicMaterial();
  source.userData.bloomMaterial = glow;
  const facade = new Mesh(new BoxGeometry(), source);
  const rain = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({ transparent: true, depthWrite: false }),
  );
  const holo = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      depthWrite: false,
    }),
  );
  f.scene.add(facade, rain, holo);
  f.renderer.render.mockImplementation((scene: Scene) => {
    if (scene !== f.scene) return;
    expect(rain.material.visible).toBe(false);
    expect(holo.material).toMatchObject({
      visible: true,
      transparent: true,
      depthWrite: false,
    });
    const shader = compile(facade.material, f.gpu);
    expect(shader.fragmentShader).toContain('// procedural emission');
    expect(facade.material.customProgramCacheKey()).toContain('facadeEmission');
  });
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  expect(f.renderer.render).toHaveBeenCalledTimes(5);
  f.pass.dispose();
});

it('pipeline przekazuje głębię koloru, zmienia jej rozmiar i ją zwalnia', () => {
  const f = fixture();
  const pipeline = createRenderPipeline(f.gpu);
  const neon = new Mesh(
    new BoxGeometry(),
    new MeshBasicMaterial({ color: 0xff0000 }),
  );
  f.scene.add(neon);
  let colorTarget: WebGLRenderTarget | null = null;
  let verified = false;
  f.renderer.render.mockImplementation((scene: Scene) => {
    if (scene !== f.scene) return;
    if (!colorTarget) colorTarget = f.renderer.getRenderTarget();
    if (!neon.material.depthWrite) {
      const shader = compile(neon.material, f.gpu);
      expect(shader.uniforms.bloomColorDepth!.value).toBe(
        colorTarget!.depthTexture,
      );
      expect(colorTarget!.width).toBe(321);
      verified = true;
    }
  });
  pipeline.render(f.scene, f.camera, 0);
  expect(verified).toBe(true);
  pipeline.setSize(640, 360);
  expect(colorTarget!.width).toBe(640);
  expect(colorTarget!.height).toBe(360);
  const dispose = vi.spyOn(DepthTexture.prototype, 'dispose');
  pipeline.dispose();
  expect(dispose).toHaveBeenCalledTimes(2);
  f.pass.dispose();
});

it('zwalnia wariant po dispose źródła i nie zwalnia źródła wraz z passem', () => {
  const f = fixture();
  const source = new MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new Mesh(new BoxGeometry(), source);
  f.scene.add(mesh);
  let variant: Material | undefined;
  f.renderer.render.mockImplementation((scene: Scene) => {
    if (scene === f.scene) variant = mesh.material;
  });
  f.pass.render(f.gpu, f.scene, f.camera, f.color);
  const release = vi.spyOn(variant!, 'dispose');
  const sourceRelease = vi.spyOn(source, 'dispose');
  source.dispose();
  expect(release).toHaveBeenCalledTimes(1);
  f.pass.dispose();
  expect(sourceRelease).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

it('viewmodel zachowuje oryginalną emisję i własne zasłony ze ściśniętą głębią', () => {
  const f = fixture();
  const root = new Group();
  const source = new MeshBasicMaterial({ color: 0xff0000 });
  const neon = new Mesh(new BoxGeometry(), source);
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  root.add(neon, wall);
  applyViewmodelLayer(root);
  const unregister = registerViewmodel(root);
  f.scene.add(root);
  const original = f.camera.projectionMatrix.clone();
  let checked = false;
  f.renderer.render.mockImplementation(
    (scene: Scene, camera: PerspectiveCamera) => {
      if (scene !== f.scene || camera.layers.mask !== 2) return;
      expect(neon.material).toBe(source);
      expect(wall.material).toMatchObject({ opacity: 0, depthWrite: true });
      expect(camera.projectionMatrix.equals(original)).toBe(false);
      checked = true;
    },
  );
  try {
    f.pass.render(f.gpu, f.scene, f.camera, f.color);
    expect(checked).toBe(true);
    expect(f.camera.projectionMatrix.equals(original)).toBe(true);
  } finally {
    unregister();
    f.pass.dispose();
  }
});

it('przy błędzie przywraca materiały, tło i override, także dla tablic', () => {
  const f = fixture();
  const materials = [
    new MeshBasicMaterial(),
    new MeshBasicMaterial({ color: 0xff0000 }),
  ];
  const mesh = new Mesh(new BoxGeometry(), materials);
  f.scene.add(mesh);
  const background = new Color(0x123456);
  const override = new MeshBasicMaterial();
  f.scene.background = background;
  f.scene.overrideMaterial = override;
  f.renderer.render.mockImplementation(() => {
    throw new Error('GPU');
  });
  expect(() => f.pass.render(f.gpu, f.scene, f.camera, f.color)).toThrow('GPU');
  expect(mesh.material).toBe(materials);
  expect(f.scene.background).toBe(background);
  expect(f.scene.overrideMaterial).toBe(override);
  f.pass.dispose();
});
