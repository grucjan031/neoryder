import { afterEach, expect, it, vi } from 'vitest';
import {
  AmbientLight,
  Color,
  DepthTexture,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { FppViewModel } from '../../src/render/fppViewModel';
import {
  VIEWMODEL_LAYER,
  applyViewmodelLayer,
  registerViewmodel,
  renderWithViewmodel,
  viewmodelFov,
} from '../../src/render/viewmodelLayer';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  const renderer = {
    autoClear: true,
    clearDepth: vi.fn(),
    getRenderTarget: () => target,
    setRenderTarget: vi.fn((next: WebGLRenderTarget) => {
      target = next;
    }),
    render: vi.fn<(scene: Scene, camera: PerspectiveCamera) => void>(),
    shadowMap: { autoUpdate: true, needsUpdate: true },
  };
  return { renderer, gpu: renderer as unknown as WebGLRenderer };
}

it('applyViewmodelLayer ustawia warstwę na korzeniu i późniejszych potomkach', () => {
  const root = new Group();
  applyViewmodelLayer(root);
  const late = new Mesh();
  root.add(new Group().add(late));
  applyViewmodelLayer(root);
  for (const object of [root, late]) {
    expect(object.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
    expect(object.layers.isEnabled(0)).toBe(false);
  }
});

it('FppViewModel oznacza wszystko warstwą po place() i wyrejestrowuje się w dispose()', () => {
  const view = new FppViewModel(new EventBus(), 1);
  const child = new Mesh();
  view.root.add(child);
  view.place(new PerspectiveCamera().matrixWorld, 1 / 60, {
    held: 'gun',
    horizontalSpeed: 0,
  });
  expect(child.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
  const { renderer, gpu } = fixture();
  const scene = new Scene();
  renderWithViewmodel(gpu, scene, new PerspectiveCamera());
  expect(renderer.render).toHaveBeenCalledTimes(2);
  view.dispose();
  renderer.render.mockClear();
  renderWithViewmodel(gpu, scene, new PerspectiveCamera());
  expect(renderer.render).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'oddziela głębię przed rysowaniem rąk i przywraca stan (tekstura: %s)',
  (useTexture) => {
    const scene = new Scene();
    const root = new Group();
    scene.add(root);
    cleanup.push(registerViewmodel(root));
    scene.background = new Color('#ffffff');
    const light = new AmbientLight();
    scene.add(light);
    const camera = new PerspectiveCamera(90, 1, 0.6, 100);
    const projection = camera.projectionMatrix.clone();
    const inverse = camera.projectionMatrixInverse.clone();
    const wall = new Vector3(0, 0, -camera.near);
    const hand = new Vector3(0.08, -0.08, -0.15);
    const depth = new DepthTexture(16, 16);
    const target = new WebGLRenderTarget(16, 16, { depthTexture: depth });
    const foreground = useTexture ? new DepthTexture(16, 16) : undefined;
    const { renderer, gpu } = fixture();
    renderer.setRenderTarget(target);
    renderer.render
      .mockImplementationOnce(() => {
        expect(camera.layers.mask).toBe(1);
        expect(wall.clone().project(camera).z).toBeCloseTo(-1);
        expect(renderer.clearDepth).not.toHaveBeenCalled();
        expect(target.depthTexture).toBe(depth);
        renderer.shadowMap.needsUpdate = false;
      })
      .mockImplementationOnce(() => {
        expect(camera.layers.mask).toBe(1 << VIEWMODEL_LAYER);
        expect(renderer.clearDepth).toHaveBeenCalledOnce();
        expect(camera.near).toBe(tuning.camera.viewmodelNearM);
        expect(hand.clone().project(camera).z).toBeGreaterThan(-1);
        expect(target.depthTexture).toBe(foreground ?? depth);
        expect(renderer.shadowMap).toEqual({
          autoUpdate: false,
          needsUpdate: false,
        });
        expect(renderer.autoClear).toBe(false);
        expect(scene.background).toBeNull();
        expect(scene.matrixWorldAutoUpdate).toBe(false);
      });

    renderWithViewmodel(gpu, scene, camera, foreground);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(light.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
    expect(camera.near).toBe(0.6);
    expect(camera.projectionMatrix.equals(projection)).toBe(true);
    expect(camera.projectionMatrixInverse.equals(inverse)).toBe(true);
    expect(camera.layers.mask).toBe(1);
    expect(renderer.shadowMap).toEqual({
      autoUpdate: true,
      needsUpdate: false,
    });
    expect(renderer.autoClear).toBe(true);
    expect(scene.background).not.toBeNull();
    expect(scene.matrixWorldAutoUpdate).toBe(true);
    expect(target.depthTexture).toBe(depth);
    expect(renderer.getRenderTarget()).toBe(target);
    target.dispose();
    foreground?.dispose();
  },
);

it('FOV viewmodelu z tuningu obowiązuje tylko w przebiegu rąk, a 0 oznacza FOV świata', () => {
  const scene = new Scene();
  const root = new Group();
  scene.add(root);
  cleanup.push(registerViewmodel(root));
  const camera = new PerspectiveCamera(75, 1, 0.1, 100);
  const original = tuning.camera.viewmodelFov;
  const seen: number[] = [];
  const { renderer, gpu } = fixture();
  renderer.render.mockImplementation((_s, c) => {
    seen.push(c.fov);
  });
  try {
    expect(viewmodelFov(camera)).toBe(75);
    tuning.camera.viewmodelFov = 60;
    expect(viewmodelFov(camera)).toBe(60);
    renderWithViewmodel(gpu, scene, camera);
    expect(seen).toEqual([75, 60]);
    expect(camera.fov).toBe(75);
    tuning.camera.viewmodelFov = 500;
    expect(viewmodelFov(camera)).toBe(120);
  } finally {
    tuning.camera.viewmodelFov = original;
  }
});
