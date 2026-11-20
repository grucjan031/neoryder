import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { isEmissive } from '../../src/render/bloom';
import { getMaterial, syncMaterials } from '../../src/render/materials';
import { createRenderPipeline } from '../../src/render/outline';
import { createUrbanMaterial } from '../../src/render/urbanMaterials';
import { PostFxState } from '../../src/render/postFx';

const defaults = { ...tuning.render };
afterEach(() => {
  Object.assign(tuning.render, defaults);
  syncMaterials();
  vi.restoreAllMocks();
});

function fixture() {
  let target: WebGLRenderTarget | null = null;
  const clearColor = new Color('#123456');
  const renderer = {
    autoClear: false,
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
    render: vi.fn(),
  };
  const pipeline = createRenderPipeline(renderer as unknown as WebGLRenderer);
  return { renderer, pipeline };
}

it('tuning.render ma pola bloomu, kompozycji, atmosfery i siatki', () => {
  for (const key of [
    'bloom',
    'postFx',
    'bloomStrength',
    'bloomRadius',
    'skyGradient',
    'fogStrength',
    'gridSize',
    'gridContrast',
    'gridLineWidth',
    'vignetteStrength',
    'damagePulseS',
    'damageAberration',
    'focusTint',
    'focusFadeInS',
  ] as const)
    expect(typeof tuning.render[key]).toBe('number');
  expect(tuning.render.skyTop).toMatch(/^#/);
  expect(tuning.render.fogColor).toMatch(/^#/);
});

it('przełączniki bloom i postFx omijają passy', () => {
  const { renderer, pipeline } = fixture();
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const calls = (): number => {
    renderer.render.mockClear();
    pipeline.render(scene, camera, 0.016);
    return renderer.render.mock.calls.length;
  };
  tuning.render.bloom = 0;
  tuning.render.postFx = 0;
  // kolor + normalne + kompozycja
  expect(calls()).toBe(3);
  tuning.render.bloom = 1;
  // + maska + cztery przebiegi rozmycia
  expect(calls()).toBe(8);
  tuning.render.bloomStrength = 0;
  expect(calls()).toBe(3);
  tuning.render.bloomStrength = defaults.bloomStrength;
  tuning.render.bloom = 0;
  tuning.render.postFx = 1;
  // bez impulsu winieta jest w kompozycji, bez dodatkowego passu
  expect(calls()).toBe(3);
  pipeline.fxState.hit(1);
  expect(calls()).toBe(4);
  tuning.render.postFx = 0;
  expect(calls()).toBe(3);
  pipeline.dispose();
});

it('maska bloomu pomija bryły nieświecące i przywraca materiały', () => {
  const { renderer, pipeline } = fixture();
  const scene = new Scene();
  const neon = new Mesh(new BoxGeometry(), getMaterial('player'));
  const wall = new Mesh(new BoxGeometry(), getMaterial('world'));
  scene.add(neon, wall);
  tuning.render.postFx = 0;
  let maskNeon: unknown;
  let maskWall: unknown;
  renderer.render.mockImplementation((rendered: Scene) => {
    if (renderer.render.mock.calls.length !== 3) return;
    expect(rendered.overrideMaterial).toBeNull();
    maskNeon = neon.material;
    maskWall = wall.material;
  });
  pipeline.render(scene, new PerspectiveCamera(), 0.016);
  expect(maskNeon).not.toBe(getMaterial('player'));
  expect(maskNeon).toMatchObject({ depthTest: true, depthWrite: false });
  expect(maskWall).not.toBe(getMaterial('world'));
  expect(maskWall).toMatchObject({
    visible: false,
  });
  expect(wall.material).toBe(getMaterial('world'));
  expect(neon.material).toBe(getMaterial('player'));
  pipeline.dispose();
});

it('isEmissive rozpoznaje neony, a biel, czerń i toon nie świecą', () => {
  expect(isEmissive(getMaterial('player'))).toBe(true);
  expect(isEmissive(getMaterial('power'))).toBe(true);
  expect(isEmissive(getMaterial('enemyGlow'))).toBe(true);
  expect(isEmissive(getMaterial('power').clone())).toBe(true);
  expect(isEmissive(getMaterial('world'))).toBe(false);
  expect(isEmissive(getMaterial('enemy'))).toBe(false);
  expect(isEmissive(getMaterial('interactive'))).toBe(false);
  expect(isEmissive(new MeshBasicMaterial({ color: '#ffffff' }))).toBe(false);
  expect(isEmissive(new MeshBasicMaterial({ color: '#ff2bd6' }))).toBe(true);
  expect(isEmissive(new MeshToonMaterial({ color: '#00e5ff' }))).toBe(false);
  const off = new MeshBasicMaterial({ color: '#00e5ff' });
  off.userData.bloom = false;
  expect(isEmissive(off)).toBe(false);
});

it('impuls obrażeń rośnie przy spadku HP gracza i wygasa w czasie', () => {
  const bus = new EventBus();
  const state = new PostFxState();
  const off = state.bind(bus);
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  bus.emit('health_changed', { id: 1, current: 100, max: 100 });
  expect(state.damage).toBe(0);
  bus.emit('health_changed', { id: 2, current: 10, max: 100 });
  expect(state.damage).toBe(0);
  bus.emit('health_changed', { id: 1, current: 90, max: 100 });
  const small = state.damage;
  expect(small).toBeCloseTo(
    tuning.render.damagePulseMin + 0.1 * tuning.render.damagePulseHpGain,
  );
  bus.emit('health_changed', { id: 1, current: 40, max: 100 });
  expect(state.damage).toBeGreaterThan(small);
  expect(state.damage).toBeLessThanOrEqual(1);
  state.update(tuning.render.damagePulseS / 2);
  expect(state.damage).toBeGreaterThan(0);
  expect(state.active).toBe(true);
  state.update(tuning.render.damagePulseS);
  expect(state.damage).toBe(0);
  expect(state.active).toBe(false);
  // leczenie nie wywołuje impulsu
  bus.emit('health_changed', { id: 1, current: 80, max: 100 });
  expect(state.damage).toBe(0);
  off();
  bus.emit('health_changed', { id: 1, current: 1, max: 100 });
  expect(state.damage).toBe(0);
});

it('Skupienie płynnie włącza i wyłącza odcień zdarzeniem focus', () => {
  const bus = new EventBus();
  const state = new PostFxState();
  state.bind(bus);
  bus.emit('focus', { worldScale: 0.3, durationS: 2 });
  state.update(tuning.render.focusFadeInS / 2);
  expect(state.focus).toBeCloseTo(0.5);
  state.update(1);
  expect(state.focus).toBe(1);
  bus.emit('focus', { worldScale: 1, durationS: 0 });
  state.update(tuning.render.focusFadeOutS / 2);
  expect(state.focus).toBeCloseTo(0.5);
  state.update(1);
  expect(state.focus).toBe(0);
});

it('dispose zwalnia cele i materiały bloomu oraz kompozycji i odpina zdarzenia', () => {
  const { pipeline } = fixture();
  const bus = new EventBus();
  pipeline.bindEvents(bus);
  pipeline.fxState.hit(1);
  pipeline.render(new Scene(), new PerspectiveCamera(), 0.016);
  const targets = vi.spyOn(WebGLRenderTarget.prototype, 'dispose');
  const materials = vi.spyOn(ShaderMaterial.prototype, 'dispose');
  pipeline.dispose();
  // kolor, normalne, krawędzie tuszu, maska, dwa rozmycia, wejście passu impulsów
  expect(targets).toHaveBeenCalledTimes(7);
  // tło nieba, kompozycja, krawędzie tuszu, rozmycie, pass impulsów
  expect(materials).toHaveBeenCalledTimes(5);
  pipeline.fxState.reset();
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  bus.emit('health_changed', { id: 1, current: 100, max: 100 });
  bus.emit('health_changed', { id: 1, current: 10, max: 100 });
  expect(pipeline.fxState.damage).toBe(0);
});

it('materiał świata dodaje siatkę płytek w przestrzeni świata sterowaną z tuningu', () => {
  const material = getMaterial('world');
  const shader = {
    uniforms: {} as Record<string, { value: number }>,
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>',
  };
  material.onBeforeCompile(shader as never, null as never);
  expect(shader.vertexShader).toContain('vGridPos');
  expect(shader.fragmentShader).toContain('gridContrast');
  tuning.render.gridSize = 4;
  tuning.render.gridContrast = 0.3;
  syncMaterials();
  expect(shader.uniforms.gridSize?.value).toBe(4);
  expect(shader.uniforms.gridContrast?.value).toBe(0.3);
});

it('bindEvents na nowej szynie zeruje Skupienie i id gracza ze starej', () => {
  const { pipeline } = fixture();
  const first = new EventBus();
  pipeline.bindEvents(first);
  first.emit('entity_spawned', { id: 1, kind: 'player' });
  first.emit('focus', { worldScale: 0.3, durationS: 2 });
  expect(pipeline.fxState.focusActive).toBe(true);
  const second = new EventBus();
  pipeline.bindEvents(second);
  expect(pipeline.fxState.focusActive).toBe(false);
  second.emit('health_changed', { id: 1, current: 100, max: 100 });
  second.emit('health_changed', { id: 1, current: 10, max: 100 });
  expect(pipeline.fxState.damage).toBe(0);
});

it('materiał bloomu fasady nie świeci w zgaszonych oknach ani bez detalu miasta', () => {
  const facade = createUrbanMaterial('facade');
  const glow = facade.userData.bloomMaterial as MeshBasicMaterial;
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>',
  };
  glow.onBeforeCompile(shader as never, null as never);
  expect(shader.fragmentShader).toMatch(
    /diffuseColor\.rgb = windowTex \* windowParams\.w \* windowLit \* cityDetail;/,
  );
});
