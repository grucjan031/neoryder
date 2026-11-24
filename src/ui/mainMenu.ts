import { z } from 'zod';
import { createIndexedDbSaveStore } from '../core/save';
import type { RunEnded, SaveStore } from '../core/save';
import { MetaManager } from '../progression/meta';
import { createStarterMetaState } from '../progression/progressionSchema';
import data from '../data/ui/run.pl.json';
import { BuildSelect } from './buildSelect';
import { SettingsScreen } from './settingsScreen';
import { getSplashes, splashUrl } from './splash';
import settingsText from '../data/ui/settings.pl.json';
import uiText from '../data/ui/ui.pl.json';
import tutorialText from '../data/ui/tutorial.pl.json';
import { tutorialDone } from '../data/tutorial/schema';
import { getLiteFx, preserveLiteFx } from '../render/fxMode';
import { challengeText } from './challengeText';
import endlessText from '../data/ui/endless.pl.json';
import { createActionBar } from './components/actionBar';
import type { ActionBarItem } from './components/actionBar';
import { uiButton } from './components/button';
import type { ButtonVariant } from './components/button';
import { el } from './components/dom';
import { uiLayers } from './layers';
import './mainMenu.css';
import { appBuild, buildInfoText } from './buildInfo';

const text = z
  .object({
    mainMenu: z.object({
      title: z.string(),
      subtitle: z.string(),
      kicker: z.string(),
      hub: z.string(),
      hubHint: z.string(),
      newRun: z.string(),
      continue: z.string(),
      continueHint: z.string(),
      arena: z.string(),
      arenaMutators: z.string(),
      modes: z.string(),
      modesHint: z.string(),
      modesTitle: z.string(),
      modeDescriptions: z.object({
        arena: z.string(),
        arenaMutators: z.string(),
        daily: z.string(),
        endless: z.string(),
      }),
      settingsHint: z.string(),
      debugGroup: z.string(),
      seed: z.string(),
      seedPlaceholder: z.string(),
      loading: z.string(),
      noSave: z.string(),
      unsettled: z.string(),
      settled: z.string(),
      unsettledBroken: z.string(),
      saveError: z.string(),
      back: z.string(),
      debug: z.string(),
    }),
    hp: z.string(),
    layer: z.string(),
  })
  .parse(data);

interface MainMenuOptions {
  root: HTMLElement;
  save?: SaveStore;
  navigate?: (url: string) => void;
  params?: URLSearchParams;
  /** Tryb debug (presety, seed, lista scen); domyślnie `?debug=1` w parametrach. */
  debug?: boolean;
}

export class MainMenu {
  readonly ready: Promise<void>;
  private readonly root = document.createElement('main');
  private builds: BuildSelect | null = null;
  private disposed = false;
  private settings: SettingsScreen | null = null;
  private removeModesLayer: (() => void) | null = null;

