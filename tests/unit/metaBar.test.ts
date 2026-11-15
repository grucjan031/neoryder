// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';
import { MetaManager } from '../../src/progression/meta';
import {
  createStarterMetaState,
  progression,
} from '../../src/progression/progressionSchema';
import { createMetaBar } from '../../src/ui/hub/metaBar';
import type { MetaBar } from '../../src/ui/hub/metaBar';

const active: MetaBar[] = [];
afterEach(() => {
  active.splice(0).forEach((bar) => bar.dispose());
  document.body.replaceChildren();
});

function setup() {
  const bus = new EventBus();
  const manager = new MetaManager(createStarterMetaState(), bus);
  const bar = createMetaBar(manager, bus, document.body);
  active.push(bar);
  const text = (selector: string) =>
    bar.root.querySelector(selector)?.textContent;
  return { bus, manager, bar, text };
}

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
  expect(text('.meta-bar__free')).toBe(`Wolne punkty: ${manager.freePoints}`);
});

it('odświeża się po zdarzeniu meta i wyróżnia wolne punkty, gdy jest ich więcej niż 0', () => {
  const { manager, bar, text } = setup();
  const free = bar.root.querySelector<HTMLElement>('.meta-bar__free')!;
  expect(free.dataset.active).toBe('false');
  manager.debugAddXp(1000);
  // debugAddXp emituje level_up, więc pasek odświeża się sam.
  expect(text('.meta-bar__level')).toBe(`Poziom ${manager.level}`);
  expect(manager.level).toBeGreaterThan(1);
  expect(text('.meta-bar__free')).toBe(`Wolne punkty: ${manager.freePoints}`);
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
