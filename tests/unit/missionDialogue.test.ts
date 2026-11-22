// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { tuning } from '../../src/core/tuning';
import { MissionDialogue } from '../../src/ui/missionDialogue';
import { showDebrief } from '../../src/ui/missionUi';
import { missionDefinitions } from '../../src/world/missions';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function space(target: Element, repeat = false): boolean {
  return target.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
      repeat,
    }),
  );
}

it('klik odsłania tekst, spacja zmienia mówiącego, a przerywnik przechodzi w odprawę', () => {
  const dialogue = new MissionDialogue([
    {
      title: 'Przerywnik',
      interlude: true,
      lines: [{ speaker: 'szron', text: 'Pierwsza kwestia.' }],
    },
    { title: 'Odprawa', lines: [{ speaker: 'mira', text: 'Druga kwestia.' }] },
  ]);
  document.body.append(dialogue.root);
  try {
    const card = dialogue.root.querySelector<HTMLElement>('.mission-dialogue')!;
    const line = card.querySelector('p')!;
    expect(dialogue.root.querySelectorAll('.mission-dialogue')).toHaveLength(1);
    expect(dialogue.root.hasAttribute('data-mission-interlude')).toBe(true);
    expect(card.querySelector('strong')!.textContent).toBe('Szron');
    expect(card.querySelector('.mission-dialogue__icon')!.textContent).toBe(
      'Sz',
    );
    expect(line.textContent).toBe('P');
    vi.advanceTimersByTime(50);
    expect(line.textContent!.length).toBeGreaterThan(1);
    expect(line.textContent).not.toBe('Pierwsza kwestia.');
    card.click();
    expect(line.textContent).toBe('Pierwsza kwestia.');
    expect(document.activeElement).toBe(dialogue.root);
    expect(space(dialogue.root, true)).toBe(false);
    expect(line.textContent).toBe('Pierwsza kwestia.');
    expect(space(dialogue.root)).toBe(false);
    expect(dialogue.root.hasAttribute('data-mission-interlude')).toBe(false);
    expect(dialogue.root.querySelector('h3')!.textContent).toBe('Odprawa');
    expect(card.querySelector('strong')!.textContent).toBe('Mira');
    expect(line.textContent).toBe('D');
    space(dialogue.root);
    expect(line.textContent).toBe('Druga kwestia.');
    expect(dialogue.root.querySelector('button')!.hidden).toBe(true);
  } finally {
    dialogue.dispose();
  }
});

it('auto jest domyślnie wyłączone, czeka po odsłonięciu strony i sprząta timer przy zamknięciu', () => {
  const dialogue = new MissionDialogue([
    {
      lines: [
        { speaker: 'bajt', text: 'Pierwszy.' },
        { speaker: 'wolan', text: 'Drugi.' },
      ],
    },
  ]);
  document.body.append(dialogue.root);
  try {
    const auto = dialogue.root.querySelector('input')!;
    const line = dialogue.root.querySelector('p')!;
    const delay = tuning.mission.dialogueAutoMinS * 1000;
    expect(auto.checked).toBe(false);
    vi.runAllTimers();
    expect(line.textContent).toBe('Pierwszy.');
    auto.click();
    vi.advanceTimersByTime(delay - 1);
    expect(line.textContent).toBe('Pierwszy.');
    auto.click();
    vi.advanceTimersByTime(delay);
    expect(line.textContent).toBe('Pierwszy.');
    auto.click();
    vi.advanceTimersByTime(delay);
    expect(line.textContent).toBe('D');
    expect(vi.getTimerCount()).toBe(1);
  } finally {
    dialogue.dispose();
  }
  expect(vi.getTimerCount()).toBe(0);
});

it('ograniczony ruch odsłania kolejne strony długiej kwestii od razu', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const first = 'Zostań na kanale. '.repeat(7).trim();
  const second = 'Korytarz jest pusty. Wracaj na Kamienną.';
  const dialogue = new MissionDialogue([
    { lines: [{ speaker: 'tomasz', text: `${first} ${second}` }] },
  ]);
  document.body.append(dialogue.root);
  try {
    const line = dialogue.root.querySelector('p')!;
    expect(line.textContent).toBe(`${first} Korytarz jest pusty.`);
    space(dialogue.root);
    expect(line.textContent).toBe('Wracaj na Kamienną.');
    expect(dialogue.root.querySelector('strong')!.textContent).toBe('Tomasz');
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    dialogue.dispose();
  }
});

it('zamknięcie debriefu czeka na zapis i po błędzie pozwala ponowić próbę', async () => {
  const close = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error('błąd zapisu'))
    .mockResolvedValueOnce(undefined);
  const prototype = HTMLDialogElement.prototype;
  prototype.showModal = function () {
    this.open = true;
  };
  prototype.close = function () {
    this.open = false;
  };
  let dispose: (() => void) | undefined;
  try {
    dispose = showDebrief(missionDefinitions.get('m01-maszty')!, close);
    const dialog = document.querySelector('dialog')!;
    const player = dialog.querySelector<HTMLElement>(
      '.mission-dialogue-player',
    )!;
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(player);
    const line = player.querySelector('p')!;
    const visibleText = line.textContent;
    const button = dialog.querySelector<HTMLButtonElement>('dialog > button')!;
    button.click();
    expect(button.disabled).toBe(true);
    await Promise.resolve();
    expect(dialog.open).toBe(true);
    expect(button.disabled).toBe(false);
    button.click();
    await Promise.resolve();
    expect(dialog.isConnected).toBe(false);
    expect(close).toHaveBeenCalledTimes(2);
    vi.runAllTimers();
    expect(line.textContent).toBe(visibleText);
  } finally {
    dispose?.();
    Reflect.deleteProperty(prototype, 'showModal');
    Reflect.deleteProperty(prototype, 'close');
  }
});
