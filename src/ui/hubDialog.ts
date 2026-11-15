import type { NpcLine } from '../world/hubNpcs';
import './hubScreens.css';

/** Dymek rozmowy z NPC u dołu ekranu: imię, rola i jedna kwestia (styl „wizjer” jak `HubPrompt`). */
export class HubDialog {
  private readonly root = document.createElement('div');
  private readonly name = document.createElement('span');
  private readonly role = document.createElement('span');
  private readonly line = document.createElement('p');

  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    this.root.className = 'hub-dialog';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.name.className = 'hub-dialog__name';
    this.role.className = 'hub-dialog__role';
    this.line.className = 'hub-dialog__line';
    const header = document.createElement('div');
    header.className = 'hub-dialog__header';
    header.append(this.name, this.role);
    this.root.append(header, this.line);
    parent.append(this.root);
  }

  show(line: NpcLine): void {
    this.name.textContent = line.name;
    this.role.textContent = line.role;
    this.line.textContent = line.line;
    this.root.dataset.npc = line.id;
    // Ponowne uruchomienie animacji wejścia przy każdej kwestii.
    this.root.hidden = true;
    void this.root.offsetWidth;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  dispose(): void {
    this.root.remove();
  }
}
