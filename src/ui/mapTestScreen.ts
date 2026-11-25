import { preserveLiteFx } from '../render/fxMode';
import { loadMapCatalog } from '../world/mapCatalog';
import { uiButton } from './components/button';
import { el } from './components/dom';
import './mapTestScreen.css';

/**
 * TODO: tymczasowa zakładka „Testy map” — do usunięcia po audycie map.
 * Lista wszystkich map; wybór ładuje scenę `map-walk` (gracz FPP, bez wrogów).
 */
export class MapTestScreen {
  readonly ready: Promise<void>;
  private readonly root = el('main', 'map-test ui-scope');
  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.leave();
  };

  constructor(
    host: HTMLElement,
    private readonly params: URLSearchParams,
    private readonly navigate: (url: string) => void = (url) =>
      location.assign(url),
  ) {
    const column = el('div', 'map-test__column ui-scroll');
    column.append(
      el('h1', 'main-menu__title', 'Testy map'),
      el(
        'p',
        'main-menu__subtitle',
        'Tymczasowa zakładka: wybierz mapę i przejdź ją bez wrogów. Esc wraca tutaj.',
      ),
    );
    const back = uiButton({
      label: 'Wróć do menu',
      variant: 'ghost',
      onClick: () => this.leave(),
    });
    column.append(back);
    this.root.append(column);
    host.append(this.root);
    window.addEventListener('keydown', this.onKey);
    this.ready = loadMapCatalog().then((groups) => {
      for (const group of groups) {
        const section = el('section', 'map-test__group');
        section.append(el('h2', 'ui-heading', group.title));
        const list = el('div', 'map-test__list');
        for (const map of group.maps) {
          const button = uiButton({
            label: map.name,
            description: map.id,
            variant: 'secondary',
            onClick: () => this.open(map.id),
          });
          button.dataset.mapId = map.id;
          list.append(button);
        }
        section.append(list);
        column.append(section);
      }
    });
  }

  private query(extra: Record<string, string>): string {
    const query = new URLSearchParams(extra);
    if (this.params.get('debug') === '1') query.set('debug', '1');
    preserveLiteFx(this.params, query);
    return `?${query}`;
  }

  private open(id: string): void {
    this.navigate(this.query({ scene: 'map-walk', map: id }));
  }

  private leave(): void {
    const query = this.query({});
    this.navigate(query === '?' ? '/' : `/${query}`);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
