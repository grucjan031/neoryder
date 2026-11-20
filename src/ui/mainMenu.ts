import { z } from 'zod';
import { createIndexedDbSaveStore } from '../core/save';
import type { RunEnded, SaveStore } from '../core/save';
import { MetaManager } from '../progression/meta';
import { createStarterMetaState } from '../progression/progressionSchema';
import data from '../data/ui/run.pl.json';
import { BuildSelect } from './buildSelect';
import { SettingsScreen } from './settingsScreen';
import settingsText from '../data/ui/settings.pl.json';
import tutorialText from '../data/ui/tutorial.pl.json';
import { tutorialDone } from '../data/tutorial/schema';
import { preserveLiteFx } from '../render/fxMode';
import './mainMenu.css';

const text = z
  .object({
    mainMenu: z.object({
      title: z.string(),
      subtitle: z.string(),
      hub: z.string(),
      newRun: z.string(),
      continue: z.string(),
      arena: z.string(),
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

  constructor(options: MainMenuOptions) {
    const t = text.mainMenu;
    const navigate = options.navigate ?? ((url) => location.assign(url));
    const query = (scene: string): URLSearchParams => {
      const params = new URLSearchParams({ scene });
      if (options.params?.get('debug') === '1') params.set('debug', '1');
      if (options.params) preserveLiteFx(options.params, params);
      return params;
    };
    this.root.className = 'main-menu';
    const heading = document.createElement('h1');
    heading.textContent = t.title;
    const subtitle = document.createElement('p');
    subtitle.textContent = t.subtitle;
    const debug = options.debug ?? options.params?.get('debug') === '1';
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = label;
      node.addEventListener('click', action);
      return node;
    };
    const saveStore = options.save ?? createIndexedDbSaveStore();
    const tutorial = button(tutorialText.title, () =>
      navigate(`?${query('tutorial')}`),
    );
    tutorial.setAttribute('aria-label', tutorialText.title);
    const hub = button(t.hub, () => navigate(`?${query('hub')}`));
    hub.className = 'main-menu__hub';
    const metaReady = saveStore
      .loadMeta()
      .then((meta) => {
        if (this.disposed || meta !== null || tutorialDone()) return;
        tutorial.classList.add('main-menu__tutorial--recommended');
        const hint = document.createElement('small');
        hint.className = 'main-menu__tutorial-hint';
        hint.textContent = tutorialText.menuHint;
        tutorial.append(hint);
        tutorial.setAttribute('aria-description', tutorialText.menuHint);
      })
      .catch(() => {
        // Błąd odczytu nie oznacza braku zapisu; samouczek pozostaje dostępny przyciskiem.
      });
    const resume = button(t.continue, () => {
      const params = query('run');
      params.set('continue', '1');
      navigate(`?${params}`);
    });
    resume.disabled = true;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = t.loading;
    const arena = button(t.arena, () => navigate(`?${query('arena')}`));
    this.root.append(heading, subtitle, tutorial, hub, resume, status, arena);
    this.root.append(
      button(settingsText.title, () => {
        this.settings ??= new SettingsScreen();
        this.settings.show();
      }),
    );
    options.root.append(this.root);
    // Wybór presetów (BuildSelect) z własnym seedem zostaje tylko w trybie debug.
    if (debug) {
      const seedLabel = document.createElement('label');
      seedLabel.textContent = t.seed;
      const seed = document.createElement('input');
      seed.type = 'text';
      seed.placeholder = t.seedPlaceholder;
      seed.value = options.params?.get('seed') ?? '';
      seedLabel.append(seed);
      const newRun = button(t.newRun, () => this.builds?.show());
      this.root.append(seedLabel, newRun);
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
      const back = button(t.back, () => {
        this.builds?.hide();
        newRun.focus();
      });
      this.root.querySelector('.build-select__panel')?.prepend(back);
      const scenes = new URLSearchParams({ scenes: '1' });
      if (options.params?.get('debug') === '1') scenes.set('debug', '1');
      if (options.params) preserveLiteFx(options.params, scenes);
      this.root.append(button(t.debug, () => navigate(`?${scenes}`)));
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
    const runReady = saveStore
      .loadRun()
      .then(async (save) => {
        const ended = save?.ended ? await endedStatus(save.ended) : null;
        if (this.disposed) return;
        resume.disabled = save === null;
        const node = save?.run.map.layers
          .flat()
          .find((node) => node.id === save.run.currentNodeId);
        status.textContent =
          ended ??
          (save
            ? `${text.layer}: ${node?.layer ?? 1} · ${text.hp}: ${Math.ceil(save.run.hp)}`
            : t.noSave);
      })
      .catch(() => {
        if (!this.disposed) status.textContent = t.saveError;
      });
    this.ready = Promise.all([runReady, metaReady]).then(() => {});
  }

  dispose(): void {
    this.disposed = true;
    this.builds?.dispose();
    this.settings?.dispose();
    this.root.remove();
  }
}
