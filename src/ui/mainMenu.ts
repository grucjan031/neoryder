import { z } from 'zod';
import { createIndexedDbSaveStore } from '../core/save';
import type { SaveStore } from '../core/save';
import data from '../data/ui/run.pl.json';
import { BuildSelect } from './buildSelect';
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
}

export class MainMenu {
  readonly ready: Promise<void>;
  private readonly root = document.createElement('main');
  private builds: BuildSelect | null = null;
  private disposed = false;

  constructor(options: MainMenuOptions) {
    const t = text.mainMenu;
    const navigate = options.navigate ?? ((url) => location.assign(url));
    const query = (scene: string): URLSearchParams => {
      const params = new URLSearchParams({ scene });
      if (options.params?.get('debug') === '1') params.set('debug', '1');
      return params;
    };
    this.root.className = 'main-menu';
    const heading = document.createElement('h1');
    heading.textContent = t.title;
    const subtitle = document.createElement('p');
    subtitle.textContent = t.subtitle;
    const debug = options.params?.get('debug') === '1';
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = label;
      node.addEventListener('click', action);
      return node;
    };
    const hub = button(t.hub, () => navigate(`?${query('hub')}`));
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
    this.root.append(heading, subtitle, hub, resume, status, arena);
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
    }
    this.ready = (options.save ?? createIndexedDbSaveStore())
      .loadRun()
      .then((save) => {
        if (this.disposed) return;
        resume.disabled = save === null;
        const node = save?.run.map.layers
          .flat()
          .find((node) => node.id === save.run.currentNodeId);
        status.textContent = save
          ? `${text.layer}: ${node?.layer ?? 1} · ${text.hp}: ${save.run.hp}`
          : t.noSave;
      })
      .catch(() => {
        if (!this.disposed) status.textContent = t.saveError;
      });
  }

  dispose(): void {
    this.disposed = true;
    this.builds?.dispose();
    this.root.remove();
  }
}
