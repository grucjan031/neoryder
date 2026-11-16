// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Input } from '../../src/core/input';

let input: Input | undefined;
afterEach(() => {
  Reflect.deleteProperty(document, 'pointerLockElement');
  input?.dispose();
  document.body.replaceChildren();
});

it.each(['promise', 'event', 'throw'])(
  'pokazuje odmowę %s, ponawia kliknięciem i ukrywa po locku',
  async (failure) => {
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    const request = vi.fn(() => {
      if (failure === 'promise') return Promise.reject(new Error('Denied'));
      if (failure === 'throw') throw new Error('Denied');
      return undefined;
    });
    Object.defineProperty(canvas, 'requestPointerLock', { value: request });
    input = new Input(canvas);
    input.requestPointerLock();
    if (failure === 'event')
      document.dispatchEvent(new Event('pointerlockerror'));
    await Promise.resolve();
    const hint = document.querySelector<HTMLElement>('.pointer-lock-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe('Kliknij w grę, aby przechwycić mysz');
    expect(hint!.hidden).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.snapshot().held.size).toBe(0);
    hint!.click();
    expect(request).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      value: canvas,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
    await Promise.resolve();
    expect(hint!.hidden).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.snapshot().held.has('moveForward')).toBe(true);
    Reflect.deleteProperty(document, 'pointerLockElement');
    input.dispose();
    expect(document.querySelector('.pointer-lock-hint')).toBeNull();
  },
);

it('ignoruje spóźnioną odmowę po dispose', async () => {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  canvas.requestPointerLock = () => Promise.reject(new Error('Denied'));
  input = new Input(canvas);
  input.requestPointerLock();
  input.dispose();
  await Promise.resolve();
  expect(document.querySelector('.pointer-lock-hint')).toBeNull();
});
