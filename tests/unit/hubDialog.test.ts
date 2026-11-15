// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { HubDialog } from '../../src/ui/hubDialog';

afterEach(() => document.body.replaceChildren());

it('dymek zaczyna ukryty, pokazuje imię, rolę i kwestię jako tekst, a hide i dispose go chowają', () => {
  const dialog = new HubDialog(document.body);
  const root = document.querySelector<HTMLElement>('.hub-dialog')!;
  expect(root.hidden).toBe(true);
  dialog.show({
    id: 'mira',
    name: 'Mira',
    role: 'Mechaniczka',
    line: '<b>Cześć</b>',
  });
  expect(root.hidden).toBe(false);
  expect(dialog.visible).toBe(true);
  expect(root.querySelector('.hub-dialog__name')?.textContent).toBe('Mira');
  expect(root.querySelector('.hub-dialog__role')?.textContent).toBe(
    'Mechaniczka',
  );
  expect(root.querySelector('b')).toBeNull();
  expect(root.querySelector('.hub-dialog__line')?.textContent).toBe(
    '<b>Cześć</b>',
  );
  dialog.hide();
  expect(root.hidden).toBe(true);
  dialog.dispose();
  expect(document.querySelector('.hub-dialog')).toBeNull();
});
