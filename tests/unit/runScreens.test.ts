// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';

const active = new Set<HtmlRunScreens>();
const nodes = Array.from({ length: 4 }, (_, index) => ({
  id: `L1N${index + 1}`,
  index,
  layer: 1,
  type: 'combat' as const,
  next: [],
}));
const view: RunScreenView = {
  screen: 'map',
  nodes,
  summary: null,
  busy: false,
  error: null,
  state: {
    seed: 'test',
    sectorId: 'test',
    loadoutId: 'classic',
    startedAtMs: 0,
    elapsedS: 0,
    map: { sectorId: 'test', layers: [nodes] },
    currentNodeId: null,
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  },
};

afterEach(() => {
  for (const screens of active) screens.dispose();
  active.clear();
  document.body.replaceChildren();
});

it('obsługuje mysz, 1/2/3 i Enter, także dla czwartego węzła', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const selectNode = vi.fn();
  screens.show(view, { selectNode, next() {}, menu() {} });
  for (const code of ['Digit1', 'Digit2', 'Digit3'])
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  const buttons =
    document.querySelectorAll<HTMLButtonElement>('.run-screen button');
  buttons[3]!.click();
  buttons[3]!.focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(selectNode.mock.calls.map(([id]) => id)).toEqual([
    'L1N1',
    'L1N2',
    'L1N3',
    'L1N4',
    'L1N4',
  ]);
  screens.hide();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  expect(selectNode).toHaveBeenCalledTimes(5);
});

it('placeholder nagrody ma Dalej; pisanie w konsoli nie uruchamia ekranu', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const next = vi.fn();
  screens.show(
    { ...view, screen: 'reward' },
    { selectNode() {}, next, menu() {} },
  );
  expect(document.querySelector('.run-screen')?.textContent).toContain(
    'brak nagród',
  );
  const input = document.createElement('input');
  document.body.append(input);
  input.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }),
  );
  expect(next).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(next).toHaveBeenCalledOnce();
  screens.dispose();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(next).toHaveBeenCalledOnce();
  expect(document.querySelector('.run-screen')).toBeNull();
});
