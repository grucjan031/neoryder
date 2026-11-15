// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import text from '../../src/data/ui/meta.pl.json';
import { HubPrompt } from '../../src/ui/hubPrompt';

afterEach(() => document.body.replaceChildren());

it('podpowiedź zaczyna ukryta, pokazuje klawisz E i etykietę wybranej stacji', () => {
  const prompt = new HubPrompt(document.body);
  const root = document.querySelector<HTMLElement>('.hub-prompt')!;
  expect(root.hidden).toBe(true);
  expect(root.getAttribute('aria-label')).toBe(text.hub.interact);
  prompt.update('WARSZTAT');
  expect(root.hidden).toBe(false);
  expect(root.querySelector('kbd')?.textContent).toBe('E');
  expect(root.querySelector('span')?.textContent).toBe('WARSZTAT');
  prompt.update('TALENTY');
  expect(root.querySelector('span')?.textContent).toBe('TALENTY');
});

it('brak stacji i otwarta nakładka chowają podpowiedź, zamknięcie pozwala ją przywrócić', () => {
  const prompt = new HubPrompt(document.body);
  const root = document.querySelector<HTMLElement>('.hub-prompt')!;
  prompt.update('MISJE');
  prompt.update(null);
  expect(root.hidden).toBe(true);
  expect(root.querySelector('span')?.textContent).toBe('');
  prompt.update('MISJE', true);
  expect(root.hidden).toBe(true);
  prompt.update('MISJE', false);
  expect(root.hidden).toBe(false);
});

it('etykieta jest tekstem, a dispose usuwa podpowiedź z DOM', () => {
  const prompt = new HubPrompt(document.body);
  prompt.update('<b>Warsztat</b>');
  const root = document.querySelector<HTMLElement>('.hub-prompt')!;
  expect(root.querySelector('b')).toBeNull();
  expect(root.textContent).toContain('<b>Warsztat</b>');
  prompt.dispose();
  expect(document.querySelector('.hub-prompt')).toBeNull();
});
