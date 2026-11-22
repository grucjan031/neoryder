import text from '../data/ui/settings.pl.json';
import './pauseMenu.css';
import { aboutDemoText } from '../data/ui/aboutDemoSchema';
import { appBuild, buildInfoText } from './buildInfo';
import type { BuildInfo } from './buildInfo';
import { AboutDemo } from './aboutDemo';
import { setInputHint } from './inputGlyphs';

export class PauseMenu {
  private readonly root = document.createElement('dialog');
  private readonly hub: HTMLButtonElement;
  private readonly infoLine = document.createElement('p');
  private readonly about = new AboutDemo();
  private info: BuildInfo = appBuild;
  constructor(
    private readonly actions: {
      infoProvider?(): { seed: string; scene: string };
      resume(): void;
      settings(): void;
      hub(): void;
      menu(): void;
    },
  ) {
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
    const resume = button(text.resume, actions.resume);
    resume.setAttribute('aria-label', text.resume);
    setInputHint(resume, text.resume, `${text.resume} {pause}`);
    button(text.title, actions.settings);
    button(aboutDemoText.title, () => this.about.showControls());
    button(aboutDemoText.report, () => {
      this.refreshInfo();
      void this.about.showReport(this.info);
    });
    this.hub = button(text.hub, actions.hub);
    button(text.menu, actions.menu);
    this.infoLine.className = 'pause-menu__version';
    this.root.append(this.infoLine);
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
    this.refreshInfo();
  }
  hide(): void {
    this.about.hide();
    this.root.close();
  }
  dispose(): void {
    this.about.dispose();
    this.root.remove();
  }

  private refreshInfo(): void {
    this.info = { ...appBuild, ...this.actions.infoProvider?.() };
    this.infoLine.textContent = buildInfoText(this.info);
  }
}
