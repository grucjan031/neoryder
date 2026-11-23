import type { MissionSave } from '../../core/save';
import type { MetaManager } from '../../progression/meta';
import type { ActionBarItem } from '../components/actionBar';

/**
 * Kontrakt paneli stacji kryjówki (F4-08/09/10). Panel to komponent HTML bez
 * własnego stanu gry: czyta i zmienia wyłącznie `MetaManager`, a po każdej
 * udanej zmianie woła `save()`. Nakładkę, tytuł i przycisk „Zamknij” zapewnia
 * `HtmlHubScreens`; panel wypełnia tylko swój `root`.
 */
export interface HubPanelContext {
  readonly manager: MetaManager;
  readonly missionSave?: MissionSave | null;
  /** Zapisuje meta (`saveMetaManager`); rozwiązuje się po zapisie. */
  save(): Promise<void>;
  /** Przejście przez URL (zachowuje `debug=1` po stronie hosta). */
  navigate(url: string): void;
  /** Zamyka nakładkę stacji. */
  close(): void;
}

export interface HubPanel {
  readonly root: HTMLElement;
  /** Odświeża widok ze stanu `MetaManager` (np. po zdarzeniu meta). */
  refresh(): void;
  dispose(): void;
  /** Podpowiedzi dolnego paska akcji ekranu (przed „Zamknij”); domyślnie nawigacja i wybór. */
  readonly actions?: readonly ActionBarItem[];
  /** Q/E i LB/RB: przełącza zakładkę panelu (jeśli ma zakładki). */
  cycleTab?(direction: 1 | -1): void;
}

export type HubPanelFactory = (ctx: HubPanelContext) => HubPanel;
