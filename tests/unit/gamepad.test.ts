// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import {
  assignGamepadBinding,
  defaultGamepadSettings,
  Input,
  resolveGamepadBindings,
} from '../../src/core/input';
import { assistAim } from '../../src/core/input/aimAssist';
import { gamepadLayout, radialStick } from '../../src/core/input/gamepad';
import type { SampledPad } from '../../src/core/input/gamepad';
import { Rumble } from '../../src/core/input/rumble';
import { GameLoop } from '../../src/core/loop';
import { loadSettings, saveSettings } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';

function setup(id = 'Xbox Controller') {
  const buttons = Array.from({ length: 17 }, () => ({
    pressed: false,
    touched: false,
    value: 0,
  }));
  const axes = [0, 0, 0, 0];
  const pad: SampledPad = {
    axes,
    buttons,
    id,
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: 0,
  };
  const pads: (SampledPad | null)[] = [pad];
  const getGamepads = vi.fn(() => pads);
  const browser = Object.assign(Object.create(window.navigator), {
    getGamepads,
  }) as Navigator;
  vi.spyOn(window, 'navigator', 'get').mockReturnValue(browser);
  const target = document.createElement('canvas');
  document.body.append(target);
  const bus = new EventBus();
  const settings = defaultGamepadSettings();
  const input = new Input(target, undefined, { bus, settings: () => settings });
  const button = (index: number, pressed: boolean) => {
    Object.assign(buttons[index]!, {
      pressed,
      touched: pressed,
      value: Number(pressed),
    });
  };
  return { axes, button, bus, getGamepads, input, pad, pads, settings, target };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  localStorage.clear();
});

