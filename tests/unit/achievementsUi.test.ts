// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import {
  ACHIEVEMENT_TOAST_MS,
  AchievementToast,
} from '../../src/ui/achievementToast';
import { rewardLabel } from '../../src/ui/achievementText';
import { createAchievementsPanel } from '../../src/ui/hub/achievementsPanel';
import type { HubPanel } from '../../src/ui/hub/hubPanel';
import { createTalentsPanel } from '../../src/ui/hub/talentsPanel';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';
import { unlockRows } from '../../src/ui/hub/workshopState';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';

const disposables: { dispose(): void }[] = [];
afterEach(() => {
  disposables.splice(0).forEach((item) => item.dispose());
  document.body.replaceChildren();
  vi.useRealTimers();
});

const manager = () => new MetaManager(createStarterMetaState());
const mount = <T extends HubPanel>(panel: T): T => {
  disposables.push(panel);
  document.body.append(panel.root);
  return panel;
};
const card = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`.achv-card[data-id="${id}"]`)!;

describe('panel Naszywki Iskry', () => {
  it('pokazuje wszystkie naszywki: zdobyte i brakujące z podpowiedzią i postępem', () => {
    const meta = manager();
    meta.debugGrantAchievement('pierwsza-krew');
    meta.applyRun(
      {
        outcome: 'death',
        seed: 's',
        loadoutId: 'custom',
        elapsedS: 1,
        kills: 0,
        roomsCleared: 0,
        elitesCleared: 0,
        threatLevel: 0,
        layerReached: 1,
        implants: [],
        damage: { melee: 0, power: 0, gun: 0, other: 0 },
        achievements: { counters: { parry_success: 10 }, flags: [] },
      },
      'r1',
    );
    const panel = mount(createAchievementsPanel(meta));
    expect(panel.root.querySelectorAll('.achv-card')).toHaveLength(26);
    expect(panel.root.querySelectorAll('.achv-group')).toHaveLength(4);
    expect(panel.root.querySelector('.achv-panel__count')!.textContent).toBe(
      'Zdobyte: 1 z 26',
    );
    const earned = card(panel.root, 'pierwsza-krew');
    expect(earned.dataset.state).toBe('earned');
    expect(earned.querySelector('.achv-card__hint')).toBeNull();
    const missing = card(panel.root, 'zwierciadlo');
    expect(missing.dataset.state).toBe('missing');
    expect(missing.querySelector('.achv-card__hint')!.textContent).toContain(
      'Zablokuj ostrzem',
    );
    const bar = missing.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('10');
    expect(bar.getAttribute('aria-valuemax')).toBe('25');
    expect(missing.querySelector('.achv-card__progress')!.textContent).toBe(
      '10 / 25',
    );
    expect(missing.querySelector('.achv-card__reward')!.textContent).toContain(
      '20 Danych',
    );
    expect(
      card(panel.root, 'seria').querySelector('[role="progressbar"]'),
    ).toBeNull();
    expect(
      card(panel.root, 'taniec-ostrza').querySelector('.achv-card__gate')!
        .textContent,
    ).toContain('Ostrze dwustronne');
    expect(card(panel.root, 'egzekutor').getAttribute('aria-label')).toContain(
      'Niezdobyta',
    );
  });

  it('refresh odzwierciedla nowy stan, a strzałki i Home/End przenoszą fokus', () => {
    const meta = manager();
    const panel = mount(createAchievementsPanel(meta));
    const cards = [...panel.root.querySelectorAll<HTMLElement>('.achv-card')];
    expect(cards.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    cards[0]!.focus();
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    press('ArrowRight');
    expect((document.activeElement as HTMLElement).dataset.id).toBe(
      cards[1]!.dataset.id,
    );
    press('End');
    expect((document.activeElement as HTMLElement).dataset.id).toBe(
      cards.at(-1)!.dataset.id,
    );
    press('Home');
    expect((document.activeElement as HTMLElement).dataset.id).toBe(
      cards[0]!.dataset.id,
    );
    meta.debugGrantAchievement('seria');
    panel.refresh();
    expect(card(panel.root, 'seria').dataset.state).toBe('earned');
    expect(panel.root.querySelector('.achv-panel__count')!.textContent).toBe(
      'Zdobyte: 1 z 26',
    );
  });

  it('terminal drzewek ma zakładkę Naszywki Iskry dostępną klawiaturą', () => {
    const meta = manager();
    const panel = mount(
      createTalentsPanel({
        manager: meta,
        save: () => Promise.resolve(),
        navigate: () => {},
        close: () => {},
      }),
    );
    const tabs = panel.root.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs).toHaveLength(2);
    const views = panel.root.querySelectorAll<HTMLElement>('[role="tabpanel"]');
    expect(views[0]!.hidden).toBe(false);
    expect(views[1]!.hidden).toBe(true);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    tabs[0]!.focus();
    tabs[0]!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    expect(views[1]!.hidden).toBe(false);
    expect(views[0]!.hidden).toBe(true);
    expect(panel.root.querySelectorAll('.achv-card')).toHaveLength(26);
    tabs[0]!.click();
    expect(views[0]!.hidden).toBe(false);
    expect(panel.root.querySelector('.talents-node')).not.toBeNull();
  });
});

