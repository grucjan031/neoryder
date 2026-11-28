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
    const hit = {
      amount: 20,
      tags: [],
      point: null,
      dir: null,
      knockback: 0,
      killed: false,
    };
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

describe('FpsCamera: wygładzanie (C-P2)', () => {
  const flat = () => {
    const t = structuredClone(tuning);
    t.camera.bobEnabled = 0;
    return t;
  };

  it('lądowanie: ugięcie narasta w kilku klatkach i nie przeregulowuje', () => {
    const t = flat();
    const bus = new EventBus();
    const cam = new FpsCamera(t, 1, bus);
    const s = state();
    const rest = run(cam, 0.3, s).position.y;
    bus.emit('player_landed', { id: 1, speed: 10 });
    const ys: number[] = [];
    for (let i = 0; i < 90; i++)
      ys.push(rest - cam.update(1 / 60, s, s, 1).position.y);
    const target = Math.min(
      t.camera.landingDipMax,
      10 * t.camera.landingDipPerSpeed,
    );
    // Brak skoku w pierwszej klatce, ale szybkie narastanie.
    expect(ys[0]!).toBeLessThan(target * 0.8);
    expect(Math.max(...ys)).toBeGreaterThan(target * 0.6);
    // Nigdy powyżej celu (bez przeregulowania) i wraca do zera.
    expect(Math.max(...ys)).toBeLessThanOrEqual(target + 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1e-9);
    expect(ys[ys.length - 1]!).toBeLessThan(1e-3);
    cam.dispose();
  });

  it('ciężkie lądowanie dodaje traumę, lekkie nie', () => {
    const bus = new EventBus();
    const cam = new FpsCamera(flat(), 1, bus);
    bus.emit('player_landed', { id: 1, speed: 8 });
    expect(cam.currentTrauma).toBe(0);
    bus.emit('player_landed', { id: 1, speed: 14 });
    expect(cam.currentTrauma).toBeGreaterThan(0);
    cam.dispose();
  });

  it('stopień 0.25 m jest rozkładany w czasie, a rampa nie ma opóźnienia', () => {
    const t = flat();
    const cam = new FpsCamera(t, 1);
    const at = (y: number, vx = 0) =>
      state({ position: { x: 0, y, z: 0 }, velocity: { x: vx, y: 0, z: 0 } });
    let s = at(0.92);
    run(cam, 0.3, s);
    const before = cam.update(1 / 60, s, s, 1).position.y;
    const next = at(0.92 + 0.25);
    const first = cam.update(1 / 60, s, next, 1).position.y;
    // W pierwszej klatce kamera jest niemal na starej wysokości (nie skacze o 0.25).
    expect(first - before).toBeLessThan(0.1);
    let y = first;
    for (let i = 0; i < 60; i++)
      y = cam.update(1 / 60, next, next, 1).position.y;
    expect(y - before).toBeCloseTo(0.25, 2);
    // Rampa: stały przyrost 0.03 m/krok przy 7 m/s nie jest wygładzany.
    const cam2 = new FpsCamera(t, 1);
    s = at(0.92, 7);
    run(cam2, 0.3, s);
    let rampY = 0.92;
    let last = s;
    for (let i = 0; i < 30; i++) {
      rampY += 0.03;
      const nxt = at(rampY, 7);
      const out = cam2.update(1 / 60, last, nxt, 1).position.y;
      expect(out).toBeCloseTo(rampY - 0.92 + before, 3);
      last = nxt;
    }
  });

  it('FOV w ślizgu rośnie o slideFovKick, przechył przy strafe i brak przy ruchu prosto', () => {
    const t = flat();
    const cam = new FpsCamera(t, 1);
    const slide = state({ sliding: true });
    expect(run(cam, 1, slide).fov).toBeCloseTo(
      t.camera.fov + t.camera.slideFovKick,
      1,
    );
    const straight = new FpsCamera(t, 1);
    expect(
      run(straight, 1, state({ velocity: { x: 0, y: 0, z: -11 } })).roll,
    ).toBeCloseTo(0, 6);
    const right = run(
      new FpsCamera(t, 1),
      1,
      state({ velocity: { x: 11, y: 0, z: 0 } }),
    ).roll;
    const left = run(
      new FpsCamera(t, 1),
      1,
      state({ velocity: { x: -11, y: 0, z: 0 } }),
    ).roll;
    expect(right).toBeLessThan(0);
    expect(left).toBeGreaterThan(0);
    expect(Math.abs(right)).toBeCloseTo(
      (t.camera.strafeRollDeg * Math.PI) / 180,
      3,
    );
  });

  it('cameraTilt=false wyłącza przechyły i kicki FOV', () => {
    const t = flat();
    const cam = new FpsCamera(t, 1, undefined, {
      screenShake: 1,
      cameraTilt: false,
    });
    const pose = run(
      cam,
      1,
      state({
        sliding: true,
        sprinting: true,
        velocity: { x: 11, y: 0, z: 0 },
      }),
    );
    expect(pose.roll).toBeCloseTo(0, 6);
    expect(pose.fov).toBeCloseTo(t.camera.fov, 3);
  });

  it('stopień: gdy gracz staje po wejściu, kamera nie skacze i nie cofa się przy alpha < 1', () => {
    const t = flat();
    const cam = new FpsCamera(t, 1);
    const at = (y: number) => state({ position: { x: 0, y, z: 0 } });
    const low = at(0.92);
    const high = at(0.92 + 0.25);
    run(cam, 0.3, low);
    const ys: number[] = [];
    // Krok N: wejście na stopień (prev = low, cur = high).
    for (const alpha of [0.1, 0.5, 0.9])
      ys.push(cam.update(1 / 60, low, high, alpha).position.y);
    // Krok N+1: gracz stoi (prev = cur = high).
    for (const alpha of [0.1, 0.5, 0.9])
      ys.push(cam.update(1 / 60, high, high, alpha).position.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(-1e-6);
      expect(ys[i]! - ys[i - 1]!).toBeLessThan(0.1);
    }
  });

  it('jazda windą nie uruchamia filtra schodów: oczy trzymają się stóp', () => {
    const t = structuredClone(tuning);
    t.camera.bobEnabled = 0;
    const cam = new FpsCamera(t, 1, new EventBus());
    const dy = (t.elevator.elevatorSpeedMps * 1) / 60;
    let prev = state();
    cam.update(0, prev, prev, 1);
    for (let i = 1; i <= 120; i++) {
      const cur = state({
        position: { x: 0, y: 0.92 + i * dy, z: 0 },
        platformDy: dy,
      });
      const pose = cam.update(1 / 60, prev, cur, 1);
      const feet = cur.position.y - cur.height / 2;
      expect(pose.position.y - feet).toBeCloseTo(t.player.eyeHeight, 5);
      prev = cur;
    }
    cam.dispose();
  });
});
