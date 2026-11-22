import type { EndlessScore } from '../core/endlessSave';
import text from '../data/ui/endless.pl.json';
import inventoryText from '../data/ui/inventory.pl.json';
import settingsText from '../data/ui/settings.pl.json';
import type { ImplantDefinition } from '../progression/implantSchema';
import type { RunRewards } from '../core/metaTypes';
import { fill } from './achievementText';
import './runScreens.css';

export function endlessRecordLabel(best: EndlessScore | null): string {
  return best
    ? fill(text.record, { wave: best.wave, time: best.elapsedS.toFixed(1) })
    : text.noRecord;
}

type SettlementView =
  | { status: 'saving' | 'error' | 'practice' }
  | { status: 'saved'; rewards?: RunRewards };

export class EndlessScreens {
  private readonly root = document.createElement('section');
  private readonly panel = document.createElement('div');

  constructor() {
    this.root.className = 'run-screen';
    this.panel.className = 'run-screen__panel';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', text.title);
    this.root.append(this.panel);
    (document.querySelector('#app') ?? document.body).append(this.root);
  }

  offer(
    offers: readonly ImplantDefinition[],
    choose: (id?: string) => void,
  ): void {
    this.show('reward', text.intermission);
    const cards = document.createElement('div');
    cards.className = 'run-screen__offers';
    for (const { id, name, description, rarity, tags } of offers) {
      const card = this.button('', () => choose(id));
      card.className = 'run-screen__card';
      card.dataset.rarity = rarity;
      for (const [content, cssClass] of [
        [inventoryText.rarities[rarity], 'run-screen__rarity'],
        [name, 'run-screen__name'],
        [description, 'run-screen__detail run-screen__detail--desc'],
        [tags.join(' '), 'run-screen__tags'],
      ] as const) {
        if (!content) continue;
        const line = document.createElement('span');
        line.className = cssClass;
        line.textContent = content;
        card.append(line);
      }
      cards.append(card);
    }
    this.panel.append(
      cards,
      this.button(text.skip, () => choose()),
    );
    cards.querySelector('button')?.focus();
  }

  summary(
    score: EndlessScore,
    best: EndlessScore | null,
    result: SettlementView,
    actions: {
      retry(): void;
      build(): void;
      save(): void;
      leave(hub: boolean): void;
    },
  ): void {
    const open = !this.root.hidden;
    const focused = document.activeElement;
    const action =
      focused instanceof HTMLElement && this.root.contains(focused)
        ? focused.dataset.action
        : undefined;
    this.show('summary', text.title);
    this.line(
      fill(text.result, { wave: score.wave, time: score.elapsedS.toFixed(1) }),
    );
    this.line(endlessRecordLabel(best));
    const buttons = document.createElement('div');
    buttons.className = 'run-screen__actions';
    if (result.status === 'saving') this.line(text.savePending, 'status');
    if (result.status === 'practice') this.line(text.debugResult);
    if (result.status === 'error') {
      this.line(text.saveError, 'alert');
      buttons.append(this.button(text.saveRetry, actions.save, 'save'));
    }
    if (result.status === 'saved' && result.rewards) {
      this.line(
        fill(text.reward, { xp: result.rewards.xp, data: result.rewards.data }),
      );
    }
    buttons.append(
      this.button(text.retry, actions.retry, 'retry'),
      this.button(text.build, actions.build, 'build'),
      this.button(settingsText.hub, () => actions.leave(true), 'hub'),
      this.button(settingsText.menu, () => actions.leave(false), 'menu'),
    );
    this.panel.append(buttons);
    if (result.status === 'saving')
      buttons.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
    if (!open || action || focused === document.body) {
      const next = [
        ...buttons.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      ];
      (
        next.find((button) => button.dataset.action === action) ?? next[0]
      )?.focus();
    }
  }

  hide(): void {
    this.root.hidden = true;
  }

  dispose(): void {
    this.root.remove();
  }

  private show(screen: 'reward' | 'summary', title: string): void {
    const heading = document.createElement('h1');
    heading.textContent = title;
    this.root.dataset.screen = screen;
    this.root.hidden = false;
    this.panel.replaceChildren(heading);
  }

  private line(content: string, role?: string): void {
    const node = document.createElement('p');
    if (role) node.setAttribute('role', role);
    node.textContent = content;
    this.panel.append(node);
  }

  private button(
    content: string,
    action: () => void,
    id?: string,
  ): HTMLButtonElement {
    const node = document.createElement('button');
    node.type = 'button';
    if (id) node.dataset.action = id;
    node.textContent = content;
    node.addEventListener('click', action);
    return node;
  }
}