describe('warsztat: bramka naszywki', () => {
  it('wiersz z wymaganą naszywką ma status achievement, kłódkę i nazwę osiągnięcia', () => {
    const meta = manager();
    meta.debugAddCores(100);
    meta.debugAddXp(5000);
    const row = unlockRows(meta).find((r) => r.id === 'blade:staffBlade')!;
    expect(row.status).toBe('achievement');
    expect(row.requires).toEqual({
      id: 'taniec-ostrza',
      title: 'Taniec ostrza',
    });
    const panel = mount(
      createWorkshopPanel({
        manager: meta,
        save: () => Promise.resolve(),
        navigate: () => {},
        close: () => {},
      }),
    );
    const node = panel.root.querySelector<HTMLElement>(
      '[data-unlock="blade:staffBlade"]',
    )!;
    expect(node.dataset.status).toBe('achievement');
    expect(node.querySelector('.achv-lock')).not.toBeNull();
    expect(node.textContent).toContain('Wymaga naszywki: Taniec ostrza');
    expect(node.querySelector<HTMLButtonElement>('button')!.disabled).toBe(
      true,
    );
    meta.debugGrantAchievement('taniec-ostrza');
    panel.refresh();
    const unlocked = panel.root.querySelector<HTMLElement>(
      '[data-unlock="blade:staffBlade"]',
    )!;
    expect(unlocked.dataset.status).toBe('buyable');
    expect(unlocked.querySelector('.achv-lock')).toBeNull();
  });
});

describe('komunikat w HUD', () => {
  it('pokazuje „Naszywka: tytuł” przez 3 s, potem znika; kolejne czekają w kolejce', () => {
    vi.useFakeTimers();
    const bus = new EventBus();
    const toast = new AchievementToast(bus);
    disposables.push(toast);
    expect(toast.node.hidden).toBe(true);
    bus.emit('achievement_earned', { id: 'pierwsza-krew' });
    bus.emit('achievement_earned', { id: 'seria' });
    expect(toast.node.hidden).toBe(false);
    expect(toast.node.textContent).toBe('Naszywka: Pierwsza krew');
    vi.advanceTimersByTime(ACHIEVEMENT_TOAST_MS - 1);
    expect(toast.node.textContent).toBe('Naszywka: Pierwsza krew');
    vi.advanceTimersByTime(1);
    expect(toast.node.textContent).toBe('Naszywka: Seria');
    vi.advanceTimersByTime(ACHIEVEMENT_TOAST_MS);
    expect(toast.node.hidden).toBe(true);
    expect(ACHIEVEMENT_TOAST_MS).toBe(3000);
  });

  it('ignoruje nieznane id i po dispose znika z DOM', () => {
    const bus = new EventBus();
    const toast = new AchievementToast(bus);
    bus.emit('achievement_earned', { id: 'nie-ma' });
    expect(toast.node.hidden).toBe(true);
    toast.dispose();
    expect(document.querySelector('.achv-toast')).toBeNull();
    bus.emit('achievement_earned', { id: 'seria' });
    expect(document.querySelector('.achv-toast')).toBeNull();
  });
});

describe('podsumowanie runu', () => {
  it('pokazuje nowe naszywki z nagrodami', () => {
    const screens = new HtmlRunScreens();
    disposables.push(screens);
    const base: RunScreenView = {
      screen: 'summary',
      state: {} as RunScreenView['state'],
      nodes: [],
      summary: {
        outcome: 'victory',
        seed: 'abc',
        loadoutId: 'custom',
        elapsedS: 60,
        kills: 7,
        elitesCleared: 1,
        threatLevel: 0,
        roomsCleared: 3,
        layerReached: 4,
        implants: [],
        damage: { melee: 10, power: 20, gun: 30, other: 5 },
      },
      busy: false,
      error: null,
      offers: [],
    };
    screens.show(
      {
        ...base,
        meta: {
          rewards: { xp: 1, data: 1, cores: 0 },
          levelBefore: 1,
          levelAfter: 1,
          threatUnlocked: false,
          achievements: [
            { id: 'pierwsze-zwyciestwo', reward: { data: 20, cores: 0 } },
            { id: 'upadek-brandta', reward: { data: 0, cores: 1 } },
          ],
        },
      },
      { selectNode() {}, next() {}, menu() {} },
    );
    const box = document.querySelector('[data-testid="run-achievements"]')!;
    expect(box.textContent).toContain('Nowe naszywki Iskry');
    expect(box.textContent).toContain('Pierwsze zwycięstwo — 20 Danych');
    expect(box.textContent).toContain('Upadek Brandta — 1 Rdzeń');
    expect(box.querySelectorAll('svg')).toHaveLength(2);
    screens.show(
      {
        ...base,
        meta: {
          rewards: { xp: 1, data: 1, cores: 0 },
          levelBefore: 1,
          levelAfter: 1,
          threatUnlocked: false,
        },
      },
      { selectNode() {}, next() {}, menu() {} },
    );
    expect(
      document.querySelector('[data-testid="run-achievements"]'),
    ).toBeNull();
  });
});

describe('etykiety nagród', () => {
  it('odmiana Rdzeni i łączenie nagród', () => {
    expect(rewardLabel({ data: 10 })).toBe('10 Danych');
    expect(rewardLabel({ cores: 1 })).toBe('1 Rdzeń');
    expect(rewardLabel({ cores: 2 })).toBe('2 Rdzenie');
    expect(rewardLabel({ cores: 5 })).toBe('5 Rdzeni');
    expect(rewardLabel({ data: 5, cores: 12 })).toBe('5 Danych i 12 Rdzeni');
  });
});
