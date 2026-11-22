import { implantDefinitions } from '../progression/implants';
import { moduleDefinitions } from '../progression/moduleSchema';
import type { ApplyRunResult } from '../progression/meta';
import type { MapNode, Rarity, RunState, RunSummary } from '../core/runTypes';
import type { RunScreen } from '../world/run';
import { z } from 'zod';
import textData from '../data/ui/run.pl.json';
import metaTextData from '../data/ui/meta.pl.json';
import './runScreens.css';
import { MapScreen } from './mapScreen';
import { splashUrl } from './splash';
import { getLiteFx } from '../render/fxMode';
import { createLoadingTip } from './loadingTipView';
import { createAchievementIcon } from './achievementIcons';
import { achievementText, fill, rewardLabel } from './achievementText';
import { achievementDefinitions } from '../progression/achievementsSchema';
import { defeatMessage } from './runHud';
import { challengeText } from './challengeText';

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
    eliteModule: z.string(),
    extractionAvailable: z.string(),
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
    rewardSaveError: z.string(),
    rewardApplyError: z.string(),
    retrySave: z.string(),
    rewardPending: z.string(),
    rewardAlreadySaved: z.string(),
    abandonReward: z.string(),
    abandonConfirm: z.string(),
    leaving: z.string(),
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
> & {
  /** Nowe naszywki Iskry z tego runu (S4b-01); brak = sekcja nie jest pokazywana. */
  achievements?: ApplyRunResult['achievements'];
};

