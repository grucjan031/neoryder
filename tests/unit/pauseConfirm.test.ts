// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { PauseMenu } from '../../src/ui/pauseMenu';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const actions = {
    resume: vi.fn(),
    settings: vi.fn(),
    hub: vi.fn(),
    menu: vi.fn(),
  };
  const menu = new PauseMenu(actions);
  menu.show(true);
  return { menu, actions };
}
const button = (label: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.getAttribute('aria-label') === label,
  )!;

// jsdom nie ma okien modalnych: atrapy otwierają i zamykają `dialog` atrybutem.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};

afterEach(() => {
  document.body.replaceChildren();
});

it('„Menu główne” i „Wróć do kryjówki” pytają o potwierdzenie modalem', async () => {
  const { actions } = setup();
  button('Menu główne').click();
  const modal = document.querySelector('dialog.ui-modal')!;
  expect(modal.getAttribute('aria-modal')).toBe('true');
  expect(modal.textContent).toContain('Wyjść do menu głównego?');
  expect(actions.menu).not.toHaveBeenCalled();
  // Anulowanie nic nie robi, fokus wraca do pauzy.
  modal.querySelector<HTMLButtonElement>('.ui-button--secondary')!.click();
  await flush();
  expect(actions.menu).not.toHaveBeenCalled();
  expect(document.querySelector('dialog.ui-modal')).toBeNull();

  button('Menu główne').click();
  document
    .querySelector<HTMLButtonElement>(
      'dialog.ui-modal .ui-button--destructive',
    )!
    .click();
  await flush();
  expect(actions.menu).toHaveBeenCalledOnce();

  button('Wróć do kryjówki').click();
  expect(document.querySelector('dialog.ui-modal')!.textContent).toContain(
    'Wrócić do kryjówki?',
  );
  document
    .querySelector<HTMLButtonElement>(
      'dialog.ui-modal .ui-button--destructive',
    )!
    .click();
  await flush();
  expect(actions.hub).toHaveBeenCalledOnce();
});

it('Esc anuluje potwierdzenie i niczego nie wywołuje', async () => {
  const { actions } = setup();
  button('Wróć do kryjówki').click();
  const modal = document.querySelector<HTMLDialogElement>('dialog.ui-modal')!;
  modal.dispatchEvent(new Event('cancel', { cancelable: true }));
  await flush();
  expect(document.querySelector('dialog.ui-modal')).toBeNull();
  expect(actions.hub).not.toHaveBeenCalled();
});
