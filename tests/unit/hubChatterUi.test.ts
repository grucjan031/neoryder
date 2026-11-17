// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { HubChatterUi } from '../../src/ui/hubChatter';
import { lifeLayout, lifeTexts } from '../fixtures/hubLife';

afterEach(() => document.body.replaceChildren());

it('napisy są ukryte, pokazują imię/akcent/tekst bez HTML, znikają i zwalniają DOM', () => {
  const ui = new HubChatterUi(lifeLayout().npcs!, lifeTexts(), document.body);
  const root = document.querySelector<HTMLElement>('.hub-chatter')!;
  expect(root.hidden).toBe(true);
  ui.update({ conversation: 'hello', npc: 'kid', text: '<b>Cześć</b>' });
  expect(root.hidden).toBe(false);
  expect(root.dataset.accent).toBe('amber');
  expect(root.querySelector('.hub-chatter__name')?.textContent).toBe('Ada: ');
  expect(root.querySelector('.hub-chatter__text')?.textContent).toBe(
    '<b>Cześć</b>',
  );
  expect(root.querySelector('b')).toBeNull();
  expect(root.getAttribute('aria-live')).toBe('polite');
  ui.update(null);
  expect(root.hidden).toBe(true);
  ui.dispose();
  expect(document.querySelector('.hub-chatter')).toBeNull();
});

it('ta sama kwestia nie zmienia DOM; zmiana mówcy aktualizuje imię i akcent', async () => {
  const ui = new HubChatterUi(lifeLayout().npcs!, lifeTexts(), document.body);
  const line = { conversation: 'hello', npc: 'kid', text: 'Gotowe?' };
  ui.update(line);
  const root = document.querySelector<HTMLElement>('.hub-chatter')!;
  const observer = new MutationObserver(() => {});
  observer.observe(root, { childList: true, attributes: true, subtree: true });
  ui.update(line);
  ui.update(line);
  expect(observer.takeRecords()).toEqual([]);
  ui.update({ conversation: 'hello', npc: 'friend', text: 'Tak.' });
  expect(observer.takeRecords().length).toBeGreaterThan(0);
  expect(root.dataset.accent).toBe('green');
  expect(root.querySelector('.hub-chatter__name')?.textContent).toBe('Jan: ');
  observer.disconnect();
  ui.dispose();
});