export interface RunScreenView {
  screen: RunScreen;
  state: RunState;
  nodes: readonly MapNode[];
  summary: RunSummary | null;
  dailyChallenge?: boolean;
  /** Przyczyna z run_ended; brak w starym zapisie daje uczciwy komunikat zastępczy. */
  cause?: string;
  /** Nagrody meta za zakończony run (brak = sekcja nie jest pokazywana). */
  meta?: RunMetaView;
  /** Nagroda nie trafiła do zapisu (`save`) albo nie dała się naliczyć (`apply`). */
  rewardError?: 'save' | 'apply' | null;
  /** Rozliczenie nagrody trwa (nagrody pokazujemy dopiero po potwierdzonym zapisie). */
  rewardPending?: boolean;
  moduleOffers?: readonly string[];
  extractionAvailable?: boolean;
  /** Nagroda była już zapisana wcześniej, a jej kwot nie da się odtworzyć. */
  rewardAlreadySaved?: boolean;
  /** Wyjście z podsumowania czeka na zapis: przyciski nawigacji wyłączone. */
  leaving?: boolean;
  busy: boolean;
  /** Splashart tła ekranu ładowania pokoju (`busy`); brak = ekran jak dotąd. */
  splash?: { file: string; title: string };
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
  chooseReward?(id?: string, moduleId?: string): void;
  buy?(id: string): void;
  rest?(choice: 'heal' | 'upgrade', id?: string): void;
  menu(): void;
  newRun?(): void;
  history?(): void;
  /** Powrót do kryjówki (`?scene=hub`); przycisk pokazywany tylko, gdy akcja jest podana. */
  hub?(): void;
  /** Ponowienie zapisu nagrody po błędzie; przycisk tylko, gdy akcja jest podana. */
  retrySave?(): void;
  /** Porzucenie nienaliczalnej nagrody (drugie kliknięcie potwierdza). */
  abandonReward?(): void;
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
  private splashFile: string | null = null;
  private tipKey: string | null = null;
  private tip: ReturnType<typeof createLoadingTip> | undefined;
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
    this.root.setAttribute('aria-label', 'Wyprawa');
    this.panel.className = 'run-screen__panel';
    this.root.append(this.panel);
    this.map = new MapScreen(this.panel);
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(view: RunScreenView, actions: RunScreenActions): void {
    // Animacja wejścia tylko przy zmianie ekranu — odświeżenia (np. Kredyty) nie migają.
    const entering =
      this.root.hidden !== false || this.root.dataset.screen !== view.screen;
    this.root.classList.toggle('run-screen--enter', entering);
    this.root.hidden = false;
    this.root.dataset.screen = view.screen;
    this.buttons = [];
    this.map.hide();
    if (!(
      view.busy &&
      !view.error &&
      !getLiteFx() &&
      view.splash?.file === this.splashFile
    ))
      this.clearSplash();
    this.panel.replaceChildren();
    const heading = document.createElement('h1');
    heading.textContent = view.dailyChallenge
      ? `${challengeText.title} · ${text.titles[view.screen]}`
      : text.titles[view.screen];
    this.panel.append(heading);
    this.vitals(view.state.hp, view.state.credits);
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (view.error) {
      this.line(view.error);
      this.button(text.menu, actions.menu);
    } else if (view.busy) {
      if (view.splash && !getLiteFx())
        this.showSplash(
          view.splash,
          `run:${view.state.seed}:${view.state.currentNodeId ?? ''}`,
        );
      this.line(text.loading).classList.add('run-screen__loading');
    } else if (view.screen === 'map') {
      this.panel.append(this.map.root);
      this.map.show(view.state, actions.selectNode);
    } else if (view.screen === 'summary') {
      const summary = view.summary;
      if (summary) {
        const seconds = Math.floor(summary.elapsedS);
        const outcome = this.line(text[summary.outcome]);
        outcome.className = 'run-screen__outcome';
        outcome.dataset.outcome = summary.outcome;
        this.panel.dataset.outcome = summary.outcome;
        if (summary.outcome === 'death') {
          const message = defeatMessage(view.cause);
          this.line(message.cause);
          this.line(message.tip);
        }
        const stats = document.createElement('div');
        stats.className = 'run-screen__stats';
        const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        for (const [label, value] of [
          [text.time, time],
          [text.kills, String(summary.kills)],
          [text.rooms, String(summary.roomsCleared)],
          [text.layer, String(summary.layerReached)],
        ] as const)
          stats.append(this.stat(label, value));
        this.panel.append(stats);
        this.line(`${text.seed}: ${summary.seed}`).className =
          'run-screen__meta-line';
        this.line(
          `${text.implants}: ${summary.implants.map((id) => implantDefinitions.get(id)?.name ?? id).join(', ') || text.noImplants}`,
        ).className = 'run-screen__meta-line';
        this.line(text.damage).className = 'run-screen__section';
        const max = Math.max(0, ...Object.values(summary.damage));
        const damage = this.group('run-screen__damage-grid');
        for (const path of ['melee', 'power', 'gun', 'other'] as const) {
          const row = document.createElement('div');
          row.className = 'run-screen__damage';
          row.dataset.path = path;
          const label = document.createElement('span');
          label.textContent = `${text.paths[path]}: ${Math.round(summary.damage[path])}`;
          const track = document.createElement('div');
          track.className = 'run-screen__track';
          const bar = document.createElement('div');
          bar.className = 'run-screen__bar';
          bar.style.width = `${max > 0 ? (summary.damage[path] / max) * 100 : 0}%`;
          track.append(bar);
          row.append(label, track);
          damage.append(row);
        }
      }
      if (view.meta) this.metaRewards(view.meta, summary?.threatLevel ?? 0);
      if (view.extractionAvailable) this.line(text.extractionAvailable);
      if (view.rewardError) {
        const box = this.group('run-screen__reward-error');
        box.setAttribute('role', 'alert');
        const message = document.createElement('p');
        message.textContent = view.dailyChallenge
          ? challengeText.saveError
          : view.rewardError === 'save'
            ? text.rewardSaveError
            : text.rewardApplyError;
        box.append(message);
        const retry = actions.retrySave;
        if (retry)
          this.button(
            view.dailyChallenge ? challengeText.retry : text.retrySave,
            retry,
            box,
          );
        const abandon = actions.abandonReward;
        if (abandon) {
          // Dwa kroki: pierwsze kliknięcie pyta, drugie porzuca nagrodę.
          const button = this.button(
            text.abandonReward,
            () => {
              if (button.dataset.confirm === '1') abandon();
              else {
                button.dataset.confirm = '1';
                button.textContent = text.abandonConfirm;
              }
            },
            box,
          );
        }
      } else if (view.rewardPending) {
        const pending = this.line(
          view.dailyChallenge ? challengeText.saving : text.rewardPending,
        );
        pending.className = 'run-screen__reward-pending';
        pending.setAttribute('role', 'status');
      } else if (view.rewardAlreadySaved && !view.meta) {
        this.line(text.rewardAlreadySaved).className =
          'run-screen__reward-pending';
      }
      const row = this.group('run-screen__actions');
      const hub = actions.hub;
      const nav: HTMLButtonElement[] = [];
      if (actions.history) {
        const history = this.button(
          challengeText.history,
          actions.history,
          row,
        );
        history.classList.add('run-screen__primary');
        nav.push(history);
      } else if (hub) {
        const back = this.button(metaText.backToHub, hub, row);
        back.classList.add('run-screen__primary');
        nav.push(back);
      }
      if (!view.dailyChallenge) {
        const again = this.button(text.newRun, () => actions.newRun?.(), row);
        if (!hub) again.classList.add('run-screen__primary');
        nav.push(again);
      }
      nav.push(this.button(text.menu, actions.menu, row));
      if (view.leaving) {
        for (const button of nav) button.disabled = true;
        const leaving = this.line(text.leaving);
        leaving.className = 'run-screen__reward-pending';
        leaving.setAttribute('role', 'status');
      }
    } else if (view.screen === 'reward') {
      let selection: HTMLSelectElement | undefined;
      if (view.moduleOffers?.length) {
        const label = document.createElement('label');
        label.textContent = text.eliteModule;
        selection = document.createElement('select');
        for (const id of view.moduleOffers) {
          const module = moduleDefinitions.get(id)!;
          selection.add(new Option(module.name, id));
        }
        label.append(selection);
        this.panel.append(label);
      }
      const choose = (id?: string) => {
        if (selection) actions.chooseReward?.(id, selection.value);
        else if (id !== undefined) actions.chooseReward?.(id);
        else actions.chooseReward?.();
      };
      const cards = this.group('run-screen__offers');
      for (const offer of view.offers ?? [])
        this.offer(offer, () => choose(offer.id), cards);
      if (!view.offers?.length) {
        cards.remove();
        this.line(text.noRewards);
        this.button(
          `${text.next} — ${text.credits}: +${view.fallbackCredits ?? 0}`,
          () => (actions.chooseReward ? choose() : actions.next()),
        );
      }
    } else if (view.screen === 'shop') {
      const cards = this.group('run-screen__offers');
      for (const offer of view.offers ?? []) {
        const button = this.offer(offer, () => actions.buy?.(offer.id), cards);
        button.disabled = view.state.credits < (offer.price ?? 0);
      }
      const row = this.group('run-screen__actions');
      const heal = this.button(
        `${text.heal} — ${view.healPrice ?? 0} ${text.credits}`,
        () => actions.buy?.('heal'),
        row,
      );
      heal.classList.add('run-screen__heal');
      heal.disabled = view.state.credits < (view.healPrice ?? 0);
      this.button(text.leave, actions.next, row);
    } else if (view.screen === 'rest') {
      const heal = this.button(text.heal, () => actions.rest?.('heal'));
      heal.classList.add('run-screen__heal', 'run-screen__primary');
      const cards = this.group('run-screen__offers');
      for (const offer of view.offers ?? [])
        this.offer(
          offer,
          () => actions.rest?.('upgrade', offer.id),
          cards,
          true,
        );
      if (!view.offers?.length) cards.remove();
    } else {
      this.line(text.placeholder);
      this.button(text.next, actions.next);
    }
  }

