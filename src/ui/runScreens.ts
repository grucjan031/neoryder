import { implantDefinitions } from '../progression/implants';
import type { ApplyRunResult } from '../progression/meta';
import type { MapNode, Rarity, RunState, RunSummary } from '../core/runTypes';
import type { RunScreen } from '../world/run';
import { z } from 'zod';
import textData from '../data/ui/run.pl.json';
import metaTextData from '../data/ui/meta.pl.json';
import './runScreens.css';
import { MapScreen } from './mapScreen';

const text = z
  .object({
    titles: z.object({
      map: z.string(),
      room: z.string(),
      reward: z.string(),
      shop: z.string(),
      rest: z.string(),
      summary: z.string(),
    }),
    types: z.object({
      combat: z.string(),
      elite: z.string(),
      shop: z.string(),
      rest: z.string(),
      puzzle: z.string(),
      boss: z.string(),
    }),
    noRewards: z.string(),
    placeholder: z.string(),
    next: z.string(),
    menu: z.string(),
    loading: z.string(),
    victory: z.string(),
    death: z.string(),
    keys: z.string(),
    hp: z.string(),
    credits: z.string(),
    layer: z.string(),
    kills: z.string(),
    time: z.string(),
    heal: z.string(),
    upgrade: z.string(),
    rooms: z.string(),
    implants: z.string(),
    damage: z.string(),
    seed: z.string(),
    newRun: z.string(),
    noImplants: z.string(),
    synergies: z.string(),
    nextRarity: z.string(),
    leave: z.string(),
    rarities: z.object({
      common: z.string(),
      rare: z.string(),
      epic: z.string(),
      legendary: z.string(),
    }),
    paths: z.object({
      melee: z.string(),
      power: z.string(),
      gun: z.string(),
      other: z.string(),
    }),
  })
  .parse(textData);

const metaText = z
  .object({
    summary: z.object({
      rewards: z.string(),
      xp: z.string(),
      data: z.string(),
      cores: z.string(),
      levelUp: z.string(),
      threatUnlocked: z.string(),
      backToHub: z.string(),
    }),
  })
  .parse(metaTextData).summary;

/** Wynik `MetaManager.applyRun` pokazywany w podsumowaniu (ADR 0007 pkt 2). */
export type RunMetaView = Pick<
  ApplyRunResult,
  'rewards' | 'levelBefore' | 'levelAfter' | 'threatUnlocked'
>;

export interface RunScreenView {
  screen: RunScreen;
  state: RunState;
  nodes: readonly MapNode[];
  summary: RunSummary | null;
  /** Nagrody meta za zakończony run (brak = sekcja nie jest pokazywana). */
  meta?: RunMetaView;
  busy: boolean;
  error: string | null;
  offers?: readonly {
    id: string;
    label: string;
    price?: number;
    description?: string;
    rarity?: Rarity;
    tags?: string[];
    nextRarity?: Rarity;
    synergies?: string[];
  }[];
  healPrice?: number;
  fallbackCredits?: number;
}

export interface RunScreenActions {
  selectNode(id: string): void;
  next(): void;
  chooseReward?(id?: string): void;
  buy?(id: string): void;
  rest?(choice: 'heal' | 'upgrade', id?: string): void;
  menu(): void;
  newRun?(): void;
  /** Powrót do kryjówki (`?scene=hub`); przycisk pokazywany tylko, gdy akcja jest podana. */
  hub?(): void;
}

export interface RunScreens {
  show(view: RunScreenView, actions: RunScreenActions): void;
  hide(): void;
  dispose(): void;
}

