import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { EventBus } from '../../src/core/events';
import type { GameEvents } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { ExplosionRenderer } from '../../src/render/explosionRenderer';
import { HitSparks } from '../../src/vfx/hitSparks';
import { getMaterial } from '../../src/render/materials';
import { FpsCamera } from '../../src/player/fpsCamera';
import type { PlayerState } from '../../src/player/playerController';

const active: ExplosionRenderer[] = [];
afterEach(() => {
  for (const renderer of active.splice(0)) renderer.dispose();
  vi.restoreAllMocks();
});

function setup() {
  const bus = new EventBus();
  const settings = { flashes: true, screenShake: 1 };
  const player = { x: 0, y: 0.55, z: 0 };
  const burstSparks = vi.fn();
  const renderer = new ExplosionRenderer(bus, {
    floorY: 2,
    playerPosition: () => player,
    burstSparks,
    settings,
  });
  active.push(renderer);
  const meshes = renderer.root.children as Mesh[];
  const named = (name: string) => meshes.filter((mesh) => mesh.name === name);
  const shell = named('explosion-shell');
  const core = named('explosion-core');
  const ring = named('explosion-ring');
  const shake = vi.fn<(event: GameEvents['camera_shake']) => void>();
  const stop = vi.fn();
  bus.on('camera_shake', shake);
  bus.on('hitstop', stop);
  const emit = (tags = ['#hazard', '#explosion']) =>
    bus.emit('explosion', {
      point: { x: 0, y: 0.55, z: 0 },
      radiusM: 4.5,
      owner: 1,
      tags,
    });
  return {
    bus,
    renderer,
    settings,
    player,
    burstSparks,
    shell,
    core,
    ring,
    shake,
    stop,
    emit,
  };
}