  private clearSplash(): void {
    this.tip?.dispose();
    this.tip = undefined;
    this.tipKey = null;
    this.splashFile = null;
    this.root.classList.remove('run-screen--splash');
    this.root.querySelector('.run-screen__splash')?.remove();
  }

  /** Dekoracyjne tło ekranu ładowania; błąd ładowania obrazu przywraca ekran bez tła. */
  private showSplash(
    splash: { file: string; title: string },
    key: string,
  ): void {
    if (this.splashFile === splash.file && this.tipKey === key) return;
    this.clearSplash();
    this.splashFile = splash.file;
    this.tipKey = key;
    const backdrop = document.createElement('div');
    backdrop.className = 'run-screen__splash';
    backdrop.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.className = 'run-screen__splash-img';
    image.alt = '';
    image.decoding = 'async';
    image.addEventListener('load', () => image.classList.add('is-loaded'));
    image.addEventListener('error', () => {
      // Błąd starego obrazu nie może zdjąć nowego tła.
      if (image.isConnected && this.splashFile === splash.file)
        this.clearSplash();
    });
    image.src = splashUrl(splash);
    const caption = document.createElement('span');
    caption.className = 'run-screen__splash-title';
    caption.textContent = splash.title;
    const copy = document.createElement('div');
    copy.className = 'loading-copy';
    this.tip = createLoadingTip(key);
    copy.append(caption, this.tip.root);
    backdrop.append(image, copy);
    this.root.prepend(backdrop);
    this.root.classList.add('run-screen--splash');
  }

