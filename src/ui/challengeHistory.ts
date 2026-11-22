import { localChallengeDate } from '../core/challengeDate';
import { createIndexedDbSaveStore } from '../core/save';
import type { ChallengeSavePort } from '../core/save';
import { preserveLiteFx } from '../render/fxMode';
import { challengeText as text } from './challengeText';
import './mainMenu.css';

export class ChallengeHistoryScreen {
  readonly ready: Promise<void>;
  private readonly root = document.createElement('main');

  constructor(
    parent: HTMLElement,
    params: URLSearchParams,
    save: ChallengeSavePort = createIndexedDbSaveStore().challenge!,
    navigate: (url: string) => void = (url) => location.assign(url),
  ) {
    const go = (target: URLSearchParams): void => {
      if (params.get('debug') === '1') target.set('debug', '1');
      preserveLiteFx(params, target);
      navigate(target.size ? `/?${target}` : '/');
    };
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = label;
      element.addEventListener('click', action);
      return element;
    };
    this.root.className = 'main-menu';
    const heading = document.createElement('h1');
    heading.textContent = text.title;
    const rules = document.createElement('p');
    rules.textContent = text.rules;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = text.loading;
    const start = button(text.start, () => {
      start.disabled = true;
      go(new URLSearchParams({ scene: 'challenge' }));
    });
    start.disabled = true;
    const history = document.createElement('h2');
    history.textContent = text.history;
    const list = document.createElement('ul');
    const back = button(text.back, () => go(new URLSearchParams()));
    back.dataset.padBack = '';
    this.root.append(heading, rules, status, start, history, list, back);
    parent.append(this.root);
    this.ready = save
      .loadHistory()
      .then((entries) => {
        const today = localChallengeDate();
        start.disabled = Object.hasOwn(entries, today);
        status.textContent = [
          `${text.today}: ${today}`,
          start.disabled ? text.used : '',
          params.get('daily') === 'error' ? text.startError : '',
        ]
          .filter(Boolean)
          .join(' · ');
        for (const date of Object.keys(entries).sort().reverse()) {
          const entry = document.createElement('li');
          const result = entries[date];
          entry.textContent = result
            ? `${date} · ${text[result.outcome]} · ${text.rooms}: ${result.roomsCleared} · ${text.kills}: ${result.kills} · ${text.time}: ${Math.floor(result.elapsedS)} s`
            : `${date} · ${text.noResult}`;
          list.append(entry);
        }
        if (!list.childElementCount) {
          const empty = document.createElement('p');
          empty.textContent = text.empty;
          list.replaceWith(empty);
        }
      })
      .catch(() => {
        status.textContent = text.loadError;
      });
  }

  dispose(): void {
    this.root.remove();
  }
}
