import text from '../data/ui/settings.pl.json';
import './pauseMenu.css';

export class PauseMenu {
  private readonly root = document.createElement('dialog');
  private readonly hub: HTMLButtonElement;
  constructor(actions: {
    resume(): void;
    settings(): void;
    hub(): void;
    menu(): void;
  }) {
    this.root.className = 'pause-menu';
    this.root.setAttribute('aria-label', text.pause);
    const title = document.createElement('h1');
    title.textContent = text.pause;
    this.root.append(title);
    const button = (label: string, action: () => void): HTMLButtonElement => {
      const node = document.createElement('button');
      node.type = 'button';
      node.textContent = label;
      node.addEventListener('click', action);
      this.root.append(node);
      return node;
    };
    button(text.resume, actions.resume);
    button(text.title, actions.settings);
    this.hub = button(text.hub, actions.hub);
    button(text.menu, actions.menu);
    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (document.querySelector('.debug-console[open]')) return;
      actions.resume();
    });
    this.root.addEventListener('keydown', (event) => {
      if (document.querySelector('.debug-console[open]')) return;
      event.stopPropagation();
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const buttons = [...this.root.querySelectorAll('button')].filter(
        (node) => !node.hidden,
      );
      const index = buttons.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      buttons[
        (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) %
          buttons.length
      ]?.focus();
    });
    document.body.append(this.root);
  }
  get visible(): boolean {
    return this.root.open;
  }
  show(canReturnToHub: boolean): void {
    this.hub.hidden = !canReturnToHub;
    if (!this.root.open) this.root.showModal();
    this.root.querySelector('button')?.focus();
  }
  hide(): void {
    this.root.close();
  }
  dispose(): void {
    this.root.remove();
  }
}