  /** Zdrowie i Kredyty jako odczyt wizjera; tekst zostaje „Zdrowie: N · Kredyty: N”. */
  private vitals(hp: number, credits: number): void {
    const line = document.createElement('p');
    line.className = 'run-screen__vitals';
    const part = (kind: string, label: string, value: number): HTMLElement => {
      const node = document.createElement('span');
      node.className = 'run-screen__vital';
      node.dataset.kind = kind;
      const name = document.createElement('small');
      name.textContent = label;
      const colon = document.createElement('span');
      colon.className = 'run-screen__sr';
      colon.textContent = ': ';
      name.append(colon);
      const strong = document.createElement('b');
      strong.textContent = String(Math.ceil(value));
      node.append(name, strong);
      return node;
    };
    const separator = document.createElement('span');
    separator.className = 'run-screen__sep';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = ' · ';
    line.append(
      part('hp', text.hp, hp),
      separator,
      part('credits', text.credits, credits),
    );
    this.panel.append(line);
  }

  private stat(label: string, value: string): HTMLElement {
    const tile = document.createElement('span');
    tile.className = 'run-screen__stat';
    const name = document.createElement('small');
    name.textContent = label;
    const colon = document.createElement('span');
    colon.className = 'run-screen__sr';
    colon.textContent = ': ';
    name.append(colon);
    const strong = document.createElement('b');
    strong.textContent = value;
    tile.append(name, strong, ' ');
    return tile;
  }

  private group(className: string): HTMLElement {
    const node = document.createElement('div');
    node.className = className;
    this.panel.append(node);
    return node;
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
    if (meta.achievements?.length) this.achievementList(meta.achievements);
  }

