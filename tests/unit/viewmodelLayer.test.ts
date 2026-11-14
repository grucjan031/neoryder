import { afterEach, expect, it, vi } from 'vitest';
import {
  AmbientLight,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
} from 'three';
import type { WebGLRenderer } from 'three';
import { EventBus } from '../../src/core/events';
import { FppViewModel } from '../../src/render/fppViewModel';
import {
  VIEWMODEL_LAYER,
  applyViewmodelLayer,
  registerViewmodel,
  renderWithViewmodel,
} from '../../src/render/viewmodelLayer';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
});

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
  const renderer = { render: vi.fn(), autoClear: true };
  const scene = new Scene();
  renderWithViewmodel(
    renderer as unknown as WebGLRenderer,
    scene,
    new PerspectiveCamera(),
  );
  expect(renderer.render).toHaveBeenCalledTimes(2);
  view.dispose();
  renderer.render.mockClear();
  renderWithViewmodel(
    renderer as unknown as WebGLRenderer,
    scene,
    new PerspectiveCamera(),
  );
  expect(renderer.render).toHaveBeenCalledTimes(1);
});

it('drugi przebieg ściska głębię, nie czyści celu i przywraca kamerę oraz scenę', () => {
  cleanup.push(registerViewmodel(new Group()));
  const scene = new Scene();
  scene.background = new Color('#ffffff');
  const light = new AmbientLight();
  scene.add(light);
  const camera = new PerspectiveCamera(90, 1, 0.1, 100);
  camera.updateProjectionMatrix();
  const original = [...camera.projectionMatrix.elements];
  const seen: {
    mask: number;
    autoClear: boolean;
    background: unknown;
    z: number;
  }[] = [];
  const renderer = {
    autoClear: true,
    render: vi.fn((s: Scene, c: PerspectiveCamera) => {
      seen.push({
        mask: c.layers.mask,
        autoClear: renderer.autoClear,
        background: s.background,
        z: c.projectionMatrix.elements[14]!,
      });
    }),
  };
  renderWithViewmodel(renderer as unknown as WebGLRenderer, scene, camera);
  expect(seen).toHaveLength(2);
  expect(seen[0]).toMatchObject({ mask: 1, autoClear: true });
  expect(seen[0]?.background).not.toBeNull();
  expect(seen[1]).toMatchObject({
    mask: 1 << VIEWMODEL_LAYER,
    autoClear: false,
    background: null,
  });
  expect(seen[1]?.z).not.toBe(original[14]);
  expect(light.layers.isEnabled(VIEWMODEL_LAYER)).toBe(true);
  expect([...camera.projectionMatrix.elements]).toEqual(original);
  expect(camera.layers.mask).toBe(1);
  expect(renderer.autoClear).toBe(true);
  expect(scene.background).not.toBeNull();
});
