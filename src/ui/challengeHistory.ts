import { localChallengeDate } from '../core/challengeDate';
import { createIndexedDbSaveStore } from '../core/save';
import type { ChallengeSavePort } from '../core/save';
import { preserveLiteFx } from '../render/fxMode';
import uiText from '../data/ui/ui.pl.json';
import { challengeText as text } from './challengeText';
import { createActionBar } from './components/actionBar';
import { uiButton } from './components/button';
import { uiBadge } from './components/controls';
import { el } from './components/dom';
import { createScreen } from './components/screen';
import './challengeHistory.css';

/** Wyzwanie dnia: zasady, start (jedna próba na dzień) i historia wyników. */
export class ChallengeHistoryScreen {
  readonly ready: Promise<void>;
  private readonly screen;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    this.back();
  };
  private readonly back: () => void;

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
    this.back = () => go(new URLSearchParams());
    const bar = createActionBar([
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
      {
        keys: '{back}',
        label: text.back,
        end: true,
        id: 'back',
        onClick: this.back,
      },
    ]);
    this.screen = createScreen({
      element: 'div',
      className: 'challenge-screen',
      title: text.title,
      path: text.kicker,
      actionBar: bar,
    });
    const root = this.screen.root;
    const rules = el('p', 'challenge-screen__rules', text.rules);
    const status = el('p', 'challenge-screen__status');
    status.setAttribute('role', 'status');
    status.textContent = text.loading;
    const start = uiButton({
      label: text.start,
      variant: 'primary',
      onClick: () => {
        start.disabled = true;
        go(new URLSearchParams({ scene: 'challenge' }));
      },
    });
    start.disabled = true;
    const back = uiButton({
      label: text.back,
      variant: 'ghost',
      sound: 'back',
      onClick: this.back,
    });
    back.dataset.padBack = '';
    const controls = el('section', 'challenge-screen__panel ui-panel');
    controls.append(rules, status, start, back);
    const historyPanel = el('section', 'challenge-screen__history ui-panel');
    const history = el('h2', 'ui-heading', text.history);
    const list = el('ul', 'ui-list challenge-screen__list ui-scroll');
    historyPanel.append(history, list);
    this.screen.body.append(controls, historyPanel);
    parent.append(root);
    window.addEventListener('keydown', this.onKey);
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
          const entry = el('li', 'challenge-screen__row');
          const result = entries[date];
          entry.append(el('span', 'challenge-screen__date', date));
          if (result) {
            entry.append(
              uiBadge(
                text[result.outcome],
                result.outcome === 'victory' ? 'success' : 'neutral',
              ),
              el(
                'span',
                'challenge-screen__stats',
                `${text.rooms}: ${result.roomsCleared} · ${text.kills}: ${result.kills} · ${text.time}: ${Math.floor(result.elapsedS)} s`,
              ),
            );
          } else
            entry.append(el('span', 'challenge-screen__stats', text.noResult));
          list.append(entry);
        }
        if (!list.childElementCount) {
          const empty = el('p', 'challenge-screen__empty', text.empty);
          list.replaceWith(empty);
        }
      })
      .catch(() => {
        status.textContent = text.loadError;
      });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.screen.root.remove();
  }
}