/** Mapa sektora i ekrany przejść runu (pozostałe nakładki: F3-14). */
export class HtmlRunScreens implements RunScreens {
  private readonly root = document.createElement('section');
  private readonly panel = document.createElement('div');
  private buttons: HTMLButtonElement[] = [];
  private readonly map: MapScreen;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (
      this.root.hidden ||
      this.root.dataset.screen === 'map' ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    )
      return;
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    const focused = document.activeElement;
    const button =
      index >= 0
        ? this.buttons[index]
        : event.code === 'Enter'
          ? (this.buttons.find((entry) => entry === focused) ?? this.buttons[0])
          : undefined;
    if (!button) return;
    event.preventDefault();
    button.click();
  };

  constructor(parent = document.querySelector('#app') ?? document.body) {
    this.root.className = 'run-screen';
    this.root.setAttribute('aria-label', 'Run');
    this.panel.className = 'run-screen__panel';
    this.root.append(this.panel);
    this.map = new MapScreen(this.panel);
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(view: RunScreenView, actions: RunScreenActions): void {
    this.root.hidden = false;
    this.root.dataset.screen = view.screen;
    this.buttons = [];
    this.map.hide();
    this.panel.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = text.titles[view.screen];
    this.panel.append(heading);
    this.line(
      `${text.hp}: ${view.state.hp} · ${text.credits}: ${view.state.credits}`,
    );
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (view.error) {
      this.line(view.error);
      this.button(text.menu, actions.menu);
    } else if (view.busy) {
      this.line(text.loading);
    } else if (view.screen === 'map') {
      this.panel.append(this.map.root);
      this.map.show(view.state, actions.selectNode);
    } else if (view.screen === 'summary') {
      const summary = view.summary;
      if (summary) {
        const seconds = Math.floor(summary.elapsedS);
        this.line(text[summary.outcome]);
        this.line(
          `${text.time}: ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} · ${text.kills}: ${summary.kills} · ${text.rooms}: ${summary.roomsCleared} · ${text.layer}: ${summary.layerReached}`,
        );
        this.line(`${text.seed}: ${summary.seed}`);
        this.line(
          `${text.implants}: ${summary.implants.map((id) => implantDefinitions.get(id)?.name ?? id).join(', ') || text.noImplants}`,
        );
        this.line(text.damage);
        const max = Math.max(0, ...Object.values(summary.damage));
        for (const path of ['melee', 'power', 'gun', 'other'] as const) {
          const row = document.createElement('div');
          row.className = 'run-screen__damage';
          const label = document.createElement('span');
          label.textContent = `${text.paths[path]}: ${summary.damage[path]}`;
          const bar = document.createElement('div');
          bar.className = 'run-screen__bar';
          bar.style.width = `${max > 0 ? (summary.damage[path] / max) * 100 : 0}%`;
          row.append(label, bar);
          this.panel.append(row);
        }
      }
      if (view.meta) this.metaRewards(view.meta, summary?.threatLevel ?? 0);
      const hub = actions.hub;
      if (hub) {
        const back = this.button(metaText.backToHub, hub);
        back.classList.add('run-screen__primary');
      }
      this.button(text.newRun, () => actions.newRun?.());
      this.button(text.menu, actions.menu);
    } else if (view.screen === 'reward') {
      for (const offer of view.offers ?? [])
        this.offer(offer, () => actions.chooseReward?.(offer.id));
      if (!view.offers?.length) {
        this.line(text.noRewards);
        this.button(
          `${text.next} ? ${text.credits}: +${view.fallbackCredits ?? 0}`,
          () =>
            actions.chooseReward ? actions.chooseReward() : actions.next(),
        );
      }
    } else if (view.screen === 'shop') {
      for (const offer of view.offers ?? []) {
        const button = this.offer(offer, () => actions.buy?.(offer.id));
        button.disabled = view.state.credits < (offer.price ?? 0);
      }
      const heal = this.button(
        `${text.heal} ? ${view.healPrice ?? 0} ${text.credits}`,
        () => actions.buy?.('heal'),
      );
      heal.disabled = view.state.credits < (view.healPrice ?? 0);
      this.button(text.leave, actions.next);
    } else if (view.screen === 'rest') {
      this.button(text.heal, () => actions.rest?.('heal'));
      for (const offer of view.offers ?? [])
        this.offer(offer, () => actions.rest?.('upgrade', offer.id), true);
    } else {
      this.line(text.placeholder);
      this.button(text.next, actions.next);
    }
  }

  private metaRewards(meta: RunMetaView, runThreat: number): void {
    const box = document.createElement('div');
    box.className = 'run-screen__rewards';
    box.dataset.testid = 'run-meta-rewards';
    const title = document.createElement('h2');
    title.textContent = metaText.rewards;
    box.append(title);
    const rows: [string, string, number][] = [
      ['xp', metaText.xp, meta.rewards.xp],
      ['data', metaText.data, meta.rewards.data],
      ['cores', metaText.cores, meta.rewards.cores],
    ];
    for (const [key, label, value] of rows) {
      const row = document.createElement('p');
      row.dataset.reward = key;
      row.textContent = `${label}: +${value}`;
      box.append(row);
    }
    if (meta.levelAfter > meta.levelBefore) {
      const row = document.createElement('p');
      row.className = 'run-screen__levelup';
      row.textContent = metaText.levelUp
        .replace('{from}', String(meta.levelBefore))
        .replace('{to}', String(meta.levelAfter));
      box.append(row);
    }
    if (meta.threatUnlocked) {
      const row = document.createElement('p');
      row.className = 'run-screen__levelup';
      row.textContent = metaText.threatUnlocked.replace(
        '{level}',
        String(runThreat + 1),
      );
      box.append(row);
    }
    this.panel.append(box);
  }

  private offer(
    offer: NonNullable<RunScreenView['offers']>[number],
    action: () => void,
    upgrade = false,
  ): HTMLButtonElement {
    const button = this.button(
      `${upgrade ? `${text.upgrade}: ` : ''}${offer.label}`,
      action,
    );
    if (offer.rarity) {
      button.dataset.rarity = offer.rarity;
      const rarity = document.createElement('span');
      rarity.className = 'run-screen__rarity';
      rarity.textContent = text.rarities[offer.rarity];
      button.append(rarity);
    }
    const details = [
      offer.description,
      offer.tags?.join(' '),
      offer.synergies?.length
        ? `${text.synergies}: ${offer.synergies.join(', ')}`
        : '',
      offer.nextRarity && upgrade
        ? `${text.nextRarity}: ${text.rarities[offer.nextRarity]}`
        : '',
      offer.price !== undefined ? `${offer.price} ${text.credits}` : '',
    ];
    for (const detail of details)
      if (detail) {
        const line = document.createElement('span');
        line.className = 'run-screen__detail';
        line.textContent = detail;
        button.append(line);
      }
    return button;
  }

  private line(value: string): void {
    const line = document.createElement('p');
    line.textContent = value;
    this.panel.append(line);
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    this.buttons.push(button);
    this.panel.append(button);
    return button;
  }

  hide(): void {
    this.map.hide();
    this.root.hidden = true;
    this.buttons = [];
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.map.dispose();
    this.root.remove();
    this.buttons = [];
  }
}
