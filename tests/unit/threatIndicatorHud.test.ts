// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Hud } from '../../src/ui/hud';

it('updates at unchanged yaw, follows events and simulation time, cleans interrupted threats and disposes', () => {
  const bus = new EventBus();
  const root = document.createElement('div');
  const source = {
    id: 2,
    removed: false,
    current: {
      position: { x: 2, y: 0, z: 0 },
      state: 'telegraph',
      stateTimeS: 0,
    },
  };
  const hud = new Hud(bus, {
    playerId: 1,
    root,
    threats: () => [source],
    threatOrigin: () => ({ x: 0, y: 0, z: 0 }),
  });
  try {
    const visible = () => root.querySelectorAll('.hud__threat:not([hidden])');
    bus.emit('enemy_telegraph', { id: 2, kind: 'heavy', durationS: 1 });
    hud.setViewYaw(0);
    expect(visible()).toHaveLength(1);
    source.current.stateTimeS = 0.5;
    hud.setViewYaw(0);
    const node = visible()[0] as HTMLElement;
    expect(node.dataset.kind).toBe('heavy');
    expect(node.style.getPropertyValue('--progress')).toBe('0.5');
    hud.setViewYaw(-Math.PI / 2);
    expect(visible()).toHaveLength(0);
    hud.setViewYaw(0);
    expect(visible()).toHaveLength(1);
    source.current.state = 'stunned';
    hud.setViewYaw(0);
    expect(visible()).toHaveLength(0);
    source.current.state = 'aim';
    source.current.stateTimeS = 0;
    hud.setViewYaw(0);
    expect(visible()).toHaveLength(0);
    bus.emit('enemy_telegraph', { id: 2, kind: 'aim', durationS: 2 });
    hud.setViewYaw(0);
    expect((visible()[0] as HTMLElement).dataset.kind).toBe('aim');
    source.current.stateTimeS = 2;
    hud.setViewYaw(0);
    expect(visible()).toHaveLength(0);
  } finally {
    hud.dispose();
  }
  expect(root.children).toHaveLength(0);
  bus.emit('enemy_telegraph', { id: 2, kind: 'heavy', durationS: 1 });
  hud.setViewYaw(0);
  expect(root.children).toHaveLength(0);
});