  constructor(options: MainMenuOptions) {
    const t = text.mainMenu;
    const navigate = options.navigate ?? ((url) => location.assign(url));
    const query = (scene: string): URLSearchParams => {
      const params = new URLSearchParams({ scene });
      if (options.params?.get('debug') === '1') params.set('debug', '1');
      if (options.params) preserveLiteFx(options.params, params);
      return params;
    };
    this.root.className = 'main-menu ui-scope';
    const debug = options.debug ?? options.params?.get('debug') === '1';
    const button = (
      label: string,
      action: () => void,
      variant: ButtonVariant = 'secondary',
      description?: string,
    ): HTMLButtonElement =>
      uiButton({ label, onClick: action, variant, description });
    const saveStore = options.save ?? createIndexedDbSaveStore();

    // Tło: splashart menu (bez obrazu w trybie lite i przy braku danych).
    const art = getLiteFx()
      ? undefined
      : getSplashes().find((entry) => entry.scenes?.includes('menu'));
    if (art) {
      const image = el('img', 'main-menu__art');
      image.alt = '';
      image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      image.addEventListener('error', () => image.remove());
      image.src = splashUrl(art);
      this.root.append(image);
    }
    this.root.append(el('div', 'main-menu__shade'));

    const column = el('div', 'main-menu__column ui-scroll');
    const brand = el('header', 'main-menu__brand');
    brand.append(
      el('p', 'ui-kicker', t.kicker),
      el('h1', 'main-menu__title', t.title),
      el('p', 'main-menu__subtitle', t.subtitle),
    );
    const home = el('nav', 'main-menu__home');
    home.setAttribute('aria-label', t.title);

    const hub = button(
      t.hub,
      () => navigate(`?${query('hub')}`),
      'primary',
      t.hubHint,
    );
    hub.classList.add('main-menu__hub');
    const resume = button(t.continue, () => {
      const params = query('run');
      params.set('continue', '1');
      navigate(`?${params}`);
    });
    resume.disabled = true;
    const primary = el('div', 'main-menu__primary');
    primary.append(hub, resume);
    const status = el('p', 'main-menu__status');
    status.setAttribute('role', 'status');
    status.textContent = t.loading;

    const modesButton = button(
      t.modes,
      () => openModes(),
      'secondary',
      t.modesHint,
    );
    modesButton.setAttribute('aria-haspopup', 'true');
    const settingsButton = button(
      settingsText.title,
      () => {
        this.settings ??= new SettingsScreen();
        this.settings.show();
      },
      'secondary',
      t.settingsHint,
    );
    const tutorial = button(
      tutorialText.title,
      () => navigate(`?${query('tutorial')}`),
      'quiet',
    );
    tutorial.classList.add('main-menu__tutorial');
    const metaReady = saveStore
      .loadMeta()
      .then((meta) => {
        if (this.disposed || meta !== null || tutorialDone()) return;
        tutorial.classList.add('main-menu__tutorial--recommended');
        const hint = document.createElement('small');
        hint.className = 'main-menu__tutorial-hint';
        hint.textContent = tutorialText.menuHint;
        tutorial.querySelector('.ui-button__body')?.append(hint);
        tutorial.setAttribute('aria-description', tutorialText.menuHint);
      })
      .catch(() => {
        // Błąd odczytu nie oznacza braku zapisu; samouczek pozostaje dostępny przyciskiem.
      });
    // TODO: tymczasowa zakładka „Testy map” do usunięcia po audycie map (widoczna zawsze).
    const mapTests = button(
      'Testy map',
      () => {
        const params = new URLSearchParams({ maps: '1' });
        if (options.params?.get('debug') === '1') params.set('debug', '1');
        if (options.params) preserveLiteFx(options.params, params);
        navigate(`?${params}`);
      },
      'quiet',
    );
    mapTests.dataset.mapTests = '';
    home.append(
      primary,
      status,
      modesButton,
      settingsButton,
      tutorial,
      mapTests,
    );

    // Podmenu „Tryby”: osobna warstwa w kolumnie (Esc / B wraca do menu głównego).
    const modes = el('section', 'main-menu__modes');
    modes.hidden = true;
    modes.setAttribute('aria-label', t.modesTitle);
    const modesList = el('div', 'main-menu__modes-list');
    modesList.append(
      el('h2', 'ui-heading', t.modesTitle),
      button(
        t.arena,
        () => navigate(`?${query('arena')}`),
        'secondary',
        t.modeDescriptions.arena,
      ),
      button(
        t.arenaMutators,
        () => {
          const params = query('arena-mutators');
          const seed = options.params?.get('seed');
          if (seed !== undefined && seed !== null) params.set('seed', seed);
          navigate(`?${params}`);
        },
        'secondary',
        t.modeDescriptions.arenaMutators,
      ),
      button(
        challengeText.title,
        () => {
          const params = query('challenge');
          params.delete('scene');
          params.set('daily', '1');
          navigate(`?${params}`);
        },
        'secondary',
        t.modeDescriptions.daily,
      ),
      button(
        endlessText.title,
        () => {
          const params = query('endless');
          const seed = options.params?.get('seed');
          if (seed) params.set('seed', seed);
          navigate(`?${params}`);
        },
        'secondary',
        t.modeDescriptions.endless,
      ),
    );
    modes.append(modesList);

    const homeItems: ActionBarItem[] = [
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
    ];
    const bar = createActionBar(homeItems);
    const closeModes = (): void => {
      if (modes.hidden) return;
      modes.hidden = true;
      home.hidden = false;
      const remove = this.removeModesLayer;
      this.removeModesLayer = null;
      // Fokus wraca na przycisk „Tryby” (element, który otworzył warstwę).
      remove?.();
      bar.setItems(homeItems);
    };
    const openModes = (): void => {
      if (!modes.hidden) return;
      home.hidden = true;
      modes.hidden = false;
      this.removeModesLayer = uiLayers.push(modes, closeModes, modesButton);
      bar.setItems([
        ...homeItems,
        {
          keys: '{back}',
          label: uiText.back,
          onClick: closeModes,
          end: true,
        },
      ]);
      bar.root
        .querySelector<HTMLElement>('button')
        ?.setAttribute('data-pad-back', '');
      modesList.querySelector<HTMLElement>('button')?.focus();
    };

    column.append(brand, home, modes);
    const footer = el('footer', 'main-menu__version');
    footer.textContent = buildInfoText(appBuild);
    const barRow = el('div', 'main-menu__bar');
    barRow.append(bar.root, footer);
    this.root.append(column, barRow);
    options.root.append(this.root);

    column.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
      const items = [
        ...column.querySelectorAll<HTMLElement>('button, input'),
      ].filter(
        (node) =>
          !node.closest('[hidden]') &&
          !(node as HTMLButtonElement).disabled &&
          !node.closest('.build-select'),
      );
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = items[index + (event.key === 'ArrowDown' ? 1 : -1)];
      event.preventDefault();
      if (index < 0) items[0]?.focus();
      else next?.focus();
    });

    // Wybór presetów (BuildSelect) z własnym seedem zostaje tylko w trybie debug.
    if (debug) {
      const group = el('div', 'main-menu__debug');
      group.append(el('p', 'ui-kicker', t.debugGroup));
      const seedLabel = el('label', 'main-menu__seed', t.seed);
      const seed = document.createElement('input');
      seed.type = 'text';
      seed.placeholder = t.seedPlaceholder;
      seed.value = options.params?.get('seed') ?? '';
      seedLabel.append(seed);
      const newRun = button(t.newRun, () => this.builds?.show(), 'quiet');
      group.append(seedLabel, newRun);
      this.builds = new BuildSelect({
        root: this.root,
        onSelect: (loadoutId) => {
          const params = query('run');
          params.set(
            'seed',
            seed.value.trim() ||
              Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
                value.toString(16),
              ).join('-'),
          );
          params.set('loadout', loadoutId);
          navigate(`?${params}`);
        },
      });
      const back = button(
        t.back,
        () => {
          this.builds?.hide();
          newRun.focus();
        },
        'ghost',
      );
      back.dataset.padBack = '';
      this.root.querySelector('.build-select__panel')?.prepend(back);
      const scenes = new URLSearchParams({ scenes: '1' });
      if (options.params?.get('debug') === '1') scenes.set('debug', '1');
      if (options.params) preserveLiteFx(options.params, scenes);
      group.append(button(t.debug, () => navigate(`?${scenes}`), 'quiet'));
      home.append(group);
    }

    /** Status zakończonego runu: już rozliczony, do rozliczenia albo nienaliczalny. */
    const endedStatus = async (ended: RunEnded): Promise<string> => {
      let manager: MetaManager;
      try {
        const meta = await saveStore.loadMeta();
        manager = meta
          ? MetaManager.restore(meta.meta)
          : new MetaManager(createStarterMetaState());
      } catch {
        return t.unsettled;
      }
      if (manager.state.appliedRunIds.includes(ended.runId)) return t.settled;
      try {
        // Próbne naliczenie na kopii w pamięci (bez zapisu i zdarzeń).
        manager.applyRun(ended.summary, ended.runId);
        return t.unsettled;
      } catch {
        return t.unsettledBroken;
      }
    };
    /** Główną akcją jest Kontynuuj, gdy jest zapis; inaczej Kryjówka. */
    const promote = (continueIsPrimary: boolean): void => {
      const [first, second] = continueIsPrimary ? [resume, hub] : [hub, resume];
      first.classList.remove('ui-button--secondary');
      first.classList.add('ui-button--primary');
      second.classList.remove('ui-button--primary');
      second.classList.add('ui-button--secondary');
      primary.append(first, second);
    };
    const runReady = saveStore
      .loadRun()
      .then(async (save) => {
        const ended = save?.ended ? await endedStatus(save.ended) : null;
        if (this.disposed) return;
        resume.disabled = save === null;
        if (save) {
          promote(true);
          const hasFocus =
            !document.activeElement ||
            document.activeElement === document.body ||
            document.activeElement === hub;
          if (hasFocus) resume.focus();
        }
        const node = save?.run.map.layers
          .flat()
          .find((node) => node.id === save.run.currentNodeId);
        status.textContent =
          ended ??
          (save
            ? `${text.layer}: ${node?.layer ?? 1} · ${text.hp}: ${Math.ceil(save.run.hp)}`
            : t.noSave);
        status.dataset.state = save ? 'save' : 'empty';
      })
      .catch(() => {
        if (!this.disposed) {
          status.textContent = t.saveError;
          status.dataset.state = 'error';
        }
      });
    this.ready = Promise.all([runReady, metaReady]).then(() => {});
    hub.focus();
  }

  dispose(): void {
    this.disposed = true;
    this.removeModesLayer?.();
    this.removeModesLayer = null;
    this.builds?.dispose();
    this.settings?.dispose();
    this.root.remove();
  }
}
