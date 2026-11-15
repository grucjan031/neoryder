import { z } from 'zod';
import textData from '../data/ui/meta.pl.json';
import './hubScreens.css';

const text = z
  .object({ hub: z.object({ interact: z.string(), interactKey: z.string() }) })
  .parse(textData).hub;

/** Podpowiedź interakcji; scena przekazuje etykietę wybranej stacji podczas renderowania. */
export class HubPrompt {
  private readonly root = document.createElement('div');
  private readonly label = document.createElement('span');

  constructor(
    parent: Element = document.querySelector('#app') ?? document.body,
  ) {
    this.root.className = 'hub-prompt';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', text.interact);
    const key = document.createElement('kbd');
    key.textContent = text.interactKey;
    this.root.append(key, this.label);
    parent.append(this.root);
  }

  update(label: string | null, overlayOpen = false): void {
    this.root.hidden = label === null || overlayOpen;
    this.label.textContent = label ?? '';
  }

  dispose(): void {
    this.root.remove();
  }
}
