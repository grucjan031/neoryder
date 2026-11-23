import { playUiSound } from '../audio/uiSounds';

export interface UiLayer {
  /** Korzeń warstwy (okno `dialog` albo panel w dokumencie). */
  readonly root: HTMLElement;
  /** Element, któremu wraca fokus po zamknięciu. */
  readonly opener: HTMLElement | null;
  /** Zamyka warstwę (wołane przez Esc / B); ma zawołać `remove`. */
  readonly close: () => void;
}

/**
 * Menedżer warstw interfejsu: stos okien i paneli. Esc (i B na padzie, który wysyła Esc)
 * zamyka górną warstwę, a fokus wraca na element, który ją otworzył.
 * Okna `dialog` z `showModal()` same obsługują Esc (zdarzenie `cancel`); menedżer
 * zarządza panelami w dokumencie i pilnuje stosu oraz fokusu dla wszystkich.
 */
export class LayerManager {
  private readonly stack: UiLayer[] = [];
  private listening = false;

  get depth(): number {
    return this.stack.length;
  }

  get top(): UiLayer | undefined {
    return this.stack.at(-1);
  }

  /** Otwiera warstwę; zwraca funkcję zamykającą (przywraca fokus). */
  push(
    root: HTMLElement,
    close: () => void,
    opener: Element | null = document.activeElement,
  ): () => void {
    const layer: UiLayer = {
      root,
      close,
      opener: opener instanceof HTMLElement ? opener : null,
    };
    this.stack.push(layer);
    this.listen();
    return () => this.remove(layer);
  }

  private remove(layer: UiLayer, restoreFocus = true): void {
    const index = this.stack.indexOf(layer);
    if (index < 0) return;
    const wasTop = index === this.stack.length - 1;
    this.stack.splice(index, 1);
    if (this.stack.length === 0) this.unlisten();
    if (wasTop && restoreFocus && layer.opener?.isConnected)
      layer.opener.focus();
  }

  /** Zamyka górną warstwę; false, gdy stos pusty. */
  closeTop(): boolean {
    const layer = this.stack.at(-1);
    if (!layer) return false;
    playUiSound('back');
    layer.close();
    // Warstwa, która nie usunęła się sama, jest usuwana tutaj (zabezpieczenie przed zawieszeniem stosu).
    if (this.stack.includes(layer)) this.remove(layer);
    return true;
  }

  clear(): void {
    this.stack.length = 0;
    this.unlisten();
  }

  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const layer = this.stack.at(-1);
    if (!layer) return;
    // Okno modalne obsługuje Esc natywnie (cancel); warstwy-panele zamykamy tu.
    if (layer.root instanceof HTMLDialogElement && layer.root.open) return;
    if (document.querySelector('.debug-console[open]')) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeTop();
  };

  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener('keydown', this.keydown);
  }

  private unlisten(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener('keydown', this.keydown);
  }
}

export const uiLayers = new LayerManager();
