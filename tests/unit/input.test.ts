// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Input } from '../../src/core/input';

describe('Input — kontrakty F2', () => {
  let canvas: HTMLCanvasElement;
  let input: Input;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    input = new Input(canvas);
  });

  afterEach(() => {
    input.dispose();
    canvas.remove();
  });

  it.each([
    ['KeyE', 'power2'],
    ['Digit1', 'weapon1'],
    ['Digit2', 'weapon2'],
    ['Digit3', 'weapon3'],
  ] as const)('mapuje %s na %s', (code, action) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    const pressed = input.snapshot();
    expect([...pressed.pressed]).toEqual([action]);
    expect([...pressed.held]).toEqual([action]);
    expect(input.snapshot().pressed.size).toBe(0);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    const released = input.snapshot();
    expect([...released.released]).toEqual([action]);
    expect(released.held.size).toBe(0);
  });

  it('mapuje środkowy przycisk na bladeThrow i blokuje domyślne akcje na canvasie', () => {
    const down = new MouseEvent('mousedown', { button: 1, cancelable: true });
    canvas.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    const pressed = input.snapshot();
    expect([...pressed.pressed]).toEqual(['bladeThrow']);
    expect([...pressed.held]).toEqual(['bladeThrow']);
    window.dispatchEvent(new MouseEvent('mouseup', { button: 1 }));
    const released = input.snapshot();
    expect([...released.released]).toEqual(['bladeThrow']);
    expect(released.held.size).toBe(0);
    const aux = new MouseEvent('auxclick', { button: 1, cancelable: true });
    canvas.dispatchEvent(aux);
    expect(aux.defaultPrevented).toBe(true);
  });
});
