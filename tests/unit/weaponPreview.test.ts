// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';

const renderer = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
  setSize: vi.fn(),
  setPixelRatio: vi.fn(),
  setClearColor: vi.fn(),
}));
vi.mock('three', async (importOriginal) => ({
  ...(await importOriginal<typeof import('three')>()),
  WebGLRenderer: class {
    render = renderer.render;
    dispose = renderer.dispose;
    forceContextLoss = renderer.forceContextLoss;
    setSize = renderer.setSize;
    setPixelRatio = renderer.setPixelRatio;
    setClearColor = renderer.setClearColor;
  },
}));

const loader = vi.hoisted(() => ({ loadWeaponScene: vi.fn() }));
vi.mock('../../src/render/weaponModelLoader', () => ({
  FALLBACK_WEAPON_MODEL: 'blaster',
  loadWeaponScene: loader.loadWeaponScene,
}));
const attach = vi.hoisted(() => ({ attachModuleVisuals: vi.fn() }));
vi.mock('../../src/render/weaponModuleVisuals', () => attach);

import {
  WeaponPreview,
  canCreateWeaponPreview,
} from '../../src/render/weaponPreview';

let frames: FrameRequestCallback[] = [];
const runFrame = (time: number) => {
  const queue = frames;
  frames = [];
  for (const callback of queue) callback(time);
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function modelScene(): { scene: Group; geometry: BoxGeometry } {
  const geometry = new BoxGeometry(0.1, 0.1, 0.4);
  const scene = new Group();
  scene.add(new Mesh(geometry, new MeshBasicMaterial()));
  return { scene, geometry };
}

function pointer(type: string, x: number, y: number): Event {
  return Object.assign(new Event(type), {
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  loader.loadWeaponScene.mockReset();
  attach.attachModuleVisuals.mockReset();
});

describe('WeaponPreview', () => {
  it('bez WebGL2 (jsdom) podgląd nie jest dostępny', () => {
    expect(canCreateWeaponPreview()).toBe(false);
  });

  it('show ładuje model, nakłada moduły na klonie i renderuje tylko przy zmianie', async () => {
    const { scene } = modelScene();
    loader.loadWeaponScene.mockResolvedValue(scene);
    const detach = vi.fn();
    attach.attachModuleVisuals.mockReturnValue(detach);
    const preview = new WeaponPreview(document.createElement('canvas'));
    await preview.show('blaster', ['pierce']);
    expect(attach.attachModuleVisuals).toHaveBeenCalledTimes(1);
    const [target, modules] = attach.attachModuleVisuals.mock.calls[0]!;
    expect(target).not.toBe(scene);
    expect(modules).toEqual(['pierce']);
    runFrame(16);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    await preview.show('blaster', []);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(loader.loadWeaponScene).toHaveBeenCalledTimes(1);
    preview.dispose();
  });

  it('po pokazaniu czeka 3 s, potem obraca się sam; po dotyku znowu czeka 3 s', async () => {
    loader.loadWeaponScene.mockResolvedValue(modelScene().scene);
    attach.attachModuleVisuals.mockReturnValue(() => {});
    const canvas = document.createElement('canvas');
    const preview = new WeaponPreview(canvas);
    await preview.show('blaster', []);
    runFrame(0);
    renderer.render.mockClear();
    // Nowa broń/moduł: kadr 3/4 stoi przez 3 s, żeby zmiana była widoczna.
    for (let t = 100; t <= 2900; t += 100) runFrame(t);
    expect(renderer.render).not.toHaveBeenCalled();
    for (let t = 3000; t <= 3600; t += 100) runFrame(t);
    expect(renderer.render.mock.calls.length).toBeGreaterThanOrEqual(5);
    renderer.render.mockClear();
    canvas.dispatchEvent(pointer('pointerdown', 0, 0));
    for (let t = 3600; t <= 5000; t += 100) runFrame(t);
    expect(renderer.render).not.toHaveBeenCalled();
    canvas.dispatchEvent(pointer('pointermove', 40, 500));
    runFrame(5100);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(pointer('pointerup', 40, 500));
    renderer.render.mockClear();
    for (let t = 5200; t <= 7900; t += 100) runFrame(t);
    // Powrót nachylenia może rysować, ale bez obrotu liczba klatek jest mała.
    const early = renderer.render.mock.calls.length;
    for (let t = 8000; t <= 8500; t += 100) runFrame(t);
    expect(renderer.render.mock.calls.length).toBeGreaterThanOrEqual(early + 5);
    preview.dispose();
  });

  it('ograniczenie ruchu wyłącza autoobrót', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    loader.loadWeaponScene.mockResolvedValue(modelScene().scene);
    attach.attachModuleVisuals.mockReturnValue(() => {});
    const preview = new WeaponPreview(document.createElement('canvas'));
    await preview.show('blaster', []);
    runFrame(0);
    renderer.render.mockClear();
    for (let t = 100; t <= 8000; t += 100) runFrame(t);
    expect(renderer.render).not.toHaveBeenCalled();
    preview.dispose();
  });

  it('brak modelu broni używa blastera', async () => {
    loader.loadWeaponScene.mockRejectedValueOnce(new Error('404'));
    loader.loadWeaponScene.mockResolvedValueOnce(modelScene().scene);
    attach.attachModuleVisuals.mockReturnValue(() => {});
    const preview = new WeaponPreview(document.createElement('canvas'));
    await preview.show('rifle', []);
    expect(loader.loadWeaponScene).toHaveBeenCalledTimes(2);
    expect(loader.loadWeaponScene.mock.calls[1]![0]).toBe('blaster');
    expect(attach.attachModuleVisuals).toHaveBeenCalledTimes(1);
    preview.dispose();
  });

  it('dispose zatrzymuje pętlę i zwalnia renderer oraz geometrie', async () => {
    const { scene, geometry } = modelScene();
    loader.loadWeaponScene.mockResolvedValue(scene);
    const detach = vi.fn();
    attach.attachModuleVisuals.mockReturnValue(detach);
    const spy = vi.spyOn(geometry, 'dispose');
    const preview = new WeaponPreview(document.createElement('canvas'));
    await preview.show('blaster', ['scope']);
    expect(frames).toHaveLength(1);
    preview.dispose();
    expect(frames).toHaveLength(0);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    renderer.render.mockClear();
    runFrame(100);
    await preview.show('blaster', []);
    await flush();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });

  it('stop i start sterują pętlą klatek', () => {
    const preview = new WeaponPreview(document.createElement('canvas'));
    expect(frames).toHaveLength(1);
    preview.stop();
    expect(frames).toHaveLength(0);
    preview.start();
    preview.start();
    expect(frames).toHaveLength(1);
    preview.dispose();
  });
});
