// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';

const active = new Set<HtmlRunScreens>();
const nodes = Array.from({ length: 4 }, (_, index) => ({
  id: `L1N${index + 1}`,
  index,
  layer: 1,
  type: 'combat' as const,
  next: [],
}));
const view: RunScreenView = {
  screen: 'map',
  nodes,
  summary: null,
  busy: false,
  error: null,
  state: {
    seed: 'test',
    sectorId: 'test',
    loadoutId: 'classic',
    loadout: loadoutDefinitions.get('classic')!,
    talents: [],
    threatLevel: 0,
    startedAtMs: 0,
    elapsedS: 0,
    map: { sectorId: 'test', layers: [nodes] },
    currentNodeId: null,
    visited: [],
    hp: 100,
    energy: 100,
    credits: 0,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  },
};

afterEach(() => {
  for (const screens of active) screens.dispose();
  active.clear();
  document.body.replaceChildren();
});

it('obsługuje mysz, 1/2/3 i Enter, także dla czwartego węzła', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const selectNode = vi.fn();
  screens.show(view, { selectNode, next() {}, menu() {} });
  for (const code of ['Digit1', 'Digit2', 'Digit3'])
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  const buttons =
    document.querySelectorAll<HTMLButtonElement>('.run-screen button');
  buttons[3]!.click();
  buttons[3]!.focus();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(selectNode.mock.calls.map(([id]) => id)).toEqual([
    'L1N1',
    'L1N2',
    'L1N3',
    'L1N4',
    'L1N4',
  ]);
  screens.hide();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
  expect(selectNode).toHaveBeenCalledTimes(5);
});

it('placeholder nagrody ma Dalej; pisanie w konsoli nie uruchamia ekranu', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const next = vi.fn();
  screens.show(
    { ...view, screen: 'reward' },
    { selectNode() {}, next, menu() {} },
  );
  expect(document.querySelector('.run-screen')?.textContent).toContain(
    'brak nagród',
  );
  const input = document.createElement('input');
  document.body.append(input);
  input.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }),
  );
  expect(next).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(next).toHaveBeenCalledOnce();
  screens.dispose();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  expect(next).toHaveBeenCalledOnce();
  expect(document.querySelector('.run-screen')).toBeNull();
});

it('renders real rewards and keyboard selection forwards their ids', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const chooseReward = vi.fn();
  screens.show(
    {
      ...view,
      screen: 'reward',
      offers: [
        { id: 'one', label: 'One' },
        { id: 'two', label: 'Two' },
        { id: 'three', label: 'Three' },
      ],
    },
    { selectNode() {}, next() {}, menu() {}, chooseReward },
  );
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>('.run-screen button'),
  ];
  expect(buttons.map((button) => button.textContent)).toEqual([
    'One',
    'Two',
    'Three',
  ]);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  expect(chooseReward).toHaveBeenCalledExactlyOnceWith('two');
});

it('shop disables unaffordable items and rest forwards the upgrade id', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const buy = vi.fn();
  const rest = vi.fn();
  const actions = { selectNode() {}, next() {}, menu() {}, buy, rest };
  screens.show(
    {
      ...view,
      screen: 'shop',
      state: { ...view.state, credits: 40 },
      offers: [
        { id: 'cheap', label: 'Cheap', price: 30 },
        { id: 'costly', label: 'Costly', price: 75 },
      ],
      healPrice: 35,
    },
    actions,
  );
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>('.run-screen button'),
  ];
  expect(buttons[0]!.textContent).toContain('30');
  expect(buttons[1]!.disabled).toBe(true);
  buttons[1]!.click();
  expect(buy).not.toHaveBeenCalled();
  buttons[0]!.click();
  expect(buy).toHaveBeenCalledExactlyOnceWith('cheap');
  screens.show(
    { ...view, screen: 'rest', offers: [{ id: 'old', label: 'Old' }] },
    actions,
  );
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  expect(rest).toHaveBeenCalledExactlyOnceWith('upgrade', 'old');
});

it('shows implant details, rarity and new synergies on reward cards', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  screens.show(
    {
      ...view,
      screen: 'reward',
      offers: [
        {
          id: 'x',
          label: 'Implant',
          description: 'Opis',
          rarity: 'rare',
          tags: ['#power'],
          synergies: ['Reakcja'],
        },
      ],
    },
    { selectNode() {}, next() {}, menu() {} },
  );
  const button =
    document.querySelector<HTMLButtonElement>('.run-screen button')!;
  expect(button.dataset.rarity).toBe('rare');
  expect(button.textContent).toContain('Opis');
  expect(button.textContent).toContain('#power');
  expect(button.textContent).toContain('Reakcja');
});

