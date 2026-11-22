// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { threatLevels } from '../../src/progression/threatSchema';
import { createMissionsPanel } from '../../src/ui/hub/missionsPanel';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { missionDefinitions } from '../../src/world/missions';
import text from '../../src/data/ui/missions.pl.json';

const active: HubPanel[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  active.splice(0).forEach((panel) => panel.dispose());
  document.body.replaceChildren();
});

function setup(max = 0, selected = 0, completed: string[] = []) {
  const state = createStarterMetaState();
  state.campaign.completed = completed;
  const manager = new MetaManager(state, new EventBus());
  manager.debugSetThreatMax(max);
  if (selected > 0) manager.selectThreat(selected);
  const save = vi.fn(async () => {});
  const navigate = vi.fn();
  const close = vi.fn();
  const panel = createMissionsPanel({ manager, save, navigate, close });
  document.body.append(panel.root);
  active.push(panel);
  const level = (n: number) =>
    panel.root.querySelector<HTMLButtonElement>(`[data-level="${n}"]`)!;
  return { manager, save, navigate, panel, level };
}

it('blokada pokazuje numer i tytuł wymaganej misji, a nieznany wymóg zachowuje id', () => {
  const original = missionDefinitions.get('m01-maszty')!;
  const required = [...missionDefinitions.values()].find(
    (m) => m.id !== original.id,
  )!;
  const get = missionDefinitions.get.bind(missionDefinitions);
  vi.spyOn(missionDefinitions, 'values').mockImplementation(() =>
    [{ ...original, requires: [required.id, 'missing-definition'] }].values(),
  );
  vi.spyOn(missionDefinitions, 'get').mockImplementation(get);
  const { panel } = setup();
  const button = panel.root.querySelector<HTMLButtonElement>(
    '[data-mission="m01-maszty"]',
  )!;
  expect(button.disabled).toBe(true);
  expect(button.textContent).toContain(
    `Wymagane misje: ${String(required.number).padStart(2, '0')} · ${required.title}, missing-definition`,
  );
  expect(button.textContent).not.toContain(required.id);
});

it.each([
  [undefined, ''],
  [0, ''],
  [1, ', +1 Rdzeń'],
  [2, ', +2 Rdzenie'],
  [5, ', +5 Rdzeni'],
  [12, ', +12 Rdzeni'],
  [22, ', +22 Rdzenie'],
] as const)('nagroda pierwszego ukończenia: rdzenie %s', (cores, suffix) => {
  const original = missionDefinitions.get('m01-maszty')!;
  vi.spyOn(missionDefinitions, 'values').mockImplementation(() =>
    [{ ...original, rewards: { firstClear: { data: 123, cores } } }].values(),
  );
  HTMLElement.prototype.scrollIntoView ??= () => {};
  const { panel } = setup();
  panel.root
    .querySelector<HTMLButtonElement>('[data-mission="m01-maszty"]')!
    .click();
  const reward = panel.root.querySelector<HTMLElement>('[data-first-clear]')!;
  expect(reward.hidden).toBe(false);
  expect(reward.textContent).toBe(
    `Nagroda za pierwsze ukończenie: +123 Danych${suffix}`,
  );
  panel.root
    .querySelector<HTMLButtonElement>('[data-mission-briefing] > button')!
    .click();
  expect(reward.hidden).toBe(true);
});

it('ukrywa nagłówek poziomów po wyborze misji i przywraca po powrocie', () => {
  HTMLElement.prototype.scrollIntoView ??= () => {};
  const { panel } = setup();
  const heading = [...panel.root.querySelectorAll('h3')].find(
    (node) => node.textContent === text.missions.threat.heading,
  )!;
  expect(heading.hidden).toBe(false);
  panel.root
    .querySelector<HTMLButtonElement>('[data-mission="m01-maszty"]')!
    .click();
  expect(heading.hidden).toBe(true);
  panel.root
    .querySelector<HTMLButtonElement>('[data-mission-briefing] > button')!
    .click();
  expect(heading.hidden).toBe(false);
});

it('ukończona misja pokazuje odebraną nagrodę', () => {
  HTMLElement.prototype.scrollIntoView ??= () => {};
  const { panel } = setup(0, 0, ['m01-maszty']);
  panel.root
    .querySelector<HTMLButtonElement>('[data-mission="m01-maszty"]')!
    .click();
  expect(panel.root.querySelector('[data-first-clear]')!.textContent).toBe(
    text.missions.firstClear.claimed,
  );
});

it('pokazuje kartę sektora Kurogane Arms i poziomy 0..ostatni z nazwami', () => {
  const { panel, level } = setup();
  expect(panel.root.textContent).toContain('Kurogane Arms');
  expect(panel.root.querySelectorAll('[data-level]')).toHaveLength(
    threatLevels.length,
  );
  expect(level(0).textContent).toContain('Poziom 0');
  expect(level(0).textContent).toContain(threatLevels[0]!.name);
});

it('poziomy powyżej max są nieaktywne z podpowiedzią, a kliknięcie nic nie zmienia ani nie zapisuje', async () => {
  const { manager, save, level } = setup(2);
  expect(level(2).getAttribute('aria-disabled')).toBe('false');
  expect(level(3).getAttribute('aria-disabled')).toBe('true');
  expect(level(3).textContent).toContain(
    'Wygraj na poziomie 2, aby odblokować',
  );
  expect(level(5).textContent).toContain(
    'Wygraj na poziomie 4, aby odblokować',
  );
  level(3).click();
  await Promise.resolve();
  expect(manager.state.threat.selected).toBe(0);
  expect(save).not.toHaveBeenCalled();
});

