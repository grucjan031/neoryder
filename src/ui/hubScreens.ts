import type { MissionSave } from '../core/save';
import { z } from 'zod';
import { HUB_STATION_IDS } from '../core/metaTypes';
import type { HubStationId } from '../core/metaTypes';
import type { MetaManager } from '../progression/meta';
import textData from '../data/ui/meta.pl.json';
import runText from '../data/ui/run.pl.json';
import endlessText from '../data/ui/endless.pl.json';
import { challengeText } from './challengeText';
import type { HubPanel, HubPanelFactory } from './hub/hubPanel';
import './hubScreens.css';
import { setInputHint } from './inputGlyphs';

const stationText = z.object({ title: z.string(), description: z.string() });
const text = z
  .object({
    hub: z.object({
      stations: z.record(z.enum(HUB_STATION_IDS), stationText),
      placeholder: z.string(),
      close: z.string(),
      closeHint: z.string(),
      toArena: z.string(),
    }),
  })
  .parse(textData).hub;

export interface HubScreenActions {
  /** Zamyka nakładkę; scena wznawia ruch gracza. */
  close(): void;
  /** Tylko `arena`: przejście na poligon. */
  openArena?(): void;
  openArenaMutators?(): void;
  openDailyChallenge?(): void;
  openEndless?(): void;
}

/** Nakładki stacji kryjówki wstrzykiwane do `HubScene`; implementacja HTML poniżej, w testach atrapa. */
export interface HubScreens {
  show(station: HubStationId, actions: HubScreenActions): void;
  hide(): void;
  /** Odświeża widok otwartej stacji po zmianie stanu meta (opcjonalne). */
  refresh?(): void;
  dispose(): void;
}

/** Rejestr paneli stacji: stacja z fabryką dostaje panel w treści nakładki, pozostałe zaślepkę. */
export type HubPanelRegistry = Partial<Record<HubStationId, HubPanelFactory>>;

/** Zależności paneli (kontekst `HubPanelContext` bez `close`, który zapewnia nakładka). */
export interface HubPanelHost {
  readonly manager: MetaManager;
  readonly missionSave?: MissionSave | null;
  save(): Promise<void>;
  navigate(url: string): void;
}

export interface HtmlHubScreensOptions {
  panels?: HubPanelRegistry;
  host?: HubPanelHost;
}

/** Nakładki stacji: panele z rejestru (talenty, warsztat, tablica misji) i zaślepki dla pozostałych (poligon). */
export class HtmlHubScreens implements HubScreens {
  private readonly root = document.createElement('section');
  private readonly panel = document.createElement('div');
  private actions: HubScreenActions | null = null;
  private hosted: HubPanel | null = null;
  private readonly panels: HubPanelRegistry;
  private readonly host: HubPanelHost | undefined;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.code !== 'Escape' || event.repeat) return;
    event.preventDefault();
    this.actions?.close();
  };

  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
    options: HtmlHubScreensOptions = {},
  ) {
    this.panels = options.panels ?? {};
    this.host = options.host;
    this.root.className = 'hub-screen';
    this.root.setAttribute('aria-label', 'Kryjówka');
    this.root.hidden = true;
    this.panel.className = 'hub-screen__panel';
    this.root.append(this.panel);
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(station: HubStationId, actions: HubScreenActions): void {
    this.disposePanel();
    this.actions = actions;
    this.root.hidden = false;
    this.root.dataset.station = station;
    this.panel.replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock?.();
    const info = text.stations[station];
    const heading = document.createElement('h1');
    heading.textContent = info.title;
    const host = this.host;
    const factory = host ? this.panels[station] : undefined;
    const buttons: HTMLButtonElement[] = [];
    if (factory && host) {
      this.hosted = factory({
        manager: host.manager,
        missionSave: host.missionSave,
        save: () => host.save(),
        navigate: (url) => host.navigate(url),
        close: actions.close,
      });
      this.panel.append(heading, this.hosted.root);
    } else {
      this.panel.append(heading, this.line(info.description));
      if (station === 'arena' && actions.openArena) {
        buttons.push(this.button(text.toArena, actions.openArena, 'arena'));
        if (actions.openArenaMutators)
          buttons.push(
            this.button(
              runText.mainMenu.arenaMutators,
              actions.openArenaMutators,
              'arena-mutators',
            ),
          );
        if (actions.openDailyChallenge)
          buttons.push(
            this.button(
              challengeText.title,
              actions.openDailyChallenge,
              'challenge',
            ),
          );
        if (actions.openEndless)
          buttons.push(
            this.button(endlessText.title, actions.openEndless, 'endless'),
          );
      } else {
        this.panel.append(this.line(text.placeholder, 'hub-screen__note'));
      }
    }
    this.root.classList.toggle('hub-screen--panel', this.hosted !== null);
    buttons.push(this.button(text.close, actions.close, 'close'));
    this.panel.append(
      ...buttons,
      setInputHint(this.line('', 'hub-screen__hint'), text.closeHint),
    );
    (
      this.hosted?.root.querySelector<HTMLElement>('button') ?? buttons[0]
    )?.focus();
  }

  /** Odświeża panel stacji ze stanu meta (np. po zdarzeniu meta). */
  refresh(): void {
    this.hosted?.refresh();
  }

  hide(): void {
    this.disposePanel();
    this.root.hidden = true;
    this.actions = null;
    this.panel.replaceChildren();
  }

  dispose(): void {
    this.disposePanel();
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.actions = null;
  }

  private disposePanel(): void {
    this.hosted?.dispose();
    this.hosted = null;
  }

  private line(value: string, className?: string): HTMLParagraphElement {
    const line = document.createElement('p');
    line.textContent = value;
    if (className) line.className = className;
    return line;
  }

  private button(
    label: string,
    action: () => void,
    id: string,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = id;
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }
}
