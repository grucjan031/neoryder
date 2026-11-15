// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { Input } from '../../src/core/input';

const canvas = document.createElement('canvas');
let input: Input | undefined;

function lock(element: Element | null): void {
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    value: element,
  });
}

function key(code: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  lock(null);
  input?.dispose();
  input = undefined;
  Reflect.deleteProperty(document, 'pointerLockElement');
  document.body.replaceChildren();
});

it.each(['Tab', 'Enter', 'Space', 'ArrowDown', 'Home', 'End', 'PageDown'])(
  '%s przypisany do dash pozostawia nawigację na przycisku mapy',
  (code) => {
    const screen = document.createElement('section');
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-label', 'Mapa sektora');
    const button = document.createElement('button');
    screen.append(button);
    document.body.append(canvas, screen);
    input = new Input(canvas, () => ({ dash: code }));
    button.focus();
    lock(null);
    expect(key(code).defaultPrevented).toBe(false);
    const snapshot = input.snapshot();
    expect([...snapshot.held]).toEqual([]);
    expect([...snapshot.pressed]).toEqual([]);
  },
);

it('bez pointer locka nie mapuje klawisza nawet przy fokusie poza UI', () => {
  document.body.append(canvas);
  input = new Input(canvas, () => ({ dash: 'Tab' }));
  lock(null);
  expect(key('Tab').defaultPrevented).toBe(false);
  expect(input.snapshot().held.has('dash')).toBe(false);
});

it.each(['button', 'input', 'textarea', 'select'])(
  'aktywny %s blokuje akcje także przy utrzymanym pointer locku',
  (tag) => {
    const control = document.createElement(tag);
    document.body.append(canvas, control);
    input = new Input(canvas, () => ({ dash: 'Tab' }));
    lock(canvas);
    control.focus();
    expect(key('Tab').defaultPrevented).toBe(false);
    const snapshot = input.snapshot();
    expect([...snapshot.held]).toEqual([]);
    expect([...snapshot.pressed]).toEqual([]);
  },
);

it('Tab działa jako dash w rozgrywce z pointer lockiem', () => {
  document.body.append(canvas);
  input = new Input(canvas, () => ({ dash: 'Tab' }));
  lock(canvas);
  expect(key('Tab').defaultPrevented).toBe(true);
  const snapshot = input.snapshot();
  expect([...snapshot.held]).toEqual(['dash']);
  expect([...snapshot.pressed]).toEqual(['dash']);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Tab' }));
  expect([...input.snapshot().released]).toEqual(['dash']);
});