  private achievementList(
    unlocks: NonNullable<RunMetaView['achievements']>,
  ): void {
    const box = document.createElement('div');
    box.className = 'run-screen__rewards run-screen__patches';
    box.dataset.testid = 'run-achievements';
    const title = document.createElement('h2');
    title.textContent = achievementText.summary.heading;
    box.append(title);
    for (const unlock of unlocks) {
      const def = achievementDefinitions.get(unlock.id);
      const row = document.createElement('p');
      row.className = 'run-screen__patch';
      row.dataset.achievement = unlock.id;
      const icon = document.createElement('span');
      icon.className = 'run-screen__patch-icon';
      icon.append(createAchievementIcon(def?.icon ?? 'spark'));
      const label = document.createElement('span');
      const reward = rewardLabel({
        ...(unlock.reward.data ? { data: unlock.reward.data } : {}),
        ...(unlock.reward.cores ? { cores: unlock.reward.cores } : {}),
      });
      label.textContent = fill(
        reward
          ? achievementText.summary.line
          : achievementText.summary.lineNoReward,
        { title: def?.title ?? unlock.id, reward },
      );
      row.append(icon, label);
      box.append(row);
    }
    this.panel.append(box);
  }

  private offer(
    offer: NonNullable<RunScreenView['offers']>[number],
    action: () => void,
    parent: HTMLElement,
    upgrade = false,
  ): HTMLButtonElement {
    const button = this.button('', action, parent);
    button.classList.add('run-screen__card');
    if (offer.rarity) {
      button.dataset.rarity = offer.rarity;
      const rarity = document.createElement('span');
      rarity.className = 'run-screen__rarity';
      rarity.textContent = text.rarities[offer.rarity];
      button.append(rarity);
    }
    const name = document.createElement('strong');
    name.className = 'run-screen__name';
    if (upgrade) {
      const prefix = document.createElement('span');
      prefix.className = 'run-screen__upgrade';
      prefix.textContent = `${text.upgrade}: `;
      name.append(prefix);
    }
    name.append(offer.label);
    button.append(name);
    if (offer.description) this.detail(button, offer.description, 'desc');
    const tagList = offer.tags ?? [];
    if (tagList.length > 0) {
      const tags = document.createElement('span');
      tags.className = 'run-screen__tags';
      tagList.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'run-screen__tag';
        const path = tag.replace(/^#/, '');
        if (path === 'melee' || path === 'power' || path === 'gun') {
          chip.dataset.path = path;
          const label = document.createElement('b');
          label.textContent = text.paths[path];
          chip.append(label, ' ');
        }
        chip.append(tag);
        tags.append(chip);
        if (index < tagList.length - 1) tags.append(' ');
      });
      button.append(tags);
    }
    if (offer.synergies?.length)
      this.detail(
        button,
        `${text.synergies}: ${offer.synergies.join(', ')}`,
        'synergy',
      );
    if (offer.nextRarity && upgrade) {
      const next = this.detail(
        button,
        `${text.nextRarity}: ${text.rarities[offer.nextRarity]}`,
        'next',
      );
      next.dataset.rarity = offer.nextRarity;
    }
    if (offer.price !== undefined)
      this.detail(button, `${offer.price} ${text.credits}`, 'price');
    return button;
  }

  private detail(
    button: HTMLElement,
    value: string,
    kind: string,
  ): HTMLElement {
    const line = document.createElement('span');
    line.className = `run-screen__detail run-screen__detail--${kind}`;
    line.textContent = value;
    button.append(line);
    return line;
  }

  private line(value: string): HTMLParagraphElement {
    const line = document.createElement('p');
    line.textContent = value;
    this.panel.append(line);
    return line;
  }

  private button(
    label: string,
    action: () => void,
    parent: HTMLElement = this.panel,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    // Podpowiedź klawisza 1/2/3 rysuje CSS (attr bez wpływu na nazwę dostępną).
    if (this.buttons.length < 3)
      button.dataset.key = String(this.buttons.length + 1);
    button.style.setProperty('--i', String(this.buttons.length));
    this.buttons.push(button);
    parent.append(button);
    return button;
  }

  hide(): void {
    this.map.hide();
    this.clearSplash();
    this.root.hidden = true;
    this.buttons = [];
  }

  dispose(): void {
    this.clearSplash();
    window.removeEventListener('keydown', this.onKey);
    this.map.dispose();
    this.root.remove();
    this.buttons = [];
  }
}
