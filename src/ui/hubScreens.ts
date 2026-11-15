import { z } from 'zod';
import { HUB_STATION_IDS } from '../core/metaTypes';
import type { HubStationId } from '../core/metaTypes';
import textData from '../data/ui/meta.pl.json';
import './hubScreens.css';

const stationText = z.object({ title: z.string(), description: z.string() });
const text = z
  .object({
    hub: z.object({
      stations: z.record(z.enum(HUB_STATION_IDS), stationText),
      placeholder: z.string(),
      close: z.string(),
      closeHint: z.string(),
      startRun: z.string(),
      toArena: z.string(),
    }),
  })
  .parse(textData).hub;

export interface HubScreenActions {
  /** Zamyka nakładkę; scena wznawia ruch gracza. */
  close(): void;
  /** Tylko `missions`: start runu (tymczasowo preset `classic`, zadanie 10 to zmieni). */
  startRun?(): void;
  /** Tylko `arena`: przejście na poligon. */
  openArena?(): void;
}

/** Nakładki stacji kryjówki wstrzykiwane do `HubScene`; implementacja HTML poniżej, w testach atrapa. */
export interface HubScreens {
  show(station: HubStationId, actions: HubScreenActions): void;
  hide(): void;
  dispose(): void;
}

/** Zaślepki nakładek stacji (zadania 08–10 zastąpią je pełnymi ekranami). */
export class HtmlHubScreens implements HubScreens {
  private readonly root = document.createElement('section');
  private readonly panel = document.createElement('div');
  private actions: HubScreenActions | null = null;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (this.root.hidden || event.code !== 'Escape' || event.repeat) return;
    event.preventDefault();
    this.actions?.close();
  };

  constructor(parent = document.querySelector('#app') ?? document.body) {
    this.root.className = 'hub-screen';
    this.root.setAttribute('aria-label', 'Kryjówka');
    this.root.hidden = true;
    this.panel.className = 'hub-screen__panel';
    this.root.append(this.panel);
    parent.append(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  show(station: HubStationId, actions: HubScreenActions): void {
    this.actions = actions;
    this.root.hidden = false;
    this.root.dataset.station = station;
    this.panel.replaceChildren();
    if (document.pointerLockElement) document.exitPointerLock?.();
    const info = text.stations[station];
    const heading = document.createElement('h1');
    heading.textContent = info.title;
    this.panel.append(heading, this.line(info.description));
    this.panel.append(this.line(text.placeholder, 'hub-screen__note'));
    const buttons: HTMLButtonElement[] = [];
    if (station === 'missions' && actions.startRun)
      buttons.push(this.button(text.startRun, actions.startRun, 'start'));
    if (station === 'arena' && actions.openArena)
      buttons.push(this.button(text.toArena, actions.openArena, 'arena'));
    buttons.push(this.button(text.close, actions.close, 'close'));
    this.panel.append(
      ...buttons,
      this.line(text.closeHint, 'hub-screen__hint'),
    );
    buttons[0]?.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.actions = null;
    this.panel.replaceChildren();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
    this.actions = null;
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
