// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PadFrame } from '../../src/core/input/gamepad';
import { loadoutDefinitions } from '../../src/progression/loadout';
import { ChallengeHistoryScreen } from '../../src/ui/challengeHistory';
import { PadNavigation } from '../../src/ui/padNavigation';
import { RunInventoryMenu } from '../../src/ui/runInventory';
import type { RunInventoryView } from '../../src/ui/runInventory';
import { HtmlRunScreens } from '../../src/ui/runScreens';
import type { RunScreenView } from '../../src/ui/runScreens';

const nodes = [
  { id: 'L1N1', index: 0, layer: 1, type: 'combat' as const, next: [] },
];
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
    credits: 100,
    implants: [],
    stats: { kills: 0, damage: { melee: 0, power: 0, gun: 0, other: 0 } },
  },
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const frame = (buttons: number[]): PadFrame => ({
  pad: {
    id: 'pad',
    axes: [],
    buttons: [],
    index: 0,
    mapping: 'standard',
    connected: true,
    timestamp: 0,
  },
  layout: 'generic',
  buttons: new Set(buttons),
  pressed: new Set(buttons),
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  active: true,
});
const rect = (node: Element, x: number, y: number): void => {
  (node as HTMLElement).getBoundingClientRect = () => new DOMRect(x, y, 50, 50);
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
});

function shop(buy = vi.fn(), credits = 100) {
  const screens = new HtmlRunScreens();
  cleanups.push(() => screens.dispose());
  screens.show(
    {
      ...view,
      screen: 'shop',
      state: { ...view.state, credits },
      offers: [
        { id: 'cheap', label: 'Tani', price: 30 },
        { id: 'costly', label: 'Drogi', price: 75 },
      ],
      healPrice: 35,
    },
    { selectNode() {}, next() {}, menu() {}, buy },
  );
  return { buy, screens };
}

describe('sklep w runie: zakup przez okno potwierdzenia', () => {
  it('Esc/anulowanie nie kupuje, potwierdzenie kupuje raz i pokazuje stan po zakupie', async () => {
    const { buy } = shop();
    const cards =
      document.querySelectorAll<HTMLButtonElement>('.run-screen__card');
    cards[0]!.click();
    const modal = document.querySelector<HTMLDialogElement>('dialog.ui-modal')!;
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.textContent).toContain('Tani za 30 kredytów');
    expect(modal.textContent).toContain('zostanie ci 70');
    modal.dispatchEvent(new Event('cancel', { cancelable: true }));
    await flush();
    expect(buy).not.toHaveBeenCalled();
    cards[0]!.click();
    document
      .querySelector<HTMLButtonElement>('dialog.ui-modal .ui-button--primary')!
      .click();
    await flush();
    expect(buy).toHaveBeenCalledExactlyOnceWith('cheap');
  });

  it('leczenie też pyta o zgodę, a Enter w oknie nie kupuje pierwszej oferty', async () => {
    const { buy } = shop();
    const heal =
      document.querySelector<HTMLButtonElement>('.run-screen__heal')!;
    heal.click();
    const confirm = document.querySelector<HTMLButtonElement>(
      'dialog.ui-modal .ui-button--primary',
    )!;
    confirm.focus();
    confirm.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Enter',
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    expect(buy).not.toHaveBeenCalled();
    confirm.click();
    await flush();
    expect(buy).toHaveBeenCalledExactlyOnceWith('heal');
  });

  it('za mało kredytów: karta jest zablokowana i nie otwiera okna', () => {
    const { buy } = shop(vi.fn(), 40);
    const cards =
      document.querySelectorAll<HTMLButtonElement>('.run-screen__card');
    expect(cards[1]!.disabled).toBe(true);
    cards[1]!.click();
    expect(document.querySelector('dialog.ui-modal')).toBeNull();
    expect(buy).not.toHaveBeenCalled();
  });
});

