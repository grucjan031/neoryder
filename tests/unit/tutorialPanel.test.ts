// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TutorialPanel } from '../../src/ui/tutorialPanel';
import { tutorialStepsSchema } from '../../src/data/tutorial/schema';
import stepsData from '../../src/data/tutorial/steps.json';
import { loadSettings } from '../../src/core/save';

const steps = tutorialStepsSchema.parse(stepsData);
let panel: TutorialPanel | undefined;
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  panel?.dispose();
  panel = undefined;
  loadSettings().bindings = {};
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('odświeża klawisze z ustawień w czasie pauzy i pokazuje ukończenie', () => {
  const navigate = vi.fn();
  panel = new TutorialPanel(document.body, navigate);
  panel.show(steps[2]!, 3, 11, false);
  expect(document.querySelector('.tutorial-panel')?.textContent).toContain(
    '3 / 11',
  );
  loadSettings().bindings = { dash: 'KeyV' };
  panel.syncBindings();
  expect(
    [...document.querySelectorAll('kbd')].map((node) => node.textContent),
  ).toContain('V');
  panel.show(steps[10]!, 11, 11, true);
  expect(document.querySelector('dialog')?.open).toBe(true);
  const buttons = [...document.querySelectorAll('button')];
  buttons.find((button) => button.textContent === 'Do kryjówki')!.click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub');
  buttons.find((button) => button.textContent === 'Powtórz')!.click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=tutorial');
});

it('wyłączenie błysków działa bez zmiany przypisań', () => {
  panel = new TutorialPanel(document.body);
  loadSettings().flashes = true;
  panel.show(steps[1]!, 2, 11, true);
  expect(document.querySelector('.tutorial-panel--flash')).not.toBeNull();
  loadSettings().flashes = false;
  panel.syncBindings();
  expect(document.querySelector('.tutorial-panel--flash')).toBeNull();
  loadSettings().flashes = true;
});