it('shows rest upgrade preview and omits upgrades when none are available', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const rest = vi.fn();
  const actions = { selectNode() {}, next() {}, menu() {}, rest };
  screens.show({ ...view, screen: 'rest', offers: [] }, actions);
  expect(document.querySelectorAll('.run-screen button')).toHaveLength(1);
  screens.show(
    {
      ...view,
      screen: 'rest',
      offers: [
        { id: 'old', label: 'Old', rarity: 'common', nextRarity: 'rare' },
      ],
    },
    actions,
  );
  expect(
    document.querySelectorAll('.run-screen button')[1]!.textContent,
  ).toContain('Rzadki');
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' }));
  expect(rest).toHaveBeenCalledWith('upgrade', 'old');
});

it('shows all summary data and dispatches navigation actions', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const newRun = vi.fn();
  const menu = vi.fn();
  screens.show(
    {
      ...view,
      screen: 'summary',
      summary: {
        outcome: 'death',
        seed: 'abc',
        loadoutId: 'classic',
        elapsedS: 125,
        kills: 7,
        elitesCleared: 0,
        threatLevel: 0,
        roomsCleared: 3,
        layerReached: 4,
        implants: ['unknown'],
        damage: { melee: 10, power: 20, gun: 30, other: 5 },
      },
    },
    { selectNode() {}, next() {}, menu, newRun },
  );
  const content = document.querySelector('.run-screen')!.textContent!;
  for (const value of [
    'Porażka',
    '02:05',
    '7',
    '3',
    '4',
    'abc',
    'unknown',
    '10',
    '20',
    '30',
    '5',
  ])
    expect(content).toContain(value);
  expect(document.querySelectorAll('.run-screen__bar')).toHaveLength(4);
  const buttons =
    document.querySelectorAll<HTMLButtonElement>('.run-screen button');
  buttons[0]!.click();
  buttons[1]!.click();
  expect(newRun).toHaveBeenCalledOnce();
  expect(menu).toHaveBeenCalledOnce();
});

const summaryView: RunScreenView = {
  ...view,
  screen: 'summary',
  summary: {
    outcome: 'victory',
    seed: 'abc',
    loadoutId: 'custom',
    elapsedS: 60,
    kills: 7,
    elitesCleared: 1,
    threatLevel: 2,
    roomsCleared: 3,
    layerReached: 4,
    implants: [],
    damage: { melee: 10, power: 20, gun: 30, other: 5 },
  },
};

it('podsumowanie pokazuje nagrody meta, awans poziomu i odblokowany Poziom zagrożenia', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  const hub = vi.fn();
  const newRun = vi.fn();
  const menu = vi.fn();
  screens.show(
    {
      ...summaryView,
      meta: {
        rewards: { xp: 120, data: 45, cores: 4 },
        levelBefore: 3,
        levelAfter: 4,
        threatUnlocked: true,
      },
    },
    { selectNode() {}, next() {}, menu, newRun, hub },
  );
  const rewards = document.querySelector('[data-testid="run-meta-rewards"]')!;
  expect(rewards.textContent).toContain('Doświadczenie: +120');
  expect(rewards.textContent).toContain('Dane: +45');
  expect(rewards.textContent).toContain('Rdzenie: +4');
  expect(rewards.textContent).toContain('Poziom 3 → 4');
  expect(rewards.textContent).toContain('Odblokowano Poziom zagrożenia 3');
  const buttons =
    document.querySelectorAll<HTMLButtonElement>('.run-screen button');
  expect(buttons[0]!.textContent).toBe('Wróć do kryjówki');
  buttons[0]!.click();
  buttons[1]!.click();
  buttons[2]!.click();
  expect(hub).toHaveBeenCalledOnce();
  expect(newRun).toHaveBeenCalledOnce();
  expect(menu).toHaveBeenCalledOnce();
});

it('podsumowanie bez awansu i odblokowania nie pokazuje tych wierszy, a bez meta - sekcji nagród', () => {
  const screens = new HtmlRunScreens();
  active.add(screens);
  screens.show(
    {
      ...summaryView,
      meta: {
        rewards: { xp: 10, data: 5, cores: 0 },
        levelBefore: 2,
        levelAfter: 2,
        threatUnlocked: false,
      },
    },
    { selectNode() {}, next() {}, menu() {} },
  );
  const text = document.querySelector('.run-screen')!.textContent!;
  expect(text).not.toContain('Awans');
  expect(text).not.toContain('Odblokowano Poziom zagrożenia');
  expect(text).not.toContain('Wróć do kryjówki');
  screens.show(summaryView, { selectNode() {}, next() {}, menu() {} });
  expect(document.querySelector('[data-testid="run-meta-rewards"]')).toBeNull();
});
