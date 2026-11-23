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
import { uiButton } from './components/button';
import { createActionBar } from './components/actionBar';
import type { ActionBarItem } from './components/actionBar';
import { createScreen } from './components/screen';
import type { UiScreen } from './components/screen';
import { el } from './components/dom';
import uiText from '../data/ui/ui.pl.json';
import { uiLayers } from './layers';
import { PAD_MENU_INPUT } from './padNavigation';
import type { PadFrame } from '../core/input/gamepad';

const stationText = z.object({ title: z.string(), description: z.string() });
const text = z
  .object({
    hub: z.object({
      stations: z.record(z.enum(HUB_STATION_IDS), stationText),
      placeholder: z.string(),
      path: z.string(),
      close: z.string(),
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
  private readonly actionBar = createActionBar([]);
  private readonly screen: UiScreen<HTMLDivElement>;
  private readonly root: HTMLDivElement;
  private hosted: HubPanel | null = null;
  private removeLayer: (() => void) | null = null;
  private readonly panels: HubPanelRegistry;
  private readonly host: HubPanelHost | undefined;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.repeat || event.ctrlKey || event.altKey)
      return;
    if (document.querySelector('dialog[open], .debug-console[open]')) return;
    if (event.code === 'KeyQ') this.hosted?.cycleTab?.(-1);
    else if (event.code === 'KeyE') this.hosted?.cycleTab?.(1);
  };

  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
    options: HtmlHubScreensOptions = {},
  ) {
    this.panels = options.panels ?? {};
    this.host = options.host;
    this.screen = createScreen({
      element: 'div',
      className: 'hub-screen',
      title: '',
      path: text.path,
      actionBar: this.actionBar,
    });
    this.root = this.screen.root;
    this.root.hidden = true;
    this.root.setAttribute('role', 'region');
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
    this.root.addEventListener(PAD_MENU_INPUT, (event) => {
      const frame = (event as CustomEvent<PadFrame>).detail;
      if (frame.pressed.has(4)) this.hosted?.cycleTab?.(-1);
      else if (frame.pressed.has(5)) this.hosted?.cycleTab?.(1);
    });
  }

  show(station: HubStationId, actions: HubScreenActions): void {
    this.disposePanel();
    this.removeLayer?.();
    this.root.hidden = false;
    this.root.dataset.station = station;
    const body = this.screen.body;
    body.replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock?.();
    const info = text.stations[station];
    this.screen.setTitle(info.title, text.path);
    const host = this.host;
    const factory = host ? this.panels[station] : undefined;
    let first: HTMLElement | null = null;
    if (factory && host) {
      this.hosted = factory({
        manager: host.manager,
        missionSave: host.missionSave,
        save: () => host.save(),
        navigate: (url) => host.navigate(url),
        close: actions.close,
      });
      body.append(this.hosted.root);
    } else {
      const stub = this.stub(station, info.description, actions);
      body.append(stub.root);
      first = stub.first;
    }
    this.root.classList.toggle('hub-screen--panel', this.hosted !== null);
    const items: ActionBarItem[] = [
      ...(this.hosted?.actions ?? [
        { keys: '{navigate}', label: uiText.navigate, decorative: true },
        { keys: '{confirm}', label: uiText.select, decorative: true },
      ]),
      {
        keys: '{back}',
        label: text.close,
        onClick: actions.close,
        end: true,
        id: 'close',
      },
    ];
    this.actionBar.setItems(items);
    this.removeLayer = uiLayers.push(this.root, actions.close);
    (first ?? this.hosted?.root.querySelector<HTMLElement>('button'))?.focus();
  }

  /** Odświeża panel stacji ze stanu meta (np. po zdarzeniu meta). */
  refresh(): void {
    this.hosted?.refresh();
  }

  hide(): void {
    this.disposePanel();
    this.removeLayer?.();
    this.removeLayer = null;
    this.root.hidden = true;
    this.screen.body.replaceChildren();
  }

  dispose(): void {
    this.disposePanel();
    this.removeLayer?.();
    this.removeLayer = null;
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }

  private disposePanel(): void {
    this.hosted?.dispose();
    this.hosted = null;
  }

  /** Stacja bez panelu: opis i lista trybów jako przyciski z podpisem (poligon) albo zaślepka. */
  private stub(
    station: HubStationId,
    description: string,
    actions: HubScreenActions,
  ): { root: HTMLElement; first: HTMLElement | null } {
    const panel = el('div', 'hub-stub ui-panel');
    const inner = el('div', 'hub-stub__inner');
    inner.append(el('p', 'hub-stub__text', description));
    const modes = runText.mainMenu.modeDescriptions;
    const list = el('div', 'hub-stub__list');
    const add = (
      label: string,
      action: (() => void) | undefined,
      id: string,
      desc: string,
      primary = false,
    ): void => {
      if (!action) return;
      const button = uiButton({
        label,
        description: desc,
        variant: primary ? 'primary' : 'secondary',
        onClick: action,
      });
      button.dataset.action = id;
      list.append(button);
    };
    if (station === 'arena') {
      add(text.toArena, actions.openArena, 'arena', modes.arena, true);
      add(
        runText.mainMenu.arenaMutators,
        actions.openArenaMutators,
        'arena-mutators',
        modes.arenaMutators,
      );
      add(
        challengeText.title,
        actions.openDailyChallenge,
        'challenge',
        modes.daily,
      );
      add(endlessText.title, actions.openEndless, 'endless', modes.endless);
    } else {
      inner.append(el('p', 'hub-screen__note', text.placeholder));
    }
    inner.append(list);
    panel.append(inner);
    return { root: panel, first: list.querySelector('button') };
  }
}
