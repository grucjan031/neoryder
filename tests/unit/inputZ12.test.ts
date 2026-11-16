// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
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
  vi.restoreAllMocks();
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

it('bez pointer locka mapuje klawisz przy fokusie poza UI', () => {
  document.body.append(canvas);
  input = new Input(canvas, () => ({ dash: 'Tab' }));
  lock(null);
  expect(key('Tab').defaultPrevented).toBe(true);
  expect(input.snapshot().held.has('dash')).toBe(true);
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

it.each([
  '<div contenteditable="true"><span tabindex="0"></span></div>',
  '<dialog open><span tabindex="0"></span></dialog>',
  '<section role="dialog"><span tabindex="0"></span></section>',
  ...['run-screen', 'hub-screen', 'sector-map', 'build-select'].map(
    (name) => `<section class="${name}"><span tabindex="0"></span></section>`,
  ),
])('fokus wewnątrz UI blokuje akcję bez preventDefault: %s', (html) => {
  document.body.innerHTML = html;
  document.body.append(canvas);
  input = new Input(canvas);
  document.querySelector<HTMLElement>('span')!.focus();
  expect(key('KeyE').defaultPrevented).toBe(false);
  expect(input.snapshot().pressed.size).toBe(0);
});

it('otwarty modal blokuje akcje także przy zdarzeniu wysłanym do window', () => {
  const dialog = document.createElement('dialog');
  document.body.append(canvas, dialog);
  input = new Input(canvas);
  // jsdom nie implementuje showModal ani warstwy modalnej przeglądarki.
  const modal = vi.spyOn(document, 'querySelector').mockReturnValue(dialog);
  expect(document.activeElement).toBe(document.body);
  expect(key('KeyE').defaultPrevented).toBe(false);
  expect(input.snapshot().held.size).toBe(0);
  expect(modal).toHaveBeenCalledWith('dialog:modal');
  modal.mockRestore();
  expect(key('KeyE').defaultPrevented).toBe(true);
  expect(input.snapshot().pressed.has('power2')).toBe(true);
});

it('bez pointer locka klawiatura działa, ale ruch myszy nie obraca kamery', () => {
  document.body.append(canvas);
  input = new Input(canvas);
  lock(null);
  const move = new MouseEvent('mousemove');
  Object.defineProperties(move, {
    movementX: { value: 20 },
    movementY: { value: 10 },
  });
  window.dispatchEvent(move);
  expect(key('KeyE').defaultPrevented).toBe(true);
  const snapshot = input.snapshot();
  expect([...snapshot.pressed]).toEqual(['power2']);
  expect(snapshot.lookDelta).toEqual({ x: 0, y: 0 });
});
