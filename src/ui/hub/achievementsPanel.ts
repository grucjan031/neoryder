import type { AchievementsState } from '../../core/metaTypes';
import type { MetaManager } from '../../progression/meta';
import { achievementProgress } from '../../progression/achievements';
import {
  ACHIEVEMENT_CATEGORIES,
  achievementDefinitions,
} from '../../progression/achievementsSchema';
import type { AchievementDefinition } from '../../progression/achievementsSchema';
import { unlockDefinitions } from '../../progression/unlocksSchema';
import { createAchievementIcon } from '../achievementIcons';
import { achievementText as text, fill, rewardLabel } from '../achievementText';
import type { HubPanel } from './hubPanel';
import { itemName, splitId } from './workshopState';
import './achievementsPanel.css';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

/** Nazwa przedmiotu, którego zakup odblokowuje to osiągnięcie (`requiresAchievement` w `unlocks.json`). */
function gatedItem(id: string): string | null {
  for (const unlock of unlockDefinitions.values()) {
    if (unlock.requiresAchievement !== id) continue;
    const { kind, key } = splitId(unlock.id);
    return itemName(kind, key);
  }
  return null;
}

/**
 * Panel „Naszywki Iskry” (S4b-01): siatka naszywek pogrupowana w kategorie. Zdobyte świecą
 * bursztynem, brakujące są szare z podpowiedzią i paskiem postępu licznika. Karty są
 * fokusowalne (strzałki, Home/End), bo panel jest tylko do odczytu.
 */
export function createAchievementsPanel(
  manager: Pick<MetaManager, 'state'>,
): HubPanel {
  const root = el('div', 'achv-panel');
  root.dataset.panel = 'achievements';
  let disposed = false;

  const card = (
    def: AchievementDefinition,
    state: AchievementsState,
  ): HTMLLIElement => {
    const earned = state.unlocked.includes(def.id);
    const progress = achievementProgress(def, state);
    const item = el('li', 'achv-card');
    item.dataset.id = def.id;
    item.dataset.state = earned ? 'earned' : 'missing';
    item.dataset.category = def.category;
    item.tabIndex = -1;
    const status = earned ? text.panel.earned : text.panel.missing;
    item.setAttribute(
      'aria-label',
      [
        def.title,
        status,
        earned ? def.description : def.hint,
        def.kind === 'counter' ? fill(text.panel.progress, progress) : null,
      ]
        .filter(Boolean)
        .join('. '),
    );
    const icon = el('span', 'achv-card__icon');
    icon.append(createAchievementIcon(def.icon));
    const body = el('div', 'achv-card__body');
    body.append(el('h4', 'achv-card__title', def.title));
    body.append(el('p', 'achv-card__text', def.description));
    if (!earned) body.append(el('p', 'achv-card__hint', def.hint));
    if (def.kind === 'counter') {
      const bar = el('div', 'achv-card__bar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', def.title);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(progress.target));
      bar.setAttribute('aria-valuenow', String(progress.current));
      const fillNode = el('span', 'achv-card__bar-fill');
      fillNode.style.width = `${Math.round((progress.current / progress.target) * 100)}%`;
      bar.append(fillNode);
      const label = el(
        'span',
        'achv-card__progress',
        fill(text.panel.progress, progress),
      );
      body.append(bar, label);
    }
    body.append(
      el(
        'p',
        'achv-card__reward',
        fill(text.panel.reward, { reward: rewardLabel(def.reward) }),
      ),
    );
    const gated = gatedItem(def.id);
    if (gated)
      body.append(
        el(
          'p',
          'achv-card__gate',
          fill(text.panel.unlocksPurchase, { item: gated }),
        ),
      );
    item.append(icon, body);
    return item;
  };

  const stateOf = (): AchievementsState => manager.state.achievements;

  const cards = (): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('.achv-card'),
  ];

  /** Roving tabindex: jedna karta w kolejności Tab, strzałki przenoszą fokus. */
  const rove = (current: HTMLElement | null, next: HTMLElement): void => {
    current?.setAttribute('tabindex', '-1');
    next.setAttribute('tabindex', '0');
    next.focus();
  };

  root.addEventListener('keydown', (event) => {
    const all = cards();
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      '.achv-card',
    );
    if (!current) return;
    const index = all.indexOf(current);
    const last = all.length - 1;
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? all[Math.min(last, index + 1)]
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? all[Math.max(0, index - 1)]
          : event.key === 'Home'
            ? all[0]
            : event.key === 'End'
              ? all[last]
              : undefined;
    if (!target) return;
    event.preventDefault();
    rove(current, target);
  });

  function refresh(): void {
    if (disposed) return;
    const state = stateOf();
    const focusId = (document.activeElement as HTMLElement | null)?.dataset?.id;
    const defs = [...achievementDefinitions.values()];
    const done = defs.filter((def) => state.unlocked.includes(def.id)).length;
    const count = el(
      'p',
      'achv-panel__count',
      fill(text.panel.count, { done, total: defs.length }),
    );
    count.setAttribute('role', 'status');
    count.dataset.count = String(done);
    const sections = ACHIEVEMENT_CATEGORIES.map((category) => {
      const section = el('section', 'achv-group');
      section.dataset.category = category;
      section.append(
        el('h3', 'achv-group__title', text.panel.categories[category]),
      );
      const grid = el('ul', 'achv-grid');
      for (const def of defs)
        if (def.category === category) grid.append(card(def, state));
      section.append(grid);
      return section;
    });
    root.replaceChildren(
      el('h2', 'achv-panel__heading', text.panel.heading),
      count,
      el('p', 'achv-panel__intro', text.panel.intro),
      ...sections,
    );
    const all = cards();
    const keep = all.find((node) => node.dataset.id === focusId);
    (keep ?? all[0])?.setAttribute('tabindex', '0');
    if (keep && root.isConnected) keep.focus();
  }

  refresh();
  return {
    root,
    refresh,
    dispose(): void {
      disposed = true;
      root.remove();
    },
  };
}
