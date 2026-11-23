import text from '../data/ui/settings.pl.json';
import uiText from '../data/ui/ui.pl.json';
import './pauseMenu.css';
import { aboutDemoText } from '../data/ui/aboutDemoSchema';
import { appBuild, buildInfoText } from './buildInfo';
import type { BuildInfo } from './buildInfo';
import { AboutDemo } from './aboutDemo';
import { createActionBar } from './components/actionBar';
import { uiButton } from './components/button';
import type { ButtonVariant } from './components/button';
import { el } from './components/dom';
import { uiConfirm } from './components/modal';

export class PauseMenu {
  private readonly root = document.createElement('dialog');
  private readonly hub: HTMLButtonElement;
  private readonly infoLine = el('p', 'pause-menu__version');
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
    this.root.className = 'pause-menu ui-scope';
    this.root.setAttribute('aria-label', text.pause);
    const panel = el('div', 'pause-menu__panel ui-panel');
    const inner = el('div', 'pause-menu__inner');
    inner.append(
      el('p', 'ui-kicker', 'ISKRA // WSTRZYMANO'),
      el('h1', 'ui-title', text.pause),
    );
    const list = el('div', 'pause-menu__list');
    const button = (
      label: string,
      action: () => void,
      variant: ButtonVariant = 'secondary',
    ): HTMLButtonElement => {
      const node = uiButton({ label, onClick: action, variant });
      list.append(node);
      return node;
    };
    button(text.resume, actions.resume, 'primary');
    button(text.title, actions.settings);
    button(aboutDemoText.title, () => this.about.showControls());
    button(aboutDemoText.report, () => {
      this.refreshInfo();
      void this.about.showReport(this.info);
    });
    const leave = (kind: 'hub' | 'menu', action: () => void) => async () => {
      const copy = uiText.leave[kind];
      const ok = await uiConfirm({
        title: copy.title,
        message: copy.message,
        confirmLabel: copy.confirm,
        cancelLabel: uiText.cancel,
        destructive: true,
      });
      if (ok) action();
    };
    this.hub = button(text.hub, () => void leave('hub', actions.hub)());
    button(text.menu, () => void leave('menu', actions.menu)());
    inner.append(list, this.infoLine);
    const bar = createActionBar([
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
      { keys: '{back}', label: uiText.resume, decorative: true },
    ]);
    panel.append(inner, bar.root);
    this.root.append(panel);
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
      const buttons = [...list.querySelectorAll('button')].filter(
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
