// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { MetaManager } from '../../src/progression/meta';
import {
  createStarterMetaState,
  progression,
} from '../../src/progression/progressionSchema';
import { createMetaBar } from '../../src/ui/hub/metaBar';
import textData from '../../src/data/ui/missions.pl.json';
import type { MetaBar } from '../../src/ui/hub/metaBar';

const active: MetaBar[] = [];
it('objaśnia waluty i punkty dymkiem dostępnym z klawiatury', () => {
  const { bar, manager } = setup();
  manager.debugAddData(42);
  manager.debugAddXp(1000);
  bar.refresh();
  for (const [selector, help] of [
    ['[data-stat=data]', textData.bar.dataHelp],
    ['[data-stat=cores]', textData.bar.coresHelp],
    ['.meta-bar__free', textData.bar.freePointsHelp],
  ]) {
    const node = bar.root.querySelector<HTMLElement>(selector!)!;
    expect(node.hasAttribute('title')).toBe(false);
    expect(node.getAttribute('tabindex')).toBe('0');
    const tooltip = document.getElementById(
      node.getAttribute('aria-describedby')!,
    )!;
    expect(tooltip.getAttribute('role')).toBe('tooltip');
    expect(tooltip.textContent).toBe(help);
    node.focus();
    expect(document.activeElement).toBe(node);
    expect(node.getAttribute('aria-label')).toContain(help);
    expect(node.getAttribute('aria-label')).toContain(node.textContent);
  }
});
afterEach(() => {
  active.splice(0).forEach((bar) => bar.dispose());
  document.body.replaceChildren();
  localStorage.clear();
  vi.useRealTimers();
});

function setup(state = createStarterMetaState()) {
  const bus = new EventBus();
  const manager = new MetaManager(state, bus);
  const bar = createMetaBar(manager, bus, document.body);
  active.push(bar);
  const text = (selector: string) =>
    bar.root.querySelector(selector)?.textContent;
  return { bus, manager, bar, text };
}

function rewardedState(data: number, cores: number) {
  const state = createStarterMetaState();
  state.stats.runs = 1;
  state.lastRuns = [
    {
      runId: 'hint:1',
      outcome: 'death',
      elapsedS: 10,
      layerReached: 1,
      threatLevel: 0,
      rewards: { xp: 0, data, cores },
    },
  ];
  return state;
}

it.each([
  [1, 0],
  [0, 1],
])('pokazuje objaśnienie raz na 6 s po nagrodzie %i/%i', (data, cores) => {
  vi.useFakeTimers();
  const state = rewardedState(data!, cores!);
  const { bar } = setup(state);
  const hint = bar.root.querySelector('.meta-bar__currency-hint')!;
  expect(hint.textContent).toContain(textData.bar.dataHelp);
  expect(hint.textContent).toContain(textData.bar.coresHelp);
  expect(localStorage.getItem('neoryder.ui.currencyHint')).toBe('1');
  vi.advanceTimersByTime(5999);
  expect(hint.isConnected).toBe(true);
  vi.advanceTimersByTime(1);
  expect(hint.isConnected).toBe(false);
  bar.refresh();
  expect(bar.root.querySelector('.meta-bar__currency-hint')).toBeNull();
  expect(
    setup(state).bar.root.querySelector('.meta-bar__currency-hint'),
  ).toBeNull();
});

it('nie pokazuje objaśnienia przed runem ani po runie bez nagrody walutowej', () => {
  expect(setup().bar.root.querySelector('.meta-bar__currency-hint')).toBeNull();
  expect(
    setup(rewardedState(0, 0)).bar.root.querySelector(
      '.meta-bar__currency-hint',
    ),
  ).toBeNull();
  expect(localStorage.getItem('neoryder.ui.currencyHint')).toBeNull();
});

it('dispose usuwa timer objaśnienia', () => {
  vi.useFakeTimers();
  const { bar } = setup(rewardedState(1, 0));
  const withHint = vi.getTimerCount();
  expect(withHint).toBeGreaterThan(0);
  bar.dispose();
  expect(vi.getTimerCount()).toBe(withHint - 1);
});

it('pokazuje poziom, doświadczenie, Dane, Rdzenie i wolne punkty ze stanu meta', () => {
  const { manager, bar, text } = setup();
  expect(text('.meta-bar__operator')).toBe('ISKRA // OPERATOR');
  expect(bar.root.dataset.debug).toBe('true');
  expect(text('.meta-bar__level')).toBe('Poziom 1');
  expect(text('.meta-bar__xp-text')).toBe(
    `0 / ${manager.xpProgress.xpForNext} XP`,
  );
  expect(text('[data-stat=data]')).toBe(`Dane: ${manager.state.data}`);
  expect(text('[data-stat=cores]')).toBe(`Rdzenie: ${manager.state.cores}`);
  expect(text('.meta-bar__free')).toBe(
    `Punkty talentów: ${manager.freePoints}`,
  );
});

it('odświeża się po zdarzeniu meta i wyróżnia wolne punkty, gdy jest ich więcej niż 0', () => {
  const { manager, bar, text } = setup();
  const free = bar.root.querySelector<HTMLElement>('.meta-bar__free')!;
  expect(free.dataset.active).toBe('false');
  manager.debugAddXp(1000);
  // debugAddXp emituje level_up, więc pasek odświeża się sam.
  expect(text('.meta-bar__level')).toBe(`Poziom ${manager.level}`);
  expect(manager.level).toBeGreaterThan(1);
  expect(text('.meta-bar__free')).toBe(
    `Punkty talentów: ${manager.freePoints}`,
  );
  expect(free.dataset.active).toBe('true');
});

it('na limicie poziomu pokazuje MAX i pełny pasek', () => {
  const { bus, manager, bar, text } = setup();
  manager.debugAddXp(
    progression.levels.xpToNext.reduce((sum, need) => sum + need, 0) + 10,
  );
  bus.emit('level_up', { level: manager.level });
  expect(text('.meta-bar__xp-text')).toBe('MAX');
  expect(
    bar.root.querySelector<HTMLElement>('.meta-bar__xp-fill')!.style.width,
  ).toBe('100%');
});

it('refresh() czyta Dane i Rdzenie, a dispose zdejmuje nasłuch i DOM', () => {
  const { bus, manager, bar, text } = setup();
  manager.debugAddData(42);
  manager.debugAddCores(3);
  bar.refresh();
  expect(text('[data-stat=data]')).toBe('Dane: 42');
  expect(text('[data-stat=cores]')).toBe('Rdzenie: 3');
  bar.dispose();
  active.pop();
  expect(document.querySelector('.meta-bar')).toBeNull();
  manager.debugAddData(1);
  expect(() => bus.emit('threat_selected', { level: 0 })).not.toThrow();
});
