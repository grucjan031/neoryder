// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MapScreen } from '../../src/ui/mapScreen';
import type { MapNode, RunState } from '../../src/core/runTypes';

const node = (
  id: string,
  layer: number,
  type: MapNode['type'],
  next: string[] = [],
): MapNode => ({ id, layer, index: 0, type, next });
const layers = [
  [node('a', 1, 'combat', ['c']), node('b', 1, 'combat', ['d'])],
  [node('c', 2, 'elite', ['boss']), node('d', 2, 'rest', ['boss'])],
  [node('boss', 3, 'boss')],
];
const state: RunState = {
  seed: 'map',
  sectorId: 'test',
  loadoutId: 'blade',
  startedAtMs: 0,
  elapsedS: 0,
  map: { sectorId: 'test', layers },
  currentNodeId: 'a',
  visited: ['a'],
  hp: 37,
  energy: 50,
  credits: 15,
  implants: [],
  stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
};
const active: MapScreen[] = [];
afterEach(() => {
  active.splice(0).forEach((map) => map.dispose());
  document.body.replaceChildren();
});
const button = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`)!;

it('rysuje cały graf od warstwy 1 na dole do bossa na górze, krawędzie i stany', () => {
  const map = new MapScreen(document.body);
  active.push(map);
  map.show(state, vi.fn());
  expect(document.querySelectorAll('line')).toHaveLength(4);
  expect(parseFloat(button('a').style.top)).toBeGreaterThan(
    parseFloat(button('boss').style.top),
  );
  expect(button('a').classList.contains('is-visited')).toBe(true);
  expect(button('a').getAttribute('aria-current')).toBe('step');
  expect(button('c').classList.contains('is-available')).toBe(true);
  expect(
    new Set(
      [...document.querySelectorAll('.sector-map__node span')].map(
        (s) => s.textContent,
      ),
    ).size,
  ).toBe(4);
});

it('wyłącznie next jest klikalne; klawiatura nie otwiera zamkniętych węzłów', () => {
  const map = new MapScreen(document.body);
  active.push(map);
  const select = vi.fn();
  map.show(state, select);
  for (const id of ['a', 'b', 'd', 'boss']) {
    expect(button(id).disabled).toBe(true);
    button(id).click();
  }
  expect(select).not.toHaveBeenCalled();
  button('c').click();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  expect(select.mock.calls).toEqual([['c'], ['c']]);
});

it('na starcie udostępnia warstwę 1; Enter, hide, dispose i wpisywanie w polu', () => {
  const map = new MapScreen(document.body);
  active.push(map);
  const select = vi.fn();
  map.show({ ...state, currentNodeId: null, visited: [] }, select);
  expect(button('a').disabled).toBe(false);
  expect(button('b').disabled).toBe(false);
  button('b').focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  const input = document.createElement('input');
  document.body.append(input);
  input.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true }),
  );
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Digit1', repeat: true }),
  );
  map.hide();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  map.dispose();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(select.mock.calls).toEqual([['b']]);
});