describe('Gamepad API', () => {
  it('filtruje martwe strefy radialnie, utrzymuje kierunek i stosuje krzywą', () => {
    expect(radialStick(0.1, 0.1, 0.16, 0.1, 1)).toEqual({ x: 0, y: 0 });
    expect(radialStick(0.5, 0, 0.1, 0.1, 2)).toEqual({ x: 0.25, y: 0 });
    const full = radialStick(0.75, -0.75, 0.1, 0.1, 2);
    expect(Math.hypot(full.x, full.y)).toBeCloseTo(1);
    expect(full.x).toBeCloseTo(-full.y);
  });

  it.each([
    ['USB (Vendor: 054c Product: 0ce6)', 'playstation'],
    ['DualShock 4', 'playstation'],
    ['DualSense', 'playstation'],
    ['Wireless Controller', 'playstation'],
    ['Xbox Wireless Controller', 'xbox'],
    ['XInput controller', 'xbox'],
    ['Other Pad', 'generic'],
  ] as const)('rozpoznaje %s jako %s', (id, layout) => {
    expect(gamepadLayout(id)).toBe(layout);
  });

  it('wykrywa urządzenie po użyciu i ignoruje szum, niestandardowe pady i odłączone przyciski', () => {
    const { input, bus, axes, button, pads, pad } = setup('DualSense');
    const changes = vi.fn();
    bus.on('input:deviceChanged', changes);
    input.update(0, true);
    axes[0] = 0.08;
    input.update(0, true);
    expect(changes).not.toHaveBeenCalled();
    pads[0] = { ...pad, mapping: '' };
    button(0, true);
    input.update(0, true);
    expect(input.padFrame).toBeNull();
    pads[0] = pad;
    input.update(0, true);
    expect(changes).toHaveBeenLastCalledWith({
      device: 'gamepad',
      layout: 'playstation',
    });
    expect(input.snapshot().pressed.has('jump')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(changes).toHaveBeenLastCalledWith({
      device: 'keyboardMouse',
      layout: 'generic',
    });
    input.update(0, true);
    expect(input.activeDevice.device).toBe('keyboardMouse');
    axes[0] = 0.6;
    input.update(0, true);
    expect(input.snapshot().gamepad?.move.x).toBeGreaterThan(0);
    const mouse = new MouseEvent('mousemove');
    Object.defineProperties(mouse, {
      movementX: { value: 8 },
      movementY: { value: 0 },
    });
    window.dispatchEvent(mouse);
    expect(input.activeDevice.device).toBe('keyboardMouse');
    button(1, true);
    input.update(0, true);
    pads[0] = null;
    input.update(0, true);
    expect(input.activeDevice.device).toBe('keyboardMouse');
    expect(input.snapshot().held.size).toBe(0);
    input.dispose();
  });

  it('próbkuje raz przed krokami, również na pauzie, a akcje konsumuje raz', () => {
    const { input, button, getGamepads } = setup();
    const pressed = vi.fn();
    const loop = new GameLoop({
      beforeFrame: (dt) => input.update(dt, !loop.paused),
      step: () => pressed(input.snapshot().pressed.has('jump')),
      render: () => {},
    });
    button(0, true);
    expect(loop.advance(50)).toBe(3);
    expect(pressed.mock.calls).toEqual([[true], [false], [false]]);
    expect(getGamepads).toHaveBeenCalledTimes(1);
    loop.paused = true;
    expect(loop.advance(17)).toBe(0);
    expect(getGamepads).toHaveBeenCalledTimes(2);
    expect(input.snapshot().held.size).toBe(0);
    input.dispose();
  });

  it('dostarcza przycisk pauzy w menu i nie żąda blokady kursora dla pada', () => {
    const { input, button, target, settings } = setup();
    const requestPointerLock = vi.fn();
    Object.assign(target, { requestPointerLock });
    button(9, true);
    input.update(0, false);
    expect(input.padPauseButton).toBe(9);
    expect(input.snapshot().pressed.size).toBe(0);
    input.requestPointerLock();
    expect(requestPointerLock).not.toHaveBeenCalled();
    settings.bindings = assignGamepadBinding(settings.bindings, 'pause', 3);
    button(3, true);
    input.update(0, false);
    expect(input.padPauseButton).toBe(3);
    input.dispose();
  });

  it.each([
    [8, 'inventory', 'map'],
    [13, 'coolWeapon', 'squadCommand'],
  ] as const)(
    'rozróżnia krótkie i długie naciśnięcie %i',
    (index, short, long) => {
      const { input, button } = setup();
      const hold = tuning.gamepad.holdS;
      button(index, true);
      input.update(0, true);
      expect(input.snapshot().pressed.size).toBe(0);
      button(index, false);
      input.update(hold / 2, true);
      expect(input.snapshot().pressed).toEqual(new Set([short]));
      button(index, true);
      input.update(0, true);
      input.update(hold, true);
      expect(input.snapshot().pressed).toEqual(new Set([long]));
      input.update(hold, true);
      expect(input.snapshot().pressed.size).toBe(0);
      button(index, false);
      input.update(0.01, true);
      expect(input.snapshot().pressed.size).toBe(0);
      input.dispose();
    },
  );

  it('przełącza sprint i stosuje czułość, odwrócenie osi oraz przyspieszenie', () => {
    const { input, button, axes, settings } = setup();
    settings.invertY = true;
    settings.sensitivityY = 2;
    axes[3] = 1;
    button(10, true);
    input.update(0, true);
    const first = input.snapshot();
    expect(first.held.has('sprint')).toBe(true);
    expect(first.gamepad?.look.y).toBeCloseTo(-tuning.gamepad.lookSpeedY * 2);
    button(10, false);
    input.update(tuning.gamepad.lookAccelerationS, true);
    const next = input.snapshot();
    expect(next.gamepad?.look.y).toBeCloseTo(
      first.gamepad!.look.y * tuning.gamepad.lookAcceleration,
    );
    expect(next.held.has('sprint')).toBe(true);
    button(10, true);
    input.update(0.01, true);
    expect(input.snapshot().held.has('sprint')).toBe(false);
    input.dispose();
  });

  it('mapuje spusty i przeładowuje przypisania z localStorage', () => {
    const { input, button, settings } = setup();
    expect(resolveGamepadBindings()).toMatchObject({
      0: { press: 'jump' },
      6: { press: 'block' },
      7: { press: 'attack' },
      8: { press: 'inventory', hold: 'map' },
      9: { press: 'pause' },
      14: { press: 'weapon1' },
      12: { press: 'weapon2' },
      15: { press: 'weapon3' },
    });
    const stored = loadSettings(localStorage);
    stored.gamepad.bindings = assignGamepadBinding({ jump: 3 }, 'attack', 3);
    stored.gamepad.deadzone = 0.24;
    saveSettings(stored, localStorage);
    Object.assign(settings, loadSettings(localStorage).gamepad);
    expect(settings.bindings).toEqual({ jump: null, attack: 3 });
    expect(settings.deadzone).toBe(0.24);
    button(6, true);
    button(3, true);
    input.update(0.01, true);
    expect(input.snapshot().held).toEqual(new Set(['block', 'attack']));
    input.dispose();
  });

  it('zatrzymuje wejście na utracie fokusu i nie wznawia go bez nowego naciśnięcia', () => {
    const { input, button } = setup();
    const pause = vi.fn();
    input.onFocusLost(pause);
    button(0, true);
    input.update(0, true);
    window.dispatchEvent(new Event('blur'));
    input.update(0.1, true);
    expect(pause).toHaveBeenCalledOnce();
    expect(input.padFrame).toBeNull();
    expect(input.snapshot().held.size).toBe(0);
    window.dispatchEvent(new Event('focus'));
    input.update(0.01, true);
    expect(input.snapshot().held.size).toBe(0);
    input.dispose();
  });
});

it('spowalnia ruch kamery i przyciąga podczas ruchu wyłącznie do widocznego celu', () => {
  const origin = { x: 0, y: 0, z: 0 };
  const look = { x: 1, y: 0 };
  const target = [{ x: 0.2, y: 0, z: -10 }];
  const t = tuning.gamepad.aim;
  const stationary = assistAim(
    look,
    false,
    0,
    0,
    origin,
    target,
    t,
    () => true,
  );
  const moving = assistAim(look, true, 0, 0, origin, target, t, () => true);
  expect(stationary.x).toBeLessThan(look.x);
  expect(moving.x).toBeGreaterThan(stationary.x);
  expect(assistAim(look, true, 0, 0, origin, target, t, () => false)).toEqual(
    look,
  );
});

it('odtwarza efekty zdarzeń dla aktywnego kontrolera z siłą użytkownika', async () => {
  const { input, button, bus, pad, settings } = setup();
  const playEffect = vi.fn().mockResolvedValue('complete');
  const reset = vi.fn().mockResolvedValue('complete');
  Object.assign(pad, { vibrationActuator: { playEffect, reset } });
  settings.vibrationStrength = 0.5;
  const point = { x: 0, y: 0, z: 0 };
  const effects = tuning.gamepad.rumble;
  const rumble = new Rumble(
    bus,
    () => input.padFrame?.pad,
    () => settings,
    effects,
    () => point,
  );
  button(0, true);
  input.update(0, true);
  bus.emit('entity_spawned', { id: 1, kind: 'player' });
  const damage = {
    source: 2,
    target: 1,
    amount: 3,
    tags: [],
    point: null,
    dir: null,
    knockback: 0,
    killed: false,
  };
  bus.emit('damage_dealt', damage);
  bus.emit('damage_dealt', {
    ...damage,
    source: 1,
    target: 2,
    tags: ['#heavy'],
  });
  bus.emit('parry_success', { defender: 1, projectile: 2, attacker: 3 });
  bus.emit('explosion', { point, radiusM: 1, owner: 1, tags: [] });
  bus.emit('player_died', { id: 1 });
  expect(playEffect.mock.calls).toEqual(
    [
      effects.damage,
      effects.heavy,
      effects.parry,
      effects.explosion,
      effects.death,
    ].map((effect) => [
      'dual-rumble',
      {
        duration: effect.duration,
        strongMagnitude: effect.strongMagnitude / 2,
        weakMagnitude: effect.weakMagnitude / 2,
      },
    ]),
  );
  settings.vibration = false;
  bus.emit('player_died', { id: 1 });
  expect(playEffect).toHaveBeenCalledTimes(5);
  settings.vibration = true;
  playEffect.mockRejectedValueOnce(new Error('odłączony kontroler'));
  bus.emit('player_died', { id: 1 });
  await Promise.resolve();
  bus.emit('input:deviceChanged', {
    device: 'keyboardMouse',
    layout: 'generic',
  });
  expect(reset).toHaveBeenCalledOnce();
  rumble.dispose();
  input.dispose();
});
