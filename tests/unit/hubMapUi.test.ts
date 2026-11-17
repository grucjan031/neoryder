// @vitest-environment jsdom
import hideoutData from '../../src/data/hub/hideout.json';
import { afterEach, expect, it } from 'vitest';
import { HubMap } from '../../src/ui/hubMap';
import { loadHubLayout } from '../../src/world/hubSchema';

const layout = loadHubLayout(hideoutData);
afterEach(() => document.body.replaceChildren());

it('startuje ukryty, ma rolę dialogu i tytuł; toggle otwiera i zamyka', () => {
  const map = new HubMap(layout, document.body);
  const root = document.querySelector<HTMLElement>('.hub-map')!;
  expect(root.hidden).toBe(true);
  expect(root.getAttribute('role')).toBe('dialog');
  expect(root.getAttribute('aria-label')).toBe('Plan stacji Kamienna');
  map.toggle();
  expect(map.isOpen).toBe(true);
  expect(root.querySelector('h2')?.textContent).toBe('Plan stacji Kamienna');
  expect(root.textContent).toContain('M — zamknij');
  expect(root.querySelectorAll('.hub-map__zone')).toHaveLength(
    layout.zones!.length,
  );
  expect(root.querySelectorAll('.hub-map__station')).toHaveLength(4);
  map.toggle();
  expect(map.isOpen).toBe(false);
  map.dispose();
});

it('znacznik gracza przesuwa się bez przebudowy SVG', () => {
  const map = new HubMap(layout, document.body);
  map.toggle();
  const svg = document.querySelector('.hub-map__svg')!;
  const zone = svg.querySelector('.hub-map__zone')!;
  const player = svg.querySelector('.hub-map__player')!;
  const before = player.getAttribute('transform');
  map.update({ x: 10, z: 10 }, 1);
  expect(player.getAttribute('transform')).not.toBe(before);
  expect(document.querySelector('.hub-map__svg')).toBe(svg);
  expect(svg.querySelector('.hub-map__zone')).toBe(zone);
  expect(svg.querySelector('.hub-map__player')).toBe(player);
  map.dispose();
});

it('Esc zamyka plan, a dispose usuwa nakładkę', () => {
  const map = new HubMap(layout, document.body);
  map.toggle();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  expect(map.isOpen).toBe(false);
  map.dispose();
  expect(document.querySelector('.hub-map')).toBeNull();
});