describe('podsumowanie i ekrany runu', () => {
  it('porażka: wynik bez czerwieni (znak ✕ i ciepła biel w CSS), nagrody obok statystyk', () => {
    const screens = new HtmlRunScreens();
    cleanups.push(() => screens.dispose());
    screens.show(
      {
        ...view,
        screen: 'summary',
        summary: {
          outcome: 'death',
          seed: 'x',
          kills: 3,
          roomsCleared: 1,
          layerReached: 1,
          elapsedS: 65,
          implants: [],
          damage: { melee: 5, power: 1, gun: 2, other: 0 },
          threatLevel: 0,
        } as unknown as NonNullable<RunScreenView['summary']>,
        meta: {
          rewards: { xp: 10, data: 5, cores: 1 },
          levelBefore: 1,
          levelAfter: 1,
          threatUnlocked: false,
        },
      },
      { selectNode() {}, next() {}, menu() {}, hub() {} },
    );
    const outcome = document.querySelector<HTMLElement>(
      '.run-screen__outcome',
    )!;
    expect(outcome.dataset.outcome).toBe('death');
    expect(outcome.textContent).toBe('Porażka');
    const layout = document.querySelector('.run-summary')!;
    expect(
      layout.querySelector('.run-summary__main .run-screen__stats'),
    ).not.toBeNull();
    expect(
      layout.querySelector(
        '.run-summary__side [data-testid="run-meta-rewards"]',
      ),
    ).not.toBeNull();
    // Akcje zajmują całą szerokość pod obiema kolumnami.
    expect(layout.lastElementChild?.className).toBe('run-screen__actions');
    const css = readFileSync('src/ui/runScreens.css', 'utf8');
    const death = css.slice(css.indexOf("data-outcome='death'"));
    expect(death.slice(0, 200)).toContain('--c-warm');
    expect(css).not.toMatch(/--c-enemy|--hud-danger|#ff6b6f|#e0262b/);
  });

  it('klawisze 1/2/3 nie działają, gdy fokus jest na liście modułu elity', () => {
    const screens = new HtmlRunScreens();
    cleanups.push(() => screens.dispose());
    const chooseReward = vi.fn();
    screens.show(
      {
        ...view,
        screen: 'reward',
        offers: [{ id: 'i', label: 'Implant' }],
        moduleOffers: ['pierce', 'incendiary'],
      },
      { selectNode() {}, next() {}, menu() {}, chooseReward },
    );
    const trigger = document.querySelector<HTMLButtonElement>(
      '.ui-select__trigger',
    )!;
    trigger.focus();
    trigger.dispatchEvent(
      new KeyboardEvent('keydown', {
        code: 'Digit1',
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(chooseReward).not.toHaveBeenCalled();
  });

  it('pad: D-pad przechodzi po kartach nagrody, A wybiera, wskazówka ma glify', () => {
    const screens = new HtmlRunScreens();
    cleanups.push(() => screens.dispose());
    const chooseReward = vi.fn();
    screens.show(
      {
        ...view,
        screen: 'reward',
        offers: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
      { selectNode() {}, next() {}, menu() {}, chooseReward },
    );
    const cards = [
      ...document.querySelectorAll<HTMLButtonElement>('.run-screen__card'),
    ];
    rect(cards[0]!, 0, 0);
    rect(cards[1]!, 100, 0);
    expect(
      document.querySelector('.run-screen__bar-hint .ui-actionbar')
        ?.textContent,
    ).toContain('Wybierz');
    const nav = new PadNavigation();
    cards[0]!.focus();
    nav.update(frame([15]), 0);
    expect(document.activeElement).toBe(cards[1]);
    nav.update(frame([0]), 0);
    expect(chooseReward).toHaveBeenCalledExactlyOnceWith('b');
  });
});

describe('ekwipunek runu (Tab): trzy kolumny', () => {
  const inventory: RunInventoryView = {
    credits: 12,
    implants: [
      { name: 'Impl', description: 'Opis', rarity: 'epic', tags: ['#gun'] },
    ],
    synergies: [{ name: 'Syn', description: 'Opis synergii' }],
    powers: [{ name: 'Moc', description: 'Opis mocy' }],
    weapons: [
      {
        name: 'Karabin',
        modules: [{ name: 'Optyka', description: 'Celność' }],
      },
    ],
    blade: 'Plazmowe',
  };
  function open() {
    const resume = vi.fn();
    const ctx = { loop: { paused: false }, resume } as never;
    const menu = new RunInventoryMenu(ctx, () => inventory);
    cleanups.push(() => menu.dispose());
    menu.open();
    return { menu, resume, ctx: ctx as { loop: { paused: boolean } } };
  }
  const key = (code: string) =>
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        code,
        bubbles: true,
        cancelable: true,
      }),
    );

  it('implanty | synergie i moce | broń i moduły, fokus na „Wróć do gry”', () => {
    const { ctx } = open();
    expect(ctx.loop.paused).toBe(true);
    const columns = [
      ...document.querySelectorAll<HTMLElement>('.run-inventory__column'),
    ];
    expect(columns).toHaveLength(3);
    expect(columns[0]!.textContent).toContain('Implanty (1)');
    expect(columns[1]!.textContent).toContain('Synergie (1)');
    expect(columns[1]!.textContent).toContain('Moce');
    expect(columns[2]!.textContent).toContain('Optyka');
    expect(columns[2]!.textContent).toContain('Celność');
    expect(
      document.querySelector('.run-inventory__item[data-rarity="epic"]'),
    ).not.toBeNull();
    for (const column of columns) {
      expect(column.tabIndex).toBe(0);
      expect(column.getAttribute('role')).toBe('region');
    }
    expect(document.activeElement?.textContent).toBe('Wróć do gry');
    expect(document.querySelector('.run-inventory__credits')?.textContent).toBe(
      'Kredyty: 12',
    );
  });

  it('strzałki lewo/prawo przechodzą między kolumnami i przyciskiem, Esc zamyka i wznawia', () => {
    const { resume, ctx } = open();
    const columns = [
      ...document.querySelectorAll<HTMLElement>('.run-inventory__column'),
    ];
    key('ArrowLeft');
    expect(document.activeElement).toBe(columns[2]);
    key('ArrowLeft');
    expect(document.activeElement).toBe(columns[1]);
    key('ArrowRight');
    key('ArrowRight');
    expect(document.activeElement?.textContent).toBe('Wróć do gry');
    key('Escape');
    expect(document.querySelector('.run-inventory')).toBeNull();
    expect(ctx.loop.paused).toBe(false);
    expect(resume).toHaveBeenCalledOnce();
  });

  it('pad: B (Esc) zamyka menu, A na „Wróć do gry” też', () => {
    const { resume } = open();
    const nav = new PadNavigation();
    nav.update(frame([1]), 0);
    expect(document.querySelector('.run-inventory')).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
    const again = open();
    const nav2 = new PadNavigation();
    nav2.update(frame([0]), 0);
    expect(document.querySelector('.run-inventory')).toBeNull();
    expect(again.resume).toHaveBeenCalledOnce();
  });
});

describe('wyzwanie dnia: historia', () => {
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  function screen(entries: Record<string, unknown>, navigate = vi.fn()) {
    const save = {
      loadHistory: vi.fn(async () => entries),
    } as never;
    const history = new ChallengeHistoryScreen(
      document.body,
      new URLSearchParams('daily=1'),
      save,
      navigate,
    );
    cleanups.push(() => history.dispose());
    return history;
  }

  it('lista wyników z plakietkami (zwycięstwo zielone, porażka neutralna), start zablokowany po próbie', async () => {
    const history = screen({
      [today]: {
        outcome: 'death',
        roomsCleared: 2,
        kills: 7,
        elapsedS: 91.4,
      },
      '2026-01-02': {
        outcome: 'victory',
        roomsCleared: 5,
        kills: 20,
        elapsedS: 300,
      },
    });
    await history.ready;
    const rows = document.querySelectorAll('.challenge-screen__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain('Porażka');
    expect(rows[0]!.textContent).toContain('Zabici wrogowie: 7');
    expect(rows[1]!.querySelector('.ui-badge--success')?.textContent).toBe(
      'Zwycięstwo',
    );
    const start = [...document.querySelectorAll('button')].find(
      (node) => node.textContent === 'Rozpocznij wyzwanie',
    ) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Dzisiejsza próba została wykorzystana.',
    );
    expect(document.querySelector('h1')?.textContent).toBe('Wyzwanie dnia');
  });

  it('start prowadzi do sceny, Esc i B (pad) wracają do menu', async () => {
    const navigate = vi.fn();
    const history = screen({}, navigate);
    await history.ready;
    const start = [...document.querySelectorAll('button')].find(
      (node) => node.textContent === 'Rozpocznij wyzwanie',
    ) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
    expect(document.querySelector('.challenge-screen__empty')).not.toBeNull();
    start.click();
    expect(navigate).toHaveBeenLastCalledWith('/?scene=challenge');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(navigate).toHaveBeenLastCalledWith('/');
    navigate.mockClear();
    new PadNavigation().update(frame([1]), 0);
    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('tokeny i HUD trybów (kontrola źródeł)', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  const sources = walk('src').filter((path) => /\.(css|ts)$/.test(path));

  it('aliasy --ui-* i Rajdhani znikły z tokens.css, nic ich nie używa', () => {
    const tokens = readFileSync('src/ui/theme/tokens.css', 'utf8');
    expect(tokens).not.toMatch(/--ui-(?!scale)/);
    expect(tokens).not.toContain('Rajdhani');
    expect(tokens).not.toMatch(/--tp-/);
    for (const path of sources) {
      if (path.endsWith('tokens.css')) continue;
      expect(readFileSync(path, 'utf8'), path).not.toMatch(
        /var\(--ui-(?!scale)|var\(--tp-/,
      );
    }
  });

  it.each([
    'assaultUi',
    'heistUi',
    'conquestUi',
    'prototypeHud',
    'puzzleHud',
    'squadHud',
    'missionUi',
  ])('%s: bez monospace i bez drobnego tekstu, kolory z tokenów', (name) => {
    const css = readFileSync(`src/ui/${name}.css`, 'utf8');
    expect(css).not.toContain('monospace');
    expect(css).not.toMatch(/font(-size)?:\s*(1[0-3])px/);
    if (name !== 'missionUi')
      expect(css).not.toMatch(/#(?!000\b)[0-9a-fA-F]{3,8}\b/);
  });
});