describe('wybuch ognia', () => {
  it.each([
    ['#hazard', '#explosion'],
    ['#synergy', '#fire'],
  ])(
    'rysuje rdzeń, kulę i falę oraz zleca 32 bursztynowe iskry: %s %s',
    (...tags) => {
      const c = setup();
      c.emit(tags);
      expect(c.core[0]!.visible).toBe(true);
      expect(c.shell[0]!.visible).toBe(true);
      expect(c.ring[0]!.visible).toBe(true);
      expect(c.burstSparks).toHaveBeenCalledExactlyOnceWith(
        { x: 0, y: 0.55, z: 0 },
        32,
        0xffb84d,
      );
      const material = c.core[0]!.material as MeshBasicMaterial;
      expect(material.userData.bloom).toBe(true);
      expect(material.color.r).toBeGreaterThan(1);
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(true);
      expect(c.ring[0]!.position.y).toBe(
        2 + tuning.vfx.explosionRingFloorOffsetM,
      );
      expect(c.ring[0]!.rotation.x).toBe(-Math.PI / 2);
      c.renderer.render(0.05);
      expect(c.core[0]!.visible).toBe(true);
      const radius = c.ring[0]!.scale.x;
      c.renderer.render(0.05);
      expect(c.core[0]!.visible).toBe(false);
      expect(c.shell[0]!.visible).toBe(true);
      expect(c.ring[0]!.scale.x).toBeGreaterThan(radius);
      c.renderer.render(0.2);
      expect(c.renderer.root.children.every((mesh) => !mesh.visible)).toBe(
        true,
      );
    },
  );

  it('flashes=false wyłącza tylko rdzeń, także w czasie trwającego błysku', () => {
    const c = setup();
    c.settings.flashes = false;
    c.emit();
    expect(c.core[0]!.visible).toBe(false);
    expect(c.shell[0]!.visible).toBe(true);
    expect(c.ring[0]!.visible).toBe(true);
    expect(c.burstSparks).toHaveBeenCalledOnce();
    c.settings.flashes = true;
    c.emit();
    expect(c.core[1]!.visible).toBe(true);
    c.settings.flashes = false;
    c.renderer.render(0);
    expect(c.core.every((mesh) => !mesh.visible)).toBe(true);
  });

  it('kula przechodzi od bursztynu do ciemnego żółtawego pomarańczu', () => {
    const c = setup();
    c.emit();
    const material = c.shell[0]!.material as MeshBasicMaterial;
    expect(material.color.getHex()).toBe(0xffb84d);
    c.renderer.render(tuning.vfx.explosionDurationS / 2);
    const middle = material.color.clone();
    c.renderer.render(tuning.vfx.explosionDurationS / 2);
    expect(material.color.getHex()).toBe(0xa66b08);
    expect(middle.r).toBeGreaterThan(material.color.r);
    expect(
      material.color.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).h * 360,
    ).toBeGreaterThan(35);
  });

  it.each([
    { tags: ['#power', '#fire'] },
    { tags: ['#elektrycznosc', '#fire'] },
    { tags: ['#hazard'] },
    { tags: [] },
  ])('zachowuje stary kontrakt pozostałych wybuchów: $tags', ({ tags }) => {
    const c = setup();
    c.emit(tags);
    c.renderer.render(tuning.vfx.explosionDurationS / 2);
    expect(c.shell[0]!.scale.x).toBeCloseTo(2.25);
    const material = c.shell[0]!.material as MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(tuning.vfx.explosionOpacity / 2);
    const expected = tags.includes('#power')
      ? getMaterial('power').color.getHex()
      : tags.includes('#elektrycznosc')
        ? 0xfff1d6
        : 0xffb84d;
    expect(material.color.getHex()).toBe(expected);
    expect(c.core.every((mesh) => !mesh.visible)).toBe(true);
    expect(c.ring.every((mesh) => !mesh.visible)).toBe(true);
    expect(c.burstSparks).not.toHaveBeenCalled();
    expect(c.shake).not.toHaveBeenCalled();
    expect(c.stop).not.toHaveBeenCalled();
  });

  it('wstrząs maleje liniowo, znika poza zasięgiem, hitstop tylko w promieniu', () => {
    const c = setup();
    for (const distance of [0, 2.25, 4.5, 6.75, 9, 20]) {
      c.player.x = distance;
      c.emit();
    }
    const intensities = c.shake.mock.calls.map(([event]) => event.intensity);
    expect(intensities).toHaveLength(4);
    [0.7, 0.525, 0.35, 0.175].forEach((expected, i) =>
      expect(intensities[i]).toBeCloseTo(expected),
    );
    expect(c.stop).toHaveBeenCalledTimes(3);
    expect(c.stop).toHaveBeenLastCalledWith({ ms: 45 });
  });

  it('screenShake=0 blokuje emisję; ułamkowe ustawienie skaluje dopiero kamera', () => {
    const c = setup();
    c.settings.screenShake = 0;
    c.emit();
    expect(c.shake).not.toHaveBeenCalled();
    expect(c.stop).toHaveBeenCalledOnce();
    c.settings.screenShake = 0.5;
    c.emit();
    expect(c.shake).toHaveBeenCalledExactlyOnceWith({
      intensity: 0.7,
      durationS: tuning.vfx.explosionShakeS,
      dir: null,
    });
  });

  it('wykorzystuje istniejącą pulę HitSparks i zachowuje kolory oraz limit', () => {
    const c = setup();
    const sparks = new HitSparks(c.bus, { playerId: 1, tuning });
    c.burstSparks.mockImplementation((point, count, color) =>
      sparks.burst(point, null, color, count),
    );
    c.emit();
    expect(sparks.count).toBe(32);
    const colors: number[] = [];
    sparks.forEach((spark) => colors.push(spark.color));
    expect(new Set(colors)).toEqual(new Set([0xffb84d]));
    for (let i = 0; i < 10; i++) c.emit();
    expect(sparks.count).toBe(tuning.vfx.maxHitSparks);
    sparks.update(1);
    expect(sparks.count).toBe(0);
    sparks.dispose();
  });

  it('pełna ścieżka do FpsCamera skaluje wstrząs o połowę i wyłącza aktywną traumę', () => {
    const full = setup();
    const half = setup();
    half.settings.screenShake = 0.5;
    const fullCamera = new FpsCamera(tuning, 1, full.bus, full.settings);
    const halfCamera = new FpsCamera(tuning, 1, half.bus, half.settings);
    const state: PlayerState = {
      position: { x: 0, y: tuning.player.capsuleHeight / 2, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      grounded: true,
      coyoteMs: 0,
      jumpBufferMs: 0,
      airJumpsUsed: 0,
      height: tuning.player.capsuleHeight,
      dashS: 0,
      dashCooldownS: 0,
      dashDir: { x: 0, y: 0, z: -1 },
      sliding: false,
      slideS: 0,
      crouched: false,
      sprinting: false,
    };
    try {
      full.emit();
      half.emit();
      const fullPose = fullCamera.update(1 / 60, state, state, 1);
      const halfPose = halfCamera.update(1 / 60, state, state, 1);
      expect(fullPose.roll).not.toBe(0);
      expect(halfPose.roll).toBeCloseTo(fullPose.roll / 2);
      half.settings.screenShake = 0;
      expect(Math.abs(halfCamera.update(0, state, state, 1).roll)).toBe(0);
    } finally {
      fullCamera.dispose();
      halfCamera.dispose();
    }
  });

  it('recykling usuwa rdzeń/falę po zmianie tagów, a dispose odpina zdarzenia', () => {
    const c = setup();
    const children = [...c.renderer.root.children];
    for (let i = 0; i < tuning.vfx.maxExplosions + 1; i++) c.emit();
    c.emit(['#power']);
    expect(c.core[1]!.visible).toBe(false);
    expect(c.ring[1]!.visible).toBe(false);
    expect(c.renderer.root.children).toEqual(children);
    c.renderer.dispose();
    active.splice(active.indexOf(c.renderer), 1);
    c.burstSparks.mockClear();
    c.shake.mockClear();
    c.stop.mockClear();
    c.emit();
    expect(c.burstSparks).not.toHaveBeenCalled();
    expect(c.shake).not.toHaveBeenCalled();
    expect(c.stop).not.toHaveBeenCalled();
  });
});
