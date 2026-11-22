import { z } from 'zod';
import type { EventBus } from '../../core/events';
import type { MetaManager } from '../../progression/meta';
import textData from '../../data/ui/missions.pl.json';
import hudText from '../../data/ui/hud.pl.json';
import './metaBar.css';

const text = z
  .object({
    label: z.string(),
    level: z.string(),
    xp: z.string(),
    xpMax: z.string(),
    data: z.string(),
    cores: z.string(),
    freePoints: z.string(),
    dataHelp: z.string(),
    coresHelp: z.string(),
    freePointsHelp: z.string(),
  })
  .parse(textData.bar);

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

const CURRENCY_HINT_KEY = 'neoryder.ui.currencyHint';
const CURRENCY_HINT_MS = 6000;
let nextTooltipId = 0;
let currencyHintShownInSession = false;

/** Zdarzenia meta, po których pasek się odświeża. */
export const META_BAR_EVENTS = [
  'meta_rewards',
  'level_up',
  'talents_changed',
  'unlock_purchased',
  'loadout_changed',
  'threat_selected',
] as const;

export interface MetaBar {
  readonly root: HTMLElement;
  /** Odczytuje stan `MetaManager` ponownie (po komendach debug, które nie emitują zdarzeń). */
  refresh(): void;
  dispose(): void;
}

function span(className: string, content = ''): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = content;
  return node;
}

/** Stała belka u góry kryjówki: poziom, pasek doświadczenia, Dane, Rdzenie, wolne punkty. */
export function createMetaBar(
  manager: MetaManager,
  bus: EventBus,
  parent: Element = document.querySelector('#app') ?? document.body,
): MetaBar {
  const root = document.createElement('div');
  root.className = 'meta-bar';
  root.dataset.debug = String(
    import.meta.env.DEV ||
      new URLSearchParams(location.search).get('debug') === '1',
  );
  root.setAttribute('role', 'status');
  root.setAttribute('aria-label', text.label);
  const level = span('meta-bar__level');
  const xp = document.createElement('span');
  xp.className = 'meta-bar__xp';
  const track = document.createElement('span');
  track.className = 'meta-bar__xp-track';
  const fillBar = document.createElement('span');
  fillBar.className = 'meta-bar__xp-fill';
  track.append(fillBar);
  const xpText = span('meta-bar__xp-text');
  xp.append(track, xpText);
  const data = span('meta-bar__stat');
  data.dataset.stat = 'data';
  const cores = span('meta-bar__stat');
  cores.dataset.stat = 'cores';
  const dataLabel = span('meta-bar__stat-label', `${text.data}: `);
  const dataValue = span('meta-bar__stat-value');
  data.append(dataLabel, dataValue);
  const coresLabel = span('meta-bar__stat-label', `${text.cores}: `);
  const coresValue = span('meta-bar__stat-value');
  cores.append(coresLabel, coresValue);
  const free = span('meta-bar__free');
  const stats = [];
  for (const [node, help] of [
    [data, text.dataHelp],
    [cores, text.coresHelp],
    [free, text.freePointsHelp],
  ] as const) {
    const wrapper = span('meta-bar__help');
    const tooltip = span('meta-bar__tooltip', help);
    tooltip.id = `meta-bar-tooltip-${++nextTooltipId}`;
    tooltip.setAttribute('role', 'tooltip');
    node.tabIndex = 0;
    node.setAttribute('aria-describedby', tooltip.id);
    node.setAttribute('role', 'group');
    wrapper.append(node, tooltip);
    stats.push(wrapper);
  }
  const operator = span('meta-bar__operator', hudText.microOperator);
  const identity = span('meta-bar__identity');
  identity.append(operator, level, xp);
  root.append(identity, ...stats);
  parent.append(root);

  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const arrivalState = manager.state;
  const earnedCurrency = arrivalState.lastRuns.some(
    ({ rewards }) => rewards.data > 0 || rewards.cores > 0,
  );
  let hintShown = currencyHintShownInSession;
  try {
    hintShown = localStorage.getItem(CURRENCY_HINT_KEY) !== null;
  } catch {
    // Przy niedostępnym storage zachowujemy flagę w bieżącej sesji.
  }
  if (arrivalState.stats.runs > 0 && earnedCurrency && !hintShown) {
    const hint = span(
      'meta-bar__currency-hint',
      `${text.dataHelp} ${text.coresHelp}`,
    );
    root.append(hint);
    currencyHintShownInSession = true;
    try {
      localStorage.setItem(CURRENCY_HINT_KEY, '1');
    } catch {
      // Brak zapisu nie blokuje objaśnienia walut.
    }
    hintTimer = setTimeout(() => hint.remove(), CURRENCY_HINT_MS);
  }

  const refresh = (): void => {
    const progress = manager.xpProgress;
    const state = manager.state;
    level.textContent = fill(text.level, { level: progress.level });
    const next = progress.xpForNext;
    const ratio = next === null ? 1 : progress.xpIntoLevel / next;
    fillBar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    xpText.textContent =
      next === null
        ? text.xpMax
        : fill(text.xp, { current: progress.xpIntoLevel, next });
    dataValue.textContent = String(state.data);
    coresValue.textContent = String(state.cores);
    const points = manager.freePoints;
    free.textContent = fill(text.freePoints, { count: points });
    free.dataset.active = String(points > 0);
    data.setAttribute('aria-label', `${data.textContent}. ${text.dataHelp}`);
    cores.setAttribute('aria-label', `${cores.textContent}. ${text.coresHelp}`);
    free.setAttribute(
      'aria-label',
      `${free.textContent}. ${text.freePointsHelp}`,
    );
  };
  refresh();
  const offs = META_BAR_EVENTS.map((name) => bus.on(name, refresh));
  return {
    root,
    refresh,
    dispose(): void {
      clearTimeout(hintTimer);
      for (const off of offs) off();
      root.remove();
    },
  };
}
