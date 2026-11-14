import type { MapNode, RunState, RunSummary } from '../core/runTypes';
import type { RunScreen } from '../world/run';
import { z } from 'zod';
import textData from '../data/ui/run.pl.json';
import './runScreens.css';

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
  })
  .parse(textData);

export interface RunScreenView {
  screen: RunScreen;
  state: RunState;
  nodes: readonly MapNode[];
  summary: RunSummary | null;
  busy: boolean;
  error: string | null;
}

export interface RunScreenActions {
  selectNode(id: string): void;
  next(): void;
  menu(): void;
}

export interface RunScreens {
  show(view: RunScreenView, actions: RunScreenActions): void;
  hide(): void;
  dispose(): void;
}

/** Tymczasowe ekrany do zastąpienia przez UI F3-13/14. */
export class HtmlRunScreens implements RunScreens {
  private readonly root = document.createElement('section');
  private readonly panel = document.createElement('div');
  private buttons: HTMLButtonElement[] = [];
  private readonly onKey = (event: KeyboardEvent): void => {
    if (
      this.root.hidden ||
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
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(view: RunScreenView, actions: RunScreenActions): void {
    this.root.hidden = false;
    this.root.dataset.screen = view.screen;
    this.buttons = [];
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
      this.line(`${view.state.sectorId} · seed: ${view.state.seed}`);
      view.nodes.forEach((node, index) => {
        const button = this.button(
          `${index + 1}. ${node.id} — ${text.types[node.type]}`,
          () => actions.selectNode(node.id),
        );
        button.dataset.nodeId = node.id;
      });
      this.line(text.keys);
    } else if (view.screen === 'summary') {
      const summary = view.summary;
      if (summary) {
        this.line(text[summary.outcome]);
        this.line(
          `${text.layer}: ${summary.layerReached} · ${text.kills}: ${summary.kills} · ${text.time}: ${Math.floor(summary.elapsedS)} s`,
        );
      }
      this.button(text.menu, actions.menu);
    } else {
      this.line(view.screen === 'reward' ? text.noRewards : text.placeholder);
      this.button(text.next, actions.next);
    }
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
    this.root.hidden = true;
    this.buttons = [];
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.buttons = [];
  }
}