it('wybór dostępnego poziomu zapisuje threat.selected, zapisuje meta i odświeża opis', async () => {
  const { manager, save, panel, level } = setup(2);
  level(2).click();
  await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(manager.state.threat.selected).toBe(2);
  const details = panel.root.querySelector('.missions-panel__details')!;
  const threat = threatLevels[2]!;
  expect(details.textContent).toContain(
    `Wrogowie +${Math.round(threat.enemyHealth * 100)}% zdrowia, +${Math.round(threat.enemyDamage * 100)}% obrażeń, +${Math.round((threat.budgetMult - 1) * 100)}% liczebności`,
  );
  expect(details.textContent).toContain(
    `Nagrody +${Math.round((threat.rewardMult - 1) * 100)}%`,
  );
  expect(details.textContent).toContain('1 Rdzeń za zwycięstwo');
  await vi.waitFor(() =>
    expect(level(2).getAttribute('aria-pressed')).toBe('true'),
  );
  expect(level(0).getAttribute('aria-pressed')).toBe('false');
});

it('poziom 0 nie ma modyfikatorów, poziom zalecany (max) jest oznaczony', () => {
  const { panel, level } = setup(3);
  expect(
    panel.root.querySelector('.missions-panel__details')!.textContent,
  ).toContain('Bez modyfikatorów wrogów');
  expect(level(3).textContent).toContain('zalecany');
  expect(level(2).textContent).not.toContain('zalecany');
});

it('Rozpocznij run nawiguje na run z ekwipunkiem meta i seedem z pola lub losowym', () => {
  const { panel, navigate } = setup();
  const start = panel.root.querySelector<HTMLButtonElement>(
    '[data-action=start-run]',
  )!;
  const input = panel.root.querySelector<HTMLInputElement>('input')!;
  input.value = '  mój seed ';
  start.click();
  const first = new URLSearchParams(
    (navigate.mock.calls[0]![0] as string).slice(1),
  );
  expect(first.get('scene')).toBe('run');
  expect(first.get('loadout')).toBe('meta');
  expect(first.get('seed')).toBe('mój seed');
  input.value = '';
  start.click();
  const second = new URLSearchParams(
    (navigate.mock.calls[1]![0] as string).slice(1),
  );
  expect(second.get('seed')).toMatch(/^[0-9a-f]+(-[0-9a-f]+){3}$/);
});

it('Przejęcie bez wpisanego seeda zachowuje domyślną arenę, wpisany seed wybiera deterministycznie', () => {
  const { panel, navigate } = setup();
  panel.root.querySelector<HTMLButtonElement>('[data-mode=conquest]')!.click();
  const start = panel.root.querySelector<HTMLButtonElement>(
    '[data-action=start-run]',
  )!;
  start.click();
  const first = new URLSearchParams(
    (navigate.mock.calls[0]![0] as string).slice(1),
  );
  expect(first.get('mode')).toBe('conquest');
  expect(first.has('seed')).toBe(false);
  panel.root.querySelector<HTMLInputElement>('input')!.value = 'port-review';
  start.click();
  expect(
    new URLSearchParams((navigate.mock.calls[1]![0] as string).slice(1)).get(
      'seed',
    ),
  ).toBe('port-review');
});

it('refresh czyta stan meta, a błąd zapisu trafia do statusu', async () => {
  const { manager, panel, level, save } = setup(3);
  manager.selectThreat(1);
  panel.refresh();
  expect(level(1).getAttribute('aria-pressed')).toBe('true');
  save.mockRejectedValueOnce(new Error('dysk pełny'));
  level(2).click();
  await vi.waitFor(() =>
    expect(panel.root.querySelector('[role=status]')!.textContent).toBe(
      'dysk pełny',
    ),
  );
});

it('dispose usuwa panel z DOM', () => {
  const { panel } = setup();
  panel.dispose();
  expect(document.querySelector('.missions-panel')).toBeNull();
});

it('odprawa misji ukrywa nagłówek Poziomu zagrożenia i listę, a Wstecz je przywraca', () => {
  Element.prototype.scrollIntoView = vi.fn();
  const { panel } = setup();
  const heading = panel.root.querySelector<HTMLElement>(
    ':scope > .missions-panel__heading',
  )!;
  const list = panel.root.querySelector<HTMLElement>(
    '.missions-panel__levels',
  )!;
  const mission = [
    ...panel.root.querySelectorAll<HTMLButtonElement>('[data-mission]'),
  ].find((button) => button.dataset.mission !== 'regular' && !button.disabled)!;
  mission.click();
  const briefing = panel.root.querySelector<HTMLElement>(
    '[data-mission-briefing]',
  )!;
  expect(briefing.hidden).toBe(false);
  expect(heading.textContent).toContain('Poziom zagrożenia');
  expect(heading.hidden).toBe(true);
  expect(list.hidden).toBe(true);
  const dialogue = briefing.querySelector<HTMLElement>(
    '.mission-dialogue-player',
  )!;
  const briefingHeading = briefing.querySelector<HTMLElement>('h3')!;
  expect(briefingHeading.hidden).toBe(!dialogue.hidden);
  [...briefing.querySelectorAll('button')]
    .find((button) => button.textContent === 'Wróć do tablicy')
    ?.click();
  expect(heading.hidden).toBe(false);
  expect(list.hidden).toBe(false);
});
