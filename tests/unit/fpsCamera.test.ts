import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { FpsCamera, shakeAmplitude } from '../../src/player/fpsCamera';
import type { PlayerState } from '../../src/player/playerController';

const state = (over: Partial<PlayerState> = {}): PlayerState => ({
  position: { x: 0, y: 0.92, z: 0 },
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
  ...over,
});

const run = (cam: FpsCamera, seconds: number, s = state()) => {
  let pose = cam.update(0, s, s, 1);
  for (let t = 0; t < seconds; t += 1 / 60) pose = cam.update(1 / 60, s, s, 1);
  return pose;
};

describe('shakeAmplitude', () => {
  it('zawsze w [0, shakeMax], rośnie kwadratowo', () => {
    for (const trauma of [-1, 0, 0.25, 0.5, 1, 3, Number.NaN])
      expect(shakeAmplitude(trauma, 0.4)).toBeGreaterThanOrEqual(0);
    for (const trauma of [0, 0.5, 1, 10])
      expect(shakeAmplitude(trauma, 0.4)).toBeLessThanOrEqual(0.4);
    expect(shakeAmplitude(0.5, 0.4)).toBeCloseTo(0.1);
    expect(shakeAmplitude(1, 0.4)).toBeCloseTo(0.4);
  });
});

describe('FpsCamera', () => {
  it('wstrząs wygasa do 0 po duration i wraca do pozy bez przesunięcia', () => {
    const t = structuredClone(tuning);
    t.camera.bobEnabled = 0;
    const bus = new EventBus();
    const cam = new FpsCamera(t, 1, bus);
    const calm = run(cam, 0.1);
    bus.emit('camera_shake', { intensity: 0.8, durationS: 0.5, dir: null });
    expect(cam.currentTrauma).toBeCloseTo(0.8);
    const shaking = run(cam, 0.2);
    expect(cam.currentTrauma).toBeGreaterThan(0);
    expect(Math.abs(shaking.pitch) + Math.abs(shaking.roll)).toBeGreaterThan(0);
    const after = run(cam, 0.35);
    expect(cam.currentTrauma).toBe(0);
    expect(after.pitch).toBeCloseTo(calm.pitch, 6);
    expect(after.roll).toBeCloseTo(0, 6);
    cam.dispose();
  });

  it('trafienie gracza trzęsie mocniej niż cios zadany przez gracza', () => {
    const bus = new EventBus();
    const cam = new FpsCamera(tuning, 1, bus);
    const hit = { amount: 20, tags: [], point: null, dir: null, knockback: 0, killed: false };
    bus.emit('damage_dealt', { ...hit, source: 2, target: 1 });
    const taken = cam.currentTrauma;
    cam.dispose();
    const cam2 = new FpsCamera(tuning, 1, bus);
    bus.emit('damage_dealt', { ...hit, source: 1, target: 2 });
    expect(cam2.currentTrauma).toBeGreaterThan(0);
    expect(cam2.currentTrauma).toBeLessThan(taken);
    cam2.dispose();
  });

  it('FOV czytany na żywo z tuning i kick przy sprincie', () => {
    const t = structuredClone(tuning);
    const cam = new FpsCamera(t, 1);
    expect(run(cam, 1).fov).toBeCloseTo(t.camera.fov, 1);
    t.camera.fov = 100;
    expect(run(cam, 1).fov).toBeCloseTo(100, 1);
    expect(run(cam, 1, state({ sprinting: true })).fov).toBeCloseTo(
      100 + t.camera.sprintFovKick,
      1,
    );
  });

  it('wstrząs działa przy dt symulacji = 0 (hitstop), bo liczy czas klatki', () => {
    const bus = new EventBus();
    const cam = new FpsCamera(tuning, 1, bus);
    bus.emit('camera_shake', { intensity: 1, durationS: 1, dir: null });
    const s = state();
    // Ten sam stan symulacji (zamrożony), ale klatki płyną.
    const a = cam.update(1 / 60, s, s, 0);
    const b = cam.update(1 / 60, s, s, 0);
    expect(a.pitch).not.toBeCloseTo(b.pitch, 8);
    cam.dispose();
  });

  it('oczy opadają płynnie do wysokości slide, stopy zostają na miejscu', () => {
    const t = structuredClone(tuning);
    t.camera.bobEnabled = 0;
    const cam = new FpsCamera(t, 1);
    const standing = run(cam, 0.5);
    const low = t.player.slideCapsuleHeight;
    const sliding = state({
      height: low,
      position: { x: 0, y: 0.92 - (t.player.capsuleHeight - low) / 2, z: 0 },
    });
    const first = cam.update(1 / 60, sliding, sliding, 1);
    expect(first.position.y).toBeLessThan(standing.position.y);
    expect(first.position.y).toBeGreaterThan(
      standing.position.y - (t.player.capsuleHeight - low) * 0.5,
    );
    const settled = run(cam, 1, sliding);
    expect(standing.position.y - settled.position.y).toBeCloseTo(
      t.player.capsuleHeight - low,
      2,
    );
  });
});
