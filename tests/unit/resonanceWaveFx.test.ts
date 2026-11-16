import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { EventBus } from '../../src/core/events';
import { tuning } from '../../src/core/tuning';
import { ResonanceWaveFx } from '../../src/render/resonanceWaveFx';

const PLAYER = 1;
const push = {
  def: { id: 'push', kind: 'cone', coneAngleDeg: 70, range: 6 },
  cooldownRemaining: 0,
};

function setup(owner?: number) {
  const bus = new EventBus();
  const fx = new ResonanceWaveFx(tuning, bus, owner);
  const camera = new PerspectiveCamera();
  camera.updateMatrixWorld();
  const visible = (): number =>
    fx.root.children.filter((c) => c.visible).length;
  return { bus, fx, camera, visible };
}

describe('ResonanceWaveFx', () => {
  it('startuje falę po zdarzeniu power_used, a nie po skoku odnowienia', () => {
    const { bus, fx, camera, visible } = setup(PLAYER);
    fx.update([push], camera);
    fx.update([{ ...push, cooldownRemaining: 3 }], camera);
    expect(visible()).toBe(0);

    bus.emit('power_used', { power: 'push', user: PLAYER });
    fx.advance(1 / 60);
    fx.update([push], camera);
    expect(visible()).toBeGreaterThan(0);
  });

  it('pomija moce innego użytkownika i moce spoza listy', () => {
    const { bus, fx, camera, visible } = setup(PLAYER);
    bus.emit('power_used', { power: 'push', user: PLAYER + 1 });
    bus.emit('power_used', { power: 'lightning', user: PLAYER });
    fx.update([push], camera);
    expect(visible()).toBe(0);
  });

  it('czeka z falą na klatkę z kamerą', () => {
    const { bus, fx, camera, visible } = setup();
    bus.emit('power_used', { power: 'push', user: PLAYER });
    fx.update([push], null);
    expect(visible()).toBe(0);
    fx.advance(1 / 60);
    fx.update([push], camera);
    expect(visible()).toBeGreaterThan(0);
  });

  it('dispose odpina subskrypcję', () => {
    const { bus, fx, camera, visible } = setup();
    fx.dispose();
    bus.emit('power_used', { power: 'push', user: PLAYER });
    fx.update([push], camera);
    expect(visible()).toBe(0);
  });
});

describe('ResonanceWaveFx — zegar klatki', () => {
  it('fala starzeje się o frameDt z advance (krok przycięty do 0,1 s)', () => {
    const { bus, fx, camera, visible } = setup();
    const lifeS = tuning.vfx.resonanceWaveS;
    bus.emit('power_used', { power: 'push', user: PLAYER });
    fx.advance(1 / 60);
    fx.update([push], camera);
    // Bez advance czas stoi, niezależnie od zegara ściennego.
    for (let i = 0; i < 5; i++) fx.update([push], camera);
    expect(visible()).toBeGreaterThan(0);

    // Jedna długa klatka liczy się najwyżej jako 0,1 s.
    fx.advance(1000);
    fx.update([push], camera);
    expect(visible() > 0).toBe(lifeS > 0.1 + 1 / 60);

    for (let t = 0; t < lifeS; t += 0.05) {
      fx.advance(0.05);
      fx.update([push], camera);
    }
    expect(visible()).toBe(0);
  });
});
